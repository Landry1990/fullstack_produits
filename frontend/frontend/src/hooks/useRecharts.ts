import { useState, useEffect } from 'react';
import type * as RechartsType from 'recharts';

let cached: typeof RechartsType | null = null;
let loadPromise: Promise<typeof RechartsType> | null = null;

function loadRecharts(): Promise<typeof RechartsType> {
  if (cached) return Promise.resolve(cached);
  if (!loadPromise) {
    loadPromise = import('recharts').then((mod) => {
      cached = mod;
      return mod;
    });
  }
  return loadPromise;
}

export function useRecharts() {
  const [mod, setMod] = useState<typeof RechartsType | null>(cached);

  useEffect(() => {
    if (!mod) {
      loadRecharts().then(setMod);
    }
  }, [mod]);

  return mod;
}
