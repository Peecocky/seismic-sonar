'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GeoMap from '@/components/GeoMap';
import Timeline from '@/components/Timeline';
import SidePanel from '@/components/SidePanel';
import Intro from '@/components/Intro';
import InstructionOverlay from '@/components/InstructionOverlay';
import DataDownloadDialog from '@/components/DataDownloadDialog';
import TyphoonPanel from '@/components/TyphoonPanel';
import TyphoonTimeline from '@/components/TyphoonTimeline';
import { loadQuakes } from '@/lib/data';
import type { DataWindowDays, Quake } from '@/lib/data';
import { buildProbeDistances } from '@/lib/globe';
import type { GlobeFocusTarget, GlobeProbePoint } from '@/lib/globe';
import { SonarEngine } from '@/lib/audio';
import { buildLocalForecast } from '@/lib/forecast';
import type { Language, ResolvedTheme, ThemeMode } from '@/lib/ui';
import { resolveTheme, tr } from '@/lib/ui';
import { loadTyphoons, typhoonTrackAtTime } from '@/lib/typhoon';
import type { Typhoon } from '@/lib/typhoon';

export default function SeismicSonarApp() {
  const [dataMode, setDataMode] = useState<'seismic' | 'typhoon'>('seismic');
  const [quakes, setQuakes] = useState<Quake[]>([]);
  const [forecastQuakes, setForecastQuakes] = useState<Quake[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [typhoons, setTyphoons] = useState<Typhoon[]>([]);
  const [typhoonLoading, setTyphoonLoading] = useState(true);
  const [typhoonError, setTyphoonError] = useState<string | null>(null);
  const [selectedTyphoon, setSelectedTyphoon] = useState<Typhoon | null>(null);
  const [typhoonPlaybackTime, setTyphoonPlaybackTime] = useState<number | null>(null);

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
  const [playbackSpeed, setPlaybackSpeed] = useState(0.75);
  const [themeMode, setThemeMode] = useState<ThemeMode>('day');
  const resolvedTheme: ResolvedTheme = resolveTheme(themeMode);
  const [language, setLanguage] = useState<Language>('en');
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [instructionStep, setInstructionStep] = useState(0);
  const [downloadOpen, setDownloadOpen] = useState(false);

  const engineRef = useRef<SonarEngine | null>(null);
  const playbackTimeoutRef = useRef<number | null>(null);
  if (!engineRef.current) engineRef.current = new SonarEngine();
  const [audioRunning, setAudioRunning] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [radius, setRadius] = useState(1800);

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

  useEffect(() => {
    let cancelled = false;

    const refreshTyphoons = async () => {
      try {
        const result = await loadTyphoons();
        if (cancelled) return;
        setTyphoons(result);
        setTyphoonError(null);
        setSelectedTyphoon((current) =>
          current
            ? result.find((item) => item.id === current.id) ?? null
            : result.find((item) => item.isActive) ?? result[0] ?? null
        );
      } catch (error) {
        if (!cancelled) setTyphoonError(String(error));
      } finally {
        if (!cancelled) setTyphoonLoading(false);
      }
    };

    refreshTyphoons();
    const refreshId = window.setInterval(refreshTyphoons, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshId);
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
  const temporalQuakes = useMemo(() => [...visibleQuakes].sort((a, b) => a.time - b.time), [visibleQuakes]);

  const mapQuakes = useMemo(() => {
    const merged = new Map(visibleQuakes.map((quake) => [quake.id, quake]));
    if (selected) merged.set(selected.id, selected);
    if (hover) merged.set(hover.id, hover);
    return [...merged.values()];
  }, [hover, selected, visibleQuakes]);

  const focusTarget = useMemo<GlobeFocusTarget | null>(() => {
    if (dataMode === 'typhoon' && selectedTyphoon && mapMode === '3d') {
      const center = typhoonTrackAtTime(selectedTyphoon, typhoonPlaybackTime).center;
      if (center) {
        return {
          id: `typhoon-${selectedTyphoon.id}`,
          latitude: center.lat,
          longitude: center.lon,
          distance: 7.8,
        };
      }
    }
    if (dataMode === 'seismic' && selected && mapMode === '3d') {
      return {
        id: `quake-${selected.id}`,
        latitude: selected.lat,
        longitude: selected.lon,
        distance: 6.35,
      };
    }
    return null;
  }, [dataMode, selected, selectedTyphoon, mapMode, typhoonPlaybackTime]);

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
    engineRef.current?.updateProbe(probeDistances);
  }, [probeDistances, radius]);

  useEffect(() => {
    engineRef.current?.syncQuakes(visibleQuakes);
  }, [visibleQuakes]);

  useEffect(() => {
    const nextDistances = probe ? buildProbeDistances(visibleQuakes, probe) : new Map<string, number>();
    setProbeDistances(nextDistances);
    engineRef.current?.updateProbe(nextDistances);
  }, [probe, visibleQuakes]);

  const startAudio = useCallback(async () => {
    if (!engineRef.current || engineRef.current.isRunning) return;
    await engineRef.current.start(visibleQuakes);
    engineRef.current.setVolume(volume);
    engineRef.current.setRadius(radius);
    if (probeDistances.size > 0) engineRef.current.updateProbe(probeDistances);
    setAudioRunning(true);
  }, [probeDistances, radius, visibleQuakes, volume]);

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
        setSelectedTyphoon(null);
        setHistory((items) => [quake, ...items.filter((item) => item.id !== quake.id)].slice(0, 10));
      }
      setSelected(quake);
    },
    [selected]
  );

  const selectTimelineQuake = useCallback((quake: Quake) => {
    setSelectedTyphoon(null);
    setMapMode('3d');
    setSelected(quake);
    setHover(quake);
    setHistory((items) => [quake, ...items.filter((item) => item.id !== quake.id)].slice(0, 10));
  }, []);

  const handleSelectTyphoon = useCallback((typhoon: Typhoon) => {
    setSelectedTyphoon((current) => (current?.id === typhoon.id ? null : typhoon));
  }, []);

  const stopPlayback = useCallback(() => {
    if (playbackTimeoutRef.current !== null) {
      window.clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    setPlaybackRunning(false);
  }, []);

  const switchDataMode = useCallback(
    (nextMode: 'seismic' | 'typhoon') => {
      if (nextMode === dataMode) return;
      stopPlayback();
      if (nextMode === 'typhoon' && audioRunning) stopAudio();
      setProbe(null);
      setProbeLocked(false);
      setProbeDistances(new Map());
      setTyphoonPlaybackTime(null);
      setDataMode(nextMode);
    },
    [audioRunning, dataMode, stopAudio, stopPlayback]
  );

  const startPlayback = useCallback(() => {
    const playlist = temporalQuakes;
    if (playlist.length === 0) return;

    stopPlayback();
    setMapMode('3d');
    setPlaybackRunning(true);

    let index = 0;
    const tick = () => {
      const quake = playlist[index];
      selectTimelineQuake(quake);
      index += 1;
      if (index >= playlist.length) {
        playbackTimeoutRef.current = window.setTimeout(() => {
          setPlaybackRunning(false);
          playbackTimeoutRef.current = null;
        }, Math.round(900 / playbackSpeed));
        return;
      }
      playbackTimeoutRef.current = window.setTimeout(tick, Math.round(900 / playbackSpeed));
    };

    tick();
  }, [playbackSpeed, selectTimelineQuake, stopPlayback, temporalQuakes]);

  const togglePlayback = useCallback(() => {
    if (playbackRunning) stopPlayback();
    else startPlayback();
  }, [playbackRunning, startPlayback, stopPlayback]);

  const stepTimelineSelection = useCallback(
    (direction: -1 | 1) => {
      if (playbackRunning || temporalQuakes.length === 0) return;

      const currentId = selected?.id ?? hover?.id ?? null;
      const currentIndex = currentId ? temporalQuakes.findIndex((quake) => quake.id === currentId) : -1;
      const nextIndex =
        currentIndex === -1
          ? direction > 0
            ? 0
            : temporalQuakes.length - 1
          : Math.max(0, Math.min(temporalQuakes.length - 1, currentIndex + direction));

      selectTimelineQuake(temporalQuakes[nextIndex]);
    },
    [hover, playbackRunning, selectTimelineQuake, selected, temporalQuakes]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (playbackRunning || introOpen || instructionOpen) return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      if (target?.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select') return;

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        stepTimelineSelection(-1);
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        stepTimelineSelection(1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [introOpen, instructionOpen, playbackRunning, stepTimelineSelection]);

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
          onNext={() => {
            if (instructionStep === 6) switchDataMode('typhoon');
            setInstructionStep((step) => step + 1);
          }}
          onClose={() => {
            setInstructionOpen(false);
            setInstructionStep(0);
          }}
        />
      )}
      <DataDownloadDialog open={downloadOpen} language={language} onClose={() => setDownloadOpen(false)} />

      <div className="station">
        <header className="bar">
          <div className="title-group">
            <div className="title">
              {dataMode === 'seismic' ? <>Seismic <em>Sonar</em></> : <>Typhoon <em>Tracker</em></>}
            </div>
            <div className="sub">
              {dataMode === 'seismic'
                ? `${mapMode === '3d' ? tr(language, '3D seismic globe', '3D 地震地球') : tr(language, '2D seismic map', '2D 地震地图')} · USGS M4.5+ · ${tr(language, 'local forecast probe', '局部概率探针')} · 360d`
                : `${mapMode === '3d' ? tr(language, '3D typhoon globe', '3D 台风地球') : tr(language, '2D typhoon map', '2D 台风地图')} · ${tr(language, 'observed track and China forecast', '实况路径与中国预报')} · 30d`}
            </div>
          </div>
          <div className="segmented dataset-switch" aria-label={tr(language, 'Dataset', '数据模式')}>
            <button type="button" className={`segmented-btn ${dataMode === 'seismic' ? 'active' : ''}`} onClick={() => switchDataMode('seismic')}>
              {tr(language, 'Quakes', '地震')}
            </button>
            <button type="button" className={`segmented-btn ${dataMode === 'typhoon' ? 'active' : ''}`} onClick={() => switchDataMode('typhoon')}>
              {tr(language, 'Typhoons', '台风')}
            </button>
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
            {dataMode === 'seismic' && (
              <button type="button" className="btn header-btn download-trigger" onClick={() => setDownloadOpen(true)}>
                {tr(language, 'Export', '下载')}
              </button>
            )}
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
            {dataMode === 'seismic' && (
              <>
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
                <span className="tutorial-hint">{tr(language, 'Tutorial', '教程')}</span>
              </>
            )}
          </div>
          <div className="right">
            <span className="blink-dot" />
            <span className="mono-caps">
              {dataMode === 'seismic'
                ? dataError
                  ? tr(language, 'Feed unavailable', '数据不可用')
                  : audioRunning
                    ? tr(language, 'Audio engaged', '声音已开启')
                    : tr(language, 'Audio standby', '声音待机')
                : typhoonError
                  ? tr(language, 'Typhoon feed unavailable', '台风数据不可用')
                  : typhoonLoading
                    ? tr(language, 'Loading tracks', '正在加载路径')
                    : tr(language, `${typhoons.filter((item) => item.isActive).length} active systems`, `${typhoons.filter((item) => item.isActive).length} 个活动台风`)}
            </span>
          </div>
        </header>

        <div className={`map-area tour-target-map ${dataMode === 'typhoon' ? 'tour-target-typhoon-map' : ''}`}>
          <GeoMap
            key={dataMode}
            mode={dataMode}
            quakes={dataMode === 'seismic' ? mapQuakes : []}
            typhoons={dataMode === 'typhoon' ? typhoons : []}
            onHover={setHover}
            onSelect={handleSelectQuake}
            onProbe={handleProbe}
            onProbeLockChange={setProbeLocked}
            onManualOrbitStart={() => {}}
            selectedId={dataMode === 'seismic' ? selectedId : null}
            hoverId={dataMode === 'seismic' ? hoverId : null}
            radius={radius}
            probeLocked={probeLocked}
            focusTarget={focusTarget}
            alignSignal={alignSignal}
            mapMode={mapMode}
            theme={resolvedTheme}
            language={language}
            selectedTyphoonId={dataMode === 'typhoon' ? selectedTyphoon?.id ?? null : null}
            onSelectTyphoon={handleSelectTyphoon}
            typhoonTime={typhoonPlaybackTime}
          />
        </div>

        {dataMode === 'seismic' ? <SidePanel
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
        /> : <TyphoonPanel
          typhoons={typhoons}
          loading={typhoonLoading}
          error={typhoonError}
          selected={selectedTyphoon}
          onSelect={handleSelectTyphoon}
          language={language}
          playbackTime={typhoonPlaybackTime}
        />}

        {dataMode === 'seismic' ? <Timeline
          quakes={visibleQuakes}
          allQuakes={magnitudeFilteredQuakes}
          filterMagnitude={filterMagnitude}
          onBrush={setBrushRange}
          onHover={setHover}
          onSelect={handleSelectQuake}
          hoverId={hoverId}
          selectedId={selectedId}
          brushRange={brushRange}
          onTogglePlayback={togglePlayback}
          playbackRunning={playbackRunning}
          playbackSpeed={playbackSpeed}
          onPlaybackSpeed={setPlaybackSpeed}
          onStepPlayback={stepTimelineSelection}
          language={language}
        /> : <TyphoonTimeline
          typhoons={typhoons}
          selectedId={selectedTyphoon?.id ?? null}
          onSelect={handleSelectTyphoon}
          language={language}
          playbackTime={typhoonPlaybackTime}
          onPlaybackTime={setTyphoonPlaybackTime}
        />}
      </div>
    </div>
  );
}
