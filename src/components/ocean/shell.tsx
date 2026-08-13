import { TopNavigation } from "@/components/ocean/top-navigation";
import { LiveDataRefresh } from "@/components/ocean/live-data-refresh";
import { InstallAppLink } from "@/components/ocean/install-app-link";
import { InitialLoadingOverlay } from "@/components/ocean/initial-loading-overlay";

export function OceanAppShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
  marineAlertCount?: number;
  marineAlertHeadline?: string;
}) {
  return (
    <main className="ocean-shell relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_70%_10%,rgba(91,231,255,0.18),transparent_35%),radial-gradient(circle_at_20%_80%,rgba(20,184,166,0.10),transparent_35%),linear-gradient(180deg,#F7FCFD_0%,#EDF8F7_100%)] text-[#102b3a]">
      <InitialLoadingOverlay />
      <LiveDataRefresh />
      <div className="ocean-texture-overlay pointer-events-none fixed inset-0" />
      <TopNavigation active={active} />
      <div className="relative flex min-h-screen min-w-0">
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <section className="mx-auto w-full min-w-0 max-w-6xl px-3 py-5 sm:px-6 lg:px-8">{children}</section>
          <footer className="mx-auto mt-auto w-full max-w-6xl px-3 pb-6 pt-4 text-xs font-semibold text-[#5f7078] sm:px-6 lg:px-8 dark:text-[#b7cbd3]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#094c60]/12 pt-4 dark:border-white/12">
              <span>Live ocean observations for Maui. Sources may be delayed.</span>
              <InstallAppLink />
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
