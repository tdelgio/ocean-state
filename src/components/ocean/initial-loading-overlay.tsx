import { MapPin, Waves } from "lucide-react";

export function InitialLoadingOverlay() {
  return (
    <main className="fixed inset-0 z-50 grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_70%_10%,rgba(91,231,255,0.18),transparent_35%),radial-gradient(circle_at_20%_80%,rgba(20,184,166,0.10),transparent_35%),linear-gradient(180deg,#F7FCFD_0%,#EDF8F7_100%)] px-6 text-[#102b3a] dark:bg-[radial-gradient(circle_at_70%_10%,rgba(91,231,255,0.10),transparent_35%),radial-gradient(circle_at_20%_80%,rgba(20,184,166,0.08),transparent_35%),linear-gradient(180deg,#071723_0%,#0b2230_100%)] dark:text-[#f4fbff]" aria-busy="true" aria-label="Loading live ocean conditions">
      <div className="ocean-texture-overlay pointer-events-none fixed inset-0" />
      <section className="relative w-full max-w-sm rounded-[1.6rem] border border-[#094c60]/10 bg-white/70 p-6 text-center shadow-[0_20px_60px_rgba(7,35,45,0.10)] backdrop-blur-xl dark:border-white/12 dark:bg-[#0b2230]/72">
        <div className="relative mx-auto grid size-16 place-items-center rounded-full border border-[#094c60]/12 bg-white/75 text-[#0d5968] shadow-[0_12px_28px_rgba(7,35,45,0.08)] dark:border-white/14 dark:bg-[#102a3a] dark:text-[#9debf9]">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#0d9684] dark:border-t-[#5eead4]" aria-hidden />
          <Waves className="size-8" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Ocean State</h1>
        <p className="mt-2 inline-flex items-center justify-center gap-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#0d5968] dark:text-[#9debf9]">
          <MapPin className="size-3.5" />
          Maui
        </p>
        <p className="mt-5 text-sm font-semibold text-[#5f7078] dark:text-[#b7cbd3]">
          Loading live ocean conditions...
        </p>
      </section>
    </main>
  );
}
