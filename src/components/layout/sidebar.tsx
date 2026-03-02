"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Clock, Settings, Bug, LogOut } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

const navItems = [
  { href: "/", label: "Scrolls", icon: Calendar },
  { href: "/history", label: "Chronicles", icon: Clock },
  { href: "/settings", label: "Configurations", icon: Settings },
  { href: "/report", label: "Seek Aid", icon: Bug },
];

function UserAvatar({ user, size = 40 }: { user: { displayName: string | null; email: string | null; photoURL: string | null }; size?: number }) {
  if (user.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.displayName || "Avatar"}
        referrerPolicy="no-referrer"
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  const initials = (user.displayName || user.email || "?")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");

  return (
    <div
      className="rounded-full bg-gradient-to-br from-narada-primary to-narada-secondary flex items-center justify-center text-white font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <aside className="w-16 min-w-16 bg-narada-surface border-r border-white/[0.06] pt-16 pb-6 flex flex-col items-center">
      <nav className="flex-1 flex flex-col items-center gap-2 titlebar-no-drag">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/" || pathname.startsWith("/update")
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 ${
                isActive
                  ? "bg-white/[0.03] text-narada-text shadow-[inset_0_0_20px_rgba(59,130,246,0.3)]"
                  : "text-narada-text-secondary hover:text-narada-text hover:bg-white/[0.03]"
              }`}
            >
              <item.icon className="w-[18px] h-[18px]" />
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="border-t border-white/[0.06] pt-4 titlebar-no-drag">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="w-10 h-10 rounded-full ring-2 ring-transparent hover:ring-narada-primary/50 transition-all duration-300 cursor-pointer"
                title={user.displayName || "Profile"}
              >
                <UserAvatar user={user} size={40} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="end" sideOffset={12}>
              <div className="flex flex-col items-center gap-3">
                <UserAvatar user={user} size={64} />
                <div className="text-center min-w-0 w-full">
                  <p className="text-sm font-medium text-narada-text truncate">
                    {user.displayName || "Wandering Sage"}
                  </p>
                  {user.email && (
                    <p className="text-xs text-narada-text-secondary font-mono truncate mt-0.5">
                      {user.email}
                    </p>
                  )}
                </div>
                <div className="w-full border-t border-white/[0.06]" />
                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Depart the Three Worlds
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </aside>
  );
}
