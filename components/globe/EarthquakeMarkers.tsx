'use client';

import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { Quake } from '@/lib/data';
import { EARTH_RADIUS, MARKER_ALTITUDE, latLonToVector3, quakeMarkerColor, quakeMarkerScale } from '@/lib/globe';

interface EarthquakeMarkersProps {
  quakes: Quake[];
  hoverId: string | null;
  selectedId: string | null;
  onHover: (quake: Quake | null) => void;
  onSelect: (quake: Quake) => void;
  onProbePoint: (event: ThreeEvent<PointerEvent>) => void;
}

export default function EarthquakeMarkers({
  quakes,
  hoverId,
  selectedId,
  onHover,
  onSelect,
  onProbePoint,
}: EarthquakeMarkersProps) {
  const markers = useMemo(
    () =>
      quakes.map((quake) => ({
        quake,
        position: latLonToVector3(quake.lat, quake.lon, EARTH_RADIUS + MARKER_ALTITUDE),
        scale: quakeMarkerScale(quake.mag),
      })),
    [quakes]
  );

  return (
    <group>
      {markers.map(({ quake, position, scale }) => {
        const hovered = !selectedId && quake.id === hoverId;
        const selected = quake.id === selectedId;
        const active = hovered || selected;
        const color = quakeMarkerColor(quake.mag, active);

        return (
          <group key={quake.id} position={position}>
            {active && (
              <mesh scale={scale * 3.5}>
                <sphereGeometry args={[1, 24, 24]} />
                <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} />
              </mesh>
            )}
            <mesh
              scale={active ? scale * 1.45 : scale}
              onPointerEnter={(event) => {
                event.stopPropagation();
                onProbePoint(event);
                if (!selectedId) onHover(quake);
              }}
              onPointerMove={(event) => {
                event.stopPropagation();
                onProbePoint(event);
              }}
              onPointerLeave={(event) => {
                event.stopPropagation();
                if (!selectedId) onHover(null);
              }}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(quake);
              }}
            >
              <sphereGeometry args={[1, 16, 16]} />
              <meshStandardMaterial emissive={color} emissiveIntensity={active ? 1.6 : 0.72} color={color} metalness={0.04} roughness={0.38} />
            </mesh>
            <mesh
              scale={Math.max(scale * 3, 0.075)}
              onPointerEnter={(event) => {
                event.stopPropagation();
                onProbePoint(event);
                if (!selectedId) onHover(quake);
              }}
              onPointerMove={(event) => {
                event.stopPropagation();
                onProbePoint(event);
              }}
              onPointerLeave={(event) => {
                event.stopPropagation();
                if (!selectedId) onHover(null);
              }}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(quake);
              }}
            >
              <sphereGeometry args={[1, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {selected && (
              <Html position={[0.28, 0.18, 0]} distanceFactor={12}>
                <div className="marker-card">
                  <div className="marker-card-mag">M{quake.mag.toFixed(1)}</div>
                  <div className="marker-card-place">{quake.place}</div>
                  <div className="marker-card-meta">Depth {quake.depth.toFixed(0)} km</div>
                  <div className="marker-card-meta">{new Date(quake.time).toUTCString()}</div>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
