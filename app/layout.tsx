import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Seismic Sonar',
  description: 'A sonification-driven interactive visualization of global earthquakes on a 3D globe.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
