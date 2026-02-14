"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  IconSearch,
  IconFilter,
  IconExternalLink,
  IconChevronRight,
} from "@tabler/icons-react";

type Report = {
  id: string;
  title: string;
  provider: string;
  capture_mode: string;
  status: string;
  browser_name: string | null;
  os_name: string | null;
  device_type: string | null;
  page_url: string | null;
  external_issue_url: string | null;
  external_issue_key: string | null;
  created_at: string;
  project_id: string;
};

type ProjectReportsProps = {
  reports: Report[];
  projectId: string;
};

const statusColors: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-700",
  error: "bg-red-50 text-red-700",
  pending: "bg-amber-50 text-amber-700",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const mins = String(d.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${mins} UTC`;
}

export function ProjectReports({ reports, projectId }: ProjectReportsProps) {
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [browserFilter, setBrowserFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Extract unique values for filters
  const providers = useMemo(
    () => [...new Set(reports.map((r) => r.provider))].sort(),
    [reports]
  );
  const browsers = useMemo(
    () =>
      [...new Set(reports.map((r) => r.browser_name).filter(Boolean))].sort() as string[],
    [reports]
  );
  const statuses = useMemo(
    () => [...new Set(reports.map((r) => r.status))].sort(),
    [reports]
  );

  // Filter reports
  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (providerFilter !== "all" && r.provider !== providerFilter) return false;
      if (browserFilter !== "all" && r.browser_name !== browserFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [reports, search, providerFilter, browserFilter, statusFilter]);

  const hasFilters =
    providerFilter !== "all" || browserFilter !== "all" || statusFilter !== "all";

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports…"
            className="pl-9"
          />
        </div>

        <FilterSelect
          label="Provider"
          value={providerFilter}
          onChange={setProviderFilter}
          options={providers}
        />
        <FilterSelect
          label="Browser"
          value={browserFilter}
          onChange={setBrowserFilter}
          options={browsers}
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={statuses}
        />

        {hasFilters && (
          <button
            onClick={() => {
              setProviderFilter("all");
              setBrowserFilter("all");
              setStatusFilter("all");
            }}
            className="text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-xs text-slate-400">
        {filtered.length} of {reports.length} reports
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <IconFilter className="mx-auto size-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">No matching reports</p>
          <p className="mt-1 text-xs text-slate-400">
            Try adjusting your filters or search query.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Title
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Provider
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Browser
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Issue
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Time
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((report) => (
                <tr
                  key={report.id}
                  className="group border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/50"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/${projectId}/${report.id}`}
                      className="font-medium text-slate-900 hover:text-primary"
                    >
                      {report.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{report.provider}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {report.browser_name ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        statusColors[report.status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {report.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {report.external_issue_url ? (
                      <a
                        href={report.external_issue_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {report.external_issue_key ?? "View"}
                        <IconExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-400 whitespace-nowrap">
                    {formatDate(report.created_at)}
                  </td>
                  <td className="pr-3">
                    <Link href={`/dashboard/${projectId}/${report.id}`}>
                      <IconChevronRight className="size-4 text-slate-300 group-hover:text-slate-500" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  if (options.length <= 1) return null;

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-slate-400"
    >
      <option value="all">{label}: All</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
