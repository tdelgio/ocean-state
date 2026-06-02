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
    <header className="sticky top-0 z-30 px-3 py-3 backdrop-blur-sm lg:hidden">
      <div className="mx-auto flex w-full max-w-6xl items-start justify-between gap-3">
        <Link href="/home" prefetch={false} className="flex items-center gap-2">
          <span className="mt-0.5 grid size-8 place-items-center rounded-full border border-[#094c60]/12 bg-white/70 text-[#0d5968] dark:border-white/14 dark:bg-[#102a3a]">
            <Waves className="size-4" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-[#102b3a] dark:text-white">Ocean State</span>
            <span className="mt-0.5 inline-flex items-center gap-1 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[#0d5968] dark:text-[#9debf9]">
              <MapPin className="size-3" />
              Maui
            </span>
          </span>
        </Link>
        <ThemeToggle compact />
      </div>
      <nav className="mx-auto mt-4 flex w-full max-w-6xl items-center justify-evenly gap-2 overflow-x-auto border-b border-[#094c60]/12 pb-1 dark:border-white/12">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={cn(
              "shrink-0 border-b-2 px-0 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] transition",
              active === item.href
                ? "border-[#092f3e] text-[#102b3a] dark:border-[#ff9f8c] dark:text-white"
                : "border-transparent text-[#526a73] hover:text-[#102b3a] dark:text-[#a9bdc6] dark:hover:text-white",
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
