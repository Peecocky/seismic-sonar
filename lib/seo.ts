/**
 * Central SEO configuration.
 *
 * Every canonical URL, sitemap entry, Open Graph tag and JSON-LD block is
 * derived from `siteUrl`, so pointing the deployment at a different domain
 * only requires setting NEXT_PUBLIC_SITE_URL.
 */

const FALLBACK_SITE_URL = 'https://seismic-sonar.vercel.app';

function normalize(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) return FALLBACK_SITE_URL;
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Absolute origin of the deployed site, without a trailing slash. */
export const siteUrl = normalize(
  process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    FALLBACK_SITE_URL
);

/** Build an absolute URL from a site-root-relative path. */
export function absoluteUrl(path = '/'): string {
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export const siteName = 'Seismic Sonar';

export const siteTagline = 'Listen to global earthquakes and typhoons in real time';

export const siteDescription =
  'Seismic Sonar is a free interactive 3D globe that turns live USGS M4.5+ earthquake data into sound. Sweep a sonar probe across the world map to hear magnitude as pitch and depth as timbre, scrub a linked magnitude-vs-time timeline, track the past 30 days of typhoons with observed and forecast paths, and export any date range as CSV, JSON or GeoJSON.';

/** Short description used where a long one would be truncated (Twitter, manifest). */
export const siteDescriptionShort =
  'An interactive 3D globe that sonifies live USGS earthquake data — hear magnitude as pitch, depth as timbre — plus typhoon tracks and CSV/JSON/GeoJSON data export.';

export const siteKeywords = [
  'earthquake visualization',
  'earthquake map',
  'live earthquake data',
  'USGS earthquake feed',
  'seismic sonification',
  'data sonification',
  'earthquake sound',
  'interactive 3D globe',
  'seismic data visualization',
  'typhoon tracker',
  'typhoon forecast track',
  'information visualization',
  'D3.js visualization',
  'Web Audio API',
  'earthquake data download',
  'GeoJSON earthquake export',
];

export const authorName = 'Seismic Sonar';

export const repositoryUrl = 'https://github.com/Peecocky/seismic-sonar';

/** Locales the interface can be read in (the UI has an in-page language switch). */
export const siteLocales = ['en_US', 'zh_CN'] as const;
