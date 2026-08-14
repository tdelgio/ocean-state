"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const THEME_KEY = "ocean-state-theme";
const LEGACY_THEME_KEY = "downwind-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const savedTheme =
    (window.localStorage.getItem(THEME_KEY) as Theme | null) ??
    (window.localStorage.getItem(LEGACY_THEME_KEY) as Theme | null);
  if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
  return "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={theme === "dark"}
      className={
        compact
          ? "theme-toggle relative z-40 grid size-9 place-items-center rounded-full border text-[#102b3a] transition hover:-translate-y-0.5 hover:text-[#0d5968] dark:text-[#e9f8fb]"
          : "theme-toggle relative z-40 flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-sm font-semibold text-[#102b3a] transition hover:-translate-y-0.5 dark:text-[#e9f8fb]"
      }
    >
      {compact ? (
        <Icon className="size-4" />
      ) : (
        <>
          <span className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-white/70">
              <Icon className="size-4" />
            </span>
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </span>
          <span className="text-xs uppercase tracking-[0.12em]">
            {theme === "dark" ? "Day" : "Night"}
          </span>
        </>
      )}
    </button>
  );
}
