import { Activity, CheckCircle2, Clock3, ExternalLink, FlaskConical, Radio, TriangleAlert } from "lucide-react";

import type { DataHealthCategory, DataHealthReport, DataHealthSource, DataHealthState } from "@/lib/ocean/data-health";

const stateConfig: Record<DataHealthState, { label: string; dot: string; badge: string }> = {
  healthy: {
    label: "Online",
    dot: "bg-emerald-500 dark:bg-emerald-400",
    badge: "border-emerald-700/15 bg-emerald-50 text-emerald-800 dark:border-emerald-300/15 dark:bg-emerald-950/35 dark:text-emerald-200",
  },
  delayed: {
    label: "Delayed",
    dot: "bg-amber-500",
    badge: "border-amber-700/15 bg-amber-50 text-amber-800 dark:border-amber-300/15 dark:bg-amber-950/35 dark:text-amber-100",
  },
  expired: {
    label: "Expired",
    dot: "bg-orange-600",
    badge: "border-orange-800/30 bg-orange-100 text-orange-950 dark:border-orange-300/35 dark:bg-orange-950/50 dark:text-orange-100",
  },
  down: {
    label: "Down",
    dot: "bg-rose-600",
    badge: "border-rose-800/45 bg-rose-100 text-rose-950 ring-1 ring-rose-700/20 dark:border-rose-200/40 dark:bg-rose-950/55 dark:text-rose-50 dark:ring-rose-200/15",
  },
  unavailable: {
    label: "Unavailable",
    dot: "bg-rose-500 dark:bg-rose-400",
    badge: "border-rose-700/15 bg-rose-50 text-rose-800 dark:border-rose-300/15 dark:bg-rose-950/35 dark:text-rose-100",
  },
  sample: {
    label: "Sample",
    dot: "bg-slate-400",
    badge: "border-slate-700/15 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/6 dark:text-slate-200",
  },
};

const categoryLabels: Record<DataHealthCategory, string> = {
  observation: "Observations",
  forecast: "Forecasts",
  model: "Models",
  other: "Supporting services",
};

