import { NextResponse } from 'next/server';
import type { Typhoon, TyphoonForecast, TyphoonPoint } from '@/lib/typhoon';

const SOURCE_ROOT = 'https://typhoon.slt.zj.gov.cn/Api';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const dynamic = 'force-dynamic';

interface SourceTyphoonListItem {
  tfid: string;
  name: string;
  enname: string;
  starttime: string;
  endtime: string;
  isactive: string;
}

export async function GET() {
  try {
    const now = new Date();
    const years = Array.from(new Set([now.getUTCFullYear(), new Date(now.getTime() - THIRTY_DAYS_MS).getUTCFullYear()]));
    const lists = await Promise.all(years.map(fetchTyphoonList));
    const cutoff = now.getTime() - THIRTY_DAYS_MS;
    const recent = [...new Map(lists.flat().map((item) => [item.tfid, item])).values()].filter(
      (item) => parseChinaTime(item.endtime) >= cutoff || item.isactive === '1'
    );

    const typhoons = (await Promise.all(recent.map(fetchTyphoonInfo)))
      .filter((item): item is Typhoon => item !== null)
      .sort((a, b) => b.endTime - a.endTime);

    return NextResponse.json(
      {
        generatedAt: Date.now(),
        windowDays: 30,
        source: 'Zhejiang Provincial Water Resources Department typhoon service',
        typhoons,
      },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Typhoon feed unavailable.', typhoons: [] },
      { status: 502 }
    );
  }
}

async function fetchTyphoonList(year: number): Promise<SourceTyphoonListItem[]> {
  const response = await fetch(`${SOURCE_ROOT}/TyphoonList/${year}`, { next: { revalidate: 300 } });
  if (!response.ok) throw new Error(`Typhoon list request failed (${response.status}).`);
  return response.json();
}

async function fetchTyphoonInfo(summary: SourceTyphoonListItem): Promise<Typhoon | null> {
  const response = await fetch(`${SOURCE_ROOT}/TyphoonInfo/${summary.tfid}`, { next: { revalidate: 300 } });
  if (!response.ok) return null;

  const details = await response.json();
  const points = (details.points || []).map(normalizePoint).filter(isValidPoint).sort((a: TyphoonPoint, b: TyphoonPoint) => a.time - b.time);
  if (points.length === 0) return null;

  const isActive = String(details.isactive ?? summary.isactive) === '1';
  const latestPoint = details.points?.[details.points.length - 1];
  const forecasts = (latestPoint?.forecast || []).map(normalizeForecast).filter((item: TyphoonForecast | null): item is TyphoonForecast => item !== null);
  const sourceForecast = forecasts.find((item: TyphoonForecast) => item.agency === '中国') ?? forecasts[0] ?? null;
  const futurePoints = sourceForecast?.points.filter((point) => point.time > Date.now()) ?? [];
  const forecast = isActive && sourceForecast && futurePoints.length > 0
    ? { ...sourceForecast, points: [points[points.length - 1], ...futurePoints] }
    : null;

  return {
    id: String(summary.tfid),
    name: String(details.name || summary.name || '未命名'),
    enName: String(details.enname || summary.enname || ''),
    isActive,
    startTime: parseChinaTime(details.starttime || summary.starttime),
    endTime: parseChinaTime(details.endtime || summary.endtime),
    points,
    forecast,
  };
}

function normalizeForecast(input: any): TyphoonForecast | null {
  const points = (input.forecastpoints || []).map(normalizePoint).filter(isValidPoint).sort((a: TyphoonPoint, b: TyphoonPoint) => a.time - b.time);
  if (points.length < 2) return null;
  const issuedAtRaw = input.forecastpoints?.find((point: any) => point.ybsj)?.ybsj;
  const issuedAt = issuedAtRaw ? new Date(issuedAtRaw).getTime() : null;
  return {
    agency: String(input.tm || 'Unknown'),
    issuedAt: Number.isFinite(issuedAt) ? issuedAt : null,
    points,
  };
}

function normalizePoint(input: any): TyphoonPoint {
  return {
    time: parseChinaTime(input.time),
    lon: Number(input.lng),
    lat: Number(input.lat),
    strength: String(input.strong || '').trim(),
    power: nullableNumber(input.power),
    windSpeed: nullableNumber(input.speed),
    pressure: nullableNumber(input.pressure),
  };
}

function isValidPoint(point: TyphoonPoint) {
  return Number.isFinite(point.time) && Number.isFinite(point.lon) && Number.isFinite(point.lat);
}

function nullableNumber(value: unknown) {
  const number = Number(value);
  return value === '' || value === null || value === undefined || !Number.isFinite(number) ? null : number;
}

function parseChinaTime(value: string) {
  if (!value) return Number.NaN;
  if (value.includes('T')) return new Date(value).getTime();
  return new Date(`${value.replace(' ', 'T')}+08:00`).getTime();
}
