'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

interface AlarmZone {
  id: string;
  lat: number;
  lon: number;
  radiusKm: number;
  minMag: number;
  label: string;
}

interface AlarmHit {
  quake: Quake;
  zone: AlarmZone;
  distanceKm: number;
  isNew: boolean;
}

interface AlarmTone {
  osc: OscillatorNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

const world = feature((countries as any), (countries as any).objects.countries) as any;
const LIVE_FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';

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
  const alarmAudioRef = useRef<AudioContext | null>(null);
  const alarmTonesRef = useRef<Map<string, AlarmTone>>(new Map());
  const knownLiveIdsRef = useRef<Set<string>>(new Set());
  const alarmZonesRef = useRef<AlarmZone[]>([]);
  const liveMinMagRef = useRef(2.5);

  const [size, setSize] = useState({ width: 1000, height: 560 });
  const [probe, setProbe] = useState<GlobeProbePoint | null>(null);
  const [zoomTransform, setZoomTransform] = useState(d3.zoomIdentity);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [liveMinMag, setLiveMinMag] = useState(2.5);
  const [liveQuakes, setLiveQuakes] = useState<Quake[]>([]);
  const [liveStatus, setLiveStatus] = useState<'idle' | 'fetching' | 'ok' | 'error'>('idle');
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<number | null>(null);
  const [alarmZones, setAlarmZones] = useState<AlarmZone[]>([]);
  const [alarmHits, setAlarmHits] = useState<AlarmHit[]>([]);
  const [dismissedAlarmIds, setDismissedAlarmIds] = useState<Set<string>>(new Set());
  const [monitorOpen, setMonitorOpen] = useState(false);

  useEffect(() => {
    alarmZonesRef.current = alarmZones;
  }, [alarmZones]);

  useEffect(() => {
    liveMinMagRef.current = liveMinMag;
  }, [liveMinMag]);

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

