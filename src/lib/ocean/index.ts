import { getCoopsCurrentObservation, getCoopsCurrentPredictionObservation, getCoopsTideObservation, getCoopsTidePredictionObservation } from "./coops";
import { getMauiCoastalWinds } from "./coastal";
import { getMauiHarborWinds } from "./harbors";
import { getChannelForecastObservations, getMauiMarineForecastDays } from "./marine";
import { getDdFadForecastWind } from "./mfm";
import { createMockOceanSnapshot, malikoNorthShoreRoute } from "./mock-data";
import { getNdbcObservations } from "./ndbc";
import { getNwsAlerts, getNwsForecastWindows } from "./nws";
import { getPacioosSurfaceCurrent } from "./pacioos";
import { scoreRoute } from "./scoring";
import type { ForecastRegionId, MauiShoreId, OceanConditionSnapshot, OceanIntelligenceResult, OffshoreBuoyId, OffshoreBuoyObservation, RouteConfig, ShoreOceanObservations } from "./types";

export type {
  ForecastWindow,
  MarineForecastDay,
  OceanConditionSnapshot,
  OceanIntelligenceResult,
  RouteConfig,
  RouteScore,
  HarborWindObservation,
  CoastalWindObservation,
  ForecastRegionId,
  MauiShoreId,
  OffshoreBuoyId,
  OffshoreBuoyObservation,
  CurrentObservation,
  SeaEnergyObservation,
  ShoreOceanObservations,
  SwellObservation,
  TideObservation,
  WindObservation,
} from "./types";

export { malikoNorthShoreRoute } from "./mock-data";
export { getNdbcObservations } from "./ndbc";
export { getCoopsTideObservation } from "./coops";
export { getCoopsTidePredictionObservation } from "./coops";
export { getCoopsCurrentObservation } from "./coops";
export { getCoopsCurrentPredictionObservation } from "./coops";
export { getMauiCoastalWinds } from "./coastal";
export { getMauiHarborWinds } from "./harbors";
export { getNwsAlerts, getNwsForecastWindows } from "./nws";
export { getPacioosSurfaceCurrent } from "./pacioos";
export { scoreRoute } from "./scoring";

const SNAPSHOT_CACHE_TTL_MS = 5 * 60 * 1000;
const CHANNEL_CURRENT_POINTS = {
  pailolo: { point: { latitude: 21.17, longitude: -156.76 }, label: "Pailolo Channel" },
  kaiwi: { point: { latitude: 21.28, longitude: -157.22 }, label: "Kaiwi Channel" },
  alenuihaha: { point: { latitude: 20.28, longitude: -155.92 }, label: "Alenuihaha Channel" },
} as const;
let snapshotCache:
  | {
      routeId: string;
      expiresAt: number;
      snapshot: OceanConditionSnapshot;
    }
  | null = null;
let inFlightSnapshot: Promise<OceanConditionSnapshot> | null = null;

export async function getOceanIntelligence(route: RouteConfig = malikoNorthShoreRoute): Promise<OceanIntelligenceResult> {
  const snapshot = await getOceanConditionSnapshot(route);
  return {
    snapshot,
    score: scoreRoute(snapshot),
  };
}

export async function getOceanConditionSnapshot(route: RouteConfig = malikoNorthShoreRoute): Promise<OceanConditionSnapshot> {
  const now = Date.now();
  if (snapshotCache?.routeId === route.id && snapshotCache.expiresAt > now && !hasUnusableTide(snapshotCache.snapshot)) {
    return snapshotCache.snapshot;
  }

  if (inFlightSnapshot) {
    return inFlightSnapshot;
  }

  inFlightSnapshot = loadOceanConditionSnapshot(route)
    .then((snapshot) => {
      if (!hasUnusableTide(snapshot)) {
        snapshotCache = {
          routeId: route.id,
          expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS,
          snapshot,
        };
      }
      return snapshot;
    })
    .finally(() => {
      inFlightSnapshot = null;
    });

  return inFlightSnapshot;
}

function hasUnusableTide(snapshot: OceanConditionSnapshot) {
  return Object.values(snapshot.shoreTides).some(
    (tide) =>
      tide.source.status === "mock" ||
      tide.source.status === "missing" ||
      tide.currentWaterLevelFt === null ||
      !tide.nextHigh ||
      !tide.nextLow,
  );
}

