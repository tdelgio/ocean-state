import Link from "next/link";
import type { ElementType } from "react";
import {
  ArrowUp,
  AlertTriangle,
  CloudRain,
  Compass,
  ExternalLink,
  Navigation,
  Ship,
  Waves,
} from "lucide-react";

import { LiveCamsSection } from "@/components/live-cams/LiveCamsSection";
import { RunSourcePopover } from "@/components/ocean/run-source-popover";
import type {
  ForecastWindow,
  HarborWindObservation,
  MarineForecastDay,
  OceanConditionSnapshot,
  ShoreOceanObservations,
} from "@/lib/ocean";

type ObservationMode = "shores" | "channels" | "harbors";
type Activity = ObservationMode | "downwind" | "fishing";
type Zone = "windward" | "leeward";
type Shore = "north" | "south" | "west";
type Channel = "pailolo" | "kaiwi" | "alenuihaha" | "offshore-waters";
type InterIslandChannel = Exclude<Channel, "offshore-waters">;
type Harbor = "kahului-harbor" | "maalaea-harbor" | "lahaina-harbor";
type WindTone = "light" | "clean" | "medium" | "strong" | "wild";
type SourceLike = {
  source: string;
  status: string;
  stationId?: string;
  sourceUrl?: string;
  freshnessMinutes?: number;
  observedAt?: string;
  fetchedAt?: string;
};

type VesselActivity = {
  vesselName: string;
  arrivalTime?: string | null;
  departureTime?: string | null;
  status: "arriving" | "departing" | "docked" | "scheduled";
  harborName: string;
};

const HAWAII_PORTCALL_URL = "https://hawaii.portcall.com/";

type ChannelConfig = {
  id: Channel;
  name: string;
  shortLabel: string;
  detail: string;
};

const channelConfigs: ChannelConfig[] = [
  { id: "pailolo", name: "Pailolo Channel", shortLabel: "Pailolo", detail: "Maui -> Molokai" },
  { id: "kaiwi", name: "Kaiwi Channel", shortLabel: "Kaiwi", detail: "Molokai -> Oahu" },
  { id: "alenuihaha", name: "Alenuihaha Channel", shortLabel: "Alenuihaha", detail: "Maui -> Hawai'i" },
  { id: "offshore-waters", name: "Offshore Waters", shortLabel: "Offshore Waters", detail: "Open-ocean validation" },
];

const interIslandChannelConfigs = channelConfigs.filter((channel) => channel.id !== "offshore-waters");

const harborTabs: Array<{ id: Harbor; label: string }> = [
  { id: "kahului-harbor", label: "Kahului" },
  { id: "maalaea-harbor", label: "Maalaea" },
  { id: "lahaina-harbor", label: "Lahaina" },
];

export function ActivityForecastPage({
  activity,
  selectedShore = "north",
  selectedChannel = "pailolo",
  selectedHarbor = "kahului-harbor",
  snapshot,
}: {
  activity: Activity;
  selectedShore?: Shore;
  selectedChannel?: Channel;
  selectedHarbor?: Harbor;
  snapshot: OceanConditionSnapshot;
}) {
  const mode = normalizeMode(activity);
  const shores: Shore[] = ["north", "south", "west"];
  const activeShore = getShoreConfig(selectedShore);
  const activeShoreOcean = getShoreOcean(snapshot, selectedShore);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {mode === "shores" ? (
        <div className="flex w-full max-w-full justify-evenly gap-1.5 overflow-x-auto">
          {shores.map((shore) => (
            <ShoreChip
              key={shore}
              shore={shore}
              active={shore === selectedShore}
              href={`/shores?shore=${shore}`}
            />
          ))}
        </div>
      ) : null}
      <section className="ocean-card rounded-[1.5rem] border p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4f626a]">
              {getModeKicker(mode, activeShore)}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal text-[#102b3a]">
              {getModeTitle(mode, activeShore)}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f7078]">
              {getModeSubtitle(mode, activeShore)}
            </p>
          </div>
        </div>
        {mode === "shores" ? (
          <ShoresMode
            zoneWind={windObservationToDisplayWithFallback(activeShoreOcean.wind, getZoneWindFallback(activeShore.zone))}
            shoreOcean={activeShoreOcean}
            snapshot={snapshot}
          />
        ) : mode === "channels" ? (
          <ChannelsMode
            selectedChannel={selectedChannel}
            snapshot={snapshot}
          />
        ) : (
          <HarborsMode selectedHarbor={selectedHarbor} snapshot={snapshot} />
        )}
      </section>
    </div>
  );
}

