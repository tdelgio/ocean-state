import Link from "next/link";
import { MapPin, Waves } from "lucide-react";

import { navItems } from "@/components/ocean/sidebar";
import { ThemeToggle } from "@/components/ocean/theme-toggle";
import { cn } from "@/lib/utils";

export function TopNavigation({
  active,
}: {
  active: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#094c60]/10 bg-[#f7fcfd]/88 px-3 pt-3 backdrop-blur-md dark:border-white/10 dark:bg-[#071723]/88">
      <div className="mx-auto flex w-full max-w-6xl items-start justify-between gap-3">
        <Link href="/home?shore=north" className="flex items-center gap-2">
          <span className="mt-0.5 grid size-8 place-items-center rounded-full border border-[#42d7ee]/28 bg-white/80 text-[#0b9fc6] shadow-[0_8px_22px_rgba(19,158,190,0.12)] dark:border-[#5eead4]/24 dark:bg-[#0c3142] dark:text-[#38d6ff] dark:shadow-[0_0_26px_rgba(56,214,255,0.2)]">
            <Waves className="size-4" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-medium text-[#102b3a] dark:text-white">Ocean State</span>
            <span className="mt-0.5 inline-flex items-center gap-1 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-[#0d5968] dark:text-[#9debf9]">
              <MapPin className="size-3" />
              Maui
            </span>
          </span>
        </Link>
        <ThemeToggle compact />
      </div>
      <nav className="mx-auto mt-4 flex w-full max-w-6xl items-center justify-evenly gap-4 overflow-x-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href === "/home" ? "/home?shore=north" : item.href}
            className={cn(
              "group relative shrink-0 border-b-2 border-transparent px-3 pb-2.5 pt-1 text-[0.68rem] font-medium uppercase tracking-[0.11em] transition sm:px-4 sm:text-[0.72rem]",
              active === item.href
                ? "text-[#102b3a] dark:text-[#eaffff]"
                : "text-[#657981] hover:text-[#102b3a] dark:text-[#9fb4bc] dark:hover:text-white",
            )}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {item.href === "/home" ? <span className="live-pulse size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" /> : null}
              {item.label}
            </span>
            {active === item.href ? (
              <span className="absolute inset-x-3 -bottom-0.5 h-1 rounded-full bg-[#00d5ff] shadow-[0_0_14px_rgba(0,213,255,0.55)] dark:bg-[#67e8f9] dark:shadow-[0_0_18px_rgba(103,232,249,0.78)]" />
            ) : null}
          </Link>
        ))}
      </nav>
    </header>
  );
}
