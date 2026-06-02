import { mockBumpEnergyObservation, mockGroundswellObservation, mockSwellObservation } from "./mock-data";
import type { SeaEnergyObservation, SourceMeta, SwellObservation, WindObservation } from "./types";

const NDBC_REALTIME_BASE_URL = "https://www.ndbc.noaa.gov/data/realtime2";
const NDBC_LATEST_OBS_BASE_URL = "https://www.ndbc.noaa.gov/data/latest_obs";
const NDBC_STATION_PAGE_URL = "https://www.ndbc.noaa.gov/station_page.php";
const NDBC_FETCH_TIMEOUT_MS = 4500;
const NDBC_SPECTRAL_TIMEOUT_MS = 3000;

interface NdbcParsedRow {
  observedAt: string;
  waveObservedAt: string | null;
  windDirectionDeg: number | null;
  windSpeedKt: number | null;
  gustKt: number | null;
  waveHeightFt: number | null;
  dominantPeriodSec: number | null;
  meanWaveDirectionDeg: number | null;
  waterTempF: number | null;
}

interface NdbcSpectralPartition {
  bumpEnergy: SeaEnergyObservation;
  groundswell: SeaEnergyObservation;
}

export async function fetchNdbcRealtimeText(stationId: string): Promise<string> {
  const response = await fetch(`${NDBC_REALTIME_BASE_URL}/${stationId}.txt`, {
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(NDBC_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`NDBC ${stationId} request failed with ${response.status}`);
  }

  return response.text();
}

export async function fetchNdbcSpectralText(stationId: string): Promise<string> {
  const response = await fetch(`${NDBC_REALTIME_BASE_URL}/${stationId}.data_spec`, {
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(NDBC_SPECTRAL_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`NDBC ${stationId} spectral request failed with ${response.status}`);
  }

  return response.text();
}

export async function fetchNdbcStationPageHtml(stationId: string): Promise<string> {
  const response = await fetch(`${NDBC_STATION_PAGE_URL}?station=${stationId.toLowerCase()}`, {
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(NDBC_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`NDBC ${stationId} station page request failed with ${response.status}`);
  }

  return response.text();
}

export async function fetchNdbcLatestObservationText(stationId: string): Promise<string> {
  const response = await fetch(`${NDBC_LATEST_OBS_BASE_URL}/${stationId.toLowerCase()}.txt`, {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(NDBC_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`NDBC ${stationId} latest observation request failed with ${response.status}`);
  }

  return response.text();
}

export async function getNdbcObservations(stationId: string): Promise<{
  wind: WindObservation;
  swell: SwellObservation;
  bumpEnergy: SeaEnergyObservation;
  groundswell: SeaEnergyObservation;
}> {
  try {
    const text = await fetchNdbcRealtimeText(stationId);
    const row = parseLatestNdbcRow(text);
    const fetchedAt = new Date().toISOString();
    if (!row) {
      const stationPageWind = await getNdbcLatestObservationWind(stationId);
      if (stationPageWind) {
        const unavailableRealtimeError = new Error(`NDBC ${stationId} had no parseable realtime wave rows`);
        return {
          wind: stationPageWind,
          swell: withError(mockSwellObservation, stationId, unavailableRealtimeError),
          bumpEnergy: withSeaEnergyError(mockBumpEnergyObservation, stationId, unavailableRealtimeError),
          groundswell: withSeaEnergyError(mockGroundswellObservation, stationId, unavailableRealtimeError),
        };
      }
      throw new Error(`NDBC ${stationId} had no parseable realtime rows`);
    }
    const stationPageWind = row.windSpeedKt === null ? await getNdbcLatestObservationWind(stationId) : null;
    const source =
      stationPageWind?.source ??
      createSource(
        row.windSpeedKt !== null ? "NDBC realtime" : "NDBC realtime wind unavailable",
        row.windSpeedKt !== null ? "live" : "missing",
        stationId,
        fetchedAt,
        row.observedAt,
      );

    const swellSource = createSource("NDBC realtime waves", "live", stationId, fetchedAt, row.waveObservedAt ?? row.observedAt);
    const swell: SwellObservation = {
      heightFt: row.waveHeightFt,
      dominantPeriodSec: row.dominantPeriodSec,
      directionDeg: row.meanWaveDirectionDeg,
      directionCardinal: degreesToCardinal(row.meanWaveDirectionDeg),
      waterTempF: row.waterTempF,
      source: swellSource,
    };
    const spectral = await getNdbcSpectralPartitions(stationId, swell);

    return {
      wind: {
        speedKt: stationPageWind?.speedKt ?? row.windSpeedKt,
        gustKt: stationPageWind?.gustKt ?? row.gustKt,
        directionDeg: stationPageWind?.directionDeg ?? row.windDirectionDeg,
        directionCardinal: stationPageWind?.directionCardinal ?? degreesToCardinal(row.windDirectionDeg),
        source,
      },
      swell,
      bumpEnergy: spectral.bumpEnergy,
      groundswell: spectral.groundswell,
    };
  } catch (error) {
    const latestObservationWind = await getNdbcLatestObservationWind(stationId);
    return {
      wind: latestObservationWind ?? createUnavailableWindObservation(stationId, error),
      swell: withError(mockSwellObservation, stationId, error),
      bumpEnergy: withSeaEnergyError(mockBumpEnergyObservation, stationId, error),
      groundswell: withSeaEnergyError(mockGroundswellObservation, stationId, error),
    };
  }
}

async function getNdbcLatestObservationWind(stationId: string): Promise<WindObservation | null> {
  try {
    const text = await fetchNdbcLatestObservationText(stationId);
    return parseNdbcLatestObservationWind(text, stationId);
  } catch {
    return getNdbcStationPageWind(stationId);
  }
}

export function parseNdbcLatestObservationWind(text: string, stationId: string): WindObservation | null {
  const wind = text.match(/Wind:\s*([A-Z]+)\s*\((\d+(?:\.\d+)?)°\),\s*(\d+(?:\.\d+)?)\s*kt/i);
  const observed = text.match(/(\d{4})\s*GMT\s*(\d{2})\/(\d{2})\/(\d{2})/i);
  if (!wind) return null;

  const fetchedAt = new Date().toISOString();
  const observedAt = observed ? `20${observed[4]}-${observed[2]}-${observed[3]}T${observed[1]}:00:00Z` : undefined;
  const directionDeg = Number(wind[2]);

  return {
    speedKt: Number(wind[3]),
    gustKt: null,
    directionDeg,
    directionCardinal: wind[1].toUpperCase() || degreesToCardinal(directionDeg),
    source: createSource("NDBC latest observation", "live", stationId, fetchedAt, observedAt),
  };
}

async function getNdbcStationPageWind(stationId: string): Promise<WindObservation | null> {
  try {
    const html = await fetchNdbcStationPageHtml(stationId);
    return parseNdbcStationPageWind(html, stationId);
  } catch {
    return null;
  }
}

function createUnavailableWindObservation(stationId: string, error: unknown): WindObservation {
  return {
    speedKt: null,
    gustKt: null,
    directionDeg: null,
    directionCardinal: null,
    source: {
      source: "NDBC wind unavailable",
      status: "missing",
      stationId,
      sourceUrl: `${NDBC_STATION_PAGE_URL}?station=${stationId.toLowerCase()}`,
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown NDBC error",
    },
  };
}

export function parseNdbcStationPageWind(html: string, stationId: string): WindObservation | null {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const direction = text.match(/Wind Direction \(WDIR\):\s*([A-Z]+)\s*\(\s*(\d+(?:\.\d+)?)\s*deg true\s*\)/i);
  const speed = text.match(/Wind Speed \(WSPD\):\s*(\d+(?:\.\d+)?)\s*kts/i);
  const gust = text.match(/Wind Gust \(GST\):\s*(\d+(?:\.\d+)?)\s*kts/i);
  const observed = text.match(/(\d{4})\s*GMT on\s*(\d{2})\/(\d{2})\/(\d{4})/i);

  if (!direction || !speed) return null;

  const fetchedAt = new Date().toISOString();
  const observedAt = observed ? `${observed[4]}-${observed[2]}-${observed[3]}T${observed[1]}:00:00Z` : undefined;
  const directionDeg = Number(direction[2]);

  return {
    speedKt: Number(speed[1]),
    gustKt: gust ? Number(gust[1]) : null,
    directionDeg,
    directionCardinal: direction[1].toUpperCase() || degreesToCardinal(directionDeg),
    source: createSource("NDBC station recent data", "live", stationId, fetchedAt, observedAt),
  };
}

async function getNdbcSpectralPartitions(stationId: string, swell: SwellObservation): Promise<NdbcSpectralPartition> {
  try {
    const text = await fetchNdbcSpectralText(stationId);
    const parsed = parseLatestNdbcSpectralRow(text);
    if (!parsed) throw new Error(`NDBC ${stationId} had no parseable spectral row`);

    const fetchedAt = new Date().toISOString();
    const source = createSource("NDBC raw spectral", "live", stationId, fetchedAt, parsed.observedAt);
    const bumpHeightFt = spectralHeightFeet(parsed.samples, 4, 9);
    const groundHeightFt = spectralHeightFeet(parsed.samples, 10, Infinity);

    return {
      bumpEnergy: {
        label: "bump-energy",
        heightFt: bumpHeightFt,
        periodSec: dominantPeriodInRange(parsed.samples, 4, 9),
        directionDeg: swell.directionDeg,
        directionCardinal: swell.directionCardinal,
        description: bumpHeightFt === null ? "No separate 4-9s bump partition in spectral data." : "4-9s short-period wind sea from NDBC spectral density.",
        source,
      },
      groundswell: {
        label: "groundswell",
        heightFt: groundHeightFt,
        periodSec: dominantPeriodInRange(parsed.samples, 10, Infinity),
        directionDeg: swell.directionDeg,
        directionCardinal: swell.directionCardinal,
        description: groundHeightFt === null ? "No separate groundswell partition." : "10s+ long-period swell from NDBC spectral density.",
        source,
      },
    };
  } catch {
    return partitionFromStandardSwell(swell);
  }
}

export function parseLatestNdbcRow(text: string): NdbcParsedRow | null {
  const rows = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/\s+/));

  const latest = rows[0];
  if (!latest || latest.length < 9) return null;

  const waveRow = rows.find((row) => numberOrNull(row[8]) !== null) ?? latest;
  const waterTempRow = rows.find((row) => numberOrNull(row[15]) !== null) ?? latest;

  return {
    observedAt: parseNdbcTimestamp(latest),
    waveObservedAt: numberOrNull(waveRow[8]) !== null ? parseNdbcTimestamp(waveRow) : null,
    windDirectionDeg: numberOrNull(latest[5]),
    windSpeedKt: metersPerSecondToKnots(numberOrNull(latest[6])),
    gustKt: metersPerSecondToKnots(numberOrNull(latest[7])),
    waveHeightFt: metersToFeet(numberOrNull(waveRow[8])),
    dominantPeriodSec: numberOrNull(waveRow[9]),
    meanWaveDirectionDeg: numberOrNull(waveRow[11]),
    waterTempF: celsiusToFahrenheit(numberOrNull(waterTempRow[15])),
  };
}

function parseNdbcTimestamp(row: string[]) {
  const [year, month, day, hour, minute] = row;
  return `${year}-${month}-${day}T${hour}:${minute}:00Z`;
}

export function degreesToCardinal(degrees: number | null): string | null {
  if (degrees === null) return null;
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return directions[Math.round(degrees / 22.5) % 16];
}

export function parseLatestNdbcSpectralRow(text: string): {
  observedAt: string;
  samples: Array<{ frequencyHz: number; density: number }>;
} | null {
  const latest = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));
  if (!latest) return null;

  const values = latest.split(/\s+/);
  if (values.length < 8) return null;
  const [year, month, day, hour] = values;
  const minuteCandidate = numberOrNull(values[4]);
  const hasMinute = minuteCandidate !== null && minuteCandidate >= 0 && minuteCandidate <= 59;
  const minute = hasMinute ? values[4] : "00";
  const firstSpectralValueIndex = hasMinute ? 6 : 5;
  const samples: Array<{ frequencyHz: number; density: number }> = [];

  for (let index = firstSpectralValueIndex; index < values.length - 1; index += 2) {
    const frequencyHz = numberOrNull(values[index]);
    const density = numberOrNull(values[index + 1]);
    if (frequencyHz !== null && density !== null && frequencyHz > 0 && density >= 0) {
      samples.push({ frequencyHz, density });
    }
  }

  if (!samples.length) return null;

  return {
    observedAt: `${year}-${month}-${day}T${hour}:${minute}:00Z`,
    samples,
  };
}

