/**
 * Templates d'impression centralisés
 * 
 * Ces fonctions génèrent du HTML prêt à imprimer pour différents types de documents.
 */

import i18next from 'i18next';
import { formatMoney, formatDateFr, getModeLabel, escHtml } from './printHelpers';
import { formatDate, formatDateTime } from '../dateUtils';
import { getDocumentLanguage, getDocumentLocale } from '../documentLang';

// ============== TYPES ==============

interface ClotureData {
  id: number;
  date: string;
  montant_reel: string | number;
  montant_theorique: string | number;
  ecart_caisse: string | number;
  total_ventes: string | number;
  total_ca_pharmacie?: string | number;
  total_ca_divers?: string | number;
  total_entrees: string | number;
  total_sorties: string | number;
  details_paiement: Record<string, unknown>;
  date_debut?: string | null;
  date_fin?: string | null;
  user_name?: string;
  username?: string;
  observation?: string | null;
  pharmacy_name?: string;
}

interface PromisData {
  id: number;
  client_name?: string;
  client_phone?: string;
  produit_nom?: string;
  quantite: number;
  date_promis?: string;
  notes?: string;
}

interface StockRayonData {
  rayon_name: string;
  products: Array<{
    name: string;
    stock: number;
    selling_price: number;
    code?: string;
  }>;
  total_value: number;
}

// ============== TEMPLATES ==============

/**
 * Template pour une clôture de caisse (Thermal 80mm style)
 */
