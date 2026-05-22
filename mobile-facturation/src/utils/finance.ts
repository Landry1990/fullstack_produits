/**
 * Utilitaires de calcul financier alignés avec GestionDivers
 * Tous les montants en string pour précision décimale
 */

import type { Product } from '../types';

/**
 * Calcule les totaux d'une ligne de facture
 * Retourne les valeurs en string pour précision
 */
export function calculateLineTotals(
  product: Product,
  quantite: number,
  remiseProduit: string = '0',
  tva: string = '18',
  prixUnitaireOverride?: string
): { total_ht: string; total_ttc: string } {
  // Prix unitaire (avec possibilité de override)
  const prixRaw = prixUnitaireOverride !== undefined 
    ? prixUnitaireOverride 
    : (product.prix_vente?.toString() || '0');
  
  const prixUnitaire = parseFloat(prixRaw) || 0;
  
  // Remise produit (%)
  const remise = parseFloat(remiseProduit) || 0;
  const prixRemise = prixUnitaire * (1 - remise / 100);
  
  // Quantité
  const qty = Math.max(0, quantite);
  
  // Total HT
  const totalHT = prixRemise * qty;
  
  // TVA (%)
  const tauxTVA = parseFloat(tva) || 0;
  const montantTVA = totalHT * (tauxTVA / 100);
  
  // Total TTC
  const totalTTC = totalHT + montantTVA;
  
  return {
    total_ht: totalHT.toFixed(2),
    total_ttc: totalTTC.toFixed(2),
  };
}

/**
 * Calcule les totaux du panier complet
 */
export function calculateCartTotals(
  lignes: { total_ht: string; tva: string; quantite: number }[]
): { totalHT: string; totalTVA: string; totalTTC: string } {
  let totalHT = 0;
  let totalTVA = 0;

  for (const ligne of lignes) {
    const ht = parseFloat(ligne.total_ht || '0');
    const tauxTVA = parseFloat(ligne.tva || '0');
    const montantTVA = ht * (tauxTVA / 100);
    
    totalHT += ht;
    totalTVA += montantTVA;
  }

  const totalTTC = totalHT + totalTVA;

  return {
    totalHT: totalHT.toFixed(2),
    totalTVA: totalTVA.toFixed(2),
    totalTTC: totalTTC.toFixed(2),
  };
}

/**
 * Calcule la part assurance / patient
 */
export function calculateInsuranceSplit(
  totalTTC: string,
  tauxCouverture: number
): { partAssurance: string; partPatient: string } {
  const ttc = parseFloat(totalTTC) || 0;
  const taux = Math.max(0, Math.min(100, tauxCouverture));
  
  const partAssurance = ttc * (taux / 100);
  const partPatient = ttc - partAssurance;

  return {
    partAssurance: partAssurance.toFixed(2),
    partPatient: partPatient.toFixed(2),
  };
}

/**
 * Calcule la monnaie à rendre
 */
export function calculateChange(
  montantPaye: string,
  totalTTC: string
): { monnaie: string; resteDu: string } {
  const paye = parseFloat(montantPaye) || 0;
  const ttc = parseFloat(totalTTC) || 0;
  
  const diff = paye - ttc;
  
  return {
    monnaie: diff > 0 ? diff.toFixed(2) : '0.00',
    resteDu: diff < 0 ? Math.abs(diff).toFixed(2) : '0.00',
  };
}

/**
 * Formate un montant pour affichage (FCFA)
 */
export function formatCurrency(
  amount: string | number,
  symbol: string = 'FCFA'
): string {
  const val = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(val)) return `0 ${symbol}`;
  
  return `${val.toLocaleString('fr-FR', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  })} ${symbol}`;
}

/**
 * Addition sécurisée de montants (strings)
 */
export function addAmounts(...amounts: string[]): string {
  const total = amounts.reduce((sum, amt) => {
    return sum + (parseFloat(amt) || 0);
  }, 0);
  return total.toFixed(2);
}

/**
 * Soustrait deux montants (a - b)
 */
export function subtractAmounts(a: string, b: string): string {
  const result = (parseFloat(a) || 0) - (parseFloat(b) || 0);
  return result.toFixed(2);
}

/**
 * Applique un pourcentage à un montant
 */
export function applyPercentage(
  amount: string,
  percentage: string
): string {
  const val = parseFloat(amount) || 0;
  const pct = parseFloat(percentage) || 0;
  const result = val * (pct / 100);
  return result.toFixed(2);
}
