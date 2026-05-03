'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, MeshBasicMaterial } from 'three';
import type { Euler, Vector3 } from 'three';
import { probeOrientation } from '@/lib/globe';

interface ProbeRingsProps {
  position: Vector3;
  normal: Vector3;
  locked: boolean;
  radiusKm: number;
  anchoring?: boolean;
}

const BASE_COLORS = ['#ffd859', '#ff7a3d', '#fff3a6'];
const ANCHOR_COLORS = ['#b22e14', '#9c2416', '#d05522'];
const ANCHOR_DURATION = 0.46;

export default function ProbeRings({ position, normal, locked, radiusKm, anchoring = false }: ProbeRingsProps) {
  const rotation = useMemo<Euler>(() => probeOrientation(normal), [normal]);
  const outerMaterialRef = useRef<MeshBasicMaterial | null>(null);
  const middleMaterialRef = useRef<MeshBasicMaterial | null>(null);
  const innerMaterialRef = useRef<MeshBasicMaterial | null>(null);
  const anchorStartRef = useRef<number | null>(null);
  const kmScale = Math.min(0.62, Math.max(0.18, radiusKm / 8000));
  const outer = kmScale;
  const middle = kmScale * 0.66;
  const inner = kmScale * 0.33;

  useFrame(({ clock }) => {
    const refs = [innerMaterialRef, middleMaterialRef, outerMaterialRef];
    if (!anchoring) {
      anchorStartRef.current = null;
      refs.forEach((ref, index) => {
        const material = ref.current;
        if (!material) return;
        material.color.lerpColors(new Color(BASE_COLORS[2 - index]), new Color(BASE_COLORS[2 - index]), 1);
      });
      return;
    }

    if (anchorStartRef.current === null) anchorStartRef.current = clock.elapsedTime;
    const elapsed = (clock.elapsedTime - anchorStartRef.current) % ANCHOR_DURATION;
    const progress = elapsed / ANCHOR_DURATION;
    refs.forEach((ref, index) => {
      const material = ref.current;
      if (!material) return;
      const delay = index * 0.2;
      const local = Math.max(0, Math.min(1, (progress - delay) / 0.44));
      const pulse = local <= 0 || local >= 1 ? 0 : 1 - Math.abs(local * 2 - 1);
      material.color.lerpColors(new Color(BASE_COLORS[2 - index]), new Color(ANCHOR_COLORS[2 - index]), pulse);
      material.opacity = (index === 0 ? (locked ? 0.86 : 0.7) : index === 1 ? (locked ? 0.5 : 0.38) : (locked ? 0.26 : 0.2)) + pulse * 0.18;
    });
  });

  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <ringGeometry args={[outer - 0.024, outer, 96]} />
        <meshBasicMaterial ref={outerMaterialRef} color={BASE_COLORS[0]} transparent opacity={locked ? 0.26 : 0.2} depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[middle - 0.026, middle, 96]} />
        <meshBasicMaterial ref={middleMaterialRef} color={BASE_COLORS[1]} transparent opacity={locked ? 0.5 : 0.38} depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[inner - 0.028, inner, 96]} />
        <meshBasicMaterial ref={innerMaterialRef} color={BASE_COLORS[2]} transparent opacity={locked ? 0.86 : 0.7} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.003]}>
        <circleGeometry args={[0.024, 32]} />
        <meshBasicMaterial color="#fff7c7" transparent opacity={1} depthWrite={false} />
      </mesh>
    </group>
  );
}
