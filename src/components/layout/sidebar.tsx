"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  HardDrive,
  Cloud,
  RefreshCw,
  Download,
  Tags,
  Copy,
  Archive,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/local-library", label: "Local Library", icon: HardDrive },
  { href: "/spotify-library", label: "Spotify Library", icon: Cloud },
  { href: "/sync", label: "Sync", icon: RefreshCw },
  { href: "/downloads", label: "Downloads", icon: Download },
  { href: "/metadata", label: "Metadata", icon: Tags },
  { href: "/duplicates", label: "Duplicates", icon: Copy },
  { href: "/backup", label: "Backup", icon: Archive },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen border-r border-[#334155] bg-[#0F172A] flex flex-col">
      <div className="p-5 pb-2">
        <h1 className="text-lg font-bold text-[#F8FAFC] tracking-tight">
          Spotify Local Sync
        </h1>
        <p className="text-xs text-[#94A3B8] mt-0.5">Music library manager</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/20"
                  : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] border border-transparent"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  isActive ? "text-[#22C55E]" : "text-[#64748B]"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-[#334155]">
        <p className="text-[10px] text-[#475569]">v0.1.0</p>
      </div>
    </aside>
  );
}
