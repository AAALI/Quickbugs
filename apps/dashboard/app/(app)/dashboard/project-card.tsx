"use client";

import { useState } from "react";
import Link from "next/link";
import { IconFolder, IconCopy, IconCheck, IconChevronRight } from "@tabler/icons-react";

export function ProjectCard({
  project,
}: {
  project: {
    id: string;
    name: string;
    project_key: string;
    platform: string;
    is_active: boolean;
  };
}) {
  const [copied, setCopied] = useState(false);

  async function copyKey() {
    await navigator.clipboard.writeText(project.project_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Link
      href={`/dashboard/${project.id}`}
      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 transition-colors hover:border-slate-300 hover:bg-slate-50/50"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <IconFolder className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {project.name}
          </p>
          <div className="flex items-center gap-1.5">
            <p className="font-mono text-xs text-slate-400">
              {project.project_key}
            </p>
            <button
              type="button"
              onClick={copyKey}
              className="text-slate-300 transition-colors hover:text-slate-500"
              title="Copy project key"
            >
              {copied ? (
                <IconCheck className="size-3 text-primary" />
              ) : (
                <IconCopy className="size-3" />
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
          {project.platform}
        </span>
        <span
          className={`size-2 rounded-full ${
            project.is_active ? "bg-emerald-400" : "bg-slate-300"
          }`}
        />
        <IconChevronRight className="size-4 text-slate-300" />
      </div>
    </Link>
  );
}
