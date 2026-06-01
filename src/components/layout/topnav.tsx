"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Sync", href: "/sync" },
  { label: "Downloads", href: "/downloads" },
  { label: "Library", href: "/library" },
  { label: "Metadata", href: "/metadata" },
  { label: "Duplicates", href: "/duplicates" },
  { label: "Backup", href: "/backup" },
  { label: "Settings", href: "/settings" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="h-12 bg-[#161620] flex items-center px-4 border-b border-[rgba(255,255,255,0.06)]">
      {/* Left: Logo */}
      <Link href="/" className="flex items-center gap-2 mr-6">
        <LayoutGrid className="h-5 w-5 text-[#34d399]" />
        <span className="text-sm font-semibold text-[#34d399]">Spotify to Local</span>
      </Link>

      {/* Center: Nav items */}
      <div className="flex items-center gap-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-1.5 rounded text-sm transition-colors",
                isActive
                  ? "text-[#34d399] bg-[rgba(52,211,153,0.1)]"
                  : "text-[#8888a0] hover:text-[#e0e0e8]"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Right: Version */}
      <div className="ml-auto">
        <span className="text-xs text-[#5a5a6e]">v0.1.0</span>
      </div>
    </nav>
  );
}
