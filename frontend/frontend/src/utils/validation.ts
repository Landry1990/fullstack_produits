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
 * Valide les données spécifiques d'un client professionnel (ayants-droit, plafond de crédit)
 */
export function validateProfessionalClient(params: SaleCompletionParams, client: Client | undefined): string | null {
    if (!client || client.client_type !== 'PROFESSIONNEL') return null;

    const {
        useManualClient, showNewAyantDroit, ayantsDroitList,
        ayantDroitNom, ayantDroitMatricule, selectedAyantDroit, totals
    } = params;

    // Validation ayant droit
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

    // Validation du PLAFOND DE CRÉDIT
    const plafond = Number(client.plafond || 0);
    if (plafond > 0) {
        const currentDebt = Number(client.current_debt || 0);

        // Calculer le paiement immédiat total
        const immediatePayment = Number(params.montantPaye || 0) +
            params.paiements.reduce((acc: number, p) => acc + (p.montant || 0), 0);

        const debtIncrement = Math.max(0, totals.totalTtc - immediatePayment);
        const newTotal = currentDebt + debtIncrement;

        if (newTotal > plafond) {
            return `⚠️ PLAFOND DÉPASSÉ !\nDette actuelle: ${formatNumber(Math.round(currentDebt))} F\nIncrément dette (TTC - Payé): ${formatNumber(Math.round(debtIncrement))} F\nTotal: ${formatNumber(Math.round(newTotal))} F\nPlafond: ${formatNumber(Math.round(plafond))} F`;
        }
    }

    return null;
}
