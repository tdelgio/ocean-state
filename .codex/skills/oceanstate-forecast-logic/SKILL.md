---
name: oceanstate-forecast-logic
description: Forecast source, region, run, and marine data rules for OceanState Maui.
---

# OceanState Forecast Logic

OceanState is a Maui ocean forecast app. Forecast logic must be geographically accurate and useful for real ocean users.

## Core Rule

Do not duplicate the same offshore or harbor data across unrelated regions.

Each region should represent its real local condition.

## North Shore

North Shore includes:
- Maliko Run
- Kanaha
- Paia / Hookipa / windward coast
- Kahului Harbor as a separate harbor condition

## Maliko Run

Maliko Run:
- only renders inside North Shore
- appears below shore navigation
- appears above North Shore forecast
- is not a global card
- represents exposed North Shore downwind conditions

Use:
- North Shore coastal wind
- nearshore marine forecast
- exposed water / channel context
- swell direction, period, and wind alignment

Avoid:
- protected harbor data as the main source
- airport-only forecast as the main source
- generic offshore-only forecast

## Kanaha

Kanaha is not Kahului Harbor.

Kanaha represents:
- beach launch conditions
- inside reef / nearshore wind
- airport acceleration zone
- coastal texture

Use:
- nearshore/coastal forecast
- Kahului airport wind as validation
- shoreline station if available

Avoid:
- duplicating Kahului Harbor data
- using offshore buoy as primary source

## Kahului Harbor

Kahului Harbor represents:
- protected harbor interior
- harbor launches
- harbor wind/texture
- harbor-specific observations

Keep it separate from:
- Kanaha
- Maliko Run

## South Side

South Side Run:
- only renders inside South Side
- appears below shore navigation
- appears above South Side forecast
- should not use Lanai offshore as primary source

Preferred structure:
- Start: Maalaea coastal / harbor
- Finish: Kihei coastal / nearshore

Use:
- Maalaea coastal conditions
- Kihei coastal forecast
- NWS nearshore/coastal forecast

Avoid:
- fake offshore midpoint
- Lanai offshore buoy as the main run source
- repeating offshore/channel data in South Side

## Channels

Channels/offshore forecasts belong only inside Channels.

Examples:
- Lanai Offshore
- Pailolo Channel
- Alenuihaha
- Molokai Channel

Do not render channel/offshore data inside:
- North Shore
- South Side
- West Side
- Harbors

## Harbors

Harbors should show only real harbor-specific data.

Do not render:
- empty camera cards
- fake visual verification
- unrelated offshore data

## Source Labels

Source labels are secondary.

The app should prioritize:
1. wind direction
2. wind speed
3. gusts
4. swell size
5. swell direction
6. swell period
7. tide/current
8. recommendation

Do not make source chips more visually important than forecast data.

## Fallback Behavior

If exact local data is not available:
- use the closest reasonable source
- mark it internally as approximate
- do not pretend it is exact
- do not duplicate unrelated offshore data just to fill a card

## Product Goal

The app should answer quickly:

“Where should I go, and is it good right now?”