export function DataHealthOverview({ report, generatedAt }: { report: DataHealthReport; generatedAt: string }) {
  const overall = getOverallCopy(report.overall);
  const categories = (["observation", "forecast", "model", "other"] as const)
    .map((category) => ({ category, sources: report.sources.filter((source) => source.category === category) }))
    .filter((group) => group.sources.length > 0);

  return (
    <div className="space-y-4">
      <section className="ocean-card overflow-hidden rounded-[1.5rem] border p-5 shadow-[0_16px_38px_rgba(8,74,92,0.08)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-[#0d5968] dark:text-[#9debf9]">System status</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.02em] text-[#102b3a] dark:text-[#f4fbff]">Data Health</h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-[#5f7078] dark:text-[#b7cbd3]">
              Freshness and availability for the public sources behind Ocean State.
            </p>
          </div>
          <span className={`mt-1 grid size-11 shrink-0 place-items-center rounded-full ${overall.iconBackground}`}>
            <overall.Icon className={`size-5 ${overall.iconColor}`} />
          </span>
        </div>

        <div className={`mt-5 rounded-2xl border px-4 py-3 ${overall.panel}`}>
          <div className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${overall.dot}`} />
            <p className="text-sm font-semibold">{overall.title}</p>
          </div>
          <p className="mt-1.5 text-xs leading-5 opacity-75">{overall.description}</p>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <SummaryMetric label="Online" value={report.counts.healthy} tone="healthy" />
          <SummaryMetric label="Delayed" value={report.counts.delayed} tone="delayed" />
          <SummaryMetric label="Expired" value={report.counts.expired} tone="expired" />
          <SummaryMetric label="Down" value={report.counts.down} tone="down" />
          <SummaryMetric label="Unavailable" value={report.counts.unavailable} tone="unavailable" />
          <SummaryMetric label="Sample" value={report.counts.sample} tone="sample" />
        </dl>
        <p className="mt-3 text-[0.62rem] font-medium text-[#7a8990] dark:text-[#8fa8b1]">
          Snapshot generated {formatTimestamp(generatedAt)} HST
        </p>
      </section>

      {categories.map(({ category, sources }) => (
        <section key={category} className="ocean-card overflow-hidden rounded-[1.35rem] border shadow-[0_12px_28px_rgba(8,74,92,0.06)]">
          <div className="flex items-center gap-2 border-b border-[#094c60]/10 px-4 py-3 dark:border-white/8">
            <CategoryIcon category={category} />
            <h2 className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-[#536b73] dark:text-[#b7cbd3]">
              {categoryLabels[category]}
            </h2>
          </div>
          <div className="divide-y divide-[#094c60]/8 dark:divide-white/8">
            {sources.map((source) => <SourceRow key={source.id} source={source} />)}
          </div>
        </section>
      ))}

      <p className="px-1 text-xs leading-5 text-[#6b7f87] dark:text-[#9fb4bc]">
        A source can be online but delayed. Ocean State evaluates the observation time, not only whether a request succeeded.
      </p>
    </div>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: number; tone: DataHealthState }) {
  const config = stateConfig[tone];
  return (
    <div className="rounded-xl border border-[#094c60]/9 bg-white/45 px-3 py-2.5 dark:border-white/8 dark:bg-white/[0.025]">
      <dt className="flex items-center gap-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.1em] text-[#6b7f87] dark:text-[#9fb4bc]">
        <span className={`size-1.5 rounded-full ${config.dot}`} />
        {label}
      </dt>
      <dd className="weather-data mt-1.5 text-2xl leading-none text-[#102b3a] dark:text-[#f4fbff]">{value}</dd>
    </div>
  );
}

function SourceRow({ source }: { source: DataHealthSource }) {
  const config = stateConfig[source.state];
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`size-1.5 shrink-0 rounded-full ${config.dot}`} />
          <h3 className="truncate text-sm font-semibold text-[#102b3a] dark:text-[#e9f8fb]">{source.name}</h3>
        </div>
        <p className="mt-1 pl-3.5 text-[0.65rem] leading-4 text-[#6b7f87] dark:text-[#9fb4bc]">
          {source.stationId ? `${source.stationId} · ` : ""}{source.detail}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`rounded-full border px-2 py-1 text-[0.56rem] font-semibold uppercase tracking-[0.07em] ${config.badge}`}>
          {config.label}
        </span>
        <span className="min-w-14 text-right text-[0.62rem] font-medium text-[#6b7f87] dark:text-[#9fb4bc]">
          {formatAge(source.ageMinutes)}
        </span>
        {source.sourceUrl ? <ExternalLink className="size-3.5 text-[#0d5968] dark:text-[#9debf9]" /> : null}
      </div>
    </>
  );

  const className = `flex items-center justify-between gap-3 px-4 py-3.5 ${source.state === "down" ? "bg-rose-50/90 dark:bg-rose-950/30" : source.state === "expired" ? "bg-orange-50/70 dark:bg-orange-950/20" : ""}`;
  return source.sourceUrl ? (
    <a href={source.sourceUrl} target="_blank" rel="noreferrer" className={`${className} transition-colors hover:bg-[#edf8f7]/65 dark:hover:bg-white/[0.035]`}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

function CategoryIcon({ category }: { category: DataHealthCategory }) {
  const Icon = category === "observation" ? Radio : category === "model" ? Activity : category === "forecast" ? Clock3 : FlaskConical;
  return <Icon className="size-4 text-[#0d5968] dark:text-[#9debf9]" />;
}

function getOverallCopy(state: DataHealthReport["overall"]) {
  if (state === "healthy") return {
    title: "All reporting sources are current",
    description: "Every tracked source is within its expected update window.",
    Icon: CheckCircle2,
    dot: "bg-emerald-500",
    iconBackground: "bg-emerald-100 dark:bg-emerald-950/45",
    iconColor: "text-emerald-700 dark:text-emerald-300",
    panel: "border-emerald-700/12 bg-emerald-50/70 text-emerald-900 dark:border-emerald-300/12 dark:bg-emerald-950/25 dark:text-emerald-100",
  };
  if (state === "down") return {
    title: "Some buoys are down",
    description: "A buoy is down when its latest report is older than 60 minutes, or it is not reporting. The row shows how long ago the last real reading was.",
    Icon: TriangleAlert,
    dot: "bg-rose-600",
    iconBackground: "bg-rose-100 dark:bg-rose-950/45",
    iconColor: "text-rose-800 dark:text-rose-200",
    panel: "border-rose-800/25 bg-rose-50 text-rose-950 dark:border-rose-200/20 dark:bg-rose-950/35 dark:text-rose-50",
  };
  if (state === "delayed") return {
    title: "Some sources are delayed",
    description: "Use the latest values with context and check their observation time.",
    Icon: Clock3,
    dot: "bg-amber-500",
    iconBackground: "bg-amber-100 dark:bg-amber-950/45",
    iconColor: "text-amber-700 dark:text-amber-200",
    panel: "border-amber-700/12 bg-amber-50/70 text-amber-900 dark:border-amber-300/12 dark:bg-amber-950/25 dark:text-amber-100",
  };
  return {
    title: "Some sources are unavailable",
    description: "Ocean State will avoid presenting missing sources as current observations.",
    Icon: TriangleAlert,
    dot: "bg-rose-500",
    iconBackground: "bg-rose-100 dark:bg-rose-950/45",
    iconColor: "text-rose-700 dark:text-rose-200",
    panel: "border-rose-700/12 bg-rose-50/70 text-rose-900 dark:border-rose-300/12 dark:bg-rose-950/25 dark:text-rose-100",
  };
}

function formatAge(minutes: number | null) {
  if (minutes === null) return "No time";
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / (24 * 60))}d ago`;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Pacific/Honolulu",
  }).format(new Date(value));
}
