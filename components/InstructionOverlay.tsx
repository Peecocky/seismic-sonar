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
    enBody: 'Hover the globe or 2D map to scan a radius. Click a quake to focus it; press and hold the map or any quake briefly to pin the probe without opening the event.',
    cnBody: '在 3D 地球或 2D 地图上移动鼠标扫描半径。点击地震会聚焦；在地图或任意地震上稍微长按，可以固定探针而不打开事件。',
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
    enBody: 'Prediction uses the last 360 days of local events to estimate the chance of M-threshold and M6+ earthquakes over the next 7, 30, 180, and 360 days.',
    cnBody: '预测会用过去 360 天的局部事件率，估计未来 7、30、180、360 天内当前阈值和 M6+ 地震出现的概率。',
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
    enBody: 'Brush the lower overview, set Play speed, then press Play. Mouse wheel over the temporal distribution steps through events; Left/Right arrow keys step backward or forward.',
    cnBody: '在底部 overview 上刷选范围，调节播放速度后点击播放。鼠标滚轮悬停在时间分布上可逐个切换事件；键盘左/右方向键可向前或向后切换。',
  },
  {
    target: 'nearby',
    enTitle: 'Nearby earthquakes',
    cnTitle: '附近地震',
    enBody: 'This list shows the closest events inside the probe field. Click any row to jump to that earthquake and inspect it on the map.',
    cnBody: '这里显示探针范围内最近的地震。点击任意一行可以跳转到该地震，并在地图上查看详情。',
  },
  {
    target: 'history',
    enTitle: 'Browse history',
    cnTitle: '浏览历史',
    enBody: 'Recently selected earthquakes are saved here, so you can quickly return to events you inspected earlier.',
    cnBody: '最近选择过的地震会保存在这里，方便你快速回到之前查看过的事件。',
    enNext: 'Open typhoons',
    cnNext: '进入台风页',
  },
  {
    target: 'typhoon-map',
    enTitle: 'Dedicated typhoon globe',
    cnTitle: '独立台风地球',
    enBody: 'Typhoons use a separate globe from earthquakes. Solid tracks are observed positions, dashed tracks are forecasts, and center colors indicate wind-force levels.',
    cnBody: '台风使用独立于地震的地球界面。实线是实况路径，虚线是预报路径，台风中心颜色表示风力级数。',
  },
  {
    target: 'typhoon-list',
    enTitle: 'Choose a system',
    cnTitle: '选择台风',
    enBody: 'Select any system from the past 30 days. The globe first rotates with fixed axes, then zooms to its latest position without rolling the view.',
    cnBody: '可选择最近 30 天内的任一台风。地球会先固定两轴旋转到目标方向，再放大到最新位置，视图不会侧滚。',
  },
  {
    target: 'typhoon-detail',
    enTitle: 'Intensity and position',
    cnTitle: '级数与位置',
    enBody: 'The selected-system panel shows the wind-force level, intensity, coordinates, wind speed, pressure, and observation time for the current playback position.',
    cnBody: '所选台风面板会显示当前回放位置的风力级数、强度、坐标、风速、气压和实况时间。',
  },
  {
    target: 'typhoon-forecast',
    enTitle: 'Future forecast',
    cnTitle: '未来路径预报',
    enBody: 'Active systems include forecast positions from the listed agency. Return to Live mode to see the dashed future route on the map.',
    cnBody: '活动台风会显示所列机构发布的未来预报点。回到“实时”模式即可在地图上查看虚线未来路径。',
  },
  {
    target: 'typhoon-timeline',
    enTitle: 'Rewind the track',
    cnTitle: '回拨台风路径',
    enBody: 'Drag the bottom time control or press Play. Storm centers move along their observed routes at the selected time; press Live to restore the latest tracks and forecasts.',
    cnBody: '拖动底部时间控件或点击播放，台风中心会沿实况路径移动到对应时刻；点击“实时”可恢复最新路径和预报。',
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
      if (current.target.endsWith('timeline')) cardTop = rect.top - cardH - 18;
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
            {done
              ? tr(language, 'Finish', '完成')
              : 'enNext' in current
                ? tr(language, current.enNext, current.cnNext)
                : tr(language, 'Next', '下一步')}
          </button>
        </div>
      </div>
    </div>
  );
}
