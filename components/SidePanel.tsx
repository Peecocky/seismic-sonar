'use client';

import type { DataWindowDays, Quake } from '@/lib/data';
import { formatCoord, formatTime } from '@/lib/data';
import type { GlobeProbePoint } from '@/lib/globe';
import { quakeMarkerColor } from '@/lib/globe';
import { SonarEngine } from '@/lib/audio';
import type { LocalForecast } from '@/lib/forecast';
import { formatProbability } from '@/lib/forecast';
import type { Language } from '@/lib/ui';
import { tr } from '@/lib/ui';

interface Props {
  quakes: Quake[];
  totalCount: number;
  hover: Quake | null;
  selected: Quake | null;
  engine: SonarEngine;
  audioRunning: boolean;
  onStart: () => Promise<void>;
  onStop: () => void;
  filterMagnitude: [number, number];
  onFilterMagnitude: (range: [number, number]) => void;
  radius: number;
  onRadius: (r: number) => void;
  volume: number;
  onVolume: (v: number) => void;
  probeDistances: Map<string, number>;
  probeLocked: boolean;
  probe: GlobeProbePoint | null;
  dataWindowDays: DataWindowDays;
  onDataWindowDays: (days: DataWindowDays) => void;
  onSelectQuake: (quake: Quake) => void;
  history: Quake[];
  forecast: LocalForecast | null;
  language: Language;
}

const WINDOW_OPTIONS: Array<{ label: string; value: DataWindowDays }> = [
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: '180d', value: 180 },
  { label: '360d', value: 360 },
];

const MIN_RADIUS = 100;
const MAX_RADIUS = 4200;

function sliderToRadius(value: number) {
  const t = Math.max(0, Math.min(100, value)) / 100;
  return Math.round(MIN_RADIUS * Math.pow(MAX_RADIUS / MIN_RADIUS, t));
}

function radiusToSlider(radius: number) {
  const clamped = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, radius));
  return Math.round((Math.log(clamped / MIN_RADIUS) / Math.log(MAX_RADIUS / MIN_RADIUS)) * 100);
}

