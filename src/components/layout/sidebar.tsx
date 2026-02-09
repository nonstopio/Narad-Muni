"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Clock, Settings } from "lucide-react";

const navItems = [
  { href: "/", label: "Updates", icon: Calendar },
  { href: "/history", label: "History", icon: Clock },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[280px] min-w-[280px] bg-narada-surface border-r border-white/[0.06] p-6 flex flex-col">
      <div
        className="text-2xl font-bold mb-8 bg-clip-text text-transparent"
        style={{
          backgroundImage: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
          letterSpacing: "-0.5px",
        }}
      >
        Narada
      </div>

      <nav className="flex-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 mb-2 rounded-xl border-l-[3px] transition-all duration-300 ${
                isActive
                  ? "border-l-narada-primary bg-white/[0.03] text-narada-text shadow-[inset_0_0_20px_rgba(59,130,246,0.3)]"
                  : "border-l-transparent text-narada-text-secondary hover:text-narada-text hover:bg-white/[0.03]"
              }`}
            >
              <span className="w-5 h-5 flex items-center justify-center">
                <item.icon className="w-[18px] h-[18px]" />
              </span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 pt-6 border-t border-white/[0.06]">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white"
          style={{
            background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
          }}
        >
          AK
        </div>
        <div>
          <h3 className="text-sm font-semibold text-narada-text">
            Ajay Kumar
          </h3>
          <p className="text-xs text-narada-text-muted">Developer</p>
        </div>
      </div>
    </aside>
  );
}