export function generateClotureTemplate(
  cloture: ClotureData
): string {
  const docT = i18next.getFixedT(getDocumentLanguage(), 'printing');
  const ecart = parseFloat(String(cloture.ecart_caisse));

  return `
    <div style="font-family: sans-serif; font-size: 11px; color: #000; line-height: 1.3;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 15px;">
        <div style="font-weight: 900; font-size: 16px; text-transform: uppercase;">${escHtml(cloture.pharmacy_name || 'PHARMACIE')}</div>
        <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px;">${docT('cloture.report_title')}</div>
        <div style="margin-top: 5px; font-weight: 700; opacity: 0.7;">ID: #${cloture.id}</div>
      </div>

      <div style="margin-bottom: 12px; display: flex; flex-direction: column; gap: 3px;">
        <div style="display: flex; justify-content: space-between;">
           <span style="font-weight: 700;">${docT('cloture.date')}:</span>
           <span>${formatDateFr(cloture.date)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
           <span style="font-weight: 700;">${docT('cloture.cashier')}:</span>
           <span style="text-transform: uppercase;">${escHtml(cloture.user_name || cloture.username || 'N/A')}</span>
        </div>
      </div>

      <div style="border: 1px dashed #000; padding: 10px; border-radius: 4px; margin-bottom: 15px; background: #f9fafb;">
        <div style="text-align: center; font-weight: 800; text-transform: uppercase; font-size: 9px; margin-bottom: 8px; opacity: 0.6; letter-spacing: 2px;">${docT('cloture.closed_period')}</div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
           <span style="font-weight: 700; font-size: 10px;">${docT('cloture.from')}:</span>
           <span>${cloture.date_debut ? formatDateFr(cloture.date_debut) : docT('cloture.beginning')}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
           <span style="font-weight: 700; font-size: 10px;">${docT('cloture.to')}:</span>
           <span>${cloture.date_fin ? formatDateFr(cloture.date_fin) : docT('cloture.now')}</span>
        </div>
      </div>

      <div style="margin-bottom: 15px;">
        <div style="font-weight: 900; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 8px; font-size: 10px;">${docT('cloture.details_by_mode')}</div>
        ${Object.entries(cloture.details_paiement || {}).map(([mode, montant]) =>
    `<div style="display: flex; justify-content: space-between; padding: 2px 0;">
             <span style="font-weight: 600;">${getModeLabel(mode)}</span>
             <span style="font-weight: 700;">${formatMoney(montant as string | number)} F</span>
           </div>`
  ).join('')}
      </div>

      <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 10px 0; margin-bottom: 15px; display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; justify-content: space-between; font-size: 10px;">
           <span style="font-weight: 600;">${docT('cloture.pharmacy_sales')}:</span>
           <span style="font-weight: 700;">${formatMoney(cloture.total_ca_pharmacie ?? ((cloture.details_paiement?.__meta__ as Record<string, unknown> | undefined)?.total_ca_pharmacie as string | number | undefined) ?? cloture.total_ventes)} F</span>
        </div>
        ${((Number(cloture.total_ca_divers ?? (cloture.details_paiement?.__meta__ as Record<string, unknown> | undefined)?.total_ca_divers ?? 0)) > 0) ? `
        <div style="display: flex; justify-content: space-between; font-size: 10px;">
           <span style="font-weight: 600;">${docT('cloture.misc_sales')}:</span>
           <span style="font-weight: 700;">${formatMoney((cloture.total_ca_divers ?? (cloture.details_paiement?.__meta__ as Record<string, unknown> | undefined)?.total_ca_divers ?? 0) as string | number)} F</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 2px; padding-top: 2px; border-top: 1px dashed #ccc;">
           <span style="font-weight: 600;">${docT('cloture.total_sales')}:</span>
           <span style="font-weight: 800;">${formatMoney(cloture.total_ventes)} F</span>
        </div>
        ` : `
        <div style="display: flex; justify-content: space-between;">
           <span style="font-weight: 600;">${docT('cloture.total_sales')}:</span>
           <span style="font-weight: 800;">${formatMoney(cloture.total_ventes)} F</span>
        </div>
        `}
        <div style="display: flex; justify-content: space-between; font-size: 10px;">
           <span style="color: #059669;">+ ${docT('cloture.entries')}:</span>
           <span style="font-weight: 700;">${formatMoney(cloture.total_entrees)} F</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 10px;">
           <span style="color: #dc2626;">- ${docT('cloture.exits')}:</span>
           <span style="font-weight: 700;">${formatMoney(cloture.total_sorties)} F</span>
        </div>
      </div>

      <div style="background: #000; color: #fff; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
           <span style="opacity: 0.7; font-size: 10px; font-weight: 700; text-transform: uppercase;">${docT('cloture.theoretical')}</span>
           <span style="font-weight: 800; font-size: 12px;">${formatMoney(cloture.montant_theorique)} F</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.2); margin-bottom: 8px;">
           <span style="opacity: 0.7; font-size: 10px; font-weight: 700; text-transform: uppercase;">${docT('cloture.actual_collected')}</span>
           <span style="font-weight: 900; font-size: 14px;">${formatMoney(cloture.montant_reel)} F</span>
        </div>
        <div style="display: flex; justify-content: space-between; ${ecart < 0 ? 'color: #fca5a5;' : ecart > 0 ? 'color: #6ee7b7;' : ''}">
           <span style="font-weight: 900; font-size: 10px; text-transform: uppercase;">${docT('cloture.observed_gap')}</span>
           <span style="font-weight: 900; font-size: 12px;">${ecart > 0 ? '+' : ''}${formatMoney(cloture.ecart_caisse)} F</span>
        </div>
      </div>

      ${cloture.observation ? `
        <div style="font-size: 10px; border: 1px solid #e5e7eb; padding: 8px; border-radius: 4px; font-style: italic;">
          <div style="font-weight: 800; text-transform: uppercase; font-size: 8px; margin-bottom: 3px; color: #6b7280;">${docT('cloture.observation')}:</div>
          ${escHtml(cloture.observation)}
        </div>
      ` : ''}

      <div style="text-align: center; margin-top: 25px; padding-top: 15px; border-top: 1px solid #eee; font-size: 9px; color: #9ca3af; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">
        ${docT('cloture.end_of_report')}
      </div>
    </div>
  `;
}

/**
 * Template pour un bon de promis
 */
