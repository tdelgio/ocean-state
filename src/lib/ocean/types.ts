export type DataSourceStatus = "live" | "mock" | "stale" | "missing" | "error";

export type TideTrend = "rising" | "falling" | "slack" | "unknown";

export type RouteRiskLevel = "low" | "moderate" | "high" | "unknown";

export interface SourceMeta {
  source: string;
  status: DataSourceStatus;
  stationId?: string;
  sourceUrl?: string;
  fetchedAt: string;
  observedAt?: string;
  freshnessMinutes?: number;
  error?: string;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface WindObservation {
  speedKt: number | null;
  gustKt: number | null;
  speedRangeKt?: [number, number] | null;
  directionDeg: number | null;
  directionCardinal: string | null;
  source: SourceMeta;
}

export interface HarborWindObservation {
  id: string;
  name: string;
  side: "north" | "south" | "west" | "central";
  coordinates: GeoPoint;
  observation: WindObservation;
  note: string;
}

export interface CoastalWindObservation {
  id: string;
  name: string;
  profile: "nearshore" | "beach-launch" | "coastal-texture";
  coordinates: GeoPoint;
  observation: WindObservation;
  note: string;
}

export interface SwellObservation {
  heightFt: number | null;
  dominantPeriodSec: number | null;
  directionDeg: number | null;
  directionCardinal: string | null;
  waterTempF: number | null;
  source: SourceMeta;
}

export interface SeaEnergyObservation {
  label: "groundswell" | "bump-energy";
  heightFt: number | null;
  periodSec: number | null;
  directionDeg: number | null;
  directionCardinal: string | null;
  description: string;
  source: SourceMeta;
}

export type MauiShoreId = "north" | "south" | "west";
export type ForecastRegionId = "north" | "south" | "east" | "west";

export interface ShoreOceanObservations {
  shoreId: MauiShoreId;
  label: string;
  buoyId: string;
  wind: WindObservation;
  swell: SwellObservation;
  groundswell: SeaEnergyObservation;
  bumpEnergy: SeaEnergyObservation;
}

export type OffshoreBuoyId =
  | "lanai-offshore"
  | "open-ocean-nw"
  | "northern-hawaii"
  | "southwest-hawaii"
  | "southeast-hawaii";

export interface OffshoreBuoyObservation {
  id: OffshoreBuoyId;
  displayName: string;
  purpose: string;
  stationId: string;
  wind: WindObservation;
  swell: SwellObservation;
  groundswell: SeaEnergyObservation;
  bumpEnergy: SeaEnergyObservation;
}

export interface TideEvent {
  time: string;
  heightFt: number;
  type: "high" | "low";
}

export interface TideObservation {
  stationId: string;
  stationName: string;
  currentWaterLevelFt: number | null;
  trend: TideTrend;
  nextHigh: TideEvent | null;
  nextLow: TideEvent | null;
  predictions: TideEvent[];
  source: SourceMeta;
}

export interface CurrentObservation {
  stationId: string;
  stationName: string;
  speedKt: number | null;
  directionDeg: number | null;
  directionCardinal: string | null;
  trend: "flood" | "ebb" | "slack" | "unknown";
  source: SourceMeta;
}

export interface ForecastWindow {
  startTime: string;
  endTime: string;
  windSpeedKt: number | null;
  windGustKt: number | null;
  windDirectionDeg: number | null;
  windDirectionCardinal: string | null;
  precipitationChancePercent: number | null;
  shortForecast: string;
  source: SourceMeta;
}

export interface MarineForecastEnergy {
  heightFt: number | null;
  periodSec: number | null;
  directionCardinal: string | null;
}

export interface MarineForecastDay {
  dayLabel: string;
  seas: string | null;
  summary: string | null;
  wind: WindObservation;
  bumpEnergy: MarineForecastEnergy;
  groundswell: MarineForecastEnergy;
  rainSummary: string | null;
  source: SourceMeta;
}

export interface SurfOutlookShore {
  shoreId: ForecastRegionId;
  label: string;
  surf: string | null;
  summary: string | null;
}

export interface SurfSpotForecast {
  id: string;
  name: string;
  region: ForecastRegionId;
  surf: string;
}

export interface SurfOutlook {
  issuedAt: string | null;
  briefing: string | null;
  spotBriefing: string | null;
  spots: SurfSpotForecast[];
  spotSource: SourceMeta | null;
  shores: Record<ForecastRegionId, SurfOutlookShore>;
  source: SourceMeta;
}

export interface ChannelForecastObservation {
  channelId: "pailolo" | "kaiwi" | "alenuihaha";
  displayName: string;
  wind: WindObservation;
  bumpEnergy: MarineForecastEnergy;
  rainSummary: string | null;
  forecastDays: MarineForecastDay[];
}

export interface WeatherAlert {
  id: string;
  headline: string;
  severity: string;
  event: string;
  affectedZones?: string[];
  effectiveAt: string | null;
  expiresAt: string | null;
  description: string;
  source: SourceMeta;
}

export interface RouteConfig {
  id: string;
  name: string;
  region: string;
  start: GeoPoint;
  finish: GeoPoint;
  idealWindDirectionDeg: number;
  idealWindDirectionToleranceDeg: number;
  idealWindSpeedRangeKt: [number, number];
  maxComfortableGustKt: number;
  idealSwellDirectionDeg: number;
  idealSwellDirectionToleranceDeg: number;
  idealSwellHeightRangeFt: [number, number];
  preferredTideTrend: TideTrend[];
  stations: {
    // Configure real NOAA/NDBC station IDs here as the product expands.
    primaryBuoyId: string;
    finishWindStationId?: string;
    tideStationId: string;
    // NOAA CO-OPS currents station/bin placeholders should be configured per channel/harbor.
    currentStationId?: string;
    nwsPoint: GeoPoint;
  };
}

export interface OceanConditionSnapshot {
  route: RouteConfig;
  generatedAt: string;
  wind: WindObservation;
  swell: SwellObservation;
  groundswell: SeaEnergyObservation;
  bumpEnergy: SeaEnergyObservation;
  tide: TideObservation;
  shoreTides: Record<MauiShoreId, TideObservation>;
  current: CurrentObservation;
  shoreCurrents: Record<MauiShoreId, CurrentObservation>;
  shoreObservations: Record<MauiShoreId, ShoreOceanObservations>;
  offshoreObservations: Record<OffshoreBuoyId, OffshoreBuoyObservation>;
  coastalWinds: CoastalWindObservation[];
  harborWinds: HarborWindObservation[];
  forecastWindows: ForecastWindow[];
  shoreForecastWindows: Record<ForecastRegionId, ForecastWindow[]>;
  marineForecastDays: Record<"windward" | "leeward" | "maalaea", MarineForecastDay[]>;
  surfOutlook: SurfOutlook | null;
  channelForecasts: Record<ChannelForecastObservation["channelId"], ChannelForecastObservation>;
  channelCurrents: Record<ChannelForecastObservation["channelId"], CurrentObservation>;
  alerts: WeatherAlert[];
  sources: SourceMeta[];
}

export interface RouteScore {
  routeId: string;
  generatedAt: string;
  runQualityScore: number;
  windAlignmentScore: number;
  swellAlignmentScore: number;
  tideWindowScore: number;
  dataConfidenceScore: number;
  bestLaunchWindow: ForecastWindow | null;
  riskLevel: RouteRiskLevel;
  recommendation: string;
  reasons: string[];
  missingData: string[];
}

export interface OceanIntelligenceResult {
  snapshot: OceanConditionSnapshot;
  score: RouteScore;
}
