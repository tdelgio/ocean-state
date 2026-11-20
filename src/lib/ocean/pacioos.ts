import type { CurrentObservation, GeoPoint } from "./types";

const PACIOOS_ROMS_ERDDAP_URL =
  "https://pae-paha.pacioos.hawaii.edu/erddap/griddap/roms_hiig.csv";
const PACIOOS_ROMS_SOURCE_URL =
  "https://www.pacioos.hawaii.edu/currents/model-hawaii/";
const PACIOOS_FETCH_TIMEOUT_MS = 4500;
const METERS_PER_SECOND_TO_KNOTS = 1.94384;

export async function getPacioosSurfaceCurrent(
  point: GeoPoint,
  stationName: string,
  stationId = `pacioos-roms-${stationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
): Promise<CurrentObservation> {
  const sourceUrl = PACIOOS_ROMS_SOURCE_URL;
  try {
    const time = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const query = [
      `u[(${time})][(0.0)][(${point.latitude})][(${point.longitude})]`,
      `v[(${time})][(0.0)][(${point.latitude})][(${point.longitude})]`,
    ].join(",");
    const response = await fetch(`${PACIOOS_ROMS_ERDDAP_URL}?${query}`, {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(PACIOOS_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`PacIOOS ROMS failed with ${response.status}`);

    const row = parseLatestRomsRow(await response.text());
    if (!row) throw new Error("PacIOOS ROMS did not return a valid current vector");
    const speedKt = Math.hypot(row.u, row.v) * METERS_PER_SECOND_TO_KNOTS;
    const directionDeg = (Math.atan2(row.u, row.v) * 180) / Math.PI;
    const normalizedDirection = (directionDeg + 360) % 360;
    const fetchedAt = new Date().toISOString();
    const observedMs = Date.parse(row.time);
    const freshnessMinutes = Number.isFinite(observedMs)
      ? Math.abs(Math.round((Date.parse(fetchedAt) - observedMs) / 60000))
      : undefined;

    return {
      stationId,
      stationName,
      speedKt: Math.round(speedKt * 100) / 100,
      directionDeg: Math.round(normalizedDirection),
      directionCardinal: degreesToCardinal(normalizedDirection),
      trend: "unknown",
      source: {
        source: "PacIOOS ROMS surface current model",
        status: freshnessMinutes !== undefined && freshnessMinutes > 360 ? "stale" : "live",
        stationId,
        sourceUrl,
        fetchedAt,
        observedAt: row.time,
        freshnessMinutes,
      },
    };
  } catch (error) {
    return {
      stationId,
      stationName,
      speedKt: null,
      directionDeg: null,
      directionCardinal: null,
      trend: "unknown",
      source: {
        source: "PacIOOS ROMS surface current model",
        status: "missing",
        stationId,
        sourceUrl,
        fetchedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown PacIOOS ROMS error",
      },
    };
  }
}

function parseLatestRomsRow(csv: string) {
  const rows = csv.trim().split(/\r?\n/);
  if (rows.length < 3) return null;
  const values = rows.at(-1)?.split(",");
  if (!values || values.length < 6) return null;
  const u = Number.parseFloat(values[4]);
  const v = Number.parseFloat(values[5]);
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
  return { time: values[0], u, v };
}

function degreesToCardinal(degrees: number) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(degrees / 45) % 8];
}
