export interface TyphoonPoint {
  time: number;
  lon: number;
  lat: number;
  strength: string;
  power: number | null;
  windSpeed: number | null;
  pressure: number | null;
}

export interface TyphoonForecast {
  agency: string;
  issuedAt: number | null;
  points: TyphoonPoint[];
}

export interface Typhoon {
  id: string;
  name: string;
  enName: string;
  isActive: boolean;
  startTime: number;
  endTime: number;
  points: TyphoonPoint[];
  forecast: TyphoonForecast | null;
}

export interface TyphoonTrackState {
  points: TyphoonPoint[];
  center: TyphoonPoint | null;
}

export async function loadTyphoons(): Promise<Typhoon[]> {
  const response = await fetch('/api/typhoons', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Typhoon request failed (${response.status}).`);
  const body = await response.json();
  return Array.isArray(body.typhoons) ? body.typhoons : [];
}

export function typhoonDisplayName(typhoon: Typhoon) {
  if (typhoon.enName && typhoon.enName !== 'NAMELESS') return `${typhoon.name} / ${typhoon.enName}`;
  return typhoon.name;
}

export function typhoonTrackAtTime(typhoon: Typhoon, displayTime: number | null): TyphoonTrackState {
  const points = typhoon.points;
  if (points.length === 0) return { points: [], center: null };
  if (displayTime === null) return { points, center: points[points.length - 1] };
  if (displayTime < points[0].time) return { points: [], center: null };

  const nextIndex = points.findIndex((point) => point.time > displayTime);
  if (nextIndex === -1) {
    const latest = points[points.length - 1];
    return {
      points,
      center: typhoon.isActive || displayTime <= latest.time ? latest : null,
    };
  }

  const previous = points[nextIndex - 1];
  const next = points[nextIndex];
  const fraction = Math.min(1, Math.max(0, (displayTime - previous.time) / Math.max(1, next.time - previous.time)));
  const center = interpolateTyphoonPoint(previous, next, fraction, displayTime);
  const visiblePoints = points.slice(0, nextIndex);
  if (fraction > 0) visiblePoints.push(center);
  return { points: visiblePoints, center };
}

export function typhoonLevel(point: Pick<TyphoonPoint, 'power'> | null) {
  return point?.power === null || point?.power === undefined ? '--' : `L${point.power}`;
}

export function typhoonLevelColor(power: number | null) {
  if (power === null) return '#7b929b';
  if (power <= 7) return '#57c7d4';
  if (power <= 9) return '#15a6b8';
  if (power <= 11) return '#f0b44c';
  if (power <= 13) return '#f27843';
  return '#f05a78';
}

function interpolateTyphoonPoint(
  start: TyphoonPoint,
  end: TyphoonPoint,
  fraction: number,
  time: number
): TyphoonPoint {
  let longitudeDelta = end.lon - start.lon;
  if (longitudeDelta > 180) longitudeDelta -= 360;
  if (longitudeDelta < -180) longitudeDelta += 360;
  const longitude = normalizeLongitude(start.lon + longitudeDelta * fraction);
  const nearest = fraction < 0.5 ? start : end;
  return {
    time,
    lon: longitude,
    lat: start.lat + (end.lat - start.lat) * fraction,
    strength: nearest.strength,
    power: nearest.power,
    windSpeed: interpolateNullable(start.windSpeed, end.windSpeed, fraction),
    pressure: interpolateNullable(start.pressure, end.pressure, fraction),
  };
}

function interpolateNullable(start: number | null, end: number | null, fraction: number) {
  if (start === null) return end;
  if (end === null) return start;
  return Math.round((start + (end - start) * fraction) * 10) / 10;
}

function normalizeLongitude(longitude: number) {
  return ((longitude + 540) % 360) - 180;
}
