"use client";

import { useState } from "react";
import {
  IconBug,
  IconBrowser,
  IconDeviceDesktop,
  IconCircleCheck,
  IconAlertCircle,
  IconExternalLink,
  IconX,
  IconPhoto,
  IconVideo,
  IconTerminal,
  IconWifi,
} from "@tabler/icons-react";

type Report = {
  id: string;
  title: string;
  provider: string;
  capture_mode: string;
  status: string;
  has_screenshot: boolean;
  has_video: boolean;
  has_console_logs: boolean;
  has_network_logs: boolean;
  js_error_count: number;
  browser_name: string | null;
  browser_version: string | null;
  os_name: string | null;
  os_version: string | null;
  device_type: string | null;
  page_url: string | null;
  screen_resolution: string | null;
  viewport: string | null;
  color_scheme: string | null;
  locale: string | null;
  timezone: string | null;
  connection_type: string | null;
  environment: string | null;
  app_version: string | null;
  external_issue_id: string | null;
  external_issue_key: string | null;
  external_issue_url: string | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
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

function countValues(reports: Report[], key: keyof Report): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of reports) {
    const v = (r[key] as string | null) || "Unknown";
    m[v] = (m[v] || 0) + 1;
  }
  return m;
}

export function DashboardClient({ reports }: { reports: Report[] }) {
  const [selected, setSelected] = useState<Report | null>(null);

  const successCount = reports.filter((r) => r.status === "success").length;
  const failCount = reports.length - successCount;
  const browsers = countValues(reports, "browser_name");
  const devices = countValues(reports, "device_type");
  const oses = countValues(reports, "os_name");

  return (
    <>
      {/* Overview */}
      {reports.length > 0 && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700">Overview</h2>
          <div className="mt-3 flex flex-wrap gap-6">
            {/* Reports count */}
            <div>
              <p className="text-xs text-slate-400">Reports</p>
              <p className="text-xl font-bold text-slate-900">{reports.length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Forwarded</p>
              <p className="text-xl font-bold text-emerald-600">{successCount}</p>
            </div>
            {failCount > 0 && (
              <div>
                <p className="text-xs text-slate-400">Failed</p>
                <p className="text-xl font-bold text-red-600">{failCount}</p>
              </div>
            )}

            {/* Divider */}
            <div className="hidden sm:block w-px bg-slate-200" />

            {/* Browsers */}
            <div className="min-w-0">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <IconBrowser className="size-3" /> Browsers
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {Object.entries(browsers)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => (
                    <span
                      key={name}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                    >
                      {name} {count}
                    </span>
                  ))}
              </div>
            </div>

            <div className="hidden sm:block w-px bg-slate-200" />

            {/* Devices */}
            <div className="min-w-0">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <IconDeviceDesktop className="size-3" /> Devices
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {Object.entries(devices)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => (
                    <span
                      key={name}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                    >
                      {name} {count}
                    </span>
                  ))}
              </div>
            </div>

            <div className="hidden sm:block w-px bg-slate-200" />

            {/* OS */}
            <div className="min-w-0">
              <p className="text-xs text-slate-400">OS</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {Object.entries(oses)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => (
                    <span
                      key={name}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                    >
                      {name} {count}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reports list */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-700">
          Reports
          {reports.length > 0 && (
            <span className="ml-1.5 text-slate-400 font-normal">({reports.length})</span>
          )}
        </h2>

        {reports.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <IconBug className="mx-auto size-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">No reports yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Add the SDK to your app and submit a test report.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {r.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    <span>{r.browser_name ?? "Unknown"}</span>
                    <span>·</span>
                    <span>{r.os_name ?? "Unknown"}</span>
                    <span>·</span>
                    <span>{formatDate(r.created_at)}</span>
                  </div>
                </div>
                <div className="ml-4 flex items-center gap-2 shrink-0">
                  {r.external_issue_key && (
                    <span className="rounded bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">
                      {r.external_issue_key}
                    </span>
                  )}
                  <span
                    className={`size-2 rounded-full ${
                      r.status === "success" ? "bg-emerald-400" : "bg-red-400"
                    }`}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Report detail modal */}
      {selected && (
        <ReportModal report={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function ReportModal({
  report,
  onClose,
}: {
  report: Report;
  onClose: () => void;
}) {
  const isSuccess = report.status === "success";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-4 rounded-t-2xl">
          <div className="min-w-0 pr-4">
            <h2 className="text-base font-semibold text-slate-900">
              {report.title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {formatDate(report.created_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <IconX className="size-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Status + tracker link */}
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
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

            {report.external_issue_url && (
              <a
                href={report.external_issue_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100"
              >
                {report.external_issue_key ?? "View issue"}
                <IconExternalLink className="size-3" />
              </a>
            )}
          </div>

          {report.error_message && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-xs text-red-700">
              {report.error_message}
            </div>
          )}

          {/* Attachments */}
          <div className="flex flex-wrap gap-1.5">
            <Badge icon={<IconPhoto className="size-3" />} label="Screenshot" active={report.has_screenshot} />
            <Badge icon={<IconVideo className="size-3" />} label="Video" active={report.has_video} />
            <Badge icon={<IconTerminal className="size-3" />} label="Console" active={report.has_console_logs} />
            <Badge icon={<IconWifi className="size-3" />} label="Network" active={report.has_network_logs} />
            {report.js_error_count > 0 && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                {report.js_error_count} JS errors
              </span>
            )}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg bg-slate-50 px-4 py-4">
            <Field label="Browser" value={join(report.browser_name, report.browser_version)} />
            <Field label="OS" value={join(report.os_name, report.os_version)} />
            <Field label="Device" value={report.device_type} />
            <Field label="Capture mode" value={report.capture_mode} />
            <Field label="Screen" value={report.screen_resolution} />
            <Field label="Viewport" value={report.viewport} />
            <Field label="Color scheme" value={report.color_scheme} />
            <Field label="Locale" value={report.locale} />
            <Field label="Timezone" value={report.timezone} />
            <Field label="Connection" value={report.connection_type} />
            <Field label="Environment" value={report.environment} />
            <Field label="App version" value={report.app_version} />
          </div>

          {/* Page URL */}
          {report.page_url && (
            <div>
              <p className="text-[11px] font-medium uppercase text-slate-400">Page URL</p>
              <p className="mt-0.5 break-all text-xs text-slate-600">{report.page_url}</p>
            </div>
          )}

          {report.duration_ms != null && (
            <p className="text-xs text-slate-400">
              Processed in {report.duration_ms}ms
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase text-slate-400">{label}</p>
      <p className="text-sm text-slate-700">{value || "—"}</p>
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
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        active ? "bg-teal-50 text-teal-700" : "bg-slate-50 text-slate-400 line-through"
      }`}
    >
      {icon}
      {label}
    </span>
  );
}

function join(a: string | null, b: string | null): string | null {
  if (!a) return null;
  return b ? `${a} ${b}` : a;
}
