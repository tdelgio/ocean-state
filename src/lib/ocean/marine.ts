import type { ChannelForecastObservation, MarineForecastDay, MarineForecastEnergy, SourceMeta, WindObservation } from "./types";

const CWF_URL =
  "https://forecast.weather.gov/product.php?site=HFO&issuedby=HFO&product=CWF&format=txt&version=1&glossary=0";
const CWF_FETCH_TIMEOUT_MS = 4500;

const ZONES = {
  windward: "PHZ117",
  leeward: "PHZ118",
} as const;
const CHANNEL_ZONES = {
  pailolo: { zoneId: "PHZ120", displayName: "Pailolo" },
  kaiwi: { zoneId: "PHZ116", displayName: "Kaiwi" },
  alenuihaha: { zoneId: "PHZ121", displayName: "Alenuihaha" },
} as const;

type MarineZone = keyof typeof ZONES;

export async function getMauiMarineForecastDays(): Promise<
  Record<MarineZone, MarineForecastDay[]>
> {
  try {
    const response = await fetch(CWF_URL, {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(CWF_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`NWS CWF failed with ${response.status}`);

    const fetchedAt = new Date().toISOString();
    const text = htmlToText(await response.text());
    const issuedAt = parseIssuedAt(text);
    const source: SourceMeta = {
      source: "NWS Honolulu Coastal Waters Forecast",
      status: "live",
      sourceUrl: CWF_URL,
      fetchedAt,
      observedAt: issuedAt ?? undefined,
    };

    return {
      windward: parseZone(text, ZONES.windward, source),
      leeward: parseZone(text, ZONES.leeward, source),
    };
  } catch {
    return { windward: [], leeward: [] };
  }
}

export async function getChannelForecastObservations(): Promise<Record<keyof typeof CHANNEL_ZONES, ChannelForecastObservation>> {
  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetch(CWF_URL, {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(CWF_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`NWS CWF failed with ${response.status}`);

    const text = htmlToText(await response.text());
    const issuedAt = parseIssuedAt(text);
    return Object.fromEntries(
      Object.entries(CHANNEL_ZONES).map(([channelId, config]) => [
        channelId,
        parseChannelForecast(text, channelId as keyof typeof CHANNEL_ZONES, config, fetchedAt, issuedAt),
      ]),
    ) as Record<keyof typeof CHANNEL_ZONES, ChannelForecastObservation>;
  } catch (error) {
    return Object.fromEntries(
      Object.entries(CHANNEL_ZONES).map(([channelId, config]) => [
        channelId,
        createUnavailableChannelForecast(channelId as keyof typeof CHANNEL_ZONES, config, fetchedAt, error),
      ]),
    ) as Record<keyof typeof CHANNEL_ZONES, ChannelForecastObservation>;
  }
}

function parseZone(text: string, zoneId: string, source: SourceMeta): MarineForecastDay[] {
  const section = text.match(new RegExp(`${zoneId}-[\\s\\S]*?\\n\\s*\\$\\$`))?.[0];
  if (!section) return [];

  return section
    .split(/\n\s*\.(?=[A-Z][A-Z ]+\.\.\.)/)
    .map((entry) => entry.match(/^([A-Z ]+)\.\.\.([\s\S]*)/)?.slice(1))
    .filter((entry): entry is [string, string] => Boolean(entry))
    .filter(([label]) => !label.includes("NIGHT"))
    .slice(0, 5)
    .map(([dayLabel, body]) => {
      const waveComponents = parseWaveComponents(body);
      return {
        dayLabel: dayLabel.trim(),
        seas: body.match(/Seas\s+([^.]*)\./i)?.[1]?.trim() ?? null,
        wind: parseForecastWind(body, source),
        bumpEnergy: strongestEnergy(waveComponents.filter((wave) => wave.periodSec >= 4 && wave.periodSec <= 9)),
        groundswell: strongestEnergy(waveComponents.filter((wave) => wave.periodSec >= 10)),
        rainSummary: parseRainSummary(body),
        source,
      };
    });
}

function parseChannelForecast(
  text: string,
  channelId: keyof typeof CHANNEL_ZONES,
  config: (typeof CHANNEL_ZONES)[keyof typeof CHANNEL_ZONES],
  fetchedAt: string,
  issuedAt: string | null,
): ChannelForecastObservation {
  const section = text.match(new RegExp(`${config.zoneId}-[\\s\\S]*?\\n\\s*\\$\\$`))?.[0];
  const body = section?.match(/(?:^|\n)\s*\.(?!\.)[A-Z][A-Z ]*\.\.\.([\s\S]*?)(?=\n\s*\.(?!\.)[A-Z][A-Z ]*\.\.\.|\n\s*\$\$)/i)?.[1] ?? null;
  if (!body) return createUnavailableChannelForecast(channelId, config, fetchedAt, new Error(`${config.zoneId} forecast unavailable`));

  const source: SourceMeta = {
    source: `NWS Honolulu Coastal Waters Forecast · ${config.displayName}`,
    status: "stale",
    stationId: config.zoneId,
    sourceUrl: CWF_URL,
    fetchedAt,
    observedAt: issuedAt ?? undefined,
  };
  const wind = parseForecastWind(body, source);
  const bumpEnergy = strongestEnergy(parseWaveComponents(body).filter((wave) => wave.periodSec >= 4 && wave.periodSec <= 9));

  return {
    channelId,
    displayName: config.displayName,
    wind,
    bumpEnergy,
    rainSummary: parseRainSummary(body),
    forecastDays: parseZone(text, config.zoneId, source),
  };
}

function parseForecastWind(body: string, source: SourceMeta): WindObservation {
  const match = body.match(/([a-z]+(?:\s+[a-z]+)?)\s+winds?\s+([^.]*?knots?)/i);
  const directionCardinal = match ? normalizeDirection(match[1]) : null;
  const speeds = match ? [...match[2].matchAll(/\d+(?:\.\d+)?/g)].map((value) => Number.parseFloat(value[0])) : [];
  const speedKt = speeds.length ? Math.max(...speeds) : null;
  const speedRangeKt = speeds.length >= 2 ? ([Math.min(...speeds), Math.max(...speeds)] as [number, number]) : null;
  return {
    speedKt,
    gustKt: null,
    speedRangeKt,
    directionDeg: directionCardinal ? cardinalToDegrees(directionCardinal) : null,
    directionCardinal,
    source,
  };
}

function createUnavailableChannelForecast(
  channelId: keyof typeof CHANNEL_ZONES,
  config: (typeof CHANNEL_ZONES)[keyof typeof CHANNEL_ZONES],
  fetchedAt: string,
  error: unknown,
): ChannelForecastObservation {
  const source: SourceMeta = {
    source: `NWS Honolulu Coastal Waters Forecast · ${config.displayName}`,
    status: "missing",
    stationId: config.zoneId,
    sourceUrl: CWF_URL,
    fetchedAt,
    error: error instanceof Error ? error.message : "Unknown channel forecast error",
  };
  return {
    channelId,
    displayName: config.displayName,
    wind: { speedKt: null, gustKt: null, directionDeg: null, directionCardinal: null, source },
    bumpEnergy: { heightFt: null, periodSec: null, directionCardinal: null },
    rainSummary: null,
    forecastDays: [],
  };
}

function parseWaveComponents(body: string): Array<MarineForecastEnergy & { heightFt: number; periodSec: number }> {
  const detail = body.match(/Wave\s+Detail:\s*([\s\S]*)/i)?.[1] ?? "";
  return [...detail.matchAll(/([a-z]+(?:\s+[a-z]+)?)\s+(\d+(?:\.\d+)?)\s+feet?\s+at\s+(\d+)\s+seconds?/gi)]
    .map((match) => ({
      directionCardinal: normalizeDirection(match[1]),
      heightFt: Number.parseFloat(match[2]),
      periodSec: Number.parseInt(match[3], 10),
    }))
    .filter((wave) => Number.isFinite(wave.heightFt) && Number.isFinite(wave.periodSec));
}

function strongestEnergy(components: Array<MarineForecastEnergy & { heightFt: number; periodSec: number }>): MarineForecastEnergy {
  return (
    [...components].sort((a, b) => b.heightFt - a.heightFt || b.periodSec - a.periodSec)[0] ?? {
      heightFt: null,
      periodSec: null,
      directionCardinal: null,
    }
  );
}

function parseRainSummary(body: string) {
  return body.match(/((?:Scattered|Isolated|Numerous|Occasional)[^.]*showers?[^.]*)/i)?.[1]?.trim() ?? null;
}

function normalizeDirection(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ").replace(/^and\s+/, "");
  const directions: Record<string, string> = {
    north: "N",
    "north northeast": "NNE",
    northeast: "NE",
    "east northeast": "ENE",
    east: "E",
    "east southeast": "ESE",
    southeast: "SE",
    "south southeast": "SSE",
    south: "S",
    "south southwest": "SSW",
    southwest: "SW",
    "west southwest": "WSW",
    west: "W",
    "west northwest": "WNW",
    northwest: "NW",
    "north northwest": "NNW",
  };
  return directions[normalized] ?? value.trim().toUpperCase();
}

function cardinalToDegrees(cardinal: string) {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = directions.indexOf(cardinal.toUpperCase());
  return index >= 0 ? index * 22.5 : null;
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
