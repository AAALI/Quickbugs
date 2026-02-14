import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { AppHeader } from "@/components/app/app-header";
import { ProjectReports } from "./project-reports";
import { ProjectAnalytics } from "./project-analytics";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function ProjectDetailPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const { tab } = await searchParams;
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

  // Fetch project + reports in parallel
  const [{ data: project }, { data: reports }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, project_key, platform, is_active, rate_limit_per_min, created_at, org_id")
      .eq("id", projectId)
      .eq("org_id", org.id)
      .single(),
    supabase
      .from("report_events")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (!project) notFound();

  const activeTab = tab === "analytics" ? "analytics" : "reports";

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <AppHeader
        orgName={org.name}
        plan={org.plan}
        email={user.email ?? ""}
        userName={user.user_metadata?.full_name}
      />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Breadcrumb + title */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <a href="/dashboard" className="hover:text-slate-700">
            Dashboard
          </a>
          <span>/</span>
          <span className="font-medium text-slate-900">{project.name}</span>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <p className="mt-1 font-mono text-sm text-slate-400">
              {project.project_key}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {project.platform}
            </span>
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                project.is_active
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  project.is_active ? "bg-emerald-500" : "bg-slate-400"
                }`}
              />
              {project.is_active ? "Active" : "Paused"}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 border-b border-slate-200">
          <a
            href={`/dashboard/${projectId}?tab=reports`}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "reports"
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Reports
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
              {reports?.length ?? 0}
            </span>
          </a>
          <a
            href={`/dashboard/${projectId}?tab=analytics`}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "analytics"
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Analytics
          </a>
        </div>

        {/* Content */}
        <div className="mt-6">
          {activeTab === "reports" ? (
            <ProjectReports
              reports={reports ?? []}
              projectId={projectId}
            />
          ) : (
            <ProjectAnalytics reports={reports ?? []} />
          )}
        </div>
      </main>
    </div>
  );
}
