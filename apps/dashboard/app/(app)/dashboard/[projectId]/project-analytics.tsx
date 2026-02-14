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
import {
  IconChartBar,
  IconBrowser,
  IconDeviceDesktop,
  IconLink,
  IconCircleCheck,
  IconTrendingUp,
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
  created_at: string;
};

type ProjectAnalyticsProps = {
  reports: Report[];
};

const CHART_COLORS = [
  "#14B8A6",
  "#22D3EE",
  "#6366F1",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#10B981",
];

function countBy<T>(arr: T[], keyFn: (item: T) => string | null): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of arr) {
    const key = keyFn(item) || "Unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function toChartData(counts: Record<string, number>) {
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function ProjectAnalytics({ reports }: ProjectAnalyticsProps) {
  // Bug count over time (group by day)
  const dailyData = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (const r of reports) {
      const day = new Date(r.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      byDay[day] = (byDay[day] || 0) + 1;
    }
    return Object.entries(byDay)
      .map(([date, count]) => ({ date, count }))
      .reverse();
  }, [reports]);

  // Browser breakdown
  const browserData = useMemo(
    () => toChartData(countBy(reports, (r) => r.browser_name)),
    [reports]
  );

  // OS breakdown
  const osData = useMemo(
    () => toChartData(countBy(reports, (r) => r.os_name)),
    [reports]
  );

  // Device type split
  const deviceData = useMemo(
    () => toChartData(countBy(reports, (r) => r.device_type)),
    [reports]
  );

  // Top pages
  const pageData = useMemo(
    () => toChartData(countBy(reports, (r) => r.page_url)),
    [reports]
  );

  // Capture mode breakdown
  const captureData = useMemo(
    () => toChartData(countBy(reports, (r) => r.capture_mode)),
    [reports]
  );

  // Success rate
  const successCount = reports.filter((r) => r.status === "success").length;
  const successRate = reports.length > 0 ? Math.round((successCount / reports.length) * 100) : 0;

  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <IconChartBar className="mx-auto size-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-500">No data yet</p>
        <p className="mt-1 text-xs text-slate-400">
          Analytics will appear here after reports are received.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top stats row */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          icon={<IconTrendingUp className="size-4 text-teal-500" />}
          label="Total Reports"
          value={reports.length}
        />
        <StatCard
          icon={<IconCircleCheck className="size-4 text-emerald-500" />}
          label="Success Rate"
          value={`${successRate}%`}
        />
        <StatCard
          icon={<IconBrowser className="size-4 text-cyan-500" />}
          label="Browsers"
          value={browserData.length}
        />
        <StatCard
          icon={<IconDeviceDesktop className="size-4 text-indigo-500" />}
          label="Devices"
          value={deviceData.length}
        />
      </div>

      {/* Bug count over time */}
      <ChartCard title="Reports over time">
        {dailyData.length > 1 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#14B8A6"
                strokeWidth={2}
                dot={{ r: 4, fill: "#14B8A6" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                }}
              />
              <Bar dataKey="count" fill="#14B8A6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Two-col row: Browser + OS */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Browser breakdown">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={browserData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12 }}
                stroke="#94a3b8"
                width={80}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {browserData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="OS breakdown">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={osData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12 }}
                stroke="#94a3b8"
                width={80}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {osData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Two-col row: Device type + Capture mode */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Device types">
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={deviceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={2}
                >
                  {deviceData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 13,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {deviceData.map((d, i) => (
              <span key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Capture mode">
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={captureData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={2}
                >
                  {captureData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 13,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {captureData.map((d, i) => (
              <span key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Top pages */}
      {pageData.length > 0 && (
        <ChartCard title="Top pages">
          <div className="space-y-2">
            {pageData.slice(0, 10).map((page, i) => (
              <div
                key={page.name}
                className="flex items-center justify-between rounded-lg px-3 py-2 odd:bg-slate-50/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium text-slate-400 w-5">
                    {i + 1}.
                  </span>
                  <IconLink className="size-3.5 shrink-0 text-slate-400" />
                  <span className="truncate text-sm text-slate-700">
                    {page.name}
                  </span>
                </div>
                <span className="ml-3 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {page.value}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  );
}
