import type { Metadata } from 'next';
import SeismicSonarApp from '@/components/SeismicSonarApp';
import StructuredData from '@/components/StructuredData';
import {
  absoluteUrl,
  authorName,
  repositoryUrl,
  siteDescription,
  siteName,
  siteTagline,
} from '@/lib/seo';

export const metadata: Metadata = {
  title: {
    absolute: `${siteName} — ${siteTagline}`,
  },
  description: siteDescription,
  alternates: { canonical: '/' },
};

const webApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  '@id': absoluteUrl('/#app'),
  name: siteName,
  alternateName: 'Seismic Sonar — earthquake sonification globe',
  url: absoluteUrl('/'),
  description: siteDescription,
  applicationCategory: 'EducationalApplication',
  applicationSubCategory: 'Data visualization',
  operatingSystem: 'Any modern web browser',
  browserRequirements: 'Requires JavaScript, WebGL and the Web Audio API.',
  inLanguage: ['en', 'zh-CN'],
  isAccessibleForFree: true,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  author: { '@type': 'Organization', name: authorName, url: repositoryUrl },
  featureList: [
    'Interactive 3D globe and 2D map of live USGS M4.5+ earthquakes',
    'Real-time sonification: magnitude maps to pitch, depth maps to timbre, proximity maps to volume',
    'Linked magnitude-vs-time timeline with brushing and playback',
    'Rolling 30, 90, 180 and 360 day data windows',
    'Typhoon globe with observed tracks and the latest China forecast track',
    'Earthquake data export as CSV, JSON or GeoJSON for any date range',
    'English and Chinese interface',
  ],
  screenshot: absoluteUrl('/opengraph-image'),
  softwareHelp: { '@type': 'CreativeWork', url: absoluteUrl('/about') },
};

const datasetSchema = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  '@id': absoluteUrl('/#dataset'),
  name: 'Global M4.5+ earthquakes visualised by Seismic Sonar',
  description:
    'Global earthquakes of magnitude 4.5 and above from the USGS Earthquake Hazards Program, rendered on an interactive globe and downloadable as CSV, JSON or GeoJSON.',
  url: absoluteUrl('/'),
  license: 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits',
  isAccessibleForFree: true,
  keywords: ['earthquake', 'seismicity', 'magnitude', 'hypocentral depth', 'USGS', 'typhoon'],
  spatialCoverage: { '@type': 'Place', name: 'Worldwide' },
  creator: {
    '@type': 'Organization',
    name: 'USGS Earthquake Hazards Program',
    url: 'https://earthquake.usgs.gov/',
  },
  distribution: [
    {
      '@type': 'DataDownload',
      encodingFormat: 'application/geo+json',
      contentUrl:
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson',
    },
  ],
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': absoluteUrl('/#faq'),
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What does Seismic Sonar do?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'It plots live USGS magnitude 4.5+ earthquakes on a 3D globe and turns them into sound. Your cursor acts as a sonar probe: events near it are audible, magnitude sets the pitch, depth sets how bright or muffled the tone is, and distance sets the volume.',
      },
    },
    {
      '@type': 'Question',
      name: 'Where does the earthquake data come from?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'From the public USGS Earthquake Hazards Program M4.5+ feed, fetched at runtime for rolling 30, 90, 180 and 360 day windows. Typhoon tracks come from the Zhejiang Provincial Water Resources Department typhoon service.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I download the earthquake data?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. The data download dialog exports any custom date range as CSV, formatted JSON or GeoJSON, with the fields id, magnitude, place, time, longitude, latitude and depth.',
      },
    },
    {
      '@type': 'Question',
      name: 'Why do I have to click before I hear anything?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Browsers only allow audio to start after a user gesture, so the first click on “Engage Instrument” unlocks the Web Audio context. Headphones are recommended.',
      },
    },
  ],
};

export default function Page() {
  return (
    <>
      <StructuredData id="ld-webapplication" data={webApplicationSchema} />
      <StructuredData id="ld-dataset" data={datasetSchema} />
      <StructuredData id="ld-faq" data={faqSchema} />

      {/*
        Crawlable summary of an application whose real content lives on a WebGL
        canvas. Hidden visually, but read by screen readers and search engines.
      */}
      <section className="sr-only">
        <h1>{siteName} — an interactive globe that turns live earthquake data into sound</h1>
        <p>{siteDescription}</p>
        <h2>What you can do here</h2>
        <ul>
          <li>
            Explore every magnitude 4.5+ earthquake recorded worldwide by the USGS over the last 30,
            90, 180 or 360 days on a 3D globe or a flat Natural Earth map.
          </li>
          <li>
            Hear the seismic field: magnitude becomes pitch, hypocentral depth becomes timbre, and
            the distance from your probe becomes loudness.
          </li>
          <li>
            Brush a magnitude-versus-time timeline to filter which events are drawn and which voices
            are audible, or play the window back in time.
          </li>
          <li>
            Switch to the typhoon globe for systems observed in the past 30 days, with observed
            tracks and the latest China forecast track.
          </li>
          <li>
            Download any date range of earthquakes as CSV, formatted JSON or GeoJSON.
          </li>
        </ul>
        <p>
          Read more on the <a href="/about">about page</a>, or browse the source on{' '}
          <a href={repositoryUrl}>GitHub</a>.
        </p>
      </section>

      <noscript>
        <div className="noscript-note">
          <h2>JavaScript is required</h2>
          <p>
            Seismic Sonar renders a live WebGL globe and synthesises audio in the browser, so it
            needs JavaScript, WebGL and the Web Audio API. Enable JavaScript to run the instrument,
            or read the <a href="/about">text description of the project</a>.
          </p>
        </div>
      </noscript>

      <SeismicSonarApp />
    </>
  );
}
