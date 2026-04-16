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
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/components/ui/toast";
import {
  CHART_COLORS,
  PIE_COLORS,
  AXIS_STYLE,
  TOOLTIP_STYLE,
  GRID_STYLE,
} from "./chart-theme";
import type { AdminAnalyticsData } from "@/types/admin";

interface TimeSavedConstants {
  perPlatformSecs: number;
  perTaskSecs: number;
  perTimeEntrySecs: number;
}

function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
}

function formatSecsCompact(secs: number): string {
  if (secs < 60) return `${Math.round(secs)}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m === 0 ? `${h}h` : `${h}h ${m}m`;
  const days = Math.floor(h / 24);
  const rh = h % 24;
  return rh === 0 ? `${days}d` : `${days}d ${rh}h`;
}

function StageLatencyRow({
  label,
  p50,
  p95,
  count,
}: {
  label: string;
  p50: number | null;
  p95: number | null;
  count: number;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-1.5 text-xs">
      <span className="narada-text font-medium">{label}</span>
      <span className="narada-text-secondary font-mono">p50 {formatMs(p50)}</span>
      <span className="narada-text-secondary font-mono">p95 {formatMs(p95)}</span>
      <span className="narada-text-secondary text-[10px]">{count} samples</span>
    </div>
  );
}

const STAGE_LABELS: Record<string, string> = {
  transcribe: "Transcribe (client → server)",
  deepgram: "Deepgram API",
  aiParse: "AI Parse (client → server)",
  aiProvider: "AI Provider call",
  slack: "Slack webhook",
  teams: "Teams webhook",
  jira: "Jira worklogs",
  totalPublish: "Publish (end-to-end)",
};

type DevoteeRow = {
  email: string;
  lastActive: string | null;
  updateCount: number;
  isActive: boolean;
};

function DevoteesCard({ users }: { users: DevoteeRow[] }) {
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const activeCount = users.filter((u) => u.isActive).length;
  const inactiveCount = users.length - activeCount;

  const filtered = users.filter((u) => {
    if (filter === "active") return u.isActive;
    if (filter === "inactive") return !u.isActive;
    return true;
  });

  const TABS: { key: typeof filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: users.length },
    { key: "active", label: "Active", count: activeCount },
    { key: "inactive", label: "Inactive", count: inactiveCount },
  ];

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium narada-text-secondary">Devotees</h3>
        <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1 border border-white/[0.06]">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-2.5 py-1 text-[11px] rounded-md transition-colors cursor-pointer ${
                filter === tab.key
                  ? "bg-narada-primary/20 text-narada-primary"
                  : "text-narada-text-secondary hover:text-narada-text"
              }`}
            >
              {tab.label} <span className="opacity-60">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="narada-text-secondary text-sm py-8 text-center">
          {filter === "inactive"
            ? "All devotees are active! Narayan Narayan!"
            : filter === "active"
              ? "No active devotees in this range."
              : "No devotees yet."}
        </p>
      ) : (
        <div className="max-h-[260px] overflow-y-auto">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-xs narada-text-secondary border-b border-white/[0.06] pb-2 mb-2">
            <span>Email</span>
            <span>Status</span>
            <span className="text-right">Updates</span>
            <span className="text-right">Last Active</span>
          </div>
          {filtered.map((u, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-xs py-1.5 items-center"
            >
              <span className="narada-text truncate font-mono">{u.email}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  u.isActive
                    ? "bg-emerald-500/10 text-narada-emerald border border-emerald-500/30"
                    : "bg-white/[0.04] text-narada-text-secondary border border-white/[0.06]"
                }`}
              >
                {u.isActive ? "Active" : "Inactive"}
              </span>
              <span className="narada-text-secondary font-mono text-right">
                {u.updateCount}
              </span>
              <span className="narada-text-secondary text-right">
                {u.lastActive || "Never"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimeSavedConstantsCard() {
  const [constants, setConstants] = useState<TimeSavedConstants | null>(null);
  const [saving, setSaving] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    authedFetch("/api/admin/config/time-saved")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => d && setConstants(d))
      .catch(() => {});
  }, []);

  const update = (key: keyof TimeSavedConstants, value: number) => {
    setConstants((c) => (c ? { ...c, [key]: Math.max(0, Math.round(value)) } : c));
  };

  const save = async () => {
    if (!constants) return;
    setSaving(true);
    try {
      const res = await authedFetch("/api/admin/config/time-saved", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(constants),
      });
      if (!res.ok) throw new Error("Save failed");
      addToast("Narayan Narayan! The sacred constants are inscribed.", "success");
    } catch {
      addToast("Alas! The constants could not be inscribed.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!constants) {
    return (
      <div className="glass-card p-5">
        <h3 className="text-sm font-medium narada-text-secondary mb-4">Time-Saved Constants</h3>
        <p className="text-xs narada-text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium narada-text-secondary mb-1">Time-Saved Constants</h3>
      <p className="text-[11px] narada-text-secondary mb-4">
        Per-update estimate formula: platformsSucceeded × perPlatform + taskCount × perTask + timeEntryCount × perTimeEntry − publishMs.
      </p>
      <div className="space-y-3 text-sm">
        <label className="grid grid-cols-[1fr_auto] items-center gap-3">
          <span className="narada-text-secondary">per platform (secs)</span>
          <input
            type="number"
            min={0}
            value={constants.perPlatformSecs}
            onChange={(e) => update("perPlatformSecs", Number(e.target.value))}
            className="glass-input w-24 px-2 py-1 text-right font-mono"
          />
        </label>
        <label className="grid grid-cols-[1fr_auto] items-center gap-3">
          <span className="narada-text-secondary">per task (secs)</span>
          <input
            type="number"
            min={0}
            value={constants.perTaskSecs}
            onChange={(e) => update("perTaskSecs", Number(e.target.value))}
            className="glass-input w-24 px-2 py-1 text-right font-mono"
          />
        </label>
        <label className="grid grid-cols-[1fr_auto] items-center gap-3">
          <span className="narada-text-secondary">per time entry (secs)</span>
          <input
            type="number"
            min={0}
            value={constants.perTimeEntrySecs}
            onChange={(e) => update("perTimeEntrySecs", Number(e.target.value))}
            className="glass-input w-24 px-2 py-1 text-right font-mono"
          />
        </label>
      </div>
      <div className="flex justify-end mt-4">
        <Button variant="primary" size="sm" onClick={save} disabled={saving}>
          {saving ? "Inscribing..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

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

      {/* Performance & Value — analytics v2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Time Saved (range)"
          value={formatSecsCompact(data.totalTimeSavedSecs)}
        />
        <MetricCard
          label="Updates with Metrics"
          value={data.updatesWithMetrics}
        />
        <MetricCard
          label="Median Publish"
          value={formatMs(
            data.stageLatency.find((s) => s.stage === "totalPublish")?.p50 ?? null
          )}
        />
        <MetricCard
          label="p95 AI Provider"
          value={formatMs(
            data.stageLatency.find((s) => s.stage === "aiProvider")?.p95 ?? null
          )}
        />
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

      {/* Stage Latency + Slowest Stage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Stage Latency (p50 / p95)">
          {data.updatesWithMetrics === 0 ? (
            <p className="text-xs narada-text-secondary py-8 text-center">
              No metrics yet. Publish a few updates to see latency data.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {data.stageLatency.map((s) => (
                <StageLatencyRow
                  key={s.stage}
                  label={STAGE_LABELS[s.stage] ?? s.stage}
                  p50={s.p50}
                  p95={s.p95}
                  count={s.sampleCount}
                />
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Slowest Stage Distribution">
          {data.slowestStageDistribution.length === 0 ? (
            <p className="text-xs narada-text-secondary py-8 text-center">
              No samples yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.slowestStageDistribution}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis
                  dataKey="stage"
                  {...AXIS_STYLE}
                  tickFormatter={(v: string) => STAGE_LABELS[v]?.split(" ")[0] ?? v}
                />
                <YAxis {...AXIS_STYLE} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar
                  dataKey="count"
                  name="Updates where this stage was slowest"
                  fill={CHART_COLORS.amber}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Provider Latency (cloud vs local-claude) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ChartCard title="Cloud AI Provider Latency">
          {data.cloudProviderLatency.length === 0 ? (
            <p className="text-xs narada-text-secondary py-8 text-center">
              No cloud provider samples yet.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {data.cloudProviderLatency.map((p) => (
                <StageLatencyRow
                  key={p.provider}
                  label={p.provider}
                  p50={p.p50}
                  p95={p.p95}
                  count={p.sampleCount}
                />
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Local CLI Providers">
          <p className="text-[11px] narada-text-secondary mb-2">
            Latency here reflects the user&apos;s hardware and CLI version — not comparable to cloud APIs.
          </p>
          {data.localProviderLatency.length === 0 ? (
            <p className="text-xs narada-text-secondary py-8 text-center">
              No local CLI samples yet.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {data.localProviderLatency.map((p) => (
                <StageLatencyRow
                  key={p.provider}
                  label={p.provider}
                  p50={p.p50}
                  p95={p.p95}
                  count={p.sampleCount}
                />
              ))}
            </div>
          )}
        </ChartCard>

        <TimeSavedConstantsCard />
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

        <DevoteesCard users={data.users} />
      </div>
    </div>
  );
}
