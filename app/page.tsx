'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GeoMap from '@/components/GeoMap';
import Timeline from '@/components/Timeline';
import SidePanel from '@/components/SidePanel';
import Intro from '@/components/Intro';
import InstructionOverlay from '@/components/InstructionOverlay';
import { loadQuakes } from '@/lib/data';
import type { DataWindowDays, Quake } from '@/lib/data';
import type { GlobeFocusTarget, GlobeProbePoint } from '@/lib/globe';
import { SonarEngine } from '@/lib/audio';
import { buildLocalForecast } from '@/lib/forecast';
import type { Language, ResolvedTheme, ThemeMode } from '@/lib/ui';
import { resolveTheme, tr } from '@/lib/ui';

export default function Page() {
  const [quakes, setQuakes] = useState<Quake[]>([]);
  const [forecastQuakes, setForecastQuakes] = useState<Quake[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [introOpen, setIntroOpen] = useState(true);
  const [hover, setHover] = useState<Quake | null>(null);
  const [selected, setSelected] = useState<Quake | null>(null);
  const [probe, setProbe] = useState<GlobeProbePoint | null>(null);
  const [probeLocked, setProbeLocked] = useState(false);
  const [probeDistances, setProbeDistances] = useState<Map<string, number>>(new Map());

  const [filterMagnitude, setFilterMagnitude] = useState<[number, number]>([4.5, 7.8]);
  const [brushRange, setBrushRange] = useState<[number, number] | null>(null);
  const [dataWindowDays, setDataWindowDays] = useState<DataWindowDays>(30);
  const [mapMode, setMapMode] = useState<'3d' | '2d'>('3d');
  const [history, setHistory] = useState<Quake[]>([]);
  const [alignSignal, setAlignSignal] = useState(0);
  const [playbackRunning, setPlaybackRunning] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme('auto'));
  const [language, setLanguage] = useState<Language>('en');
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [instructionStep, setInstructionStep] = useState(0);

  const engineRef = useRef<SonarEngine | null>(null);
  const playbackTimeoutRef = useRef<number | null>(null);
  if (!engineRef.current) engineRef.current = new SonarEngine();
  const [audioRunning, setAudioRunning] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [radius, setRadius] = useState(1800);

  useEffect(() => {
    const updateTheme = () => setResolvedTheme(resolveTheme(themeMode));
    updateTheme();
    if (themeMode !== 'auto') return;
    const id = window.setInterval(updateTheme, 60_000);
    return () => window.clearInterval(id);
  }, [themeMode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDataError(null);
    setBrushRange(null);
    setProbe(null);
    setProbeLocked(false);
    setProbeDistances(new Map());

    loadQuakes(dataWindowDays)
      .then((qs) => {
        if (!cancelled) setQuakes(qs);
      })
      .catch((error) => {
        if (!cancelled) setDataError(String(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dataWindowDays]);

  useEffect(() => {
    let cancelled = false;
    loadQuakes(360)
      .then((qs) => {
        if (!cancelled) setForecastQuakes(qs);
      })
      .catch(() => {
        if (!cancelled) setForecastQuakes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const magnitudeFilteredQuakes = useMemo(
    () =>
      quakes.filter((quake) => {
        if (quake.mag < filterMagnitude[0] || quake.mag > filterMagnitude[1]) return false;
        return true;
      }),
    [quakes, filterMagnitude]
  );

  const visibleQuakes = useMemo(
    () =>
      magnitudeFilteredQuakes.filter((quake) => {
        if (brushRange && (quake.time < brushRange[0] || quake.time > brushRange[1])) return false;
        return true;
      }),
    [magnitudeFilteredQuakes, brushRange]
  );

  const visibleIds = useMemo(() => new Set(visibleQuakes.map((quake) => quake.id)), [visibleQuakes]);

  const mapQuakes = useMemo(() => {
    const merged = new Map(visibleQuakes.map((quake) => [quake.id, quake]));
    if (selected) merged.set(selected.id, selected);
    if (hover) merged.set(hover.id, hover);
    return [...merged.values()];
  }, [hover, selected, visibleQuakes]);

  const focusTarget = useMemo<GlobeFocusTarget | null>(() => {
    if (selected && mapMode === '3d') {
      return {
        id: `quake-${selected.id}`,
        latitude: selected.lat,
        longitude: selected.lon,
        distance: 6.35,
      };
    }
    return null;
  }, [selected, mapMode]);

  const forecastCenter = probe ?? selected ?? hover;
  const forecastSource = forecastQuakes.length > 0 ? forecastQuakes : quakes;
  const localForecast = useMemo(() => {
    if (!forecastCenter || forecastSource.length === 0) return null;
    return buildLocalForecast(
      forecastSource,
      { lat: forecastCenter.lat, lon: forecastCenter.lon },
      radius,
      filterMagnitude[0]
    );
  }, [filterMagnitude, forecastCenter, forecastSource, radius]);

  const handleProbe = useCallback(
    (nextProbe: GlobeProbePoint | null, distances: Map<string, number>) => {
      setProbe(nextProbe);
      const filtered = new Map<string, number>();
      for (const [id, distance] of distances) {
        if (visibleIds.has(id)) filtered.set(id, distance);
      }
      setProbeDistances(filtered);
      engineRef.current?.updateProbe(filtered);
    },
    [visibleIds]
  );

  useEffect(() => {
    engineRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    engineRef.current?.setRadius(radius);
  }, [radius]);

  useEffect(() => {
    engineRef.current?.syncQuakes(quakes);
  }, [quakes]);

  const startAudio = useCallback(async () => {
    if (!engineRef.current || engineRef.current.isRunning) return;
    await engineRef.current.start(quakes);
    engineRef.current.setVolume(volume);
    engineRef.current.setRadius(radius);
    if (probeDistances.size > 0) engineRef.current.updateProbe(probeDistances);
    setAudioRunning(true);
  }, [probeDistances, quakes, radius, volume]);

  const stopAudio = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = new SonarEngine();
    setAudioRunning(false);
  }, []);

  const handleEnterFromIntro = useCallback(async () => {
    setIntroOpen(false);
    try {
      await startAudio();
    } catch {}
  }, [startAudio]);

  const handleSelectQuake = useCallback(
    (quake: Quake | null) => {
      if (quake && selected?.id === quake.id) {
        setSelected(null);
        setHover(null);
        return;
      }
      if (quake) {
        setHistory((items) => [quake, ...items.filter((item) => item.id !== quake.id)].slice(0, 10));
      }
      setSelected(quake);
    },
    [selected]
  );

  const stopPlayback = useCallback(() => {
    if (playbackTimeoutRef.current !== null) {
      window.clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    setPlaybackRunning(false);
  }, []);

  const startPlayback = useCallback(() => {
    const range = brushRange;
    const playlist = visibleQuakes
      .filter((quake) => !range || (quake.time >= range[0] && quake.time <= range[1]))
      .sort((a, b) => a.time - b.time);
    if (playlist.length === 0) return;

    stopPlayback();
    setMapMode('3d');
    setPlaybackRunning(true);

    let index = 0;
    const tick = () => {
      const quake = playlist[index];
      setSelected(quake);
      setHover(quake);
      setHistory((items) => [quake, ...items.filter((item) => item.id !== quake.id)].slice(0, 10));
      index += 1;
      if (index >= playlist.length) {
        playbackTimeoutRef.current = window.setTimeout(() => {
          setPlaybackRunning(false);
          playbackTimeoutRef.current = null;
        }, 900);
        return;
      }
      playbackTimeoutRef.current = window.setTimeout(tick, 900);
    };

    tick();
  }, [brushRange, stopPlayback, visibleQuakes]);

  const togglePlayback = useCallback(() => {
    if (playbackRunning) stopPlayback();
    else startPlayback();
  }, [playbackRunning, startPlayback, stopPlayback]);

  useEffect(() => {
    return () => {
      stopPlayback();
      engineRef.current?.stop();
    };
  }, [stopPlayback]);

  const hoverId = hover?.id ?? null;
  const selectedId = selected?.id ?? null;

  return (
    <div className="app-shell" data-theme={resolvedTheme}>
      {introOpen && <Intro onEnter={handleEnterFromIntro} loading={loading} language={language} />}
      {instructionOpen && (
        <InstructionOverlay
          language={language}
          step={instructionStep}
          onNext={() => setInstructionStep((step) => step + 1)}
          onClose={() => {
            setInstructionOpen(false);
            setInstructionStep(0);
          }}
        />
      )}

      <div className="station">
        <header className="bar">
          <div>
            <div className="title">
              Seismic <em>Sonar</em>
            </div>
            <div className="sub">
              {mapMode === '3d' ? tr(language, '3D seismic globe', '3D 地震地球') : tr(language, '2D seismic map', '2D 地震地图')} · USGS M4.5+ · {tr(language, 'local forecast probe', '局部概率探针')} · 360d
            </div>
          </div>
          <div className="segmented header-segmented">
            <button type="button" className={`segmented-btn ${mapMode === '3d' ? 'active' : ''}`} onClick={() => setMapMode('3d')}>
              3D
            </button>
            <button type="button" className={`segmented-btn ${mapMode === '2d' ? 'active' : ''}`} onClick={() => setMapMode('2d')}>
              2D
            </button>
          </div>
          {mapMode === '3d' && (
            <button type="button" className="btn header-btn" onClick={() => setAlignSignal((value) => value + 1)}>
              {tr(language, 'Align', '对齐')}
            </button>
          )}
          <div className="header-tools">
            <button
              type="button"
              className={`theme-switch ${resolvedTheme === 'night' ? 'night' : 'day'}`}
              onClick={() => setThemeMode(resolvedTheme === 'night' ? 'day' : 'night')}
              aria-label={tr(language, 'Toggle day/night theme', '切换白天/夜晚主题')}
            >
              <span>{tr(language, 'Day', '白天')}</span>
              <span>{tr(language, 'Night', '夜晚')}</span>
              <i />
            </button>
            <div className="lang-toggle">
              <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>
                EN
              </button>
              <button type="button" className={language === 'cn' ? 'active' : ''} onClick={() => setLanguage('cn')}>
                CN
              </button>
            </div>
            <button
              type="button"
              className="info-btn"
              onClick={() => {
                setInstructionStep(0);
                setInstructionOpen(true);
              }}
              aria-label={tr(language, 'Open instructions', '打开教学')}
            >
              i
            </button>
          </div>
          <div className="right">
            <span className="blink-dot" />
            <span className="mono-caps">{dataError ? tr(language, 'Feed fallback active', '数据回退中') : audioRunning ? tr(language, 'Audio engaged', '声音已开启') : tr(language, 'Audio standby', '声音待机')}</span>
          </div>
        </header>

        <div className="map-area tour-target-map">
          <GeoMap
            quakes={mapQuakes}
            onHover={setHover}
            onSelect={handleSelectQuake}
            onProbe={handleProbe}
            onProbeLockChange={setProbeLocked}
            onManualOrbitStart={() => {}}
            selectedId={selectedId}
            hoverId={hoverId}
            radius={radius}
            probeLocked={probeLocked}
            focusTarget={focusTarget}
            alignSignal={alignSignal}
            mapMode={mapMode}
            theme={resolvedTheme}
            language={language}
          />
        </div>

        <SidePanel
          quakes={visibleQuakes}
          totalCount={quakes.length}
          hover={hover}
          selected={selected}
          engine={engineRef.current}
          audioRunning={audioRunning}
          onStart={startAudio}
          onStop={stopAudio}
          filterMagnitude={filterMagnitude}
          onFilterMagnitude={setFilterMagnitude}
          radius={radius}
          onRadius={setRadius}
          volume={volume}
          onVolume={setVolume}
          probeDistances={probeDistances}
          probeLocked={probeLocked}
          probe={probe}
          dataWindowDays={dataWindowDays}
          onDataWindowDays={setDataWindowDays}
          onSelectQuake={handleSelectQuake}
          history={history}
          forecast={localForecast}
          language={language}
        />

        <Timeline
          quakes={visibleQuakes}
          allQuakes={magnitudeFilteredQuakes}
          onBrush={setBrushRange}
          onHover={setHover}
          onSelect={handleSelectQuake}
          hoverId={hoverId}
          selectedId={selectedId}
          brushRange={brushRange}
          onTogglePlayback={togglePlayback}
          playbackRunning={playbackRunning}
          language={language}
        />
      </div>
    </div>
  );
}
