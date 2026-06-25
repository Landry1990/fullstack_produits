import { useEffect } from 'react';
import { navigate } from '../services/navigationService';

/**
 * Raccourci clavier global pour ouvrir la page de licence.
 * Par défaut : Ctrl + Alt + L
 */
export function useLicenceShortcut() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Alt + L
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        navigate('/licence');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
