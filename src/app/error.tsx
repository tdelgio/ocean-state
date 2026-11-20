"use client";

import { useEffect } from "react";

export default function OceanStateError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[#173844] px-6 py-16 text-[#f4fbff]">
      <div className="mx-auto max-w-md">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#9debf9]">Ocean State</p>
        <h1 className="mt-2 text-3xl font-semibold">Live data did not load</h1>
        <p className="mt-3 text-sm leading-6 text-[#d5e7ee]">
          The page could not finish reading ocean sources. No sample values were substituted.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-6 rounded-full bg-[#9debf9] px-4 py-2 text-sm font-semibold text-[#102b33]"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
