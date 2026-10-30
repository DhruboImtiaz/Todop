import { useState, useEffect } from 'react';

/**
 * Hook that returns the current timestamp in milliseconds,
 * updating on an interval so that countdowns re-calculate in real time.
 */
export function useRealtimeTicker(intervalMs: number = 5000): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, intervalMs);
    const onVisibilityChange = () => { if (!document.hidden) refresh(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [intervalMs]);

  return now;
}
