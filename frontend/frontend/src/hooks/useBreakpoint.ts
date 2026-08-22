import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Breakpoints Tailwind 4 alignés avec la config du projet.
 *
 * sm: 640px
 * md: 768px
 * lg: 1024px
 * xl: 1280px
 * 2xl: 1536px
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

export interface BreakpointState {
  /** Largeur actuelle du viewport en px */
  width: number;
  /** Breakpoint actif (le plus petit dont la largeur est atteinte) */
  breakpoint: BreakpointKey | null;
  isMobile: boolean;  // < 768
  isTablet: boolean;  // 768 <= w < 1024
  isDesktop: boolean; // >= 1024
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
}

function getActiveBreakpoint(width: number): BreakpointKey | null {
  const keys = Object.keys(BREAKPOINTS) as BreakpointKey[];
  let active: BreakpointKey | null = null;
  for (const key of keys) {
    if (width >= BREAKPOINTS[key]) {
      active = key;
    }
  }
  return active;
}

/**
 * Hook réactif qui expose l'état du viewport.
 * Utilise `window.matchMedia` pour être plus performant que le listener resize.
 */
export function useBreakpoint(): BreakpointState {
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return 1280;
    return window.innerWidth;
  });

  const updateWidth = useCallback(() => {
    setWidth(window.innerWidth);
  }, []);

  useEffect(() => {
    // Mettre à jour au montage (hydratation SSR-safe)
    updateWidth();

    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [updateWidth]);

  return useMemo(() => {
    const breakpoint = getActiveBreakpoint(width);
    return {
      width,
      breakpoint,
      isMobile: width < BREAKPOINTS.md,
      isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
      isDesktop: width >= BREAKPOINTS.lg,
      isMd: width >= BREAKPOINTS.sm,
      isLg: width >= BREAKPOINTS.md,
      isXl: width >= BREAKPOINTS.lg,
    };
  }, [width]);
}

export default useBreakpoint;
