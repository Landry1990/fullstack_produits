import { useEffect, useState } from 'react';
import { formatDate, formatTime, formatDateTime } from '../../utils/dateUtils';

/**
 * Horloge compacte affichée en permanence dans la barre du haut.
 * Tick aligné sur le changement de minute (pas de polling inutile).
 */
export default function HeaderClock({ className = '' }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timeout: number;
    const tick = () => {
      const d = new Date();
      setNow(d);
      timeout = window.setTimeout(tick, (60 - d.getSeconds()) * 1000 - d.getMilliseconds() + 50);
    };
    tick();
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <span
      className={`whitespace-nowrap text-base font-semibold tabular-nums tracking-wide ${className}`}
      title={formatDateTime(now)}
    >
      {formatDate(now)} · {formatTime(now)}
    </span>
  );
}
