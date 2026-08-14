import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters';
import { escHtml, writePrintDocument } from '../../utils/print/printHelpers';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { getPaymentModeLabel } from '../../config/paymentModes';
import type { PharmacySettings } from '../../types';

interface ClosingPrintData {
  date_debut?: string | null;
  start_date?: string | null;
  date_fin?: string | null;
  end_date?: string | null;
  montant_theorique?: number;
  total_theorique?: number;
  montant_reel?: string | number;
  details?: Record<string, unknown>;
  mouvements_manuels?: Array<{ type: string; montant: number; motif: string }>;
  mouvements_audit?: Array<{ type: string; montant: number; motif: string; user_nom?: string; date?: string }>;
  user?: string;
  total_ca_pharmacie?: number;
  total_ca_divers?: number;
  details_paiement?: { __meta__?: { total_ca_pharmacie?: number; total_ca_divers?: number } };
  total_ventes?: number;
  total_entrees?: number;
  total_sorties?: number;
}

interface MovementPrintItem {
  type: string;
  montant: number;
  motif: string;
  user_nom?: string;
  date?: string | null;
}

interface UseJournalCaissePrintingParams {
  pharmacySettings: PharmacySettings | null | undefined;
  actualAmount: string;
  closingTotals: ClosingPrintData | null;
}

/**
 * Gère l'impression du rapport de clôture de caisse.
 * Extrait de useJournalCaisse.ts (~140 lignes de HTML/template).
 */