function createSource(source: string, status: SourceMeta["status"], stationId: string, fetchedAt: string, observedAt?: string): SourceMeta {
  return {
    source,
    status,
    stationId,
    sourceUrl: `https://www.ndbc.noaa.gov/station_page.php?station=${stationId.toLowerCase()}`,
    fetchedAt,
    observedAt,
    freshnessMinutes: observedAt ? minutesBetween(observedAt, fetchedAt) : undefined,
  };
}

function withError<T extends WindObservation | SwellObservation>(observation: T, stationId: string, error: unknown): T {
  return {
    ...observation,
    ...("heightFt" in observation
      ? {
          heightFt: null,
          dominantPeriodSec: null,
          directionDeg: null,
          directionCardinal: null,
          waterTempF: null,
        }
      : {
          speedKt: null,
          gustKt: null,
          directionDeg: null,
          directionCardinal: null,
        }),
    source: {
      ...observation.source,
      stationId,
      sourceUrl: `https://www.ndbc.noaa.gov/station_page.php?station=${stationId.toLowerCase()}`,
      status: "missing",
      error: error instanceof Error ? error.message : "Unknown NDBC error",
    },
  };
}

function withSeaEnergyError(observation: SeaEnergyObservation, stationId: string, error: unknown): SeaEnergyObservation {
  return {
    ...observation,
    heightFt: null,
    periodSec: null,
    directionDeg: null,
    directionCardinal: null,
    source: {
      ...observation.source,
      stationId,
      sourceUrl: `https://www.ndbc.noaa.gov/station_page.php?station=${stationId.toLowerCase()}`,
      status: "missing",
      error: error instanceof Error ? error.message : "Unknown NDBC spectral error",
    },
  };
}

