import type { SaleCompletionParams, Client } from '../types';
import { formatNumber } from './formatters';
import i18n from '../i18n';

/**
 * Valide les données de base d'une vente avant soumission
 */
export function validateSaleData(params: SaleCompletionParams): string | null {
    const { selectedClient, lignesFacture, totals, montantPaye, paiements, validated_by_id, sudo_password } = params;

    if (!selectedClient && !params.useManualClient) {
        return i18n.t('facturation:messages.select_client');
    }

    if (lignesFacture.length === 0) {
        return i18n.t('facturation:messages.add_product');
    }

    // Validation Sudo
    if (validated_by_id && !sudo_password) {
        return i18n.t('facturation:validation.sudo_password_required');
    }

    // Validation du montant
    const isTiersPayant = totals.tauxCouverture > 0 && totals.partAssurance > 0;
    const montantAttendu = isTiersPayant ? totals.partPatient : totals.totalTtc;

    if (montantAttendu > 0) {
        const montantSaisi = Number(montantPaye);
        const totalSplit = paiements.reduce((acc, p) => acc + Number(p.montant), 0);

        // NaN ou montant négatif : invalide — sinon le contrôle "montant insuffisant" est contourné
        if (!Number.isFinite(montantSaisi) || !Number.isFinite(totalSplit) || montantSaisi < 0) {
            return i18n.t('facturation:validation.invalid_amount');
        }

        if (paiements.length === 0 && (!montantPaye || montantSaisi === 0)) {
            return i18n.t('facturation:validation.invalid_amount');
        }

        // Si paiement partagé, vérifier le total
        if (paiements.length > 0 || (montantPaye && montantSaisi > 0)) {
            const totalSaisi = totalSplit + montantSaisi;
            // On autorise un montant supérieur (pour le rendu de monnaie), 
            // mais pas inférieur (tolérance de 1F pour les arrondis)
            if (!Number.isFinite(totalSaisi) || totalSaisi < montantAttendu - 1) {
                return i18n.t('facturation:validation.insufficient_amount', {
                    total: totalSaisi,
                    expected: montantAttendu
                });
            }
        }
    }

    return null;
}

/**
 * Valide les données spécifiques d'un client (ayants-droit pour pros, plafond de crédit pour tous)
 */
export function validateClientCreditLimit(params: SaleCompletionParams, client: Client | undefined): string | null {
    if (!client) return null;

    const {
        useManualClient, showNewAyantDroit, ayantsDroitList,
        ayantDroitNom, ayantDroitMatricule, selectedAyantDroit, totals,
        montantPaye, paiements
    } = params;

    // 1. Validation ayant droit (UNIQUEMENT pour les professionnels)
    if (client.client_type === 'PROFESSIONNEL') {
        if (!useManualClient && (showNewAyantDroit || ayantsDroitList.length === 0) && (!ayantDroitNom || !ayantDroitMatricule)) {
            return i18n.t('facturation:validation.pro_client_beneficiary_info');
        }
        
        if (useManualClient && !selectedAyantDroit) {
            return i18n.t('facturation:validation.pro_client_beneficiary_select');
        }
    }

    // 2. Validation du PLAFOND DE CRÉDIT (POUR LES CLIENTS PROFESSIONNELS UNIQUEMENT)
    const plafond = Number(client.plafond || 0);
    const isPro = client.client_type === 'PROFESSIONNEL';
    
    // -1 = Crédit illimité. 0 = Crédit interdit.
    if (isPro && plafond !== -1) {
        const currentDebt = Number(client.current_debt || 0);

        // Calculer le paiement immédiat total (Somme de tous les modes de paiement saisis)
        const totalPaidSaisie = Number(montantPaye || 0);
        const totalSplits = (paiements || []).reduce((acc: number, p) => acc + (Number(p.montant) || 0), 0);
        const totalImmediatePayment = totalPaidSaisie + totalSplits;

        // La nouvelle dette est ce qui reste après paiement immédiat
        const debtIncrement = Math.max(0, totals.totalTtc - totalImmediatePayment);
        const theoreticalTotalDebt = currentDebt + debtIncrement;

        if (theoreticalTotalDebt > plafond + 0.5) { // Tolérance pour les arrondis
            return `${i18n.t('facturation:validation.credit_limit_exceeded_title')}\n` +
                   `${i18n.t('facturation:validation.current_debt', { amount: formatNumber(Math.round(currentDebt)) })}\n` +
                   `${i18n.t('facturation:validation.new_debt_estimate', { amount: formatNumber(Math.round(debtIncrement)) })}\n` +
                   `${i18n.t('facturation:validation.theoretical_total', { amount: formatNumber(Math.round(theoreticalTotalDebt)) })}\n` +
                   `${i18n.t('facturation:validation.authorized_limit', { amount: formatNumber(Math.round(plafond)) })}\n\n` +
                   i18n.t('facturation:validation.credit_limit_exceeded_body');
        }
    }

    return null;
}
