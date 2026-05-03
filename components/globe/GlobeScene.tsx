'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Group, Quaternion, Vector3 } from 'three';
import type { Quake } from '@/lib/data';
import type { GlobeFocusTarget, GlobeProbePoint } from '@/lib/globe';
import { buildProbeDistances, globeQuaternionForTarget, pointToProbe } from '@/lib/globe';
import type { Language, ResolvedTheme } from '@/lib/ui';
import { tr } from '@/lib/ui';
import Earth from '@/components/globe/Earth';
import EarthquakeMarkers from '@/components/globe/EarthquakeMarkers';
import ProbeRings from '@/components/globe/ProbeRings';

const PIN_LONG_PRESS_MS = 460;
const PIN_DRAG_CANCEL_PX = 7;

interface GlobeSceneProps {
  quakes: Quake[];
  hoverId: string | null;
  selectedId: string | null;
  onHover: (quake: Quake | null) => void;
  onSelect: (quake: Quake | null) => void;
  onProbeChange: (probe: GlobeProbePoint | null, distances: Map<string, number>) => void;
  onProbeLockChange: (locked: boolean) => void;
  onManualOrbitStart: () => void;
  probeLocked: boolean;
  radiusKm: number;
  focusTarget: GlobeFocusTarget | null;
  alignSignal: number;
  theme: ResolvedTheme;
  language: Language;
}

export default function GlobeScene(props: GlobeSceneProps) {
  const isNight = props.theme === 'night';
  return (
    <div className="map-wrap globe-wrap">
      <Canvas camera={{ position: [0, 0, 9.2], fov: 27 }} dpr={[1, 1.8]}>
        <color attach="background" args={[isNight ? '#081110' : '#e9efec']} />
        <ambientLight intensity={isNight ? 0.9 : 1.45} />
        <directionalLight position={[4, 2, 5]} intensity={isNight ? 1.6 : 1.75} color="#fff2cf" />
        <directionalLight position={[-5, -3, -4]} intensity={isNight ? 0.45 : 0.35} color="#8bd7e8" />
        <SceneContent {...props} />
      </Canvas>
      <div className="globe-hud">
        <div className="mono-caps">
          {tr(props.language, '3D globe · drag to orbit · long-press to pin sonar · Align returns default view', '3D 地球 · 拖动旋转 · 长按固定声纳 · 对齐回到默认视角')}
        </div>
      </div>
      {props.hoverId && (
        <div className="map-hover-hint">
          {tr(props.language, 'Shift-click or hold to pin here', 'Shift 点击或长按可在此固定')}
        </div>
      )}
    </div>
  );
}

