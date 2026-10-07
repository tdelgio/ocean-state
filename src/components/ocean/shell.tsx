import { TopNavigation } from "@/components/ocean/top-navigation";
import { LiveDataRefresh } from "@/components/ocean/live-data-refresh";
import { InstallAppLink } from "@/components/ocean/install-app-link";
import { Coffee } from "lucide-react";

const SUPPORT_OCEAN_STATE_URL = "https://paypal.me/tdelgio";

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
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <section className="mx-auto w-full min-w-0 max-w-2xl px-3 py-5 sm:px-6 lg:px-8">{children}</section>
          <footer className="mx-auto mt-auto w-full max-w-2xl px-3 pb-6 pt-5 sm:px-6 lg:px-8">
            <div className="border-t border-[#094c60]/12 pt-4 dark:border-white/12">
              <p className="max-w-xl text-xs font-medium leading-5 text-[#5f7078] dark:text-[#b7cbd3]">
                Ocean State translates NOAA observations and forecasts into a clearer view of ocean conditions. Sources may be delayed.
              </p>
              <p className="mt-1 text-[0.64rem] font-medium leading-4 text-[#7a8990] dark:text-[#8fa8b1]">
                Independent presentation of public data — not an official NOAA service.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold">
                <InstallAppLink />
                <a
                  href={SUPPORT_OCEAN_STATE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#0d5968] underline-offset-4 transition-transform duration-150 hover:underline active:scale-[0.97] dark:text-[#9debf9]"
                >
                  <Coffee className="size-3.5" />
                  Support Ocean State
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
