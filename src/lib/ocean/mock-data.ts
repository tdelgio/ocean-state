import type {
  CurrentObservation,
  ChannelForecastObservation,
  CoastalWindObservation,
  ForecastWindow,
  HarborWindObservation,
  OceanConditionSnapshot,
  OffshoreBuoyId,
  OffshoreBuoyObservation,
  RouteConfig,
  SeaEnergyObservation,
  ShoreOceanObservations,
  SwellObservation,
  TideObservation,
  WindObservation,
} from "./types";

export const malikoNorthShoreRoute: RouteConfig = {
  id: "maui-maliko-north-shore",
  name: "Maliko / North Shore Maui",
  region: "Maui",
  start: { latitude: 20.941, longitude: -156.284 },
  finish: { latitude: 20.895, longitude: -156.469 },
  idealWindDirectionDeg: 75,
  idealWindDirectionToleranceDeg: 35,
  idealWindSpeedRangeKt: [18, 28],
  maxComfortableGustKt: 35,
  idealSwellDirectionDeg: 75,
  idealSwellDirectionToleranceDeg: 50,
  idealSwellHeightRangeFt: [3, 8],
  preferredTideTrend: ["falling", "slack"],
  stations: {
    // Pauwela buoy is the first Maui north shore ocean proxy. Confirm operational station IDs per route before production.
    primaryBuoyId: "51205",
    // Kahului Harbor / NOAA NOS 1615680 / NDBC KLIH1 is useful for finish-area wind.
    finishWindStationId: "KLIH1",
    // Kahului Harbor is the initial nearby CO-OPS tide station placeholder.
    tideStationId: "1615680",
    // Configure an active NOAA CO-OPS current station/bin only after verifying live availability.
    nwsPoint: { latitude: 20.941, longitude: -156.284 },
  },
};

const now = "2026-05-21T08:00:00-10:00";

export const mockWindObservation: WindObservation = {
  speedKt: 21,
  gustKt: 29,
  directionDeg: 75,
  directionCardinal: "ENE",
  source: {
    source: "Mock NDBC 51205",
    status: "mock",
    stationId: "51205",
    fetchedAt: now,
    observedAt: "2026-05-21T07:40:00-10:00",
    freshnessMinutes: 20,
  },
};

export const mockSwellObservation: SwellObservation = {
  heightFt: 5.8,
  dominantPeriodSec: 10,
  directionDeg: 70,
  directionCardinal: "ENE",
  waterTempF: 78.2,
  source: {
    source: "Mock NDBC 51205",
    status: "mock",
    stationId: "51205",
    fetchedAt: now,
    observedAt: "2026-05-21T07:40:00-10:00",
    freshnessMinutes: 20,
  },
};

export const mockGroundswellObservation: SeaEnergyObservation = {
  label: "groundswell",
  heightFt: 3.2,
  periodSec: 14,
  directionDeg: 350,
  directionCardinal: "N",
  description: "Long-period swell energy.",
  source: {
    source: "Mock NDBC 51205",
    status: "mock",
    stationId: "51205",
    fetchedAt: now,
    observedAt: "2026-05-21T07:40:00-10:00",
    freshnessMinutes: 20,
  },
};

export const mockBumpEnergyObservation: SeaEnergyObservation = {
  label: "bump-energy",
  heightFt: 5.8,
  periodSec: 8,
  directionDeg: 75,
  directionCardinal: "ENE",
  description: "Short-period 4-9s wind-sea texture for downwind bumps.",
  source: {
    source: "Mock NDBC 51205",
    status: "mock",
    stationId: "51205",
    fetchedAt: now,
    observedAt: "2026-05-21T07:40:00-10:00",
    freshnessMinutes: 20,
  },
};

export const mockSouthSwellObservation: SwellObservation = {
  heightFt: 3.4,
  dominantPeriodSec: 13,
  directionDeg: 205,
  directionCardinal: "SSW",
  waterTempF: 78.8,
  source: {
    source: "Mock NDBC 51213",
    status: "mock",
    stationId: "51213",
    fetchedAt: now,
    observedAt: "2026-05-21T07:40:00-10:00",
    freshnessMinutes: 20,
  },
};

export const mockSouthGroundswellObservation: SeaEnergyObservation = {
  label: "groundswell",
  heightFt: 3.4,
  periodSec: 13,
  directionDeg: 205,
  directionCardinal: "SSW",
  description: "South-side long-period swell proxy.",
  source: mockSouthSwellObservation.source,
};

export const mockSouthBumpEnergyObservation: SeaEnergyObservation = {
  label: "bump-energy",
  heightFt: 2.1,
  periodSec: 7,
  directionDeg: 115,
  directionCardinal: "ESE",
  description: "South-side short-period wind-sea proxy.",
  source: mockSouthSwellObservation.source,
};

