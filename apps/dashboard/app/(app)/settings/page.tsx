import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app/app-header";
import { SettingsShell } from "./settings-shell";
import { ProfileSection } from "./sections/profile-section";
import { OrgSection } from "./sections/org-section";
import { ProjectSection } from "./sections/project-section";
import { IntegrationsSection } from "./sections/integrations-section";
import { DangerSection } from "./sections/danger-section";

export default async function SettingsPage() {
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

  // Fetch projects first (needed for integration filter)
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, project_key, is_active, rate_limit_per_min, created_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  // Fetch integrations using project IDs (no extra sub-query)
  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: integrations } = projectIds.length > 0
    ? await supabase
        .from("integrations")
        .select("id, project_id, provider, config, created_at")
        .in("project_id", projectIds)
    : { data: [] as never[] };

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <AppHeader
        orgName={org.name}
        plan={org.plan}
        email={user.email ?? ""}
        userName={user.user_metadata?.full_name}
      />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your account, organization, and project settings.
        </p>

        <SettingsShell>
          <ProfileSection
            email={user.email ?? ""}
            name={user.user_metadata?.full_name ?? ""}
          />
          <OrgSection
            orgId={org.id}
            orgName={org.name}
            orgSlug={org.slug}
            plan={org.plan}
            role={membership.role}
          />
          <ProjectSection projects={projects ?? []} />
          <IntegrationsSection
            projects={projects ?? []}
            integrations={integrations ?? []}
          />
          <DangerSection orgId={org.id} role={membership.role} />
        </SettingsShell>
      </main>
    </div>
  );
}
