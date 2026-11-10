import { useEffect } from 'react';

/**
 * Raccourci clavier global pour se déconnecter.
 * Ctrl + D — ignoré quand le focus est dans un champ de saisie.
 * Ctrl+D = « Ajouter aux favoris » côté navigateur : preventDefault
 * le neutralise. Ctrl+Q quitte le navigateur et n'est pas interceptable.
 */
export function useLogoutShortcut(onLogout: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      if (e.key !== 'd' && e.key !== 'D') return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      e.preventDefault();
      onLogout();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onLogout, enabled]);
}
