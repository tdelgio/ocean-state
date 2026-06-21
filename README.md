# Ocean State

Closed beta live ocean-state observations for Maui ocean users.

Ocean State is observation-first: live wind, bump energy, swell, tide/current, channels, harbors, rain, alerts, and camera verification. Forecast is secondary and shown as model timeline data only.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production Check

```bash
npm run build
npm run start
```

## Deploy

### Vercel

Vercel is preferred for this Next.js app.

- Framework: Next.js
- Build command: `npm run build`
- Install command: `npm install`
- Output: handled by Next.js/Vercel

`vercel.json` is included for closed beta deployment.

### Netlify

Netlify is also configured through `netlify.toml` and `@netlify/plugin-nextjs`.

- Build command: `npm run build`
- Publish directory: `.next`
- Node version: `20.18.1`

## Environment Variables

No required environment variables for the closed beta.

Future optional variables may include camera stream URLs, feedback routing, AIS provider keys, and custom NOAA station configuration.

## Data Sources

- NOAA NDBC realtime buoy observations, including Pauwela `51205`
- NDBC spectral files when available, used to separate 4-9s bump energy from 10s+ groundswell
- NOAA CO-OPS tides, water levels, and current placeholders
- NWS hourly forecast and active alerts
- NOAA HFO marine zones for channel model context
- ALERTWest public camera inventory with verified snapshot filtering
- Hawaii DOT links to Hawaii PortCall for live harbor vessel schedules

Live Ocean refreshes its server snapshot every five minutes while the app is open. Individual upstream sources use their own cache windows to avoid unnecessary requests.

## Beta Status

This is a closed beta, not a public launch.

Live sources can be delayed or unavailable. When a source fails, the app should show stale, unavailable, or sample states instead of crashing.

Feedback: `feedback@oceanstate.live`

## License

Ocean State source code is licensed under `AGPL-3.0-or-later`.

The Ocean State name, logo, visual identity, and branding are not licensed for
unrestricted use. See `TRADEMARKS.md`.
