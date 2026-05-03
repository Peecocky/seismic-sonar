import type { Quake } from '@/lib/data';
import { KM_PER_RADIAN } from '@/lib/globe';

export const FORECAST_WINDOWS = [30, 90, 180, 360] as const;
export type ForecastWindowDays = (typeof FORECAST_WINDOWS)[number];
export const PREDICTION_HORIZONS = [7, 30, 180, 360] as const;
export type PredictionHorizonDays = (typeof PREDICTION_HORIZONS)[number];

export interface ForecastWindowStat {
  days: ForecastWindowDays;
  count: number;
  intensityCount: number;
  ratePerDay: number;
  intensityRatePerDay: number;
  probability7d: number;
  probability30d: number;
  intensityProbability7d: number;
  intensityProbability30d: number;
}

export interface LocalForecast {
  center: { lat: number; lon: number };
  radiusKm: number;
  minMagnitude: number;
  nearbyCount: number;
  intensityCount: number;
  stats: ForecastWindowStat[];
  predictionHorizonStats: Array<{
    days: PredictionHorizonDays;
    probability: number;
    intensityProbability: number;
  }>;
  blendedProbability7d: number;
  blendedProbability30d: number;
  blendedIntensityProbability7d: number;
  blendedIntensityProbability30d: number;
  confidence: 'low' | 'medium' | 'high';
}

export function buildLocalForecast(
  quakes: Quake[],
  center: { lat: number; lon: number },
  radiusKm: number,
  minMagnitude: number,
  now = Date.now()
): LocalForecast {
  const nearby = quakes.filter(
    (quake) =>
      quake.mag >= minMagnitude &&
      quake.time <= now &&
      haversineKm(center.lat, center.lon, quake.lat, quake.lon) <= radiusKm
  );

  const stats = FORECAST_WINDOWS.map((days) => {
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const windowQuakes = nearby.filter((quake) => quake.time >= cutoff);
    const count = windowQuakes.length;
    const intensityCount = windowQuakes.filter((quake) => quake.mag >= 6).length;
    const ratePerDay = count / days;
    const intensityRatePerDay = intensityCount / days;
    return {
      days,
      count,
      intensityCount,
      ratePerDay,
      intensityRatePerDay,
      probability7d: poissonAtLeastOne(ratePerDay, 7),
      probability30d: poissonAtLeastOne(ratePerDay, 30),
      intensityProbability7d: poissonAtLeastOne(intensityRatePerDay, 7),
      intensityProbability30d: poissonAtLeastOne(intensityRatePerDay, 30),
    };
  });

  const weights = [0.42, 0.28, 0.18, 0.12];
  const blendedRate = stats.reduce((sum, stat, index) => sum + stat.ratePerDay * weights[index], 0);
  const blendedIntensityRate = stats.reduce((sum, stat, index) => sum + stat.intensityRatePerDay * weights[index], 0);
  const totalEvidence = stats[stats.length - 1]?.count ?? 0;
  const longWindow = stats[stats.length - 1];
  const predictionHorizonStats = PREDICTION_HORIZONS.map((days) => ({
    days,
    probability: poissonAtLeastOne(longWindow.ratePerDay, days),
    intensityProbability: poissonAtLeastOne(longWindow.intensityRatePerDay, days),
  }));

  return {
    center,
    radiusKm,
    minMagnitude,
    nearbyCount: nearby.length,
    intensityCount: nearby.filter((quake) => quake.mag >= 6).length,
    stats,
    predictionHorizonStats,
    blendedProbability7d: poissonAtLeastOne(blendedRate, 7),
    blendedProbability30d: poissonAtLeastOne(blendedRate, 30),
    blendedIntensityProbability7d: poissonAtLeastOne(blendedIntensityRate, 7),
    blendedIntensityProbability30d: poissonAtLeastOne(blendedIntensityRate, 30),
    confidence: totalEvidence >= 30 ? 'high' : totalEvidence >= 8 ? 'medium' : 'low',
  };
}

export function formatProbability(value: number) {
  if (value < 0.001) return '<0.1%';
  return `${Math.round(value * 1000) / 10}%`;
}

function poissonAtLeastOne(ratePerDay: number, horizonDays: number) {
  return 1 - Math.exp(-ratePerDay * horizonDays);
}

function haversineKm(latA: number, lonA: number, latB: number, lonB: number) {
  const toRad = Math.PI / 180;
  const phiA = latA * toRad;
  const phiB = latB * toRad;
  const dPhi = (latB - latA) * toRad;
  const dLambda = (lonB - lonA) * toRad;
  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phiA) * Math.cos(phiB) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * KM_PER_RADIAN;
}
