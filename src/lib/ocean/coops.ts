import { mockTideObservation } from "./mock-data";
import type { CurrentObservation, SourceMeta, TideEvent, TideObservation, TideTrend } from "./types";

const COOPS_API_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
const COOPS_METADATA_URL = "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations";
const COOPS_HIGH_LOW_PLAIN_URL = "https://opendap.co-ops.nos.noaa.gov/axis/webservices/highlowtidepred/plain/response.jsp";
const COOPS_ERDDAP_TIDE_PREDICTIONS_URL = "https://coastwatch.pfeg.noaa.gov/erddap/tabledap/nosCoopsWLTP60.json";
const COOPS_FETCH_TIMEOUT_MS = 4500;
const COOPS_PREDICTION_TIMEOUT_MS = 9000;
const COOPS_REQUEST_HEADERS = {
  Accept: "application/json,text/plain,*/*",
  "User-Agent": "OceanState/0.1 (feedback@oceanstate.live)",
};

interface CoopsPrediction {
  t: string;
  v: string;
  type?: string;
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

interface ErddapTableResponse {
  table?: {
    columnNames?: string[];
    rows?: unknown[][];
  };
}

export async function getCoopsTideObservation(stationId: string): Promise<TideObservation> {
  try {
    const [metadataResult, predictionsResult, waterLevelsResult] = await Promise.allSettled([
      fetchStationMetadata(stationId),
      fetchTidePredictions(stationId),
      fetchCurrentWaterLevels(stationId),
    ]);
    const metadata = metadataResult.status === "fulfilled" ? metadataResult.value : null;
    const predictions = predictionsResult.status === "fulfilled" ? predictionsResult.value : [];
    const waterLevels = waterLevelsResult.status === "fulfilled" ? waterLevelsResult.value : [];
    if (!predictions.length && !waterLevels.length) {
      throw new Error("CO-OPS tide observation returned no usable tide or water-level data");
    }
    const fetchedAt = new Date().toISOString();
    const source: SourceMeta = {
      source: "NOAA CO-OPS",
      status: waterLevels.length ? "live" : "stale",
      stationId,
      fetchedAt,
      sourceUrl: getCoopsStationUrl(stationId),
      observedAt: waterLevels.at(-1)?.t ? normalizeHawaiiTimestamp(waterLevels.at(-1)!.t) : undefined,
      freshnessMinutes: waterLevels.at(-1)?.t ? minutesBetween(normalizeHawaiiTimestamp(waterLevels.at(-1)!.t), fetchedAt) : undefined,
    };
    const events = parsePredictions(predictions);
    const currentWaterLevelFt = waterLevels.at(-1)?.v ? Number(waterLevels.at(-1)!.v) : null;
    const observedTrend = inferTideTrend(waterLevels);

    return {
      stationId,
      stationName: metadata?.name ?? stationId,
      currentWaterLevelFt: Number.isFinite(currentWaterLevelFt) ? currentWaterLevelFt : estimateCurrentTideHeight(events),
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
    const predictions = await fetchTidePredictionsWithSubordinateFallback(stationId);
    const fetchedAt = new Date().toISOString();
    const events = parsePredictions(predictions);
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

async function fetchTidePredictionsWithSubordinateFallback(stationId: string): Promise<CoopsPrediction[]> {
  const offset = getKnownSubordinateTideOffset(stationId);

  try {
    return await fetchTidePredictions(stationId);
  } catch (error) {
    if (offset) {
      const referencePredictions = await fetchTidePredictions(offset.referenceStationId);
      return withInferredPredictionTypes(referencePredictions).map((prediction) => applySubordinateTideOffset(prediction, offset));
    }
    throw error;
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
      headers: COOPS_REQUEST_HEADERS,
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
    headers: COOPS_REQUEST_HEADERS,
    signal: AbortSignal.timeout(COOPS_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`CO-OPS currents failed with ${response.status}`);
  const json = (await response.json()) as { data?: CoopsCurrent[] };
  return json.data ?? [];
}

async function fetchTidePredictions(stationId: string): Promise<CoopsPrediction[]> {
  const beginDate = formatHawaiiDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const endDate = formatHawaiiDate(new Date(Date.now() + 72 * 60 * 60 * 1000));
  const today = formatHawaiiDate(new Date());
  const primaryDatum = stationId.startsWith("TPT") ? "STND" : "MLLW";
  const secondaryDatum = primaryDatum === "STND" ? "MLLW" : "STND";
  const predictionQueries: Array<() => Promise<CoopsPrediction[]>> = [
    () => fetchTidePredictionsForQuery(stationId, { begin_date: beginDate, end_date: endDate, time_zone: "lst", datum: primaryDatum }),
    () => fetchTidePredictionsForQuery(stationId, { begin_date: today, range: "96", time_zone: "lst", datum: primaryDatum }),
    () => fetchTidePredictionsForQuery(stationId, { begin_date: beginDate, end_date: endDate, time_zone: "lst", datum: secondaryDatum }),
    () => fetchTidePredictionsForQuery(stationId, { begin_date: today, range: "96", time_zone: "lst", datum: secondaryDatum }),
    () => fetchErddapTidePredictions(stationId),
    () => fetchPlainHighLowTidePredictions(stationId),
  ];
  let firstError: unknown = null;
  for (const query of predictionQueries) {
    try {
      const predictions = await query();
      if (predictions.length && parsePredictions(predictions).length) return predictions;
    } catch (error) {
      firstError ??= error;
    }
  }

  throw new Error(
    firstError instanceof Error
      ? firstError.message
      : `CO-OPS tide predictions returned no data for ${stationId}`,
  );
}

async function fetchTidePredictionsForQuery(
  stationId: string,
  query: Record<string, string>,
): Promise<CoopsPrediction[]> {
  const params = new URLSearchParams({
    product: "predictions",
    application: "downwind_ai",
    datum: "MLLW",
    station: stationId,
    time_zone: "lst_ldt",
    units: "english",
    format: "json",
    ...query,
  });
  if (query.datum === "") params.delete("datum");
  if (!params.has("interval")) params.set("interval", "hilo");
  const response = await fetch(`${COOPS_API_URL}?${params}`, {
    cache: "no-store",
    headers: COOPS_REQUEST_HEADERS,
    signal: AbortSignal.timeout(COOPS_PREDICTION_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`CO-OPS tide predictions failed with ${response.status}`);
  const json = (await response.json()) as { error?: { message?: string }; predictions?: CoopsPrediction[] };
  if (json.error?.message) throw new Error(json.error.message);
  const predictions = json.predictions ?? [];
  if (!predictions.length) throw new Error(`CO-OPS tide predictions returned no data for ${stationId}`);
  return predictions;
}

async function fetchPlainHighLowTidePredictions(stationId: string): Promise<CoopsPrediction[]> {
  const params = new URLSearchParams({
    stationId,
    beginDate: `${formatHawaiiDate(new Date(Date.now() - 24 * 60 * 60 * 1000))} 00:00`,
    endDate: `${formatHawaiiDate(new Date(Date.now() + 72 * 60 * 60 * 1000))} 23:59`,
    datum: "0",
    unit: "0",
    timeZone: "0",
    metadata: "yes",
  });
  const response = await fetch(`${COOPS_HIGH_LOW_PLAIN_URL}?${params}`, {
    cache: "no-store",
    headers: COOPS_REQUEST_HEADERS,
    signal: AbortSignal.timeout(COOPS_PREDICTION_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`CO-OPS high/low tide service failed with ${response.status}`);
  const text = await response.text();
  const predictions = parsePlainHighLowPredictions(text);
  if (!predictions.length) throw new Error(`CO-OPS high/low tide service returned no data for ${stationId}`);
  return predictions;
}

function parsePlainHighLowPredictions(text: string): CoopsPrediction[] {
  const predictions: CoopsPrediction[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let currentDate: string | null = null;
  let pendingTime: string | null = null;
  let pendingValue: string | null = null;

  for (const line of lines) {
    const dateMatch = line.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dateMatch) {
      currentDate = `${dateMatch[3]}-${dateMatch[1]}-${dateMatch[2]}`;
      continue;
    }
    const timeMatch = line.match(/Time\s*:\s*((?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\s+)?(\d{1,2}:\d{2})(?:\s*([AP]M))?/i);
    if (timeMatch) {
      const inlineDate = timeMatch[1]?.trim();
      if (inlineDate) currentDate = normalizePlainPredictionDate(inlineDate);
      pendingTime = normalizePlainPredictionTime(timeMatch[2], timeMatch[3]);
      continue;
    }
    const valueMatch = line.match(/Pred\s*:\s*(-?\d+(?:\.\d+)?)/i);
    if (valueMatch) {
      pendingValue = valueMatch[1];
      continue;
    }
    const typeMatch = line.match(/Type\s*:\s*([HL])/i);
    if (typeMatch && currentDate && pendingTime && pendingValue) {
      predictions.push({
        t: `${currentDate} ${pendingTime}`,
        v: pendingValue,
        type: typeMatch[1].toUpperCase(),
      });
      pendingTime = null;
      pendingValue = null;
    }
  }

  return predictions;
}

function normalizePlainPredictionDate(date: string) {
  const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return date;
  const usMatch = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (usMatch) return `${usMatch[3]}-${usMatch[1]}-${usMatch[2]}`;
  return date;
}

function normalizePlainPredictionTime(time: string, meridiem?: string) {
  const [hourValue, minute = "00"] = time.split(":");
  let hour = Number(hourValue);
  const normalizedMeridiem = meridiem?.toUpperCase();
  if (normalizedMeridiem === "PM" && hour < 12) hour += 12;
  if (normalizedMeridiem === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

async function fetchErddapTidePredictions(stationId: string): Promise<CoopsPrediction[]> {
  const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const query = [
    "stationID,time,predictedWL",
    `stationID=${encodeURIComponent(`"${stationId}"`)}`,
    `time%3E=${encodeURIComponent(start)}`,
    `time%3C=${encodeURIComponent(end)}`,
    `datum=${encodeURIComponent('"MLLW"')}`,
  ].join("&");
  const response = await fetch(`${COOPS_ERDDAP_TIDE_PREDICTIONS_URL}?${query}`, {
    cache: "no-store",
    headers: COOPS_REQUEST_HEADERS,
    signal: AbortSignal.timeout(COOPS_PREDICTION_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`NOAA ERDDAP tide predictions failed with ${response.status}`);
  const json = (await response.json()) as ErddapTableResponse;
  const columns = json.table?.columnNames ?? [];
  const rows = json.table?.rows ?? [];
  const stationIndex = columns.indexOf("stationID");
  const timeIndex = columns.indexOf("time");
  const waterLevelIndex = columns.indexOf("predictedWL");
  if (stationIndex < 0 || timeIndex < 0 || waterLevelIndex < 0 || !rows.length) {
    throw new Error(`NOAA ERDDAP tide predictions returned no usable rows for ${stationId}`);
  }

  const points = rows
    .map((row) => ({
      stationId: String(row[stationIndex] ?? ""),
      time: String(row[timeIndex] ?? ""),
      heightMeters: Number(row[waterLevelIndex]),
    }))
    .filter((point) => point.stationId === stationId && point.time && Number.isFinite(point.heightMeters))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return extractTideExtrema(points);
}

function extractTideExtrema(points: Array<{ time: string; heightMeters: number }>): CoopsPrediction[] {
  const extrema: CoopsPrediction[] = [];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const type = current.heightMeters >= previous.heightMeters && current.heightMeters >= next.heightMeters
      ? "H"
      : current.heightMeters <= previous.heightMeters && current.heightMeters <= next.heightMeters
        ? "L"
        : null;
    if (!type) continue;
    extrema.push({
      t: formatNoaaLocalTimestamp(new Date(current.time)),
      v: (current.heightMeters * 3.28084).toFixed(3),
      type,
    });
  }
  if (!extrema.length) throw new Error("NOAA ERDDAP tide predictions did not contain high/low extrema");
  return extrema;
}

async function fetchCurrentWaterLevels(stationId: string): Promise<CoopsWaterLevel[]> {
  const params = new URLSearchParams({
    product: "water_level",
    application: "downwind_ai",
    date: "recent",
    datum: "MLLW",
    station: stationId,
    time_zone: "lst_ldt",
    units: "english",
    format: "json",
  });
  const response = await fetch(`${COOPS_API_URL}?${params}`, {
    cache: "no-store",
    headers: COOPS_REQUEST_HEADERS,
    signal: AbortSignal.timeout(COOPS_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`CO-OPS water level failed with ${response.status}`);
  const json = (await response.json()) as { data?: CoopsWaterLevel[] };
  return json.data ?? [];
}

async function fetchStationMetadata(stationId: string): Promise<{ name?: string } | null> {
  const response = await fetch(`${COOPS_METADATA_URL}/${stationId}.json`, {
    next: { revalidate: 86400 },
    headers: COOPS_REQUEST_HEADERS,
    signal: AbortSignal.timeout(COOPS_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { stations?: Array<{ name?: string }> };
  return json.stations?.[0] ?? null;
}

function parsePredictions(predictions: CoopsPrediction[]): TideEvent[] {
  return withInferredPredictionTypes(predictions)
    .map((prediction) => {
      const heightFt = Number(prediction.v);
      const type = String(prediction.type ?? "").trim().toUpperCase();
      if (!Number.isFinite(heightFt) || (type !== "H" && type !== "L")) return null;
      return {
        time: normalizeHawaiiTimestamp(prediction.t),
        heightFt,
        type: type === "H" ? "high" : "low",
      } satisfies TideEvent;
    })
    .filter((event): event is TideEvent => Boolean(event));
}

function withInferredPredictionTypes(predictions: CoopsPrediction[]): CoopsPrediction[] {
  const parsed = predictions
    .map((prediction, index) => ({
      index,
      prediction,
      heightFt: Number(prediction.v),
      timeMs: new Date(normalizeHawaiiTimestamp(prediction.t)).getTime(),
      type: normalizePredictionType(prediction.type),
    }))
    .filter((item) => Number.isFinite(item.heightFt) && Number.isFinite(item.timeMs))
    .sort((a, b) => a.timeMs - b.timeMs);

  return parsed.map((item, index) => {
    if (item.type) return { ...item.prediction, type: item.type };
    const previous = parsed[index - 1];
    const next = parsed[index + 1];
    const inferredType = inferPredictionTypeFromNeighbors(item.heightFt, previous?.heightFt, next?.heightFt);
    return { ...item.prediction, type: inferredType ?? undefined };
  });
}

function normalizePredictionType(type?: string): "H" | "L" | null {
  const normalized = String(type ?? "").trim().toUpperCase();
  if (normalized === "H" || normalized === "HIGH") return "H";
  if (normalized === "L" || normalized === "LOW") return "L";
  return null;
}

function inferPredictionTypeFromNeighbors(heightFt: number, previousHeightFt?: number, nextHeightFt?: number): "H" | "L" | null {
  if (previousHeightFt !== undefined && nextHeightFt !== undefined) {
    if (heightFt >= previousHeightFt && heightFt >= nextHeightFt) return "H";
    if (heightFt <= previousHeightFt && heightFt <= nextHeightFt) return "L";
  }
  if (nextHeightFt !== undefined) return heightFt > nextHeightFt ? "H" : "L";
  if (previousHeightFt !== undefined) return heightFt > previousHeightFt ? "H" : "L";
  return null;
}

type SubordinateTideOffset = {
  referenceStationId: string;
  highTimeOffsetMinutes: number;
  lowTimeOffsetMinutes: number;
  highHeightMultiplier: number;
  lowHeightMultiplier: number;
};

function getKnownSubordinateTideOffset(stationId: string): SubordinateTideOffset | null {
  const offsets: Record<string, SubordinateTideOffset> = {
    TPT2797: {
      referenceStationId: "1615680",
      highTimeOffsetMinutes: 112,
      lowTimeOffsetMinutes: 79,
      highHeightMultiplier: 0.94,
      lowHeightMultiplier: 0.54,
    },
    TPT2799: {
      referenceStationId: "1615680",
      highTimeOffsetMinutes: 78,
      lowTimeOffsetMinutes: 61,
      highHeightMultiplier: 0.89,
      lowHeightMultiplier: 0.81,
    },
  };
  return offsets[stationId] ?? null;
}

function applySubordinateTideOffset(prediction: CoopsPrediction, offset: SubordinateTideOffset): CoopsPrediction {
  if (!prediction.type) return prediction;
  const heightFt = Number(prediction.v);
  const timeOffsetMinutes = prediction.type === "H" ? offset.highTimeOffsetMinutes : offset.lowTimeOffsetMinutes;
  const heightMultiplier = prediction.type === "H" ? offset.highHeightMultiplier : offset.lowHeightMultiplier;
  const adjustedTime = new Date(normalizeHawaiiTimestamp(prediction.t));
  adjustedTime.setMinutes(adjustedTime.getMinutes() + timeOffsetMinutes);

  return {
    ...prediction,
    t: formatNoaaLocalTimestamp(adjustedTime),
    v: Number.isFinite(heightFt) ? (heightFt * heightMultiplier).toFixed(3) : prediction.v,
  };
}

function normalizeHawaiiTimestamp(timestamp: string) {
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(timestamp)) return timestamp;
  const twelveHourMatch = timestamp
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2})(?::\d{2})?\s*([AP]M)$/i);
  if (twelveHourMatch) {
    const date = normalizePlainPredictionDate(twelveHourMatch[1]);
    const time = normalizePlainPredictionTime(twelveHourMatch[2], twelveHourMatch[3]);
    return `${date}T${time}:00-10:00`;
  }
  const twentyFourHourMatch = timestamp
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2})(?::\d{2})?$/);
  if (twentyFourHourMatch) {
    const date = normalizePlainPredictionDate(twentyFourHourMatch[1]);
    const [hour, minute] = twentyFourHourMatch[2].split(":");
    return `${date}T${hour.padStart(2, "0")}:${minute}:00-10:00`;
  }
  return `${timestamp.replace(" ", "T")}-10:00`;
}

function formatNoaaLocalTimestamp(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Pacific/Honolulu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
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
