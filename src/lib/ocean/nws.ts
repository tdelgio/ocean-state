import { mockForecastWindows } from "./mock-data";
import { degreesToCardinal } from "./ndbc";
import type { ForecastWindow, GeoPoint, SourceMeta, WeatherAlert, WindObservation } from "./types";

const NWS_API_URL = "https://api.weather.gov";
const NWS_HONOLULU_URL = "https://www.weather.gov/hfo/";
const NWS_FETCH_TIMEOUT_MS = 4500;
const MAUI_MARINE_ALERT_ZONES = [
  "PHZ116",
  "PHZ117",
  "PHZ118",
  "PHZ119",
  "PHZ120",
  "PHZ121",
] as const;

interface NwsPointResponse {
  properties?: {
    forecastHourly?: string;
    forecastZone?: string;
    county?: string;
    gridId?: string;
    gridX?: number;
    gridY?: number;
  };
}

interface NwsHourlyPeriod {
  startTime: string;
  endTime: string;
  windSpeed: string;
  windGust?: string | null;
  windDirection: string;
  probabilityOfPrecipitation?: { value?: number | null };
  shortForecast: string;
}

export async function getNwsForecastWindows(point: GeoPoint): Promise<ForecastWindow[]> {
  try {
    const pointResponse = await fetchNwsPoint(point);
    const hourlyUrl = pointResponse.properties?.forecastHourly;
    if (!hourlyUrl) throw new Error("NWS point response did not include forecastHourly");

    const response = await fetch(hourlyUrl, {
      headers: { Accept: "application/geo+json" },
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(NWS_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`NWS hourly forecast failed with ${response.status}`);

    const json = (await response.json()) as { properties?: { periods?: NwsHourlyPeriod[]; updated?: string } };
    const fetchedAt = new Date().toISOString();
    const source: SourceMeta = {
      source: "NWS hourly forecast",
      status: "stale",
      sourceUrl: getNwsPointForecastUrl(point),
      fetchedAt,
      observedAt: json.properties?.updated,
      freshnessMinutes: json.properties?.updated ? minutesBetween(json.properties.updated, fetchedAt) : undefined,
    };

    return collapsePeriodsIntoWindows(json.properties?.periods ?? [], source);
  } catch (error) {
    return mockForecastWindows.map((window) => ({
      ...window,
      source: {
        ...window.source,
        status: "mock",
        error: error instanceof Error ? error.message : "Unknown NWS forecast error",
      },
    }));
  }
}

export async function getNwsAlerts(point: GeoPoint): Promise<WeatherAlert[]> {
  try {
    const pointResponse = await fetchNwsPoint(point);
    const zone = pointResponse.properties?.forecastZone?.split("/").at(-1);
    const county = pointResponse.properties?.county?.split("/").at(-1);
    const zones = Array.from(
      new Set([zone, county, ...MAUI_MARINE_ALERT_ZONES].filter((value): value is string => Boolean(value))),
    );
    const url = zones.length ? `${NWS_API_URL}/alerts/active?zone=${zones.join(",")}` : `${NWS_API_URL}/alerts/active?point=${point.latitude},${point.longitude}`;
    const response = await fetch(url, {
      headers: { Accept: "application/geo+json" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(NWS_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`NWS alerts failed with ${response.status}`);

    const json = (await response.json()) as {
      features?: Array<{
        id?: string;
        properties?: {
          headline?: string | null;
          event?: string | null;
          severity?: string | null;
          effective?: string | null;
          expires?: string | null;
          description?: string | null;
          affectedZones?: string[] | null;
        };
      }>;
    };
    const fetchedAt = new Date().toISOString();

    return (json.features ?? []).map((feature, index) => ({
      id: feature.id ?? `nws-alert-${index}`,
      headline: feature.properties?.headline ?? feature.properties?.event ?? "NWS alert",
      severity: feature.properties?.severity ?? "Unknown",
      event: feature.properties?.event ?? "Unknown",
      affectedZones: feature.properties?.affectedZones ?? [],
      effectiveAt: feature.properties?.effective ?? null,
      expiresAt: feature.properties?.expires ?? null,
      description: feature.properties?.description ?? "",
      source: {
        source: "NWS alerts",
        status: "live",
        sourceUrl: feature.id ?? NWS_HONOLULU_URL,
        fetchedAt,
      },
    }));
  } catch {
    return [];
  }
}

export async function getNwsCurrentWindObservation(point: GeoPoint, label: string): Promise<WindObservation> {
  try {
    const windows = await getNwsForecastWindows(point);
    const current = windows[0];
    if (!current) throw new Error(`NWS current wind proxy missing for ${label}`);
    return {
      speedKt: current.windSpeedKt,
      gustKt: current.windGustKt,
      directionDeg: current.windDirectionDeg,
      directionCardinal: current.windDirectionCardinal ?? degreesToCardinal(current.windDirectionDeg),
      source: {
        ...current.source,
        source: `NWS hourly forecast proxy · ${label}`,
        stationId: `nws-grid-${slugSourceLabel(label)}`,
        sourceUrl: getNwsPointForecastUrl(point),
      },
    };
  } catch (error) {
    return {
      speedKt: null,
      gustKt: null,
      directionDeg: null,
      directionCardinal: null,
      source: {
        source: `NWS hourly forecast proxy · ${label}`,
        status: "missing",
        stationId: `nws-grid-${slugSourceLabel(label)}`,
        sourceUrl: getNwsPointForecastUrl(point),
        fetchedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown NWS harbor wind error",
      },
    };
  }
}

export type { GeoPoint };

async function fetchNwsPoint(point: GeoPoint): Promise<NwsPointResponse> {
  const response = await fetch(`${NWS_API_URL}/points/${point.latitude},${point.longitude}`, {
    headers: { Accept: "application/geo+json" },
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(NWS_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`NWS point lookup failed with ${response.status}`);
  return response.json();
}

function collapsePeriodsIntoWindows(periods: NwsHourlyPeriod[], source: SourceMeta): ForecastWindow[] {
  return periods.slice(0, 18).map((period) => {
    const speedKt = parseWindKt(period.windSpeed);
    return {
      startTime: period.startTime,
      endTime: period.endTime,
      windSpeedKt: speedKt,
      windGustKt: period.windGust ? parseWindKt(period.windGust) : null,
      windDirectionDeg: cardinalToDegrees(period.windDirection),
      windDirectionCardinal: period.windDirection || degreesToCardinal(cardinalToDegrees(period.windDirection)),
      precipitationChancePercent: period.probabilityOfPrecipitation?.value ?? null,
      shortForecast: period.shortForecast,
      source,
    };
  });
}

function parseWindKt(value: string): number | null {
  const values = [...value.matchAll(/(\d+)/g)].map((match) => Number(match[1])).filter(Number.isFinite);
  if (!values.length) return null;
  const speed = Math.max(...values);
  const normalized = value.toLowerCase();
  if (normalized.includes("mph")) return Math.round(speed * 0.868976);
  return speed;
}

function cardinalToDegrees(value: string): number | null {
  const normalized = value.toUpperCase();
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
  return map[normalized] ?? null;
}

function getNwsPointForecastUrl(point: GeoPoint) {
  return `https://forecast.weather.gov/MapClick.php?lat=${point.latitude}&lon=${point.longitude}`;
}

function slugSourceLabel(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function minutesBetween(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}
