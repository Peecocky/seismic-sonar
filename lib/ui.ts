export type Language = 'en' | 'cn';
export type ThemeMode = 'day' | 'night';
export type ResolvedTheme = 'day' | 'night';

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode;
}

export function tr(language: Language, en: string, cn: string) {
  return language === 'cn' ? cn : en;
}