async function loadOceanConditionSnapshot(route: RouteConfig): Promise<OceanConditionSnapshot> {
  try {
    const [buoy, southBuoy, openOceanNwBuoy, northernHawaiiBuoy, southwestHawaiiBuoy, southeastHawaiiBuoy, ddFadForecastWind, tide, southTide, westTide, current, northSurfaceCurrent, southCurrent, westCurrent, pailoloCurrent, kaiwiCurrent, alenuihahaCurrent, coastalWinds, harborWinds, forecastWindows, southForecastWindows, eastForecastWindows, westForecastWindows, marineForecastDays, channelForecasts, alerts] = await Promise.all([
      getNdbcObservations(route.stations.primaryBuoyId),
      getNdbcObservations("51213"),
      getNdbcObservations("51001"),
      getNdbcObservations("51000"),
      getNdbcObservations("51002"),
      getNdbcObservations("51004"),
      getDdFadForecastWind(),
      getCoopsTideObservation(route.stations.tideStationId),
      getCoopsTidePredictionObservation("TPT2797", "Kihei, Maalaea Bay"),
      getCoopsTidePredictionObservation("TPT2799", "Lahaina"),
      getCoopsCurrentObservation(route.stations.currentStationId),
      getPacioosSurfaceCurrent({ latitude: 21.035, longitude: -156.255 }, "Maliko / North Shore"),
      getCoopsCurrentPredictionObservation("HAI1121_28", "Alalakeiki Channel"),
      getCoopsCurrentPredictionObservation("HAI1119_29", "Auau Channel"),
      getPacioosSurfaceCurrent(CHANNEL_CURRENT_POINTS.pailolo.point, CHANNEL_CURRENT_POINTS.pailolo.label, "pacioos-roms-pailolo"),
      getPacioosSurfaceCurrent(CHANNEL_CURRENT_POINTS.kaiwi.point, CHANNEL_CURRENT_POINTS.kaiwi.label, "pacioos-roms-kaiwi"),
      getPacioosSurfaceCurrent(CHANNEL_CURRENT_POINTS.alenuihaha.point, CHANNEL_CURRENT_POINTS.alenuihaha.label, "pacioos-roms-alenuihaha"),
      getMauiCoastalWinds(),
      getMauiHarborWinds(),
      getNwsForecastWindows(route.stations.nwsPoint),
      getNwsForecastWindows({ latitude: 20.756, longitude: -156.457 }),
      getNwsForecastWindows({ latitude: 20.759, longitude: -155.988 }),
      getNwsForecastWindows({ latitude: 20.872, longitude: -156.678 }),
      getMauiMarineForecastDays(),
      getChannelForecastObservations(),
      getNwsAlerts(route.stations.nwsPoint),
    ]);
    const generatedAt = new Date().toISOString();
    const kiheiWind = coastalWinds.find((coastal) => coastal.id === "kihei")?.observation;
    const lahainaWind = coastalWinds.find((coastal) => coastal.id === "lahaina")?.observation;
    const shoreObservations: Record<MauiShoreId, ShoreOceanObservations> = {
      north: createShoreObservations("north", "North Shore", route.stations.primaryBuoyId, buoy, ddFadForecastWind),
      south: createShoreObservations("south", "South Side", "51213", southBuoy, kiheiWind),
      west: createShoreObservations("west", "West Side", "51213", southBuoy, lahainaWind),
    };
    const offshoreObservations: Record<OffshoreBuoyId, OffshoreBuoyObservation> = {
      "lanai-offshore": createOffshoreBuoyObservation(
        "lanai-offshore",
        "Lanai Offshore",
        "Outer channel validation buoy between Molokai and Lanai.",
        "51213",
        southBuoy,
      ),
      "open-ocean-nw": createOffshoreBuoyObservation(
        "open-ocean-nw",
        "Open Ocean NW",
        "Early North Pacific groundswell detection before Maui arrival.",
        "51001",
        openOceanNwBuoy,
      ),
      "northern-hawaii": createOffshoreBuoyObservation(
        "northern-hawaii",
        "Northern Hawaii",
        "Open-ocean trade flow and swell validation northeast of the islands.",
        "51000",
        northernHawaiiBuoy,
      ),
      "southwest-hawaii": createOffshoreBuoyObservation(
        "southwest-hawaii",
        "Southwest Hawaii",
        "Deep-water validation south southwest of the islands.",
        "51002",
        southwestHawaiiBuoy,
      ),
      "southeast-hawaii": createOffshoreBuoyObservation(
        "southeast-hawaii",
        "Southeast Hawaii",
        "Deep-water validation southeast of the islands.",
        "51004",
        southeastHawaiiBuoy,
      ),
    };

    return {
      route,
      generatedAt,
      wind: buoy.wind,
      swell: buoy.swell,
      groundswell: buoy.groundswell,
      bumpEnergy: buoy.bumpEnergy,
      tide,
      shoreTides: {
        north: tide,
        south: southTide,
        west: westTide,
      },
      current,
      shoreCurrents: {
        north: northSurfaceCurrent,
        south: southCurrent,
        west: westCurrent,
      },
      shoreObservations,
      offshoreObservations,
      coastalWinds,
      harborWinds,
      forecastWindows,
      shoreForecastWindows: {
        north: forecastWindows,
        south: southForecastWindows,
        east: eastForecastWindows,
        west: westForecastWindows,
      } satisfies Record<ForecastRegionId, typeof forecastWindows>,
      marineForecastDays,
      channelForecasts,
      channelCurrents: {
        pailolo: pailoloCurrent,
        kaiwi: kaiwiCurrent,
        alenuihaha: alenuihahaCurrent,
      },
      alerts,
      sources: [
        buoy.wind.source,
        buoy.swell.source,
        buoy.bumpEnergy.source,
        buoy.groundswell.source,
        southBuoy.wind.source,
        southBuoy.swell.source,
        southBuoy.bumpEnergy.source,
        southBuoy.groundswell.source,
        openOceanNwBuoy.wind.source,
        openOceanNwBuoy.swell.source,
        openOceanNwBuoy.bumpEnergy.source,
        openOceanNwBuoy.groundswell.source,
        northernHawaiiBuoy.wind.source,
        northernHawaiiBuoy.swell.source,
        southwestHawaiiBuoy.wind.source,
        southwestHawaiiBuoy.swell.source,
        southeastHawaiiBuoy.wind.source,
        southeastHawaiiBuoy.swell.source,
        ddFadForecastWind.source,
        tide.source,
        southTide.source,
        westTide.source,
        current.source,
        northSurfaceCurrent.source,
        southCurrent.source,
        westCurrent.source,
        pailoloCurrent.source,
        kaiwiCurrent.source,
        alenuihahaCurrent.source,
        ...coastalWinds.map((coastal) => coastal.observation.source),
        ...harborWinds.map((harbor) => harbor.observation.source),
        ...forecastWindows.map((window) => window.source),
        ...southForecastWindows.map((window) => window.source),
        ...eastForecastWindows.map((window) => window.source),
        ...westForecastWindows.map((window) => window.source),
        ...Object.values(channelForecasts).map((channel) => channel.wind.source),
        ...alerts.map((alert) => alert.source),
      ],
    };
  } catch {
    return createMockOceanSnapshot(route);
  }
}

function createOffshoreBuoyObservation(
  id: OffshoreBuoyId,
  displayName: string,
  purpose: string,
  stationId: string,
  observations: Awaited<ReturnType<typeof getNdbcObservations>>,
): OffshoreBuoyObservation {
  return {
    id,
    displayName,
    purpose,
    stationId,
    wind: observations.wind,
    swell: observations.swell,
    groundswell: observations.groundswell,
    bumpEnergy: observations.bumpEnergy,
  };
}

function createShoreObservations(
  shoreId: MauiShoreId,
  label: string,
  buoyId: string,
  observations: Awaited<ReturnType<typeof getNdbcObservations>>,
  coastalWind?: ShoreOceanObservations["wind"],
): ShoreOceanObservations {
  return {
    shoreId,
    label,
    buoyId,
    wind: coastalWind ?? observations.wind,
    swell: observations.swell,
    groundswell: observations.groundswell,
    bumpEnergy: observations.bumpEnergy,
  };
}
