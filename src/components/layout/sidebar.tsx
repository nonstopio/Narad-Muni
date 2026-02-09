"use client";

import Link from "next/link";
import Image from "next/image";
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
    <aside className="w-16 min-w-16 bg-narada-surface border-r border-white/[0.06] py-6 flex flex-col items-center">
      {/* Logo */}
      <Link href="/" className="mb-8 block">
        <Image
          src="/icon.png"
          alt="Narada"
          width={32}
          height={32}
          className="rounded-lg"
        />
      </Link>

      <nav className="flex-1 flex flex-col items-center gap-2">
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
    </aside>
  );
}
