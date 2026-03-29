import type { SaleCompletionParams, Client } from '../types';
import { formatNumber } from './formatters';

/**
 * Valide les données de base d'une vente avant soumission
 */
export function validateSaleData(params: SaleCompletionParams): string | null {
    const { selectedClient, lignesFacture, totals, montantPaye, paiements, validated_by_id, sudo_password } = params;

    if (!selectedClient && !params.useManualClient) {
        return 'Veuillez sélectionner un client';
    }

    if (lignesFacture.length === 0) {
        return 'Veuillez ajouter au moins un produit';
    }

    // Validation Sudo
    if (validated_by_id && !sudo_password) {
        return 'Mot de passe requis pour la validation par un tiers';
    }

    // Validation du montant
    const isTiersPayant = totals.tauxCouverture > 0 && totals.partAssurance > 0;
    const montantAttendu = isTiersPayant ? totals.partPatient : totals.totalTtc;

    if (montantAttendu > 0) {
        const montantSaisi = Number(montantPaye);
        const totalSplit = paiements.reduce((acc, p) => acc + p.montant, 0);

        if (paiements.length === 0 && (!montantPaye || montantSaisi === 0)) {
            return 'Veuillez entrer un montant valide';
        }

        // Si paiement partagé, vérifier le total
        if (paiements.length > 0 || (montantPaye && montantSaisi > 0)) {
            const totalSaisi = totalSplit + montantSaisi;
            // On autorise un montant supérieur (pour le rendu de monnaie), 
            // mais pas inférieur (tolérance de 1F pour les arrondis)
            if (totalSaisi < montantAttendu - 1) {
                return `Le montant total (${totalSaisi} F) est insuffisant pour régler la facture (${montantAttendu} F)`;
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
        if (!useManualClient) {
            if (showNewAyantDroit || ayantsDroitList.length === 0) {
                if (!ayantDroitNom || !ayantDroitMatricule) {
                    return "Pour un client professionnel, veuillez renseigner le nom et le matricule de l'ayant droit";
                }
            }
        } else {
            if (!selectedAyantDroit) {
                return 'Pour un client professionnel, veuillez sélectionner un ayant droit ou en créer un nouveau';
            }
        }
    }

    // 2. Validation du PLAFOND DE CRÉDIT (POUR TOUS les clients ayant un plafond défini)
    const plafond = Number(client.plafond || 0);
    if (plafond > 0) {
        const currentDebt = Number(client.current_debt || 0);

        // Calculer le paiement immédiat total (Somme de tous les modes de paiement saisis)
        const totalPaidSaisie = Number(montantPaye || 0);
        const totalSplits = (paiements || []).reduce((acc: number, p) => acc + (Number(p.montant) || 0), 0);
        const totalImmediatePayment = totalPaidSaisie + totalSplits;

        // La nouvelle dette est ce qui reste après paiement immédiat
        const debtIncrement = Math.max(0, totals.totalTtc - totalImmediatePayment);
        const theoreticalTotalDebt = currentDebt + debtIncrement;

        if (theoreticalTotalDebt > plafond) {
            return `⚠️ PLAFOND DE CRÉDIT DÉPASSÉ !\n` +
                   `Dette actuelle : ${formatNumber(Math.round(currentDebt))} F\n` +
                   `Nouvelle dette (TTC - Payé) : ${formatNumber(Math.round(debtIncrement))} F\n` +
                   `Total théorique : ${formatNumber(Math.round(theoreticalTotalDebt))} F\n` +
                   `Limite autorisée (Plafond) : ${formatNumber(Math.round(plafond))} F\n\n` +
                   `La vente ne peut pas être finalisée car ce client a atteint sa limite de crédit.`;
        }
    }

    return null;
}
