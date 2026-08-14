"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const FORECAST_SCROLL_KEY = "ocean-state:forecast-scroll-y";
const RESTORE_DELAYS_MS = [0, 50, 150, 300, 600];

export function PreserveForecastScroll() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const saveScroll = (event: Event) => {
      const target = event.target instanceof Element
        ? event.target.closest("[data-preserve-forecast-scroll]")
        : null;
      if (!target) return;
      sessionStorage.setItem(FORECAST_SCROLL_KEY, String(window.scrollY));
    };

    document.addEventListener("pointerdown", saveScroll, { capture: true });
    document.addEventListener("click", saveScroll, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", saveScroll, { capture: true });
      document.removeEventListener("click", saveScroll, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (pathname !== "/forecast") return;

    const storedScroll = sessionStorage.getItem(FORECAST_SCROLL_KEY);
    if (!storedScroll) return;

    sessionStorage.removeItem(FORECAST_SCROLL_KEY);
    const y = Number.parseInt(storedScroll, 10);
    if (!Number.isFinite(y)) return;

    const restore = () => window.scrollTo({ top: y, behavior: "auto" });
    requestAnimationFrame(restore);
    const timeouts = RESTORE_DELAYS_MS.map((delay) => window.setTimeout(restore, delay));
    return () => timeouts.forEach(window.clearTimeout);
  }, [pathname, searchParams]);

  return null;
}
