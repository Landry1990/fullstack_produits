/**
 * Sémantique de péremption des lots — miroir du helper backend
 * `api/utils/expiry.py`. La convention est choisie par pharmacie via
 * `PharmacySettings.expiry_cutoff` :
 * - 'LAST_DAY' (défaut) : le lot est périmé quand sa date est dépassée.
 * - 'FIRST_DAY' : périmé dès le 1er jour du mois d'expiration.
 *
 * Les dates saisies en MM/AA sont stockées au dernier jour du mois, donc
 * la comparaison `date_exp < expiredBeforeDate()` couvre les deux cas.
 */
export type ExpiryCutoff = 'LAST_DAY' | 'FIRST_DAY';

export const expiredBeforeDate = (cutoff?: string, today: Date = new Date()): Date => {
    if (cutoff === 'FIRST_DAY') {
        return new Date(today.getFullYear(), today.getMonth() + 1, 1);
    }
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

export const isLotExpired = (dateExpiration?: string | null, cutoff?: string): boolean => {
    if (!dateExpiration) return false;
    return new Date(dateExpiration) < expiredBeforeDate(cutoff);
};

/**
 * Convertit une date vers le format saisie MM/YY.
 * Accepte "MM/YY" (inchangé), "YYYY-MM-DD" / ISO (split texte, pas de
 * décalage fuseau) et tout format Date-parsable. '' si non convertible.
 */
export const dateToMMYY = (raw: string | null | undefined): string => {
    if (!raw) return '';
    if (/^\d{2}\/\d{2}$/.test(raw)) return raw;
    const iso = raw.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
    if (iso) return `${iso[2]}/${iso[1].slice(-2)}`;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
};