export const mockShoreObservations: Record<"north" | "south" | "west", ShoreOceanObservations> = {
  north: {
    shoreId: "north",
    label: "North Shore",
    buoyId: "51205",
    wind: mockWindObservation,
    swell: mockSwellObservation,
    groundswell: mockGroundswellObservation,
    bumpEnergy: mockBumpEnergyObservation,
  },
  south: {
    shoreId: "south",
    label: "South Side",
    buoyId: "51213",
    wind: {
      ...mockWindObservation,
      directionDeg: 110,
      directionCardinal: "ESE",
      speedKt: 13,
      gustKt: 20,
      source: mockSouthSwellObservation.source,
    },
    swell: mockSouthSwellObservation,
    groundswell: mockSouthGroundswellObservation,
    bumpEnergy: mockSouthBumpEnergyObservation,
  },
  west: {
    shoreId: "west",
    label: "West Side",
    buoyId: "51213",
    wind: {
      ...mockWindObservation,
      directionDeg: 95,
      directionCardinal: "E",
      speedKt: 11,
      gustKt: 18,
      source: mockSouthSwellObservation.source,
    },
    swell: mockSouthSwellObservation,
    groundswell: mockSouthGroundswellObservation,
    bumpEnergy: mockSouthBumpEnergyObservation,
  },
};

export const mockOpenOceanNwSwellObservation: SwellObservation = {
  heightFt: 8.2,
  dominantPeriodSec: 16,
  directionDeg: 320,
  directionCardinal: "NW",
  waterTempF: null,
  source: {
    source: "Mock NDBC 51001",
    status: "mock",
    stationId: "51001",
    fetchedAt: now,
    observedAt: "2026-05-21T07:20:00-10:00",
    freshnessMinutes: 40,
  },
};

export const mockOpenOceanNwBumpEnergyObservation: SeaEnergyObservation = {
  label: "bump-energy",
  heightFt: 2.4,
  periodSec: 7,
  directionDeg: 80,
  directionCardinal: "E",
  description: "Open-ocean short-period wind sea proxy.",
  source: mockOpenOceanNwSwellObservation.source,
};

export const mockOpenOceanNwGroundswellObservation: SeaEnergyObservation = {
  label: "groundswell",
  heightFt: 8.2,
  periodSec: 16,
  directionDeg: 320,
  directionCardinal: "NW",
  description: "Open-ocean NW groundswell proxy.",
  source: mockOpenOceanNwSwellObservation.source,
};

export const mockOffshoreObservations: Record<OffshoreBuoyId, OffshoreBuoyObservation> = {
  "lanai-offshore": {
    id: "lanai-offshore",
    displayName: "Lanai Offshore",
    purpose: "Outer channel validation buoy between Molokai and Lanai.",
    stationId: "51213",
    wind: mockShoreObservations.south.wind,
    swell: mockSouthSwellObservation,
    groundswell: mockSouthGroundswellObservation,
    bumpEnergy: mockSouthBumpEnergyObservation,
  },
  "open-ocean-nw": {
    id: "open-ocean-nw",
    displayName: "Open Ocean NW",
    purpose: "Early North Pacific groundswell detection before Maui arrival.",
    stationId: "51001",
    wind: {
      ...mockWindObservation,
      directionDeg: 40,
      directionCardinal: "NE",
      speedKt: 18,
      gustKt: 25,
      source: mockOpenOceanNwSwellObservation.source,
    },
    swell: mockOpenOceanNwSwellObservation,
    groundswell: mockOpenOceanNwGroundswellObservation,
    bumpEnergy: mockOpenOceanNwBumpEnergyObservation,
  },
  "northern-hawaii": createMockDeepWaterBuoy("northern-hawaii", "Northern Hawaii", "51000"),
  "southwest-hawaii": createMockDeepWaterBuoy("southwest-hawaii", "Southwest Hawaii", "51002"),
  "southeast-hawaii": createMockDeepWaterBuoy("southeast-hawaii", "Southeast Hawaii", "51004"),
};

function createMockDeepWaterBuoy(id: OffshoreBuoyId, displayName: string, stationId: string): OffshoreBuoyObservation {
  return {
    id,
    displayName,
    purpose: "Deep-water NOAA station unavailable.",
    stationId,
    wind: { ...mockWindObservation, speedKt: null, gustKt: null, directionDeg: null, directionCardinal: null },
    swell: { ...mockSwellObservation, heightFt: null, dominantPeriodSec: null, directionDeg: null, directionCardinal: null },
    groundswell: { ...mockGroundswellObservation, heightFt: null, periodSec: null, directionDeg: null, directionCardinal: null },
    bumpEnergy: { ...mockBumpEnergyObservation, heightFt: null, periodSec: null, directionDeg: null, directionCardinal: null },
  };
}

