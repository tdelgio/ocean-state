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
        <Link href="/home" prefetch={false} className="flex items-center gap-2">
          <span className="mt-0.5 grid size-8 place-items-center rounded-full border border-[#094c60]/12 bg-white/75 text-[#0d5968] shadow-[0_8px_20px_rgba(7,35,45,0.06)] dark:border-white/14 dark:bg-[#102a3a]">
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
            href={item.href}
            prefetch={false}
            className={cn(
              "shrink-0 border-b-2 px-0.5 pb-2.5 text-[0.68rem] font-medium uppercase tracking-[0.11em] transition sm:px-2 sm:text-[0.72rem]",
              active === item.href
                ? "border-[#0d9684] text-[#102b3a] dark:border-[#17d3b2] dark:text-white"
                : "border-transparent text-[#657981] hover:text-[#102b3a] dark:text-[#9fb4bc] dark:hover:text-white",
            )}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              {item.href === "/home" ? <span className="live-pulse size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" /> : null}
              {item.label}
            </span>
          </Link>
        ))}
      </nav>
    </header>
  );
}
