import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import {
  ArrowUp,
  AlertTriangle,
  CloudRain,
  Compass,
  ExternalLink,
  Info,
  Navigation,
  Ship,
  Waves,
} from "lucide-react";

import { PreserveForecastScroll } from "@/components/ocean/preserve-forecast-scroll";
import { RunSourcePopover } from "@/components/ocean/run-source-popover";
import type {
  ForecastRegionId,
  ForecastWindow,
  HarborWindObservation,
  MarineForecastDay,
  OceanConditionSnapshot,
  ShoreOceanObservations,
} from "@/lib/ocean";

type ObservationMode = "shores" | "channels" | "harbors";
type Activity = ObservationMode | "downwind" | "fishing";
type Zone = "windward" | "leeward" | "maalaea";
type Shore = "north" | "south" | "west";
type ForecastRegion = ForecastRegionId;
type Channel = "pailolo" | "kaiwi" | "alenuihaha" | "offshore-waters";
type InterIslandChannel = Exclude<Channel, "offshore-waters">;
type Harbor = "kahului-harbor" | "maalaea-harbor" | "lahaina-harbor";
type WindTone = "light" | "clean" | "medium" | "strong" | "wild";
type SurfSpot = NonNullable<OceanConditionSnapshot["surfOutlook"]>["spots"][number];
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

const forecastRegionTabs = [
  { id: "north", label: "North" },
  { id: "south", label: "South" },
  { id: "east", label: "East" },
  { id: "west", label: "West" },
] satisfies Array<{ id: ForecastRegion; label: string }>;

type ChannelConfig = {
  id: Channel;
  name: string;
  shortLabel: string;
  detail: string;
};

const channelConfigs: ChannelConfig[] = [
  { id: "pailolo", name: "Pailolo Channel", shortLabel: "Pailolo", detail: "Maui -> Molokai" },
  { id: "kaiwi", name: "Kaiwi Channel", shortLabel: "Kaiwi", detail: "Molokai -> Oahu" },
  { id: "alenuihaha", name: "Alenuihaha Channel", shortLabel: "Alenuihaha", detail: "Maui -> Big Island" },
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
  const liveRunPoints =
    selectedShore === "north"
      ? buildMalikoRunPoints(snapshot).filter((point) => isLiveWindSource(point.source))
      : [];
  const hasLiveWind = isLiveWindSource(shoreOcean.wind.source) && shoreOcean.wind.speedKt !== null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7">
      <ForecastAlertBanner alerts={snapshot.alerts} />

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

      {liveRunPoints.length >= 2 ? (
        <RunWindCard
          shore={selectedShore}
          points={liveRunPoints}
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
        <div className={`grid gap-4 ${hasLiveWind ? "lg:grid-cols-[1.1fr_0.9fr]" : ""}`}>
          {hasLiveWind ? <LiveWindCard wind={wind} source={shoreOcean.wind.source} /> : null}
          <LiveSeaInlineCard shoreOcean={shoreOcean} snapshot={snapshot} />
        </div>
        <div className={`mt-4 grid gap-4 ${hasCurrent ? "lg:grid-cols-2" : ""}`}>
          <TideCard tide={snapshot.shoreTides[selectedShore]} />
          {hasCurrent ? <CurrentCard current={current} /> : null}
        </div>
      </section>
    </div>
  );
}

export function ExtendedForecastOverview({
  snapshot,
  selectedRegion = "north",
}: {
  snapshot: OceanConditionSnapshot;
  selectedRegion?: ForecastRegion;
}) {
  const forecastSource = getForecastSourceForRegion(snapshot, selectedRegion);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <PreserveForecastScroll />
      <ForecastAlertBanner alerts={snapshot.alerts} />
      <section className="rounded-[1.15rem] bg-white/58 p-2.5 shadow-[0_14px_36px_rgba(7,35,45,0.04)] ring-1 ring-[#d8dedf]/70 dark:bg-[#0b2230]/72 dark:ring-white/10 sm:p-4">
        <div className="flex items-center justify-between gap-3 border-b border-[#d8dedf]/75 px-0.5 pb-2.5 dark:border-white/12">
          <h1 className="flex items-center gap-2 text-xl font-semibold uppercase leading-none tracking-[0.03em] text-[#102b3a] dark:text-[#f4fbff] sm:text-2xl">
            <Waves className="size-4 text-[#0d9684] sm:size-5" />
            Forecast
          </h1>
          <ForecastSourceIcon source={forecastSource} />
        </div>
        <div>
          <SegmentedTabs
            items={forecastRegionTabs.map((region) => ({
              ...region,
              href: `/forecast?region=${region.id}`,
            }))}
            activeId={selectedRegion}
            fullWidth
          />
        </div>
        <div className="mt-4">
          <ModelTimeline snapshot={snapshot} region={selectedRegion} />
        </div>
        <SurfReportSummary snapshot={snapshot} selectedRegion={selectedRegion} />
      </section>
    </div>
  );
}

function getForecastSourceForRegion(snapshot: OceanConditionSnapshot, region: ForecastRegion) {
  const regionConfig = getForecastRegionConfig(region);
  if (region === "south" || region === "west") {
    return getForecastTimelineSource(snapshot.shoreForecastWindows[region])
      ?? getForecastMarineSource(snapshot, regionConfig.zone);
  }
  return getForecastMarineSource(snapshot, regionConfig.zone)
    ?? getForecastTimelineSource(snapshot.shoreForecastWindows[region]);
}

