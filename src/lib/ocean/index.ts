import { getCoopsCurrentObservation, getCoopsCurrentPredictionObservation, getCoopsTideObservation, getCoopsTidePredictionObservation } from "./coops";
import { getMauiCoastalWinds } from "./coastal";
import { getMauiHarborWinds } from "./harbors";
import { getChannelForecastObservations, getMauiMarineForecastDays } from "./marine";
import { getDdFadForecastWind } from "./mfm";
import { createMockOceanSnapshot, malikoNorthShoreRoute, oahuLiveOceanRoute } from "./mock-data";
import { getNdbcObservations } from "./ndbc";
import { getNwsAlerts, getNwsCurrentWindObservation, getNwsForecastWindows } from "./nws";
import { getPacioosSurfaceCurrent } from "./pacioos";
import { scoreRoute } from "./scoring";
import type { MauiShoreId, OceanConditionSnapshot, OceanIntelligenceResult, OffshoreBuoyId, OffshoreBuoyObservation, RouteConfig, ShoreOceanObservations } from "./types";

export type {
  ForecastWindow,
  MarineForecastDay,
  OceanConditionSnapshot,
  OceanIntelligenceResult,
  RouteConfig,
  RouteScore,
  HarborWindObservation,
  CoastalWindObservation,
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
export { oahuLiveOceanRoute } from "./mock-data";
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
let snapshotCache:
  | {
      routeId: string;
      expiresAt: number;
      snapshot: OceanConditionSnapshot;
    }
  | null = null;
const inFlightSnapshots = new Map<string, Promise<OceanConditionSnapshot>>();

export async function getOceanIntelligence(route: RouteConfig = malikoNorthShoreRoute): Promise<OceanIntelligenceResult> {
  const snapshot = await getOceanConditionSnapshot(route);
  return {
    snapshot,
    score: scoreRoute(snapshot),
  };
}

export async function getOceanConditionSnapshot(route: RouteConfig = malikoNorthShoreRoute): Promise<OceanConditionSnapshot> {
  const now = Date.now();
  if (snapshotCache?.routeId === route.id && snapshotCache.expiresAt > now) {
    return snapshotCache.snapshot;
  }

  const inFlightSnapshot = inFlightSnapshots.get(route.id);
  if (inFlightSnapshot) {
    return inFlightSnapshot;
  }

  const snapshotRequest = loadOceanConditionSnapshot(route)
    .then((snapshot) => {
      snapshotCache = {
        routeId: route.id,
        expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS,
        snapshot,
      };
      return snapshot;
    })
    .finally(() => {
      inFlightSnapshots.delete(route.id);
    });

  inFlightSnapshots.set(route.id, snapshotRequest);
  return snapshotRequest;
}

async function loadOceanConditionSnapshot(route: RouteConfig): Promise<OceanConditionSnapshot> {
  if (route.id === oahuLiveOceanRoute.id) {
    return loadOahuConditionSnapshot(route);
  }

  try {
    const [buoy, southBuoy, openOceanNwBuoy, northernHawaiiBuoy, southwestHawaiiBuoy, southeastHawaiiBuoy, ddFadForecastWind, tide, southTide, westTide, current, northSurfaceCurrent, southCurrent, westCurrent, coastalWinds, harborWinds, forecastWindows, southForecastWindows, westForecastWindows, marineForecastDays, channelForecasts, alerts] = await Promise.all([
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
      getMauiCoastalWinds(),
      getMauiHarborWinds(),
      getNwsForecastWindows(route.stations.nwsPoint),
      getNwsForecastWindows({ latitude: 20.756, longitude: -156.457 }),
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
        west: westForecastWindows,
      },
      marineForecastDays,
      channelForecasts,
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
        ...coastalWinds.map((coastal) => coastal.observation.source),
        ...harborWinds.map((harbor) => harbor.observation.source),
        ...forecastWindows.map((window) => window.source),
        ...southForecastWindows.map((window) => window.source),
        ...westForecastWindows.map((window) => window.source),
        ...Object.values(channelForecasts).map((channel) => channel.wind.source),
        ...alerts.map((alert) => alert.source),
      ],
    };
  } catch {
    return createMockOceanSnapshot(route);
  }
}

