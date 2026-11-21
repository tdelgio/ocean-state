import {
  BUOY_FRESH_MINUTES,
  OBSERVATION_EXPIRED_MINUTES,
  OBSERVATION_FRESH_MINUTES,
  formatLastReading,
  isBuoySource,
  isBuoyStationId,
  isFreshBuoySource,
  isNdbcSource,
  isWavesOnlyWindSource,
} from "./source-label";
import type { SourceMeta } from "./types";

export type DataHealthState = "healthy" | "delayed" | "expired" | "down" | "unavailable" | "sample";
export type DataHealthCategory = "observation" | "forecast" | "model" | "other";

export type DataHealthSource = {
  id: string;
  name: string;
  stationId?: string;
  sourceUrl?: string;
  category: DataHealthCategory;
  state: DataHealthState;
  ageMinutes: number | null;
  observedAt?: string;
  detail: string;
};

export type DataHealthReport = {
  sources: DataHealthSource[];
  counts: Record<DataHealthState, number>;
  overall: Exclude<DataHealthState, "sample">;
};

const STATE_ORDER: Record<DataHealthState, number> = {
  down: 0,
  unavailable: 1,
  expired: 2,
  delayed: 3,
  sample: 4,
  healthy: 5,
};

export function buildDataHealthReport(sources: SourceMeta[], generatedAt: string): DataHealthReport {
  const uniqueSources = dedupeSources(sources).filter((source) => !isExcludedHealthSource(source));
  const healthSources = dedupeBuoys(uniqueSources.map((source) => toDataHealthSource(source, generatedAt)))
    .sort((left, right) => {
      const byState = STATE_ORDER[left.state] - STATE_ORDER[right.state];
      if (byState !== 0) return byState;
      return left.name.localeCompare(right.name);
    });

  const counts = healthSources.reduce<Record<DataHealthState, number>>(
    (totals, source) => {
      totals[source.state] += 1;
      return totals;
    },
    { healthy: 0, delayed: 0, expired: 0, down: 0, unavailable: 0, sample: 0 },
  );

  const overall = counts.unavailable > 0 ? "unavailable" : counts.down > 0 ? "down" : counts.expired > 0 || counts.delayed > 0 || counts.sample > 0 ? "delayed" : "healthy";
  return { sources: healthSources, counts, overall };
}

const BUOY_STATION_NAMES: Record<string, string> = {
  "51205": "Pauwela Buoy",
  "51213": "Lanai Offshore Buoy",
  "51201": "Waimea Bay Buoy",
  "51000": "Northern Hawaii Buoy",
  "51001": "Open Ocean NW Buoy",
  "51002": "Southwest Hawaii Buoy",
  "51004": "Southeast Hawaii Buoy",
};

function dedupeBuoys(sources: DataHealthSource[]) {
  const buoys = new Map<string, DataHealthSource>();
  const rest: DataHealthSource[] = [];

  for (const source of sources) {
    if (!source.stationId || !isBuoyStationId(source.stationId)) {
      rest.push(source);
      continue;
    }
    const existing = buoys.get(source.stationId);
    if (!existing || preferBuoyStatus(source, existing)) {
      buoys.set(source.stationId, {
        ...source,
        id: `buoy-${source.stationId}`,
        name: BUOY_STATION_NAMES[source.stationId] ?? source.name,
      });
    }
  }

  return [...rest, ...buoys.values()];
}

function preferBuoyStatus(candidate: DataHealthSource, current: DataHealthSource) {
  const byState = STATE_ORDER[candidate.state] - STATE_ORDER[current.state];
  if (byState !== 0) return byState < 0;
  return observationTime(candidate) > observationTime(current);
}

