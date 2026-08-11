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

- USGS M4.5+ earthquakes fetched at runtime for rolling 30, 90, 180, and 360-day windows
- Custom date-range earthquake export in CSV, formatted JSON, or GeoJSON
- A separate switchable typhoon globe for systems observed during the past 30 days, with observed tracks and the latest China forecast track
- Fields: `id, mag, place, time, lon, lat, depth`

Data source:
<https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson>

Typhoon source:
<https://typhoon.slt.zj.gov.cn/>

## Getting started

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. The first click on *Engage Instrument*
both dismisses the intro and unlocks the `AudioContext` (browsers require a
user gesture). Use headphones for best results.

## Search engine visibility (SEO)

The site is set up to be crawled and indexed by Google out of the box:

| What | Where |
| --- | --- |
| Site-wide title/description/keywords, canonical URL, Open Graph + Twitter cards, robots directives | `app/layout.tsx` |
| Per-page metadata and JSON-LD (`WebApplication`, `Dataset`, `FAQPage`) | `app/page.tsx` |
| Crawlable text page with real prose + `TechArticle`/`BreadcrumbList` JSON-LD | `app/about/page.tsx` |
| `robots.txt` (allows everything but `/api/`, points at the sitemap) | `app/robots.ts` |
| `sitemap.xml` | `app/sitemap.ts` |
| PWA manifest | `app/manifest.ts` |
| Favicon | `app/icon.svg` |
| 1200×630 social card, generated at build time | `app/opengraph-image.tsx` |
| Shared strings and URL helpers | `lib/seo.ts` |

Because the instrument itself is a WebGL canvas with almost no crawlable text,
`app/page.tsx` also server-renders a screen-reader-only summary (`.sr-only`)
plus a `<noscript>` fallback, so a crawler that never runs JavaScript still
receives an accurate description of the page.

### Before you deploy

1. Set the real origin, otherwise canonical URLs and the sitemap point at the
   fallback domain:

   ```bash
   NEXT_PUBLIC_SITE_URL=https://your-domain.example
   ```

   See `.env.example`. On Vercel, `VERCEL_PROJECT_PRODUCTION_URL` is used
   automatically if the variable is unset.

2. Verify the output after `npm run build && npm start`:
   <http://localhost:3000/robots.txt>, <http://localhost:3000/sitemap.xml>,
   <http://localhost:3000/opengraph-image>.

### After you deploy

1. Add the site in [Google Search Console](https://search.google.com/search-console)
   (domain or URL-prefix property). If you verify with the *HTML tag* method,
   put the token in `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` and redeploy — the
   meta tag is emitted for you.
2. Submit `https://your-domain.example/sitemap.xml` under **Sitemaps**.
3. Use **URL Inspection → Request indexing** for `/` and `/about` to speed up
   the first crawl. Indexing normally takes days, not minutes.
4. Check the rendered page in the [Rich Results Test](https://search.google.com/test/rich-results)
   and the card in a social debugger to confirm the JSON-LD and OG image parse.

Note that Google decides what to index; these files make the site eligible and
well-described, they cannot guarantee a ranking.

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

## Project structure

```
app/
  layout.tsx        Root layout + site-wide SEO metadata
  page.tsx          Server page: metadata, JSON-LD, crawlable summary
  about/page.tsx    Text description of the project (indexable)
  robots.ts         robots.txt
  sitemap.ts        sitemap.xml
  manifest.ts       Web app manifest
  opengraph-image.tsx Social card, generated at build time
  globals.css       Monitor-station aesthetic
components/
  SeismicSonarApp.tsx Coordinating state for all three views
  StructuredData.tsx JSON-LD block for search engines
  DataDownloadDialog.tsx Custom range fetch, preview, and export
  GeoMap.tsx        Projection, probe ring, quake markers, tooltip
  TyphoonPanel.tsx  Dedicated typhoon status and forecast interface
  TyphoonTimeline.tsx Observed and forecast activity timeline
  Timeline.tsx      Magnitude-vs-time + d3-brush
  SidePanel.tsx     Controls, spectrum, nearest probe list, selection detail
  Intro.tsx         Splash overlay for initial user gesture
lib/
  seo.ts            Site URL, description and keyword configuration
  audio.ts          SonarEngine (Web Audio)
  data.ts           Loader, types, formatters
  typhoon.ts        Typhoon loader and shared types
app/api/typhoons/
  route.ts          Recent typhoon and forecast normalization
```

## Credits

- Earthquake data: **USGS Earthquake Hazards Program**
- Typhoon data: **Zhejiang Provincial Water Resources Department**
- World map: **Natural Earth** via `world-atlas`
- Typography: **Fraunces** and **JetBrains Mono** (Google Fonts)
