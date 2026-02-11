export type BrandStyleVariant = 'aurelia' | 'halo' | 'obsidian';

export const BRAND_STYLE_STORAGE_KEY = 'creator-rail.brand-style';
export const BRAND_STYLE_CHANGE_EVENT = 'creator-rail:brand-style-change';

export const BRAND_STYLE_OPTIONS: { value: BrandStyleVariant; label: string; description: string }[] = [
  { value: 'aurelia', label: 'Aurelia', description: 'Bright premium gold' },
  { value: 'halo', label: 'Halo', description: 'Luxury dark + gold' },
  { value: 'obsidian', label: 'Obsidian', description: 'Minimal graphite' },
];

function isBrandStyleVariant(value: unknown): value is BrandStyleVariant {
  return value === 'aurelia' || value === 'halo' || value === 'obsidian';
}

export function getStoredBrandStyle(): BrandStyleVariant {
  if (typeof window === 'undefined') return 'halo';
  const stored = window.localStorage.getItem(BRAND_STYLE_STORAGE_KEY);
  return isBrandStyleVariant(stored) ? stored : 'halo';
}

export function setStoredBrandStyle(variant: BrandStyleVariant) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BRAND_STYLE_STORAGE_KEY, variant);
  window.dispatchEvent(new CustomEvent(BRAND_STYLE_CHANGE_EVENT, { detail: variant }));
}
