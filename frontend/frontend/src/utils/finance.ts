import { normalizeNumberInput } from './formatters';
import type { LigneFacture, Client, TotalsData, PaymentDetails } from '../types';

/**
 * Calcule le total d'une ligne de facture (TTC)
 * Note: Les prix de vente incluent déjà la TVA dans ce système
 */
export const calculateLineTotal = (
    quantite: number,
    prixUnitaire: string | number,
    remiseProduit: string | number
): number => {
    const qty = Number(quantite);
    const prix = normalizeNumberInput(prixUnitaire, { min: 0 });
    const remise = normalizeNumberInput(remiseProduit, { min: 0, max: 100 });

    const sousTotal = qty * prix;
    const montantRemise = Math.abs(sousTotal) * (remise / 100);

    // Si la quantité est négative (retour), la remise doit aussi être soustraite pour le crédit net
    const total = sousTotal - (sousTotal < 0 ? -montantRemise : montantRemise);
    return Number.isFinite(total) ? total : 0;
};

/**
 * Calcule les statistiques globales du panier (HT, TVA, TTC)
 */
export const calculateCartStats = (lignes: LigneFacture[]) => {
    const totalLines = lignes.length;
    const totalQty = lignes.reduce((acc, l) => {
        const qty = Number(l.quantite);
        return acc + (Number.isFinite(qty) ? qty : 0);
    }, 0);

    let totalTTC = 0;
    let totalTva = 0;
    let totalHT = 0;

    lignes.forEach(ligne => {
        const valeurLigneTTC = typeof ligne.total_ligne === 'number' ? ligne.total_ligne : Number(ligne.total_ligne);
        const ligneTTC = Number.isFinite(valeurLigneTTC) ? valeurLigneTTC : 0;
        totalTTC += ligneTTC;

        // Extraction de la TVA par ligne (les prix de vente incluent la TVA)
        const tauxTva = normalizeNumberInput(ligne.produit.tva ?? 0, { min: 0, max: 100 });
        if (tauxTva > 0) {
            // TTC = HT * (1 + taux/100) => HT = TTC / (1 + taux/100)
            const ligneHT = ligneTTC / (1 + tauxTva / 100);
            const ligneTvaAmount = ligneTTC - ligneHT;
            totalTva += ligneTvaAmount;
            totalHT += ligneHT;
        } else {
            totalHT += ligneTTC;
        }
    });

    // Safety check for final stats
    const safeSousTotal = Number.isFinite(totalHT) ? totalHT : 0;
    const safeTotalTva = Number.isFinite(totalTva) ? totalTva : 0;
    const safeTotalTTC = Number.isFinite(totalTTC) ? totalTTC : 0;

    return { totalLines, totalQty, sousTotal: safeSousTotal, totalTva: safeTotalTva, totalTTC: safeTotalTTC };
};

/**
 * Calcule les totaux finaux de la facture (Net à payer, Remise, Tiers-payant)
 */
export const calculateFactureTotals = (
    cartStats: { sousTotal: number, totalTva: number, totalTTC: number },
    selectedClient: Client | null | undefined,
    remiseGlobale: string | number,
    remiseMode: 'montant' | 'taux'
): TotalsData => {
    let finalTTC = cartStats.totalTTC;
    let remiseMontant = 0;

    // 1. Remise Globale
    const remiseVal = typeof remiseGlobale === 'number' ? remiseGlobale : parseFloat(remiseGlobale) || 0;
    if (remiseVal > 0) {
        if (remiseMode === 'taux') {
            remiseMontant = finalTTC * (remiseVal / 100);
        } else {
            remiseMontant = remiseVal;
        }
        finalTTC = Math.max(0, finalTTC - remiseMontant);
    }

    // 2. Tiers Payant (Assurance)
    let tauxCouverture = 0;
    let partAssurance = 0;
    let partPatient = finalTTC;

    if (selectedClient && selectedClient.taux_couverture) {
        const tc = parseFloat(selectedClient.taux_couverture) || 0;
        if (tc > 0) {
            tauxCouverture = tc;
            partAssurance = finalTTC * (tauxCouverture / 100);
            partPatient = finalTTC - partAssurance;
        }
    }

    // Final safety wrap to ensure no NaN escapes
    const safeResult = {
        totalHt: Number.isFinite(cartStats.sousTotal) ? cartStats.sousTotal : 0,
        totalTva: Number.isFinite(cartStats.totalTva) ? cartStats.totalTva : 0,
        totalTtc: Number.isFinite(finalTTC) ? finalTTC : 0,
        remiseMontant: Number.isFinite(remiseMontant) ? remiseMontant : 0,
        tauxCouverture: Number.isFinite(tauxCouverture) ? tauxCouverture : 0,
        partAssurance: Number.isFinite(partAssurance) ? partAssurance : 0,
        partPatient: Number.isFinite(partPatient) ? partPatient : 0
    };

    return safeResult;
};

