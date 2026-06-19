import { mockTideObservation } from "./mock-data";
import type { CurrentObservation, SourceMeta, TideEvent, TideObservation, TideTrend } from "./types";

const COOPS_API_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
const COOPS_METADATA_URL = "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations";
const COOPS_FETCH_TIMEOUT_MS = 4500;

interface CoopsPrediction {
  t: string;
  v: string;
  type?: "H" | "L";
}

interface CoopsWaterLevel {
  t: string;
  v: string;
}

interface CoopsCurrent {
  t: string;
  s?: string;
  d?: string;
  bin?: string;
}

export async function getCoopsTideObservation(stationId: string): Promise<TideObservation> {
  try {
    const [metadata, predictions, waterLevels] = await Promise.all([
      fetchStationMetadata(stationId),
      fetchTidePredictions(stationId),
      fetchCurrentWaterLevels(stationId),
    ]);
    const fetchedAt = new Date().toISOString();
    const source: SourceMeta = {
      source: "NOAA CO-OPS",
      status: "live",
      stationId,
      fetchedAt,
      sourceUrl: getCoopsStationUrl(stationId),
      observedAt: waterLevels.at(-1)?.t ? normalizeHawaiiTimestamp(waterLevels.at(-1)!.t) : undefined,
      freshnessMinutes: waterLevels.at(-1)?.t ? minutesBetween(normalizeHawaiiTimestamp(waterLevels.at(-1)!.t), fetchedAt) : undefined,
    };
    const events = predictions.map(parsePrediction).filter((event): event is TideEvent => Boolean(event));
    const currentWaterLevelFt = waterLevels.at(-1)?.v ? Number(waterLevels.at(-1)!.v) : null;
    const observedTrend = inferTideTrend(waterLevels);

    return {
      stationId,
      stationName: metadata?.name ?? stationId,
      currentWaterLevelFt: Number.isFinite(currentWaterLevelFt) ? currentWaterLevelFt : null,
      trend: observedTrend === "unknown" ? inferPredictionTrend(events) : observedTrend,
      nextHigh: findNextEvent(events, "high"),
      nextLow: findNextEvent(events, "low"),
      predictions: events,
      source,
    };
  } catch (error) {
    return {
      ...mockTideObservation,
      stationId,
      source: {
        ...mockTideObservation.source,
        stationId,
        status: "mock",
        error: error instanceof Error ? error.message : "Unknown CO-OPS error",
      },
    };
  }
}

export async function getCoopsTidePredictionObservation(stationId: string, stationName: string): Promise<TideObservation> {
  try {
    const predictions = await fetchTidePredictions(stationId);
    const fetchedAt = new Date().toISOString();
    const events = predictions.map(parsePrediction).filter((event): event is TideEvent => Boolean(event));
    return {
      stationId,
      stationName,
      currentWaterLevelFt: estimateCurrentTideHeight(events),
      trend: inferPredictionTrend(events),
      nextHigh: findNextEvent(events, "high"),
      nextLow: findNextEvent(events, "low"),
      predictions: events,
      source: {
        source: "NOAA tide prediction",
        status: "stale",
        stationId,
        sourceUrl: getCoopsStationUrl(stationId),
        fetchedAt,
      },
    };
  } catch (error) {
    return {
      stationId,
      stationName,
      currentWaterLevelFt: null,
      trend: "unknown",
      nextHigh: null,
      nextLow: null,
      predictions: [],
      source: {
        source: "NOAA tide prediction unavailable",
        stationId,
        sourceUrl: getCoopsStationUrl(stationId),
        status: "mock",
        fetchedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown CO-OPS prediction error",
      },
    };
  }
}

export async function getCoopsCurrentObservation(stationId?: string): Promise<CurrentObservation> {
  if (!stationId || stationId.startsWith("mock-")) return createUnavailableCurrentObservation(stationId);

  try {
    const [metadata, currents] = await Promise.all([
      fetchStationMetadata(stationId),
      fetchCurrentVelocity(stationId),
    ]);
    const latest = currents.at(-1);
    const fetchedAt = new Date().toISOString();
    const speedKt = latest?.s ? Number(latest.s) : null;
    const directionDeg = latest?.d ? Number(latest.d) : null;
    const source: SourceMeta = {
      source: "NOAA CO-OPS currents",
      status: "live",
      stationId,
      fetchedAt,
      sourceUrl: getCoopsStationUrl(stationId),
      observedAt: latest?.t,
      freshnessMinutes: latest?.t ? minutesBetween(latest.t, fetchedAt) : undefined,
    };

    return {
      stationId,
      stationName: metadata?.name ?? stationId,
      speedKt: Number.isFinite(speedKt) ? speedKt : null,
      directionDeg: Number.isFinite(directionDeg) ? directionDeg : null,
      directionCardinal: Number.isFinite(directionDeg) ? degreesToCardinal(directionDeg!) : null,
      trend: inferCurrentTrend(speedKt, directionDeg),
      source,
    };
  } catch (error) {
    return createUnavailableCurrentObservation(stationId, error);
  }
}