function generatePromisTemplate(
  promis: PromisData
): string {
  const docT = i18next.getFixedT(getDocumentLanguage(), 'printing');
  const docLocale = getDocumentLocale();
  return `
    <div style="font-family: sans-serif; font-size: 11px; color: #000; line-height: 1.4;">
      <div style="text-align: center; background: #000; color: #fff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <div style="font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">${docT('promis.title')}</div>
        <div style="margin-top: 5px; font-weight: 700; opacity: 0.8; font-size: 10px;">ID: #${promis.id}</div>
      </div>

      <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
        <div style="font-weight: 800; font-size: 9px; text-transform: uppercase; color: #6b7280; margin-bottom: 5px; letter-spacing: 1px;">${docT('promis.client_info')}</div>
        <div style="font-weight: 900; font-size: 13px;">${escHtml((promis.client_name || docT('promis.not_specified')).toUpperCase())}</div>
        ${promis.client_phone ? `<div style="font-weight: 700; color: #1e40af; margin-top: 2px;">📞 ${escHtml(promis.client_phone)}</div>` : ''}
      </div>

      <div style="background: #fdf2f2; border: 1px solid #fee2e2; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
        <div style="font-weight: 800; font-size: 9px; text-transform: uppercase; color: #b91c1c; margin-bottom: 8px; letter-spacing: 1px;">${docT('promis.promised_product')}</div>
        <div style="font-weight: 900; font-size: 12px; margin-bottom: 5px;">${escHtml(promis.produit_nom?.toUpperCase() || docT('promis.not_specified'))}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(185,28,28,0.1); pt-5; padding-top: 5px; margin-top: 5px;">
           <span style="font-weight: 700;">${docT('promis.expected_qty')}:</span>
           <span style="background: #b91c1c; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: 900; font-size: 12px;">${promis.quantite}</span>
        </div>
      </div>

      ${promis.date_promis ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-weight: 700;">
           <span>${docT('promis.expected_date')}:</span>
           <span>${formatDateFr(promis.date_promis)}</span>
        </div>
      ` : ''}

      ${promis.notes ? `
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; border-radius: 8px; margin-bottom: 20px;">
          <div style="font-weight: 700; font-size: 9px; text-transform: uppercase; margin-bottom: 4px; color: #6b7280;">${docT('promis.notes')}:</div>
          <div style="font-style: italic;">${escHtml(promis.notes)}</div>
        </div>
      ` : ''}

      <div style="text-align: center; border-top: 2px dashed #000; padding-top: 15px; font-weight: 700; font-size: 10px;">
        ${docT('promis.present_coupon')}<br/>
        <span style="font-size: 8px; font-weight: 400; font-style: italic; display: block; margin-top: 5px;">${docT('promis.generated_on', { date: formatDate(new Date().toISOString(), docLocale) })}</span>
      </div>
    </div>
  `;
}

/**
 * Template pour un état de stock par rayon
 */
function generateStockRayonTemplate(
  data: StockRayonData
): string {
  const docT = i18next.getFixedT(getDocumentLanguage(), 'printing');
  const docLocale = getDocumentLocale();
  return `
    <div style="font-family: sans-serif; font-size: 10px; color: #000; line-height: 1.2;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 12px;">
        <div style="font-weight: 900; font-size: 14px; text-transform: uppercase;">${docT('stock_rayon.title')}</div>
        <div style="font-weight: 700; color: #4b5563; font-size: 11px; margin-top: 3px;">${escHtml(data.rayon_name.toUpperCase())}</div>
      </div>

      <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 8px; color: #6b7280; font-weight: 700;">
        <span>${docT('stock_rayon.printed_on')} ${formatDateTime(new Date().toISOString(), docLocale)}</span>
        <span>${data.products.length} ${docT('stock_rayon.articles')}</span>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        <thead>
          <tr style="background: #000; color: #fff; font-size: 8px; text-transform: uppercase;">
            <th style="text-align: left; padding: 6px 4px; border-radius: 4px 0 0 0;">${docT('stock_rayon.col_designation')}</th>
            <th style="text-align: right; padding: 6px 4px; width: 30px;">${docT('stock_rayon.col_stock')}</th>
            <th style="text-align: right; padding: 6px 4px; width: 45px;">${docT('stock_rayon.col_pu')}</th>
            <th style="text-align: right; padding: 6px 4px; border-radius: 0 4px 0 0; width: 55px;">${docT('stock_rayon.col_value')}</th>
          </tr>
        </thead>
        <tbody>
          ${data.products.map((p, idx) => `
            <tr style="border-bottom: 1px solid #f3f4f6; ${idx % 2 === 0 ? 'background: #f9fafb;' : ''}">
              <td style="padding: 5px 4px; font-weight: 700; font-size: 9px; line-height: 1;">
                ${escHtml(p.name)}
              </td>
              <td style="text-align: right; padding: 5px 4px; font-weight: 900;">${p.stock}</td>
              <td style="text-align: right; padding: 5px 4px; color: #6b7280;">${formatMoney(p.selling_price)}</td>
              <td style="text-align: right; padding: 5px 4px; font-weight: 700;">${formatMoney(p.stock * p.selling_price)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="background: #000; color: #fff; padding: 10px; border-radius: 8px; text-align: right;">
        <div style="font-size: 8px; font-weight: 700; text-transform: uppercase; opacity: 0.7; margin-bottom: 2px;">${docT('stock_rayon.total_value')}</div>
        <div style="font-weight: 900; font-size: 16px;">${formatMoney(data.total_value)} <span style="font-size: 10px; font-weight: 400;">F</span></div>
      </div>
    </div>
  `;
}

/**
 * Template pour un inventaire (Thermal 80mm format)
 */
function generateInventaireTemplate(
  inventaire: {
    id: number;
    date: string;
    status: string;
    user_name?: string;
    lignes: Array<{
      produit_nom: string;
      stock_theorique: number;
      stock_reel: number;
      ecart: number;
    }>;
    total_ecart_valeur?: number;
    pharmacy_name?: string;
  }
) : string {
  const docT = i18next.getFixedT(getDocumentLanguage(), 'printing');
  return `
    <div style="font-family: sans-serif; font-size: 10px; color: #000; line-height: 1.2;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 12px;">
        <div style="font-weight: 900; font-size: 16px; text-transform: uppercase;">${inventaire.pharmacy_name || 'PHARMACIE'}</div>
        <div style="font-weight: 800; font-size: 12px; text-transform: uppercase; margin-top: 4px;">${docT('inventaire.title')}</div>
        <div style="font-weight: 700; color: #4b5563; font-size: 11px; margin-top: 3px;">${docT('inventaire.report_number', { id: inventaire.id })}</div>
      </div>

      <div style="margin-bottom: 10px; display: flex; flex-direction: column; gap: 2px; font-size: 9px;">
        <div style="display: flex; justify-content: space-between;">
           <span style="font-weight: 700;">${docT('inventaire.date')}:</span>
           <span>${formatDateFr(inventaire.date)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
           <span style="font-weight: 700;">${docT('inventaire.operator')}:</span>
           <span style="text-transform: uppercase;">${inventaire.user_name || docT('inventaire.pharmacist')}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
           <span style="font-weight: 700;">${docT('inventaire.status')}:</span>
           <span style="background: #000; color: #fff; padding: 1px 6px; border-radius: 3px; font-size: 8px; font-weight: 800;">${inventaire.status}</span>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        <thead>
          <tr style="border-bottom: 1.5px solid #000; font-size: 8px; text-transform: uppercase;">
            <th style="text-align: left; padding: 4px 2px;">${docT('inventaire.col_designation')}</th>
            <th style="text-align: right; padding: 4px 2px;">${docT('inventaire.col_theo')}</th>
            <th style="text-align: right; padding: 4px 2px;">${docT('inventaire.col_real')}</th>
            <th style="text-align: right; padding: 4px 2px;">${docT('inventaire.col_gap')}</th>
          </tr>
        </thead>
        <tbody>
          ${inventaire.lignes.map(l => `
            <tr style="border-bottom: 1px solid #f3f4f6; ${l.ecart !== 0 ? 'background: #fff5f5;' : ''}">
              <td style="padding: 4px 2px; font-weight: 600;">${l.produit_nom}</td>
              <td style="text-align: right; padding: 4px 2px; opacity: 0.6;">${l.stock_theorique}</td>
              <td style="text-align: right; padding: 4px 2px; font-weight: 700;">${l.stock_reel}</td>
              <td style="text-align: right; padding: 4px 2px; font-weight: 900; ${l.ecart < 0 ? 'color: #dc2626;' : l.ecart > 0 ? 'color: #059669;' : ''}">
                ${l.ecart > 0 ? '+' : ''}${l.ecart}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${inventaire.total_ecart_valeur !== undefined ? `
        <div style="background: ${inventaire.total_ecart_valeur < 0 ? '#fef2f2' : '#f0fdf4'}; border: 1px solid ${inventaire.total_ecart_valeur < 0 ? '#fee2e2' : '#dcfce7'}; padding: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
           <span style="font-weight: 800; font-size: 9px; text-transform: uppercase; color: ${inventaire.total_ecart_valeur < 0 ? '#b91c1c' : '#15803d'};">${docT('inventaire.total_gap_value')}</span>
           <span style="font-weight: 900; font-size: 13px; color: ${inventaire.total_ecart_valeur < 0 ? '#b91c1c' : '#15803d'};">${formatMoney(inventaire.total_ecart_valeur)} F</span>
        </div>
      ` : ''}

      <div style="text-align: center; margin-top: 15px; font-size: 8px; color: #9ca3af; font-weight: 600; text-transform: uppercase;">
        ${docT('inventaire.lines_summary', { total: inventaire.lignes.length, gaps: inventaire.lignes.filter(l => l.ecart !== 0).length })}
      </div>
    </div>
  `;
}

const _printTemplates = {
  generateClotureTemplate,
  generatePromisTemplate,
  generateStockRayonTemplate,
  generateInventaireTemplate
};

