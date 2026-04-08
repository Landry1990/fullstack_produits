import i18next from 'i18next';
import { formatDate, formatDateTime } from '../dateUtils';
import { formatNumber } from '../formatters';

/**
 * Utilitaires d'assistance pour l'impression
 */

/**
 * Formate un nombre en format monétaire français pour l'impression
 */
export function formatMoney(value: number | string): string {
  const num = Math.round(parseFloat(String(value)));
  return formatNumber(num);
}

/**
 * Formate une date pour l'impression (inclut l'heure par défaut)
 */
export function formatDateFr(dateString: string): string {
  if (!dateString) return '';
  return formatDateTime(dateString);
}

/**
 * Génère une ligne de détail pour impression HTML
 */
export function printRow(label: string, value: string): string {
  return `
    <div class="print-row">
      <span>${label}</span>
      <span>${value}</span>
    </div>
  `;
}

/**
 * Génère un séparateur horizontal pour impression HTML
 */
export function printDivider(): string {
  return '<div class="print-divider"></div>';
}

/**
 * Génère une ligne de total pour impression HTML
 */
export function printTotal(label: string, value: string): string {
  return `
    <div class="print-row print-total">
      <span>${label}</span>
      <span>${value}</span>
    </div>
  `;
}

/**
 * Retourne le libellé d'un mode de paiement
 */
export function getModeLabel(mode: string): string {
  const keys: Record<string, string> = {
    especes: 'common:payment_modes.cash',
    cheque: 'common:payment_modes.check',
    carte: 'common:payment_modes.card',
    virement: 'common:payment_modes.transfer',
    om: 'common:payment_modes.orange_money',
    momo: 'common:payment_modes.mobile_money',
    coupon: 'common:payment_modes.coupon',
    en_compte: 'common:payment_modes.recouvrement'
  };
  
  const key = keys[mode];
  if (key && i18next.exists(key)) {
    return i18next.t(key);
  }
  
  const fallbacks: Record<string, string> = {
    especes: 'Espèces',
    cheque: 'Chèque',
    carte: 'Carte',
    virement: 'Virement',
    om: 'Orange Money',
    momo: 'Mobile Money',
    coupon: 'Coupon de Monnaie',
    en_compte: 'En Compte'
  };
  return fallbacks[mode] || mode?.toUpperCase() || 'N/A';
}
