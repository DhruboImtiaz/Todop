import type { AppFontSize, Settings } from '../types';

export const FONT_SIZES = ['xs', 'small', 'medium', 'large'] as const satisfies readonly AppFontSize[];
export const FONT_SIZE_OPTIONS = {
  xs: { label: 'Extra small', scale: 60 },
  small: { label: 'Small', scale: 70 },
  medium: { label: 'Medium', scale: 80 },
  large: { label: 'Large', scale: 90 },
} as const satisfies Record<AppFontSize, { label: string; scale: number }>;
export const DEFAULT_SETTINGS: Settings = { theme: 'light', fontSize: 'medium' };
export const LEGACY_STORAGE_KEY = 'todop_app_data_v1';
export const STORAGE_KEY = 'todop_app_data_v2';

export function isFontSize(value: unknown): value is AppFontSize {
  return FONT_SIZES.some(size => size === value);
}

export function getUiScale(size: AppFontSize): number {
  return FONT_SIZE_OPTIONS[size].scale / FONT_SIZE_OPTIONS.medium.scale;
}

export function applyAppearance(settings: Settings): void {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.fontSize = settings.fontSize;
  root.style.setProperty('--font-size-base', `${FONT_SIZE_OPTIONS[settings.fontSize].scale}%`);
  root.style.setProperty('--ui-scale', String(getUiScale(settings.fontSize)));
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content', settings.theme === 'dark' ? '#1F2027' : '#FAFAF6',
  );
}

export function initializeAppearance(accountCacheKey?: string): void {
  let settings = DEFAULT_SETTINGS;
  try {
    const raw = accountCacheKey
      ? localStorage.getItem(accountCacheKey)
      : localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    const data = JSON.parse(raw ?? 'null');
    const saved = accountCacheKey ? (data?.draft ?? data?.base?.data)?.settings : data?.settings;
    if (saved) {
      settings = {
        theme: saved.theme === 'dark' ? 'dark' : 'light',
        fontSize: isFontSize(saved.fontSize) ? saved.fontSize : DEFAULT_SETTINGS.fontSize,
      };
    }
  } catch { /* Use defaults when storage is unavailable or malformed. */ }
  applyAppearance(settings);
}
