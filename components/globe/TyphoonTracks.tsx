'use client';

import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Typhoon, TyphoonPoint } from '@/lib/typhoon';
import { typhoonDisplayName, typhoonLevel, typhoonLevelColor, typhoonTrackAtTime } from '@/lib/typhoon';
import { EARTH_RADIUS, interpolateLatLon, latLonToVector3 } from '@/lib/globe';

interface Props {
  typhoons: Typhoon[];
  selectedId: string | null;
  onSelect: (typhoon: Typhoon) => void;
  displayTime: number | null;
}

const TRACK_RADIUS = EARTH_RADIUS + 0.052;
const CENTER_RADIUS = EARTH_RADIUS + 0.066;

export default function TyphoonTracks({ typhoons, selectedId, onSelect, displayTime }: Props) {
  const tracks = useMemo(
    () =>
      typhoons.map((typhoon) => {
        const state = typhoonTrackAtTime(typhoon, displayTime);
        return {
          typhoon,
          actual: buildArcPoints(state.points),
          forecast: displayTime === null ? buildArcPoints(typhoon.forecast?.points ?? []) : [],
          center: state.center
            ? latLonToVector3(state.center.lat, state.center.lon, CENTER_RADIUS)
            : null,
          centerPoint: state.center,
        };
      }),
    [displayTime, typhoons]
  );

  return (
    <group>
      {tracks.map(({ typhoon, actual, forecast, center, centerPoint }) => {
        const selected = typhoon.id === selectedId;
        const markerScale = 0.032 + Math.max(0, (centerPoint?.power ?? 7) - 7) * 0.002;
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
            {center && centerPoint && (
              <>
                <mesh
                  position={center}
                  scale={selected ? markerScale * 1.35 : markerScale}
                  onClick={(event: ThreeEvent<MouseEvent>) => {
                    event.stopPropagation();
                    onSelect(typhoon);
                  }}
                >
                  <sphereGeometry args={[1, 20, 20]} />
                  <meshBasicMaterial color={typhoonLevelColor(centerPoint.power)} transparent opacity={0.98} side={2} />
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
              </>
            )}
            {selected && center && centerPoint && (
              <Html position={center.clone().multiplyScalar(1.035)} distanceFactor={4}>
                <div className="marker-card typhoon-marker-card">
                  <div className="marker-card-mag">{typhoonDisplayName(typhoon)} · {typhoonLevel(centerPoint)}</div>
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
