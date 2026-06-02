"use client";

import { Download, Share2, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallAppLink() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = "standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    return standalone || iosStandalone;
  });

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (isInstalled) return null;

  async function handleInstall() {
    if (!installPrompt) {
      setShowGuide(true);
      return;
    }
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") setInstallPrompt(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className="inline-flex items-center gap-1.5 text-[#0d5968] underline-offset-4 hover:underline dark:text-[#9debf9]"
      >
        <Download className="size-3.5" />
        Add to Home Screen
      </button>
      {showGuide ? (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-[#06131d]/55 p-3 sm:place-items-center"
          onClick={() => setShowGuide(false)}
        >
          <section
            aria-modal="true"
            aria-label="Add Ocean State to your Home Screen"
            role="dialog"
            className="w-full max-w-sm rounded-2xl border border-[#094c60]/14 bg-[#fbfaf6] p-4 text-[#102b3a] shadow-[0_20px_50px_rgba(7,35,45,0.18)] dark:border-white/14 dark:bg-[#102a3a] dark:text-[#e9f8fb]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Smartphone className="size-5 text-[#0d5968] dark:text-[#9debf9]" />
                <h2 className="text-base font-semibold">Install Ocean State</h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowGuide(false)}
                className="rounded-full p-1 text-[#536b73] hover:bg-[#edf8f7] dark:text-[#b7cbd3] dark:hover:bg-white/10"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#536b73] dark:text-[#b7cbd3]">
              On iPhone, open this page in Safari, tap Share, then choose Add to Home Screen.
            </p>
            <p className="mt-3 flex items-center gap-2 rounded-xl border border-[#094c60]/10 bg-white/70 px-3 py-2 text-sm font-semibold dark:border-white/12 dark:bg-[#071d2a]">
              <Share2 className="size-4 text-[#0d5968] dark:text-[#9debf9]" />
              Share → Add to Home Screen
            </p>
          </section>
        </div>
      ) : null}
    </>
  );
}
