import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters';
import { escHtml, writePrintDocument } from '../../utils/print/printHelpers';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { getPaymentModeLabel } from '../../config/paymentModes';
import { useDocumentLocale } from '../../context/PharmacySettingsContext';
import type { PharmacySettings } from '../../types';

export interface ClosingPrintData {
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
  /** Ref vers actualAmount (string) — mis à jour par le closing hook */
  actualAmountRef: React.MutableRefObject<string>;
  /** Ref vers closingTotals — mis à jour par le closing hook */
  closingTotalsRef: React.MutableRefObject<ClosingPrintData | null>;
}

/**
 * Gère l'impression du rapport de clôture de caisse.
 * Extrait de useJournalCaisse.ts (~140 lignes de HTML/template).
 *
 * Utilise des refs pour actualAmount et closingTotals afin d'éviter
 * les dépendances circulaires avec le closing hook.
 */
export function useJournalCaissePrinting({
  pharmacySettings,
  actualAmountRef,
  closingTotalsRef,
}: UseJournalCaissePrintingParams) {
  // t / currentLocale / formatCurrencyLocal restent dans la langue de
  // l'interface (réutilisés par les composants UI via useJournalCaisse).
  const { t } = useTranslation(['cash_journal', 'common']);
  const currentLocale = t('common:locale', { defaultValue: 'fr-FR' });
  const currencySymbol = t(['common:currency_symbol', 'currency_symbol'], 'F');

  // docT / docLocale : langue du document imprimé (PharmacySettings.locale),
  // découplée de la langue de l'interface.
  const { lang: docLang, locale: docLocale } = useDocumentLocale();
  const { t: docT } = useTranslation(['cash_journal', 'common'], { lng: docLang });
  const docCurrencySymbol = docT(['common:currency_symbol', 'currency_symbol'], 'F');

  const formatCurrencyLocal = useCallback(
    (amount: number) => formatCurrency(amount, currentLocale, currencySymbol),
    [currentLocale, currencySymbol]
  );

  const formatCurrencyDoc = useCallback(
    (amount: number) => formatCurrency(amount, docLocale, docCurrencySymbol),
    [docLocale, docCurrencySymbol]
  );

  const handleImprimerCloture = useCallback(
    (dataToPrint?: ClosingPrintData) => {
      const data: ClosingPrintData = dataToPrint || closingTotalsRef.current || {};

      const win = window.open('about:blank', '_blank', 'width=800,height=600');
      if (win) {
        const startStr = (data.date_debut || data.start_date)
          ? new Date((data.date_debut || data.start_date) as string).toLocaleString(docLocale)
          : '--';
        const endStr = (data.date_fin || data.end_date)
          ? new Date((data.date_fin || data.end_date) as string).toLocaleString(docLocale)
          : '--';

        const totalTheorique = data.montant_theorique ?? data.total_theorique ?? 0;
        const montantReel = data.montant_reel != null ? Number(data.montant_reel) : normalizeNumberInput(actualAmountRef.current);
        // Solde à justifier = théorique backend (inclut recouvrements + fond + entrées - sorties)
        const soldeOp = totalTheorique;

        const getModeLabel = (mode: string) => getPaymentModeLabel(mode, docT);

        const displayDetails = Object.entries(data.details || {}).filter(
          ([key]) => !key.startsWith('__') && key !== 'mouvements_audit' && key !== 'mouvements'
        );

        const manualMovements = (data.mouvements_manuels || []).map((m) => ({
          type: m.type,
          montant: m.montant,
          motif: m.motif,
          user_nom: data.user || docT('print.default_cashier'),
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
                  <h2 style="margin: 0; font-size: 1.1em; font-weight: 500;">${escHtml(pharmacySettings?.pharmacy_name || docT('print.default_pharmacy'))}</h2>
                  <div style="font-size: 0.8em; margin-top: 2px;">${docT('print.report_title')}</div>
              </div>

              <div style="font-size: 0.8em; margin-bottom: 10px;">
                  <div style="display: flex; justify-content: space-between;">
                      <span>${docT('print.print_date')}:</span>
                      <span>${formatDateTime(new Date().toISOString(), docLocale)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                      <span>${docT('print.operator')}:</span>
                      <span>${escHtml(data.user || docT('print.default_admin'))}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-top: 5px; border-top: 1px dotted #ccc; padding-top: 5px;">
                      <span>${docT('print.from')}: ${startStr}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                      <span>${docT('print.to')}: ${endStr}</span>
                  </div>
              </div>

              <div style="margin-bottom: 10px; background: #fff; padding: 5px; border: 0.5px solid #ccc;">
                  <div style="font-weight: 500; margin-bottom: 3px; border-bottom: 0.5px solid #999; font-size: 0.85em;">${docT('print.activity_title')}</div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                      <span>${docT('print.pharmacy_sales')}</span>
                      <span>${formatCurrencyDoc(data.total_ca_pharmacie ?? (data.details_paiement?.__meta__?.total_ca_pharmacie) ?? data.total_ventes ?? 0)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                      <span>${docT('print.misc_sales')}</span>
                      <span>${formatCurrencyDoc(data.total_ca_divers ?? data.details_paiement?.__meta__?.total_ca_divers ?? 0)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-top: 3px; padding-top: 2px; border-top: 1px dashed #ccc;">
                      <span style="font-weight: 500;">${docT('print.total_sales')}</span>
                      <span style="font-weight: 500;">${formatCurrencyDoc(data.total_ventes ?? 0)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                      <span>${docT('print.misc_entries')}</span>
                      <span>${formatCurrencyDoc(data.total_entrees ?? 0)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                      <span>${docT('print.expenses')}</span>
                      <span>-${formatCurrencyDoc(data.total_sorties ?? 0)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-weight: 500; border-top: 0.5px dashed #999; margin-top: 3px; padding-top: 2px;">
                      <span>${docT('print.solde_to_justify')}</span>
                      <span>${formatCurrencyDoc(soldeOp)}</span>
                  </div>
              </div>

              ${allMovements.length > 0 ? `
              <div style="margin-bottom: 10px;">
                  <div style="font-weight: 500; margin-bottom: 3px; border-bottom: 0.5px solid #999; font-size: 0.85em;">${docT('print.expense_details')}</div>
                  ${allMovements.map((m: MovementPrintItem) => `
                      <div style="display: flex; justify-content: space-between; font-size: 0.75em; margin-bottom: 2px;">
                          <span style="max-width: 70%;">${escHtml(m.motif)} (${escHtml(m.user_nom)})</span>
                          <span style="font-weight: 500;">${formatCurrencyDoc(m.montant)}</span>
                      </div>
                  `).join('')}
              </div>
              ` : ''}

              <div style="margin-bottom: 15px;">
                  <div style="font-weight: 500; margin-bottom: 3px; border-bottom: 0.5px solid #999; font-size: 0.85em;">${docT('print.mode_summary')}</div>
                  ${displayDetails.map(([mode, montant]) => `
                      <div style="display: flex; justify-content: space-between; font-size: 0.8em; margin-bottom: 1px;">
                          <span style="text-transform: capitalize;">${getModeLabel(mode)}</span>
                          <span>${formatCurrencyDoc(normalizeNumberInput(montant as string | number | null | undefined))}</span>
                      </div>
                  `).join('')}
              </div>

              <div style="border-top: 0.5px solid #999; padding-top: 5px; margin-top: 5px;">
                  <div style="display: flex; justify-content: space-between; font-weight: 500; font-size: 1.05em;">
                      <span>${docT('print.total_to_justify')}</span>
                      <span>${formatCurrencyDoc(totalTheorique)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-top: 3px;">
                      <span>${docT('print.actual_amount')}</span>
                      <span>${formatCurrencyDoc(montantReel)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-weight: 500; border-top: 0.5px solid #999; margin-top: 3px; padding-top: 3px;">
                      <span>${docT('print.cash_gap')}</span>
                      <span>${formatCurrencyDoc(montantReel - totalTheorique)}</span>
                  </div>
              </div>

              <div style="display: flex; justify-content: space-between; margin-top: 30px; font-size: 0.7em;">
                  <div style="text-align: center; width: 45%;">
                      <p style="margin-bottom: 30px; border-bottom: 1px solid #ccc; padding-bottom: 2px;">${docT('print.cashier')}</p>
                  </div>
                  <div style="text-align: center; width: 45%;">
                      <p style="margin-bottom: 30px; border-bottom: 1px solid #ccc; padding-bottom: 2px;">${docT('print.manager')}</p>
                  </div>
              </div>

              <div style="text-align: center; font-size: 0.6em; margin-top: 15px; font-style: italic; opacity: 0.5;">
                  ${docT('print.footer', { date: formatDate(new Date().toISOString(), docLocale) })}
              </div>
          </div>
        `;

        writePrintDocument(win, '<html><head><title>' + docT('print.window_title') + '</title><style>body { font-family: monospace; padding: 0; margin: 0; } @media print { body { padding: 0; margin: 0; } }</style></head><body>' + content + '</body></html>');
        win.print();
      }
    },
    [pharmacySettings, actualAmountRef, closingTotalsRef, docLocale, docT, formatCurrencyDoc]
  );

  return {
    handleImprimerCloture,
    formatCurrencyLocal,
    currentLocale,
  };
}
