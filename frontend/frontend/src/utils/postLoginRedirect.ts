import { safeStorage } from './storage';

const KEY = 'post_login_redirect';

// Pages transitoires qu'on ne restaure jamais après reconnexion
const EXCLUDED_PREFIXES = ['/app/print-invoice', '/app/printing'];

const isRestorablePath = (path: string): boolean =>
    path.startsWith('/app') &&
    !EXCLUDED_PREFIXES.some(prefix => path.startsWith(prefix));

/**
 * Mémorise la page courante avant une redirection forcée vers le login
 * (session expirée, déconnexion auto, accès direct non authentifié).
 * Stockée en localStorage car clearAuthSession() vide le sessionStorage.
 */
export const savePostLoginRedirect = (path: string): void => {
    if (!isRestorablePath(path)) return;
    safeStorage.setItem(KEY, path, 'local');
};

/**
 * Lit puis supprime la page mémorisée. Retourne null si absente ou invalide.
 * La re-validation protège contre les valeurs injectées manuellement.
 */
export const consumePostLoginRedirect = (): string | null => {
    const path = safeStorage.getItem(KEY, 'local');
    safeStorage.removeItem(KEY, 'local');
    return path && isRestorablePath(path) ? path : null;
};
