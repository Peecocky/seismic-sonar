'use client';

import { useEffect, useMemo, useState } from 'react';
import { downloadQuakes, formatTime, loadQuakesRange } from '@/lib/data';
import type { DownloadFormat, Quake } from '@/lib/data';
import type { Language } from '@/lib/ui';
import { tr } from '@/lib/ui';

interface Props {
  open: boolean;
  language: Language;
  onClose: () => void;
}

const FORMATS: DownloadFormat[] = ['csv', 'json', 'geojson'];

export default function DataDownloadDialog({ open, language, onClose }: Props) {
  const today = useMemo(() => toDateInput(new Date()), []);
  const initialStart = useMemo(() => toDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), []);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(today);
  const [minMagnitude, setMinMagnitude] = useState(4.5);
  const [format, setFormat] = useState<DownloadFormat>('csv');
  const [quakes, setQuakes] = useState<Quake[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const fetchRange = async () => {
    setLoading(true);
    setError(null);
    setHasFetched(false);
    try {
      const start = new Date(`${startDate}T00:00:00.000Z`);
      const end = new Date(`${endDate}T23:59:59.999Z`);
      if (!startDate || !endDate || start > end) {
        throw new Error(tr(language, 'Choose a valid date range.', '请选择有效的日期范围。'));
      }
      const result = await loadQuakesRange({ start, end, minMagnitude });
      setQuakes(result);
      setHasFetched(true);
    } catch (fetchError) {
      setQuakes([]);
      setError(fetchError instanceof Error ? fetchError.message : tr(language, 'Could not load data.', '无法拉取数据。'));
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    downloadQuakes(quakes, format, { startDate, endDate, minMagnitude });
  };

  return (
    <div className="download-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="download-dialog" role="dialog" aria-modal="true" aria-labelledby="download-title">
        <header className="download-head">
          <div>
            <span className="mono-tag">USGS DATA EXPORT</span>
            <h2 id="download-title">{tr(language, 'Earthquake data download', '地震数据下载')}</h2>
          </div>
          <button type="button" className="download-close" onClick={onClose} aria-label={tr(language, 'Close', '关闭')} title={tr(language, 'Close', '关闭')}>
            X
          </button>
        </header>

        <div className="download-form">
          <label>
            <span>{tr(language, 'Start date', '开始日期')}</span>
            <input type="date" value={startDate} max={endDate || today} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            <span>{tr(language, 'End date', '结束日期')}</span>
            <input type="date" value={endDate} min={startDate} max={today} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label>
            <span>{tr(language, 'Minimum magnitude', '最低震级')}</span>
            <input type="number" min={0} max={10} step={0.1} value={minMagnitude} onChange={(event) => setMinMagnitude(Number(event.target.value))} />
          </label>
        </div>

        <div className="download-format">
          <span>{tr(language, 'File format', '文件格式')}</span>
          <div className="segmented download-segmented">
            {FORMATS.map((item) => (
              <button key={item} type="button" className={`segmented-btn ${format === item ? 'active' : ''}`} onClick={() => setFormat(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="download-actions">
          <button type="button" className="btn on" onClick={fetchRange} disabled={loading}>
            {loading ? tr(language, 'Fetching...', '正在拉取...') : tr(language, 'Fetch data', '拉取数据')}
          </button>
          <button type="button" className="btn" onClick={download} disabled={!hasFetched || quakes.length === 0}>
            {tr(language, `Download ${format.toUpperCase()}`, `下载 ${format.toUpperCase()}`)}
          </button>
          <span className="download-source">{tr(language, 'Source: USGS Earthquake Hazards Program', '来源：USGS 地震灾害计划')}</span>
        </div>

        {error && <div className="download-error">{error}</div>}
        {hasFetched && (
          <div className="download-preview">
            <div className="download-preview-head">
              <strong>{tr(language, 'Preview', '数据预览')}</strong>
              <span>{tr(language, `${quakes.length.toLocaleString()} events ready`, `已整理 ${quakes.length.toLocaleString()} 条记录`)}</span>
            </div>
            {quakes.length > 0 ? (
              <div className="download-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{tr(language, 'Time (UTC)', '时间（UTC）')}</th>
                      <th>{tr(language, 'Magnitude', '震级')}</th>
                      <th>{tr(language, 'Place', '地点')}</th>
                      <th>{tr(language, 'Depth', '深度')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quakes.slice(0, 6).map((quake) => (
                      <tr key={quake.id}>
                        <td>{formatTime(quake.time).slice(0, 16)}</td>
                        <td>M{quake.mag.toFixed(1)}</td>
                        <td>{quake.place}</td>
                        <td>{quake.depth.toFixed(1)} km</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="panel-note">{tr(language, 'No earthquakes match this range.', '该时间范围内没有符合条件的地震。')}</div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}
