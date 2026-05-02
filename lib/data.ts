import type { Quake } from './audio';

export type { Quake };

export type DataWindowDays = 30 | 90 | 180 | 360;

const DATA_WINDOW_ENDPOINTS: Record<DataWindowDays, string> = {
  30: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson',
  90: buildQueryUrl(90),
  180: buildQueryUrl(180),
  360: buildQueryUrl(360),
};

export async function loadQuakes(windowDays: DataWindowDays = 30): Promise<Quake[]> {
  if (windowDays === 30) {
    try {
      const res = await fetch('/data/earthquakes.json', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        return normalizeQuakes(json.quakes ?? []);
      }
    } catch (_) {}
  }

  const live = await fetch(DATA_WINDOW_ENDPOINTS[windowDays], { cache: 'no-store' });
  const raw = await live.json();
  return normalizeQuakes(
    (raw.features || []).map((f: any) => ({
      id: f.id,
      mag: f.properties.mag,
      place: f.properties.place,
      time: f.properties.time,
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      depth: f.geometry.coordinates[2] || 0,
    }))
  );
}

export function magClass(mag: number): 'low' | 'mid' | 'high' {
  if (mag >= 6) return 'high';
  if (mag >= 5.2) return 'mid';
  return 'low';
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export function formatCoord(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}deg${ns}  ${Math.abs(lon).toFixed(2)}deg${ew}`;
}

function normalizeQuakes(input: any[]): Quake[] {
  return input
    .filter(
      (q) =>
        q &&
        Number.isFinite(q.mag) &&
        Number.isFinite(q.lon) &&
        Number.isFinite(q.lat) &&
        Number.isFinite(q.time)
    )
    .map((q) => ({
      id: String(q.id),
      mag: Number(q.mag),
      place: String(q.place ?? 'Unknown'),
      time: Number(q.time),
      lon: Number(q.lon),
      lat: Number(q.lat),
      depth: Number(q.depth ?? 0),
    }))
    .sort((a, b) => a.time - b.time);
}

function buildQueryUrl(windowDays: number): string {
  const end = new Date();
  const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    format: 'geojson',
    minmagnitude: '4.5',
    starttime: start.toISOString(),
    endtime: end.toISOString(),
    orderby: 'time-asc',
    limit: '20000',
  });
  return `https://earthquake.usgs.gov/fdsnws/event/1/query?${params.toString()}`;
}
