import type { Facture, PaymentDetails, TicketCaisse } from '../types'
import { PAYMENT_MODES } from '../config/paymentModes'

/**
 * Construction centralisée d'un TicketCaisse à partir d'une Facture.
 * Factorise les 4 flux qui le fabriquaient à la main : encaissement caisse,
 * vente directe (facturation), complétion d'une facture existante, réimpression.
 */

export interface BuildTicketCaisseOptions {
    /** Repli final pour client_name (ex. t('common:passerby_client')) */
    fallbackClientName: string
    /** Noms tentés entre client_name et le repli (ex. manualClientName, client.name) */
    extraClientNames?: Array<string | null | undefined>
    /** Paiements saisis dans le flux courant — détermine mode_paiement ('Mixte' si > 1) */
    enteredPayments?: PaymentDetails[]
    /** Source de paiements_details : 'entered' utilise enteredPayments, 'facture' facture.paiements
     *  (défaut : 'entered' si enteredPayments fourni, sinon 'facture') */
    paiementsDetailsSource?: 'entered' | 'facture'
    /** Repli de montant_verse quand facture.montant_verse est absent (défaut : total_ttc) */
    fallbackMontantVerse?: number | string
    /** Repli de rendu quand facture.montant_rendu est absent (défaut : '0') */
    fallbackRendu?: number | string
    /** Défaut : paiements[0].date_paiement, sinon maintenant */
    datePaiement?: string
    /** Défaut : { id: 0, username: validated_by_name || created_by_name } */
    userDetails?: TicketCaisse['user_details']
    reference?: string | null
    /** Réimpression : affiche le bandeau DUPLICATA */
    isDuplicate?: boolean
    /** Mode affiché si aucun paiement trouvé (défaut 'especes') */
    defaultModePaiement?: string
    /** Défaut : facture.id (la réimpression passe session_ticket_number) */
    ticketId?: number
}

const normAmount = (v: string | number | null | undefined): string | undefined => {
    if (v === null || v === undefined || v === '') return undefined
    const n = Number(v)
    return Number.isFinite(n) ? String(n) : String(v)
}

const resolveClientName = (facture: Facture, extra: Array<string | null | undefined>, fallback: string): string =>
    facture.client_name_override
    || facture.client_name
    || extra.find((n): n is string => !!n)
    || fallback

const resolveModePaiement = (
    facture: Facture,
    enteredPayments: PaymentDetails[] | undefined,
    defaultMode: string
): string => {
    if (enteredPayments !== undefined) {
        if (enteredPayments.length > 1) return 'Mixte'
        return enteredPayments[0]?.mode || defaultMode
    }
    const ps = facture.paiements ?? []
    if (ps.length > 1) return 'Mixte'
    const pm = ps[0]?.mode_paiement
    if (!pm) return defaultMode
    // Modes inconnus (hors référentiel) → 'Mixte' plutôt qu'un libellé brut incohérent
    return PAYMENT_MODES.some(m => m.value === pm) ? pm : 'Mixte'
}

// Les paiements persistés utilisent `mode_paiement` (modèle Paiement) alors que
// PaymentDetails attend `mode` : conversion explicite pour éviter le "[N/A]" du ticket.
const mapFacturePaiements = (facture: Facture): PaymentDetails[] =>
    (facture.paiements ?? []).map((p): PaymentDetails => ({
        mode: p.mode_paiement,
        montant: Number(p.montant),
        part_patient: p.part_patient != null ? Number(p.part_patient) : null,
        part_assurance: p.part_assurance != null ? Number(p.part_assurance) : null,
    }))

export const buildTicketCaisse = (facture: Facture, options: BuildTicketCaisseOptions): TicketCaisse => {
    const useEntered = options.enteredPayments !== undefined
        && (options.paiementsDetailsSource ?? 'entered') === 'entered'

    return {
        id: options.ticketId ?? facture.id,
        facture,
        facture_numero: facture.numero_facture || undefined,
        client_name: resolveClientName(facture, options.extraClientNames ?? [], options.fallbackClientName),
        mode_paiement: resolveModePaiement(facture, options.enteredPayments, options.defaultModePaiement ?? 'especes'),
        montant: facture.total_ttc,
        montant_verse: normAmount(facture.montant_verse) ?? normAmount(options.fallbackMontantVerse) ?? facture.total_ttc,
        rendu: normAmount(facture.montant_rendu) ?? normAmount(options.fallbackRendu) ?? '0',
        statut: 'completee',
        date_paiement: options.datePaiement ?? facture.paiements?.[0]?.date_paiement ?? new Date().toISOString(),
        paiements_details: useEntered ? options.enteredPayments : mapFacturePaiements(facture),
        user_details: options.userDetails !== undefined
            ? options.userDetails
            : { id: 0, username: facture.validated_by_name || facture.created_by_name || '' },
        reference: options.reference ?? null,
        ...(options.isDuplicate ? { is_duplicate: true } : {}),
    }
}