export async function getCoopsCurrentPredictionObservation(
  stationId: string,
  stationName: string,
): Promise<CurrentObservation> {
  const [station, bin] = stationId.split("_");
  const sourceUrl = `https://tidesandcurrents.noaa.gov/noaacurrents/predictions.html?id=${stationId}`;
  try {
    const response = await fetch(`${COOPS_API_URL}?${new URLSearchParams({
      begin_date: formatHawaiiDate(new Date()),
      range: "24",
      station,
      product: "currents_predictions",
      bin,
      time_zone: "lst_ldt",
      units: "english",
      format: "json",
    })}`, {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(COOPS_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`CO-OPS current prediction failed with ${response.status}`);
    const json = (await response.json()) as {
      current_predictions?: {
        cp?: Array<{
          Time: string;
          Velocity_Major: number;
          meanFloodDir: number;
          meanEbbDir: number;
        }>;
      };
    };
    const predictions = json.current_predictions?.cp ?? [];
    const now = Date.now();
    const closest = predictions.reduce<(typeof predictions)[number] | null>((best, prediction) => {
      if (!best) return prediction;
      const bestDiff = Math.abs(new Date(normalizeHawaiiTimestamp(best.Time)).getTime() - now);
      const predictionDiff = Math.abs(new Date(normalizeHawaiiTimestamp(prediction.Time)).getTime() - now);
      return predictionDiff < bestDiff ? prediction : best;
    }, null);
    if (!closest) throw new Error("CO-OPS current prediction data was empty");
    const speedKt = Math.abs(closest.Velocity_Major);
    const trend = Math.abs(closest.Velocity_Major) < 0.05 ? "slack" : closest.Velocity_Major > 0 ? "flood" : "ebb";
    const directionDeg = trend === "slack" ? null : trend === "flood" ? closest.meanFloodDir : closest.meanEbbDir;
    return {
      stationId,
      stationName,
      speedKt: Math.round(speedKt * 100) / 100,
      directionDeg,
      directionCardinal: directionDeg !== null ? degreesToCardinal(directionDeg) : null,
      trend,
      source: {
        source: "NOAA current prediction",
        status: "stale",
        stationId,
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        observedAt: normalizeHawaiiTimestamp(closest.Time),
      },
    };
  } catch (error) {
    return createUnavailableCurrentObservation(stationId, error, sourceUrl);
  }
}

async function fetchCurrentVelocity(stationId: string): Promise<CoopsCurrent[]> {
  const params = new URLSearchParams({
    product: "currents",
    application: "downwind_ai",
    date: "latest",
    station: stationId,
    time_zone: "lst_ldt",
    units: "english",
    format: "json",
  });
  const response = await fetch(`${COOPS_API_URL}?${params}`, {
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(COOPS_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`CO-OPS currents failed with ${response.status}`);
  const json = (await response.json()) as { data?: CoopsCurrent[] };
  return json.data ?? [];
}

async function fetchTidePredictions(stationId: string): Promise<CoopsPrediction[]> {
  const beginDate = formatHawaiiDate(new Date());
  const params = new URLSearchParams({
    product: "predictions",
    application: "downwind_ai",
    begin_date: beginDate,
    range: "72",
    datum: "MLLW",
    station: stationId,
    time_zone: "lst_ldt",
    units: "english",
    interval: "hilo",
    format: "json",
  });
  const response = await fetch(`${COOPS_API_URL}?${params}`, {
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(COOPS_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`CO-OPS tide predictions failed with ${response.status}`);
  const json = (await response.json()) as { predictions?: CoopsPrediction[] };
  const predictions = json.predictions ?? [];
  if (!predictions.length) throw new Error(`CO-OPS tide predictions returned no data for ${stationId}`);
  return predictions;
}

async function fetchCurrentWaterLevels(stationId: string): Promise<CoopsWaterLevel[]> {
  const params = new URLSearchParams({
    product: "water_level",
    application: "downwind_ai",
    date: "latest",
    datum: "MLLW",
    station: stationId,
    time_zone: "lst_ldt",
    units: "english",
    format: "json",
  });
  const response = await fetch(`${COOPS_API_URL}?${params}`, {
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(COOPS_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`CO-OPS water level failed with ${response.status}`);
  const json = (await response.json()) as { data?: CoopsWaterLevel[] };
  return json.data ?? [];
}

async function fetchStationMetadata(stationId: string): Promise<{ name?: string } | null> {
  const response = await fetch(`${COOPS_METADATA_URL}/${stationId}.json`, {
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(COOPS_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { stations?: Array<{ name?: string }> };
  return json.stations?.[0] ?? null;
}

function parsePrediction(prediction: CoopsPrediction): TideEvent | null {
  const heightFt = Number(prediction.v);
  if (!Number.isFinite(heightFt) || !prediction.type) return null;
  return {
    time: normalizeHawaiiTimestamp(prediction.t),
    heightFt,
    type: prediction.type === "H" ? "high" : "low",
  };
}

function normalizeHawaiiTimestamp(timestamp: string) {
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(timestamp)) return timestamp;
  return `${timestamp.replace(" ", "T")}-10:00`;
}

function formatHawaiiDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}`;
}

function createUnavailableCurrentObservation(stationId?: string, error?: unknown, sourceUrl?: string): CurrentObservation {
  return {
    stationId: stationId ?? "no-live-current-station",
    stationName: "No active Maui current sensor configured",
    speedKt: null,
    directionDeg: null,
    directionCardinal: null,
    trend: "unknown",
    source: {
      source: "NOAA CO-OPS currents",
      status: "missing",
      stationId: stationId && !stationId.startsWith("mock-") ? stationId : undefined,
      sourceUrl: sourceUrl ?? "https://tidesandcurrents.noaa.gov/currents_info.html",
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : error ? "Unknown CO-OPS currents error" : undefined,
    },
  };
}

function findNextEvent(events: TideEvent[], type: TideEvent["type"]): TideEvent | null {
  const now = Date.now();
  return events.find((event) => event.type === type && new Date(event.time).getTime() >= now) ?? null;
}

function inferTideTrend(levels: CoopsWaterLevel[]): TideTrend {
  if (levels.length < 2) return "unknown";
  const latest = Number(levels.at(-1)?.v);
  const previous = Number(levels.at(-2)?.v);
  if (!Number.isFinite(latest) || !Number.isFinite(previous)) return "unknown";
  const delta = latest - previous;
  if (Math.abs(delta) < 0.02) return "slack";
  return delta > 0 ? "rising" : "falling";
}

function inferPredictionTrend(events: TideEvent[]): TideTrend {
  const next = events.find((event) => new Date(event.time).getTime() >= Date.now());
  if (!next) return "unknown";
  return next.type === "high" ? "rising" : "falling";
}

function estimateCurrentTideHeight(events: TideEvent[]): number | null {
  const now = Date.now();
  const sorted = [...events].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const previous = [...sorted].reverse().find((event) => new Date(event.time).getTime() <= now);
  const next = sorted.find((event) => new Date(event.time).getTime() >= now);
  if (!previous || !next) return null;

  const previousTime = new Date(previous.time).getTime();
  const nextTime = new Date(next.time).getTime();
  const duration = nextTime - previousTime;
  if (duration <= 0) return previous.heightFt;

  const progress = Math.min(1, Math.max(0, (now - previousTime) / duration));
  const smoothed = (1 - Math.cos(Math.PI * progress)) / 2;
  const height = previous.heightFt + (next.heightFt - previous.heightFt) * smoothed;
  return Math.round(height * 100) / 100;
}

function getCoopsStationUrl(stationId: string) {
  return stationId.startsWith("TPT")
    ? `https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=${stationId}`
    : `https://tidesandcurrents.noaa.gov/stationhome.html?id=${stationId}`;
}

function minutesBetween(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

function inferCurrentTrend(speedKt: number | null, directionDeg: number | null): CurrentObservation["trend"] {
  if (speedKt === null || !Number.isFinite(speedKt) || speedKt < 0.2) return "slack";
  if (directionDeg === null || !Number.isFinite(directionDeg)) return "unknown";
  return directionDeg >= 90 && directionDeg <= 270 ? "flood" : "ebb";
}

function degreesToCardinal(degrees: number) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(degrees / 45) % 8];
}
