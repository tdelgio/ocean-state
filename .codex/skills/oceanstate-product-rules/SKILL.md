---
name: oceanstate-product-rules
description: Preserve Ocean State product, data-source, and UI rules for the Maui live ocean-state app. Use when modifying Ocean State routes, live ocean cards, forecast cards, tides, currents, wind, buoys, channels, harbors, cameras, PWA install behavior, or when deciding whether to show, hide, label, or source ocean data.
---

# Ocean State Product Rules

## Core Philosophy

Ocean State is a live ocean-state observation tool for Maui ocean users. Prioritize observed or clearly sourced current conditions. Forecast is secondary and must be labeled as forecast/model/prediction.

Use the product principle:

Observe. Understand. Verify.

Do not invent conditions, confidence, AI verdicts, live readings, stations, cameras, vessel activity, currents, or recommendations.

## Data Rules

- Show live/observed values only when the source provides measured data.
- Label forecast/model/prediction values clearly.
- Hide missing optional data rather than rendering noisy placeholders like `No live buoy data`, `period unavailable`, or `Prediction only`.
- Use red/unavailable states only when a required card is expected but a source failed.
- Keep source links available through chips or source info controls so users can verify official data.
- Never expose raw station IDs as primary labels unless the station name is unknown.
- Do not use Pauwela/51205 as a wind station. It is a wave buoy for swell/sea energy.
- Do not use NOAA CWF channel forecast as live wind. It is forecast/model text.
- Do not use WindyTron or WeatherFlow/Tempest in production unless permission/token/access is explicitly provided.

## Maui Source Mapping

- North Shore wave/sea energy: Pauwela / 51205.
- North Shore wind without local live station: use clearly labeled forecast/model only; do not claim live.
- Kahului Harbor wind: NOAA KLIH1 when available.
- South Side / Lanai offshore wave validation: 51213.
- Kihei tide: NOAA tide prediction station TPT2797; label current height as estimate when interpolated.
- Lahaina / West Side tide: NOAA tide prediction station TPT2799; label current height as estimate when interpolated.
- Kahului tide: NOAA CO-OPS 1615680 where observed water level exists.
- Channels: Pailolo PHZ120, Kaiwi PHZ116, Alenuihaha PHZ121 are NOAA marine forecast zones, not live stations.
- Offshore waters: keep offshore/open-ocean buoys separate from channels and shores.

## UI Rules

- Data hierarchy: direction, speed, gusts, sea/swell, tide/current, rain, source freshness.
- Source badges are secondary; values are primary.
- If wind bumps or groundswell have no real partition/value, hide that block.
- If current data is unavailable, hide current cards unless the user explicitly asks for unavailable-state debugging.
- Tide cards should show trend plus current/estimated tide height when available, then next high/low.
- Dark mode must preserve contrast: live dots green, unavailable dots red, gust chips readable.
- Keep mobile layouts free of horizontal overflow unless a route strip is intentionally scrollable.

## Change Safety

Before finalizing code changes:

- Run lint/build when feasible.
- Check that `/home`, `/channels`, `/harbors`, and `/forecast` still render.
- Avoid changing product architecture unless explicitly requested.
- Avoid adding paid/private APIs, auth, database, Mapbox, or scraping protected streams.