function createMockChannelForecast(channelId: ChannelForecastObservation["channelId"], displayName: string): ChannelForecastObservation {
  return {
    channelId,
    displayName,
    wind: { ...mockWindObservation, speedKt: null, gustKt: null, directionDeg: null, directionCardinal: null },
    bumpEnergy: { heightFt: null, periodSec: null, directionCardinal: null },
    rainSummary: null,
    forecastDays: [],
  };
}

const mockMarineForecastDays = [
  {
    dayLabel: "TODAY",
    seas: null,
    wind: mockWindObservation,
    bumpEnergy: { heightFt: null, periodSec: null, directionCardinal: null },
    groundswell: { heightFt: null, periodSec: null, directionCardinal: null },
    rainSummary: null,
    source: mockWindObservation.source,
  },
];

export const mockTideObservation: TideObservation = {
  stationId: "1615680",
  stationName: "Kahului, Kahului Harbor, HI",
  currentWaterLevelFt: null,
  trend: "unknown",
  nextHigh: null,
  nextLow: null,
  predictions: [],
  source: {
    source: "Mock NOAA CO-OPS 1615680",
    status: "mock",
    stationId: "1615680",
    fetchedAt: now,
    observedAt: now,
    freshnessMinutes: 0,
  },
};

export const mockCurrentObservation: CurrentObservation = {
  stationId: "no-live-current-station",
  stationName: "No active Maui current sensor configured",
  speedKt: null,
  directionDeg: null,
  directionCardinal: null,
  trend: "unknown",
  source: {
    source: "NOAA CO-OPS currents",
    status: "missing",
    sourceUrl: "https://tidesandcurrents.noaa.gov/currents_info.html",
    fetchedAt: now,
  },
};

export const mockForecastWindows: ForecastWindow[] = [
  {
    startTime: "2026-05-21T11:00:00-10:00",
    endTime: "2026-05-21T14:00:00-10:00",
    windSpeedKt: 20,
    windGustKt: 28,
    windDirectionDeg: 75,
    windDirectionCardinal: "ENE",
    precipitationChancePercent: 25,
    shortForecast: "ENE trades with passing windward showers.",
    source: {
      source: "Mock NWS hourly forecast",
      status: "mock",
      fetchedAt: now,
      observedAt: now,
      freshnessMinutes: 0,
    },
  },
  {
    startTime: "2026-05-21T14:00:00-10:00",
    endTime: "2026-05-21T17:00:00-10:00",
    windSpeedKt: 24,
    windGustKt: 33,
    windDirectionDeg: 80,
    windDirectionCardinal: "E",
    precipitationChancePercent: 35,
    shortForecast: "Stronger trades, more gust spread near squalls.",
    source: {
      source: "Mock NWS hourly forecast",
      status: "mock",
      fetchedAt: now,
      observedAt: now,
      freshnessMinutes: 0,
    },
  },
];

export const mockHarborWinds: HarborWindObservation[] = [
  createMockHarborWind("kahului-harbor", "Kahului Harbor", "central", { latitude: 20.895, longitude: -156.469 }, "KLIH1"),
  createMockHarborWind("maalaea-harbor", "Maalaea Harbor", "south", { latitude: 20.790, longitude: -156.512 }),
  createMockHarborWind("mala-ramp", "Mala Ramp", "west", { latitude: 20.884, longitude: -156.686 }),
  createMockHarborWind("lahaina-harbor", "Lahaina Harbor", "west", { latitude: 20.872, longitude: -156.678 }),
];

export const mockCoastalWinds: CoastalWindObservation[] = [
  {
    id: "kanaha",
    name: "Kanaha",
    profile: "beach-launch",
    coordinates: { latitude: 20.898, longitude: -156.437 },
    note: "Mock Kanaha nearshore profile fallback. Real priority is PHOG METAR, then NWS coastal grid.",
    observation: {
      speedKt: 20,
      gustKt: 28,
      directionDeg: 75,
      directionCardinal: "ENE",
      source: {
        source: "Mock PHOG METAR · Kanaha",
        status: "mock",
        stationId: "PHOG",
        fetchedAt: now,
        observedAt: now,
        freshnessMinutes: 0,
      },
    },
  },
  {
    id: "kihei",
    name: "Kihei",
    profile: "beach-launch",
    coordinates: { latitude: 20.756, longitude: -156.457 },
    note: "Mock Kihei nearshore profile fallback. Real priority is NWS coastal grid.",
    observation: {
      speedKt: 16,
      gustKt: 23,
      directionDeg: 105,
      directionCardinal: "ESE",
      source: {
        source: "Mock NWS coastal grid · Kihei",
        status: "mock",
        fetchedAt: now,
        observedAt: now,
        freshnessMinutes: 0,
      },
    },
  },
  {
    id: "lahaina",
    name: "Lahaina",
    profile: "beach-launch",
    coordinates: { latitude: 20.872, longitude: -156.678 },
    note: "Mock Lahaina nearshore profile fallback. Real priority is NWS coastal grid.",
    observation: {
      speedKt: 11,
      gustKt: 18,
      directionDeg: 75,
      directionCardinal: "ENE",
      source: {
        source: "Mock NWS coastal grid · Lahaina",
        status: "mock",
        fetchedAt: now,
        observedAt: now,
        freshnessMinutes: 0,
      },
    },
  },
];

