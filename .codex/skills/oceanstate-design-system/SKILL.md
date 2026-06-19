---
name: oceanstate-design-system
description: Design system and forecast architecture rules for OceanState Maui.
---

# OceanState Product Philosophy

OceanState is a premium marine/ocean forecast dashboard for Maui.

The UI should feel:
- operational
- oceanic
- premium
- fast
- minimal
- data-first

Avoid:
- crypto aesthetics
- oversized cards
- excessive gradients
- fake complexity
- source metadata dominance

# Forecast Hierarchy

Priority:
1. wind direction
2. wind speed
3. gusts
4. swell direction
5. swell period
6. recommendation quality

Source metadata is always secondary.

# Run Architecture

Maliko Run:
- only renders inside North Shore
- appears below shore navigation
- appears above North Shore forecast
- represents exposed North Shore run conditions

South Side Run:
- only renders inside South Side
- appears below shore navigation
- appears above South Side forecast
- uses Maalaea + Kihei nearshore logic
- avoid offshore Lanai duplication

Channels:
- offshore forecasts belong ONLY in Channels
- do not duplicate offshore data across all regions

# Forecast Data Rules

Kanaha:
- nearshore launch conditions
- airport/coastal validation
- not harbor duplicate data

Kahului Harbor:
- protected harbor conditions
- separate from Kanaha

# Webcam Philosophy

- maximum 2–3 curated cameras
- no webcam directories
- only real ocean-visible cameras
- prioritize usefulness over quantity

# UI Rules

- compact cards
- mobile-first
- clear spacing
- readable hierarchy
- slightly larger primary data
- smalr source chips

# Dark Mode

Use:
- deep navy backgrounds
- oceanic contrast
- teal/cyan accents
- readable text hierarchy

Avoid:
- flat black
- pure white panels
- monotone palettes
- black active buttons

Live dots:
- same green as light mode

# General

The app should answer quickly:
“Where should I go and is it good right now?”