function partitionFromStandardSwell(swell: SwellObservation): NdbcSpectralPartition {
  const period = swell.dominantPeriodSec;
  const isBump = period !== null && period >= 4 && period <= 9;
  const isGround = period !== null && period >= 10;
  const fallbackSource = {
    ...swell.source,
    source: `${swell.source.source} · standard wave fallback`,
  };

  return {
    bumpEnergy: {
      label: "bump-energy",
      heightFt: isBump ? swell.heightFt : null,
      periodSec: isBump ? period : null,
      directionDeg: isBump ? swell.directionDeg : null,
      directionCardinal: isBump ? swell.directionCardinal : null,
      description: isBump ? "Dominant wave period is short-period wind sea." : "No separate 4-9s bump partition from standard buoy data.",
      source: fallbackSource,
    },
    groundswell: {
      label: "groundswell",
      heightFt: isGround ? swell.heightFt : null,
      periodSec: isGround ? period : null,
      directionDeg: isGround ? swell.directionDeg : null,
      directionCardinal: isGround ? swell.directionCardinal : null,
      description: isGround ? "Dominant wave period is 10s+ long-period swell." : "No separate groundswell partition.",
      source: fallbackSource,
    },
  };
}

function spectralHeightFeet(samples: Array<{ frequencyHz: number; density: number }>, minPeriodSec: number, maxPeriodSec: number) {
  const filtered = samples
    .map((sample, index) => ({ ...sample, index, periodSec: 1 / sample.frequencyHz }))
    .filter((sample) => sample.periodSec >= minPeriodSec && sample.periodSec <= maxPeriodSec);
  if (!filtered.length) return null;

  const m0 = filtered.reduce((sum, sample) => {
    const width = frequencyBinWidth(samples, sample.index);
    return sum + sample.density * width;
  }, 0);
  if (m0 <= 0) return null;
  return metersToFeet(4 * Math.sqrt(m0));
}