export function HomeForecastOverview({
  snapshot,
  selectedShore = "north",
}: {
  snapshot: OceanConditionSnapshot;
  selectedShore?: Shore;
}) {
  const shores: Shore[] = ["north", "south", "west"];
  const shore = getShoreConfig(selectedShore);
  const shoreOcean = getShoreOcean(snapshot, selectedShore);
  const current = snapshot.shoreCurrents[selectedShore];
  const hasCurrent = current.speedKt !== null;
  const wind = windObservationToDisplayWithFallback(shoreOcean.wind, getZoneWindFallback(shore.zone));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7">
      <div className="flex w-full max-w-full justify-evenly gap-1.5 overflow-x-auto">
        {shores.map((item) => (
          <ShoreChip
            key={item}
            shore={item}
            active={item === selectedShore}
            href={`/home?shore=${item}`}
          />
        ))}
      </div>

      {selectedShore === "north" || selectedShore === "south" ? (
        <RunWindCard
          shore={selectedShore}
          points={
            selectedShore === "north"
              ? buildMalikoRunPoints(snapshot)
              : buildRunWindPoints(selectedShore, shoreOcean, snapshot)
          }
        />
      ) : null}

      <section className="hero-ocean ocean-card overflow-hidden rounded-[1.5rem] border p-4 sm:p-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4f626a]">
              {shore.secondary}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-[#102b3a]">
              {shore.label}
            </h1>
            <p className="mt-1 text-sm font-semibold uppercase tracking-[0.12em] text-[#5f7078]">
              Live Ocean
            </p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <LiveWindCard wind={wind} source={shoreOcean.wind.source} />
          <LiveSeaInlineCard shoreOcean={shoreOcean} />
        </div>
        <div className={`mt-4 grid gap-4 ${hasCurrent ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
          <TideCard tide={snapshot.shoreTides[selectedShore]} />
          {hasCurrent ? <CurrentCard current={current} /> : null}
          <RainRiskCard windows={snapshot.shoreForecastWindows[selectedShore]} />
        </div>
      </section>

      <LiveCamsSection />
    </div>
  );
}

export function ExtendedForecastOverview({
  snapshot,
  selectedZone = "windward",
}: {
  snapshot: OceanConditionSnapshot;
  selectedZone?: Zone;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <section className="ocean-card rounded-[1.5rem] border p-4 sm:p-5">
        <h1 className="text-3xl font-semibold uppercase tracking-[0.04em] text-[#102b3a]">
          5 Day Forecast
        </h1>
        <div className="mt-4">
          <SegmentedTabs
            items={[
              { id: "windward", label: "Windward", href: "/forecast?zone=windward" },
              { id: "leeward", label: "Leeward", href: "/forecast?zone=leeward" },
            ]}
            activeId={selectedZone}
          />
        </div>
        <div className="mt-5">
          <ModelTimeline snapshot={snapshot} zone={selectedZone} />
        </div>
      </section>
    </div>
  );
}

function ShoresMode({
  zoneWind,
  shoreOcean,
  snapshot,
}: {
  zoneWind: WindDisplay;
  shoreOcean: ShoreOceanObservations;
  snapshot: OceanConditionSnapshot;
}) {
  const bumpEnergy = formatSeaEnergy(shoreOcean.bumpEnergy);
  const groundswell = formatSeaEnergy(shoreOcean.groundswell);
  const energyDirection = shoreOcean.bumpEnergy.directionCardinal ?? shoreOcean.swell.directionCardinal ?? "direction unavailable";
  const shoreForecastWindows = snapshot.shoreForecastWindows[shoreOcean.shoreId];
  const liveDataItemCandidates: Array<LiveDataListItem | null> = [
    shoreOcean.bumpEnergy.heightFt !== null
      ? {
          icon: Waves,
          label: "Wind Bumps",
          tone: "swell",
          primary: bumpEnergy.height,
          secondary: `${bumpEnergy.period} · ${bumpEnergy.direction} · short-period wind swell`,
          source: shoreOcean.bumpEnergy.source,
        }
      : null,
    shoreOcean.groundswell.heightFt !== null
      ? {
          icon: Waves,
          label: "Groundswell",
          tone: "swell",
          primary: groundswell.height,
          secondary: `${groundswell.period} · ${groundswell.direction} · long-period`,
          source: shoreOcean.groundswell.source,
        }
      : null,
    {
      icon: Navigation,
      label: "Swell Direction",
      tone: "swell",
      primary: getSwellAlignment(zoneWind, energyDirection),
      secondary: `${energyDirection} sea energy vs ${zoneWind.direction} wind`,
      source: shoreOcean.swell.source,
    },
    {
      icon: CloudRain,
      label: "Rain bands",
      tone: "rain",
      primary: formatRain(shoreForecastWindows),
      secondary: getRainImpact(shoreForecastWindows),
      source: shoreForecastWindows[0]?.source,
    },
    {
      icon: Compass,
      label: "Current",
      tone: "current",
      primary: formatCurrent(snapshot),
      secondary: `${snapshot.current.trend} · ${getCurrentSourceLabel(snapshot.current.source)}`,
      source: snapshot.current.source,
    },
  ];
  const liveDataItems = liveDataItemCandidates.filter((item): item is LiveDataListItem => item !== null);

  return (
    <div className="mt-5 space-y-5">
      <div>
        {shoreOcean.shoreId === "north" || shoreOcean.shoreId === "south" ? (
          <RunWindCard
            shore={shoreOcean.shoreId}
            points={buildRunWindPoints(shoreOcean.shoreId, shoreOcean, snapshot)}
          />
        ) : null}
        <LiveWindBlock label="Wind now" wind={zoneWind} source={shoreOcean.wind.source} />
        <LiveDataList
          className="mt-4"
          items={liveDataItems}
        />
      </div>
    </div>
  );
}

function ChannelsMode({
  selectedChannel,
  snapshot,
}: {
  selectedChannel: Channel;
  snapshot: OceanConditionSnapshot;
}) {
  return (
    <div className="mt-6 space-y-5">
      <div className="space-y-2">
        <SegmentedTabs
          items={interIslandChannelConfigs.map((channel) => ({
            id: channel.id,
            label: channel.shortLabel,
            href: `/channels?channel=${channel.id}`,
          }))}
          activeId={selectedChannel}
        />
        <Link
          href="/channels?channel=offshore-waters"
          prefetch={false}
          className={`inline-flex w-fit max-w-full rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
            selectedChannel === "offshore-waters"
              ? "border-[#17242c] bg-[#17242c] text-white shadow-[0_8px_18px_rgba(7,35,45,0.12)] dark:border-white dark:bg-white dark:text-[#071723]"
              : "border-[#d8dedf] bg-[#f8fcfd] text-[#526a73] hover:bg-white hover:text-[#17242c] dark:border-white/12 dark:bg-[#0b2230] dark:text-[#b7cbd3] dark:hover:bg-[#102a3a] dark:hover:text-white"
          }`}
        >
          Offshore Waters
        </Link>
      </div>
      {selectedChannel === "offshore-waters" ? (
        <OffshoreWatersSection snapshot={snapshot} />
      ) : (
        <ChannelWindsSection selectedChannel={selectedChannel} snapshot={snapshot} />
      )}
    </div>
  );
}

function HarborsMode({
  selectedHarbor,
  snapshot,
}: {
  selectedHarbor: Harbor;
  snapshot: OceanConditionSnapshot;
}) {
  return (
    <div className="mt-6 space-y-5">
      <SegmentedTabs
        items={harborTabs.map((harbor) => ({
          id: harbor.id,
          label: harbor.label,
          href: `/harbors?harbor=${harbor.id}`,
        }))}
        activeId={selectedHarbor}
      />
      <HarborWindsSection selectedHarbor={selectedHarbor} harbors={snapshot.harborWinds} snapshot={snapshot} />
    </div>
  );
}

function ModelTimeline({
  snapshot,
  zone,
}: {
  snapshot: OceanConditionSnapshot;
  zone: Zone;
}) {
  const shoreOcean = getShoreOcean(snapshot, zone === "windward" ? "north" : "south");
  const days = buildFiveDayForecast(
    snapshot.shoreForecastWindows[shoreOcean.shoreId],
    zone,
    snapshot.marineForecastDays[zone],
  );

  return (
    <section className="overflow-hidden rounded-[1.25rem] border border-[#d8dedf] bg-[#fbfaf6] p-2 shadow-[0_14px_32px_rgba(8,74,92,0.07)] dark:border-white/14 dark:bg-[#0b2230] sm:p-3">
      <div className="grid gap-3 lg:grid-cols-5">
        {days.map((day) => {
          const wind = parseWind(day.wind);
          const tone = getWindToneFromText(wind.speed, wind.gust);
          return (
            <article
              key={day.day}
              className="rounded-2xl border border-[#d8dedf] bg-white p-3 shadow-[0_8px_20px_rgba(7,35,45,0.04)] dark:border-white/12 dark:bg-[#102a3a]"
            >
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between">
                <h3 className="text-base font-semibold uppercase tracking-[0.04em] text-[#102b3a]">{day.day}</h3>
              </div>
              <div className="mt-3 space-y-2">
                <ForecastWindCard wind={wind} tone={tone} />
                <ForecastEnergyCard groundswell={day.groundswell} />
                <ForecastRainCard rain={day.rain} detail={day.read} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ForecastWindCard({ wind, tone }: { wind: ReturnType<typeof parseWind>; tone: WindTone }) {
  const classes = getWindToneClasses(tone);
  return (
    <div className="rounded-xl border border-[#094c60]/10 bg-[#fbfaf6] p-3 dark:border-white/12 dark:bg-[#071d2a]">
      <div className="flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#6b7d84]">
        <Navigation className="size-3.5" />
        Wind
      </div>
      <div className="mt-2 flex items-center gap-2">
        <WindArrow degrees={cardinalToDegrees(wind.direction)} className={classes.text} />
        <div className="min-w-0">
          <p className={`weather-data text-2xl leading-none ${classes.text}`}>{wind.direction}</p>
          <p className={`weather-data mt-1 text-base leading-tight ${classes.speedText}`}>{wind.speed}</p>
          {wind.gust !== "-" ? (
            <p className={`mt-1 w-fit ${classes.badge} weather-data`}>gust {wind.gust}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ForecastEnergyCard({
  groundswell,
}: {
  groundswell: ReturnType<typeof formatMarineForecastEnergy>;
}) {
  const groundswellValue = groundswell.height === "No data" ? "none" : groundswell.height;
  const groundswellDetail = groundswell.height === "No data" ? "no published long-period swell" : groundswell.meta;
  return (
    <div className="rounded-xl border border-blue-900/12 bg-[#f4f8f9] p-3 dark:border-white/12 dark:bg-[#071d2a]">
      <div>
        <div>
          <div className="flex items-center gap-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-[#61747c]">
            <Waves className="size-3.5" />
            Ground Swell
          </div>
          <p className="weather-data mt-1 text-xl leading-none text-[#102b3a]">{groundswellValue}</p>
          <p className="mt-1 text-xs font-semibold text-[#61747c]">{groundswellDetail}</p>
        </div>
      </div>
    </div>
  );
}

function ForecastRainCard({ rain, detail }: { rain: string; detail: string }) {
  return (
    <div className="rounded-xl border border-teal-900/12 bg-[#f4faf8] p-3 dark:border-white/12 dark:bg-[#071d2a]">
      <div className="flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#6b7d84]">
        <CloudRain className="size-3.5" />
        Rain
      </div>
      <p className="weather-data mt-2 text-xl leading-none text-[#102b3a]">{rain}</p>
      <p className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-[#61747c]">{detail}</p>
    </div>
  );
}

type LiveDataListItem = {
  icon: ElementType;
  label: string;
  tone: "wind" | "swell" | "tide" | "current" | "rain" | "alert";
  primary: string;
  secondary: string;
  meta?: string;
  source?: SourceLike;
};

function LiveDataList({
  items,
  className,
}: {
  items: LiveDataListItem[];
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-[1.35rem] border border-[#094c60]/14 bg-white shadow-[0_14px_32px_rgba(8,74,92,0.08)] dark:border-white/12 dark:bg-[#091d2b] ${className ?? ""}`}>
      {items.map((item) => (
        <LiveDataRow key={`${item.label}-${item.primary}`} item={item} />
      ))}
    </div>
  );
}

