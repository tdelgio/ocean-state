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

export async function getNoaaSurfOutlook(): Promise<SurfOutlook | null> {
  const fetchedAt = new Date().toISOString();
  try {
    const [response, spotReport] = await Promise.all([
      fetch(SRF_URL, {
        next: { revalidate: 1800 },
        signal: AbortSignal.timeout(SRF_FETCH_TIMEOUT_MS),
      }),
      getHawaiiWeatherTodaySurfReport(fetchedAt),
    ]);
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
      briefing: spotReport?.briefing ?? parseBriefing(text),
      spotBriefing: spotReport?.briefing ?? null,
      spots: spotReport?.spots ?? [],
      spotSource: spotReport?.source ?? null,
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

async function getHawaiiWeatherTodaySurfReport(fetchedAt: string): Promise<{
  briefing: string | null;
  spots: SurfSpotForecast[];
  source: SourceMeta;
} | null> {
  try {
    const response = await fetch(HAWAII_WEATHER_TODAY_SURF_URL, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(SRF_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Hawaii Weather Today surf failed with ${response.status}`);
    const text = htmlToText(await response.text());
    return {
      briefing: parseHawaiiWeatherTodayBriefing(text),
      spots: parseMauiSurfSpots(text),
      source: {
        source: "Hawaii Weather Today Surf Forecast",
        status: "stale",
        sourceUrl: HAWAII_WEATHER_TODAY_SURF_URL,
        fetchedAt,
      },
    };
  } catch {
    return null;
  }
}

function parseMauiSurfSpots(text: string): SurfSpotForecast[] {
  const section = text.match(/Maui Beaches([\s\S]*?)(?=\n\s*Oahu Beaches\b|\n\s*Big Island\b|\n\s*Kauai\b)/i)?.[1] ?? "";
  return section
    .split("\n")
    .map((line) => line.match(/^\s*([^:\n]+):\s*([0-9/+\-\s]+)\s*$/)?.slice(1))
    .filter((entry): entry is [string, string] => Boolean(entry))
    .map(([name, surf]) => ({
      id: slugify(name),
      name: cleanSpotName(name),
      region: getMauiSpotRegion(name),
      surf: cleanSurfRange(`${surf} ft`),
    }))
    .filter((spot) => spot.surf !== "ft");
}

function parseHawaiiWeatherTodayBriefing(text: string) {
  const raw =
    text.match(/Forecast:\s*([\s\S]*?)(?=\n\s*Maui Beaches\b)/i)?.[1] ??
    "";
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const sentences = cleaned.match(/[^.?!]+[.?!]/g)?.slice(0, 3).join(" ").trim();
  return sentences || cleaned.slice(0, 260) || null;
}

function parseShoreOutlook(text: string, shoreId: ForecastRegionId): SurfOutlookShore {
  const label = SHORE_LABELS[shoreId];
  const mauiTableValue = parseMauiSurfTable(text, label);
  if (mauiTableValue) {
    return {
      shoreId,
      label,
      surf: mauiTableValue,
      summary: `${label} facing shore surf: ${mauiTableValue}`,
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
    summary: raw,
  };
}

function cleanSpotName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function slugify(value: string) {
  return cleanSpotName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getMauiSpotRegion(name: string): ForecastRegionId {
  const normalized = name.toLowerCase();
  if (normalized.includes("hana") || normalized.includes("hookipa") || normalized.includes("kanaha")) return "north";
  if (normalized.includes("kihei") || normalized.includes("wailea") || normalized.includes("maalaea")) return "south";
  if (normalized.includes("lahaina") || normalized.includes("west")) return "west";
  return "east";
}

function parseMauiSurfTable(text: string, label: string) {
  const mauiSection =
    text.match(/(?:^|\n)Maui[\s\S]*?(?=\n\s*(?:Kauai|Oahu|Molokai|Lanai|Big Island)\b|\n&&|\n\$)/i)?.[0] ?? text;
  const line = mauiSection.match(new RegExp(`^\\s*${label}\\s+(?:Facing\\s+)?(.+)$`, "im"))?.[1];
  if (!line) return null;
  const values = [...line.matchAll(/\d+(?:\s*(?:-|to)\s*\d+)?/gi)]
    .map((match) => match[0].replace(/\s+to\s+/i, "-").replace(/\s+/g, ""));
  if (!values.length) return null;
  const unique = [...new Set(values.slice(0, 2))];
  return `${unique.join(" / ")} ft`;
}

function parseBriefing(text: string) {
  const discussion = extractDiscussion(text);
  const cleaned = discussion
    .replace(/\s+/g, " ")
    .replace(/^The current /i, "Current ")
    .trim();
  const sentences = cleaned.match(/[^.?!]+[.?!]/g)?.slice(0, 2).join(" ").trim();
  return sentences || cleaned.slice(0, 220) || null;
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
