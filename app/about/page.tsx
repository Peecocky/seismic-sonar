import type { Metadata } from 'next';
import Link from 'next/link';
import StructuredData from '@/components/StructuredData';
import { absoluteUrl, repositoryUrl, siteName } from '@/lib/seo';

const title = 'About Seismic Sonar: how earthquake sonification works';
const description =
  'How Seismic Sonar works: the USGS M4.5+ data pipeline, the sonification mapping from magnitude to pitch and depth to timbre, the linked globe, map and timeline views, typhoon tracks, and the CSV, JSON and GeoJSON data export.';

export const metadata: Metadata = {
  title: 'About the project',
  description,
  alternates: { canonical: '/about' },
  openGraph: {
    type: 'article',
    url: absoluteUrl('/about'),
    title,
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
};

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  '@id': absoluteUrl('/about#article'),
  headline: title,
  description,
  url: absoluteUrl('/about'),
  inLanguage: 'en',
  isPartOf: { '@type': 'WebSite', '@id': absoluteUrl('/#website') },
  about: [
    { '@type': 'Thing', name: 'Earthquake visualization' },
    { '@type': 'Thing', name: 'Data sonification' },
  ],
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: siteName, item: absoluteUrl('/') },
    { '@type': 'ListItem', position: 2, name: 'About', item: absoluteUrl('/about') },
  ],
};

export default function AboutPage() {
  return (
    <main className="doc-page">
      <StructuredData id="ld-about-article" data={articleSchema} />
      <StructuredData id="ld-about-breadcrumb" data={breadcrumbSchema} />

      <nav className="doc-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">{siteName}</Link>
        <span aria-hidden="true"> / </span>
        <span>About</span>
      </nav>

      <h1>About Seismic Sonar</h1>
      <p className="doc-lede">
        Seismic Sonar is a free, browser-based instrument for exploring global earthquakes with both
        eyes and ears. It was built as an Information Visualization final project at NYU, and it
        treats sound as a second perceptual channel rather than decoration: your cursor is a sonar
        probe, and the seismic events near it resonate through it as you sweep the world.
      </p>
      <p>
        <Link href="/">Open the live instrument →</Link>
      </p>

      <h2>Where the data comes from</h2>
      <p>
        Earthquakes are loaded at runtime from the{' '}
        <a href="https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson">
          USGS Earthquake Hazards Program M4.5+ feed
        </a>
        , covering rolling windows of 30, 90, 180 and 360 days. Each event carries an id, magnitude,
        place name, origin time, longitude, latitude and hypocentral depth. Typhoon systems observed
        over the past 30 days, together with the latest China forecast track, come from the{' '}
        <a href="https://typhoon.slt.zj.gov.cn/">Zhejiang Provincial Water Resources Department</a>.
        Coastlines are drawn from Natural Earth 110m boundaries.
      </p>

      <h2>How the sonification works</h2>
      <p>
        Every visible earthquake becomes a triangle-wave oscillator, with an octave-down sine
        sub-oscillator mixed in for magnitude 5 and above. Three mappings carry the data:
      </p>
      <ul>
        <li>
          <strong>Magnitude → pitch.</strong> A log scale, <code>520 Hz · 2^−(M − 4.5)</code>. M4.5
          sits near 520 Hz, M5.5 near 260 Hz and M6.5 near 130 Hz, so bigger quakes rumble lower.
        </li>
        <li>
          <strong>Depth → timbre.</strong> A low-pass filter opens to 6 kHz for shallow events and
          closes to 400 Hz at 700 km, so deep events sound muffled and shallow ones ring bright.
        </li>
        <li>
          <strong>Proximity → loudness.</strong> Gain follows <code>(1 − d/R)²</code> inside the
          probe radius R and is silent outside it, so moving the probe sweeps across the field.
        </li>
      </ul>
      <p>
        A quiet pink-noise bed plays underneath so the soundscape never goes dead. Because browsers
        require a user gesture before audio can start, the first click on <em>Engage Instrument</em>{' '}
        both dismisses the intro and unlocks the audio context. Headphones are recommended.
      </p>

      <h2>The linked views</h2>
      <ol>
        <li>
          <strong>Globe and map.</strong> A 3D globe or a flat Natural Earth projection with one
          circle per earthquake; size encodes magnitude and colour ramps from amber at M4.5–5.2 to
          crimson above. The cursor draws a probe ring whose radius is the audio falloff distance.
        </li>
        <li>
          <strong>Timeline.</strong> Magnitude versus time, coloured by the same ramp, with a
          horizontal brush. Dragging the brush filters which events are drawn on the map and which
          voices are audible.
        </li>
        <li>
          <strong>Sonar panel.</strong> Audio controls, a live 24-bar spectrum of the loudest
          voices, the five nearest events to the probe, the selected event detail and a legend.
        </li>
      </ol>
      <p>
        All views are linked: hovering or selecting in any one of them highlights the same event in
        the others.
      </p>

      <h2>Downloading the data</h2>
      <p>
        The download dialog fetches a custom date range and exports it as CSV, formatted JSON or
        GeoJSON, so the same events you hear can be taken into a notebook, a GIS tool or another
        visualization. Earthquake data remains credited to the USGS.
      </p>

      <h2>Built with</h2>
      <p>
        Next.js 14 with the App Router, React 18 and TypeScript; D3 v7 for projections, scales, axes
        and the brush; three.js with React Three Fiber for the globe; and the Web Audio API directly,
        with no external audio library. The source is available on{' '}
        <a href={repositoryUrl}>GitHub</a>.
      </p>

      <h2>Credits</h2>
      <ul>
        <li>Earthquake data: USGS Earthquake Hazards Program</li>
        <li>Typhoon data: Zhejiang Provincial Water Resources Department</li>
        <li>World map: Natural Earth via world-atlas</li>
        <li>Typography: Fraunces and IBM Plex Mono</li>
      </ul>

      <p className="doc-back">
        <Link href="/">← Back to the instrument</Link>
      </p>
    </main>
  );
}
