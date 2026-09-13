import { useState, useEffect } from 'react';

const DESKTOP_BREAKPOINT = 1024;

/**
 * Returns true when the viewport is >= 1024px (desktop layout).
 * Responds reactively to window resize / orientation change.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}
