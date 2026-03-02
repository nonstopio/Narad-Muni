"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  type PieLabelRenderProps,
} from "recharts";
import { authedFetch } from "@/lib/api-client";
import { PageSpinner } from "@/components/ui/page-spinner";
import {
  CHART_COLORS,
  PIE_COLORS,
  AXIS_STYLE,
  TOOLTIP_STYLE,
  GRID_STYLE,
} from "./chart-theme";
import type { AdminAnalyticsData } from "@/types/admin";

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass-card p-4 flex flex-col gap-1">
      <span className="text-xs narada-text-secondary uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold narada-text">{value}</span>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium narada-text-secondary mb-4">{title}</h3>
      {children}
    </div>
  );
}

const RANGE_OPTIONS = [
  { label: "30d", value: 30 },
  { label: "60d", value: 60 },
  { label: "90d", value: 90 },
];

export function AnalyticsClient() {
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState(30);

  useEffect(() => {
    setLoading(true);
    setError(null);
    authedFetch(`/api/admin/analytics?range=${range}`)
      .then((res) => {
        if (res.status === 403) throw new Error("forbidden");
        if (!res.ok) throw new Error("Failed to load analytics");
        return res.json();
      })
      .then((d) => setData(d))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading) return <PageSpinner message="The sage peers into the cosmic ledger..." />;

  if (error === "forbidden") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass-card p-8 text-center max-w-md">
          <p className="text-xl narada-text mb-2">Narayan Narayan!</p>
          <p className="narada-text-secondary">
            Only the highest sages may enter the observatory.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass-card p-8 text-center max-w-md">
          <p className="text-xl narada-text mb-2">Alas!</p>
          <p className="narada-text-secondary">{error || "The cosmic ledger could not be read."}</p>
        </div>
      </div>
    );
  }

  // Hourly data for bar chart
  const hourlyData = data.hourlyDistribution.map((count, hour) => ({
    hour: `${hour}:00`,
    count,
  }));

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold narada-text">Narada&apos;s Observatory</h1>
          <p className="text-sm narada-text-secondary mt-1">
            A celestial view of all activity across the three worlds
          </p>
        </div>
        <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1 border border-white/[0.06]">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${
                range === opt.value
                  ? "bg-narada-primary/20 text-narada-primary"
                  : "text-narada-text-secondary hover:text-narada-text"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Daily Active" value={data.dau} />
        <MetricCard label="Weekly Active" value={data.wau} />
        <MetricCard label="Monthly Active" value={data.mau} />
        <MetricCard label="Total Users" value={data.totalUsers} />
      </div>

      {/* Daily Activity Trend */}
      <ChartCard title="Daily Activity Trend">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data.dailyTrend}>
            <defs>
              <linearGradient id="gradUpdates" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.violet} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.violet} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis
              dataKey="date"
              {...AXIS_STYLE}
              tickFormatter={(d: string) => d.slice(5)}
            />
            <YAxis {...AXIS_STYLE} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}
            />
            <Area
              type="monotone"
              dataKey="updateCount"
              name="Updates"
              stroke={CHART_COLORS.blue}
              fill="url(#gradUpdates)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="uniqueUsers"
              name="Unique Users"
              stroke={CHART_COLORS.violet}
              fill="url(#gradUsers)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Platform Adoption + Publish Success */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Platform Adoption">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.platformAdoption}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="platform" {...AXIS_STYLE} />
              <YAxis {...AXIS_STYLE} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="configured" name="Configured" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
              <Bar dataKey="activelyUsed" name="Actively Used" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Publish Success Rates">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.publishStats}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="platform" {...AXIS_STYLE} />
              <YAxis {...AXIS_STYLE} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="sent" name="Sent" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" name="Failed" fill={CHART_COLORS.rose} radius={[4, 4, 0, 0]} />
              <Bar dataKey="skipped" name="Skipped" fill="rgba(255,255,255,0.15)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* AI Provider + Sacred Hours */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="AI Provider Distribution">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data.aiProviderDistribution}
                dataKey="count"
                nameKey="provider"
                cx="50%"
                cy="50%"
                outerRadius={80}
                strokeWidth={0}
                label={(props: PieLabelRenderProps) =>
                  `${props.name ?? ""}: ${props.value ?? 0}`
                }
              >
                {data.aiProviderDistribution.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Sacred Hours (Publishing Activity)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlyData}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis
                dataKey="hour"
                {...AXIS_STYLE}
                interval={2}
              />
              <YAxis {...AXIS_STYLE} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="count" name="Publishes" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Streak Distribution + Inactive Users */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Devotion Streaks (days)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.streakDistribution}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="bucket" {...AXIS_STYLE} />
              <YAxis {...AXIS_STYLE} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="count" name="Users" fill={CHART_COLORS.violet} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Inactive Devotees">
          {data.inactiveUsers.length === 0 ? (
            <p className="narada-text-secondary text-sm py-8 text-center">
              All devotees are active! Narayan Narayan!
            </p>
          ) : (
            <div className="max-h-[220px] overflow-y-auto space-y-1">
              <div className="grid grid-cols-2 gap-2 text-xs narada-text-secondary border-b border-white/[0.06] pb-2 mb-2">
                <span>Email</span>
                <span>Last Active</span>
              </div>
              {data.inactiveUsers.map((u, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 text-xs py-1">
                  <span className="narada-text truncate font-mono">{u.email}</span>
                  <span className="narada-text-secondary">
                    {u.lastActive || "Never"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