export default function SidePanel({
  quakes,
  totalCount,
  hover,
  selected,
  audioRunning,
  onStart,
  onStop,
  filterMagnitude,
  onFilterMagnitude,
  radius,
  onRadius,
  volume,
  onVolume,
  probeDistances,
  probeLocked,
  probe,
  dataWindowDays,
  onDataWindowDays,
  onSelectQuake,
  history,
  forecast,
  language,
}: Props) {
  const nearest = [...probeDistances.entries()]
    .map(([id, distanceKm]) => {
      const quake = quakes.find((item) => item.id === id);
      return quake ? { quake, distanceKm } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a!.distanceKm - b!.distanceKm)
    .slice(0, 8) as Array<{ quake: Quake; distanceKm: number }>;

  const focal = selected ?? hover;
  const strongest = quakes.reduce<Quake | null>((largest, quake) => {
    if (!largest || quake.mag > largest.mag) return quake;
    return largest;
  }, null);

  return (
    <aside className="side">
      <div className="section compact tour-target-data">
        <h3>{tr(language, 'Data Window', '数据窗口')}</h3>
        <div className="segmented">
          {WINDOW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segmented-btn ${dataWindowDays === option.value ? 'active' : ''}`}
              onClick={() => onDataWindowDays(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="readout">
          <div className="row data-count-row">
            <span className="k">{tr(language, 'Loaded / Visible', '已加载 / 可见')}</span>
            <span className="v">{totalCount} / {quakes.length}</span>
          </div>
        </div>
        {strongest && (
          <button type="button" className="info-card" onClick={() => onSelectQuake(strongest)}>
            <span className="label">{tr(language, 'Largest event', '最大地震')}</span>
            <strong>M{strongest.mag.toFixed(1)} · {strongest.place}</strong>
            <span>{formatTime(strongest.time)}</span>
          </button>
        )}
      </div>

      <div className="section compact tour-target-filter">
        <h3>{tr(language, 'Filter', '筛选')}</h3>
        <div className="slider-row">
          <label>
            <span>{tr(language, 'Min Magnitude', '最低震级')}</span>
            <span className="val">M{filterMagnitude[0].toFixed(1)}</span>
          </label>
          <input
            type="range"
            min={4.5}
            max={8}
            step={0.1}
            value={filterMagnitude[0]}
            onChange={(e) => {
              const next = +e.target.value;
              onFilterMagnitude([next, Math.max(next, filterMagnitude[1])]);
            }}
          />
        </div>
        <div className="slider-row">
          <label>
            <span>{tr(language, 'Max Magnitude', '最高震级')}</span>
            <span className="val">M{filterMagnitude[1].toFixed(1)}</span>
          </label>
          <input
            type="range"
            min={4.5}
            max={8}
            step={0.1}
            value={filterMagnitude[1]}
            onChange={(e) => {
              const next = +e.target.value;
              onFilterMagnitude([Math.min(filterMagnitude[0], next), next]);
            }}
          />
        </div>
      </div>

      <div className="section tour-target-probe">
        <h3>{tr(language, 'Probe', '探针')}</h3>
        <button className={`btn ${audioRunning ? 'on' : ''}`} onClick={() => (audioRunning ? onStop() : onStart())}>
          {audioRunning ? tr(language, 'Stop Audio', '停止声音') : tr(language, 'Start Audio', '开启声音')}
        </button>
        <div className="slider-row">
          <label>
            <span>{tr(language, 'Volume', '音量')}</span>
            <span className="val">{Math.round(volume * 100)}%</span>
          </label>
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => onVolume(+e.target.value)} />
        </div>
        <div className="slider-row">
          <label>
            <span>{tr(language, 'Influence Radius', '影响半径')}</span>
            <span className="val">{Math.round(radius)} km</span>
          </label>
          <input type="range" min={0} max={100} step={1} value={radiusToSlider(radius)} onChange={(e) => onRadius(sliderToRadius(+e.target.value))} />
        </div>
        <div className="readout">
          <div className="row">
            <span className="k">{tr(language, 'State', '状态')}</span>
            <span className="v">{probeLocked ? tr(language, 'Locked', '已锁定') : tr(language, 'Live hover', '实时 hover')}</span>
          </div>
          {probe && (
            <div className="row">
              <span className="k">{tr(language, 'Focus', '焦点')}</span>
              <span className="v">{formatCoord(probe.lat, probe.lon)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="section compact tour-target-forecast">
        <h3>{tr(language, 'Prediction', '预测')}</h3>
        {forecast ? (
          <div className="forecast-grid prediction-grid">
            {forecast.predictionHorizonStats.map((stat) => (
              <div key={stat.days} className="forecast-cell prediction-card">
                <strong>{tr(language, `Next ${stat.days} days`, `未来 ${stat.days} 天`)}</strong>
                <em>
                  <span>M{forecast.minMagnitude.toFixed(1)}+ <b>{formatProbability(stat.probability)}</b></span>
                  <span>&gt;=M6 <b>{formatProbability(stat.intensityProbability)}</b></span>
                </em>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel-note">
            {tr(language, 'Hover a map area or select an event to estimate local short-term probability from the last 360 days.', '在地图上移动鼠标或选择地震，用过去 360 天估计局部短期概率。')}
          </div>
        )}
      </div>

      <div className="section tour-target-nearby">
        <h3>{tr(language, 'Nearby Earthquakes', '附近地震')}</h3>
        {nearest.length === 0 ? (
          <div className="panel-note">{tr(language, 'Move across the map, then click once to lock the probe.', '在地图上移动，点击一次可锁定探针。')}</div>
        ) : (
          <div className="readout">
            {nearest.map(({ quake, distanceKm }) => (
              <button key={quake.id} type="button" className="row-button" onClick={() => onSelectQuake(quake)}>
                <span className="k nearby-label">
                  <span className="nearby-mag" style={{ color: quakeMarkerColor(quake.mag, false) }}>M{quake.mag.toFixed(1)}</span>
                  <span>· {(quake.place || '').slice(0, 30)}</span>
                </span>
                <span className={`v ${quake.mag >= 6 ? 'danger' : quake.mag >= 5.2 ? 'warn' : ''}`}>{Math.round(distanceKm)} km</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3>{tr(language, 'Active Event', '当前地震')}</h3>
        {focal ? (
          <button type="button" className="info-card active" onClick={() => onSelectQuake(focal)}>
            <span className="label">{selected ? tr(language, 'Selected event', '已选择地震') : tr(language, 'Hovered event', '悬停地震')}</span>
            <strong>M{focal.mag.toFixed(1)} · {focal.place}</strong>
            <span>{formatCoord(focal.lat, focal.lon)} · depth {focal.depth.toFixed(0)} km</span>
            <span>{formatTime(focal.time)}</span>
          </button>
        ) : (
          <div className="panel-note">{tr(language, 'Hover or click a marker, a timeline point, or the largest-event card to jump to that region.', '悬停或点击地图标记、时间轴点、最大地震卡片即可跳转。')}</div>
        )}
      </div>

      <div className="section compact tour-target-history">
        <h3>{tr(language, 'Browse History', '浏览历史')}</h3>
        {history.length === 0 ? (
          <div className="panel-note">{tr(language, 'Selected earthquakes will appear here.', '选择过的地震会显示在这里。')}</div>
        ) : (
          <div className="readout">
            {history.map((quake) => (
              <button key={quake.id} type="button" className="row-button history-row" onClick={() => onSelectQuake(quake)}>
                <span className="k event-place">M{quake.mag.toFixed(1)} · {(quake.place || 'Unknown').slice(0, 34)}</span>
                <span className="v event-time">{formatTime(quake.time).slice(5, 16)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="section compact">
        <h3>{tr(language, 'Magnitude Colors', '震级颜色')}</h3>
        <div className="legend-list">
          <div className="legend-item"><span className="legend-chip chip-1" /> {tr(language, 'Continuous scale from M4.5 to M7.8+', 'M4.5 到 M7.8+ 连续色标')}</div>
          <div className="legend-item"><span className="legend-chip chip-2" /> {tr(language, 'Yellow to amber to orange to deep red', '黄色到琥珀、橙色、深红')}</div>
        </div>
      </div>
    </aside>
  );
}