/**
 * Construit la liste finale des paiements pour l'API
 */
export const buildPaymentsList = (
    totals: TotalsData,
    paiements: PaymentDetails[],
    montantPaye: string | number,
    modePaiement: string
): PaymentDetails[] => {
    const useTiersPayant = totals.tauxCouverture > 0 && totals.partAssurance > 0;
    let paiementsList: PaymentDetails[] = [];

    if (useTiersPayant) {
        // Part patient
        if (totals.partPatient > 0) {
            let resteAPatient = totals.partPatient;

            if (paiements.length > 0) {
                paiements.forEach(p => {
                    if (resteAPatient <= 0) return;
                    const montantReel = Math.min(p.montant, resteAPatient);
                    paiementsList.push({
                        mode: p.mode,
                        montant: montantReel,
                        part_patient: montantReel,
                        part_assurance: null
                    });
                    resteAPatient -= montantReel;
                });

                if (resteAPatient > 0 && Number(montantPaye) > 0) {
                    const montantReel = Math.min(Number(montantPaye), resteAPatient);
                    paiementsList.push({
                        mode: modePaiement,
                        montant: montantReel,
                        part_patient: montantReel,
                        part_assurance: null
                    });
                    resteAPatient -= montantReel;
                }
            } else {
                paiementsList.push({
                    mode: modePaiement,
                    montant: totals.partPatient,
                    part_patient: totals.partPatient,
                    part_assurance: null
                });
            }
        }

        // Part assurance (toujours en compte)
        if (totals.partAssurance > 0) {
            paiementsList.push({
                mode: 'en_compte',
                montant: totals.partAssurance,
                part_patient: null,
                part_assurance: totals.partAssurance
            });
        }
    } else {
        // Pas de tiers payant
        let resteAEnregistrer = totals.totalTtc;
        const isRefund = totals.totalTtc < 0;

        if (paiements.length > 0) {
            paiements.forEach(p => {
                if (!isRefund && resteAEnregistrer <= 0) return;
                if (isRefund && resteAEnregistrer >= 0) return;

                const montantReel = isRefund
                    ? Math.max(p.montant, resteAEnregistrer)
                    : Math.min(p.montant, resteAEnregistrer);

                paiementsList.push({
                    mode: p.mode,
                    montant: montantReel,
                    part_patient: null,
                    part_assurance: null
                });
                resteAEnregistrer -= montantReel;
            });

            if (!isRefund && resteAEnregistrer > 0 && Number(montantPaye) > 0) {
                const montantReel = Math.min(Number(montantPaye), resteAEnregistrer);
                paiementsList.push({
                    mode: modePaiement,
                    montant: montantReel,
                    part_patient: null,
                    part_assurance: null
                });
                resteAEnregistrer -= montantReel;
            } else if (isRefund && resteAEnregistrer < 0 && Number(montantPaye) <= 0) {
                const montantReel = Math.max(Number(montantPaye), resteAEnregistrer);
                paiementsList.push({
                    mode: modePaiement,
                    montant: montantReel,
                    part_patient: null,
                    part_assurance: null
                });
                resteAEnregistrer -= montantReel;
            }
        } else {
            paiementsList = [{
                mode: modePaiement,
                montant: totals.totalTtc,
                part_patient: null,
                part_assurance: null
            }];
        }
    }

    return paiementsList;
};