function dominantPeriodInRange(samples: Array<{ frequencyHz: number; density: number }>, minPeriodSec: number, maxPeriodSec: number) {
  const dominant = samples
    .map((sample) => ({ ...sample, periodSec: 1 / sample.frequencyHz }))
    .filter((sample) => sample.periodSec >= minPeriodSec && sample.periodSec <= maxPeriodSec)
    .sort((a, b) => b.density - a.density)[0];
  return dominant ? round(dominant.periodSec, 1) : null;
}

function frequencyBinWidth(samples: Array<{ frequencyHz: number }>, index: number) {
  const previous = samples[index - 1]?.frequencyHz;
  const current = samples[index].frequencyHz;
  const next = samples[index + 1]?.frequencyHz;
  if (previous !== undefined && next !== undefined) return Math.abs((next - previous) / 2);
  if (next !== undefined) return Math.abs(next - current);
  if (previous !== undefined) return Math.abs(current - previous);
  return 0;
}

function numberOrNull(value: string | undefined): number | null {
  if (!value || value === "MM") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function metersPerSecondToKnots(value: number | null): number | null {
  return value === null ? null : round(value * 1.94384, 1);
}

function metersToFeet(value: number | null): number | null {
  return value === null ? null : round(value * 3.28084, 1);
}

function celsiusToFahrenheit(value: number | null): number | null {
  return value === null ? null : round((value * 9) / 5 + 32, 1);
}

function minutesBetween(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

function round(value: number, places: number): number {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}
