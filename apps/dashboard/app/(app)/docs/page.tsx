import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app/app-header";
import { DocsContent } from "./docs-content";

export default async function DocsPage() {
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
    .select("project_key")
    .eq("org_id", org.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <AppHeader
        orgName={org.name}
        plan={org.plan}
        email={user.email ?? ""}
        userName={user.user_metadata?.full_name}
      />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <DocsContent projectKey={project?.project_key ?? "your_project_key"} />
      </main>
    </div>
  );
}
