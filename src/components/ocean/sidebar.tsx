import Link from "next/link";
import { Anchor, CalendarDays, Home, MapPin, Ship } from "lucide-react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ocean/theme-toggle";

const navItems = [
  { href: "/home", label: "Live", description: "Right now", icon: Home },
  { href: "/forecast", label: "Forecast", description: "Models", icon: CalendarDays },
  { href: "/channels", label: "Channels", description: "Inter-island", icon: Ship },
  { href: "/harbors", label: "Harbors", description: "Launches", icon: Anchor },
];

export function Sidebar({ active }: { active: string }) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-[rgba(9,76,96,0.12)] bg-[#f6fbfc] p-4 lg:block">
      <Link
        href="/home"
        prefetch={false}
        className="flex items-center gap-3 rounded-2xl bg-[#f7fafa] p-3 ring-1 ring-[#e4e8ea]"
      >
        <span className="grid size-11 place-items-center rounded-full bg-white text-[#0d5968] ring-1 ring-[#d8e4e7]">
          <Ship className="size-5" />
        </span>
        <span>
          <span className="block text-base font-semibold tracking-[0.01em] text-[#102b3a]">
            Ocean State
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#0d5968]">
            <MapPin className="size-3" />
            Maui
          </span>
        </span>
      </Link>

      <nav className="mt-6 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-3 transition",
              active === item.href
                ? "border border-[#092f3e] bg-[#092f3e] text-white shadow-[0_12px_24px_rgba(7,35,45,0.16)]"
                : "border border-transparent text-[#526a73] hover:border-[#cddadd] hover:bg-white hover:text-[#102b3a]",
            )}
          >
            <item.icon className="size-5" />
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold">
                {item.href === "/home" ? (
                  <span className="live-pulse size-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                ) : null}
                {item.label}
              </span>
              <span
                className={cn(
                  "block text-xs font-medium",
                  active === item.href ? "text-white/78" : "text-[#7c8f96]",
                )}
              >
                {item.description}
              </span>
            </span>
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        <ThemeToggle />
      </div>
    </aside>
  );
}

export { navItems };
