import type { MetadataRoute } from 'next';
import { siteDescriptionShort, siteName, siteTagline } from '@/lib/seo';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteName} — ${siteTagline}`,
    short_name: siteName,
    description: siteDescriptionShort,
    start_url: '/',
    display: 'standalone',
    background_color: '#edf3f6',
    theme_color: '#16252b',
    categories: ['education', 'science', 'utilities'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
