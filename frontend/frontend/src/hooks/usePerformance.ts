import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook pour surveiller et optimiser les performances
 * Réduit automatiquement les animations et le polling quand le CPU est haut
 */
export function usePerformance() {
  const [isLowPower, setIsLowPower] = useState(false);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useEffect(() => {
    let animationId: number;
    
    const checkPerformance = () => {
      frameCount.current++;
      const now = performance.now();
      const elapsed = now - lastTime.current;
      
      // Vérifier le FPS toutes les secondes
      if (elapsed >= 1000) {
        const fps = (frameCount.current * 1000) / elapsed;
        
        // Si FPS < 30, on passe en mode économie
        if (fps < 30) {
          setIsLowPower(true);
        } else if (fps > 50) {
          setIsLowPower(false);
        }
        
        frameCount.current = 0;
        lastTime.current = now;
      }
      
      animationId = requestAnimationFrame(checkPerformance);
    };
    
    animationId = requestAnimationFrame(checkPerformance);
    
    return () => cancelAnimationFrame(animationId);
  }, []);

  return { isLowPower };
}

/**
 * Hook pour limiter le taux d'exécution d'une fonction (throttle)
 */
export function useThrottle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  const lastRun = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const remaining = delay - (now - lastRun.current);

      if (remaining <= 0) {
        if (timeout.current) {
          clearTimeout(timeout.current);
          timeout.current = null;
        }
        lastRun.current = now;
        fn(...args);
      } else if (!timeout.current) {
        timeout.current = setTimeout(() => {
          lastRun.current = Date.now();
          timeout.current = null;
          fn(...args);
        }, remaining);
      }
    },
    [fn, delay]
  );
}

/**
 * Hook pour debounce (attendre la fin d'une série d'appels)
 */
export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
      timeout.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay]
  );
}

/**
 * Hook pour intervale intelligent (ralentit quand l'onglet est inactif)
 */
export function useSmartInterval(
  callback: () => void,
  activeDelay: number,
  inactiveDelay: number = activeDelay * 4
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      const delay = document.hidden ? inactiveDelay : activeDelay;
      intervalRef.current = setInterval(() => callbackRef.current(), delay);
    };

    // Démarrer l'interval
    handleVisibilityChange();

    // Écouter les changements de visibilité
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeDelay, inactiveDelay]);
}

/**
 * Hook pour virtualiser une liste (render seulement les éléments visibles)
 */
export function useVirtualization<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = useState(0);

  const virtualItems = (() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);

    return items.slice(startIndex, endIndex).map((item, index) => ({
      item,
      index: startIndex + index,
      style: {
        position: 'absolute' as const,
        top: (startIndex + index) * itemHeight,
        height: itemHeight,
        left: 0,
        right: 0,
      },
    }));
  })();

  const totalHeight = items.length * itemHeight;

  return {
    virtualItems,
    totalHeight,
    scrollTop,
    setScrollTop,
    containerStyle: {
      position: 'relative' as const,
      height: containerHeight,
      overflow: 'auto' as const,
    },
  };
}

export default usePerformance;
