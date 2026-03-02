export const CHART_COLORS = {
  blue: "#3B82F6",
  violet: "#8B5CF6",
  emerald: "#10B981",
  amber: "#F59E0B",
  rose: "#EF4444",
  cyan: "#06B6D4",
} as const;

export const PLATFORM_COLORS: Record<string, string> = {
  SLACK: CHART_COLORS.blue,
  TEAMS: CHART_COLORS.violet,
  JIRA: CHART_COLORS.amber,
};

export const PIE_COLORS = [
  CHART_COLORS.blue,
  CHART_COLORS.violet,
  CHART_COLORS.emerald,
  CHART_COLORS.amber,
  CHART_COLORS.rose,
];

export const AXIS_STYLE = {
  tick: { fill: "rgba(255,255,255,0.4)", fontSize: 11 },
  axisLine: { stroke: "rgba(255,255,255,0.06)" },
  tickLine: false as const,
};

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#1A1A2E",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 8,
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
  },
  itemStyle: { color: "rgba(255,255,255,0.85)" },
};

export const GRID_STYLE = {
  strokeDasharray: "3 3",
  stroke: "rgba(255,255,255,0.06)",
};
