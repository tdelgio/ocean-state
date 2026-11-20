export type SourceKind = "observation" | "forecast" | "model" | "prediction" | "sample" | "unavailable";
export type SourceFreshness = "fresh" | "stale" | "expired" | "unknown";
export type SourceTone = "live" | "stale" | "forecast" | "bad" | "sample";

export type SourceClassification = {
  kind: SourceKind;
  freshness: SourceFreshness;
  ageMinutes: number | null;
  /** False when a number would pretend to be a current reading. */
  presentNumbers: boolean;
  label: string;
  tone: SourceTone;
};

type SourceInput = {
  source: string;
  status: string;
  stationId?: string;
  freshnessMinutes?: number;
  observedAt?: string;
  fetchedAt?: string;
};

/** METAR and other non-NDBC observations. */
export const OBSERVATION_FRESH_MINUTES = 30;
/** NDBC publishes about 30–40 minutes late, so a buoy is still fresh inside this window. */
export const BUOY_FRESH_MINUTES = 60;
export const OBSERVATION_EXPIRED_MINUTES = 90;
const FORECAST_FRESH_MINUTES = 180;
const FORECAST_STALE_MINUTES = 12 * 60;
const MODEL_FRESH_MINUTES = 6 * 60;

const BUOY_STATION_IDS = new Set(["51205", "51213", "51201", "51000", "51001", "51002", "51004"]);

export function isBuoyStationId(stationId: string | undefined): boolean {
  return stationId !== undefined && BUOY_STATION_IDS.has(stationId);
}

export function isBuoySource(source: { stationId?: string }): boolean {
  return isBuoyStationId(source.stationId);
}

export function isNdbcSource(source: { source: string; stationId?: string }): boolean {
  return isBuoySource(source) || source.source.toLowerCase().includes("ndbc");
}

export function isWavesOnlyWindSource(source: { source: string }): boolean {
  return source.source.toLowerCase().includes("waves only");
}

/** True only when this buoy product has an observation inside the fresh window. */
export function isFreshBuoySource(source: SourceInput, now = Date.now()): boolean {
  if (!isBuoySource(source)) return false;
  if (isWavesOnlyWindSource(source)) return false;
  if (source.status === "missing" || source.status === "error" || source.status === "mock") return false;
  if (!source.observedAt && source.freshnessMinutes === undefined) return false;
  const ageMinutes = getSourceAgeMinutes(source, now);
  return ageMinutes !== null && ageMinutes <= BUOY_FRESH_MINUTES;
}

export function formatLastReading(ageMinutes: number): string {
  return `Last reading ${formatReadingAge(ageMinutes)} ago`;
}

function formatReadingAge(ageMinutes: number): string {
  if (ageMinutes < 60) return `${Math.max(1, ageMinutes)} min`;
  if (ageMinutes < 60 * 36) {
    const hours = Math.round(ageMinutes / 60);
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const days = Math.max(1, Math.round(ageMinutes / (60 * 24)));
  return days === 1 ? "1 day" : `${days} days`;
}

export function classifySource(source: SourceInput, now = Date.now()): SourceClassification {
  const kind = getKind(source);
  const ageMinutes = getSourceAgeMinutes(source, now);
  const freshness = getFreshness(kind, ageMinutes, source);
  const presentNumbers = canPresentNumbers(kind, freshness);
  const label = buildLabel(kind, freshness, ageMinutes);
  return { kind, freshness, ageMinutes, presentNumbers, label, tone: toneFor(kind, freshness) };
}

export function getSourceAgeMinutes(source: SourceInput, now = Date.now()): number | null {
  if (source.freshnessMinutes !== undefined) return Math.max(0, Math.round(source.freshnessMinutes));
  const timestamp = source.observedAt ?? source.fetchedAt;
  if (!timestamp) return null;
  const age = Math.round((now - new Date(timestamp).getTime()) / 60000);
  return Number.isFinite(age) ? Math.max(0, age) : null;
}

export function formatAgeMinutes(ageMinutes: number): string {
  if (ageMinutes < 60) return `${ageMinutes} min`;
  if (ageMinutes < 60 * 48) return `${Math.round(ageMinutes / 60)} h`;
  return `${Math.round(ageMinutes / (60 * 24))} d`;
}

function getKind(source: SourceInput): SourceKind {
  if (source.status === "mock") return "sample";
  if (source.status === "missing" || source.status === "error") return "unavailable";

  const name = source.source.toLowerCase();
  if (name.includes("pacioos") || name.includes("roms")) return "model";
  if (name.includes("prediction")) return "prediction";
  if (
    name.includes("forecast") ||
    name.includes("mfm") ||
    name.includes("coastal waters") ||
    name.includes("cwf") ||
    name.includes("coastal grid") ||
    name.includes("hourly")
  ) {
    return "forecast";
  }
  return "observation";
}

function getFreshness(kind: SourceKind, ageMinutes: number | null, source: SourceInput): SourceFreshness {
  if (kind === "sample" || kind === "unavailable") return "unknown";
  if (ageMinutes === null) return kind === "observation" ? "stale" : "unknown";

  if (kind === "observation") {
    const freshLimit = isNdbcSource(source) ? BUOY_FRESH_MINUTES : OBSERVATION_FRESH_MINUTES;
    if (ageMinutes <= freshLimit) return "fresh";
    if (ageMinutes <= OBSERVATION_EXPIRED_MINUTES) return "stale";
    return "expired";
  }

  const freshLimit = kind === "model" ? MODEL_FRESH_MINUTES : FORECAST_FRESH_MINUTES;
  const staleLimit = kind === "model" ? 24 * 60 : FORECAST_STALE_MINUTES;
  if (ageMinutes <= freshLimit) return "fresh";
  if (ageMinutes <= staleLimit) return "stale";
  return "expired";
}

function canPresentNumbers(kind: SourceKind, freshness: SourceFreshness): boolean {
  if (kind === "sample" || kind === "unavailable") return false;
  if (kind === "observation") return freshness === "fresh" || freshness === "stale";
  return true;
}

function buildLabel(kind: SourceKind, freshness: SourceFreshness, ageMinutes: number | null): string {
  const age = ageMinutes !== null ? ` · ${formatAgeMinutes(ageMinutes)}` : "";
  if (kind === "sample") return "Sample";
  if (kind === "unavailable") return "Unavailable";

  const base =
    kind === "observation"
      ? freshness === "expired"
        ? "Expired"
        : freshness === "stale"
          ? "Stale"
          : "Observed"
      : kind === "forecast"
        ? freshness === "fresh"
          ? "Forecast"
          : "Forecast · stale"
        : kind === "model"
          ? freshness === "fresh"
            ? "Model"
            : "Model · stale"
          : "Prediction";

  return `${base}${age}`;
}

function toneFor(kind: SourceKind, freshness: SourceFreshness): SourceTone {
  if (kind === "sample") return "sample";
  if (kind === "unavailable" || freshness === "expired") return "bad";
  if (kind === "forecast" || kind === "model" || kind === "prediction") return "forecast";
  if (freshness === "stale") return "stale";
  return "live";
}
