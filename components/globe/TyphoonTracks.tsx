'use client';

import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Typhoon, TyphoonPoint } from '@/lib/typhoon';
import { typhoonDisplayName } from '@/lib/typhoon';
import { EARTH_RADIUS, interpolateLatLon, latLonToVector3 } from '@/lib/globe';

interface Props {
  typhoons: Typhoon[];
  selectedId: string | null;
  onSelect: (typhoon: Typhoon) => void;
}

const TRACK_RADIUS = EARTH_RADIUS + 0.052;
const CENTER_RADIUS = EARTH_RADIUS + 0.066;

export default function TyphoonTracks({ typhoons, selectedId, onSelect }: Props) {
  const tracks = useMemo(
    () =>
      typhoons.map((typhoon) => ({
        typhoon,
        actual: buildArcPoints(typhoon.points),
        forecast: buildArcPoints(typhoon.forecast?.points ?? []),
        center: latestCenter(typhoon),
      })),
    [typhoons]
  );

  return (
    <group>
      {tracks.map(({ typhoon, actual, forecast, center }) => {
        const selected = typhoon.id === selectedId;
        const centerPoint = typhoon.points[typhoon.points.length - 1];
        return (
          <group key={typhoon.id}>
            {actual.length > 1 && (
              <Line points={actual} color={selected ? '#f8fbff' : '#15a6b8'} lineWidth={selected ? 2.6 : 1.5} transparent opacity={selected ? 1 : 0.82} />
            )}
            {forecast.length > 1 && (
              <Line
                points={forecast}
                color="#f05a78"
                lineWidth={selected ? 2.4 : 1.7}
                dashed
                dashSize={0.035}
                gapSize={0.025}
                transparent
                opacity={0.92}
              />
            )}
            <mesh
              position={center}
              scale={selected ? 0.048 : 0.036}
              onClick={(event: ThreeEvent<MouseEvent>) => {
                event.stopPropagation();
                onSelect(typhoon);
              }}
            >
              <sphereGeometry args={[1, 20, 20]} />
              <meshBasicMaterial color={typhoon.isActive ? '#f05a78' : '#15a6b8'} transparent opacity={0.96} side={2} />
            </mesh>
            <mesh
              position={center}
              scale={0.12}
              onClick={(event: ThreeEvent<MouseEvent>) => {
                event.stopPropagation();
                onSelect(typhoon);
              }}
            >
              <sphereGeometry args={[1, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {selected && centerPoint && (
              <Html position={center.clone().multiplyScalar(1.035)} distanceFactor={4}>
                <div className="marker-card typhoon-marker-card">
                  <div className="marker-card-mag">{typhoonDisplayName(typhoon)}</div>
                  <div className="marker-card-place">{centerPoint.strength || 'Tropical cyclone'}</div>
                  <div className="marker-card-meta">{centerPoint.windSpeed ?? '--'} m/s · {centerPoint.pressure ?? '--'} hPa</div>
                  <div className="marker-card-meta">{new Date(centerPoint.time).toUTCString()}</div>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

function buildArcPoints(points: TyphoonPoint[]) {
  if (points.length === 0) return [];
  const output: Vector3[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const steps = Math.max(2, Math.ceil(Math.hypot(end.lat - start.lat, end.lon - start.lon) / 2));
    for (let step = 0; step < steps; step += 1) {
      const point = interpolateLatLon(
        { latitude: start.lat, longitude: start.lon },
        { latitude: end.lat, longitude: end.lon },
        step / steps
      );
      output.push(latLonToVector3(point.latitude, point.longitude, TRACK_RADIUS));
    }
  }
  const last = points[points.length - 1];
  output.push(latLonToVector3(last.lat, last.lon, TRACK_RADIUS));
  return output;
}

function latestCenter(typhoon: Typhoon) {
  const latest = typhoon.points[typhoon.points.length - 1];
  return latLonToVector3(latest.lat, latest.lon, CENTER_RADIUS);
}
