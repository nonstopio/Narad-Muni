import type { StatData } from "@/types";

const colorClasses = {
  blue: "bg-blue-500/20",
  violet: "bg-violet-500/20",
  emerald: "bg-emerald-500/20",
  amber: "bg-amber-500/20",
};

interface StatsBarProps {
  stats: StatData[];
}

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-8">
      {stats.map((stat) => (
        <div key={stat.label} className="glass-card p-5">
          <div
            className={`w-10 h-10 rounded-3xl flex items-center justify-center text-xl mb-3 ${colorClasses[stat.color]}`}
          >
            {stat.icon}
          </div>
          <div className="text-xs font-semibold text-narada-text-muted uppercase tracking-wider mb-2">
            {stat.label}
          </div>
          <div className="text-[28px] font-bold text-narada-text">
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
