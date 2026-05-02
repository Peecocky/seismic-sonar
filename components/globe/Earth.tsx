'use client';

import { useMemo } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import { CanvasTexture, SRGBColorSpace } from 'three';
import countries from 'world-atlas/countries-110m.json';
import type { ResolvedTheme } from '@/lib/ui';

interface EarthProps {
  theme: ResolvedTheme;
  onPointerMove?: (event: any) => void;
  onPointerLeave?: () => void;
  onClick?: (event: any) => void;
}

const world = feature((countries as any), (countries as any).objects.countries) as any;

export default function Earth({ theme, onPointerMove, onPointerLeave, onClick }: EarthProps) {
  const texture = useMemo(() => createEarthTexture(theme), [theme]);

  return (
    <group>
      <mesh onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} onClick={onClick}>
        <sphereGeometry args={[2, 96, 96]} />
        <meshStandardMaterial map={texture} roughness={0.97} metalness={0.02} />
      </mesh>

      <mesh scale={1.038}>
        <sphereGeometry args={[2, 48, 48]} />
        <meshBasicMaterial color={theme === 'night' ? '#8cf5aa' : '#55b6cf'} transparent opacity={theme === 'night' ? 0.045 : 0.035} depthWrite={false} />
      </mesh>
    </group>
  );
}

function createEarthTexture(theme: ResolvedTheme) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  if (!context) {
    return new CanvasTexture(canvas);
  }

  context.fillStyle = theme === 'night' ? '#0e2628' : '#d9eef5';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const projection = d3.geoEquirectangular().fitSize([canvas.width, canvas.height], { type: 'Sphere' } as any);
  const path = d3.geoPath(projection, context);

  context.save();
  context.fillStyle = theme === 'night' ? '#173b36' : '#9fcf9f';
  context.beginPath();
  path(world);
  context.fill();
  context.restore();

  context.save();
  context.strokeStyle = theme === 'night' ? 'rgba(135, 214, 226, 0.5)' : 'rgba(55, 113, 100, 0.42)';
  context.lineWidth = 1.2;
  context.beginPath();
  path(world);
  context.stroke();
  context.restore();

  context.save();
  const graticule = d3.geoGraticule10();
  context.strokeStyle = theme === 'night' ? 'rgba(123, 240, 156, 0.12)' : 'rgba(51, 100, 125, 0.16)';
  context.lineWidth = 0.7;
  context.beginPath();
  path(graticule as any);
  context.stroke();
  context.restore();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
