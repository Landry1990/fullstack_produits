/**
 * Fonctions utilitaires pour formater les dates au format français (dd/mm/yyyy)
 */

/**
 * Formate une date en format français dd/mm/yyyy
 * @param date - Date sous forme de string, Date object ou null/undefined
 * @returns Date formatée en dd/mm/yyyy ou '-' si invalide
 */
export function formatDateFr(date: string | Date | null | undefined): string {
    if (!date) return '-';
    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return '-';
    }
}

/**
 * Formate une date avec l'heure en format français dd/mm/yyyy HH:mm
 * @param date - Date sous forme de string, Date object ou null/undefined
 * @returns Date formatée en dd/mm/yyyy HH:mm ou '-' si invalide
 */
export function formatDateTimeFr(date: string | Date | null | undefined): string {
    if (!date) return '-';
    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return '-';
        const datePart = d.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const timePart = d.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        return `${datePart} ${timePart}`;
    } catch {
        return '-';
    }
}

/**
 * Formate une date en format long français (ex: "lundi 13 janvier 2026")
 * @param date - Date sous forme de string, Date object ou null/undefined
 * @returns Date formatée en format long ou '-' si invalide
 */
export function formatDateLongFr(date: string | Date | null | undefined): string {
    if (!date) return '-';
    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('fr-FR', {
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
 * Formate une date d'expiration au format mm/yy
 * @param date - Date sous forme de string, Date object ou null/undefined
 * @returns Date formatée en mm/yy ou '-' si invalide
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
