import type { Quake } from './audio';

export type { Quake };

export type DataWindowDays = 30 | 90 | 180 | 360;
export type DownloadFormat = 'csv' | 'json' | 'geojson';

const USGS_QUERY_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const USGS_PAGE_SIZE = 20_000;
const MAX_DOWNLOAD_EVENTS = 100_000;

export interface QuakeRange {
  start: Date;
  end: Date;
  minMagnitude?: number;
}

export async function loadQuakes(windowDays: DataWindowDays = 30): Promise<Quake[]> {
  const end = new Date();
  const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);
  return loadQuakesRange({ start, end, minMagnitude: 4.5 });
}

export async function loadQuakesRange({ start, end, minMagnitude = 4.5 }: QuakeRange): Promise<Quake[]> {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new Error('Invalid date range.');
  }
  if (start >= end) throw new Error('The start date must be before the end date.');
  if (!Number.isFinite(minMagnitude) || minMagnitude < 0 || minMagnitude > 10) {
    throw new Error('Magnitude must be between 0 and 10.');
  }

  const quakes: Quake[] = [];
  let offset = 1;

  while (quakes.length < MAX_DOWNLOAD_EVENTS) {
    const response = await fetch(buildQueryUrl(start, end, minMagnitude, offset), { cache: 'no-store' });
    if (!response.ok) throw new Error(`USGS request failed (${response.status}).`);

    const raw = await response.json();
    const page = normalizeQuakes((raw.features || []).map(normalizeFeature));
    quakes.push(...page);

    if (page.length < USGS_PAGE_SIZE) break;
    offset += USGS_PAGE_SIZE;
  }

  return normalizeQuakes(quakes);
}

export function downloadQuakes(
  quakes: Quake[],
  format: DownloadFormat,
  range: { startDate: string; endDate: string; minMagnitude: number }
) {
  const fileStem = `earthquakes_${range.startDate}_${range.endDate}_M${range.minMagnitude.toFixed(1)}`;
  let content: string;
  let mimeType: string;

  if (format === 'csv') {
    const headers = ['time_utc', 'magnitude', 'place', 'latitude', 'longitude', 'depth_km', 'event_id'];
    const rows = quakes.map((quake) => [
      new Date(quake.time).toISOString(),
      quake.mag.toFixed(1),
      quake.place,
      quake.lat.toFixed(4),
      quake.lon.toFixed(4),
      quake.depth.toFixed(1),
      quake.id,
    ]);
    content = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    mimeType = 'text/csv;charset=utf-8';
  } else if (format === 'geojson') {
    content = JSON.stringify(
      {
        type: 'FeatureCollection',
        metadata: buildDownloadMetadata(quakes, range),
        features: quakes.map((quake) => ({
          type: 'Feature',
          id: quake.id,
          properties: {
            magnitude: quake.mag,
            place: quake.place,
            time: new Date(quake.time).toISOString(),
            depth_km: quake.depth,
          },
          geometry: {
            type: 'Point',
            coordinates: [quake.lon, quake.lat, quake.depth],
          },
        })),
      },
      null,
      2
    );
    mimeType = 'application/geo+json;charset=utf-8';
  } else {
    content = JSON.stringify(
      {
        metadata: buildDownloadMetadata(quakes, range),
        earthquakes: quakes.map((quake) => ({
          id: quake.id,
          time_utc: new Date(quake.time).toISOString(),
          magnitude: quake.mag,
          place: quake.place,
          latitude: quake.lat,
          longitude: quake.lon,
          depth_km: quake.depth,
        })),
      },
      null,
      2
    );
    mimeType = 'application/json;charset=utf-8';
  }

  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileStem}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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

function normalizeFeature(feature: any) {
  return {
    id: feature.id,
    mag: feature.properties?.mag,
    place: feature.properties?.place,
    time: feature.properties?.time,
    lon: feature.geometry?.coordinates?.[0],
    lat: feature.geometry?.coordinates?.[1],
    depth: feature.geometry?.coordinates?.[2] ?? 0,
  };
}

function normalizeQuakes(input: any[]): Quake[] {
  const seenIds = new Set<string>();
  return input
    .filter(
      (quake) =>
        quake &&
        Number.isFinite(quake.mag) &&
        Number.isFinite(quake.lon) &&
        Number.isFinite(quake.lat) &&
        Number.isFinite(quake.time)
    )
    .map((quake) => ({
      id: String(quake.id),
      mag: Number(quake.mag),
      place: String(quake.place ?? 'Unknown'),
      time: Number(quake.time),
      lon: Number(quake.lon),
      lat: Number(quake.lat),
      depth: Number(quake.depth ?? 0),
    }))
    .filter((quake) => {
      if (seenIds.has(quake.id)) return false;
      seenIds.add(quake.id);
      return true;
    })
    .sort((a, b) => a.time - b.time);
}

function buildQueryUrl(start: Date, end: Date, minMagnitude: number, offset: number) {
  const params = new URLSearchParams({
    format: 'geojson',
    minmagnitude: String(minMagnitude),
    starttime: start.toISOString(),
    endtime: end.toISOString(),
    orderby: 'time-asc',
    limit: String(USGS_PAGE_SIZE),
    offset: String(offset),
  });
  return `${USGS_QUERY_URL}?${params.toString()}`;
}

function buildDownloadMetadata(
  quakes: Quake[],
  range: { startDate: string; endDate: string; minMagnitude: number }
) {
  return {
    generated_at_utc: new Date().toISOString(),
    source: 'USGS Earthquake Hazards Program',
    start_date: range.startDate,
    end_date: range.endDate,
    minimum_magnitude: range.minMagnitude,
    event_count: quakes.length,
  };
}

function csvCell(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}
