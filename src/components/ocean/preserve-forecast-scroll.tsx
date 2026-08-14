"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const FORECAST_SCROLL_KEY = "ocean-state:forecast-scroll-y";

export function PreserveForecastScroll() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest("[data-preserve-forecast-scroll]")
        : null;
      if (!target) return;
      sessionStorage.setItem(FORECAST_SCROLL_KEY, String(window.scrollY));
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  useEffect(() => {
    if (pathname !== "/forecast") return;

    const storedScroll = sessionStorage.getItem(FORECAST_SCROLL_KEY);
    if (!storedScroll) return;

    sessionStorage.removeItem(FORECAST_SCROLL_KEY);
    const y = Number.parseInt(storedScroll, 10);
    if (!Number.isFinite(y)) return;

    requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: "instant" });
    });
  }, [pathname, searchParams]);

  return null;
}
