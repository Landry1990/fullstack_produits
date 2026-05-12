import i18n from '../i18n';

/**
 * Fonctions utilitaires pour formater les dates selon la langue courante (fr/en)
 * 
 * ⚠️ IMPORTANT: Toutes les dates sont gérées en heure locale (UTC+1 pour la Côte d'Ivoire)
 * pour éviter les problèmes de décalage horaire entre le frontend et le backend.
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
 * Retourne la date locale au format YYYY-MM-DD (évite les problèmes UTC)
 * 
 * Ex: new Date() à 23h30 UTC+1 → "2026-05-12" (pas "2026-05-13" comme toISOString)
 */
export const getLocalDateString = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Retourne la date et heure locale au format ISO complet avec timezone
 * Format: YYYY-MM-DDTHH:mm:ss+HH:mm
 */
export const getLocalDateTimeString = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    // Calculer le décalage horaire local (ex: +01:00 pour UTC+1)
    const tzOffset = -date.getTimezoneOffset();
    const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
    const tzMinutes = String(Math.abs(tzOffset) % 60).padStart(2, '0');
    const tzSign = tzOffset >= 0 ? '+' : '-';
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzSign}${tzHours}:${tzMinutes}`;
};

/**
 * Parse une chaîne de date en objet Date (gère ISO et format local)
 */
export const parseDate = (dateString: string | Date | null | undefined): Date | null => {
    if (!dateString) return null;
    if (dateString instanceof Date) return isNaN(dateString.getTime()) ? null : dateString;
    
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? null : d;
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
