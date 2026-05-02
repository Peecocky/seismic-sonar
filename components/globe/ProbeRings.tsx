'use client';

import { useMemo } from 'react';
import type { Euler, Vector3 } from 'three';
import { probeOrientation } from '@/lib/globe';

interface ProbeRingsProps {
  position: Vector3;
  normal: Vector3;
  locked: boolean;
  radiusKm: number;
}

export default function ProbeRings({ position, normal, locked, radiusKm }: ProbeRingsProps) {
  const rotation = useMemo<Euler>(() => probeOrientation(normal), [normal]);
  const kmScale = Math.min(0.62, Math.max(0.18, radiusKm / 8000));
  const outer = kmScale;
  const middle = kmScale * 0.66;
  const inner = kmScale * 0.33;

  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <ringGeometry args={[outer - 0.024, outer, 96]} />
        <meshBasicMaterial color="#ffd859" transparent opacity={locked ? 0.26 : 0.2} depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[middle - 0.026, middle, 96]} />
        <meshBasicMaterial color="#ff7a3d" transparent opacity={locked ? 0.5 : 0.38} depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[inner - 0.028, inner, 96]} />
        <meshBasicMaterial color="#fff3a6" transparent opacity={locked ? 0.86 : 0.7} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.003]}>
        <circleGeometry args={[0.024, 32]} />
        <meshBasicMaterial color="#fff7c7" transparent opacity={1} depthWrite={false} />
      </mesh>
    </group>
  );
}
