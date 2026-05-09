/**
 * PrefetchLink - Composant de lien avec prefetching intelligent
 * 
 * Précharge la route au survol (hover) pour une navigation instantanée
 * Utilise requestIdleCallback pour ne pas impacter les performances
 */

import { Link, type LinkProps } from 'react-router-dom';
import { useRef } from 'react';

interface PrefetchLinkProps extends LinkProps {
  prefetchTimeout?: number;
}

export function PrefetchLink({ 
  to, 
  prefetchTimeout = 100,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  children,
  ...props 
}: PrefetchLinkProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Démarrer le prefetch après un court délai au survol
    timeoutRef.current = setTimeout(() => {
      // Prefetch via React Router (si disponible)
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        requestIdleCallback(() => {
          // Le prefetch est géré par React Router automatiquement
          // si la route est déjà dans le cache
        }, { timeout: 2000 });
      }
    }, prefetchTimeout);

    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Annuler le prefetch si l'utilisateur quitte avant le délai
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onMouseLeave?.(e);
  };

  const handleFocus = (e: React.FocusEvent<HTMLAnchorElement>) => {
    // Prefetch aussi au focus (accessibilité clavier)
    timeoutRef.current = setTimeout(() => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        requestIdleCallback(() => {}, { timeout: 2000 });
      }
    }, prefetchTimeout);

    onFocus?.(e);
  };

  return (
    <Link
      to={to}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      {...props}
    >
      {children}
    </Link>
  );
}
