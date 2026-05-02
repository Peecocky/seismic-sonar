'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import countries from 'world-atlas/countries-110m.json';
import type { Quake } from '@/lib/data';
import type { GlobeProbePoint } from '@/lib/globe';
import { buildProbeDistances, KM_PER_RADIAN, latLonToVector3, pointToProbe, quakeMarkerColor } from '@/lib/globe';
import type { Language } from '@/lib/ui';
import { tr } from '@/lib/ui';

interface FlatMapProps {
  quakes: Quake[];
  onHover: (quake: Quake | null) => void;
  onSelect: (quake: Quake | null) => void;
  onProbe: (probe: GlobeProbePoint | null, distances: Map<string, number>) => void;
  onProbeLockChange: (locked: boolean) => void;
  selectedId: string | null;
  hoverId: string | null;
  radiusKm: number;
  probeLocked: boolean;
  language: Language;
}

const world = feature((countries as any), (countries as any).objects.countries) as any;

export default function FlatMap({
  quakes,
  onHover,
  onSelect,
  onProbe,
  onProbeLockChange,
  selectedId,
  hoverId,
  radiusKm,
  probeLocked,
  language,
}: FlatMapProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ width: 1000, height: 560 });
  const [probe, setProbe] = useState<GlobeProbePoint | null>(null);
  const [zoomTransform, setZoomTransform] = useState(d3.zoomIdentity);

  useEffect(() => {
    if (!wrapRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    });
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, []);

  const projection = useMemo(
    () =>
      d3
        .geoNaturalEarth1()
        .fitExtent(
          [
            [24, 24],
            [size.width - 24, size.height - 24],
          ],
          world
        ),
    [size]
  );

  useEffect(() => {
    if (!svgRef.current) return;
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .translateExtent([
        [-size.width * 2, -size.height * 2],
        [size.width * 3, size.height * 3],
      ])
      .on('zoom', (event) => setZoomTransform(event.transform));
    d3.select(svgRef.current).call(zoom as any);
  }, [size.height, size.width]);

  const path = useMemo(() => d3.geoPath(projection), [projection]);
  const graticule = useMemo(() => d3.geoGraticule10(), []);
  const probeCircle = useMemo(() => {
    if (!probe) return null;
    return d3.geoCircle().center([probe.lon, probe.lat]).radius((radiusKm / KM_PER_RADIAN) * (180 / Math.PI))();
  }, [probe, radiusKm]);

  const points = useMemo(
    () =>
      quakes
        .map((quake) => {
          const projected = projection([quake.lon, quake.lat]);
          if (!projected) return null;
          return {
            quake,
            x: projected[0],
            y: projected[1],
            r: 3 + Math.max(0, quake.mag - 4.5) * 1.25,
          };
        })
        .filter(Boolean) as Array<{ quake: Quake; x: number; y: number; r: number }>,
    [projection, quakes]
  );

  const updateProbeFromEvent = (event: MouseEvent<SVGSVGElement>) => {
    const [screenX, screenY] = d3.pointer(event);
    const [x, y] = zoomTransform.invert([screenX, screenY]);
    const coords = projection.invert?.([x, y]);
    if (!coords) return null;
    const [lon, lat] = coords;
    const nextProbe = pointToProbe(latLonToVector3(lat, lon));
    setProbe(nextProbe);
    onProbe(nextProbe, buildProbeDistances(quakes, nextProbe));
    return nextProbe;
  };

  return (
    <div ref={wrapRef} className="map-wrap flatmap-wrap">
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        onClick={(event) => {
          if (selectedId) {
            onSelect(null);
            return;
          }
          const nextProbe = probe ?? updateProbeFromEvent(event);
          if (!nextProbe) return;
          const nextLocked = !probeLocked;
          onProbeLockChange(nextLocked);
          onProbe(nextLocked ? nextProbe : null, nextLocked ? buildProbeDistances(quakes, nextProbe) : new Map());
          if (!nextLocked) setProbe(null);
        }}
        onMouseMove={(event) => {
          if (probeLocked) return;
          updateProbeFromEvent(event);
        }}
        onMouseLeave={() => {
          if (probeLocked) return;
          setProbe(null);
          onHover(null);
          onProbe(null, new Map());
        }}
      >
        <g transform={zoomTransform.toString()}>
          <path d={path({ type: 'Sphere' } as any) || ''} className="flat-sphere" />
          <path d={path(graticule as any) || ''} className="flat-graticule" />
          <path d={path(world) || ''} className="flat-land" />
          {probeCircle && <path d={path(probeCircle as any) || ''} className={`flat-probe-radius ${probeLocked ? 'locked' : ''}`} />}

          {points.map(({ quake, x, y, r }) => {
            const active = quake.id === selectedId || (!selectedId && quake.id === hoverId);
            return (
              <g key={quake.id}>
                {active && (
                  <>
                    <circle className="flat-hover-ring outer" cx={x} cy={y} r={r + 14} />
                    <circle className="flat-hover-ring inner" cx={x} cy={y} r={r + 6} />
                  </>
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={active ? r + 1.8 : r}
                  fill={quakeMarkerColor(quake.mag, active)}
                  stroke={active ? '#d5fff1' : 'rgba(8,17,16,0.5)'}
                  strokeWidth={active ? 1.6 : 0.8}
                  onMouseEnter={() => {
                    if (!selectedId) onHover(quake);
                  }}
                  onMouseLeave={() => {
                    if (!selectedId) onHover(null);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(quake);
                  }}
                />
              </g>
            );
          })}
        </g>
      </svg>
      <div className="globe-hud">
        <div className="mono-caps">{tr(language, '2D map mode · wheel to zoom · click to lock probe', '2D 地图 · 滚轮缩放 · 点击锁定探针')}</div>
      </div>
    </div>
  );
}
