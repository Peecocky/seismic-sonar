'use client';

import type { Typhoon } from '@/lib/typhoon';
import type { Language } from '@/lib/ui';
import { tr } from '@/lib/ui';

interface Props {
  typhoons: Typhoon[];
  selectedId: string | null;
  onSelect: (typhoon: Typhoon) => void;
  language: Language;
}

const WIDTH = 1000;
const HEIGHT = 178;
const LEFT = 116;
const RIGHT = 24;

export default function TyphoonTimeline({ typhoons, selectedId, onSelect, language }: Props) {
  const observedEnd = Math.max(Date.now(), ...typhoons.map((typhoon) => typhoon.endTime));
  const start = observedEnd - 30 * 24 * 60 * 60 * 1000;
  const forecastEnd = Math.max(
    observedEnd,
    ...typhoons.flatMap((typhoon) => typhoon.forecast?.points.map((point) => point.time) ?? [])
  );
  const end = forecastEnd + Math.max(6 * 60 * 60 * 1000, (forecastEnd - start) * 0.02);
  const x = (time: number) => LEFT + ((time - start) / Math.max(1, end - start)) * (WIDTH - LEFT - RIGHT);
  const rows = typhoons.slice(0, 8);
  const rowHeight = rows.length > 0 ? 126 / rows.length : 16;

  return (
    <section className="timeline typhoon-timeline">
      <div className="timeline-label">{tr(language, 'Tropical cyclone activity · observed and forecast paths', '台风活动时间 · 实况与未来预报')}</div>
      {rows.length === 0 ? (
        <div className="typhoon-timeline-empty">{tr(language, 'Waiting for typhoon data...', '等待台风数据...')}</div>
      ) : (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={tr(language, 'Typhoon activity timeline', '台风活动时间线')}>
          <line className="typhoon-now-line" x1={x(observedEnd)} x2={x(observedEnd)} y1={20} y2={154} />
          <text className="typhoon-now-label" x={x(observedEnd) - 4} y={16}>{tr(language, 'NOW', '现在')}</text>
          {rows.map((typhoon, index) => {
            const y = 29 + index * rowHeight + rowHeight / 2;
            const actualStart = x(Math.max(start, typhoon.startTime));
            const actualEnd = x(Math.min(observedEnd, typhoon.endTime));
            const future = typhoon.forecast?.points[typhoon.forecast.points.length - 1];
            const active = selectedId === typhoon.id;
            return (
              <g key={typhoon.id} className={`typhoon-time-row ${active ? 'selected' : ''}`} onClick={() => onSelect(typhoon)}>
                <rect className="typhoon-time-hit" x={0} y={y - rowHeight / 2} width={WIDTH} height={rowHeight} />
                <text className="typhoon-time-name" x={LEFT - 10} y={y + 3}>{shortName(typhoon.enName || typhoon.name)}</text>
                <line className="typhoon-time-base" x1={LEFT} x2={WIDTH - RIGHT} y1={y} y2={y} />
                <line className="typhoon-time-observed" x1={actualStart} x2={actualEnd} y1={y} y2={y} />
                <circle className={typhoon.isActive ? 'typhoon-time-center active' : 'typhoon-time-center'} cx={actualEnd} cy={y} r={active ? 4.4 : 3.2} />
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
                <text className="typhoon-time-date" x={axisX} y={175}>{new Date(time).toLocaleDateString([], { month: 'short', day: 'numeric' })}</text>
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
