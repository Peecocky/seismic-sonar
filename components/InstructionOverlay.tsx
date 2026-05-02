'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Language } from '@/lib/ui';
import { tr } from '@/lib/ui';

interface InstructionOverlayProps {
  language: Language;
  step: number;
  onNext: () => void;
  onClose: () => void;
}

const steps = [
  {
    target: 'map',
    enTitle: 'Map probe',
    cnTitle: '地图探针',
    enBody: 'Hover the globe or 2D map to scan a radius. Click a quake to focus it; click it again to clear the selection.',
    cnBody: '在 3D 地球或 2D 地图上移动鼠标扫描半径。点击地震会聚焦，再次点击会取消选择。',
  },
  {
    target: 'probe',
    enTitle: 'Audio probe',
    cnTitle: '声纳探针',
    enBody: 'Start audio, then move the probe. Nearby events fade in by distance; the radius slider starts at city scale.',
    cnBody: '开启声音后移动探针。附近地震会按距离渐入；半径滑块从城市尺度开始。',
  },
  {
    target: 'forecast',
    enTitle: 'Local forecast',
    cnTitle: '局部概率',
    enBody: 'The forecast estimates local M-threshold and M6+ probabilities from 30/90/180/360 day event rates.',
    cnBody: '概率模块会用 30/90/180/360 天事件率估计当前阈值和 M6+ 的局部概率。',
  },
  {
    target: 'filter',
    enTitle: 'Filters',
    cnTitle: '筛选器',
    enBody: 'Use magnitude and data-window filters to narrow the catalog before probing or playback.',
    cnBody: '用震级和时间窗口筛选数据，再进行探测或播放。',
  },
  {
    target: 'timeline',
    enTitle: 'Timeline playback',
    cnTitle: '时间轴播放',
    enBody: 'Brush the lower overview, then press Play to step through those earthquakes on the globe.',
    cnBody: '在底部 overview 上刷选范围，然后点击播放，地球会按时间逐个跳转。',
  },
] as const;

export default function InstructionOverlay({ language, step, onNext, onClose }: InstructionOverlayProps) {
  const current = steps[Math.min(step, steps.length - 1)];
  const done = step >= steps.length - 1;
  const [metrics, setMetrics] = useState<CSSProperties>({});

  useEffect(() => {
    const target = document.querySelector<HTMLElement>(`.tour-target-${current.target}`);
    if (!target) return;

    target.scrollIntoView({ block: 'center', behavior: 'smooth' });

    const update = () => {
      const rect = target.getBoundingClientRect();
      const pad = 10;
      const cardW = 360;
      const cardH = 190;
      let cardLeft = rect.right + 18;
      let cardTop = rect.top;

      if (cardLeft + cardW > window.innerWidth - 18) cardLeft = rect.left - cardW - 18;
      if (cardLeft < 18) cardLeft = 18;
      if (current.target === 'timeline') cardTop = rect.top - cardH - 18;
      if (cardTop + cardH > window.innerHeight - 18) cardTop = window.innerHeight - cardH - 18;
      if (cardTop < 18) cardTop = 18;

      setMetrics({
        '--spot-left': `${Math.max(8, rect.left - pad)}px`,
        '--spot-top': `${Math.max(8, rect.top - pad)}px`,
        '--spot-width': `${Math.min(window.innerWidth - rect.left - 8, rect.width + pad * 2)}px`,
        '--spot-height': `${Math.min(window.innerHeight - rect.top - 8, rect.height + pad * 2)}px`,
        '--card-left': `${cardLeft}px`,
        '--card-top': `${cardTop}px`,
      } as CSSProperties);
    };

    const id = window.setTimeout(update, 280);
    window.addEventListener('resize', update);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('resize', update);
    };
  }, [current.target]);

  const layerStyle = useMemo(() => metrics, [metrics]);

  return (
    <div className={`instruction-layer target-${current.target}`} style={layerStyle}>
      <button type="button" className="instruction-skip" onClick={onClose}>
        {tr(language, 'Close', '关闭')}
      </button>
      <div className="instruction-card">
        <div className="mono-tag">{tr(language, `Step ${step + 1} / ${steps.length}`, `第 ${step + 1} 步 / 共 ${steps.length} 步`)}</div>
        <h2>{tr(language, current.enTitle, current.cnTitle)}</h2>
        <p>{tr(language, current.enBody, current.cnBody)}</p>
        <div className="instruction-actions">
          <button type="button" className="btn" onClick={onClose}>
            {tr(language, 'Exit', '退出')}
          </button>
          <button type="button" className="btn on" onClick={done ? onClose : onNext}>
            {done ? tr(language, 'Finish', '完成') : tr(language, 'Next', '下一步')}
          </button>
        </div>
      </div>
    </div>
  );
}