async function loadOahuConditionSnapshot(route: RouteConfig): Promise<OceanConditionSnapshot> {
  try {
    const [northBuoy, windwardBuoy, southDeepBuoy, honoluluStation, openOceanNwBuoy, northWind, windwardWind, southWind, northTide, southTide, northCurrent, windwardCurrent, southCurrent, northForecastWindows, windwardForecastWindows, southForecastWindows, marineForecastDays, channelForecasts, alerts] = await Promise.all([
      getNdbcObservations("51201"),
      getNdbcObservations("51202"),
      getNdbcObservations("51002"),
      getNdbcObservations("OOUH1"),
      getNdbcObservations("51001"),
      getNwsCurrentWindObservation({ latitude: 21.665, longitude: -158.052 }, "Oahu North Shore"),
      getNwsCurrentWindObservation({ latitude: 21.414, longitude: -157.681 }, "Oahu Windward / Mokapu"),
      getNwsCurrentWindObservation({ latitude: 21.276, longitude: -157.827 }, "Oahu South Shore"),
      getCoopsTideObservation("1612480"),
      getCoopsTideObservation("1612340"),
      getCoopsCurrentObservation(),
      getCoopsCurrentObservation(),
      getCoopsCurrentObservation(),
      getNwsForecastWindows({ latitude: 21.665, longitude: -158.052 }),
      getNwsForecastWindows({ latitude: 21.414, longitude: -157.681 }),
      getNwsForecastWindows({ latitude: 21.276, longitude: -157.827 }),
      getMauiMarineForecastDays(),
      getChannelForecastObservations(),
      getNwsAlerts(route.stations.nwsPoint),
    ]);
    const generatedAt = new Date().toISOString();
    const hkWind = honoluluStation.wind.speedKt !== null ? honoluluStation.wind : windwardWind;
    const shoreObservations: Record<MauiShoreId, ShoreOceanObservations> = {
      north: createShoreObservations("north", "North Shore", "51201", northBuoy, northWind),
      south: createShoreObservations("south", "South Shore", "51002", southDeepBuoy, hkWind),
      west: createShoreObservations("west", "Windward / East", "51202", windwardBuoy, windwardWind),
    };
    const offshoreObservations: Record<OffshoreBuoyId, OffshoreBuoyObservation> = {
      "lanai-offshore": createOffshoreBuoyObservation(
        "lanai-offshore",
        "Lanai Offshore",
        "Outer channel validation buoy between Molokai and Lanai.",
        "51213",
        southDeepBuoy,
      ),
      "open-ocean-nw": createOffshoreBuoyObservation(
        "open-ocean-nw",
        "Open Ocean NW",
        "Early North Pacific groundswell detection before Oahu arrival.",
        "51001",
        openOceanNwBuoy,
      ),
      "northern-hawaii": createOffshoreBuoyObservation(
        "northern-hawaii",
        "Northern Hawaii",
        "Open-ocean trade flow and swell validation northeast of the islands.",
        "51001",
        openOceanNwBuoy,
      ),
      "southwest-hawaii": createOffshoreBuoyObservation(
        "southwest-hawaii",
        "Southwest Hawaii",
        "Deep-water validation south southwest of the islands.",
        "51002",
        southDeepBuoy,
      ),
      "southeast-hawaii": createOffshoreBuoyObservation(
        "southeast-hawaii",
        "Southeast Hawaii",
        "Deep-water validation southeast of the islands.",
        "51002",
        southDeepBuoy,
      ),
    };

    return {
      route,
      generatedAt,
      wind: northWind,
      swell: northBuoy.swell,
      groundswell: northBuoy.groundswell,
      bumpEnergy: northBuoy.bumpEnergy,
      tide: northTide,
      shoreTides: {
        north: northTide,
        south: southTide,
        west: northTide,
      },
      current: northCurrent,
      shoreCurrents: {
        north: northCurrent,
        south: southCurrent,
        west: windwardCurrent,
      },
      shoreObservations,
      offshoreObservations,
      coastalWinds: [],
      harborWinds: [
        {
          id: "honolulu-harbor",
          name: "Honolulu Harbor",
          side: "south",
          coordinates: { latitude: 21.303, longitude: -157.865 },
          observation: honoluluStation.wind,
          note: "NOAA/NOS Honolulu Harbor station OOUH1.",
        },
      ],
      forecastWindows: northForecastWindows,
      shoreForecastWindows: {
        north: northForecastWindows,
        south: southForecastWindows,
        west: windwardForecastWindows,
      },
      marineForecastDays,
      channelForecasts,
      alerts,
      sources: [
        northWind.source,
        windwardWind.source,
        southWind.source,
        northBuoy.swell.source,
        northBuoy.bumpEnergy.source,
        northBuoy.groundswell.source,
        windwardBuoy.swell.source,
        windwardBuoy.bumpEnergy.source,
        windwardBuoy.groundswell.source,
        southDeepBuoy.wind.source,
        southDeepBuoy.swell.source,
        honoluluStation.wind.source,
        openOceanNwBuoy.wind.source,
        openOceanNwBuoy.swell.source,
        northTide.source,
        southTide.source,
        ...northForecastWindows.map((window) => window.source),
        ...windwardForecastWindows.map((window) => window.source),
        ...southForecastWindows.map((window) => window.source),
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
