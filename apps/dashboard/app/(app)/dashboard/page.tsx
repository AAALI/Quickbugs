import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app/app-header";
import { IntegrationCard } from "./integration-card";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
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

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, project_key, platform, is_active, created_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!project) redirect("/onboarding");

  const [{ data: reports }, { data: integration }] = await Promise.all([
    supabase
      .from("report_events")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("integrations")
      .select("id, provider, config, created_at")
      .eq("project_id", project.id)
      .limit(1)
      .single(),
  ]);

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <AppHeader
        orgName={org.name}
        plan={org.plan}
        email={user.email ?? ""}
        userName={user.user_metadata?.full_name}
      />

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Integration status */}
        <IntegrationCard
          projectId={project.id}
          projectKey={project.project_key}
          integration={
            integration
              ? {
                  id: integration.id,
                  provider: integration.provider,
                  config: integration.config as Record<string, string> | null,
                  created_at: integration.created_at,
                }
              : null
          }
        />

        {/* Everything below is client-side (report modal, overview, list) */}
        <DashboardClient reports={reports ?? []} />
      </main>
    </div>
  );
}
