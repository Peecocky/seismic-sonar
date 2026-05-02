'use client';

import { useMemo, useState } from 'react';
import type { Language } from '@/lib/ui';
import { tr } from '@/lib/ui';

interface Props {
  onEnter: () => void;
  loading: boolean;
  language: Language;
}

export default function Intro({ onEnter, loading, language }: Props) {
  const [progress, setProgress] = useState(0);

  const opacity = useMemo(() => 1 - progress * 0.82, [progress]);
  const transform = useMemo(() => `translateY(${progress * -32}px) scale(${1 - progress * 0.04})`, [progress]);

  return (
    <div
      className="intro"
      onWheel={(event) => {
        const next = Math.max(0, Math.min(1, progress + event.deltaY / 1200));
        setProgress(next);
        if (next >= 1 && !loading) onEnter();
      }}
      style={{ opacity, transform }}
    >
      <div className="intro-card">
        <div className="mono-tag">{tr(language, 'Station 7 · producer introduction', '第 7 站 · 作品介绍')}</div>
        <h1>
          Seismic <em>Sonar</em>
        </h1>
        <p className="lede">
          {tr(
            language,
            'A listening instrument for global earthquakes. The probe can lock onto a seismic region, and the audio field follows the spatial density around that focus point.',
            '一个用于全球地震的声音化可视化仪器。探针可以锁定地震区域，声音会随焦点周围的空间密度变化。'
          )}
        </p>

        <div className="intro-list">
          <div className="intro-item">
            <strong>{tr(language, 'Spatial listening', '空间聆听')}</strong>
            {tr(language, 'Hover to sweep. Click once to lock the probe and inspect every event inside that range.', '移动鼠标扫描。点击一次锁定探针并查看范围内事件。')}
          </div>
          <div className="intro-item">
            <strong>{tr(language, 'Corrected sonification', '修正的声音映射')}</strong>
            {tr(language, 'Higher magnitude drives lower pitch, while depth shapes brightness and damping.', '震级越高音高越低，深度影响亮度和衰减。')}
          </div>
          <div className="intro-item">
            <strong>{tr(language, 'Longer memory', '更长记忆')}</strong>
            {tr(language, 'Start at 30 days, then expand the feed to 90 days, 180 days, or 360 days.', '从 30 天开始，也可以扩展到 90、180 或 360 天。')}
          </div>
        </div>

        <div className="intro-actions">
          <button className="intro-enter" onClick={onEnter} disabled={loading}>
            {loading ? tr(language, 'Loading feed', '正在加载') : tr(language, 'Enter instrument', '进入')}
          </button>
          <div className="intro-note">{tr(language, 'Scroll down to fade this introduction out, or click to enter immediately.', '向下滚动淡出介绍，或点击立即进入。')}</div>
        </div>

        <div className="intro-progress">
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
