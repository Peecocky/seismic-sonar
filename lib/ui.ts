export type Language = 'en' | 'cn';
export type ThemeMode = 'auto' | 'day' | 'night';
export type ResolvedTheme = 'day' | 'night';

export function resolveTheme(mode: ThemeMode, time = new Date()): ResolvedTheme {
  if (mode === 'day' || mode === 'night') return mode;
  const hour = time.getHours();
  return hour >= 6 && hour < 18 ? 'day' : 'night';
}

export function tr(language: Language, en: string, cn: string) {
  return language === 'cn' ? cn : en;
}
