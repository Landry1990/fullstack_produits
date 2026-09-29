import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'zenith-help-progress';

export function useHelpProgress() {
  const [completed, setCompleted] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved)) {
        setCompleted(saved.filter((id): id is string => typeof id === 'string'));
      }
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback((id: string) => {
    setCompleted((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const isCompleted = useCallback(
    (id: string) => completed.includes(id),
    [completed]
  );

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setCompleted([]);
  }, []);

  return { completed, toggle, isCompleted, reset };
}
