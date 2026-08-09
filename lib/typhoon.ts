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
