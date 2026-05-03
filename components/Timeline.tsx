'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { Quake } from '@/lib/data';
import { magClass } from '@/lib/data';
import type { Language } from '@/lib/ui';
import { tr } from '@/lib/ui';

interface Props {
  quakes: Quake[];
  allQuakes: Quake[];
  filterMagnitude: [number, number];
  onBrush: (range: [number, number] | null) => void;
  onHover: (q: Quake | null) => void;
  onSelect: (q: Quake | null) => void;
  hoverId: string | null;
  selectedId: string | null;
  brushRange: [number, number] | null;
  onTogglePlayback: () => void;
  playbackRunning: boolean;
  playbackSpeed: number;
  onPlaybackSpeed: (speed: number) => void;
  onStepPlayback: (direction: -1 | 1) => void;
  language: Language;
}

const MIN_EVENT_HIT_HEIGHT = 22;
const EVENT_HIT_WIDTH = 12;

export default function Timeline({
  quakes,
  allQuakes,
  filterMagnitude,
  onBrush,
  onHover,
  onSelect,
  hoverId,
  selectedId,
  brushRange,
  onTogglePlayback,
  playbackRunning,
  playbackSpeed,
  onPlaybackSpeed,
  onStepPlayback,
  language,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const brushRef = useRef<d3.BrushBehavior<unknown> | null>(null);
  const lastWheelStepRef = useRef(0);
  const [size, setSize] = useState({ w: 1000, h: 240 });

  useEffect(() => {
    if (!wrapRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setSize({ w: Math.floor(rect.width), h: Math.floor(rect.height) });
    });
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, []);

  const margin = { top: 26, right: 24, bottom: 82, left: 52 };
  const plotW = Math.max(0, size.w - margin.left - margin.right);
  const plotH = Math.max(0, size.h - margin.top - margin.bottom);
  const overviewHeight = 42;
  const overviewY = plotH + 24;

  const domainSource = allQuakes.length > 0 ? allQuakes : quakes;
  const rawExtent = d3.extent(domainSource, (quake) => quake.time) as [number | undefined, number | undefined];
  const fallbackEnd = Date.now();
  const extent: [number, number] =
    rawExtent[0] !== undefined && rawExtent[1] !== undefined
      ? [rawExtent[0], rawExtent[1]]
      : [fallbackEnd - 30 * 24 * 60 * 60 * 1000, fallbackEnd];
  const xScale = useMemo(
    () => d3.scaleTime().domain(extent).range([0, plotW]),
    [extent, plotW]
  );
  const yScale = useMemo(() => {
    const minMag = Math.min(filterMagnitude[0], filterMagnitude[1]);
    const maxMag = Math.max(filterMagnitude[0], filterMagnitude[1]);
    const span = Math.max(0.1, maxMag - minMag);
    const pad = Math.max(0.15, span * 0.08);
    return d3
      .scaleLinear()
      .domain([Math.max(0, minMag - pad), Math.min(8, maxMag + pad)])
      .range([plotH, 0]);
  }, [plotH, filterMagnitude]);

  const histogram = useMemo(() => {
    const thresholds = xScale.ticks(Math.max(10, Math.floor(plotW / 56)));
    const bins = d3
      .bin<Quake, Date>()
      .value((quake) => new Date(quake.time))
      .domain(xScale.domain() as [Date, Date])
      .thresholds(thresholds)(allQuakes);
    const y = d3.scaleLinear().domain([0, d3.max(bins, (bin) => bin.length) || 1]).range([overviewHeight, 0]);
    return { bins, y };
  }, [allQuakes, overviewHeight, plotW, xScale]);

  useEffect(() => {
    if (!svgRef.current || plotW <= 0) return;
    const svg = d3.select(svgRef.current);
    svg.select('.x-axis').selectAll('*').remove();
    svg.select('.y-axis').selectAll('*').remove();

    (svg.select('.x-axis') as any).call(
      d3.axisBottom(xScale).ticks(Math.max(4, Math.floor(plotW / 120))).tickFormat(d3.timeFormat('%b %d') as any)
    );
    (svg.select('.y-axis') as any).call(d3.axisLeft(yScale).ticks(4).tickFormat((value: any) => `M${value}`));
  }, [plotW, xScale, yScale]);

  useEffect(() => {
    if (!svgRef.current || plotW <= 0 || plotH <= 0) return;
    const svg = d3.select(svgRef.current);
    const brushG = svg.select<SVGGElement>('.brush');
    brushG.selectAll('*').remove();

    const brush = d3
      .brushX<unknown>()
      .extent([
        [0, overviewY],
        [plotW, overviewY + overviewHeight],
      ])
      .on('brush end', (event: any) => {
        if (!event.sourceEvent) return;
        if (!event.selection) {
          onBrush(null);
          return;
        }
        const [x0, x1] = event.selection as [number, number];
        onBrush([xScale.invert(x0).getTime(), xScale.invert(x1).getTime()]);
      });

    brushRef.current = brush;
    (brushG as any).call(brush);

  }, [onBrush, overviewHeight, overviewY, plotH, plotW, xScale]);

  useEffect(() => {
    if (!svgRef.current || !brushRef.current || plotW <= 0) return;
    const brushG = d3.select(svgRef.current).select<SVGGElement>('.brush');
    if (!brushRange) {
      (brushG as any).call(brushRef.current.move as any, null);
      return;
    }
    (brushG as any).call(brushRef.current.move as any, [xScale(brushRange[0]), xScale(brushRange[1])]);
  }, [brushRange, plotW, xScale]);

  return (
    <div
      ref={wrapRef}
      className="timeline tour-target-timeline"
      style={{ width: '100%' }}
      onWheel={(event) => {
        if (playbackRunning || Math.abs(event.deltaY) < 4 || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
        event.preventDefault();
        const now = performance.now();
        if (now - lastWheelStepRef.current < 140) return;
        lastWheelStepRef.current = now;
        onStepPlayback(event.deltaY < 0 ? -1 : 1);
      }}
    >
      <div className="timeline-label">{tr(language, 'Temporal distribution · click again to clear selection · brush overview below', '时间分布 · 再次点击取消选择 · 下方刷选范围')}</div>
      <div className="timeline-controls">
        <label className="timeline-speed">
          <span>{tr(language, 'Speed', '速度')}</span>
          <input
            type="range"
            min="0.25"
            max="2"
            step="0.25"
            value={playbackSpeed}
            onChange={(event) => onPlaybackSpeed(Number(event.target.value))}
            aria-label={tr(language, 'Playback speed', '播放速度')}
          />
          <strong>{playbackSpeed.toFixed(2).replace(/\.00$/, '')}x</strong>
        </label>
        <button type="button" className={`timeline-play ${playbackRunning ? 'on' : ''}`} onClick={onTogglePlayback}>
          {playbackRunning ? tr(language, 'Stop', '停止') : tr(language, 'Play', '播放')}
        </button>
      </div>
      <svg ref={svgRef} width={size.w} height={size.h}>
        <g transform={`translate(${margin.left},${margin.top})`}>
          {d3.range(Math.ceil(filterMagnitude[0] * 2) / 2, 8, 0.5).map((magnitude) => (
            <line
              key={magnitude}
              x1={0}
              x2={plotW}
              y1={yScale(magnitude)}
              y2={yScale(magnitude)}
              stroke="var(--rule)"
              strokeDasharray="3 4"
              opacity={0.4}
            />
          ))}

          {quakes.map((quake) => {
            const x = xScale(quake.time);
            const y = yScale(quake.mag);
            const hitTop = Math.max(0, Math.min(y - 8, plotH - MIN_EVENT_HIT_HEIGHT));
            const hitHeight = Math.min(plotH - hitTop, Math.max(MIN_EVENT_HIT_HEIGHT, plotH - hitTop));
            const cls = magClass(quake.mag);
            const active = quake.id === hoverId || quake.id === selectedId;
            return (
              <g
                key={quake.id}
                onMouseEnter={() => onHover(quake)}
                onMouseLeave={() => onHover(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(quake);
                }}
              >
                <rect
                  className="timeline-column-hit"
                  x={x - EVENT_HIT_WIDTH / 2}
                  y={hitTop}
                  width={EVENT_HIT_WIDTH}
                  height={hitHeight}
                />
                <line
                  className={`tbar ${cls} ${active ? 'active' : ''}`}
                  x1={x}
                  x2={x}
                  y1={y}
                  y2={plotH}
                />
                <circle
                  className={`timeline-hit ${active ? 'active' : ''}`}
                  cx={x}
                  cy={y}
                  r={active ? 7 : 5}
                />
              </g>
            );
          })}

          <g className="x-axis timeline-axis" transform={`translate(0,${plotH})`} />
          <g className="y-axis timeline-axis" />

          <g transform={`translate(0,${overviewY})`}>
            {histogram.bins.map((bin, index) => {
              const x0 = xScale(bin.x0 as Date);
              const x1 = xScale(bin.x1 as Date);
              const y = histogram.y(bin.length);
              return (
                <rect
                  key={`${bin.x0}-${index}`}
                  className="overview-bar"
                  x={x0}
                  y={y}
                  width={Math.max(1, x1 - x0 - 1)}
                  height={overviewHeight - y}
                />
              );
            })}
          </g>

          <g className="brush" />
        </g>
      </svg>
    </div>
  );
}