function observationTime(source: DataHealthSource) {
  if (!source.observedAt) return 0;
  const value = new Date(source.observedAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function dedupeSources(sources: SourceMeta[]) {
  const unique = new Map<string, SourceMeta>();

  for (const source of sources) {
    const key = [source.source, source.stationId ?? "", source.sourceUrl ?? ""].join("|");
    const existing = unique.get(key);
    if (!existing || getTimestamp(source) > getTimestamp(existing)) unique.set(key, source);
  }

  return [...unique.values()];
}

function toDataHealthSource(source: SourceMeta, generatedAt: string): DataHealthSource {
  const ageMinutes = getAgeMinutes(source, generatedAt);
  const category = getCategory(source.source);
  const state = getHealthState(source, ageMinutes, category);

  return {
    id: [source.source, source.stationId ?? "", source.sourceUrl ?? ""].join("-"),
    name: getDisplayName(source),
    stationId: source.stationId,
    sourceUrl: source.sourceUrl,
    category,
    state,
    ageMinutes,
    observedAt: source.observedAt,
    detail: getStateDetail(state, category, ageMinutes),
  };
}

function isUnconfiguredCurrentSource(source: SourceMeta): boolean {
  const name = source.source.toLowerCase();
  if (!name.includes("co-ops") || !name.includes("current")) return false;
  return !source.stationId || source.stationId.startsWith("mock-") || source.stationId === "no-live-current-station";
}

function isExcludedHealthSource(source: SourceMeta): boolean {
  return isWavesOnlyWindSource(source) || isUnconfiguredCurrentSource(source);
}

function getHealthState(source: SourceMeta, ageMinutes: number | null, category: DataHealthCategory): DataHealthState {
  if (source.status === "mock") return "sample";
  if (isBuoySource(source)) return isFreshBuoySource(source) ? "healthy" : "down";
  if (source.status === "missing" || source.status === "error") return "unavailable";

  const { fresh, expired } = getThresholds(category, source.source);
  if (ageMinutes === null) return source.status === "live" ? "delayed" : "unavailable";
  if (ageMinutes > expired) return "expired";
  if (ageMinutes > fresh) return "delayed";
  return "healthy";
}

function getThresholds(category: DataHealthCategory, sourceName: string) {
  const normalized = sourceName.toLowerCase();
  if (normalized.includes("alert")) return { fresh: 15, expired: 30 };
  if (category === "observation") {
    return isNdbcSource({ source: sourceName })
      ? { fresh: BUOY_FRESH_MINUTES, expired: OBSERVATION_EXPIRED_MINUTES }
      : { fresh: OBSERVATION_FRESH_MINUTES, expired: OBSERVATION_EXPIRED_MINUTES };
  }
  if (category === "model") return { fresh: 360, expired: 24 * 60 };
  if (category === "forecast") return { fresh: 360, expired: 12 * 60 };
  return { fresh: 90, expired: 6 * 60 };
}

function getCategory(sourceName: string): DataHealthCategory {
  const normalized = sourceName.toLowerCase();
  if (normalized.includes("pacioos") || normalized.includes("roms") || normalized.includes("model")) return "model";
  if (
    normalized.includes("forecast") ||
    normalized.includes("prediction") ||
    normalized.includes("cwf") ||
    normalized.includes("mfm") ||
    normalized.includes("coastal grid") ||
    normalized.includes("surf")
  ) {
    return "forecast";
  }
  if (normalized.includes("ndbc") || normalized.includes("metar") || normalized.includes("co-ops") || normalized.includes("tide")) return "observation";
  return "other";
}

function getDisplayName(source: SourceMeta) {
  const stationNames: Record<string, string> = {
    "51205": "Pauwela Buoy",
    "51213": "Lanai Offshore Buoy",
    "51201": "Waimea Bay Buoy",
    "51000": "Northern Hawaii Buoy",
    "51001": "Open Ocean NW Buoy",
    "51002": "Southwest Hawaii Buoy",
    "51004": "Southeast Hawaii Buoy",
    KLIH1: "Kahului Harbor",
    PHOG: "Kahului Airport",
    "1615680": "Kahului Tide",
  };

  const stationName = source.stationId && stationNames[source.stationId];
  if (!stationName) return source.source.replace(/\s*·\s*standard wave fallback/i, "");

  const normalized = source.source.toLowerCase();
  if (normalized.includes("standard wave fallback")) return `${stationName} wave partition`;
  if (normalized.includes("spectral") || normalized.includes("spectrum")) return `${stationName} spectrum`;
  if (normalized.includes("wave")) return `${stationName} waves`;
  if (normalized.includes("wind") || normalized.includes("ndbc realtime") || normalized.includes("latest observation")) return `${stationName} wind`;
  return stationName;
}

function getStateDetail(state: DataHealthState, category: DataHealthCategory, ageMinutes: number | null) {
  if (state === "healthy") return category === "observation" ? "Recent observation" : "Within its update window";
  if (state === "delayed") return "Older than its normal update window";
  if (state === "expired") return ageMinutes !== null ? formatLastReading(ageMinutes) : "Expired";
  if (state === "down") return ageMinutes !== null ? formatLastReading(ageMinutes) : "No report";
  if (state === "sample") return "Fallback sample — not live data";
  return "No trustworthy current value";
}

function getAgeMinutes(source: SourceMeta, generatedAt: string) {
  if (source.observedAt) {
    if (source.freshnessMinutes !== undefined) return Math.max(0, Math.round(source.freshnessMinutes));
    const age = Math.round((new Date(generatedAt).getTime() - new Date(source.observedAt).getTime()) / 60000);
    return Number.isFinite(age) ? Math.max(0, age) : null;
  }
  if (source.status === "missing" || source.status === "error") return null;
  if (source.freshnessMinutes !== undefined) return Math.max(0, Math.round(source.freshnessMinutes));
  const age = Math.round((new Date(generatedAt).getTime() - new Date(source.fetchedAt).getTime()) / 60000);
  return Number.isFinite(age) ? Math.max(0, age) : null;
}

function getTimestamp(source: SourceMeta) {
  const timestamp = source.observedAt ?? source.fetchedAt;
  const value = new Date(timestamp).getTime();
  return Number.isFinite(value) ? value : 0;
}