export function useJournalCaissePrinting({
  pharmacySettings,
  actualAmount,
  closingTotals,
}: UseJournalCaissePrintingParams) {
  const { t } = useTranslation(['cash_journal', 'common']);
  const currentLocale = t('common:locale', { defaultValue: 'fr-FR' });
  const currencySymbol = t(['common:currency_symbol', 'currency_symbol'], 'F');

  const formatCurrencyLocal = useCallback(
    (amount: number) => formatCurrency(amount, currentLocale, currencySymbol),
    [currentLocale, currencySymbol]
  );

  const handleImprimerCloture = useCallback(
    (dataToPrint?: ClosingPrintData) => {
      const data: ClosingPrintData = dataToPrint || closingTotals || {};

      const win = window.open('about:blank', '_blank', 'width=800,height=600');
      if (win) {
        const startStr = (data.date_debut || data.start_date)
          ? new Date((data.date_debut || data.start_date) as string).toLocaleString(currentLocale)
          : '--';
        const endStr = (data.date_fin || data.end_date)
          ? new Date((data.date_fin || data.end_date) as string).toLocaleString(currentLocale)
          : '--';

        const totalTheorique = data.montant_theorique ?? data.total_theorique ?? 0;
        const montantReel = data.montant_reel != null ? Number(data.montant_reel) : normalizeNumberInput(actualAmount);
        // Solde à justifier = théorique backend (inclut recouvrements + fond + entrées - sorties)
        const soldeOp = totalTheorique;

        const getModeLabel = (mode: string) => getPaymentModeLabel(mode, t);

        const displayDetails = Object.entries(data.details || {}).filter(
          ([key]) => !key.startsWith('__') && key !== 'mouvements_audit' && key !== 'mouvements'
        );

        const manualMovements = (data.mouvements_manuels || []).map((m) => ({
          type: m.type,
          montant: m.montant,
          motif: m.motif,
          user_nom: data.user || 'Caissier',
          date: data.date_fin || data.end_date
        }));
        const existingMovements = (data.mouvements_audit || ((data.details as Record<string, unknown>)?.mouvements_audit as Array<{ type: string; montant: number; motif: string; user_nom?: string; date?: string }>) || []).map((m) => ({
          type: m.type,
          montant: m.montant,
          motif: m.motif,
          user_nom: m.user_nom,
          date: m.date
        }));
        const allMovements: MovementPrintItem[] = [...manualMovements, ...existingMovements];

        const content = `
          <div style="font-family: monospace; width: 80mm; margin: 0 auto; padding: 10px; color: black; line-height: 1.2;">
              <div style="text-align: center; margin-bottom: 10px; border-bottom: 0.5px solid #999; padding-bottom: 5px;">
                  <h2 style="margin: 0; font-size: 1.1em; font-weight: 500;">${escHtml(pharmacySettings?.pharmacy_name || 'Ma Pharmacie')}</h2>
                  <div style="font-size: 0.8em; margin-top: 2px;">${t('print.report_title')}</div>
              </div>

              <div style="font-size: 0.8em; margin-bottom: 10px;">
                  <div style="display: flex; justify-content: space-between;">
                      <span>${t('print.print_date')}:</span>
                      <span>${formatDateTime(new Date().toISOString())}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                      <span>${t('print.operator')}:</span>
                      <span>${escHtml(data.user || 'Admin')}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-top: 5px; border-top: 1px dotted #ccc; padding-top: 5px;">
                      <span>${t('print.from')}: ${startStr}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                      <span>${t('print.to')}: ${endStr}</span>
                  </div>
              </div>

              <div style="margin-bottom: 10px; background: #fff; padding: 5px; border: 0.5px solid #ccc;">
                  <div style="font-weight: 500; margin-bottom: 3px; border-bottom: 0.5px solid #999; font-size: 0.85em;">${t('print.activity_title')}</div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                      <span>Ventes Pharmacie</span>
                      <span>${formatCurrencyLocal(data.total_ca_pharmacie ?? (data.details_paiement?.__meta__?.total_ca_pharmacie) ?? data.total_ventes ?? 0)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                      <span>Ventes Diverses</span>
                      <span>${formatCurrencyLocal(data.total_ca_divers ?? data.details_paiement?.__meta__?.total_ca_divers ?? 0)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-top: 3px; padding-top: 2px; border-top: 1px dashed #ccc;">
                      <span style="font-weight: 500;">Total Ventes</span>
                      <span style="font-weight: 500;">${formatCurrencyLocal(data.total_ventes ?? 0)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                      <span>${t('print.misc_entries')}</span>
                      <span>${formatCurrencyLocal(data.total_entrees ?? 0)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                      <span>${t('print.expenses')}</span>
                      <span>-${formatCurrencyLocal(data.total_sorties ?? 0)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-weight: 500; border-top: 0.5px dashed #999; margin-top: 3px; padding-top: 2px;">
                      <span>${t('print.solde_to_justify')}</span>
                      <span>${formatCurrencyLocal(soldeOp)}</span>
                  </div>
              </div>

              ${allMovements.length > 0 ? `
              <div style="margin-bottom: 10px;">
                  <div style="font-weight: 500; margin-bottom: 3px; border-bottom: 0.5px solid #999; font-size: 0.85em;">${t('print.expense_details')}</div>
                  ${allMovements.map((m: MovementPrintItem) => `
                      <div style="display: flex; justify-content: space-between; font-size: 0.75em; margin-bottom: 2px;">
                          <span style="max-width: 70%;">${escHtml(m.motif)} (${escHtml(m.user_nom)})</span>
                          <span style="font-weight: 500;">${formatCurrencyLocal(m.montant)}</span>
                      </div>
                  `).join('')}
              </div>
              ` : ''}

              <div style="margin-bottom: 15px;">
                  <div style="font-weight: 500; margin-bottom: 3px; border-bottom: 0.5px solid #999; font-size: 0.85em;">${t('print.mode_summary')}</div>
                  ${displayDetails.map(([mode, montant]) => `
                      <div style="display: flex; justify-content: space-between; font-size: 0.8em; margin-bottom: 1px;">
                          <span style="text-transform: capitalize;">${getModeLabel(mode)}</span>
                          <span>${formatCurrencyLocal(normalizeNumberInput(montant as string | number | null | undefined))}</span>
                      </div>
                  `).join('')}
              </div>

              <div style="border-top: 0.5px solid #999; padding-top: 5px; margin-top: 5px;">
                  <div style="display: flex; justify-content: space-between; font-weight: 500; font-size: 1.05em;">
                      <span>${t('print.total_to_justify')}</span>
                      <span>${formatCurrencyLocal(totalTheorique)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-top: 3px;">
                      <span>${t('print.actual_amount')}</span>
                      <span>${formatCurrencyLocal(montantReel)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-weight: 500; border-top: 0.5px solid #999; margin-top: 3px; padding-top: 3px;">
                      <span>${t('print.cash_gap')}</span>
                      <span>${formatCurrencyLocal(montantReel - totalTheorique)}</span>
                  </div>
              </div>

              <div style="display: flex; justify-content: space-between; margin-top: 30px; font-size: 0.7em;">
                  <div style="text-align: center; width: 45%;">
                      <p style="margin-bottom: 30px; border-bottom: 1px solid #ccc; padding-bottom: 2px;">${t('print.cashier')}</p>
                  </div>
                  <div style="text-align: center; width: 45%;">
                      <p style="margin-bottom: 30px; border-bottom: 1px solid #ccc; padding-bottom: 2px;">${t('print.manager')}</p>
                  </div>
              </div>

              <div style="text-align: center; font-size: 0.6em; margin-top: 15px; font-style: italic; opacity: 0.5;">
                  ${t('print.footer', { date: formatDate(new Date().toISOString()) })}
              </div>
          </div>
        `;

        writePrintDocument(win, '<html><head><title>' + t('print.window_title') + '</title><style>body { font-family: monospace; padding: 0; margin: 0; } @media print { body { padding: 0; margin: 0; } }</style></head><body>' + content + '</body></html>');
        win.print();
      }
    },
    [pharmacySettings, actualAmount, closingTotals, currentLocale, currencySymbol, t, formatCurrencyLocal]
  );

  return {
    handleImprimerCloture,
    formatCurrencyLocal,
    currentLocale,
  };
}
