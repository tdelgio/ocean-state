# Ocean State Current Stable Decisions

- Product name: Ocean State.
- Main nav: Live Ocean, Channels, Harbors, Forecast.
- PWA install support exists via manifest, icon routes, apple icon route, and footer install link.
- Forecast should use NOAA/NWS model or marine forecast data and stay secondary to Live Ocean.
- Live Ocean should not show fake camera thumbnails or fake live wind.
- Channels parser should tolerate `.TODAY`, `.TONIGHT`, and future first forecast periods from NOAA CWF.
- Missing buoy/wind/wave partitions should not produce fake values.
- WindyTron has useful near-live Ho'okipa/Kanaha readings in mph, but do not integrate unless permission is granted.
- Tempest/WeatherFlow requires a token and likely commercial/partner access for public multi-station use.

