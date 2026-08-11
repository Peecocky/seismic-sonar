import type { Metadata, Viewport } from 'next';
import {
  absoluteUrl,
  authorName,
  repositoryUrl,
  siteDescription,
  siteDescriptionShort,
  siteKeywords,
  siteName,
  siteTagline,
  siteUrl,
} from '@/lib/seo';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} — ${siteTagline}`,
    template: `%s · ${siteName}`,
  },
  description: siteDescription,
  keywords: siteKeywords,
  applicationName: siteName,
  authors: [{ name: authorName, url: repositoryUrl }],
  creator: authorName,
  publisher: authorName,
  category: 'science',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: absoluteUrl('/'),
    siteName,
    title: `${siteName} — ${siteTagline}`,
    description: siteDescription,
    locale: 'en_US',
    alternateLocale: ['zh_CN'],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteName} — ${siteTagline}`,
    description: siteDescriptionShort,
  },
  // Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION to the token from Search Console's
  // "HTML tag" verification method to have the meta tag emitted automatically.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#16252b',
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://earthquake.usgs.gov" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
