import i18n from '../i18n';

/**
 * Fonctions utilitaires pour formater les dates selon la langue courante (fr/en)
 */

/**
 * Détermine la locale à utiliser selon la langue courante
 */
export const getLocale = () => {
    const lng = i18n.language;
    if (lng === 'en') return 'en-US'; // mm/dd/yyyy (US style as requested by user)
    return 'fr-FR'; // dd/mm/yyyy
};

/**
 * Options d'affichage pour les fonctions natives
 */
const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
};

const DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
    ...DATE_OPTIONS,
    hour: '2-digit',
    minute: '2-digit'
};

/**
 * Fonction de base pour formater une date
 */
export function formatDate(date: string | Date | null | undefined): string {
    if (!date) return '-';
    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString(getLocale(), DATE_OPTIONS);
    } catch {
        return '-';
    }
}

/**
 * Formate une date avec l'heure
 */
export function formatDateTime(date: string | Date | null | undefined): string {
    if (!date) return '-';
    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleString(getLocale(), DATETIME_OPTIONS);
    } catch {
        return '-';
    }
}

/**
 * Formate une date en format long locale
 */
export function formatDateLong(date: string | Date | null | undefined): string {
    if (!date) return '-';
    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString(getLocale(), {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    } catch {
        return '-';
    }
}

/**
 * Formate une date en format court (ex: 30 mars)
 */
export function formatDateShort(date: string | Date | null | undefined): string {
    if (!date) return '-';
    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' });
    } catch {
        return '-';
    }
}

// Alias long
// export const formatDateLongFr = formatDateLong; // Supprimé car doublon knip

/**
 * Formate une date d'expiration au format mm/yy
 */
export function formatExpirationDate(date: string | Date | null | undefined): string {
    if (!date) return '-';
    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return '-';
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = String(d.getFullYear()).slice(-2);
        return `${month}/${year}`;
    } catch {
        return '-';
    }
}

/**
 * Formate uniquement l'heure
 */
export function formatTime(date: string | Date | null | undefined): string {
    if (!date) return '-';
    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleTimeString(getLocale(), {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return '-';
    }
}
