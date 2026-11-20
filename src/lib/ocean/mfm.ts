import type { WindObservation } from "./types";

const MFM_URL = "https://forecast.weather.gov/product.php?issuedby=HFO&product=MFM&site=hfo";
const MFM_FETCH_TIMEOUT_MS = 4500;

export async function getDdFadForecastWind(): Promise<WindObservation> {
  try {
    const response = await fetch(MFM_URL, {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(MFM_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`NWS HFO MFM failed with ${response.status}`);

    const fetchedAt = new Date().toISOString();
    const text = htmlToText(await response.text());
    const parsed = parseDdFadForecastWind(text);
    if (!parsed) throw new Error("NWS HFO MFM did not include DD FAD wind");

    return {
      speedKt: parsed.speedKt,
      gustKt: parsed.gustKt,
      directionDeg: cardinalToDegrees(parsed.directionCardinal),
      directionCardinal: parsed.directionCardinal,
      source: {
        source: "NWS HFO MFM forecast · DD FAD Opana Point",
        status: parsed.issuedAt && minutesBetween(parsed.issuedAt, fetchedAt) > 360 ? "stale" : "live",
        stationId: "DD-FAD",
        sourceUrl: MFM_URL,
        fetchedAt,
        observedAt: parsed.issuedAt ?? undefined,
        freshnessMinutes: parsed.issuedAt ? minutesBetween(parsed.issuedAt, fetchedAt) : undefined,
      },
    };
  } catch (error) {
    return {
      speedKt: null,
      gustKt: null,
      directionDeg: null,
      directionCardinal: null,
      source: {
        source: "NWS HFO MFM forecast · DD FAD unavailable",
        status: "missing",
        stationId: "DD-FAD",
        sourceUrl: MFM_URL,
        fetchedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown MFM error",
      },
    };
  }
}

export function parseDdFadForecastWind(text: string, now = new Date()) {
  const section = text.match(/DD FAD BUOY OPANA PT MAUI[\s\S]*?(?=\n\s*\$\$)/)?.[0];
  if (!section) return null;

  const issuedAt = parseIssuedAt(section);
  const forecastIndex = getCurrentForecastIndex(section, issuedAt, now);
  const directionCardinal = valueAt(section, "WIND DIR", forecastIndex);
  const speedKt = numberOrNull(valueAt(section, "WIND SPD", forecastIndex));
  const gustKt = numberOrNull(valueAt(section, "WIND GUST", forecastIndex));
  if (!directionCardinal || speedKt === null) return null;

  return {
    directionCardinal,
    speedKt,
    gustKt,
    issuedAt,
  };
}

function valueAt(section: string, label: string, index: number) {
  return section.match(new RegExp(`^${label}\\s+(.+)$`, "m"))?.[1]?.trim().split(/\s+/)[index] ?? null;
}

function getCurrentForecastIndex(section: string, issuedAt: string | null, now: Date) {
  const hours = section.match(/^HST\s+3HRLY\s+(.+)$/m)?.[1]?.trim().split(/\s+/).map(Number) ?? [];
  if (!hours.length || !issuedAt) return 0;

  const issuedHst = new Date(Date.parse(issuedAt) - 10 * 60 * 60 * 1000);
  let day = issuedHst.getUTCDate();
  let previousHour = hours[0];
  const slots = hours.map((hour, index) => {
    if (index > 0 && hour < previousHour) day += 1;
    previousHour = hour;
    return Date.UTC(issuedHst.getUTCFullYear(), issuedHst.getUTCMonth(), day, hour + 10);
  });
  const upcomingIndex = slots.findIndex((slot) => slot >= now.getTime());
  return upcomingIndex >= 0 ? upcomingIndex : slots.length - 1;
}

function parseIssuedAt(text: string) {
  const match = text.match(/(\d{3,4})\s+(AM|PM)\s+HST\s+\w+\s+([A-Z]{3})\s+(\d{1,2})\s+(\d{4})/i);
  if (!match) return null;
  const rawTime = `${match[1].slice(0, -2) || "0"}:${match[1].slice(-2)}`;
  return new Date(`${match[3]} ${match[4]}, ${match[5]} ${rawTime} ${match[2]} GMT-1000`).toISOString();
}

function cardinalToDegrees(cardinal: string) {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = directions.indexOf(cardinal.toUpperCase());
  return index >= 0 ? index * 22.5 : null;
}

function numberOrNull(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function minutesBetween(from: string, to: string) {
  return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60000));
}

function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:pre|p|div|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}
