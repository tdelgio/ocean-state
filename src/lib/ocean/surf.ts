import type { ForecastRegionId, SourceMeta, SurfOutlook, SurfOutlookShore, SurfSpotForecast } from "./types";

const SRF_URL =
  "https://forecast.weather.gov/product.php?site=HFO&issuedby=HFO&product=SRF&format=txt&version=1&glossary=0";
const HAWAII_WEATHER_TODAY_SURF_URL = "https://www.hawaiiweathertoday.com/surfing/";
const SRF_FETCH_TIMEOUT_MS = 4500;

const SHORE_LABELS: Record<ForecastRegionId, string> = {
  north: "North",
  south: "South",
  east: "East",
  west: "West",
};

export async function getSurfOutlook(): Promise<SurfOutlook | null> {
  // Start both sources together. Hawaii Weather Today is preferred, but its
  // server can be very slow; NOAA should already be ready when the deadline
  // is reached instead of starting only after the first request fails.
  const hawaiiWeatherTodayPromise = getHawaiiWeatherTodaySurfOutlook();
  const noaaPromise = getNoaaSurfOutlook();
  const hawaiiWeatherToday = await withDeadline(hawaiiWeatherTodayPromise, 2500);
  if (hawaiiWeatherToday) return hawaiiWeatherToday;
  return withDeadline(noaaPromise, 2500);
}

function withDeadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

