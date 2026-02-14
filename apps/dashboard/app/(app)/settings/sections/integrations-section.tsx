"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  IconCheck,
  IconPlug,
  IconRefresh,
  IconTrash,
  IconLayoutKanban,
  IconSubtask,
} from "@tabler/icons-react";

type Project = {
  id: string;
  name: string;
  project_key: string;
  is_active: boolean;
  rate_limit_per_min: number;
  created_at: string;
};

type Integration = {
  id: string;
  project_id: string;
  provider: string;
  config: Record<string, string> | null;
  created_at: string;
};

type IntegrationsSectionProps = {
  projects: Project[];
  integrations: Integration[];
};

const providerMeta: Record<string, { label: string; icon: typeof IconPlug }> = {
  linear: { label: "Linear", icon: IconLayoutKanban },
  jira: { label: "Jira", icon: IconSubtask },
};

export function IntegrationsSection({
  projects,
  integrations: initialIntegrations,
}: IntegrationsSectionProps) {
  const [integrations, setIntegrations] = useState(initialIntegrations);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage your bug tracker connections. Reports are forwarded to connected
          trackers automatically.
        </p>
      </div>

      {projects.map((project) => {
        const projectIntegrations = integrations.filter(
          (i) => i.project_id === project.id
        );

        return (
          <div key={project.id} className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">
              {project.name}
              <span className="ml-2 font-mono text-xs text-slate-400">
                {project.project_key}
              </span>
            </h3>

            {projectIntegrations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <IconPlug className="mx-auto size-6 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">
                  No integrations connected
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Connect a tracker from the onboarding flow or add one below.
                </p>
                <AddIntegrationForm
                  projectId={project.id}
                  existingProviders={[]}
                  onAdded={(newIntegration) =>
                    setIntegrations((prev) => [...prev, newIntegration])
                  }
                />
              </div>
            ) : (
              <div className="space-y-3">
                {projectIntegrations.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    onRemoved={(id) =>
                      setIntegrations((prev) => prev.filter((i) => i.id !== id))
                    }
                  />
                ))}
                <AddIntegrationForm
                  projectId={project.id}
                  existingProviders={projectIntegrations.map((i) => i.provider)}
                  onAdded={(newIntegration) =>
                    setIntegrations((prev) => [...prev, newIntegration])
                  }
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function IntegrationCard({
  integration,
  onRemoved,
}: {
  integration: Integration;
  onRemoved: (id: string) => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [rotating, setRotating] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [showRotate, setShowRotate] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = providerMeta[integration.provider] ?? {
    label: integration.provider,
    icon: IconPlug,
  };
  const Icon = meta.icon;

  async function handleRotateKey() {
    if (!newToken.trim()) return;
    setRotating(true);
    setError(null);

    // Create new secret in Vault
    const { data: vaultId, error: vaultError } = await supabase.rpc(
      "create_secret",
      {
        secret_value: newToken.trim(),
        secret_name: `${integration.provider}-${integration.project_id}-${Date.now()}`,
      }
    );

    if (vaultError || !vaultId) {
      setError(vaultError?.message ?? "Failed to store new key.");
      setRotating(false);
      return;
    }

    // Update integration to point to new secret
    const { error: updateError } = await supabase
      .from("integrations")
      .update({ vault_secret_id: vaultId })
      .eq("id", integration.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSaved(true);
      setShowRotate(false);
      setNewToken("");
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
    setRotating(false);
  }

  async function handleRemove() {
    if (!confirm(`Remove ${meta.label} integration? This cannot be undone.`)) return;
    setRemoving(true);

    // Get vault_secret_id before deleting the integration
    const { data: intRow } = await supabase
      .from("integrations")
      .select("vault_secret_id")
      .eq("id", integration.id)
      .single();

    const { error: deleteError } = await supabase
      .from("integrations")
      .delete()
      .eq("id", integration.id);

    if (deleteError) {
      setError(deleteError.message);
      setRemoving(false);
    } else {
      // Clean up vault secret
      if (intRow?.vault_secret_id) {
        try { await supabase.rpc("delete_secret", { secret_id: intRow.vault_secret_id }); } catch { /* ignore */ }
      }
      onRemoved(integration.id);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
            <Icon className="size-5 text-slate-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
            <p className="text-xs text-slate-400">
              Connected {new Date(integration.created_at).toLocaleDateString()}
              {integration.config?.team_id && (
                <> · Team: {integration.config.team_id}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <IconCheck className="size-3" /> Updated
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRotate(!showRotate)}
          >
            <IconRefresh className="size-3.5" />
            Rotate key
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemove}
            disabled={removing}
            className="text-red-500 hover:text-red-600 hover:border-red-300"
          >
            <IconTrash className="size-3.5" />
          </Button>
        </div>
      </div>

      {showRotate && (
        <div className="mt-4 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <Label className="text-sm font-medium text-slate-700">
            New API key
          </Label>
          <Input
            type="text"
            autoComplete="off"
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
            placeholder={`Paste new ${meta.label} API key`}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleRotateKey}
              disabled={rotating || !newToken.trim()}
            >
              {rotating ? "Saving…" : "Save new key"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowRotate(false);
                setNewToken("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddIntegrationForm({
  projectId,
  existingProviders,
  onAdded,
}: {
  projectId: string;
  existingProviders: string[];
  onAdded: (integration: Integration) => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<string>("");
  const [apiToken, setApiToken] = useState("");
  const [teamId, setTeamId] = useState("");
  const [email, setEmail] = useState("");
  const [jiraProjectKey, setJiraProjectKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableProviders = ["linear", "jira"].filter(
    (p) => !existingProviders.includes(p)
  );

  if (availableProviders.length === 0 && !open) return null;

  async function handleAdd() {
    if (!provider || !apiToken.trim()) return;
    setSaving(true);
    setError(null);

    // Step 1: Validate credentials BEFORE saving
    try {
      const validateRes = await fetch("/api/validate-integration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiToken: apiToken.trim(),
          email: email.trim() || undefined,
          siteUrl: teamId.trim() || undefined,
          projectKey: jiraProjectKey.trim() || undefined,
          teamId: teamId.trim() || undefined,
        }),
      });
      const validateBody = await validateRes.json();
      if (!validateBody.valid) {
        setError(validateBody.error || "Credential validation failed.");
        setSaving(false);
        return;
      }
    } catch {
      setError("Could not validate credentials. Is the server running?");
      setSaving(false);
      return;
    }

    // Step 2: Store in Vault (credentials are verified)
    const { data: vaultId, error: vaultError } = await supabase.rpc(
      "create_secret",
      {
        secret_value: apiToken.trim(),
        secret_name: `${provider}-${projectId}-${Date.now()}`,
      }
    );

    if (vaultError || !vaultId) {
      setError(vaultError?.message ?? "Failed to store credentials.");
      setSaving(false);
      return;
    }

    const config: Record<string, string> = {};
    if (teamId.trim()) config.team_id = teamId.trim();
    if (email.trim()) config.email = email.trim();
    if (jiraProjectKey.trim()) config.project_key = jiraProjectKey.trim();

    const { data, error: insertError } = await supabase
      .from("integrations")
      .insert({
        project_id: projectId,
        provider,
        vault_secret_id: vaultId,
        config,
      })
      .select("id, project_id, provider, config, created_at")
      .single();

    if (insertError) {
      setError(insertError.message);
    } else if (data) {
      onAdded(data as Integration);
      setOpen(false);
      setProvider("");
      setApiToken("");
      setTeamId("");
      setEmail("");
      setJiraProjectKey("");
      router.refresh();
    }
    setSaving(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-sm font-medium text-teal-600 hover:text-teal-700"
      >
        + Add integration
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Provider</Label>
        <div className="flex gap-2">
          {availableProviders.map((p) => {
            const meta = providerMeta[p];
            const Icon = meta?.icon ?? IconPlug;
            return (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  provider === p
                    ? "border-teal-300 bg-teal-50 text-teal-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <Icon className="size-4" />
                {meta?.label ?? p}
              </button>
            );
          })}
        </div>
      </div>

      {provider && (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">API key</Label>
            <Input
              type="text"
              autoComplete="off"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder={`${providerMeta[provider]?.label ?? provider} API key`}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              {provider === "jira" ? "Jira site URL" : "Team ID"}{" "}
              <span className="text-slate-400">(optional)</span>
            </Label>
            <Input
              type="text"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder={
                provider === "jira" ? "yoursite.atlassian.net" : "Team ID"
              }
            />
          </div>

          {provider === "jira" && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Jira email
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Jira project key
                </Label>
                <Input
                  type="text"
                  value={jiraProjectKey}
                  onChange={(e) => setJiraProjectKey(e.target.value)}
                  placeholder="e.g. KAN, HAY, PROJ"
                />
                <p className="text-xs text-slate-400">
                  The prefix shown on your Jira issues (e.g. KAN-35).
                </p>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={saving || !apiToken.trim()}
            >
              {saving ? "Connecting…" : "Connect"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                setProvider("");
                setApiToken("");
                setTeamId("");
                setEmail("");
                setJiraProjectKey("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
