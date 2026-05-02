# Seismic Sonar

A sonification-augmented interactive visualization of global earthquakes for
the NYU **Information Visualization** final project.

The project uses sound as an auxiliary perceptual channel: your cursor is a
sonar probe, and as it sweeps across the world map, nearby seismic events
resonate through it. Larger magnitude earthquakes rumble at lower pitches;
shallower ones ring bright; deeper ones come through muffled. The closer the
probe to an event, the louder its voice.

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **D3** (v7) for projections, scales, axes and the brush
- **Web Audio API** for real-time sonification (no external audio libs)
- **TopoJSON** (world-atlas 110m) streamed from a CDN

## Data

- USGS M4.5+ earthquakes, past 30 days, live GeoJSON feed
- Bundled snapshot of **~230 real events** in `public/data/earthquakes.json`
- Refresh the snapshot any time with `npm run refresh-data` (requires Python 3)
- Fields: `id, mag, place, time, lon, lat, depth, tsunami, felt, sig`

Data source:
<https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson>

## Getting started

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. The first click on *Engage Instrument*
both dismisses the intro and unlocks the `AudioContext` (browsers require a
user gesture). Use headphones for best results.

## Views

1. **Geo-map** (required special layout) — Natural Earth projection with one
   circle per quake. Size encodes magnitude; color shifts from amber at
   M4.5–5.2 to crimson above. The cursor draws a phosphor-green probe ring
   whose radius maps to the audio falloff distance.
2. **Timeline** — magnitude vs time, colored by the same magnitude ramp, with
   a horizontal brush. Dragging the brush filters which events are visible
   on the map *and* which voices contribute to the audio.
3. **Sonar panel** — audio controls, live 24-bar spectrum of currently-loud
   voices, the five nearest events to the probe, the selected event detail,
   and a legend.

All views are linked: hovering or clicking in any one of them highlights in
the others.

## Sonification design

Each earthquake becomes a triangle-wave oscillator, with an octave-down sine
sub-oscillator mixed in for magnitude ≥ 5. Mapping:

- **magnitude → pitch**: log scale, `520 Hz · 2^(−(M − 4.5))`.
  So M4.5 ≈ 520 Hz, M5.5 ≈ 260 Hz, M6.5 ≈ 130 Hz (roughly C3).
- **depth → low-pass cutoff**: shallow = bright (6 kHz), 700 km = muffled (400 Hz).
- **proximity → amplitude**: `gain = (1 − d/R)²` for `d < R`, zero otherwise.

A quiet pink-noise bed plays constantly so the soundscape never goes dead.

## Refreshing data

```bash
npm run refresh-data
```

This runs `scripts/process_data.py`, which fetches the USGS feed and writes
`public/data/earthquakes.json`.

## Project structure

```
app/
  layout.tsx        Root layout
  page.tsx          Coordinating state for all three views
  globals.css       Monitor-station aesthetic
components/
  GeoMap.tsx        Projection, probe ring, quake markers, tooltip
  Timeline.tsx      Magnitude-vs-time + d3-brush
  SidePanel.tsx     Controls, spectrum, nearest probe list, selection detail
  Intro.tsx         Splash overlay for initial user gesture
lib/
  audio.ts          SonarEngine (Web Audio)
  data.ts           Loader, types, formatters
public/data/
  earthquakes.json  Bundled USGS snapshot
scripts/
  process_data.py   Refresh the snapshot from USGS
```

## Credits

- Earthquake data: **USGS Earthquake Hazards Program**
- World map: **Natural Earth** via `world-atlas`
- Typography: **Fraunces** and **JetBrains Mono** (Google Fonts)
