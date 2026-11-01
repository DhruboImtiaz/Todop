import type { AppFontSize, Settings } from '../types';

export const FONT_SIZES = ['xs', 'small', 'medium', 'large'] as const satisfies readonly AppFontSize[];
export const DEFAULT_SETTINGS: Settings = { theme: 'light', fontSize: 'medium' };
export const LEGACY_STORAGE_KEY = 'todop_app_data_v1';
export const STORAGE_KEY = 'todop_app_data_v2';

export function isFontSize(value: unknown): value is AppFontSize {
  return FONT_SIZES.some(size => size === value);
}

export function applyAppearance(settings: Settings): void {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.dataset.fontSize = settings.fontSize;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content', settings.theme === 'dark' ? '#1F2027' : '#FAFAF6',
  );
}

export function initializeAppearance(): void {
  let settings = DEFAULT_SETTINGS;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY) ?? 'null')?.settings;
    if (saved) {
      settings = {
        theme: saved.theme === 'dark' ? 'dark' : 'light',
        fontSize: isFontSize(saved.fontSize) ? saved.fontSize : DEFAULT_SETTINGS.fontSize,
      };
    }
  } catch { /* Use defaults when storage is unavailable or malformed. */ }
  applyAppearance(settings);
}
