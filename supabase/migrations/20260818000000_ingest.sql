-- QuickBugs ingest schema.
--
-- Supports the concierge phase (a design partner installs the SDK, reports land
-- here, the operator reads them) and is the same shape the hosted inbox will
-- read from. Nothing here is throwaway.
--
-- Note: the private Platform repo references a `report_events` table. This
-- migration deliberately uses `reports`, matching the ingest contract in
-- packages/ingest. Reconcile the two before running both against one database.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  name          text not null,

  -- Public by construction: this ships inside the customer's browser bundle.
  -- Treated as an identifier, never as a secret.
  project_key   text not null unique,

  -- Empty array means "accept any origin". See assertOriginAllowed — this is a
  -- spend control against a scraped key, not an authentication mechanism.
  allowed_origins text[] not null default '{}',

  -- Rotated keys stay resolvable but inert, so a stale deploy gets a clear
  -- rejection instead of silently writing into the wrong project.
  active        boolean not null default true,

  retention_days integer not null default 90
    constraint projects_retention_days_positive check (retention_days > 0),

  created_at    timestamptz not null default now()
);

create index if not exists projects_owner_id_idx on public.projects (owner_id);

comment on column public.projects.project_key is
  'Public key embedded in the customer''s client bundle. Format: pk_live_… / pk_test_…';

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

create type public.report_status as enum ('new', 'triaged', 'in_progress', 'resolved', 'closed');

create table if not exists public.reports (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects (id) on delete cascade,

  -- Client-generated, stable across retries. The unique index below is what
  -- actually enforces idempotency; the handler's read-before-write is only an
  -- optimisation that avoids a failed insert on the common path.
  client_report_id   text,

  schema_version     text not null default '1.0',
  status             public.report_status not null default 'new',

  -- Promoted from the payload because the inbox filters and sorts on them.
  title              text not null,
  description        text,
  steps_to_reproduce text,
  expected_result    text,
  actual_result      text,
  additional_context text,
  page_url           text,
  capture_mode       text,
  environment        text,
  app_version        text,
  browser_name       text,
  os_name            text,
  reporter_email     text,
  reporter_name      text,

  -- Everything else the contract allows, kept verbatim so adding a context
  -- field to the SDK needs no migration.
  fields             jsonb not null default '{}'::jsonb,

  created_at         timestamptz not null default now()
);

-- Idempotency. Partial, so the many reports with no client id do not collide
-- with each other on a single NULL.
create unique index if not exists reports_project_client_id_key
  on public.reports (project_id, client_report_id)
  where client_report_id is not null;

create index if not exists reports_project_created_idx
  on public.reports (project_id, created_at desc);

create index if not exists reports_project_status_idx
  on public.reports (project_id, status);

-- ---------------------------------------------------------------------------
-- Attachments
-- ---------------------------------------------------------------------------

create table if not exists public.report_attachments (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.reports (id) on delete cascade,

  -- One of the contract's attachment names: screenshot, video, network_logs,
  -- console_logs, breadcrumbs, metadata.
  name         text not null,
  storage_path text not null,
  content_type text not null,
  size_bytes   bigint not null,
  created_at   timestamptz not null default now(),

  constraint report_attachments_unique_per_report unique (report_id, name)
);

create index if not exists report_attachments_report_idx
  on public.report_attachments (report_id);

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

-- Private bucket. Attachments routinely contain screenshots of a customer's
-- production UI, so they are never world-readable; the inbox serves them
-- through signed URLs with a short expiry.
insert into storage.buckets (id, name, public)
values ('report-attachments', 'report-attachments', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
--
-- Ingest runs with the service role and bypasses RLS entirely. These policies
-- govern the dashboard, where a signed-in user must only ever see their own
-- projects' reports.

alter table public.projects           enable row level security;
alter table public.reports            enable row level security;
alter table public.report_attachments enable row level security;

create policy "Owners read their projects"
  on public.projects for select
  using (owner_id = auth.uid());

create policy "Owners manage their projects"
  on public.projects for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners read reports in their projects"
  on public.reports for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = reports.project_id and p.owner_id = auth.uid()
    )
  );

create policy "Owners triage reports in their projects"
  on public.reports for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = reports.project_id and p.owner_id = auth.uid()
    )
  );

create policy "Owners read attachments in their projects"
  on public.report_attachments for select
  using (
    exists (
      select 1
      from public.reports r
      join public.projects p on p.id = r.project_id
      where r.id = report_attachments.report_id and p.owner_id = auth.uid()
    )
  );

create policy "Owners read their attachment objects"
  on storage.objects for select
  using (
    bucket_id = 'report-attachments'
    and exists (
      select 1
      from public.report_attachments a
      join public.reports r  on r.id = a.report_id
      join public.projects p on p.id = r.project_id
      where a.storage_path = storage.objects.name and p.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------

-- Deletes reports past their project's retention window. Attachments follow via
-- cascade; the storage objects are removed by the companion cleanup job, since
-- Postgres cannot delete from the object store transactionally.
create or replace function public.delete_expired_reports()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  with expired as (
    delete from public.reports r
    using public.projects p
    where p.id = r.project_id
      and r.created_at < now() - (p.retention_days || ' days')::interval
    returning r.id
  )
  select count(*) into deleted_count from expired;

  return deleted_count;
end;
$$;

comment on function public.delete_expired_reports is
  'Deletes reports past their project retention window. Schedule via pg_cron.';
