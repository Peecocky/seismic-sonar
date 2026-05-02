'use client';

import type { Quake } from '@/lib/data';
import type { GlobeFocusTarget, GlobeProbePoint } from '@/lib/globe';
import type { Language, ResolvedTheme } from '@/lib/ui';
import GlobeScene from '@/components/globe/GlobeScene';
import FlatMap from '@/components/FlatMap';

interface Props {
  quakes: Quake[];
  onHover: (q: Quake | null) => void;
  onSelect: (q: Quake | null) => void;
  onProbe: (probe: GlobeProbePoint | null, distances: Map<string, number>) => void;
  onProbeLockChange: (locked: boolean) => void;
  onManualOrbitStart: () => void;
  selectedId: string | null;
  hoverId: string | null;
  radius: number;
  probeLocked: boolean;
  focusTarget: GlobeFocusTarget | null;
  alignSignal: number;
  mapMode: '3d' | '2d';
  theme: ResolvedTheme;
  language: Language;
}

export default function GeoMap({
  quakes,
  onHover,
  onSelect,
  onProbe,
  onProbeLockChange,
  onManualOrbitStart,
  selectedId,
  hoverId,
  radius,
  probeLocked,
  focusTarget,
  alignSignal,
  mapMode,
  theme,
  language,
}: Props) {
  if (mapMode === '2d') {
    return (
      <FlatMap
        quakes={quakes}
        onHover={onHover}
        onSelect={onSelect}
        onProbe={onProbe}
        onProbeLockChange={onProbeLockChange}
        selectedId={selectedId}
        hoverId={hoverId}
        radiusKm={radius}
        probeLocked={probeLocked}
        language={language}
      />
    );
  }

  return (
    <GlobeScene
      quakes={quakes}
      hoverId={hoverId}
      selectedId={selectedId}
      onHover={onHover}
      onSelect={onSelect}
      onProbeChange={onProbe}
      onProbeLockChange={onProbeLockChange}
      onManualOrbitStart={onManualOrbitStart}
      probeLocked={probeLocked}
      radiusKm={radius}
      focusTarget={focusTarget}
      alignSignal={alignSignal}
      theme={theme}
      language={language}
    />
  );
}
