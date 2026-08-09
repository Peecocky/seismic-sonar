import { Euler, Quaternion, Vector3 } from 'three';
import type { Quake } from '@/lib/data';

export const EARTH_RADIUS = 2;
export const MARKER_ALTITUDE = 0.045;
export const KM_PER_RADIAN = 6371;

export interface GlobeProbePoint {
  lat: number;
  lon: number;
  normal: Vector3;
  position: Vector3;
}

export interface GlobeFocusTarget {
  id?: string;
  latitude: number;
  longitude: number;
  distance?: number;
}

export function latLonToVector3(
  latitude: number,
  longitude: number,
  radius: number = EARTH_RADIUS
): Vector3 {
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  const x = radius * Math.cos(lat) * Math.cos(lon);
  const y = radius * Math.sin(lat);
  const z = -radius * Math.cos(lat) * Math.sin(lon);
  return new Vector3(x, y, z);
}

export function vector3ToLatLon(point: Vector3) {
  const normal = point.clone().normalize();
  const latitude = (Math.asin(normal.y) * 180) / Math.PI;
  const longitude = (Math.atan2(-normal.z, normal.x) * 180) / Math.PI;
  return { latitude, longitude };
}

export function interpolateLatLon(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number },
  t: number
) {
  const startVector = latLonToVector3(start.latitude, start.longitude, 1).normalize();
  const endVector = latLonToVector3(end.latitude, end.longitude, 1).normalize();
  const vector = startVector.clone().lerp(endVector, t).normalize();
  return vector3ToLatLon(vector);
}

export function pointToProbe(point: Vector3): GlobeProbePoint {
  const position = point.clone().normalize().multiplyScalar(EARTH_RADIUS + MARKER_ALTITUDE);
  const normal = point.clone().normalize();
  const { latitude, longitude } = vector3ToLatLon(point);
  return {
    lat: latitude,
    lon: longitude,
    normal,
    position,
  };
}

export function angularDistance(a: Vector3, b: Vector3) {
  return Math.acos(clamp(a.dot(b), -1, 1));
}

export function angularDistanceKm(a: Vector3, b: Vector3) {
  return angularDistance(a, b) * KM_PER_RADIAN;
}

export function probeOrientation(normal: Vector3) {
  const up = new Vector3(0, 0, 1);
  const quaternion = new Quaternion().setFromUnitVectors(up, normal.clone().normalize());
  return new Euler().setFromQuaternion(quaternion);
}

export function quakeMarkerScale(magnitude: number) {
  return 0.014 + Math.max(0, magnitude - 4.5) * 0.011;
}

export function globeQuaternionForTarget(target: GlobeFocusTarget) {
  const longitudeRotation = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    -((target.longitude + 90) * Math.PI) / 180
  );
  const latitudeRotation = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    (target.latitude * Math.PI) / 180
  );
  return latitudeRotation.multiply(longitudeRotation);
}

export function quakeMarkerColor(magnitude: number, active: boolean) {
  if (active) return '#58d4f5';
  const t = clamp((magnitude - 4.5) / (7.8 - 4.5), 0, 1);
  return interpolateHex('#f7e5b8', '#f0bf59', '#e57d2f', '#bf3a26', '#64120e', t);
}

export function buildProbeDistances(
  quakes: Quake[],
  probe: GlobeProbePoint | null
): Map<string, number> {
  const distances = new Map<string, number>();
  if (!probe) return distances;
  for (const quake of quakes) {
    const normal = latLonToVector3(quake.lat, quake.lon, 1).normalize();
    distances.set(quake.id, angularDistanceKm(probe.normal, normal));
  }
  return distances;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function interpolateHex(a: string, b: string, c: string, d: string, e: string, t: number) {
  if (t <= 0.25) return blend(a, b, t / 0.25);
  if (t <= 0.5) return blend(b, c, (t - 0.25) / 0.25);
  if (t <= 0.75) return blend(c, d, (t - 0.5) / 0.25);
  return blend(d, e, (t - 0.75) / 0.25);
}

function blend(from: string, to: string, t: number) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}
