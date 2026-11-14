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
