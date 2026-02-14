"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type Report = {
  id: string;
  browser_name: string | null;
  os_name: string | null;
  device_type: string | null;
  page_url: string | null;
  capture_mode: string;
  created_at: string;
};

type Props = { reports: Report[] };

const COLORS = ["#14B8A6", "#22D3EE", "#6366F1", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

function countBy(arr: Report[], keyFn: (r: Report) => string | null) {
  const m: Record<string, number> = {};
  for (const r of arr) {
    const k = keyFn(r) || "Unknown";
    m[k] = (m[k] || 0) + 1;
  }
  return Object.entries(m)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function DashboardAnalytics({ reports }: Props) {
  const daily = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of reports) {
      const d = new Date(r.created_at);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      m[key] = (m[key] || 0) + 1;
    }
    return Object.entries(m)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [reports]);

  const browsers = useMemo(() => countBy(reports, (r) => r.browser_name), [reports]);
  const devices = useMemo(() => countBy(reports, (r) => r.device_type), [reports]);
  const pages = useMemo(() => countBy(reports, (r) => r.page_url), [reports]);

  return (
    <div className="space-y-6">
      {/* Reports over time */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Reports over time</h3>
        <ResponsiveContainer width="100%" height={220}>
          {daily.length > 1 ? (
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }} />
              <Line type="monotone" dataKey="count" stroke="#14B8A6" strokeWidth={2} dot={{ r: 4, fill: "#14B8A6" }} />
            </LineChart>
          ) : (
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }} />
              <Bar dataKey="count" fill="#14B8A6" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Browser + Device row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Browser breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={browsers} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" width={80} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {browsers.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Device types</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={devices} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                  {devices.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-3">
            {devices.map((d, i) => (
              <span key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="size-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Top pages */}
      {pages.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Top pages</h3>
          <div className="space-y-1.5">
            {pages.slice(0, 8).map((p, i) => (
              <div key={p.name} className="flex items-center justify-between rounded-lg px-3 py-2 odd:bg-slate-50/50">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium text-slate-400 w-5">{i + 1}.</span>
                  <span className="truncate text-sm text-slate-700">{p.name}</span>
                </div>
                <span className="ml-3 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