function ForecastSourceIcon({
  source,
}: {
  source: SourceLike | null;
}) {
  return (
    <>
      {source?.sourceUrl ? (
        <a
          href={source.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="grid size-7 shrink-0 place-items-center text-[#7b8c92] transition hover:text-[#0d5968] dark:text-[#9fb4bc] dark:hover:text-[#9debf9]"
          title={`Open forecast source: ${getSourceDisplayName(source)}`}
          aria-label={`Open forecast source: ${getSourceDisplayName(source)}`}
        >
          <Info className="size-5" />
        </a>
      ) : (
        <Info className="size-5 shrink-0 text-[#7b8c92] dark:text-[#9fb4bc]" aria-hidden />
      )}
    </>
  );
}

function ForecastAlertBanner({ alerts }: { alerts: OceanConditionSnapshot["alerts"] }) {
  const uniqueAlerts = getUniqueMarineAlerts(alerts.filter(isPrimaryWeatherAlert)).sort(compareWeatherAlerts);
  if (!uniqueAlerts.length) return null;

  const source = uniqueAlerts[0]?.source;

  return (
    <div className="relative mt-3 rounded-[1.1rem] border border-orange-700/18 bg-gradient-to-br from-orange-50/95 via-[#fff8ee]/92 to-white/82 px-3.5 py-3 pr-11 text-[#7c2d12] shadow-[0_10px_24px_rgba(124,45,18,0.06)] dark:border-orange-300/20 dark:from-orange-950/28 dark:via-[#2b1d14]/60 dark:to-[#102a3a]/70 dark:text-orange-100">
      {source ? <WeatherRiskSource source={source} /> : null}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-orange-100 text-orange-800 ring-1 ring-orange-200/80 dark:bg-orange-900/40 dark:text-orange-100 dark:ring-orange-300/20">
          <AlertTriangle className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.13em]">Weather alerts</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {uniqueAlerts.map((alert) => (
              <span key={alert.id} className="rounded-full bg-white/72 px-2.5 py-1 text-xs font-semibold leading-none ring-1 ring-orange-700/12 dark:bg-white/8 dark:ring-orange-200/16">
                {getFriendlyAlertLabel(alert)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeatherRiskSource({ source }: { source: SourceLike }) {
  const label = `Open official source: ${getSourceDisplayName(source)}`;
  const className = "absolute right-3 top-3 grid size-7 place-items-center rounded-full text-[#7c2d12]/70 transition hover:bg-white/70 hover:text-[#7c2d12] dark:text-orange-100/75 dark:hover:bg-white/10 dark:hover:text-orange-50";
  return source.sourceUrl ? (
    <a
      href={source.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className={className}
      title={label}
      aria-label={label}
    >
      <Info className="size-5" />
    </a>
  ) : (
    <span className={className} title={label} aria-label={label}>
      <Info className="size-5" />
    </span>
  );
}

function SurfReportSummary({
  snapshot,
  selectedRegion,
}: {
  snapshot: OceanConditionSnapshot;
  selectedRegion: ForecastRegion;
}) {
  const surfOutlook = snapshot.surfOutlook;
  if (!surfOutlook) return null;

  const shore = surfOutlook.shores[selectedRegion];
  const spots = buildSurfReportSpotList(surfOutlook.spots, selectedRegion);
  const sourceUrl = surfOutlook.source.sourceUrl;
  const sourceName = surfOutlook.source.source;
  const briefing = formatFullSurfBriefing(surfOutlook.briefing);
  const shoreLabel = selectedRegion === "south" ? "Maui south-facing shores" : `Maui ${shore?.label.toLowerCase() ?? selectedRegion}-facing shores`;
  const reportText = shore?.summary
    ?? (spots.length
      ? `${sourceName} does not publish a separate narrative for this Maui coast. Local readings are shown below.`
      : briefing)
    ?? "Surf guidance is available from the latest Maui surf report.";

  return (
    <section className="ocean-card mt-3 rounded-[1.5rem] border border-[#0d9684]/18 bg-[#f3fbfa] p-5 shadow-[0_14px_32px_rgba(7,35,45,0.04)] dark:border-teal-200/16 dark:bg-[#0b282c]">
      <div className="flex items-center gap-2">
        <span className="relative grid h-9 w-11 shrink-0 place-items-center text-[#0284c7] dark:text-[#38bdf8]">
          <SurfWaveIcon />
        </span>
        <span className="rounded-full border border-teal-700/20 bg-teal-100 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-teal-900 dark:border-teal-200/25 dark:bg-teal-300/18 dark:text-teal-100">
          Surf report
        </span>
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto grid size-7 shrink-0 place-items-center text-[#61747c] transition hover:text-[#0d5968] dark:text-[#b7cbd3] dark:hover:text-[#9debf9]"
              title={`Open ${sourceName}`}
              aria-label={`Open ${sourceName}`}
            >
              <Info className="size-5" strokeWidth={2.2} />
            </a>
          ) : null}
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#536b73] dark:text-[#b7cbd3]">
        {shoreLabel}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#102b3a] dark:text-[#e9f8fb]">
        {reportText}
      </p>
      {spots.length ? (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {spots.map((spot) => (
            <span key={spot.id} className="inline-flex items-center gap-1 rounded-full bg-white/75 px-2.5 py-1 text-xs font-semibold text-[#536b73] ring-1 ring-[#d8dedf]/70 dark:bg-white/8 dark:text-[#b7cbd3] dark:ring-white/10">
              <Waves className="size-3" />
              {[spot.name, spot.surf].filter(Boolean).join(" ")}
            </span>
          ))}
        </div>
      ) : null}
      {spots.length && surfOutlook.spotBriefing ? (
        <p className="mt-2 text-xs leading-5 text-[#61747c] dark:text-[#9fb8c0]">
          {surfOutlook.spotBriefing}
        </p>
      ) : null}
    </section>
  );
}

function SurfWaveIcon() {
  return (
    <svg
      className="h-8 w-10"
      viewBox="0 0 48 40"
      fill="none"
      aria-hidden
    >
      <path
        d="M8 17.5c5.1 2.9 10.6-.9 14.7-7 4-6 11.8-7 16.3-3.1-5.9-.2-9.1 2.3-9.3 7.5-.1 5.1 4.3 8.2 9.6 5.4"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 26c3.7 3 7.4 3 11.1 0 3.7 3 7.4 3 11.1 0 3.7 3 7.4 3 11.1 0"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 33c3.7 3 7.4 3 11.1 0 3.7 3 7.4 3 11.1 0 3.7 3 7.4 3 11.1 0"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function buildSurfReportSpotList(
  spots: SurfSpot[],
  selectedRegion: ForecastRegion,
) {
  const regionSpots = spots.filter((spot) => spot.region === selectedRegion);
  const preferredNames: Partial<Record<ForecastRegion, string[]>> = {
    north: ["Hookipa", "Paia", "Kanaha", "Mejana"],
    south: ["Kihei", "Wailea", "Maalaea"],
    east: ["Hana"],
    west: ["Lahaina", "Upper West"],
  };
  const preferred = preferredNames[selectedRegion] ?? [];
  const ordered = [
    ...preferred.flatMap((name) =>
      regionSpots.filter((spot) => normalizeSpotName(spot.name).includes(normalizeSpotName(name))),
    ),
    ...regionSpots,
  ];
  return dedupeSurfSpots(ordered)
    .filter((spot) => spot.surf.trim().length > 0)
    .slice(0, 4);
}

function dedupeSurfSpots(spots: SurfSpot[]) {
  const seen = new Set<string>();
  return spots.filter((spot) => {
    const key = normalizeSpotName(spot.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeSpotName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
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
  const hasLiveWind = isLiveWindSource(shoreOcean.wind.source) && shoreOcean.wind.speedKt !== null;
  const liveRunPoints = buildRunWindPoints(shoreOcean.shoreId, shoreOcean, snapshot).filter((point) => isLiveWindSource(point.source));
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
    hasLiveWind ? {
      icon: Navigation,
      label: "Swell Direction",
      tone: "swell",
      primary: getSwellAlignment(zoneWind, energyDirection),
      secondary: `${energyDirection} sea energy vs ${zoneWind.direction} wind`,
      source: shoreOcean.swell.source,
    } : null,
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
        {liveRunPoints.length >= 2 ? (
          <RunWindCard
            shore={shoreOcean.shoreId}
            points={liveRunPoints}
          />
        ) : null}
        {hasLiveWind ? <LiveWindBlock label="Wind now" wind={zoneWind} source={shoreOcean.wind.source} /> : null}
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
  const channelTabBase = "inline-flex min-w-0 items-center justify-center rounded-[0.9rem] px-1 py-2 text-center text-[0.58rem] font-semibold uppercase leading-4 tracking-[0.06em] transition sm:px-4 sm:text-xs sm:tracking-[0.14em]";
  const channelTabActive = "bg-[#102b3a] text-white shadow-[0_8px_18px_rgba(7,35,45,0.12)] dark:bg-[#17d3b2] dark:text-[#06151c]";
  const channelTabIdle = "text-[#5f7078] hover:bg-white/80 hover:text-[#102b3a] dark:text-[#b7cbd3] dark:hover:bg-white/8 dark:hover:text-white";

  return (
    <div className="mt-6 space-y-5">
      <div className="w-full pb-1">
        <div className="grid w-full grid-cols-4 items-stretch gap-0.5 rounded-2xl border border-[#d8dedf] bg-[#f8fcfd]/78 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-white/12 dark:bg-[#071d2a] sm:gap-1">
          {interIslandChannelConfigs.map((channel) => (
            <Link
              key={channel.id}
              href={`/channels?channel=${channel.id}`}
              prefetch={false}
              scroll={false}
              className={`${channelTabBase} ${channel.id === selectedChannel ? channelTabActive : channelTabIdle}`}
            >
              {channel.shortLabel}
            </Link>
          ))}
          <Link
            href="/channels?channel=offshore-waters"
            prefetch={false}
            scroll={false}
            className={`${channelTabBase} ${selectedChannel === "offshore-waters" ? channelTabActive : channelTabIdle}`}
          >
            Offshore
          </Link>
        </div>
      </div>
      <ActiveMarineAlerts alerts={snapshot.alerts} selectedChannel={selectedChannel} />
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
  region,
}: {
  snapshot: OceanConditionSnapshot;
  region: ForecastRegion;
}) {
  const regionConfig = getForecastRegionConfig(region);
  const zone = regionConfig.zone;
  const windows = snapshot.shoreForecastWindows[region];
  const days = buildFiveDayForecast(
    windows,
    zone,
    snapshot.marineForecastDays[zone],
  );
  const slots = buildForecastMatrixSlots(windows, days, snapshot, region);
  const usesLocalPointForecast = (region === "south" || region === "west") && hasUsableForecastWindows(windows);
  const localSourceLabel = region === "south" ? "Kihei local · NWS" : "West Maui local · NWS";

  return (
    <section className="overflow-hidden">
      <div className="mb-2 flex flex-wrap items-end gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#61747c] dark:text-[#b7cbd3]">
            4 day outlook
          </span>
          {usesLocalPointForecast ? (
            <>
              <ForecastZoneSourceChip source={getForecastTimelineSource(windows)} label={localSourceLabel} />
              <ForecastZoneSourceChip source={getForecastMarineSource(snapshot, regionConfig.zone)} label="Swell · PHZ118" />
            </>
          ) : (
            <ForecastZoneSourceChip source={getForecastMarineSource(snapshot, regionConfig.zone)} label={getForecastMarineZoneLabel(regionConfig.zone)} />
          )}
        </div>
      </div>
      <ForecastMatrix slots={slots} />
    </section>
  );
}

type ForecastMatrixSlot = {
  key: string;
  day: string;
  isDayStart: boolean;
  dayTone: number;
  time: string;
  windDirection: string;
  windSpeed: string;
  gust: string;
  swellHeight: string;
  period: string;
  waveDirection: string;
  rain: string;
  tone: WindTone;
};

function ForecastMatrix({ slots }: { slots: ForecastMatrixSlot[] }) {
  const columns = `4rem repeat(${slots.length}, minmax(4.15rem, 1fr))`;
  const cellBase = "flex min-h-[2.75rem] flex-col items-center justify-center px-2 py-2 text-center";
  const hasGust = slots.some((slot) => slot.gust !== "-");
  return (
    <div className="overflow-x-auto pb-3">
      <div
        className="min-w-[48rem] overflow-hidden rounded-[0.95rem] bg-white shadow-[0_10px_24px_rgba(7,35,45,0.04)] ring-1 ring-[#d8dedf]/65 dark:bg-[#102a3a] dark:ring-white/10"
        style={{ gridTemplateColumns: columns }}
      >
        <ForecastMatrixRow label="Period" columns={columns} labelClassName="bg-[#eef5f6] dark:bg-[#0b2230]">
          {slots.map((slot) => (
            <div
              key={`${slot.key}-period`}
              className={`${cellBase} min-h-[3.15rem] py-1.5 ${getDayBandClasses(slot)}`}
            >
              <p className="min-h-[0.75rem] text-[0.58rem] font-semibold uppercase leading-none tracking-[0.06em] text-[#61747c] dark:text-[#9fb4bc]">
                {slot.isDayStart ? slot.day : " "}
              </p>
              <p className="weather-data mt-1 text-[0.78rem] leading-none text-[#102b3a] dark:text-[#e5f2f6]">
                {slot.time}
              </p>
            </div>
          ))}
        </ForecastMatrixRow>

        <ForecastMatrixRow label="Wind" columns={columns} icon={Navigation}>
          {slots.map((slot) => {
            const power = getForecastPowerClasses(slot.tone);
            const isWindMetric = slot.windSpeed !== "-" && /[0-9]/.test(slot.windSpeed);
            return (
              <div key={`${slot.key}-wind`} className={`${cellBase} ${power.background} ${slot.isDayStart ? "border-l border-[#c8b799] dark:border-white/18" : "border-l border-[#f0dfc2]/50 dark:border-white/6"}`}>
                <p className={`weather-data max-w-[5.2rem] whitespace-normal text-center text-xs leading-tight ${power.speedText}`}>
                  {isWindMetric ? `${slot.windSpeed} kt` : slot.windSpeed}
                </p>
                <div className="mt-1 flex items-center justify-center gap-1">
                  {isKnownCardinalDirection(slot.windDirection) ? (
                    <WindArrow degrees={cardinalToDegrees(slot.windDirection)} compact className="text-[#102b3a] dark:text-[#f4fbff]" />
                  ) : null}
                  {slot.windDirection !== "-" ? (
                    <p className="weather-data text-xs leading-none text-[#102b3a] dark:text-[#f4fbff]">{slot.windDirection}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </ForecastMatrixRow>

        {hasGust ? (
          <ForecastMatrixRow label="Gust" columns={columns} icon={Compass}>
            {slots.map((slot) => (
              <div key={`${slot.key}-gust`} className={`${cellBase} bg-[#fff7ef] dark:bg-[#261b12] ${slot.isDayStart ? "border-l border-[#e8c7a4] dark:border-white/18" : "border-l border-[#f4e5d5]/60 dark:border-white/6"}`}>
                <p className="weather-data text-xs leading-none text-[#c54824] dark:text-[#fb9270]">{slot.gust} kt</p>
              </div>
            ))}
          </ForecastMatrixRow>
        ) : null}

        <ForecastMatrixRow label="Swell" columns={columns} icon={Waves}>
          {slots.map((slot) => {
            const hasWaveDirection = isKnownCardinalDirection(slot.waveDirection);
            return (
              <div key={`${slot.key}-swell`} className={`${cellBase} bg-[#edf6fa] dark:bg-[#0d293b] ${slot.isDayStart ? "border-l border-[#b8d5e5] dark:border-white/18" : "border-l border-[#d6eaf3]/70 dark:border-white/6"}`}>
                {slot.swellHeight !== "-" || slot.period !== "-" || slot.waveDirection !== "-" ? (
                  <div className="flex flex-col items-center justify-center text-[#536b73] dark:text-[#b7cbd3]">
                    <div className="flex items-center gap-1.5">
                      {hasWaveDirection ? (
                        <WindArrow degrees={cardinalToDegrees(slot.waveDirection)} mini className="text-[#61747c] dark:text-[#b7cbd3]" />
                      ) : null}
                      <span className="weather-data text-xs font-semibold leading-none text-[#102b3a] dark:text-[#e9f8fb]">
                        {slot.waveDirection !== "-" ? slot.waveDirection : "Swell"}
                      </span>
                    </div>
                    <p className="weather-data mt-1.5 whitespace-nowrap text-[0.68rem] font-semibold leading-none">
                      {[slot.swellHeight !== "-" ? `${slot.swellHeight} ft` : "", slot.period !== "-" ? `@ ${slot.period}` : ""]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                  </div>
                ) : (
                  <span className="weather-data text-xs text-[#7b8c92] dark:text-[#8fa8b1]">—</span>
                )}
              </div>
            );
          })}
        </ForecastMatrixRow>

        <ForecastMatrixRow label="Rain" columns={columns} icon={CloudRain}>
          {slots.map((slot) => (
            <div key={`${slot.key}-rain`} className={`${cellBase} bg-[#ecf8f5] dark:bg-[#0e2f33] ${slot.isDayStart ? "border-l border-[#bde4dd] dark:border-white/18" : "border-l border-[#d9f0ec]/70 dark:border-white/6"}`}>
              <p className="weather-data max-w-[5.5rem] whitespace-normal text-center text-[0.7rem] leading-[1.3] text-[#0b6f63] dark:text-[#5eead4]">
                {slot.rain}
              </p>
            </div>
          ))}
        </ForecastMatrixRow>
      </div>
    </div>
  );
}

function getDayBandClasses(slot: ForecastMatrixSlot) {
  const palette = [
    "bg-[#edf4f5] dark:bg-[#0c2532]",
    "bg-[#e8f2f1] dark:bg-[#0c2a30]",
    "bg-[#eaf2f5] dark:bg-[#0d2836]",
    "bg-[#edf3ec] dark:bg-[#122a2b]",
  ];
  const tone = palette[slot.dayTone % palette.length] ?? palette[0];
  return `${tone} ${slot.isDayStart ? "border-l border-[#b9cace] dark:border-white/18" : "border-l border-transparent"}`;
}

function ForecastMatrixRow({
  label,
  columns,
  children,
  labelClassName,
  icon: Icon,
}: {
  label: string;
  columns: string;
  children: ReactNode;
  labelClassName?: string;
  icon?: ElementType;
}) {
  return (
    <div className="grid" style={{ gridTemplateColumns: columns }}>
      <div className={`flex min-h-[2.5rem] items-center gap-1.5 px-2.5 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#536b73] dark:text-[#b7cbd3] ${labelClassName ?? "bg-[#f7fbfb] dark:bg-[#0b2230]"}`}>
        {Icon ? <Icon className="size-3 shrink-0" /> : null}
        {label}
      </div>
      {children}
    </div>
  );
}

function buildForecastMatrixSlots(
  windows: ForecastWindow[],
  days: ReturnType<typeof buildFiveDayForecast>,
  snapshot: OceanConditionSnapshot,
  region: ForecastRegion,
): ForecastMatrixSlot[] {
  const regionConfig = getForecastRegionConfig(region);
  if ((region === "south" || region === "west") && hasUsableForecastWindows(windows)) {
    const localSlots = buildForecastDaypartSlots(windows, days);
    if (localSlots.length) return localSlots;
  }
  const marineSlots = buildMarineForecastPeriodSlots(
    snapshot.marineForecastDays[regionConfig.zone],
  );
  if (marineSlots.length) {
    return marineSlots;
  }

  const sampledWindows = buildForecastDaypartSlots(windows, days);

  if (sampledWindows.length) {
    return sampledWindows;
  }

  return days.slice(0, 4).map((day, index) => {
    const wind = parseWind(day.wind);
    const energy = getForecastEnergyForRows(day.groundswell, null, day.bumpEnergy);
    return {
      key: day.day,
      day: index === 0 ? `TODAY ${getForecastDateLabel(day.day, index)}` : getForecastCardLabel(day.day, index),
      isDayStart: true,
      dayTone: index,
      time: "DAY",
      windDirection: wind.direction,
      windSpeed: stripKt(wind.speed),
      gust: wind.gust === "-" ? "-" : stripKt(wind.gust),
      swellHeight: energy?.height ?? "-",
      period: energy?.period ?? "-",
      waveDirection: energy?.direction ?? "-",
      rain: day.rain,
      tone: getWindToneFromText(wind.speed, wind.gust),
    };
  });
}

function hasUsableForecastWindows(windows: ForecastWindow[]) {
  return windows.length > 0 && windows.some((window) => window.source.status !== "mock" && window.source.status !== "missing");
}

function formatLocalRainCell(shortForecast: string) {
  const normalized = shortForecast.trim().replace(/\s+/g, " ");
  if (!/\b(?:rain|showers?|thunderstorms?|drizzle)\b/i.test(normalized)) return "-";
  const rainOnly = normalized
    .replace(/\brain\s+showers?\b/gi, "showers")
    .replace(/\bchance of\b/gi, "chance")
    .trim();
  return rainOnly
    ? `${rainOnly.charAt(0).toUpperCase()}${rainOnly.slice(1)}`
    : "Showers";
}

function buildMarineForecastPeriodSlots(
  marineForecastDays: MarineForecastDay[],
): ForecastMatrixSlot[] {
  const datedPeriods = marineForecastDays.slice(0, 8).map((period) => ({
    period,
    date: getMarinePeriodDate(period.dayLabel, period.source.observedAt),
  }));
  const shownDayKeys = [...new Set(datedPeriods.map(({ date }) => formatHawaiiDateKey(date)))].slice(0, 4);
  const shownPeriods = datedPeriods.filter(({ date }) => shownDayKeys.includes(formatHawaiiDateKey(date)));
  const seenDayKeys = new Set<string>();

  return shownPeriods.map(({ period, date }, index) => {
    const dayKey = formatHawaiiDateKey(date);
    const isDayStart = !seenDayKeys.has(dayKey);
    seenDayKeys.add(dayKey);

    const windSpeed = formatMarineWindSpeed(period.wind, period.summary);
    const windDirection = period.wind.directionCardinal ?? "-";
    const energy = getForecastEnergyForRows(
      formatMarineForecastEnergy(period.groundswell),
      null,
      formatMarineForecastEnergy(period.bumpEnergy),
    );
    return {
      key: `${period.dayLabel}-${index}`,
      day: formatMatrixDayLabel(date),
      isDayStart,
      dayTone: seenDayKeys.size - 1,
      time: formatMarinePeriodLabel(period.dayLabel),
      windDirection,
      windSpeed,
      gust: period.wind.gustKt !== null ? `${Math.round(period.wind.gustKt)}` : "-",
      swellHeight: energy?.height ?? "-",
      period: energy?.period ?? "-",
      waveDirection: energy?.direction ?? "-",
      rain: formatMarineRainCell(period.rainSummary),
      tone: getWindToneFromText(
        `${windSpeed} kt`,
        period.wind.gustKt !== null ? `${period.wind.gustKt} kt` : undefined,
      ),
    };
  });
}

function formatMarineWindSpeed(wind: MarineForecastDay["wind"], summary?: string | null) {
  if (wind.speedRangeKt) return `${Math.round(wind.speedRangeKt[0])}-${Math.round(wind.speedRangeKt[1])}`;
  const upToMatch = summary?.match(/\bwinds?\s+(?:[a-z]+(?:\s+[a-z]+)?\s+)?to\s+(\d+(?:\.\d+)?)\s+knots?/i);
  if (upToMatch) return `to ${Math.round(Number.parseFloat(upToMatch[1]))}`;
  if (wind.speedKt !== null) return `${Math.round(wind.speedKt)}`;
  const normalized = summary?.toLowerCase() ?? "";
  if (normalized.includes("hurricane conditions possible")) return "Hurricane period · no wind value";
  if (normalized.includes("tropical storm conditions possible")) return "Storm period · no wind value";
  return "No wind value";
}

function formatMarineRainCell(summary: string | null) {
  if (!summary) return "-";
  const normalized = summary.trim().replace(/\s+/g, " ");
  return normalized
    ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
    : "-";
}

function formatMarinePeriodLabel(label: string) {
  const normalized = label.trim().replace(/\s+/g, " ").toUpperCase();
  if (normalized === "TODAY") return "Day";
  if (normalized === "TONIGHT") return "Tonight";
  if (normalized.includes("NIGHT")) return "Night";
  return "Day";
}

function getMarinePeriodDate(label: string, issuedAt?: string) {
  const normalized = label.trim().replace(/\s+/g, " ").toUpperCase();
  const issuedDate = issuedAt ? getHawaiiDateFromInstant(issuedAt) : getHawaiiTodayDate();
  if (normalized === "TODAY" || normalized === "TONIGHT") return issuedDate;
  return getMarineForecastDate(getWeekdayToken(normalized), 0, issuedDate);
}

function getForecastEnergyForRows(
  groundswell: ReturnType<typeof formatMarineForecastEnergy>,
  observedGroundswell: ReturnType<typeof formatSeaEnergy> | null,
  windSwell: ReturnType<typeof formatMarineForecastEnergy>,
) {
  const energy = observedGroundswell ?? (groundswell.height !== "No data" ? groundswell : windSwell);
  if (energy.height === "No data") return null;
  const metaParts = energy.meta.split("·").map((part) => part.trim()).filter(Boolean);
  return {
    height: stripFeet(energy.height),
    period: metaParts[0] ?? "-",
    direction: getCardinalDirectionFromMeta(metaParts.slice(1).join(" · ")) ?? "-",
  };
}

function buildForecastDaypartSlots(
  windows: ForecastWindow[],
  days: ReturnType<typeof buildFiveDayForecast>,
) {
  const dayparts = [
    { label: "Day", targetHour: 12 },
    { label: "Night", targetHour: 21 },
  ] as const;
  const grouped = new Map<string, ForecastWindow[]>();
  for (const window of windows) {
    const key = formatHawaiiDateKey(new Date(window.startTime));
    grouped.set(key, [...(grouped.get(key) ?? []), window]);
  }

  return days.slice(0, 4).flatMap((day, dayIndex) => {
    const weekday = getWeekdayToken(day.day.trim().replace(/\s+/g, " ").toUpperCase());
    const date = getMarineForecastDate(weekday, dayIndex);
    const dayKey = formatHawaiiDateKey(date);
    const dayWindows = grouped.get(dayKey) ?? [];
    const sorted = [...dayWindows].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const energy = getMatrixSlotEnergy(day, days, null, dayIndex);
    const parsedWind = parseWind(day.wind);
    const fallbackWindSpeed = stripKt(parsedWind.speed);
    const fallbackGust = parsedWind.gust === "-" ? "-" : stripKt(parsedWind.gust);
    const fallbackDirection = parsedWind.direction;

    if (sorted.length) {
      const picked = new Set<string>();
      return dayparts.flatMap(({ label, targetHour }) => {
        const candidate = sorted
          .filter((window) => !picked.has(window.startTime))
          .map((window) => ({
            window,
            distance: Math.abs(getHawaiiHour(new Date(window.startTime)) - targetHour),
          }))
          .sort((a, b) => a.distance - b.distance)[0]?.window;
        if (!candidate) return [];
        picked.add(candidate.startTime);
        const candidateDate = new Date(candidate.startTime);
        const windSpeed = candidate.windSpeedKt !== null ? `${Math.round(candidate.windSpeedKt)}` : fallbackWindSpeed;
        const gust = candidate.windGustKt !== null ? `${Math.round(candidate.windGustKt)}` : fallbackGust;
        const windDirection = candidate.windDirectionCardinal ?? fallbackDirection;
        return [{
          key: candidate.startTime,
          day: formatMatrixDayLabel(candidateDate),
          isDayStart: false,
          time: label,
          windDirection,
          windSpeed,
          gust,
          swellHeight: energy?.height ?? "-",
          period: energy?.period ?? "-",
          waveDirection: energy?.direction ?? "-",
          rain: formatLocalRainCell(candidate.shortForecast),
          tone: getWindToneFromText(`${windSpeed} kt`, gust !== "-" ? `${gust} kt` : undefined),
        }];
      }).map((slot, index) => ({ ...slot, isDayStart: index === 0, dayTone: dayIndex }));
    }

    return dayparts.map(({ label }) => ({
      key: `${dayKey}-${label.toLowerCase()}`,
      day: formatMatrixDayLabel(date),
      isDayStart: false,
      dayTone: dayIndex,
      time: label,
      windDirection: fallbackDirection,
      windSpeed: fallbackWindSpeed,
      gust: fallbackGust,
      swellHeight: energy?.height ?? "-",
      period: energy?.period ?? "-",
      waveDirection: energy?.direction ?? "-",
      rain: day.rain,
      tone: getWindToneFromText(parsedWind.speed, parsedWind.gust),
    })).map((slot, index) => ({ ...slot, isDayStart: index === 0 }));
  });
}

function getForecastTimelineSource(
  windows: ForecastWindow[],
): SourceLike | null {
  return windows.find((window) => window.source.sourceUrl)?.source
    ?? windows[0]?.source
    ?? null;
}

function getForecastMarineSource(
  snapshot: OceanConditionSnapshot,
  zone: Zone,
): SourceLike | null {
  return snapshot.marineForecastDays[zone].find((day) => day.source.sourceUrl)?.source
    ?? snapshot.marineForecastDays[zone][0]?.source
    ?? null;
}

function getForecastMarineZoneLabel(zone: Zone) {
  if (zone === "maalaea") return "Maalaea Bay · PHZ119";
  if (zone === "leeward") return "Maui Leeward Waters · PHZ118";
  return "Maui Windward Waters · PHZ117";
}

function ForecastZoneSourceChip({ source, label }: { source: SourceLike | null; label: string }) {
  const className = "rounded-full bg-white/65 px-2 py-0.5 text-[0.52rem] font-semibold uppercase tracking-[0.09em] text-[#61747c] ring-1 ring-[#d8dedf]/70 transition hover:text-[#0d5968] dark:bg-white/8 dark:text-[#b7cbd3] dark:ring-white/10 dark:hover:text-[#9debf9]";
  return source?.sourceUrl ? (
    <a href={source.sourceUrl} target="_blank" rel="noreferrer" className={className} title={`Open source: ${getSourceDisplayName(source)}`}>
      {label}
    </a>
  ) : (
    <span className={className}>{label}</span>
  );
}

function getMatrixSlotEnergy(
  day: ReturnType<typeof buildFiveDayForecast>[number] | undefined,
  days: ReturnType<typeof buildFiveDayForecast>,
  observedGroundswell: ReturnType<typeof formatSeaEnergy> | null,
  fallbackIndex: number,
) {
  if (day) {
    const energy = getForecastEnergyForRows(day.groundswell, observedGroundswell, day.bumpEnergy);
    if (energy) return energy;
  }
  const fallbackDay = days
    .slice(Math.max(0, fallbackIndex - 1))
    .find((candidate) => candidate.groundswell.height !== "No data" || candidate.bumpEnergy.height !== "No data")
    ?? days.find((candidate) => candidate.groundswell.height !== "No data" || candidate.bumpEnergy.height !== "No data");
  return fallbackDay
    ? getForecastEnergyForRows(fallbackDay.groundswell, observedGroundswell, fallbackDay.bumpEnergy)
    : null;
}

function formatMatrixDayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Pacific/Honolulu",
  }).format(date).replace(",", "").toUpperCase();
}

function getHawaiiHour(date: Date) {
  const hour = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: "Pacific/Honolulu",
  }).format(date);
  return Number(hour === "24" ? "0" : hour);
}

function formatHawaiiDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Honolulu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function stripKt(value: string) {
  return value.replace(/\s*kt\b/i, "").trim();
}

function stripFeet(value: string) {
  return value.replace(/\s*ft\b/i, "").trim();
}

function getForecastPowerClasses(tone: WindTone) {
  const classes = {
    light: {
      label: "light",
      background: "bg-[#f7fbf5] dark:bg-[#10251f]",
      speedText: "text-[#188268] dark:text-[#5eead4]",
      badge: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-900/30 dark:text-emerald-100 dark:ring-emerald-300/20",
    },
    clean: {
      label: "clean",
      background: "bg-[#f4fbf8] dark:bg-[#102a24]",
      speedText: "text-[#0d9684] dark:text-[#5eead4]",
      badge: "bg-teal-50 text-teal-800 ring-1 ring-teal-200/80 dark:bg-teal-900/30 dark:text-teal-100 dark:ring-teal-300/20",
    },
    medium: {
      label: "active",
      background: "bg-[#fff7e8] dark:bg-[#312414]",
      speedText: "text-[#c56a16] dark:text-[#fdba74]",
      badge: "bg-amber-50 text-amber-900 ring-1 ring-amber-200/90 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-300/20",
    },
    strong: {
      label: "strong",
      background: "bg-[#fff1eb] dark:bg-[#341b14]",
      speedText: "text-[#c54824] dark:text-[#fb9270]",
      badge: "bg-orange-50 text-orange-900 ring-1 ring-orange-200/90 dark:bg-orange-900/30 dark:text-orange-100 dark:ring-orange-300/20",
    },
    wild: {
      label: "wild",
      background: "bg-[#f7eef8] dark:bg-[#281628]",
      speedText: "text-[#9d2f7c] dark:text-[#f0abfc]",
      badge: "bg-fuchsia-50 text-fuchsia-900 ring-1 ring-fuchsia-200/90 dark:bg-fuchsia-900/30 dark:text-fuchsia-100 dark:ring-fuchsia-300/20",
    },
  } satisfies Record<WindTone, { label: string; background: string; speedText: string; badge: string }>;
  return classes[tone];
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
  fullWidth = false,
}: {
  items: Array<{ id: string; label: string; href: string }>;
  activeId: string;
  fullWidth?: boolean;
}) {
  if (fullWidth) {
    return (
      <div className="flex w-full max-w-full overflow-x-auto border-b border-[#d8dedf] dark:border-white/12">
        {items.map((item, index) => (
          <Link
            key={item.id}
            href={item.href}
            prefetch={false}
            scroll={false}
            data-preserve-forecast-scroll
            className={`relative min-w-0 flex-1 px-2 py-3 text-center text-[0.68rem] font-semibold uppercase tracking-[0.12em] transition sm:text-xs sm:tracking-[0.16em] ${
              item.id === activeId
                ? "text-[#102b3a] dark:text-white"
                : "text-[#657981] hover:text-[#102b3a] dark:text-[#9fb4bc] dark:hover:text-white"
            } ${index > 0 ? "before:absolute before:left-0 before:top-1/2 before:h-4 before:w-px before:-translate-y-1/2 before:bg-[#d8dedf] before:content-[''] dark:before:bg-white/12" : ""}`}
          >
            {item.label}
            {item.id === activeId ? (
              <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#0d9684] dark:bg-[#17d3b2]" />
            ) : null}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="inline-flex w-fit max-w-full gap-0 overflow-x-auto rounded-2xl border border-[#d8dedf] bg-[#f8fcfd]/78 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-white/12 dark:bg-[#071d2a]">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          prefetch={false}
          scroll={false}
          data-preserve-forecast-scroll
          className={`shrink-0 rounded-[0.9rem] px-2.5 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] transition sm:px-4 sm:text-xs sm:tracking-[0.14em] ${
            item.id === activeId
              ? "bg-[#102b3a] text-white shadow-[0_8px_18px_rgba(7,35,45,0.12)] dark:bg-[#17d3b2] dark:text-[#06151c]"
              : "text-[#5f7078] hover:bg-white/80 hover:text-[#102b3a] dark:text-[#b7cbd3] dark:hover:bg-white/8 dark:hover:text-white"
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
    <section className="mb-4 max-w-full overflow-hidden rounded-[0.95rem] bg-white shadow-[0_8px_20px_rgba(7,35,45,0.04)] ring-1 ring-[#d8dedf]/65 dark:bg-[#091d2b] dark:ring-white/10">
      <div className="px-3 py-2.5">
        <h3 className="text-[0.92rem] font-medium leading-tight text-[#30444c] dark:text-[#dcebef]">{shore === "north" ? "North Shore Run" : "South Side Run"}</h3>
      </div>
      <div className="grid border-t border-[#d8dedf]/60 dark:border-white/8" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((point, index) => {
          const tone = getRunWindClasses(getWindToneFromText(point.wind.speed));
          const hasDirection = hasUsableWindDirection(point.wind.direction);
          return (
            <div key={point.label} className={`min-w-0 bg-[#f8fbfb] px-3 py-3 text-center dark:bg-[#0d2533] sm:px-4 ${index > 0 ? "border-l border-[#d8dedf]/60 dark:border-white/8" : ""}`}>
              <div className="flex items-center justify-center gap-2">
                <p className="text-[0.62rem] font-semibold uppercase leading-none tracking-[0.06em] text-[#536b73] dark:text-[#b7cbd3]">{point.label}</p>
                <RunSourceAgeLink source={point.source} />
              </div>
              <div className="mx-auto mt-2 grid w-fit translate-x-2 grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-x-3">
                {hasDirection ? <WindArrow degrees={point.wind.degrees} medium className="text-[#102b3a] dark:text-[#e8f4f7]" /> : <span className="size-7" aria-hidden />}
                <div className="min-w-0 text-left">
                  <p className="weather-data whitespace-nowrap text-lg leading-none text-[#102b3a] dark:text-[#f4fbff]">{hasDirection ? point.wind.direction : "No dir"}</p>
                  <p className={`weather-data mt-1 whitespace-nowrap text-base leading-none tracking-[0.04em] ${tone.speedText}`}>{point.wind.speed}</p>
                  {point.wind.gust !== "-" ? <p className="weather-data mt-1.5 whitespace-nowrap text-[0.6rem] leading-none text-[#687980] dark:text-[#a9bdc5]">gust {point.wind.gust}</p> : null}
                </div>
                <span className="size-7" aria-hidden />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function getRunWindClasses(tone: WindTone) {
  const classes = {
    light: { speedText: "text-[#168ba5] dark:text-[#67d8ee]" },
    clean: { speedText: "text-[#2f8a46] dark:text-[#86e59a]" },
    medium: { speedText: "text-[#d97516] dark:text-[#ffb25f]" },
    strong: { speedText: "text-[#d94b24] dark:text-[#fb9270]" },
    wild: { speedText: "text-[#a52b83] dark:text-[#f0abfc]" },
  } satisfies Record<WindTone, { speedText: string }>;
  return classes[tone];
}

function RunSourceAgeLink({ source }: { source: SourceLike }) {
  const ageMinutes = getSourceAgeMinutes(source);
  const label = ageMinutes !== null ? `${ageMinutes} min ago` : source.observedAt ? formatTime(source.observedAt) : "source";
  const className = "text-[0.56rem] font-medium leading-none text-[#0d5968] underline decoration-[#0d5968]/25 underline-offset-2 transition hover:decoration-current dark:text-[#7dd3fc]";
  return source.sourceUrl ? (
    <a href={source.sourceUrl} target="_blank" rel="noreferrer" className={className} title={`Open source: ${getSourceDisplayName(source)}`}>
      {label}
    </a>
  ) : (
    <span className="text-[0.56rem] font-medium leading-none text-[#7a8990] dark:text-[#8fa8b1]">{label}</span>
  );
}

function RunSourceDisclosure({ source }: { source: SourceLike }) {
  const ageMinutes = getSourceAgeMinutes(source);
  const updated = ageMinutes !== null ? `${ageMinutes} min ago` : source.observedAt ? formatTime(source.observedAt) : "update unavailable";
  return <RunSourcePopover sourceName={getSourceDisplayName(source)} updated={updated} sourceType={source.source} sourceUrl={source.sourceUrl} />;
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
  const current = snapshot.channelCurrents[selectedChannel];
  const wind = windObservationToDisplay(forecast.wind);

  return (
    <section className="space-y-5">
      <ChannelWindCard
        name={channel.name}
        detail={channel.detail}
        wind={wind}
        source={forecast.wind.source}
        bumpEnergy={forecast.bumpEnergy}
        rainSummary={forecast.rainSummary}
        current={current}
      />
      <ChannelForecastTimeline days={forecast.forecastDays} />
    </section>
  );
}

function OffshoreWatersSection({ snapshot }: { snapshot: OceanConditionSnapshot }) {
  const stations = [
    snapshot.offshoreObservations["northern-hawaii"],
    snapshot.offshoreObservations["open-ocean-nw"],
    snapshot.offshoreObservations["southeast-hawaii"],
    snapshot.offshoreObservations["southwest-hawaii"],
  ].filter(hasUsefulOffshoreData);
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#61747c]">Offshore Waters</p>
        <h3 className="mt-1 text-xl font-semibold text-[#102b3a]">Open-ocean validation</h3>
      </div>
      <OffshoreWatersTable stations={stations} />
    </section>
  );
}

function OffshoreWatersTable({
  stations,
}: {
  stations: Array<OceanConditionSnapshot["offshoreObservations"][keyof OceanConditionSnapshot["offshoreObservations"]]>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#094c60]/12 bg-white shadow-[0_10px_24px_rgba(7,35,45,0.05)] dark:border-white/12 dark:bg-[#091d2b]">
      <table className="w-full table-fixed border-collapse text-center">
        <thead>
          <tr className="border-b border-[#094c60]/12 bg-[#edf5f6] dark:border-white/12 dark:bg-[#102a3a]">
            <th className="w-[30%] px-2 py-2.5 text-[0.56rem] font-semibold uppercase tracking-[0.08em] text-[#536b73] dark:text-[#b7cbd3] sm:px-4 sm:py-3 sm:text-[0.62rem] sm:tracking-[0.12em] lg:w-[20%] lg:py-4 lg:text-xs">Area</th>
            <th className="w-[32%] bg-[#e8f4fb] px-2 py-2.5 text-[0.56rem] font-semibold uppercase tracking-[0.08em] text-[#075985] dark:bg-[#102f46] dark:text-[#7dd3fc] sm:px-4 sm:py-3 sm:text-[0.62rem] sm:tracking-[0.12em] lg:w-[40%] lg:py-4 lg:text-xs">Swell</th>
            <th className="w-[38%] bg-[#fff7e8] px-2 py-2.5 text-[0.56rem] font-semibold uppercase tracking-[0.08em] text-[#9a4b0c] dark:bg-[#312414] dark:text-[#fdba74] sm:px-4 sm:py-3 sm:text-[0.62rem] sm:tracking-[0.12em] lg:w-[40%] lg:py-4 lg:text-xs">Wind / gust</th>
          </tr>
        </thead>
        <tbody>
          {stations.map((buoy) => {
            const swell = getOffshoreSwellMetric(buoy, null, false);
            const wind = windObservationToDisplay(buoy.wind);
            const windTone = getForecastPowerClasses(getWindToneFromText(wind.speed, wind.gust));
            return (
              <tr key={buoy.id} className="border-b border-[#094c60]/10 last:border-b-0 dark:border-white/10">
                <th className="bg-white px-2 py-3 align-middle dark:bg-[#091d2b] sm:px-4 sm:py-3.5 lg:py-5">
                  <p className="text-lg font-bold uppercase leading-none tracking-[0.06em] text-[#536b73] dark:text-[#9fb4bc] sm:text-xl lg:text-2xl">{getOffshoreDisplayName(buoy.id)}</p>
                </th>
                <td className="bg-[#f3f9fc] px-2 py-3 align-middle dark:bg-[#0d293b] sm:px-4 sm:py-3.5 lg:py-5">
                  <OffshoreObservationTimeLink source={swell?.source ?? buoy.swell.source} />
                  <p className="weather-data text-xl leading-none text-[#075985] dark:text-[#7dd3fc] sm:text-2xl lg:text-4xl">{swell?.value ?? "—"}</p>
                  <p className="mt-1 text-[0.62rem] font-semibold leading-tight text-[#536b73] dark:text-[#b7cbd3] sm:mt-1.5 sm:text-xs lg:mt-2 lg:text-base">{swell?.detail ?? "No swell data"}</p>
                </td>
                <td className={`${windTone.background} px-2 py-3 align-middle sm:px-4 sm:py-3.5 lg:py-5`}>
                  <OffshoreObservationTimeLink source={buoy.wind.source} />
                  <p className={`weather-data whitespace-nowrap text-xl leading-none ${windTone.speedText} sm:text-2xl lg:text-4xl`}>
                    {wind.speed}
                    <span className="ml-1 text-sm text-[#536b73] dark:text-[#b7cbd3] sm:text-base lg:text-xl">· {wind.direction}</span>
                  </p>
                  <p className="mt-1 text-[0.58rem] font-semibold uppercase leading-none tracking-[0.05em] text-[#8a5a45] dark:text-[#d6a38e] sm:mt-1.5 sm:text-xs lg:mt-2.5 lg:text-base">
                    Gust <span className="weather-data text-[0.68rem] normal-case tracking-normal text-[#c54824] dark:text-[#fb9270] sm:text-sm lg:text-xl">{wind.gust === "-" ? "—" : wind.gust}</span>
                  </p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OffshoreObservationTimeLink({ source }: { source: SourceLike }) {
  const ageMinutes = source.freshnessMinutes;
  const observedAt = ageMinutes !== undefined ? `${ageMinutes} min ago` : "—";
  const className = "mx-auto mb-1.5 flex w-fit justify-center text-[0.48rem] font-semibold uppercase tracking-[0.06em] text-[#0d5968] underline decoration-[#0d5968]/25 underline-offset-2 transition hover:decoration-current dark:text-[#7dd3fc] sm:text-[0.54rem] lg:mb-2 lg:text-xs";
  return source.sourceUrl ? (
    <a href={source.sourceUrl} target="_blank" rel="noreferrer" className={className} title={`Open official source: ${getSourceDisplayName(source)}`}>
      {observedAt}
    </a>
  ) : (
    <span className={`${className} no-underline`}>{observedAt}</span>
  );
}

function getOffshoreSwellMetric(
  buoy: OceanConditionSnapshot["offshoreObservations"][keyof OceanConditionSnapshot["offshoreObservations"]],
  forecastToday: MarineForecastDay | null,
  useForecastFallback: boolean,
) {
  if (useForecastFallback && forecastToday?.groundswell.heightFt !== null && forecastToday?.groundswell.heightFt !== undefined) {
    const groundswell = formatMarineForecastEnergy(forecastToday.groundswell);
    return {
      label: "Ground Swell",
      value: groundswell.height,
      detail: groundswell.meta,
      source: forecastToday.source,
    };
  }

  if (buoy.swell.heightFt !== null) {
    return {
      label: "Swell",
      value: formatFeet(buoy.swell.heightFt),
      detail: `${buoy.swell.dominantPeriodSec !== null ? `${buoy.swell.dominantPeriodSec}s` : "period unavailable"} · ${formatSwellDirection(buoy.swell.directionCardinal, buoy.swell.directionDeg)}`,
      source: buoy.swell.source,
    };
  }

  if (buoy.groundswell.heightFt !== null) {
    const groundswell = formatSeaEnergy(buoy.groundswell);
    return {
      label: "Ground Swell",
      value: groundswell.height,
      detail: groundswell.meta,
      source: buoy.groundswell.source,
    };
  }

  return null;
}

function hasUsefulOffshoreData(buoy: OceanConditionSnapshot["offshoreObservations"][keyof OceanConditionSnapshot["offshoreObservations"]]) {
  return buoy.id === "lanai-offshore" || buoy.groundswell.heightFt !== null || buoy.swell.heightFt !== null || (buoy.wind.speedKt !== null && buoy.wind.source.status === "live");
}

function getTodayMarineForecast(days: MarineForecastDay[]) {
  return days.find((day, index) => {
    const weekday = getWeekdayToken(day.dayLabel.trim().replace(/\s+/g, " ").toUpperCase());
    return formatHawaiiDateKey(getMarineForecastDate(weekday, index)) === formatHawaiiDateKey(getHawaiiTodayDate());
  }) ?? days[0] ?? null;
}

function isInactiveSource(source: SourceLike) {
  const ageMinutes = getSourceAgeMinutes(source);
  return source.status !== "live" || (ageMinutes !== null && ageMinutes > 60 * 24 * 3);
}

function getOffshoreDisplayName(id: OceanConditionSnapshot["offshoreObservations"][keyof OceanConditionSnapshot["offshoreObservations"]]["id"]) {
  const names = {
    "open-ocean-nw": "NW",
    "northern-hawaii": "N",
    "southeast-hawaii": "SE",
    "southwest-hawaii": "SW",
    "lanai-offshore": "LA",
  };
  return names[id];
}

function ChannelWindCard({
  name,
  detail,
  wind,
  source,
  bumpEnergy,
  rainSummary,
  current,
}: {
  name: string;
  detail: string;
  wind: WindDisplay;
  source: SourceLike;
  bumpEnergy: MarineForecastDay["bumpEnergy"];
  rainSummary: string | null;
  current: OceanConditionSnapshot["current"];
}) {
  const tone = getWindToneFromText(wind.speed, wind.gust);
  const classes = getWindToneClasses(tone);
  const formattedBumpEnergy = formatMarineForecastEnergy(bumpEnergy);
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
          {wind.gust !== "-" ? <p className={`mt-2 ${classes.badge} weather-data`}>gust {wind.gust}</p> : null}
        </div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <ChannelBumpMetric value={formattedBumpEnergy.height} detail={formattedBumpEnergy.meta} />
        <ChannelCurrentMetric current={current} />
        <ChannelQuickMetric icon={CloudRain} label="Showers" value={formatChannelRainValue(rainSummary)} detail="NOAA channel forecast" />
      </div>
    </article>
  );
}

function ChannelBumpMetric({ value, detail }: { value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-[#094c60]/10 bg-white/55 px-3 py-3 dark:border-white/12 dark:bg-[#102a3a]">
      <p className="inline-flex items-center gap-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-[#536b73] dark:text-[#b7cbd3]">
        <Waves className="size-3.5 shrink-0" />
        Bumps
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-blue-950 dark:text-[#e9f8fb]">
        <span className="weather-data text-3xl leading-none">{value}</span>
        <span className="weather-data text-base leading-none">{detail}</span>
      </div>
    </div>
  );
}

function ChannelCurrentMetric({ current }: { current: OceanConditionSnapshot["current"] }) {
  const hasCurrent = current.speedKt !== null;
  const direction = current.directionCardinal ?? "";
  const trend = current.trend !== "unknown" ? current.trend : "model";
  return (
    <div className="rounded-xl border border-[#094c60]/10 bg-white/55 px-3 py-3 dark:border-white/12 dark:bg-[#102a3a]">
      <p className="inline-flex items-center gap-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-[#536b73] dark:text-[#b7cbd3]">
        <Compass className="size-3.5 shrink-0" />
        Current
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[#102b3a] dark:text-[#e9f8fb]">
        {hasCurrent ? (
          <>
            <span className="weather-data text-3xl leading-none">{current.speedKt}</span>
            <span className="weather-data text-lg leading-none">kt</span>
            {direction ? <span className="weather-data text-2xl leading-none">{direction}</span> : null}
          </>
        ) : (
          <span className="weather-data text-xl leading-none">No model</span>
        )}
      </div>
      <p className="mt-1 text-xs font-semibold leading-4 text-[#536b73] dark:text-[#b7cbd3]">
        {hasCurrent ? `${trend} · PacIOOS surface model` : "PacIOOS unavailable"}
      </p>
    </div>
  );
}

function ChannelQuickMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-[#094c60]/10 bg-white/55 px-3 py-3 dark:border-white/12 dark:bg-[#102a3a]">
      <p className="flex items-center gap-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-[#536b73] dark:text-[#b7cbd3]">
        <Icon className="size-3.5 shrink-0" />
        {label}
      </p>
      <p className="mt-2 text-base font-semibold leading-5 text-[#102b3a] dark:text-[#e9f8fb]">{value}</p>
      <p className="mt-1 text-xs font-semibold leading-4 text-[#536b73] dark:text-[#b7cbd3]">
        {detail}
      </p>
    </div>
  );
}

function ChannelForecastTimeline({ days }: { days: MarineForecastDay[] }) {
  const slots = buildMarineForecastPeriodSlots(days);
  if (!slots.length) return null;
  const source = days.find((day) => day.source.sourceUrl)?.source ?? days[0]?.source ?? null;

  return (
    <section className="min-w-0 overflow-hidden">
      <div className="mb-3 flex flex-wrap items-end gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#61747c] dark:text-[#b7cbd3]">
            4 day outlook
          </span>
          <ForecastZoneSourceChip source={source} label="NOAA channel forecast" />
        </div>
      </div>
      <ForecastMatrix slots={slots} />
    </section>
  );
}

function formatChannelRainValue(summary: string | null) {
  if (!summary) return "No rain detail";
  return formatChannelRainSummary(summary).primary;
}

function formatChannelRainSummary(summary: string | null) {
  const fallback = "No rain detail";
  const text = (summary ?? fallback).trim();
  const split = text.match(/^(.*?\bshowers?)\s+(.*)$/i);
  if (split?.[1] && split[2]) {
    return {
      primary: split[1],
      secondary: split[2],
    };
  }
  return {
    primary: text,
    secondary: "",
  };
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
  const uniqueAlerts = getUniqueMarineAlerts(alerts);
  if (!uniqueAlerts.length) {
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
        {uniqueAlerts.slice(0, 2).map((alert) => (
          <li key={alert.id} className="text-sm font-semibold leading-5">
            {getFriendlyAlertLabel(alert)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActiveMarineAlerts({
  alerts,
  selectedChannel,
}: {
  alerts: OceanConditionSnapshot["alerts"];
  selectedChannel: Channel;
}) {
  const uniqueAlerts = getUniqueMarineAlerts(
    alerts.filter((alert) => isChannelMarineAlert(alert, selectedChannel)),
  ).sort(compareWeatherAlerts);
  if (!uniqueAlerts.length) return null;

  return (
    <div className="rounded-2xl border border-orange-700/25 bg-orange-50 px-4 py-3 text-[#7c2d12] dark:border-orange-300/22 dark:bg-orange-950/25 dark:text-orange-100">
      <p className="flex items-center gap-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.1em]">
        <AlertTriangle className="size-3.5" />
        Marine advisory
      </p>
      <ul className="mt-2 space-y-1">
        {uniqueAlerts.slice(0, 2).map((alert) => (
          <li key={alert.id} className="text-sm font-semibold leading-5">
            {getFriendlyAlertLabel(alert)}
          </li>
        ))}
      </ul>
    </div>
  );
}

const CHANNEL_MARINE_ZONE_IDS = new Set(["PHZ116", "PHZ117", "PHZ118", "PHZ119", "PHZ120", "PHZ121"]);
const CHANNEL_ALERT_ZONE: Record<InterIslandChannel, string> = {
  pailolo: "PHZ120",
  kaiwi: "PHZ116",
  alenuihaha: "PHZ121",
};

function isChannelMarineAlert(alert: OceanConditionSnapshot["alerts"][number], selectedChannel: Channel) {
  if (/\blocal statement\b/i.test(alert.event)) return false;

  const affectedZoneIds = (alert.affectedZones ?? [])
    .map((zoneUrl) => zoneUrl.split("/").at(-1)?.toUpperCase())
    .filter((zoneId): zoneId is string => Boolean(zoneId));

  if (affectedZoneIds.length) {
    if (selectedChannel === "offshore-waters") {
      return affectedZoneIds.some((zoneId) => CHANNEL_MARINE_ZONE_IDS.has(zoneId));
    }
    return affectedZoneIds.includes(CHANNEL_ALERT_ZONE[selectedChannel]);
  }

  return /small craft|gale|storm warning|hurricane force wind|hazardous seas|tropical storm|hurricane|special marine|marine weather/i.test(alert.event);
}

function getUniqueMarineAlerts(alerts: OceanConditionSnapshot["alerts"]) {
  const seen = new Set<string>();
  return alerts.filter((alert) => {
    const key = normalizeAlertKey(getFriendlyAlertLabel(alert));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeAlertKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isPrimaryWeatherAlert(alert: OceanConditionSnapshot["alerts"][number]) {
  return !/\blocal statement\b/i.test(alert.event);
}

function compareWeatherAlerts(
  left: OceanConditionSnapshot["alerts"][number],
  right: OceanConditionSnapshot["alerts"][number],
) {
  return getWeatherAlertOrder(left) - getWeatherAlertOrder(right);
}

function getWeatherAlertOrder(alert: OceanConditionSnapshot["alerts"][number]) {
  const event = alert.event.toLowerCase();
  if (event.includes("small craft advisory")) return 100;
  if (event.includes("high surf advisory")) return 99;

  const severityOrder: Record<string, number> = {
    extreme: 0,
    severe: 10,
    moderate: 20,
    minor: 30,
    unknown: 40,
  };
  const eventOrder = event.includes("warning") ? 0 : event.includes("watch") ? 2 : event.includes("advisory") ? 4 : 6;
  return (severityOrder[alert.severity.toLowerCase()] ?? 40) + eventOrder;
}

function getFriendlyAlertLabel(alert: OceanConditionSnapshot["alerts"][number]) {
  const text = `${alert.event} ${alert.headline}`.toLowerCase();
  if (text.includes("hydrologic outlook")) return "Heavy rain / flooding outlook";
  if (text.includes("small craft")) return "Small Craft Advisory";
  if (text.includes("high surf")) return "High Surf Advisory";
  if (text.includes("tropical storm warning")) return "Tropical Storm Warning";
  if (text.includes("tropical storm watch")) return "Tropical Storm Watch";
  if (text.includes("hurricane warning")) return "Hurricane Warning";
  if (text.includes("hurricane watch")) return "Hurricane Watch";
  return alert.event || alert.headline;
}

function formatFullSurfBriefing(value: string | null | undefined) {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text;
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
  const vessels = getHarborVesselSchedule();
  const harborShore = getHarborShore(harbor);
  const tide = snapshot.shoreTides[harborShore];
  const forecastWindows = snapshot.shoreForecastWindows[harborShore];
  const entrySwell = getHarborEntrySwell(snapshot, harborShore);
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
            {wind.gust !== "-" ? (
              <p className={`mt-2 ${classes.badge} weather-data`}>
                gust {wind.gust}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <ConditionMetric icon={Navigation} label="Entry swell" value={entrySwell.value} detail={entrySwell.detail} source={entrySwell.source} />
        <ConditionMetric icon={Waves} label="Tide" value={formatTideTrend(tide.trend)} detail={formatNextTide(tide)} source={tide.source} />
        <ConditionMetric icon={CloudRain} label="Rain / Visibility" value={formatRain(forecastWindows)} detail={getRainImpact(forecastWindows)} source={forecastWindows[0]?.source} />
      </div>
      <HarborMarineAlerts alerts={snapshot.alerts} />
      <HarborVesselActivity harborName={harbor.name} vessels={vessels} />
    </article>
  );
}

function getHarborEntrySwell(snapshot: OceanConditionSnapshot, shore: Shore) {
  const shoreOcean = getShoreOcean(snapshot, shore);
  if (!isInactiveSource(shoreOcean.swell.source) && shoreOcean.bumpEnergy.heightFt !== null) {
    const bumpEnergy = formatSeaEnergy(shoreOcean.bumpEnergy);
    return {
      value: bumpEnergy.height,
      detail: `${bumpEnergy.period} · ${bumpEnergy.direction}`,
      source: shoreOcean.bumpEnergy.source,
    };
  }
  const zone = getShoreConfig(shore).zone;
  const forecastToday = getTodayMarineForecast(snapshot.marineForecastDays[zone]);
  if (forecastToday?.bumpEnergy.heightFt !== null && forecastToday?.bumpEnergy.heightFt !== undefined) {
    const forecastEnergy = formatMarineForecastEnergy(forecastToday.bumpEnergy);
    return {
      value: forecastEnergy.height,
      detail: `${forecastEnergy.meta} · forecast`,
      source: forecastToday.source,
    };
  }
  return {
    value: "Entry swell unavailable",
    detail: "No reliable wave data right now",
    source: undefined,
  };
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
  const speed = wind.speedRangeKt
    ? formatWindRange(wind.speedRangeKt[0], wind.speedRangeKt[1])
    : wind.speedKt !== null
      ? formatWindValue(wind.speedKt)
      : "wind missing";
  return {
    direction: wind.directionCardinal ?? "-",
    speed,
    gust: wind.gustKt !== null ? formatWindValue(wind.gustKt) : "-",
    degrees: wind.directionDeg ?? 90,
    isSample: wind.source.status !== "live",
  };
}

function hasUsableWindDirection(direction: string) {
  return direction !== "-" && direction.toLowerCase() !== "no dir" && !direction.toLowerCase().includes("unavailable");
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
  snapshot,
}: {
  shoreOcean: ShoreOceanObservations;
  snapshot: OceanConditionSnapshot;
}) {
  const forecastToday = shoreOcean.buoyId === "51213" ? getTodayMarineForecast(snapshot.marineForecastDays.leeward) : null;
  const useForecastFallback = shoreOcean.buoyId === "51213" && isInactiveSource(shoreOcean.swell.source) && forecastToday;
  const liveBumpEnergy = formatSeaEnergy(shoreOcean.bumpEnergy);
  const forecastBumpEnergy = forecastToday ? formatMarineForecastEnergy(forecastToday.bumpEnergy) : null;
  const bumpEnergy = useForecastFallback ? forecastBumpEnergy : liveBumpEnergy;
  const groundswell = useForecastFallback ? formatMarineForecastEnergy(forecastToday.groundswell) : formatSeaEnergy(shoreOcean.groundswell);
  const source = useForecastFallback ? forecastToday.source : shoreOcean.swell.source;
  const bumpDetail = useForecastFallback ? forecastBumpEnergy?.meta : `${liveBumpEnergy.period} · ${liveBumpEnergy.direction}`;
  const hasBumpEnergy = useForecastFallback ? forecastToday.bumpEnergy.heightFt !== null : shoreOcean.bumpEnergy.heightFt !== null;
  const hasGroundswell = useForecastFallback ? forecastToday.groundswell.heightFt !== null : shoreOcean.groundswell.heightFt !== null;
  if (!hasBumpEnergy && !hasGroundswell) return null;

  return (
    <section className="rounded-[1.35rem] border border-blue-800/18 bg-[#dbeafe] p-5 shadow-[0_12px_28px_rgba(8,74,92,0.08)] dark:border-blue-200/20 dark:bg-[#0c2940]">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
        <div className="flex items-center gap-2 pt-1">
          <Waves className="size-5 text-blue-700" />
          <CategoryPill label="Sea Energy" tone="swell" />
        </div>
        <SourceFreshnessBadge source={source} compact />
      </div>
      {useForecastFallback ? (
        <p className="mt-3 w-fit rounded-full bg-amber-50 px-2 py-0.5 text-[0.56rem] font-semibold uppercase tracking-[0.1em] text-amber-800 ring-1 ring-amber-200/80 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-300/20">
          Forecast today · Lanai buoy inactive
        </p>
      ) : null}
      <div className={`mt-5 grid gap-3 ${hasBumpEnergy && hasGroundswell ? "sm:grid-cols-2" : ""}`}>
        {hasBumpEnergy ? (
        <div className="rounded-2xl border border-blue-900/15 bg-white/70 p-4 dark:border-blue-200/15 dark:bg-[#102f46]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-900/65">
            Wind Bumps
          </p>
          <p className="weather-data mt-2 text-4xl leading-none text-blue-950">
            {bumpEnergy?.height}
          </p>
          <p className="weather-data mt-2 text-lg text-blue-950">
            {bumpDetail}
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
  const currentValue = getCurrentDisplayParts(current);
  return (
    <section className="ocean-card rounded-[1.5rem] border border-blue-800/18 bg-[#dbeafe] p-5 dark:border-blue-200/20 dark:bg-[#0c2940]">
      <div className="flex items-center gap-2">
        <Compass className="size-5 text-blue-700" />
        <CategoryPill label={label} tone="tide" />
        <RunSourceDisclosure source={current.source} />
      </div>
      <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-blue-950">
        <span className="weather-data text-4xl leading-none">{currentValue.speed}</span>
        {currentValue.unit ? <span className="weather-data text-2xl leading-none">{currentValue.unit}</span> : null}
        {currentValue.direction ? <span className="weather-data text-3xl leading-none">{currentValue.direction}</span> : null}
      </div>
      <p className="mt-3 text-sm capitalize leading-6 text-blue-900/75">
        {current.trend === "unknown" ? getCurrentSourceLabel(current.source) : `${current.trend} · ${getCurrentSourceLabel(current.source)}`}
      </p>
    </section>
  );
}

function TideCard({ tide }: { tide: OceanConditionSnapshot["tide"] }) {
  const tideEvents = getOrderedTideEvents(tide);
  return (
    <section className="ocean-card rounded-[1.5rem] border border-indigo-800/18 bg-[#e0e7ff] p-4 dark:border-indigo-200/20 dark:bg-[#162542]">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
        <CategoryPill label="Tide" tone="tide" />
        <SourceFreshnessBadge source={tide.source} compact />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div>
          <TideTrendIcon trend={tide.trend} />
        </div>
        <p className="weather-data text-lg capitalize leading-none text-indigo-950">
          {formatTideTrend(tide.trend)}
        </p>
      </div>
      <dl className="mt-3 divide-y divide-indigo-900/10 rounded-2xl border border-indigo-800/12 bg-white/45 dark:divide-indigo-200/12 dark:border-indigo-200/12 dark:bg-[#102f46]">
        <div className="px-4 py-3">
          <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-indigo-900/55">
            Current
          </dt>
          <dd className="weather-data mt-1 text-4xl leading-none text-indigo-950">
            {formatTideHeight(tide)}
          </dd>
        </div>
        {tideEvents.map((event) => (
          <TideEventRow key={event.label} label={event.label} event={event.value} />
        ))}
      </dl>
    </section>
  );
}

function getOrderedTideEvents(tide: OceanConditionSnapshot["tide"]) {
  const low = { label: "Next low", value: tide.nextLow };
  const high = { label: "Next high", value: tide.nextHigh };

  if (tide.trend === "rising") return [high, low];
  if (tide.trend === "falling") return [low, high];

  return [low, high].sort((a, b) => {
    if (!a.value) return 1;
    if (!b.value) return -1;
    return new Date(a.value.time).getTime() - new Date(b.value.time).getTime();
  });
}

function TideEventRow({
  label,
  event,
}: {
  label: string;
  event: OceanConditionSnapshot["tide"]["nextLow"];
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-indigo-900/55">
        {label}
      </dt>
      <dd className="text-right">
        {event ? (
          <>
            <span className="weather-data block text-base leading-none tracking-[0.01em] text-indigo-950">
              {formatTime(event.time)}
            </span>
            <span className="weather-data mt-1 block text-sm leading-none text-indigo-900/70">
              {formatFeet(event.heightFt)}
            </span>
          </>
        ) : (
          <span className="weather-data text-sm text-indigo-950">not available</span>
        )}
      </dd>
    </div>
  );
}

function SourceFreshnessBadge({
  source,
  compact = false,
}: {
  source: SourceLike;
  compact?: boolean;
}) {
  const ageMinutes = getSourceAgeMinutes(source);
  const inactive = source.status === "live" && ageMinutes !== null && ageMinutes > 60 * 24 * 3;
  const freshness =
    inactive
      ? "inactive"
      : source.status === "mock"
      ? "model"
      : ageMinutes !== null
      ? `${ageMinutes} min`
      : source.observedAt
        ? formatTime(source.observedAt)
        : source.fetchedAt
          ? formatTime(source.fetchedAt)
          : "updated";
  const station = getSourceDisplayName(source);
  const statusLabel =
    inactive
      ? "source inactive"
      : source.status === "live"
      ? `Live · ${freshness}`
      : source.source.includes("MFM forecast")
        ? `Model · ${freshness}`
      : source.source.includes("Coastal Waters Forecast")
        ? `Model · ${freshness}`
      : source.source.includes("NWS hourly forecast")
        ? `Model · ${freshness}`
      : source.status === "mock"
        ? "Mock"
      : source.status === "missing" || source.status === "error"
        ? "Unavailable"
      : source.source.includes("current prediction")
          ? "NOAA prediction"
          : "Model";
  const label = `${station} · ${statusLabel}`;
  const className = inactive
    ? `inline-flex w-fit max-w-full items-center gap-1 justify-self-start rounded-full border border-red-500/45 bg-red-50 ${compact ? "px-1.5 py-0.5 text-[0.52rem]" : "px-2 py-0.5 text-[0.58rem]"} font-semibold uppercase tracking-[0.07em] text-red-800 shadow-[0_0_0_1px_rgba(220,38,38,0.06)] dark:border-red-300/45 dark:bg-red-950/35 dark:text-red-100`
    : `inline-flex w-fit max-w-full items-center gap-1 justify-self-start rounded-full border border-[#cbd9dd]/60 bg-white/42 ${compact ? "px-1.5 py-0.5 text-[0.52rem]" : "px-2 py-0.5 text-[0.58rem]"} font-medium uppercase tracking-[0.07em] text-[#5f7078] dark:border-white/10 dark:bg-[#102a3a]/54 dark:text-[#a9c0c8]`;
  const content = (
    <>
      <span className={`${compact ? "size-1" : "size-1.5"} rounded-full ${inactive ? "bg-red-600 dark:bg-red-300" : source.status === "live" ? "live-pulse bg-emerald-500 dark:bg-emerald-400" : source.status === "mock" || source.status === "stale" ? "bg-amber-500" : "bg-red-500 dark:bg-red-400"}`} />
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

function getSourceAgeMinutes(source: SourceLike) {
  if (source.freshnessMinutes !== undefined) return source.freshnessMinutes;
  const timestamp = source.observedAt ?? source.fetchedAt;
  if (!timestamp) return null;
  const age = Math.round((Date.now() - new Date(timestamp).getTime()) / 60000);
  return Number.isFinite(age) ? Math.max(0, age) : null;
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
  if (source.stationId === "nws-grid-kihei-coastal-grid") return "Kihei forecast grid";
  if (source.stationId === "nws-grid-lahaina-coastal-grid") return "Lahaina forecast grid";
  if (source.stationId === "nws-grid-kanaha-coastal-grid") return "Kanaha forecast grid";
  if (source.stationId === "HAI1121_28") return "Alalakeiki Channel";
  if (source.stationId === "HAI1119_29") return "Auau Channel";
  if (source.stationId === "pacioos-roms-maliko") return "PacIOOS ROMS · Maliko";
  if (source.stationId === "pacioos-roms-pailolo") return "PacIOOS ROMS · Pailolo";
  if (source.stationId === "pacioos-roms-kaiwi") return "PacIOOS ROMS · Kaiwi";
  if (source.stationId === "pacioos-roms-alenuihaha") return "PacIOOS ROMS · Alenuihaha";
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
      className={`inline-flex rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] ${classes[tone]}`}
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
  medium = false,
  compact = false,
  mini = false,
  className = "text-[#0d5968]",
}: {
  degrees: number;
  large?: boolean;
  medium?: boolean;
  compact?: boolean;
  mini?: boolean;
  className?: string;
}) {
  return (
    <span
      className={
        large
          ? "grid size-14 shrink-0 place-items-center"
          : medium
            ? "grid size-7 shrink-0 place-items-center"
          : mini
            ? "grid size-4 shrink-0 place-items-center"
            : compact
              ? "grid size-5 shrink-0 place-items-center"
              : "grid size-8 shrink-0 place-items-center"
      }
    >
      <ArrowUp
        className={`${large ? "size-12" : medium ? "size-6" : mini ? "size-3.5" : compact ? "size-[1.125rem]" : "size-7"} ${className}`}
        strokeWidth={large ? 3.2 : medium ? 3.05 : mini ? 2.6 : 2.9}
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
    speed: wind.speedRangeKt ? formatWindRange(wind.speedRangeKt[0], wind.speedRangeKt[1]) : formatWindValue(wind.speedKt),
    gust: wind.gustKt !== null ? formatWindValue(wind.gustKt) : "-",
    degrees: wind.directionDeg ?? fallback.degrees,
    isSample: wind.source.status !== "live",
  };
}

function getZoneWindFallback(zone: Zone): Omit<WindDisplay, "isSample"> {
  if (zone === "windward") return { direction: "ENE", speed: "18-24 kt", gust: "30 kt", degrees: 68 };
  if (zone === "maalaea") return { direction: "ENE", speed: "15-25 kt", gust: "30 kt", degrees: 68 };
  return { direction: "ESE", speed: "10-16 kt", gust: "22 kt", degrees: 113 };
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
      wind: maalaeaWind ? windObservationToVerifiedRunDisplay(maalaeaWind, 113) : missingLiveRunWind(113),
      source: maalaeaWind?.source ?? estimateSource("Maalaea estimate", shoreOcean.wind.source),
    },
    {
      label: "Kihei",
      wind: kiheiWind ? windObservationToVerifiedRunDisplay(kiheiWind, 113) : missingLiveRunWind(113),
      source: kiheiWind?.source ?? estimateSource("Kihei coastal estimate", shoreOcean.wind.source),
    },
  ];
}

function windObservationToVerifiedRunDisplay(wind: SourceWindLike, fallbackDegrees: number): WindDisplay {
  if (wind.source.status !== "live") return missingLiveRunWind(fallbackDegrees);
  return windObservationToDisplay(wind);
}

function missingLiveRunWind(degrees: number): WindDisplay {
  return {
    direction: "-",
    speed: "No live",
    gust: "-",
    degrees,
    isSample: true,
  };
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

function isLiveWindSource(source: SourceLike) {
  return source.status === "live" && !source.source.includes("NWS") && !source.source.includes("forecast");
}

function estimateSource(label: string, source: SourceLike): SourceLike {
  return {
    ...source,
    source: label,
    status: source.status === "live" ? "stale" : source.status,
  };
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

function getCurrentDisplayParts(current: OceanConditionSnapshot["current"]) {
  if (current.speedKt === null) {
    return { speed: "No current", unit: "", direction: "" };
  }

  return {
    speed: String(current.speedKt),
    unit: "kt",
    direction: current.directionCardinal ?? "",
  };
}

function formatTideHeight(tide: OceanConditionSnapshot["tide"]) {
  return tide.currentWaterLevelFt !== null
    ? formatFeet(tide.currentWaterLevelFt)
    : "Prediction only";
}

function formatFeet(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)} ft`;
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
    return "Passing showers possible";
  return "Low shower impact";
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
      const rainSummary = dayWindows
        .map((window) => formatLocalRainCell(window.shortForecast))
        .find((value) => value !== "-") ?? "-";
      const direction =
        dayWindows.find((window) => window.windDirectionCardinal)
          ?.windDirectionCardinal ?? "-";
      return {
        day: day.toUpperCase(),
        wind: `${direction} ${range(windValues)}${gustValues.length ? ` G${Math.max(...gustValues)}` : ""}`,
        rain: rainSummary,
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

function formatForecastDayLabel(label: string, index = 0) {
  const normalized = label.trim().replace(/\s+/g, " ").toUpperCase();
  const weekday = getWeekdayToken(normalized);
  const date = getMarineForecastDate(weekday, index);
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "Pacific/Honolulu",
  }).format(date);
  const dayLabel = weekday === "TODAY"
    ? new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Pacific/Honolulu" }).format(date).toUpperCase()
    : weekday.slice(0, 3);
  return `${dayLabel} ${dateLabel}`;
}

function getForecastCardLabel(label: string, index = 0) {
  return formatForecastDayLabel(label, index);
}

function getForecastDateLabel(label: string, index = 0) {
  const weekday = getWeekdayToken(label.trim().replace(/\s+/g, " ").toUpperCase());
  const date = getMarineForecastDate(weekday, index);
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "Pacific/Honolulu",
  }).format(date);
}

function getWeekdayToken(label: string) {
  return label.split(/\s+/)[0] ?? label;
}

function getMarineForecastDate(label: string, index: number, baseDate = getHawaiiTodayDate()) {
  const hawaiiToday = baseDate;
  if (label === "TODAY") return hawaiiToday;
  const weekdays = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const target = weekdays.indexOf(label);
  if (target < 0) {
    const fallback = new Date(hawaiiToday);
    fallback.setUTCDate(fallback.getUTCDate() + index);
    return fallback;
  }
  const delta = (target - hawaiiToday.getUTCDay() + 7) % 7;
  const date = new Date(hawaiiToday);
  date.setUTCDate(date.getUTCDate() + delta);
  return date;
}

function getHawaiiDateFromInstant(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date(value))
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12));
}

function getHawaiiTodayDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12));
}

function range(values: number[]) {
  if (!values.length) return "-";
  return formatWindRange(Math.min(...values), Math.max(...values));
}

function formatWindRange(min: number, max: number) {
  const roundedMin = Math.round(min);
  const roundedMax = Math.round(max);
  return roundedMin === roundedMax
    ? `${roundedMin} kt`
    : `${roundedMin}-${roundedMax} kt`;
}

function formatWindValue(value: number | null) {
  return value === null ? "-" : `${Math.round(value)} kt`;
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

function isKnownCardinalDirection(direction: string) {
  return /^(N|NNE|NE|ENE|E|ESE|SE|SSE|S|SSW|SW|WSW|W|WNW|NW|NNW)$/.test(direction);
}

function getCardinalDirectionFromMeta(value: string) {
  return value
    .split("·")
    .map((part) => part.trim())
    .find(isKnownCardinalDirection)
    ?? null;
}

type ShoreConfig = {
  id: Shore;
  label: string;
  shortLabel: string;
  secondary: string;
  zone: Zone;
};

type ForecastRegionConfig = {
  id: ForecastRegion;
  label: string;
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

function getForecastRegionConfig(region: ForecastRegion): ForecastRegionConfig {
  const configs: Record<ForecastRegion, ForecastRegionConfig> = {
    north: { id: "north", label: "North", zone: "windward" },
    south: { id: "south", label: "South", zone: "leeward" },
    east: { id: "east", label: "East", zone: "windward" },
    west: { id: "west", label: "West", zone: "leeward" },
  };
  return configs[region];
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
    return "Inter-island channels and offshore waters with wind, bump energy, current, and rain risk.";
  }
  return "Harbor wind, tide, current, visibility, vessel activity, and entry conditions.";
}

function normalizeZone(value: string | string[] | undefined): Zone {
  return value === "leeward" ? "leeward" : "windward";
}

function normalizeShore(value: string | string[] | undefined): Shore {
  if (Array.isArray(value)) return normalizeShore(value[0]);
  if (value === "south" || value === "west") return value;
  return "north";
}

function normalizeForecastRegion(value: string | string[] | undefined): ForecastRegion {
  if (Array.isArray(value)) return normalizeForecastRegion(value[0]);
  if (value === "south" || value === "east" || value === "west") return value;
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

export { normalizeChannel, normalizeForecastRegion, normalizeHarbor, normalizeShore, normalizeZone };

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
  const maalaea = leeward.map((day) => ({
    ...day,
    wind: day.wind.replace(/^ESE|^SE/, "ENE"),
    read: day.read.replace(/leeward/gi, "Maalaea").replace(/Leeward/g, "Maalaea"),
  }));
  const source = zone === "windward" ? windward : zone === "maalaea" ? maalaea : leeward;
  const hawaiiToday = getHawaiiTodayDate();

  return source.map((day, index) => ({
    ...day,
    day: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Pacific/Honolulu",
    }).format(
      addHawaiiDays(hawaiiToday, index),
    ).replace(",", "").toUpperCase(),
  }));
}

function addHawaiiDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
