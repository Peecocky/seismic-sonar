import { ImageResponse } from 'next/og';
import { siteName, siteTagline } from '@/lib/seo';

export const runtime = 'nodejs';
export const alt = `${siteName} — ${siteTagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Social-card image: the same sonar rings as the favicon, at card scale. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #16252b 0%, #0d181d 100%)',
          color: '#edf3f6',
          padding: '72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div
            style={{
              fontSize: 26,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: '#7fb9cc',
            }}
          >
            Live USGS M4.5+ · Web Audio
          </div>
          <div style={{ fontSize: 96, fontWeight: 700, marginTop: 18, lineHeight: 1.05 }}>
            {siteName}
          </div>
          <div style={{ fontSize: 38, marginTop: 22, color: '#c8dbe3', lineHeight: 1.3 }}>
            {siteTagline}
          </div>
        </div>

        <svg width="360" height="360" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="29" fill="none" stroke="#176b8b" strokeWidth="1.2" opacity="0.4" />
          <circle cx="32" cy="32" r="20" fill="none" stroke="#176b8b" strokeWidth="1.6" opacity="0.7" />
          <circle cx="32" cy="32" r="13" fill="none" stroke="#168f9e" strokeWidth="1.8" />
          <circle cx="32" cy="32" r="6.5" fill="none" stroke="#c87911" strokeWidth="2" />
          <circle cx="32" cy="32" r="2.8" fill="#cf3f32" />
          <path
            d="M3 32h9M52 32h9M32 3v9M32 52v9"
            stroke="#edf3f6"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.65"
          />
        </svg>
      </div>
    ),
    size
  );
}