function SceneContent({
  quakes,
  hoverId,
  selectedId,
  onHover,
  onSelect,
  onProbeChange,
  onProbeLockChange,
  onManualOrbitStart,
  probeLocked,
  radiusKm,
  focusTarget,
  alignSignal,
  theme,
}: GlobeSceneProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const globeRef = useRef<Group | null>(null);
  const [probe, setProbe] = useState<GlobeProbePoint | null>(null);
  const [interacting, setInteracting] = useState(false);
  const [hoveringGlobe, setHoveringGlobe] = useState(false);
  const targetQuaternionRef = useRef(new Quaternion());
  const targetCameraPositionRef = useRef(new Vector3(0, 0, 9.2));
  const animatingFocusRef = useRef(false);
  const lastFocusIdRef = useRef<string | null>(null);
  const pinPressTimerRef = useRef<number | null>(null);
  const pinPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);
  const [pinPressActive, setPinPressActive] = useState(false);
  const { camera } = useThree();

  useEffect(() => {
    const nextFocusId = focusTarget?.id ?? null;
    if (nextFocusId !== lastFocusIdRef.current) {
      targetQuaternionRef.current.copy(focusTarget ? globeQuaternionForTarget(focusTarget) : new Quaternion());
      targetCameraPositionRef.current.set(0, 0, focusTarget?.distance ?? 9.2);
      controlsRef.current?.target.set(0, 0, 0);
      animatingFocusRef.current = true;
      lastFocusIdRef.current = nextFocusId;
    }
  }, [focusTarget]);

  useEffect(() => {
    targetQuaternionRef.current.identity();
    targetCameraPositionRef.current.set(0, 0, 9.2);
    controlsRef.current?.target.set(0, 0, 0);
    lastFocusIdRef.current = null;
    animatingFocusRef.current = true;
  }, [alignSignal]);

  useEffect(() => {
    return () => {
      if (pinPressTimerRef.current !== null) window.clearTimeout(pinPressTimerRef.current);
    };
  }, []);

  const setProbeState = (nextProbe: GlobeProbePoint | null, locked: boolean) => {
    setProbe(nextProbe);
    onProbeLockChange(locked);
    onProbeChange(nextProbe, nextProbe ? buildProbeDistances(quakes, nextProbe) : new Map());
  };

  const updateProbeFromPointer = (event: ThreeEvent<PointerEvent>) => {
    cancelPinPressIfDragged(event.nativeEvent.clientX, event.nativeEvent.clientY);
    if (probeLocked) return;
    setHoveringGlobe(true);
    const localPoint = globeRef.current ? globeRef.current.worldToLocal(event.point.clone()) : event.point.clone();
    const nextProbe = pointToProbe(localPoint);
    setProbe(nextProbe);
    onProbeChange(nextProbe, buildProbeDistances(quakes, nextProbe));
  };

  const pinProbeFromPointer = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
    const localPoint = globeRef.current ? globeRef.current.worldToLocal(event.point.clone()) : event.point.clone();
    setProbeState(pointToProbe(localPoint), true);
  };

  const pinProbeFromLocalPoint = (localPoint: Vector3) => {
    setProbeState(pointToProbe(localPoint), true);
  };

  const clearPinPress = () => {
    if (pinPressTimerRef.current !== null) {
      window.clearTimeout(pinPressTimerRef.current);
      pinPressTimerRef.current = null;
    }
    pinPressStartRef.current = null;
    if (!longPressTriggeredRef.current) setPinPressActive(false);
  };

  const startPinPress = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
    clearPinPress();
    longPressTriggeredRef.current = false;
    const localPoint = globeRef.current ? globeRef.current.worldToLocal(event.point.clone()) : event.point.clone();
    pinPressStartRef.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };
    setPinPressActive(true);
    pinPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      pinPressTimerRef.current = null;
      pinProbeFromLocalPoint(localPoint);
      window.setTimeout(() => setPinPressActive(false), 180);
    }, PIN_LONG_PRESS_MS);
  };

  const cancelPinPressIfDragged = (clientX: number, clientY: number) => {
    if (pinPressTimerRef.current === null || !pinPressStartRef.current) return;
    const dx = clientX - pinPressStartRef.current.x;
    const dy = clientY - pinPressStartRef.current.y;
    if (Math.hypot(dx, dy) > PIN_DRAG_CANCEL_PX) clearPinPress();
  };

  const shouldSuppressClick = () => {
    if (!longPressTriggeredRef.current) return false;
    longPressTriggeredRef.current = false;
    return true;
  };

  useFrame((_, delta) => {
    if (globeRef.current && animatingFocusRef.current) {
      globeRef.current.quaternion.slerp(targetQuaternionRef.current, 1 - Math.exp(-delta * 2.6));
    }

    const controls = controlsRef.current;
    if (!controls) return;

    if (animatingFocusRef.current) {
      camera.position.lerp(targetCameraPositionRef.current, 1 - Math.exp(-delta * 3));
      camera.lookAt(controls.target);

      const quaternionDone = globeRef.current
        ? 1 - Math.abs(globeRef.current.quaternion.dot(targetQuaternionRef.current)) < 0.002
        : true;
      const distanceDone = camera.position.distanceTo(targetCameraPositionRef.current) < 0.025;
      if (quaternionDone && distanceDone) {
        animatingFocusRef.current = false;
      }
    }

    controls.update();
  });

  return (
    <>
      <group ref={globeRef}>
        <Earth
          theme={theme}
          onPointerDown={(event) => startPinPress(event)}
          onPointerUp={clearPinPress}
          onPointerCancel={clearPinPress}
          onPointerMove={(event) => {
            updateProbeFromPointer(event);
          }}
          onPointerLeave={() => {
            clearPinPress();
            if (probeLocked) return;
            setHoveringGlobe(false);
            setProbe(null);
            onHover(null);
            onProbeChange(null, new Map());
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (event.nativeEvent.shiftKey) {
              pinProbeFromPointer(event);
              return;
            }
            if (shouldSuppressClick()) return;
            if (selectedId) {
              onSelect(null);
              return;
            }
            const localPoint = globeRef.current ? globeRef.current.worldToLocal(event.point.clone()) : event.point.clone();
            const nextProbe = pointToProbe(localPoint);
            setProbeState(probeLocked ? null : nextProbe, !probeLocked);
          }}
        />

        <EarthquakeMarkers
          quakes={quakes}
          hoverId={hoverId}
          selectedId={selectedId}
          onHover={(quake) => {
            setHoveringGlobe(Boolean(quake));
            onHover(quake);
          }}
          onSelect={(quake) => onSelect(quake)}
          onProbePoint={updateProbeFromPointer}
          onPinProbePoint={pinProbeFromPointer}
          onPinPressStart={startPinPress}
          onPinPressCancel={clearPinPress}
          shouldSuppressClick={shouldSuppressClick}
        />
        {probe && <ProbeRings position={probe.position} normal={probe.normal} locked={probeLocked} radiusKm={radiusKm} anchoring={pinPressActive} />}
      </group>

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={7}
        maxDistance={13.8}
        rotateSpeed={0.72}
        autoRotate={!interacting && !hoveringGlobe && !probeLocked && !focusTarget}
        autoRotateSpeed={0.28}
        onStart={() => {
          clearPinPress();
          setInteracting(true);
          animatingFocusRef.current = false;
          onManualOrbitStart();
        }}
        onEnd={() => setInteracting(false)}
      />
    </>
  );
}
