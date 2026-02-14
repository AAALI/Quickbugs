"use client";

import { useState } from "react";
import { IconPlug, IconArrowRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SupabaseClient } from "@supabase/supabase-js";

const providers = [
  { value: "linear", label: "Linear" },
  { value: "jira", label: "Jira" },
];

export function StepConnectTracker({
  supabase,
  projectId,
  onComplete,
}: {
  supabase: SupabaseClient;
  projectId: string;
  onComplete: () => void;
}) {
  const [provider, setProvider] = useState<"linear" | "jira">("linear");
  const [apiToken, setApiToken] = useState("");
  const [teamId, setTeamId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiToken.trim()) return;

    setLoading(true);
    setError(null);

    // Store API token in Supabase Vault (encrypted at rest)
    const { data: vaultId, error: vaultError } = await supabase.rpc(
      "create_secret",
      {
        secret_value: apiToken.trim(),
        secret_name: `${provider}-${projectId}-${Date.now()}`,
      },
    );

    if (vaultError || !vaultId) {
      setError(vaultError?.message ?? "Failed to store credentials securely.");
      setLoading(false);
      return;
    }

    const { error: integrationError } = await supabase
      .from("integrations")
      .insert({
        project_id: projectId,
        provider,
        vault_secret_id: vaultId,
        config: {
          team_id: teamId.trim() || undefined,
        },
      });

    if (integrationError) {
      if (integrationError.message.includes("unique")) {
        setError(`${provider} integration already exists for this project.`);
      } else {
        setError(integrationError.message);
      }
      setLoading(false);
      return;
    }

    onComplete();
  }

  return (
    <div>
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <IconPlug className="size-7" />
      </div>
      <h2 className="mt-5 text-2xl font-bold text-slate-900">
        Connect your issue tracker
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        QuickBugs forwards bug reports directly to Jira or Linear.
        Credentials are encrypted at rest.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" autoComplete="off">
        <div className="space-y-2">
          <Label className="text-slate-700">Provider</Label>
          <div className="grid grid-cols-2 gap-3">
            {providers.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setProvider(p.value as "linear" | "jira")}
                className={`flex h-12 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                  provider === p.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="api-token" className="text-slate-700">
            {provider === "linear" ? "Linear API key" : "Jira API token"}
          </Label>
          <Input
            id="api-token"
            type="text"
            autoComplete="new-password"
            placeholder={
              provider === "linear" ? "lin_api_..." : "ATATT3x..."
            }
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            required
            className="h-12 rounded-lg border-slate-200 bg-white font-mono text-sm"
          />
          <p className="text-xs text-slate-400">
            {provider === "linear"
              ? "Settings → API → Personal API keys"
              : "id.atlassian.com → Security → API tokens"}
          </p>
        </div>

        {provider === "jira" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="team-id" className="text-slate-700">
                Jira site URL
              </Label>
              <Input
                id="team-id"
                placeholder="yourcompany.atlassian.net"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="h-12 rounded-lg border-slate-200 bg-white"
              />
            </div>
          </>
        )}

        {provider === "linear" && (
          <div className="space-y-2">
            <Label htmlFor="team-id" className="text-slate-700">
              Team ID (optional)
            </Label>
            <Input
              id="team-id"
              placeholder="e.g. ENG"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="h-12 rounded-lg border-slate-200 bg-white"
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          type="submit"
          disabled={loading || !apiToken.trim()}
          className="h-12 w-full rounded-lg bg-primary text-base text-white hover:bg-primary/90"
        >
          {loading ? "Connecting..." : `Connect ${provider === "linear" ? "Linear" : "Jira"}`}
        </Button>
      </form>

      <button
        type="button"
        onClick={onComplete}
        className="mt-4 flex w-full items-center justify-center gap-1 text-sm text-slate-400 transition-colors hover:text-slate-600"
      >
        Skip for now
        <IconArrowRight className="size-3.5" />
      </button>
    </div>
  );
}