  const ensureAlarmAudio = useCallback(async () => {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!alarmAudioRef.current) alarmAudioRef.current = new AC();
    if (alarmAudioRef.current.state === 'suspended') await alarmAudioRef.current.resume();
    return alarmAudioRef.current;
  }, []);

  const playAlarm = useCallback(async () => {
    try {
      const ctx = await ensureAlarmAudio();
      const now = ctx.currentTime;
      [0, 0.22].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now + offset);
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.22, now + offset + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.18);
      });
    } catch {}
  }, [ensureAlarmAudio]);

  const activeAlarmHits = useMemo(
    () => alarmHits.filter((hit) => !dismissedAlarmIds.has(hit.quake.id) && alarmZones.some((zone) => zone.id === hit.zone.id)),
    [alarmHits, alarmZones, dismissedAlarmIds]
  );

  const alarmSoundHits = useMemo(() => {
    const byQuake = new Map<string, AlarmHit>();
    for (const hit of activeAlarmHits) {
      const current = byQuake.get(hit.quake.id);
      if (!current || hit.quake.mag > current.quake.mag || hit.distanceKm < current.distanceKm) {
        byQuake.set(hit.quake.id, hit);
      }
    }
    return [...byQuake.values()].sort((a, b) => b.quake.mag - a.quake.mag || b.quake.time - a.quake.time);
  }, [activeAlarmHits]);

  const alarmedLiveIds = useMemo(() => new Set(alarmSoundHits.map((hit) => hit.quake.id)), [alarmSoundHits]);

  const dismissAlarmQuake = useCallback(
    (quake: Quake) => {
      setDismissedAlarmIds((ids) => {
        const next = new Set(ids);
        next.add(quake.id);
        return next;
      });
      onSelect(quake);
    },
    [onSelect]
  );

  useEffect(() => {
    const primary = alarmSoundHits[0]?.quake;
    if (!primary) return;
    onHover(primary);
    if (selectedId !== primary.id) onSelect(primary);
    if (!probeLocked) {
      setProbe(null);
      onProbe(null, new Map());
    } else if (probe) {
      onProbe(probe, new Map());
    }
  }, [alarmSoundHits, onHover, onProbe, onSelect, probe, probeLocked, selectedId]);

  useEffect(() => {
    let cancelled = false;

    const syncAlarmTones = async () => {
      const tones = alarmTonesRef.current;
      const active = liveEnabled ? new Map(alarmSoundHits.slice(0, 4).map((hit) => [hit.quake.id, hit])) : new Map<string, AlarmHit>();

      for (const [id, tone] of tones) {
        if (!active.has(id)) {
          stopAlarmTone(tone);
          tones.delete(id);
        }
      }

      if (active.size === 0) return;

      try {
        const ctx = await ensureAlarmAudio();
        if (cancelled) return;
        let index = 0;
        for (const [id, hit] of active) {
          const freq = magToAlarmFreq(hit.quake.mag) * (1 + index * 0.018);
          const gain = magToAlarmGain(hit.quake.mag);
          const wobble = 1.2 + Math.min(6, Math.max(0, hit.quake.mag));
          const cutoff = 680 + Math.max(0, hit.quake.mag) * 760;
          const existing = tones.get(id);
          if (existing) {
            existing.osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.08);
            existing.gain.gain.setTargetAtTime(gain, ctx.currentTime, 0.08);
            existing.lfo.frequency.setTargetAtTime(wobble, ctx.currentTime, 0.08);
            existing.lfoGain.gain.setTargetAtTime(gain * 0.35, ctx.currentTime, 0.08);
            existing.filter.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.08);
          } else {
            tones.set(id, createAlarmTone(ctx, freq, gain, wobble, cutoff));
          }
          index += 1;
        }
      } catch {}
    };

    syncAlarmTones();
    return () => {
      cancelled = true;
    };
  }, [alarmSoundHits, ensureAlarmAudio, liveEnabled]);

  useEffect(() => {
    return () => {
      for (const tone of alarmTonesRef.current.values()) stopAlarmTone(tone);
      alarmTonesRef.current.clear();
    };
  }, []);

  const fetchLiveQuakes = useCallback(async () => {
    setLiveStatus('fetching');
    try {
      const res = await fetch(LIVE_FEED_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`USGS ${res.status}`);
      const raw = await res.json();
      const nextQuakes = ((raw.features || []) as any[])
        .map((featureItem) => ({
          id: String(featureItem.id),
          mag: Number(featureItem.properties?.mag),
          place: String(featureItem.properties?.place ?? 'Unknown'),
          time: Number(featureItem.properties?.time),
          lon: Number(featureItem.geometry?.coordinates?.[0]),
          lat: Number(featureItem.geometry?.coordinates?.[1]),
          depth: Number(featureItem.geometry?.coordinates?.[2] ?? 0),
        }))
        .filter((quake) => Number.isFinite(quake.mag) && Number.isFinite(quake.lat) && Number.isFinite(quake.lon) && quake.mag >= liveMinMagRef.current)
        .sort((a, b) => a.time - b.time) as Quake[];

      const known = knownLiveIdsRef.current;
      const hits = findAlarmHits(nextQuakes, alarmZonesRef.current, liveMinMagRef.current, known);

      nextQuakes.forEach((quake) => known.add(quake.id));
      setLiveQuakes(nextQuakes);
      setAlarmHits(hits.slice(0, 8));
      setLiveUpdatedAt(Date.now());
      setLiveStatus('ok');

      if (hits.length > 0) setMonitorOpen(true);
      if (hits.some((hit) => hit.isNew)) {
        await playAlarm();
      }
    } catch {
      setLiveStatus('error');
    }
  }, [playAlarm]);

  useEffect(() => {
    if (!liveEnabled) return;
    fetchLiveQuakes();
    const id = window.setInterval(fetchLiveQuakes, 60_000);
    return () => window.clearInterval(id);
  }, [fetchLiveQuakes, liveEnabled]);

  const path = useMemo(() => d3.geoPath(projection), [projection]);
  const graticule = useMemo(() => d3.geoGraticule10(), []);
  const probeCircle = useMemo(() => {
    if (!probe) return null;
    return d3.geoCircle().center([probe.lon, probe.lat]).radius((radiusKm / KM_PER_RADIAN) * (180 / Math.PI))();
  }, [probe, radiusKm]);

  const alarmCircles = useMemo(
    () =>
      alarmZones.map((zone) => ({
        zone,
        circle: d3.geoCircle().center([zone.lon, zone.lat]).radius((zone.radiusKm / KM_PER_RADIAN) * (180 / Math.PI))(),
      })),
    [alarmZones]
  );

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

  const livePoints = useMemo(
    () =>
      liveQuakes
        .map((quake) => {
          const projected = projection([quake.lon, quake.lat]);
          if (!projected) return null;
          return {
            quake,
            x: projected[0],
            y: projected[1],
            r: 4 + Math.max(0, quake.mag) * 1.15,
            alarmed: alarmedLiveIds.has(quake.id),
          };
        })
        .filter(Boolean) as Array<{ quake: Quake; x: number; y: number; r: number; alarmed: boolean }>,
    [alarmedLiveIds, liveQuakes, projection]
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

  const addAlarmZone = async () => {
    if (!probe) return;
    await ensureAlarmAudio();
    setAlarmZones((zones) => [
      ...zones,
      {
        id: `${Date.now()}-${zones.length}`,
        lat: probe.lat,
        lon: probe.lon,
        radiusKm,
        minMag: liveMinMag,
        label: `Alarm ${zones.length + 1}`,
      },
    ]);
    if (!liveEnabled) setLiveEnabled(true);
    window.setTimeout(fetchLiveQuakes, 50);
  };

  return (
    <div ref={wrapRef} className="map-wrap flatmap-wrap">
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        onClick={(event) => {
          if (alarmSoundHits.length > 0) {
            onHover(alarmSoundHits[0].quake);
            return;
          }
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
          if (alarmSoundHits.length > 0) return;
          if (probeLocked) return;
          updateProbeFromEvent(event);
        }}
        onMouseLeave={() => {
          if (alarmSoundHits.length > 0) return;
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
          {alarmCircles.map(({ zone, circle }) => (
            <path key={zone.id} d={path(circle as any) || ''} className="live-alarm-zone" />
          ))}
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
                    if (!selectedId && alarmSoundHits.length === 0) onHover(quake);
                  }}
                  onMouseLeave={() => {
                    if (!selectedId && alarmSoundHits.length === 0) onHover(null);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (alarmSoundHits.length > 0) {
                      onHover(alarmSoundHits[0].quake);
                      return;
                    }
                    onSelect(quake);
                  }}
                />
              </g>
            );
          })}

          {livePoints.map(({ quake, x, y, r, alarmed }) => (
            <g
              key={`live-${quake.id}`}
              className="live-quake-hit"
              onMouseEnter={() => {
                if (!selectedId && (alarmed || alarmSoundHits.length === 0)) onHover(quake);
              }}
              onMouseLeave={() => {
                if (!selectedId && !alarmed && alarmSoundHits.length === 0) onHover(null);
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (alarmed) dismissAlarmQuake(quake);
                else onSelect(quake);
              }}
            >
              {alarmed && (
                <>
                  <circle className="flat-hover-ring outer" cx={x} cy={y} r={r + 14} />
                  <circle className="flat-hover-ring inner" cx={x} cy={y} r={r + 6} />
                  <circle className="live-quake-pulse" cx={x} cy={y} r={r + 8} />
                </>
              )}
              <circle className={`live-quake ${alarmed ? 'alarmed' : ''}`} cx={x} cy={y} r={r} />
            </g>
          ))}
        </g>
      </svg>

      {!monitorOpen && (
        <button type="button" className={`live-monitor-fab ${activeAlarmHits.length > 0 ? 'alerting' : ''}`} onClick={() => setMonitorOpen(true)}>
          <span>{activeAlarmHits.length > 0 ? activeAlarmHits.length : liveQuakes.length}</span>
          {tr(language, 'Live', '监控')}
        </button>
      )}

      {monitorOpen && <div className="live-monitor">
        <div className="live-monitor-head">
          <div>
            <strong>{tr(language, 'Live Monitor', '实时监控')}</strong>
            <span>
              {liveStatus === 'fetching'
                ? tr(language, 'Updating...', '更新中...')
                : liveUpdatedAt
                  ? tr(language, `Updated ${new Date(liveUpdatedAt).toLocaleTimeString()}`, `更新于 ${new Date(liveUpdatedAt).toLocaleTimeString()}`)
                  : tr(language, 'USGS past-hour feed', 'USGS 过去 1 小时')}
            </span>
          </div>
          <button type="button" className="live-collapse" onClick={() => setMonitorOpen(false)} aria-label={tr(language, 'Hide monitor', '隐藏监控')}>
            -
          </button>
          <button type="button" className={`live-toggle ${liveEnabled ? 'on' : ''}`} onClick={() => setLiveEnabled((value) => !value)}>
            {liveEnabled ? tr(language, 'On', '开') : tr(language, 'Off', '关')}
          </button>
        </div>

        <div className="live-filter">
          <label>
            {tr(language, 'Set Filter', '设置筛选')}
            <span>M{liveMinMag.toFixed(1)}+</span>
          </label>
          <input type="range" min={0} max={7} step={0.1} value={liveMinMag} onChange={(event) => setLiveMinMag(+event.target.value)} />
        </div>

        <div className="live-actions">
          <button type="button" className="btn" onClick={addAlarmZone} disabled={!probe}>
            {tr(language, 'Set Alarm', '设置警报')}
          </button>
          <button type="button" className="btn" onClick={fetchLiveQuakes}>
            {tr(language, 'Refresh', '刷新')}
          </button>
        </div>

        <div className="live-summary">
          <span>{tr(language, 'Live events', '实时事件')}: {liveQuakes.length}</span>
          <span>{tr(language, 'Alarm areas', '警报区域')}: {alarmZones.length}</span>
        </div>

        {activeAlarmHits.length > 0 && (
          <div className="live-alert-list">
            {activeAlarmHits.map((hit) => (
              <button key={`${hit.zone.id}-${hit.quake.id}`} type="button" className="live-alert" onClick={() => dismissAlarmQuake(hit.quake)}>
                <strong>{hit.zone.label}</strong>
                <span>M{hit.quake.mag.toFixed(1)} · {hit.quake.place}</span>
                <em>{Math.round(hit.distanceKm)} km · {new Date(hit.quake.time).toLocaleTimeString()}</em>
              </button>
            ))}
          </div>
        )}

        {alarmZones.length > 0 && (
          <div className="alarm-list">
            {alarmZones.map((zone, index) => (
              <button key={zone.id} type="button" onClick={() => setAlarmZones((zones) => zones.filter((item) => item.id !== zone.id))}>
                {index + 1}. M{zone.minMag.toFixed(1)}+ · {Math.round(zone.radiusKm)} km
              </button>
            ))}
          </div>
        )}

        {liveStatus === 'error' && <div className="live-error">{tr(language, 'Live feed unavailable. Try refresh.', '实时数据不可用，请刷新。')}</div>}
      </div>}

      <div className="globe-hud">
        <div className="mono-caps">{tr(language, '2D map mode · wheel to zoom · click to lock probe', '2D 地图 · 滚轮缩放 · 点击锁定探针')}</div>
      </div>
    </div>
  );
}