async function getHawaiiWeatherTodaySurfOutlook(): Promise<SurfOutlook | null> {
  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetch(HAWAII_WEATHER_TODAY_SURF_URL, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(SRF_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Hawaii Weather Today surf failed with ${response.status}`);

    const text = htmlToText(await response.text());
    const briefing = parseHawaiiWeatherTodayBriefing(text);
    if (!briefing) throw new Error("Hawaii Weather Today surf forecast was not found");
    const publication = parseHawaiiWeatherTodayPublication(text);
    if (!publication || Date.now() > publication.validThrough.getTime() + 12 * 60 * 60 * 1000) {
      throw new Error("Hawaii Weather Today surf forecast is stale");
    }
    const spots = parseHawaiiWeatherTodayMauiSpots(text);

    const source: SourceMeta = {
      source: "Hawaii Weather Today Surf Forecast",
      status: "stale",
      sourceUrl: HAWAII_WEATHER_TODAY_SURF_URL,
      fetchedAt,
      observedAt: publication.observedAt.toISOString(),
      freshnessMinutes: Math.max(0, Math.round((Date.now() - publication.observedAt.getTime()) / 60000)),
    };

    return {
      issuedAt: publication.observedAt.toISOString(),
      validThrough: publication.validThrough.toISOString(),
      briefing,
      spotBriefing: spots.length ? "Hawaiian scale; breaking wave faces can be roughly twice the listed height." : null,
      spots,
      spotSource: spots.length ? source : null,
      shores: {
        north: parseShoreOutlook(text, "north", briefing),
        south: parseShoreOutlook(text, "south", briefing),
        east: parseShoreOutlook(text, "east", briefing),
        west: parseShoreOutlook(text, "west", briefing),
      },
      source,
    };
  } catch {
    return null;
  }
}

async function getNoaaSurfOutlook(): Promise<SurfOutlook | null> {
  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetch(SRF_URL, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(SRF_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`NWS SRF failed with ${response.status}`);

    const text = htmlToText(await response.text());
    const issuedAt = parseIssuedAt(text);
    const source: SourceMeta = {
      source: "NOAA HFO Surf Forecast",
      status: "stale",
      sourceUrl: SRF_URL,
      fetchedAt,
      observedAt: issuedAt ?? undefined,
    };

    return {
      issuedAt,
      validThrough: null,
      briefing: parseBriefing(text),
      spotBriefing: null,
      spots: [],
      spotSource: null,
      shores: {
        north: parseShoreOutlook(text, "north"),
        south: parseShoreOutlook(text, "south"),
        east: parseShoreOutlook(text, "east"),
        west: parseShoreOutlook(text, "west"),
      },
      source,
    };
  } catch {
    return null;
  }
}

function parseShoreOutlook(text: string, shoreId: ForecastRegionId, suppliedDiscussion?: string): SurfOutlookShore {
  const label = SHORE_LABELS[shoreId];
  const shoreForecast = parseShoreDiscussion(suppliedDiscussion ?? extractDiscussion(text), label);
  const mauiTableValue = parseMauiSurfTable(text, label);
  if (mauiTableValue) {
    return {
      shoreId,
      label,
      surf: mauiTableValue,
      summary: shoreForecast ?? `${label} facing shore surf: ${mauiTableValue}`,
    };
  }
  const shorePattern = new RegExp(`surf\\s+along\\s+${label}\\s+facing\\s+shores\\s+will\\s+be\\s+([^\\.\\n]+)(?:\\.|\\n)`, "i");
  const fallbackPattern = new RegExp(`${label}\\s+facing\\s+shores[^\\n\\.]*?((?:\\d+\\s*(?:to|-)?\\s*)?\\d+\\s*(?:feet|ft)[^\\n\\.]*)`, "i");
  const match = text.match(shorePattern) ?? text.match(fallbackPattern);
  const raw = match?.[1]?.trim() ?? null;
  const surf = raw ? cleanSurfRange(raw) : null;
  return {
    shoreId,
    label,
    surf,
    summary: shoreForecast ?? raw,
  };
}

function parseShoreDiscussion(text: string, label: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const match = normalized.match(
    new RegExp(`Surf\\s+along\\s+${label}\\s+facing\\s+shores[\\s\\S]*?(?=Surf\\s+along\\s+(?:North|South|East|West)\\s+facing\\s+shores|$)`, "i"),
  );
  return match?.[0].replace(/\s+/g, " ").trim() ?? null;
}

function parseHawaiiWeatherTodayBriefing(text: string) {
  return text
    .match(/Forecast:\s*([\s\S]*?)(?=\s*Maui Beaches\b)/i)?.[1]
    ?.replace(/\s+/g, " ")
    .trim() || null;
}

function parseHawaiiWeatherTodayPublication(text: string) {
  const match = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:\s*-\s*(\d{1,2}))?,\s*(\d{4})\b/i);
  if (!match) return null;
  const [, month, startDay, endDay = startDay, year] = match;
  const observedAt = new Date(`${month} ${startDay}, ${year} 00:00:00 GMT-1000`);
  const validThrough = new Date(`${month} ${endDay}, ${year} 23:59:59 GMT-1000`);
  if (!Number.isFinite(observedAt.getTime()) || !Number.isFinite(validThrough.getTime())) return null;
  return { observedAt, validThrough };
}

function parseHawaiiWeatherTodayMauiSpots(text: string): SurfSpotForecast[] {
  const mauiBeaches = text.match(/Maui Beaches\s*([\s\S]*?)(?=\s*Oahu Beaches\b)/i)?.[1];
  if (!mauiBeaches) return [];

  const definitions: Array<{ id: string; name: string; region: ForecastRegionId; sourcePattern: string }> = [
    { id: "hana", name: "Hana", region: "east", sourcePattern: "Hana" },
    { id: "hookipa", name: "Hookipa", region: "north", sourcePattern: "Hookipa" },
    { id: "kanaha", name: "Kanaha", region: "north", sourcePattern: "Kanaha" },
    { id: "kihei-wailea", name: "Kihei / Wailea", region: "south", sourcePattern: "Kihei\\s*\\/\\s*Wailea" },
    { id: "maalaea-bay", name: "Maalaea Bay", region: "south", sourcePattern: "Maalaea\\s+Bay" },
    { id: "lahaina", name: "Lahaina", region: "west", sourcePattern: "Lahaina" },
    { id: "upper-west", name: "Upper West", region: "west", sourcePattern: "Upper\\s+West" },
  ];

  return definitions.flatMap(({ sourcePattern, ...definition }) => {
    const raw = mauiBeaches.match(new RegExp(`${sourcePattern}:\\s*([^|\\n]+)`, "i"))?.[1] ?? "";
    const surf = raw.match(/\d+(?:\s*-\s*\d+)?\+?/i)?.[0]?.replace(/\s+/g, "") ?? null;
    return surf ? [{ ...definition, surf: `${surf} ft` }] : [];
  });
}

function parseMauiSurfTable(text: string, label: string) {
  // Anchor to Maui's forecast-zone header. Matching a bare "Maui" can start
  // in the discussion and accidentally consume another island's surf table.
  const mauiSection = text.match(
    /(?:^|\n)\s*HIZ[^\n]*\n\s*Maui-\s*\n([\s\S]*?)(?=\n\s*\$\$)/i,
  )?.[1];
  if (!mauiSection) return null;

  const line = mauiSection.match(new RegExp(`^\\s*${label}\\s+(?:Facing\\s+)?(.+)$`, "im"))?.[1];
  if (!line) return null;
  const values = [...line.matchAll(/\d+(?:\s*(?:-|to)\s*\d+)?/gi)]
    .map((match) => match[0].replace(/\s+to\s+/i, "-").replace(/\s+/g, ""));
  if (!values.length) return null;

  const [todayAm, todayPm] = values;
  if (!todayPm || todayPm === todayAm) return `${todayAm} ft`;
  return `${todayAm} ft AM · ${todayPm} ft PM`;
}

function parseBriefing(text: string) {
  const discussion = extractDiscussion(text);
  const cleaned = discussion
    .replace(/\s+/g, " ")
    .replace(/^The current /i, "Current ")
    .trim();
  return cleaned || null;
}

function extractDiscussion(text: string) {
  const marker = text.search(/\.DISCUSSION\.\.\./i);
  if (marker < 0) {
    return text.match(/Surf Discussion[\s\S]*?\n([\s\S]*?)(?=\n\s*(?:Forecast|Outlook|Maui)\b)/i)?.[1] ?? "";
  }
  const start = text.indexOf("\n", marker);
  const rest = text.slice(start >= 0 ? start : marker);
  const endMatch = rest.search(/\n\s*HIZ\d|\n\s*\$\$/);
  return endMatch >= 0 ? rest.slice(0, endMatch) : rest;
}

function cleanSurfRange(value: string) {
  return value
    .replace(/\bfeet\b/gi, "ft")
    .replace(/\s+/g, " ")
    .replace(/\s+through\s+.*$/i, "")
    .replace(/\s+tonight.*$/i, "")
    .trim();
}

function parseIssuedAt(text: string) {
  const match = text.match(/(\d{1,2}:\d{2}|\d{3,4})\s+(AM|PM)\s+HST\s+\w+\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{4})/i);
  if (!match) return null;
  const rawTime = match[1].includes(":")
    ? match[1]
    : `${match[1].slice(0, -2) || "0"}:${match[1].slice(-2)}`;
  return new Date(`${match[3]} ${match[4]}, ${match[5]} ${rawTime} ${match[2]} GMT-1000`).toISOString();
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