function LiveDataRow({ item }: { item: LiveDataListItem }) {
  const Icon = item.icon;
  const toneClasses = {
    wind: "bg-[#fbfaf6] text-[#17242c]",
    swell: "bg-[#f4f8f9] text-[#17242c]",
    tide: "bg-[#f7f7fb] text-[#17242c]",
    current: "bg-[#f4f8f9] text-[#17242c]",
    rain: "bg-[#f4faf8] text-[#17242c]",
    alert: "bg-[#fff8ef] text-[#17242c]",
  };

  return (
    <div className={`border-b border-[#094c60]/10 px-4 py-4 last:border-b-0 ${toneClasses[item.tone]}`}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <Icon className="size-5 shrink-0 opacity-80" />
          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] opacity-70">
              {item.label}
            </p>
            <div className="mt-1 flex flex-col items-start gap-1">
              <p className="weather-data text-3xl leading-none text-[#c54a24]">{item.primary}</p>
              <p className="text-sm font-semibold opacity-80">{item.secondary}</p>
              {item.meta ? (
                <p className="weather-data rounded-full border border-amber-700/20 bg-amber-50 px-2 py-0.5 text-xs uppercase tracking-[0.08em] text-amber-900 dark:border-orange-300/45 dark:bg-[#431c0b] dark:text-[#fed7aa]">
                  {item.meta}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {item.source ? <SourceFreshnessBadge source={item.source} compact /> : null}
      </div>
    </div>
  );
}

function SegmentedTabs({
  items,
  activeId,
}: {
  items: Array<{ id: string; label: string; href: string }>;
  activeId: string;
}) {
  return (
    <div className="inline-flex w-fit max-w-full gap-2 overflow-x-auto rounded-2xl border border-[#d8dedf] bg-[#f8fcfd] p-1 dark:border-white/12 dark:bg-[#0b2230]">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          prefetch={false}
          className={`shrink-0 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
            item.id === activeId
              ? "bg-[#17242c] text-white shadow-[0_8px_18px_rgba(7,35,45,0.12)] dark:bg-white dark:text-[#071723]"
              : "text-[#526a73] hover:bg-white hover:text-[#17242c] dark:text-[#b7cbd3] dark:hover:bg-[#102a3a] dark:hover:text-white"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

type RunWindPoint = {
  label: string;
  wind: WindDisplay;
  source: SourceLike;
};

function RunWindCard({ shore, points }: { shore: Shore; points: RunWindPoint[] }) {
  return (
    <section className="mb-4 max-w-full rounded-2xl border border-[#094c60]/14 bg-white p-3 shadow-[0_10px_24px_rgba(7,35,45,0.06)] dark:border-white/12 dark:bg-[#091d2b]">
      <h3 className="text-xl font-semibold text-[#102b3a] dark:text-[#f4fbff]">{shore === "north" ? "North Shore Run" : "Maalaea / Kihei Run"}</h3>
      <div className="mt-2 overflow-hidden rounded-xl border border-[#094c60]/14 bg-[#fbfaf6] dark:border-white/12 dark:bg-[#071d2a]">
        <div
          className="grid items-stretch"
          style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
        >
          {points.map((point, index) => {
            const tone = getWindToneClasses(getWindToneFromText(point.wind.speed, point.wind.gust));
            return (
              <div
                key={point.label}
                className={`min-w-0 px-1.5 py-3 sm:px-2 ${index > 0 ? "border-l border-[#094c60]/16 dark:border-white/16" : ""}`}
              >
                <div className="mx-auto grid w-fit min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-x-1.5">
                  <div className="col-start-2 flex min-h-7 items-center gap-1">
                    <p className="text-[0.68rem] font-semibold uppercase leading-4 tracking-[0.06em] text-[#30444c] dark:text-[#d8e7ec] sm:text-[0.74rem] sm:tracking-[0.08em]">
                      {point.label}
                    </p>
                    <RunSourceDisclosure source={point.source} />
                  </div>
                  <WindArrow degrees={point.wind.degrees} compact className="text-[#17242c] dark:text-[#e8f4f7]" />
                  <div className="min-w-0">
                    <p className="weather-data whitespace-nowrap text-xl leading-none text-[#17242c] dark:text-[#f4fbff]">
                      {point.wind.direction}
                    </p>
                    <p className={`weather-data mt-0.5 whitespace-nowrap text-base leading-none ${tone.speedText}`}>
                      {point.wind.speed}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RunSourceDisclosure({ source }: { source: SourceLike }) {
  const sourceName = getSourceDisplayName(source);
  const updated =
    source.freshnessMinutes !== undefined
      ? `${source.freshnessMinutes} min ago`
      : source.observedAt
        ? formatTime(source.observedAt)
        : "update unavailable";

  return <RunSourcePopover sourceName={sourceName} updated={updated} sourceType={source.source} sourceUrl={source.sourceUrl} />;
}

function ChannelWindsSection({
  selectedChannel,
  snapshot,
}: {
  selectedChannel: InterIslandChannel;
  snapshot: OceanConditionSnapshot;
}) {
  const channel = getChannelConfig(selectedChannel);
  const forecast = snapshot.channelForecasts[selectedChannel];
  const wind = windObservationToDisplay(forecast.wind);

  return (
    <section>
      <ChannelWindCard
        name={channel.name}
        detail={channel.detail}
        wind={wind}
        source={forecast.wind.source}
        bumpEnergy={forecast.bumpEnergy}
        rainSummary={forecast.rainSummary}
        snapshot={snapshot}
      />
    </section>
  );
}

function OffshoreWatersSection({ snapshot }: { snapshot: OceanConditionSnapshot }) {
  const stations = Object.values(snapshot.offshoreObservations);
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#61747c]">Offshore Waters</p>
        <h3 className="mt-1 text-xl font-semibold text-[#102b3a]">Open-ocean validation</h3>
      </div>
      <div className="flex snap-x gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-2 lg:overflow-visible">
        {stations.map((buoy) => (
          <div key={buoy.id} className="w-[min(88vw,24rem)] shrink-0 snap-start lg:w-auto">
            <OffshoreBuoyCard buoy={buoy} />
          </div>
        ))}
      </div>
    </section>
  );
}

function OffshoreBuoyCard({ buoy }: { buoy: OceanConditionSnapshot["offshoreObservations"][keyof OceanConditionSnapshot["offshoreObservations"]] }) {
  const groundswell = formatSeaEnergy(buoy.groundswell);
  const wind = windObservationToDisplayWithFallback(buoy.wind, { direction: "ESE", speed: "model estimate", gust: "-", degrees: 113 });
  const insight = getOffshoreChannelInsight(buoy);

  return (
    <article className="rounded-2xl border border-[#094c60]/12 bg-[#f7fbfb] p-4 shadow-[0_10px_24px_rgba(7,35,45,0.05)] dark:border-white/12 dark:bg-[#091d2b]">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-[#102b3a]">{buoy.displayName}</h4>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#61747c]">{buoy.purpose}</p>
        </div>
        <SourceFreshnessBadge source={buoy.swell.source} compact />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ConditionMetric icon={Waves} label="Ground Swell" value={groundswell.height} detail={groundswell.meta} />
        <ConditionMetric icon={Navigation} label="Wind" value={`${wind.direction} ${wind.speed}`} detail={`gust ${wind.gust}`} source={buoy.wind.source} />
      </div>
      {insight ? <p className="mt-3 text-sm font-semibold text-[#536b73]">{insight}</p> : null}
    </article>
  );
}

function ChannelWindCard({
  name,
  detail,
  wind,
  source,
  bumpEnergy,
  rainSummary,
  snapshot,
}: {
  name: string;
  detail: string;
  wind: WindDisplay;
  source: SourceLike;
  bumpEnergy: MarineForecastDay["bumpEnergy"];
  rainSummary: string | null;
  snapshot: OceanConditionSnapshot;
}) {
  const tone = getWindToneFromText(wind.speed, wind.gust);
  const classes = getWindToneClasses(tone);
  const formattedBumpEnergy = formatMarineForecastEnergy(bumpEnergy);
  const hasCurrent = snapshot.current.speedKt !== null;
  return (
    <article className="ocean-card rounded-2xl border p-4">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
        <div>
          <p className="text-2xl font-semibold uppercase leading-none tracking-[0.04em] text-[#102b3a]">{getChannelShortName(name)}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#5f7078]">
            {detail}
          </p>
        </div>
      </div>
      <div className={`mt-4 rounded-2xl border p-4 ${classes.card}`}>
        <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CategoryPill label="Wind" tone="wind" />
          <SourceFreshnessBadge source={source} compact />
        </div>
        <div className="flex items-center gap-4">
        <WindArrow degrees={wind.degrees} large className={classes.text} />
        <div>
          <p className={`weather-data text-5xl leading-none ${classes.text}`}>
            {wind.direction}
          </p>
          <p className={`weather-data mt-2 text-2xl ${classes.speedText}`}>
            {wind.speed}
          </p>
          <p className={`mt-2 ${classes.badge} weather-data`}>gust {wind.gust}</p>
        </div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <ConditionMetric icon={Waves} label="Bump Energy" value={formattedBumpEnergy.height} detail={formattedBumpEnergy.meta} source={source} />
        <ConditionMetric
          icon={Compass}
          label={hasCurrent ? "Current / Tide" : "Tide"}
          value={hasCurrent ? formatCurrent(snapshot) : formatTideTrend(snapshot.tide.trend)}
          detail={hasCurrent ? `${formatTideTrend(snapshot.tide.trend)} · ${formatTideHeight(snapshot.tide)}` : formatNextTide(snapshot.tide)}
          source={hasCurrent ? snapshot.current.source : snapshot.tide.source}
        />
        <ConditionMetric icon={CloudRain} label="Wind Squalls" value={rainSummary ?? "Forecast available"} detail="NOAA channel forecast" source={source} />
      </div>
      <p className="mt-3 text-sm font-semibold leading-5 text-[#536b73]">
        {getChannelContext(wind, formattedBumpEnergy.height)}
      </p>
    </article>
  );
}

function ConditionMetric({
  icon: Icon,
  label,
  value,
  detail,
  source,
}: {
  icon?: ElementType;
  label: string;
  value: string;
  detail: string;
  source?: SourceLike;
}) {
  return (
    <div className="rounded-xl border border-[#094c60]/10 bg-white/55 px-3 py-2">
      <div className="flex flex-col items-start gap-2">
        <p className="flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#536b73]">
          {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
          {label}
        </p>
        {source ? <SourceFreshnessBadge source={source} compact /> : null}
      </div>
      <p className="weather-data mt-1 text-lg leading-none text-[#102b3a]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#536b73]">{detail}</p>
    </div>
  );
}

function HarborVesselActivity({ harborName, vessels = [] }: { harborName: string; vessels?: VesselActivity[] }) {
  const harborScheduleUrl = getHarborScheduleUrl(harborName);
  return (
    <div className="mt-3 rounded-xl border border-[#094c60]/10 bg-white/65 px-3 py-3 text-[#102b3a] dark:border-white/12 dark:bg-[#102a3a] dark:text-[#e9f8fb]">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#536b73] dark:text-[#b7cbd3]">
          <Ship className="size-3.5" />
          Vessel activity
        </p>
        <span className="rounded-full border border-[#cbd9dd] px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#536b73] dark:border-white/14 dark:text-[#c9d9df]">
          {harborName}
        </span>
      </div>
      {vessels.length ? (
        <ul className="mt-2 space-y-1.5">
          {vessels.map((vessel) => (
            <li key={`${vessel.vesselName}-${vessel.status}`} className="text-sm font-semibold">
              {vessel.vesselName} · {formatVesselTimes(vessel)}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2">
          <p className="text-sm font-semibold">Live schedule available from Hawaii PortCall</p>
          <a
            href={harborScheduleUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#094c60]/14 bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#0d5968] transition hover:bg-white dark:border-white/14 dark:bg-[#091d2b] dark:text-[#9debf9] dark:hover:bg-[#163747]"
          >
            Open live vessel schedule
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}

function HarborMarineAlerts({ alerts }: { alerts: OceanConditionSnapshot["alerts"] }) {
  if (!alerts.length) {
    return (
      <div className="mt-3 rounded-xl border border-[#094c60]/10 bg-white/50 px-3 py-2 text-xs font-semibold text-[#536b73] dark:border-white/12 dark:bg-[#102a3a] dark:text-[#b7cbd3]">
        No active marine alerts
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-orange-700/25 bg-orange-50 px-3 py-3 text-[#7c2d12] dark:border-orange-300/22 dark:bg-orange-950/25 dark:text-orange-100">
      <p className="flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em]">
        <AlertTriangle className="size-3.5" />
        Marine alerts
      </p>
      <ul className="mt-2 space-y-1">
        {alerts.slice(0, 2).map((alert) => (
          <li key={alert.id} className="text-sm font-semibold leading-5">
            {alert.event || alert.headline}
          </li>
        ))}
      </ul>
    </div>
  );
}

function HarborWindsSection({
  selectedHarbor,
  harbors,
  snapshot,
}: {
  selectedHarbor: Harbor;
  harbors: HarborWindObservation[];
  snapshot: OceanConditionSnapshot;
}) {
  const selected =
    harbors.find((harbor) => harbor.id === selectedHarbor) ??
    harbors.find((harbor) => harbor.id === "kahului-harbor") ??
    harbors[0];

  return (
    <section>
      {selected ? <HarborWindCard harbor={selected} snapshot={snapshot} /> : null}
    </section>
  );
}

function HarborWindCard({
  harbor,
  snapshot,
}: {
  harbor: HarborWindObservation;
  snapshot: OceanConditionSnapshot;
}) {
  const wind = windObservationToDisplay(harbor.observation);
  const tone = getWindToneFromText(wind.speed, wind.gust);
  const classes = getWindToneClasses(tone);
  const bumpEnergy = formatSeaEnergy(snapshot.bumpEnergy);
  const vessels = getHarborVesselSchedule();
  const harborShore = getHarborShore(harbor);
  const tide = snapshot.shoreTides[harborShore];
  const forecastWindows = snapshot.shoreForecastWindows[harborShore];
  return (
    <article className="ocean-card rounded-2xl border p-4">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
        <div>
          <p className="text-lg font-semibold leading-tight text-[#102b3a]">{harbor.name}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#5f7078]">{harbor.side} side</p>
        </div>
        <SourceFreshnessBadge source={harbor.observation.source} compact />
      </div>
      <div className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 ${classes.card}`}>
        <div className="flex items-center gap-3">
          <WindArrow degrees={wind.degrees} className={classes.text} />
          <div>
            <p className={`weather-data text-4xl leading-none ${classes.text}`}>{wind.direction}</p>
            <p className={`weather-data mt-1 text-xl ${classes.speedText}`}>{wind.speed}</p>
            <p className={`mt-2 ${classes.badge} weather-data`}>
              gust {wind.gust}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <ConditionMetric icon={Navigation} label="Launch / Entry" value={bumpEnergy.height} detail={`${bumpEnergy.period} · ${bumpEnergy.direction} · swell direction for entry`} />
        <ConditionMetric icon={Waves} label="Tide" value={formatTideTrend(tide.trend)} detail={`${formatNextTide(tide)} · ${tide.stationName}`} source={tide.source} />
        <ConditionMetric icon={CloudRain} label="Visibility" value={formatRain(forecastWindows)} detail={getRainImpact(forecastWindows)} source={forecastWindows[0]?.source} />
      </div>
      <HarborMarineAlerts alerts={snapshot.alerts} />
      <HarborVesselActivity harborName={harbor.name} vessels={vessels} />
      <p className="mt-3 text-sm font-semibold leading-5 text-[#536b73]">{getHarborContext(harbor, wind)}</p>
    </article>
  );
}

function getHarborShore(harbor: HarborWindObservation): Shore {
  if (harbor.id === "maalaea-harbor") return "south";
  if (harbor.id === "lahaina-harbor" || harbor.id === "mala-ramp") return "west";
  return "north";
}

function getHarborVesselSchedule(): VesselActivity[] {
  return [];
}

function getHarborScheduleUrl(harborName: string) {
  const portName = harborName.replace(" Harbor", "").replace("Mala Ramp", "Lahaina");
  return `${HAWAII_PORTCALL_URL}#!?port=${encodeURIComponent(portName)}`;
}

function formatVesselTimes(vessel: VesselActivity) {
  const arrival = vessel.arrivalTime ? `Arrives ${formatTime(vessel.arrivalTime)}` : null;
  const departure = vessel.departureTime ? `Departs ${formatTime(vessel.departureTime)}` : null;
  return [arrival, departure, vessel.status].filter(Boolean).join(" · ");
}

function windObservationToDisplay(wind: HarborWindObservation["observation"]): WindDisplay {
  return {
    direction: wind.directionCardinal ?? "DIR -",
    speed: wind.speedKt !== null ? `${wind.speedKt} kt` : "wind missing",
    gust: wind.gustKt !== null ? `${wind.gustKt} kt` : "-",
    degrees: wind.directionDeg ?? 90,
    isSample: wind.source.status !== "live",
  };
}

function LiveWindCard({ wind, source }: { wind: WindDisplay; source: SourceLike }) {
  const tone = getWindToneFromText(wind.speed, wind.gust);
  const classes = getWindToneClasses(tone);
  return (
    <div className="ocean-card rounded-[1.35rem] border p-4 shadow-[0_16px_38px_rgba(8,74,92,0.08)]">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
        <div className="flex items-center gap-2">
          <Navigation className="size-5 text-[#17242c]" />
          <CategoryPill label="Wind" tone="wind" />
        </div>
        <SourceFreshnessBadge source={source} compact />
      </div>
      <div className={`mt-4 flex items-center gap-4 rounded-2xl border p-5 ${classes.card}`}>
        {wind.speed === "No live wind" ? null : <WindArrow degrees={wind.degrees} large className={classes.text} />}
        <div>
          <p className={`weather-data text-5xl leading-none tracking-normal ${classes.text}`}>
            {wind.direction}
          </p>
          <p className={`weather-data mt-2 text-2xl ${classes.speedText}`}>
            {wind.speed}
          </p>
          <p className={`mt-2 ${classes.badge} weather-data`}>
            gust {wind.gust}
          </p>
        </div>
      </div>
      {wind.speed === "No live wind" ? null : (
        <p className={`mt-2 text-xs font-medium ${classes.muted}`}>
          Wind arrow shows flow coming from {wind.direction}.
        </p>
      )}
    </div>
  );
}

function LiveSeaInlineCard({
  shoreOcean,
}: {
  shoreOcean: ShoreOceanObservations;
}) {
  const bumpEnergy = formatSeaEnergy(shoreOcean.bumpEnergy);
  const groundswell = formatSeaEnergy(shoreOcean.groundswell);
  const hasBumpEnergy = shoreOcean.bumpEnergy.heightFt !== null;
  const hasGroundswell = shoreOcean.groundswell.heightFt !== null;
  if (!hasBumpEnergy && !hasGroundswell) return null;

  return (
    <section className="rounded-[1.35rem] border border-blue-800/18 bg-[#dbeafe] p-5 shadow-[0_12px_28px_rgba(8,74,92,0.08)] dark:border-blue-200/20 dark:bg-[#0c2940]">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
        <div className="flex items-center gap-2 pt-1">
          <Waves className="size-5 text-blue-700" />
          <CategoryPill label="Sea Energy" tone="swell" />
        </div>
        <SourceFreshnessBadge source={shoreOcean.swell.source} compact />
      </div>
      <div className={`mt-5 grid gap-3 ${hasBumpEnergy && hasGroundswell ? "sm:grid-cols-2" : ""}`}>
        {hasBumpEnergy ? (
        <div className="rounded-2xl border border-blue-900/15 bg-white/70 p-4 dark:border-blue-200/15 dark:bg-[#102f46]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-900/65">
            Wind Bumps
          </p>
          <p className="weather-data mt-2 text-4xl leading-none text-blue-950">
            {bumpEnergy.height}
          </p>
          <p className="weather-data mt-2 text-lg text-blue-950">
            {bumpEnergy.period} · {bumpEnergy.direction}
          </p>
          <p className="mt-2 text-xs font-semibold text-blue-900/65">
            Short-period wind swell
          </p>
        </div>
        ) : null}
        {hasGroundswell ? (
        <div className="rounded-2xl border border-blue-900/12 bg-white/55 p-4 dark:border-blue-200/12 dark:bg-[#102f46]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-900/60">
            Groundswell
          </p>
          <p className="weather-data mt-2 text-3xl leading-none text-blue-950">
            {groundswell.height}
          </p>
          <p className="weather-data mt-2 text-base text-blue-950">
            {groundswell.meta}
          </p>
        </div>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-blue-900/75">
        Wind bumps are open-ocean wind-sea texture, separated from longer-period groundswell.
      </p>
    </section>
  );
}

function CurrentCard({ current }: { current: OceanConditionSnapshot["current"] }) {
  const label = getCurrentCardLabel(current.source);
  return (
    <section className="ocean-card rounded-[1.5rem] border border-blue-800/18 bg-[#dbeafe] p-5 dark:border-blue-200/20 dark:bg-[#0c2940]">
      <div className="flex items-center gap-2">
        <Compass className="size-5 text-blue-700" />
        <CategoryPill label={label} tone="tide" />
        <RunSourceDisclosure source={current.source} />
      </div>
      <p className="weather-data mt-5 text-4xl leading-none text-blue-950">
        {formatCurrentObservation(current)}
      </p>
      <p className="mt-3 text-sm capitalize leading-6 text-blue-900/75">
        {current.trend === "unknown" ? getCurrentSourceLabel(current.source) : `${current.trend} · ${getCurrentSourceLabel(current.source)}`}
      </p>
    </section>
  );
}

function TideCard({ tide }: { tide: OceanConditionSnapshot["tide"] }) {
  const next = getNextTideEvent(tide);
  return (
    <section className="ocean-card rounded-[1.5rem] border border-indigo-800/18 bg-[#e0e7ff] p-5 dark:border-indigo-200/20 dark:bg-[#162542]">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
        <CategoryPill label="Tide" tone="tide" />
        <SourceFreshnessBadge source={tide.source} compact />
      </div>
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-indigo-900/60">
          Tide Trend
        </p>
        <div className="mt-1 flex items-center gap-2">
          <TideTrendIcon trend={tide.trend} />
          <p className="weather-data text-4xl capitalize leading-none text-indigo-950">
            {formatTideTrend(tide.trend)}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-indigo-900/75">
        Current tide {formatTideHeight(tide)}. Next {next?.type ?? "tide"}{" "}
        {next ? `${formatTime(next.time)} · ${next.heightFt} ft` : "not available"}.
      </p>
    </section>
  );
}

function RainRiskCard({ windows }: { windows: ForecastWindow[] }) {
  const rain = formatRain(windows);
  const rainNumber = Number.parseInt(rain, 10);
  const impact =
    Number.isFinite(rainNumber) && rainNumber >= 35
      ? "Showers may disturb wind quality."
      : "Lower rain impact on wind quality.";
  return (
    <section className="ocean-card rounded-[1.5rem] border border-teal-800/18 bg-[#d7f3ee] p-5 dark:border-teal-200/20 dark:bg-[#0f302f]">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
        <div className="flex items-center gap-2">
          <CloudRain className="size-5 text-teal-700" />
          <CategoryPill label="Rain" tone="rain" />
        </div>
        {windows[0]?.source ? (
          <SourceFreshnessBadge source={windows[0].source} compact />
        ) : (
          <StatusPill status="Unavailable" />
        )}
      </div>
      <p className="weather-data mt-5 text-5xl leading-none text-teal-950">
        {rain}
      </p>
      <p className="mt-3 text-sm leading-6 text-teal-900/75">{impact}</p>
    </section>
  );
}

function SourceFreshnessBadge({
  source,
  compact = false,
}: {
  source: SourceLike;
  compact?: boolean;
}) {
  const freshness =
    source.status === "mock"
      ? "model"
      : source.freshnessMinutes !== undefined
      ? `${source.freshnessMinutes} min`
      : source.observedAt
        ? formatTime(source.observedAt)
        : source.fetchedAt
          ? formatTime(source.fetchedAt)
          : "updated";
  const station = getSourceDisplayName(source);
  const isMarineZone = source.stationId?.startsWith("PHZ");
  const statusLabel =
    source.status === "live"
      ? freshness
      : source.source.includes("MFM forecast")
        ? `Forecast · ${freshness}`
      : source.source.includes("Coastal Waters Forecast")
        ? `Forecast · ${freshness}`
      : source.status === "missing" || source.status === "error"
        ? "Data unavailable"
        : source.source.includes("current prediction")
          ? "NOAA prediction"
          : "Model estimate";
  const label = isMarineZone ? `${station} · ${source.source.includes("Forecast") ? statusLabel : source.status === "live" ? "Live" : "Data unavailable"}` : `${station} · ${statusLabel}`;
  const className = `inline-flex w-fit max-w-full items-center gap-1 justify-self-start rounded-full border border-[#cbd9dd]/70 bg-white/55 ${compact ? "px-1.5 py-0.5 text-[0.54rem]" : "px-2.5 py-1 text-[0.68rem]"} font-semibold uppercase tracking-[0.04em] text-[#5f7078] dark:border-white/10 dark:bg-[#102a3a]/70 dark:text-[#a9c0c8]`;
  const content = (
    <>
      <span className={`${compact ? "size-1" : "size-1.5"} rounded-full ${source.status === "live" ? "live-pulse bg-emerald-500 dark:bg-emerald-400" : source.status === "mock" || source.status === "stale" ? "bg-amber-500" : "bg-red-500 dark:bg-red-400"}`} />
      <span className="min-w-0 truncate">
        {label}
      </span>
    </>
  );
  return source.sourceUrl ? (
    <a className={`${className} transition hover:border-[#0d5968]/35 hover:text-[#0d5968]`} href={source.sourceUrl} target="_blank" rel="noreferrer" title={`Open official source: ${station}`}>
      {content}
    </a>
  ) : (
    <span className={className}>{content}</span>
  );
}

function getCompactSourceName(source: string) {
  if (source.includes("NDBC")) return "NDBC";
  if (source.includes("CO-OPS")) return "CO-OPS";
  if (source.includes("NWS")) return "NWS";
  if (source.includes("CWF")) return "CWF";
  return "SRC";
}

function getSourceDisplayName(source: SourceLike) {
  if (source.stationId === "51205") return "Pauwela";
  if (source.stationId === "51213") return "Lanai Offshore";
  if (source.stationId === "51001") return "Open Ocean NW";
  if (source.stationId === "51000") return "Northern Hawaii";
  if (source.stationId === "51002") return "Southwest Hawaii";
  if (source.stationId === "51004") return "Southeast Hawaii";
  if (source.stationId?.toLowerCase() === "51wh0") return "WHOTS Offshore North";
  if (source.stationId === "DD-FAD") return "DD FAD / Opana Point";
  if (source.stationId === "KLIH1") return "Kahului";
  if (source.stationId === "1615680") return "Kahului tide";
  if (source.stationId === "TPT2797") return "Kihei tide";
  if (source.stationId === "TPT2799") return "Lahaina tide";
  if (source.stationId === "PHOG") return "Kahului Airport";
  if (source.stationId === "PHZ120") return "Pailolo";
  if (source.stationId === "PHZ116") return "Kaiwi";
  if (source.stationId === "PHZ121") return "Alenuihaha";
  if (source.stationId === "HAI1121_28") return "Alalakeiki Channel";
  if (source.stationId === "HAI1119_29") return "Auau Channel";
  if (source.stationId === "pacioos-roms-maliko") return "PacIOOS ROMS · Maliko";
  if (source.stationId) return source.stationId;
  if (source.source.toLowerCase().includes("mock noaa co-ops currents")) return "Current";
  return getCompactSourceName(source.source);
}

function getCurrentSourceLabel(source: SourceLike) {
  if (source.status === "live") return getSourceDisplayName(source);
  if (source.source.includes("PacIOOS")) return "PacIOOS ROMS forecast";
  if (source.source.includes("current prediction") && source.status === "stale") {
    return `${getSourceDisplayName(source)} · NOAA prediction`;
  }
  if (source.status === "missing" || source.status === "error") return "No live current data";
  return "Model estimate";
}

function getCurrentCardLabel(source: SourceLike) {
  if (source.source.includes("PacIOOS")) return "Surface Current";
  if (source.source.includes("current prediction")) return "Tide Flow Estimate";
  return "Current";
}

function CategoryPill({
  label,
  tone,
}: {
  label: string;
  tone: "wind" | "gust" | "swell" | "tide" | "rain" | "alert";
}) {
  const classes = {
    wind: "border-[#d8dedf] bg-[#fbfaf6] text-[#17242c]",
    gust: "border-amber-800/25 bg-[#fde68a] text-[#78350f] dark:border-orange-300/45 dark:bg-[#431c0b] dark:text-[#fed7aa]",
    swell: "border-blue-800/20 bg-[#bfdbfe] text-[#0f2f5f]",
    tide: "border-indigo-800/20 bg-[#c7d2fe] text-[#263268]",
    rain: "border-teal-800/20 bg-[#bfeee5] text-[#0a463f]",
    alert: "border-orange-800/25 bg-[#fed7aa] text-[#7c2d12]",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em] ${classes[tone]}`}
    >
      {label}
    </span>
  );
}

function LiveWindBlock({ label, wind, source }: { label: string; wind: WindDisplay; source: SourceLike }) {
  const tone = getWindToneFromText(wind.speed, wind.gust);
  const classes = getWindToneClasses(tone);
  return (
    <div className={`rounded-2xl border p-5 ${classes.card}`}>
      <div className="mb-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryPill label="Wind" tone="wind" />
          <span className={`text-xs font-semibold uppercase tracking-[0.1em] ${classes.muted}`}>
            {label}
          </span>
        </div>
        <SourceFreshnessBadge source={source} compact />
      </div>
      <div className="flex items-center gap-4">
        <WindArrow degrees={wind.degrees} large className={classes.text} />
        <div>
          <div>
            <p className={`weather-data text-5xl leading-none ${classes.text}`}>
              {wind.direction}
            </p>
            <p className={`weather-data mt-2 text-2xl ${classes.speedText}`}>
              {wind.speed}
            </p>
          </div>
          <div className={`mt-3 ${classes.badge}`}>
            <span>GUST</span>
            <span className="weather-data">{wind.gust}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  status,
  live = false,
}: {
  status: string;
  live?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#cbd9dd] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#3f5660] shadow-[0_4px_12px_rgba(7,35,45,0.06)] dark:border-white/15 dark:bg-[#132c3b] dark:text-[#d6e5ea]">
      {live ? (
        <span className="live-pulse size-2 rounded-full bg-emerald-500" />
      ) : null}
      {status}
    </span>
  );
}

type WindDisplay = {
  direction: string;
  speed: string;
  gust: string;
  degrees: number;
  isSample: boolean;
};

function WindArrow({
  degrees,
  large = false,
  compact = false,
  className = "text-[#0d5968]",
}: {
  degrees: number;
  large?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={
        large
          ? "grid size-14 shrink-0 place-items-center"
          : compact
            ? "grid size-7 shrink-0 place-items-center"
            : "grid size-9 shrink-0 place-items-center"
      }
    >
      <ArrowUp
        className={`${large ? "size-12" : compact ? "size-6" : "size-8"} ${className}`}
        strokeWidth={large ? 3.2 : 2.9}
        style={{ transform: `rotate(${degrees + 180}deg)` }}
        aria-hidden
      />
    </span>
  );
}

function TideTrendIcon({ trend }: { trend: OceanConditionSnapshot["tide"]["trend"] }) {
  const rotation = trend === "rising" ? 0 : trend === "falling" ? 180 : 90;
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-indigo-900/15 bg-white/70 dark:border-white/12 dark:bg-[#102a3a]">
      <ArrowUp
        className="size-5 text-[#17242c] dark:text-[#e9f8fb]"
        strokeWidth={2.8}
        style={{ transform: `rotate(${rotation}deg)` }}
        aria-hidden
      />
    </span>
  );
}

function formatTideTrend(trend: OceanConditionSnapshot["tide"]["trend"]) {
  if (trend === "slack") return "Holding";
  if (trend === "unknown") return "Unknown";
  return trend;
}

function windObservationToDisplayWithFallback(
  wind: ShoreOceanObservations["wind"],
  fallback: Omit<WindDisplay, "isSample">,
): WindDisplay {
  if (
    wind.speedKt === null ||
    (wind.source.status !== "live" &&
      !wind.source.source.includes("MFM forecast") &&
      !wind.source.source.includes("Coastal Waters Forecast"))
  ) {
    return {
      direction: "-",
      speed: "No live wind",
      gust: "-",
      degrees: fallback.degrees,
      isSample: true,
    };
  }

  return {
    direction: wind.directionCardinal ?? fallback.direction,
    speed: `${wind.speedKt} kt`,
    gust: wind.gustKt !== null ? `${wind.gustKt} kt` : "-",
    degrees: wind.directionDeg ?? fallback.degrees,
    isSample: wind.source.status !== "live",
  };
}

function getZoneWindFallback(zone: Zone): Omit<WindDisplay, "isSample"> {
  return zone === "windward"
    ? { direction: "ENE", speed: "18-24 kt", gust: "30 kt", degrees: 68 }
    : { direction: "ESE", speed: "10-16 kt", gust: "22 kt", degrees: 113 };
}

function getChannelShortName(name: string) {
  return name.replace(" Channel", "");
}

function getChannelConfig(channel: Channel): ChannelConfig {
  return channelConfigs.find((config) => config.id === channel) ?? channelConfigs[0];
}

function buildMalikoRunPoints(snapshot: OceanConditionSnapshot): RunWindPoint[] {
  const shoreOcean = snapshot.shoreObservations.north;
  const kanahaWind = snapshot.coastalWinds.find((coastal) => coastal.id === "kanaha")?.observation;
  const harborWind = snapshot.harborWinds.find((harbor) => harbor.id === "kahului-harbor")?.observation;
  return [
    {
      label: "Kanaha",
      wind: kanahaWind ? windObservationToDisplay(kanahaWind) : estimateCorridorWind(shoreOcean.wind, 0.82, "ENE", 68),
      source: kanahaWind?.source ?? estimateSource("Kanaha coastal estimate", shoreOcean.wind.source),
    },
    {
      label: "Harbor",
      wind: harborWind ? windObservationToDisplay(harborWind) : { direction: "Harbor data unavailable", speed: "-", gust: "-", degrees: 68, isSample: true },
      source: harborWind?.source ?? estimateSource("Inside harbor unavailable", shoreOcean.wind.source),
    },
  ];
}

function buildRunWindPoints(shore: Shore, shoreOcean: ShoreOceanObservations, snapshot: OceanConditionSnapshot): RunWindPoint[] {
  if (shore === "north") {
    return buildMalikoRunPoints(snapshot);
  }

  const maalaeaWind = snapshot.harborWinds.find((harbor) => harbor.id === "maalaea-harbor")?.observation;
  const kiheiWind = snapshot.coastalWinds.find((coastal) => coastal.id === "kihei")?.observation;
  return [
    {
      label: "Maalaea",
      wind: maalaeaWind ? windObservationToDisplay(maalaeaWind) : estimateCorridorWind(shoreOcean.wind, 0.72, "ESE", 113),
      source: maalaeaWind?.source ?? estimateSource("Maalaea estimate", shoreOcean.wind.source),
    },
    {
      label: "Kihei",
      wind: kiheiWind ? windObservationToDisplay(kiheiWind) : estimateCorridorWind(shoreOcean.wind, 0.86, "ESE", 113),
      source: kiheiWind?.source ?? estimateSource("Kihei coastal estimate", shoreOcean.wind.source),
    },
  ];
}

function estimateCorridorWind(wind: SourceWindLike, multiplier: number, fallbackDirection: string, fallbackDegrees: number): WindDisplay {
  const speed = wind.speedKt !== null ? `${Math.max(1, Math.round(wind.speedKt * multiplier))} kt` : "model estimate";
  const gust = wind.gustKt !== null ? `${Math.max(1, Math.round(wind.gustKt * multiplier))} kt` : "-";
  return {
    direction: wind.directionCardinal ?? fallbackDirection,
    speed,
    gust,
    degrees: wind.directionDeg ?? fallbackDegrees,
    isSample: true,
  };
}

type SourceWindLike = ShoreOceanObservations["wind"];

function estimateSource(label: string, source: SourceLike): SourceLike {
  return {
    ...source,
    source: label,
    status: source.status === "live" ? "stale" : source.status,
  };
}

function getOffshoreChannelInsight(buoy: OceanConditionSnapshot["offshoreObservations"]["lanai-offshore"]) {
  const windSpeed = buoy.wind.speedKt ?? 0;
  const bumpHeight = buoy.bumpEnergy.heightFt ?? 0;
  if (windSpeed >= 18) return "Outer channel winds are active offshore.";
  if (bumpHeight >= 3) return "Short-period wind sea is visible on the offshore buoy.";
  return null;
}

function getChannelContext(wind: WindDisplay, bumpHeight: string) {
  const speed = extractMaxNumber(wind.speed) ?? 0;
  if (speed >= 22) return `Strong ${wind.direction} channel flow. Wind sea dominating the channel.`;
  if (bumpHeight !== "No live buoy data") return "Short-period wind swell active in the channel.";
  return "Channel state tied to live wind and available buoy energy.";
}

function getHarborContext(harbor: HarborWindObservation, wind: WindDisplay) {
  const speed = extractMaxNumber(wind.speed) ?? 0;
  if (speed >= 18) return `${harbor.name} has active harbor wind and likely chop near entries.`;
  return `${harbor.name} wind is lighter; verify entry texture with camera when available.`;
}

function formatSeaEnergy(energy: OceanConditionSnapshot["bumpEnergy"]) {
  const emptyLabel =
    energy.label === "groundswell"
      ? "No groundswell"
      : "No live buoy data";
  const meta =
    energy.heightFt === null && energy.label === "groundswell"
      ? "wind sea dominant"
      : `${energy.periodSec !== null ? `${energy.periodSec}s` : "period unavailable"} · ${formatSwellDirection(energy.directionCardinal, energy.directionDeg)}`;
  return {
    height: energy.heightFt !== null ? `${energy.heightFt} ft` : emptyLabel,
    period: energy.periodSec !== null ? `${energy.periodSec}s` : "period unavailable",
    direction: formatSwellDirection(energy.directionCardinal, energy.directionDeg),
    meta,
  };
}

function formatSwellDirection(cardinal: string | null, degrees: number | null) {
  const direction = cardinal ?? "direction unavailable";
  return degrees !== null ? `${direction} · ${Math.round(degrees)}°` : direction;
}

function formatCurrent(snapshot: OceanConditionSnapshot) {
  return formatCurrentObservation(snapshot.current);
}

function formatCurrentObservation(current: OceanConditionSnapshot["current"]) {
  if (current.speedKt === null) return "No NOAA current";
  const direction = current.directionCardinal ? ` ${current.directionCardinal}` : "";
  return `${current.speedKt} kt${direction}`;
}

function formatTideHeight(tide: OceanConditionSnapshot["tide"]) {
  return tide.currentWaterLevelFt !== null
    ? `${tide.currentWaterLevelFt} ft`
    : "Prediction only";
}

function formatNextTide(tide: OceanConditionSnapshot["tide"]) {
  const next = getNextTideEvent(tide);
  return next ? `Next ${next.type} ${formatTime(next.time)}` : "Next tide unavailable";
}

function getNextTideEvent(tide: OceanConditionSnapshot["tide"]) {
  if (tide.trend === "rising") return tide.nextHigh;
  if (tide.trend === "falling") return tide.nextLow;
  return [tide.nextHigh, tide.nextLow]
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())[0] ?? null;
}

function formatRain(windows: ForecastWindow[]) {
  const rain = windows[0]?.precipitationChancePercent;
  return rain === null || rain === undefined
    ? "Rain not available"
    : `${rain}%`;
}

function getSwellAlignment(wind: WindDisplay, swellDirection: string) {
  const diff = directionDifference(
    wind.degrees,
    cardinalToDegrees(swellDirection),
  );
  if (diff <= 30) return "Lined up";
  if (diff <= 60) return "Slight cross";
  return "Crossing";
}

function getRainImpact(windows: ForecastWindow[]) {
  const rainNumber = Number.parseInt(formatRain(windows), 10);
  if (Number.isFinite(rainNumber) && rainNumber >= 40)
    return "Elevated squall risk";
  if (Number.isFinite(rainNumber) && rainNumber >= 25)
    return "Watch passing bands";
  return "Lower rain impact";
}

function getWindToneFromText(speed: string, gust?: string): WindTone {
  const peak = Math.max(
    extractMaxNumber(speed) ?? 0,
    extractMaxNumber(gust ?? "") ?? 0,
  );
  if (peak >= 38) return "wild";
  if (peak >= 22) return "strong";
  if (peak >= 16) return "medium";
  if (peak >= 12) return "clean";
  return "light";
}

function getWindToneClasses(tone: WindTone) {
  const classes = {
    light: {
      card: "border-[#d8dedf] bg-[#fbfaf6] text-[#17242c]",
      text: "text-[#17242c]",
      speedText: "text-[#c54a24]",
      muted: "text-[#68777d]",
      badge:
        "inline-flex items-center gap-2 rounded-full border border-[#d6a28e] bg-[#fff3ea] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#9a3412] dark:border-[#fb923c]/55 dark:bg-[#431c0b] dark:text-[#fed7aa]",
    },
    clean: {
      card: "border-[#d8dedf] bg-[#fbfaf6] text-[#17242c]",
      text: "text-[#17242c]",
      speedText: "text-[#c54a24]",
      muted: "text-[#68777d]",
      badge:
        "inline-flex items-center gap-2 rounded-full border border-[#d6a28e] bg-[#fff3ea] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#9a3412] dark:border-[#fb923c]/55 dark:bg-[#431c0b] dark:text-[#fed7aa]",
    },
    medium: {
      card: "border-[#d8dedf] bg-[#fbfaf6] text-[#17242c]",
      text: "text-[#17242c]",
      speedText: "text-[#c54a24]",
      muted: "text-[#68777d]",
      badge:
        "inline-flex items-center gap-2 rounded-full border border-[#d6a28e] bg-[#fff3ea] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#9a3412] dark:border-[#fb923c]/55 dark:bg-[#431c0b] dark:text-[#fed7aa]",
    },
    strong: {
      card: "border-[#d8dedf] bg-[#fbfaf6] text-[#17242c]",
      text: "text-[#17242c]",
      speedText: "text-[#c54a24]",
      muted: "text-[#68777d]",
      badge:
        "inline-flex items-center gap-2 rounded-full border border-[#d6a28e] bg-[#fff3ea] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#9a3412] dark:border-[#fb923c]/55 dark:bg-[#431c0b] dark:text-[#fed7aa]",
    },
    wild: {
      card: "border-[#d8dedf] bg-[#fbfaf6] text-[#17242c]",
      text: "text-[#17242c]",
      speedText: "text-[#b9381d]",
      muted: "text-[#68777d]",
      badge:
        "inline-flex items-center gap-2 rounded-full border border-[#d6947f] bg-[#fff0eb] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#8f2d18] dark:border-[#fb7185]/60 dark:bg-[#4b1714] dark:text-[#fecdd3]",
    },
  };
  return classes[tone];
}

function extractMaxNumber(value: string) {
  const values = [...value.matchAll(/\d+(?:\.\d+)?/g)].map((match) =>
    Number.parseFloat(match[0]),
  );
  const finiteValues = values.filter(Number.isFinite);
  return finiteValues.length ? Math.max(...finiteValues) : null;
}

function directionDifference(a: number, b: number) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function buildFiveDayForecast(
  windows: ForecastWindow[],
  zone: Zone,
  marineForecastDays: MarineForecastDay[],
) {
  const fallback = buildFallbackForecast(zone);
  if (windows.length < 6) {
    return fallback.map((day) => ({
      ...day,
      ...getMarineForecastEnergy(day.day, marineForecastDays),
    }));
  }

  const grouped = new Map<string, ForecastWindow[]>();
  for (const window of windows) {
    const label = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Pacific/Honolulu",
    }).format(new Date(window.startTime)).replace(",", "");
    grouped.set(label, [...(grouped.get(label) ?? []), window]);
  }

  const days = Array.from(grouped.entries())
    .slice(0, 5)
    .map(([day, dayWindows]) => {
      const windValues = dayWindows
        .map((window) => window.windSpeedKt)
        .filter((value): value is number => value !== null);
      const gustValues = dayWindows
        .map((window) => window.windGustKt)
        .filter((value): value is number => value !== null);
      const rainValues = dayWindows
        .map((window) => window.precipitationChancePercent)
        .filter((value): value is number => value !== null);
      const direction =
        dayWindows.find((window) => window.windDirectionCardinal)
          ?.windDirectionCardinal ?? "-";
      return {
        day: day.toUpperCase(),
        wind: `${direction} ${range(windValues)} kt${gustValues.length ? ` G${Math.max(...gustValues)}` : ""}`,
        rain: rainValues.length
          ? `${Math.round(rainValues.reduce((sum, value) => sum + value, 0) / rainValues.length)}%`
          : "-",
        read: dayWindows[0]?.shortForecast ?? "Forecast available.",
        ...getMarineForecastEnergy(day, marineForecastDays),
      };
    });

  while (days.length < 5) {
    const fallbackDay = fallback[days.length];
    days.push({
      ...fallbackDay,
      ...getMarineForecastEnergy(fallbackDay.day, marineForecastDays),
    });
  }

  return days.length
    ? days
    : fallback.map((day) => ({
        ...day,
        ...getMarineForecastEnergy(day.day, marineForecastDays),
      }));
}

function getMarineForecastEnergy(day: string, marineForecastDays: MarineForecastDay[]) {
  const weekday = day.split(/\s+/)[0]?.toUpperCase();
  const marineDay = marineForecastDays.find((candidate) => {
    const candidateLabel = candidate.dayLabel === "TODAY"
      ? new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          timeZone: "Pacific/Honolulu",
        }).format(new Date()).toUpperCase()
      : candidate.dayLabel;
    return candidateLabel === weekday;
  });
  return {
    bumpEnergy: formatMarineForecastEnergy(marineDay?.bumpEnergy),
    groundswell: formatMarineForecastEnergy(marineDay?.groundswell),
  };
}

function formatMarineForecastEnergy(energy?: MarineForecastDay["bumpEnergy"]) {
  return {
    height: energy?.heightFt !== null && energy?.heightFt !== undefined ? `${energy.heightFt} ft` : "No data",
    meta:
      energy?.periodSec !== null && energy?.periodSec !== undefined
        ? `${energy.periodSec}s · ${energy.directionCardinal ?? "direction unavailable"}`
        : "not published",
  };
}

function range(values: number[]) {
  if (!values.length) return "-";
  return `${Math.min(...values)}-${Math.max(...values)}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Pacific/Honolulu",
  }).format(new Date(value));
}

function parseWind(value: string) {
  const direction = value.match(/^[A-Z]+/)?.[0] ?? "E";
  const speed =
    value.match(/[A-Z]+\s+([^G]+?kt)/)?.[1]?.trim() ??
    value.replace(direction, "").trim();
  const gust = value.match(/G(\d+)/)?.[1];
  return {
    direction,
    speed,
    gust: gust ? `${gust} kt` : "-",
  };
}

function cardinalToDegrees(direction: string) {
  const map: Record<string, number> = {
    N: 0,
    NNE: 23,
    NE: 45,
    ENE: 68,
    E: 90,
    ESE: 113,
    SE: 135,
    SSE: 158,
    S: 180,
    SSW: 203,
    SW: 225,
    WSW: 248,
    W: 270,
    WNW: 293,
    NW: 315,
    NNW: 338,
  };
  return map[direction] ?? 90;
}

type ShoreConfig = {
  id: Shore;
  label: string;
  shortLabel: string;
  secondary: string;
  zone: Zone;
};

function ShoreChip({
  shore,
  active,
  href,
}: {
  shore: Shore;
  active: boolean;
  href: string;
}) {
  const config = getShoreConfig(shore);
  return (
    <Link
      href={href}
      prefetch={false}
      className={
        active
          ? "shrink-0 whitespace-nowrap rounded-xl border border-[#17242c] bg-[#17242c] px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_22px_rgba(7,35,45,0.14)] dark:border-white dark:bg-white dark:text-[#071723]"
          : "shrink-0 whitespace-nowrap rounded-xl border border-[#d8dedf] bg-[#fbfaf6] px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#526a73] transition hover:border-[#17242c]/35 hover:text-[#102b3a] dark:border-white/12 dark:bg-[#102a3a] dark:text-[#c9d9df] dark:hover:border-white/35 dark:hover:text-white"
      }
    >
      {config.shortLabel}
    </Link>
  );
}

function getShoreConfig(shore: Shore): ShoreConfig {
  const configs: Record<Shore, ShoreConfig> = {
    north: { id: "north", label: "North Shore", shortLabel: "North Shore", secondary: "Windward", zone: "windward" },
    south: { id: "south", label: "South Side", shortLabel: "South Side", secondary: "Leeward", zone: "leeward" },
    west: { id: "west", label: "West Side", shortLabel: "West Side", secondary: "Leeward", zone: "leeward" },
  };
  return configs[shore];
}

function getShoreOcean(snapshot: OceanConditionSnapshot, shore: Shore): ShoreOceanObservations {
  return snapshot.shoreObservations?.[shore] ?? snapshot.shoreObservations?.north ?? {
    shoreId: "north",
    label: "North Shore",
    buoyId: snapshot.route.stations.primaryBuoyId,
    wind: snapshot.wind,
    swell: snapshot.swell,
    groundswell: snapshot.groundswell,
    bumpEnergy: snapshot.bumpEnergy,
  };
}

function normalizeMode(activity: Activity): ObservationMode {
  if (activity === "downwind") return "shores";
  if (activity === "fishing") return "channels";
  return activity;
}

function getModeKicker(mode: ObservationMode, shore: ShoreConfig) {
  if (mode === "shores") return shore.secondary;
  if (mode === "channels") return "Inter-island";
  return "Launch / entry";
}

function getModeTitle(mode: ObservationMode, shore: ShoreConfig) {
  if (mode === "shores") return shore.label;
  if (mode === "channels") return "Channels";
  return "Harbors";
}

function getModeSubtitle(mode: ObservationMode, shore: ShoreConfig) {
  if (mode === "shores") {
    return `Live wind, bump energy, current, rain bands, and cameras for ${shore.label}.`;
  }
  if (mode === "channels") {
    return "Pailolo, Kaiwi, and Alenuihaha wind, bump energy, current, tide, and squalls.";
  }
  return "Harbor wind, tide, current, visibility, vessel activity, and entry conditions.";
}

function normalizeZone(value: string | string[] | undefined): Zone {
  return value === "leeward" ? "leeward" : "windward";
}

function normalizeShore(value: string | string[] | undefined): Shore {
  if (value === "south" || value === "west") return value;
  return "north";
}

function normalizeChannel(value: string | string[] | undefined): Channel {
  if (value === "kaiwi" || value === "alenuihaha" || value === "offshore-waters") return value;
  return "pailolo";
}

function normalizeHarbor(value: string | string[] | undefined): Harbor {
  if (value === "maalaea-harbor" || value === "lahaina-harbor") return value;
  return "kahului-harbor";
}

export { normalizeChannel, normalizeHarbor, normalizeShore, normalizeZone };

function buildFallbackForecast(zone: Zone) {
  const windward = [
    {
      wind: "ENE 20-25 kt",
      swell: "5-6 ft @ 10s ENE",
      rain: "25%",
      read: "Trades active. Watch passing windward showers.",
    },
    {
      wind: "E 18-24 kt",
      swell: "4-6 ft @ 9s E",
      rain: "30%",
      read: "Similar trades with moderate wind texture.",
    },
    {
      wind: "ESE 14-20 kt",
      swell: "3-5 ft @ 10s E",
      rain: "20%",
      read: "Slightly lighter wind, cleaner water possible.",
    },
    {
      wind: "E 16-22 kt",
      swell: "4-5 ft @ 9s E",
      rain: "28%",
      read: "Trades rebuild with active wind-sea texture.",
    },
    {
      wind: "ENE 18-24 kt",
      swell: "5-6 ft @ 10s ENE",
      rain: "32%",
      read: "Windward showers possible with stronger trade flow.",
    },
  ];
  const leeward = [
    {
      wind: "ESE 10-16 kt",
      swell: "2-4 ft @ 12s SSW",
      rain: "15%",
      read: "Lighter leeward wind with afternoon texture.",
    },
    {
      wind: "E 12-18 kt",
      swell: "2-3 ft @ 11s S",
      rain: "20%",
      read: "Moderate trades wrapping leeward.",
    },
    {
      wind: "SE 8-14 kt",
      swell: "2-3 ft @ 13s SSW",
      rain: "15%",
      read: "Lighter wind, cleaner morning window possible.",
    },
    {
      wind: "ESE 12-18 kt",
      swell: "2-4 ft @ 12s S",
      rain: "18%",
      read: "Leeward texture increases as trades wrap around.",
    },
    {
      wind: "E 14-20 kt",
      swell: "2-3 ft @ 11s SSW",
      rain: "22%",
      read: "Moderate trades with passing cloud bands.",
    },
  ];
  const source = zone === "windward" ? windward : leeward;
  const today = new Date();

  return source.map((day, index) => ({
    ...day,
    day: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Pacific/Honolulu",
    }).format(
      new Date(today.getFullYear(), today.getMonth(), today.getDate() + index),
    ).replace(",", "").toUpperCase(),
  }));
}
