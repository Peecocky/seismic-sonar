'use client';

import type { Typhoon } from '@/lib/typhoon';
import { typhoonDisplayName } from '@/lib/typhoon';
import type { Language } from '@/lib/ui';
import { tr } from '@/lib/ui';

interface Props {
  typhoons: Typhoon[];
  loading: boolean;
  error: string | null;
  selected: Typhoon | null;
  onSelect: (typhoon: Typhoon) => void;
  language: Language;
}

export default function TyphoonPanel({ typhoons, loading, error, selected, onSelect, language }: Props) {
  const activeCount = typhoons.filter((typhoon) => typhoon.isActive).length;
  const latest = selected?.points[selected.points.length - 1] ?? null;
  const forecastPoints = selected?.forecast?.points.slice(1) ?? [];

  return (
    <aside className="side typhoon-side">
      <section className="section compact">
        <h3>{tr(language, 'Typhoon Monitor', '台风监测')}</h3>
        <div className="typhoon-stat-grid">
          <div>
            <span>{tr(language, 'Past 30 days', '最近 30 天')}</span>
            <strong>{typhoons.length}</strong>
          </div>
          <div>
            <span>{tr(language, 'Active now', '当前活动')}</span>
            <strong className={activeCount > 0 ? 'active' : ''}>{activeCount}</strong>
          </div>
        </div>
        <div className="typhoon-legend">
          <span><i className="actual" />{tr(language, 'Observed track', '实况路径')}</span>
          <span><i className="forecast" />{tr(language, 'China forecast', '中国预报')}</span>
        </div>
      </section>

      <section className="section compact">
        <h3>{tr(language, 'Recent Systems', '近期台风')}</h3>
        {loading ? (
          <div className="panel-note">{tr(language, 'Loading tropical cyclone tracks...', '正在加载台风路径...')}</div>
        ) : error ? (
          <div className="panel-note error-note">{tr(language, 'Typhoon feed is temporarily unavailable.', '台风数据暂时不可用。')}</div>
        ) : typhoons.length === 0 ? (
          <div className="panel-note">{tr(language, 'No tropical cyclones recorded in the last 30 days.', '最近 30 天没有台风记录。')}</div>
        ) : (
          <div className="typhoon-list typhoon-list-full">
            {typhoons.map((typhoon) => {
              const point = typhoon.points[typhoon.points.length - 1];
              return (
                <button
                  key={typhoon.id}
                  type="button"
                  className={`typhoon-row ${selected?.id === typhoon.id ? 'selected' : ''}`}
                  onClick={() => onSelect(typhoon)}
                >
                  <span className="typhoon-row-head">
                    <strong>{typhoonDisplayName(typhoon)}</strong>
                    <i className={typhoon.isActive ? 'active' : ''}>{typhoon.isActive ? tr(language, 'Active', '活动中') : tr(language, 'Ended', '已结束')}</i>
                  </span>
                  <span>{point?.strength || tr(language, 'Tropical cyclone', '热带气旋')} · {point?.windSpeed ?? '--'} m/s · {point?.pressure ?? '--'} hPa</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="section compact typhoon-detail">
        <h3>{tr(language, 'Selected System', '所选台风')}</h3>
        {selected && latest ? (
          <>
            <div className="typhoon-detail-title">
              <span className={selected.isActive ? 'active' : ''}>{selected.isActive ? tr(language, 'Active', '活动中') : tr(language, 'Ended', '已结束')}</span>
              <strong>{typhoonDisplayName(selected)}</strong>
              <small>{latest.strength || tr(language, 'Tropical cyclone', '热带气旋')}</small>
            </div>
            <div className="readout">
              <div className="row"><span className="k">{tr(language, 'Latest position', '最新位置')}</span><span className="v">{formatPosition(latest.lat, latest.lon)}</span></div>
              <div className="row"><span className="k">{tr(language, 'Wind speed', '最大风速')}</span><span className="v">{latest.windSpeed ?? '--'} m/s</span></div>
              <div className="row"><span className="k">{tr(language, 'Pressure', '中心气压')}</span><span className="v">{latest.pressure ?? '--'} hPa</span></div>
              <div className="row"><span className="k">{tr(language, 'Observed points', '实况点数')}</span><span className="v">{selected.points.length}</span></div>
              <div className="row"><span className="k">{tr(language, 'Last observed', '最新实况')}</span><span className="v">{formatDate(latest.time)}</span></div>
            </div>
          </>
        ) : (
          <div className="panel-note">{tr(language, 'Select a system to inspect its track and forecast.', '选择一个台风以查看路径和预报。')}</div>
        )}
      </section>

      <section className="section compact">
        <h3>{tr(language, 'Future Forecast', '未来路径预报')}</h3>
        {selected?.forecast && forecastPoints.length > 0 ? (
          <>
            <div className="forecast-agency">
              <span>{tr(language, 'Agency', '预报机构')}</span>
              <strong>{selected.forecast.agency}</strong>
            </div>
            <div className="forecast-route-list">
              {forecastPoints.map((point, index) => (
                <div key={`${point.time}-${index}`} className="forecast-route-row">
                  <i />
                  <span>
                    <strong>{formatDate(point.time)}</strong>
                    <small>{point.strength || tr(language, 'Tropical cyclone', '热带气旋')}</small>
                  </span>
                  <em>{point.windSpeed ?? '--'} m/s<br />{formatPosition(point.lat, point.lon)}</em>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="panel-note">
            {selected?.isActive
              ? tr(language, 'No future forecast is available yet.', '暂时没有未来预报点。')
              : tr(language, 'Forecasts are shown only for active systems.', '仅活动台风显示未来路径预报。')}
          </div>
        )}
      </section>

      <section className="section compact">
        <div className="panel-note">{tr(language, 'Source: Zhejiang Provincial Water Resources Department · refreshed every 10 minutes', '来源：浙江省水利厅 · 每 10 分钟刷新')}</div>
      </section>
    </aside>
  );
}

function formatDate(time: number) {
  return new Date(time).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatPosition(lat: number, lon: number) {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
}
