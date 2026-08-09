'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Typhoon } from '@/lib/typhoon';
import { typhoonTrackAtTime } from '@/lib/typhoon';
import type { Language } from '@/lib/ui';
import { tr } from '@/lib/ui';

interface Props {
  typhoons: Typhoon[];
  selectedId: string | null;
  onSelect: (typhoon: Typhoon) => void;
  language: Language;
  playbackTime: number | null;
  onPlaybackTime: (time: number | null) => void;
}

const WIDTH = 1000;
const HEIGHT = 178;
const LEFT = 116;
const RIGHT = 24;
const HOUR = 60 * 60 * 1000;

export default function TyphoonTimeline({
  typhoons,
  selectedId,
  onSelect,
  language,
  playbackTime,
  onPlaybackTime,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const observedEnd = useMemo(
    () => Math.max(Date.now(), ...typhoons.map((typhoon) => typhoon.endTime)),
    [typhoons]
  );
  const start = observedEnd - 30 * 24 * HOUR;
  const forecastEnd = Math.max(
    observedEnd,
    ...typhoons.flatMap((typhoon) => typhoon.forecast?.points.map((point) => point.time) ?? [])
  );
  const end = forecastEnd + Math.max(6 * HOUR, (forecastEnd - start) * 0.02);
  const x = (time: number) => LEFT + ((time - start) / Math.max(1, end - start)) * (WIDTH - LEFT - RIGHT);
  const rows = typhoons.slice(0, 8);
  const rowHeight = rows.length > 0 ? 126 / rows.length : 16;
  const cursorTime = playbackTime ?? observedEnd;

  useEffect(() => {
    if (!playing) return;
    const timeoutId = window.setTimeout(() => {
      const nextTime = (playbackTime ?? start) + 6 * HOUR;
      if (nextTime >= observedEnd) {
        setPlaying(false);
        onPlaybackTime(null);
      } else {
        onPlaybackTime(nextTime);
      }
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [observedEnd, onPlaybackTime, playbackTime, playing, start]);

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (playbackTime === null || playbackTime >= observedEnd - HOUR) onPlaybackTime(start);
    setPlaying(true);
  };

  return (
    <section className="timeline typhoon-timeline tour-target-typhoon-timeline">
      <div className="timeline-label">
        {tr(language, 'Tropical cyclone activity · observed and forecast paths', '台风活动时间 · 实况与未来预报')}
      </div>
      <div className="typhoon-playback-controls">
        <button
          type="button"
          className={playbackTime === null ? 'live active' : 'live'}
          onClick={() => {
            setPlaying(false);
            onPlaybackTime(null);
          }}
        >
          <i />{tr(language, 'Live', '实时')}
        </button>
        <button type="button" className="play" onClick={togglePlayback}>
          {playing ? tr(language, 'Pause', '暂停') : tr(language, 'Play', '播放')}
        </button>
        <input
          aria-label={tr(language, 'Typhoon playback time', '台风回放时间')}
          type="range"
          min={start}
          max={observedEnd}
          step={HOUR}
          value={cursorTime}
          onChange={(event) => {
            setPlaying(false);
            onPlaybackTime(Number(event.target.value));
          }}
        />
        <strong>
          {playbackTime === null
            ? tr(language, 'Latest', '最新')
            : new Date(playbackTime).toLocaleString(language === 'cn' ? 'zh-CN' : 'en-US', {
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
        </strong>
      </div>
      {rows.length === 0 ? (
        <div className="typhoon-timeline-empty">{tr(language, 'Waiting for typhoon data...', '等待台风数据...')}</div>
      ) : (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={tr(language, 'Typhoon activity timeline', '台风活动时间线')}>
          <line className="typhoon-now-line" x1={x(observedEnd)} x2={x(observedEnd)} y1={20} y2={154} />
          <text className="typhoon-now-label" x={x(observedEnd) - 4} y={16}>{tr(language, 'NOW', '现在')}</text>
          {playbackTime !== null && (
            <line className="typhoon-playhead" x1={x(cursorTime)} x2={x(cursorTime)} y1={20} y2={154} />
          )}
          {rows.map((typhoon, index) => {
            const y = 29 + index * rowHeight + rowHeight / 2;
            const state = typhoonTrackAtTime(typhoon, playbackTime);
            const actualStart = x(Math.max(start, typhoon.startTime));
            const visibleEndTime = playbackTime === null
              ? Math.min(observedEnd, typhoon.endTime)
              : Math.min(cursorTime, typhoon.endTime);
            const actualEnd = x(Math.max(typhoon.startTime, visibleEndTime));
            const future = playbackTime === null
              ? typhoon.forecast?.points[typhoon.forecast.points.length - 1]
              : null;
            const active = selectedId === typhoon.id;
            const visible = state.center !== null;
            return (
              <g key={typhoon.id} className={`typhoon-time-row ${active ? 'selected' : ''}`} onClick={() => onSelect(typhoon)}>
                <rect className="typhoon-time-hit" x={0} y={y - rowHeight / 2} width={WIDTH} height={rowHeight} />
                <text className="typhoon-time-name" x={LEFT - 10} y={y + 3}>{shortName(typhoon.enName || typhoon.name)}</text>
                <line className="typhoon-time-base" x1={LEFT} x2={WIDTH - RIGHT} y1={y} y2={y} />
                {visible && <line className="typhoon-time-observed" x1={actualStart} x2={actualEnd} y1={y} y2={y} />}
                {visible && <circle className={typhoon.isActive ? 'typhoon-time-center active' : 'typhoon-time-center'} cx={actualEnd} cy={y} r={active ? 4.4 : 3.2} />}
                {future && <line className="typhoon-time-forecast" x1={actualEnd} x2={x(future.time)} y1={y} y2={y} />}
              </g>
            );
          })}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const time = start + (end - start) * fraction;
            const axisX = x(time);
            return (
              <g key={fraction}>
                <line className="typhoon-time-tick" x1={axisX} x2={axisX} y1={158} y2={163} />
                <text className="typhoon-time-date" x={axisX} y={175}>{new Date(time).toLocaleDateString(language === 'cn' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })}</text>
              </g>
            );
          })}
        </svg>
      )}
    </section>
  );
}

function shortName(name: string) {
  return name.length > 13 ? `${name.slice(0, 12)}…` : name;
}
