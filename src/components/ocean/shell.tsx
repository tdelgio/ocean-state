import { Sidebar } from "@/components/ocean/sidebar";
import { TopNavigation } from "@/components/ocean/top-navigation";
import { LiveDataRefresh } from "@/components/ocean/live-data-refresh";
import { InstallAppLink } from "@/components/ocean/install-app-link";

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
      <LiveDataRefresh />
      <div className="ocean-texture-overlay pointer-events-none fixed inset-0" />
      <TopNavigation active={active} />
      <div className="relative flex min-h-screen min-w-0">
        <Sidebar active={active} />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <section className="mx-auto w-full min-w-0 max-w-6xl px-3 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</section>
          <footer className="mx-auto mt-auto w-full max-w-6xl px-3 pb-6 pt-4 text-xs font-semibold text-[#5f7078] sm:px-6 lg:px-8 dark:text-[#b7cbd3]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#094c60]/12 pt-4 dark:border-white/12">
              <span className="rounded-full border border-[#094c60]/14 px-2.5 py-1 text-[#102b3a] dark:border-white/14 dark:text-[#e9f8fb]">
                Ocean State Beta
              </span>
              <span>Live ocean observations for Maui. Sources may be delayed.</span>
              <a className="text-[#0d5968] underline-offset-4 hover:underline dark:text-[#9debf9]" href="mailto:feedback@oceanstate.live">
                Send feedback
              </a>
              <InstallAppLink />
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