export function createMockOceanSnapshot(route: RouteConfig = malikoNorthShoreRoute): OceanConditionSnapshot {
  const kiheiWind = mockCoastalWinds.find((coastal) => coastal.id === "kihei")?.observation;
  const lahainaWind = mockCoastalWinds.find((coastal) => coastal.id === "lahaina")?.observation;
  return {
    route,
    generatedAt: now,
    wind: mockWindObservation,
    swell: mockSwellObservation,
    groundswell: mockGroundswellObservation,
    bumpEnergy: mockBumpEnergyObservation,
    tide: mockTideObservation,
    shoreTides: {
      north: mockTideObservation,
      south: {
        ...mockTideObservation,
        stationId: "TPT2797",
        stationName: "Kihei, Maalaea Bay",
        currentWaterLevelFt: null,
        source: {
          ...mockTideObservation.source,
          source: "Mock NOAA tide prediction · Kihei",
          stationId: "TPT2797",
        },
      },
      west: {
        ...mockTideObservation,
        stationId: "TPT2799",
        stationName: "Lahaina",
        currentWaterLevelFt: null,
        source: {
          ...mockTideObservation.source,
          source: "Mock NOAA tide prediction · Lahaina",
          stationId: "TPT2799",
        },
      },
    },
    current: mockCurrentObservation,
    shoreCurrents: {
      north: mockCurrentObservation,
      south: mockCurrentObservation,
      west: mockCurrentObservation,
    },
    shoreObservations: {
      ...mockShoreObservations,
      south: {
        ...mockShoreObservations.south,
        wind: kiheiWind ?? mockShoreObservations.south.wind,
      },
      west: {
        ...mockShoreObservations.west,
        wind: lahainaWind ?? mockShoreObservations.west.wind,
      },
    },
    offshoreObservations: mockOffshoreObservations,
    coastalWinds: mockCoastalWinds,
    harborWinds: mockHarborWinds,
    forecastWindows: mockForecastWindows,
    shoreForecastWindows: {
      north: mockForecastWindows,
      south: mockForecastWindows,
      east: mockForecastWindows,
      west: mockForecastWindows,
    },
    marineForecastDays: {
      windward: mockMarineForecastDays,
      leeward: mockMarineForecastDays,
    },
    surfOutlook: null,
    channelForecasts: {
      pailolo: createMockChannelForecast("pailolo", "Pailolo"),
      kaiwi: createMockChannelForecast("kaiwi", "Kaiwi"),
      alenuihaha: createMockChannelForecast("alenuihaha", "Alenuihaha"),
    },
    channelCurrents: {
      pailolo: mockCurrentObservation,
      kaiwi: mockCurrentObservation,
      alenuihaha: mockCurrentObservation,
    },
    alerts: [],
    sources: [
      mockWindObservation.source,
      mockSwellObservation.source,
      mockGroundswellObservation.source,
      mockBumpEnergyObservation.source,
      mockTideObservation.source,
      mockCurrentObservation.source,
      mockSouthSwellObservation.source,
      mockOpenOceanNwSwellObservation.source,
      ...mockCoastalWinds.map((coastal) => coastal.observation.source),
      ...mockHarborWinds.map((harbor) => harbor.observation.source),
      ...mockForecastWindows.map((window) => window.source),
    ],
  };
}

function createMockHarborWind(
  id: string,
  name: string,
  side: HarborWindObservation["side"],
  coordinates: HarborWindObservation["coordinates"],
  stationId?: string,
): HarborWindObservation {
  return {
    id,
    name,
    side,
    coordinates,
    note: stationId ? "Mock real-time harbor wind fallback." : "Mock NWS harbor forecast fallback.",
    observation: {
      speedKt: side === "south" ? 14 : side === "west" ? 11 : 16,
      gustKt: side === "south" ? 21 : side === "west" ? 18 : 24,
      directionDeg: side === "south" ? 95 : 75,
      directionCardinal: side === "south" ? "E" : "ENE",
      source: {
        source: stationId ? `Mock NDBC ${stationId}` : `Mock NWS proxy · ${name}`,
        status: "mock",
        stationId,
        fetchedAt: now,
        observedAt: now,
        freshnessMinutes: 0,
      },
    },
  };
}
