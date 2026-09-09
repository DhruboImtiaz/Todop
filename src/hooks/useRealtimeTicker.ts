import { useState, useEffect } from 'react';

/**
 * Hook that returns the current timestamp in milliseconds,
 * updating on an interval so that countdowns re-calculate in real time.
 */
export function useRealtimeTicker(intervalMs: number = 5000): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