function magToAlarmFreq(mag: number) {
  const clamped = Math.max(0, Math.min(7.5, mag));
  const t = clamped / 7.5;
  return 105 + Math.pow(t, 1.35) * 980;
}

function magToAlarmGain(mag: number) {
  const clamped = Math.max(0, Math.min(7.5, mag));
  const t = clamped / 7.5;
  return 0.012 + Math.pow(t, 2.45) * 0.24;
}

function createAlarmTone(ctx: AudioContext, freq: number, gainValue: number, wobble: number, cutoff: number): AlarmTone {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = wobble;

  const lfoGain = ctx.createGain();
  lfoGain.gain.value = gainValue * 0.35;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  filter.Q.value = 1.1;

  const gain = ctx.createGain();
  gain.gain.value = 0.0001;

  osc.connect(filter).connect(gain).connect(ctx.destination);
  lfo.connect(lfoGain).connect(gain.gain);
  osc.start();
  lfo.start();
  gain.gain.setTargetAtTime(gainValue, ctx.currentTime, 0.08);

  return { osc, lfo, lfoGain, filter, gain };
}

function stopAlarmTone(tone: AlarmTone) {
  const now = tone.gain.context.currentTime;
  tone.gain.gain.setTargetAtTime(0.0001, now, 0.04);
  try {
    tone.osc.stop(now + 0.16);
    tone.lfo.stop(now + 0.16);
  } catch {}
}

function haversineKm(latA: number, lonA: number, latB: number, lonB: number) {
  const toRad = Math.PI / 180;
  const phiA = latA * toRad;
  const phiB = latB * toRad;
  const dPhi = (latB - latA) * toRad;
  const dLambda = (lonB - lonA) * toRad;
  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phiA) * Math.cos(phiB) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * KM_PER_RADIAN;
}

function findAlarmHits(quakes: Quake[], zones: AlarmZone[], globalMinMag: number, known: Set<string>): AlarmHit[] {
  const hits: AlarmHit[] = [];
  for (const quake of quakes) {
    for (const zone of zones) {
      if (quake.mag < Math.max(zone.minMag, globalMinMag)) continue;
      const distanceKm = haversineKm(zone.lat, zone.lon, quake.lat, quake.lon);
      if (distanceKm <= zone.radiusKm) {
        hits.push({ quake, zone, distanceKm, isNew: !known.has(quake.id) });
      }
    }
  }
  return hits.sort((a, b) => b.quake.time - a.quake.time);
}
