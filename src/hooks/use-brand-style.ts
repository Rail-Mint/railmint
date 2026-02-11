import { useCallback, useEffect, useState } from 'react';
import {
  BRAND_STYLE_CHANGE_EVENT,
  BRAND_STYLE_STORAGE_KEY,
  getStoredBrandStyle,
  setStoredBrandStyle,
  type BrandStyleVariant,
} from '@/lib/brand-style';

export function useBrandStyle() {
  const [brandStyle, setBrandStyleState] = useState<BrandStyleVariant>(() => getStoredBrandStyle());

  const setBrandStyle = useCallback((nextStyle: BrandStyleVariant) => {
    setStoredBrandStyle(nextStyle);
    setBrandStyleState(nextStyle);
  }, []);

  useEffect(() => {
    const handleBrandChange = (event: Event) => {
      const nextStyle = (event as CustomEvent<BrandStyleVariant>).detail;
      if (nextStyle) {
        setBrandStyleState(nextStyle);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== BRAND_STYLE_STORAGE_KEY) return;
      setBrandStyleState(getStoredBrandStyle());
    };

    window.addEventListener(BRAND_STYLE_CHANGE_EVENT, handleBrandChange as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(BRAND_STYLE_CHANGE_EVENT, handleBrandChange as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return [brandStyle, setBrandStyle] as const;
}
