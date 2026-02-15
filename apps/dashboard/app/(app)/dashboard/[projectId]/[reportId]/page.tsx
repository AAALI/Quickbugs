import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app/app-header";
import {
  IconExternalLink,
  IconBrowser,
  IconDeviceDesktop,
  IconWorld,
  IconPhoto,
  IconVideo,
  IconTerminal,
  IconWifi,
  IconClock,
  IconAlertCircle,
  IconCircleCheck,
  IconArrowLeft,
} from "@tabler/icons-react";

type Props = {
  params: Promise<{ projectId: string; reportId: string }>;
};

export default async function ReportDetailPage({ params }: Props) {
  const { projectId, reportId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("members")
    .select("org_id, role, organizations(id, name, slug, plan)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) redirect("/onboarding");

  const org = membership.organizations as unknown as {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };

  // Fetch project + report in parallel
  const [{ data: project }, { data: report }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, project_key, org_id")
      .eq("id", projectId)
      .eq("org_id", org.id)
      .single(),
    supabase
      .from("report_events")
      .select("*")
      .eq("id", reportId)
      .eq("project_id", projectId)
      .single(),
  ]);

  if (!project || !report) notFound();

  const isSuccess = report.status === "success";

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <AppHeader
        orgName={org.name}
        plan={org.plan}
        email={user.email ?? ""}
        userName={user.user_metadata?.full_name}
      />

      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Back link */}
        <Link
          href={`/dashboard/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <IconArrowLeft className="size-4" />
          Back to {project.name}
        </Link>

        {/* Report header */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{report.title}</h1>
              <p className="mt-1 text-sm text-slate-500">
                Reported {new Date(report.created_at).toLocaleString()}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                isSuccess
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {isSuccess ? (
                <IconCircleCheck className="size-3.5" />
              ) : (
                <IconAlertCircle className="size-3.5" />
              )}
              {report.status}
            </span>
          </div>

          {/* External issue link */}
          {report.external_issue_url && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-teal-100 bg-teal-50 px-4 py-3">
              <IconExternalLink className="size-4 text-teal-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-teal-800">
                  {report.external_issue_key
                    ? `Issue ${report.external_issue_key}`
                    : "External Issue"}
                </p>
                <a
                  href={report.external_issue_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-xs text-teal-600 hover:underline"
                >
                  {report.external_issue_url}
                </a>
              </div>
              <a
                href={report.external_issue_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
              >
                Open in {report.provider === "jira" ? "Jira" : report.provider === "linear" ? "Linear" : report.provider}
              </a>
            </div>
          )}

          {report.error_message && (
            <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="mt-1 text-xs text-red-600">{report.error_message}</p>
            </div>
          )}
        </div>

        {/* Metadata grid */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Report info */}
          <Section title="Report Info">
            <Field label="Provider" value={report.provider} />
            <Field label="Capture mode" value={report.capture_mode} />
            <Field label="Duration" value={report.duration_ms ? `${report.duration_ms}ms` : "—"} />
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge
                icon={<IconPhoto className="size-3" />}
                label="Screenshot"
                active={report.has_screenshot}
              />
              <Badge
                icon={<IconVideo className="size-3" />}
                label="Video"
                active={report.has_video}
              />
              <Badge
                icon={<IconTerminal className="size-3" />}
                label="Console logs"
                active={report.has_console_logs}
              />
              <Badge
                icon={<IconWifi className="size-3" />}
                label="Network logs"
                active={report.has_network_logs}
              />
            </div>
            {report.js_error_count > 0 && (
              <Field
                label="JS errors captured"
                value={String(report.js_error_count)}
              />
            )}
          </Section>

          {/* Client environment */}
          <Section title="Client Environment">
            <Field
              icon={<IconBrowser className="size-3.5 text-slate-400" />}
              label="Browser"
              value={
                report.browser_name
                  ? `${report.browser_name}${report.browser_version ? ` ${report.browser_version}` : ""}`
                  : "—"
              }
            />
            <Field
              icon={<IconDeviceDesktop className="size-3.5 text-slate-400" />}
              label="OS"
              value={
                report.os_name
                  ? `${report.os_name}${report.os_version ? ` ${report.os_version}` : ""}`
                  : "—"
              }
            />
            <Field label="Device type" value={report.device_type ?? "—"} />
            <Field label="Platform" value={report.platform ?? "—"} />
            <Field
              label="Device model"
              value={
                report.device_model
                  ? `${report.device_brand ? `${report.device_brand} ` : ""}${report.device_model}`
                  : "—"
              }
            />
            <Field label="Screen resolution" value={report.screen_resolution ?? "—"} />
            <Field label="Viewport" value={report.viewport ?? "—"} />
            <Field label="Color scheme" value={report.color_scheme ?? "—"} />
            <Field
              label="Emulator"
              value={
                report.is_emulator == null ? "—" : report.is_emulator ? "Yes" : "No"
              }
            />
          </Section>

          {/* Location & network */}
          <Section title="Location & Network">
            <Field
              icon={<IconWorld className="size-3.5 text-slate-400" />}
              label="Page URL"
              value={report.page_url ?? "—"}
              truncate
            />
            <Field label="Locale" value={report.locale ?? "—"} />
            <Field label="Timezone" value={report.timezone ?? "—"} />
            <Field label="Connection" value={report.connection_type ?? "—"} />
          </Section>

          {/* App context */}
          <Section title="App Context">
            <Field label="App version" value={report.app_version ?? "—"} />
            <Field label="Build number" value={report.app_build_number ?? "—"} />
            <Field label="Environment" value={report.environment ?? "—"} />
            <Field label="Invocation" value={report.invocation_method ?? "—"} />
            <Field
              label="Battery level"
              value={
                typeof report.battery_level === "number"
                  ? `${Math.round(report.battery_level * 100)}%`
                  : "—"
              }
            />
            <Field
              label="Free storage"
              value={
                typeof report.free_storage_mb === "number"
                  ? `${report.free_storage_mb} MB`
                  : "—"
              }
            />
            <Field
              icon={<IconClock className="size-3.5 text-slate-400" />}
              label="Created"
              value={new Date(report.created_at).toLocaleString()}
            />
          </Section>
        </div>

        {/* Raw user agent */}
        {report.user_agent && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-700">User Agent</h3>
            <p className="mt-2 break-all font-mono text-xs text-slate-500">
              {report.user_agent}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  truncate,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="mt-0.5">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p
          className={`text-sm text-slate-700 ${truncate ? "truncate" : ""}`}
          title={truncate ? value : undefined}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function Badge({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        active
          ? "bg-teal-50 text-teal-700"
          : "bg-slate-50 text-slate-400 line-through"
      }`}
    >
      {icon}
      {label}
    </span>
  );
}
