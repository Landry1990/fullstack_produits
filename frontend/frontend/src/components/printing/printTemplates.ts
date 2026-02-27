/**
 * Templates d'impression centralisés
 * 
 * Ces fonctions génèrent du HTML prêt à imprimer pour différents types de documents.
 */

import { formatMoney, formatDateFr, printRow, printDivider, printTotal } from '../../hooks/usePrint';

// ============== TYPES ==============

interface ClotureData {
  id: number;
  date: string;
  montant_reel: string | number;
  montant_theorique: string | number;
  ecart_caisse: string | number;
  total_ventes: string | number;
  total_entrees: string | number;
  total_sorties: string | number;
  details_paiement: Record<string, number>;
  date_debut?: string | null;
  date_fin?: string | null;
  user_name?: string;
  username?: string;
  observation?: string | null;
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

// ============== HELPER FUNCTIONS ==============

const getModeLabel = (mode: string): string => {
  const labels: Record<string, string> = {
    especes: '💵 Espèces',
    cheque: '📝 Chèque',
    carte: '💳 Carte',
    virement: '🏦 Virement',
    om: '🟧 Orange Money',
    momo: '📱 Mobile Money',
    en_compte: '📒 En compte'
  };
  return labels[mode] || mode;
};

// ============== TEMPLATES ==============

/**
 * Template pour une clôture de caisse
 */
export function generateClotureTemplate(
  cloture: ClotureData
): string {
  const ecart = parseFloat(String(cloture.ecart_caisse));
  const ecartStyle = ecart !== 0 ? 'color: red; font-weight: bold;' : '';

  return `
    <div style="margin-bottom: 15px; font-size: 0.85em;">
      <div style="text-align: center; font-weight: bold; margin-bottom: 10px; text-transform: uppercase;">
        Clôture de Caisse #${cloture.id}
      </div>
      
      ${printRow('Date clôture:', formatDateFr(cloture.date))}
      ${printRow('Caissier:', cloture.user_name || cloture.username || 'N/A')}
    </div>

    ${printDivider()}

    <div style="text-align: center; font-weight: bold; margin: 10px 0; text-transform: uppercase;">
      Période Clôturée
    </div>
    
    ${printRow('Du:', cloture.date_debut ? formatDateFr(cloture.date_debut) : 'Début')}
    ${printRow('Au:', cloture.date_fin ? formatDateFr(cloture.date_fin) : 'Maintenant')}

    ${printDivider()}

    <div style="font-weight: bold; margin-bottom: 8px;">DÉTAILS PAR MODE</div>
    ${Object.entries(cloture.details_paiement || {}).map(([mode, montant]) =>
    printRow(getModeLabel(mode), `${formatMoney(montant)} F`)
  ).join('')}

    ${printDivider()}

    ${printRow('Total Ventes:', `${formatMoney(cloture.total_ventes)} F`)}
    ${printRow('+ Entrées:', `${formatMoney(cloture.total_entrees)} F`)}
    ${printRow('- Sorties:', `${formatMoney(cloture.total_sorties)} F`)}

    <div class="print-total">
      ${printRow('THÉORIQUE:', `${formatMoney(cloture.montant_theorique)} F`)}
      ${printRow('RÉEL:', `${formatMoney(cloture.montant_reel)} F`)}
      <div class="print-row" style="${ecartStyle}">
        <span>ÉCART:</span>
        <span>${ecart > 0 ? '+' : ''}${formatMoney(cloture.ecart_caisse)} F</span>
      </div>
    </div>

    ${cloture.observation ? `
      ${printDivider()}
      <div style="font-size: 0.85em;">
        <strong>Observation:</strong> ${cloture.observation}
      </div>
    ` : ''}
  `;
}

/**
 * Template pour un bon de promis
 */
export function generatePromisTemplate(
  promis: PromisData
): string {
  return `
    <div style="text-align: center; font-weight: bold; margin-bottom: 15px; text-transform: uppercase;">
      BON DE PROMIS #${promis.id}
    </div>

    ${printRow('Client:', promis.client_name || 'Non spécifié')}
    ${promis.client_phone ? printRow('Téléphone:', promis.client_phone) : ''}
    
    ${printDivider()}

    <div style="font-weight: bold; margin: 10px 0;">PRODUIT PROMIS</div>
    ${printRow('Désignation:', promis.produit_nom || 'Non spécifié')}
    ${printRow('Quantité:', String(promis.quantite))}
    ${promis.date_promis ? printRow('Date prévue:', formatDateFr(promis.date_promis)) : ''}

    ${promis.notes ? `
      ${printDivider()}
      <div style="font-size: 0.85em;">
        <strong>Notes:</strong> ${promis.notes}
      </div>
    ` : ''}

    <div style="margin-top: 20px; text-align: center; font-size: 0.8em; font-style: italic;">
      Présenté ce bon pour récupérer votre commande
    </div>
  `;
}

/**
 * Template pour un état de stock par rayon
 */
export function generateStockRayonTemplate(
  data: StockRayonData
): string {
  return `
    <div style="text-align: center; font-weight: bold; margin-bottom: 15px; text-transform: uppercase;">
      ÉTAT DE STOCK<br/>
      <span style="font-size: 1.1em;">${data.rayon_name}</span>
    </div>

    <div style="font-size: 0.7em; margin-bottom: 5px;">
      Imprimé le ${new Date().toLocaleString('fr-FR')}
    </div>

    ${printDivider()}

    <table style="width: 100%; font-size: 0.8em; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 1px solid black;">
          <th style="text-align: left; padding: 3px 0;">Produit</th>
          <th style="text-align: right; padding: 3px 0;">Qté</th>
          <th style="text-align: right; padding: 3px 0;">PU</th>
          <th style="text-align: right; padding: 3px 0;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${data.products.map(p => `
          <tr style="border-bottom: 1px dotted #ccc;">
            <td style="padding: 2px 0; max-width: 100px; overflow: hidden; text-overflow: ellipsis;">
              ${p.name}
            </td>
            <td style="text-align: right; padding: 2px 0;">${p.stock}</td>
            <td style="text-align: right; padding: 2px 0;">${formatMoney(p.selling_price)}</td>
            <td style="text-align: right; padding: 2px 0;">${formatMoney(p.stock * p.selling_price)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    ${printDivider()}

    ${printTotal('VALEUR TOTALE:', `${formatMoney(data.total_value)} F`)}
    
    <div style="text-align: center; margin-top: 10px; font-size: 0.8em;">
      ${data.products.length} produit(s)
    </div>
  `;
}

/**
 * Template pour un inventaire
 */
export function generateInventaireTemplate(
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
  }
): string {
  return `
    <div style="text-align: center; font-weight: bold; margin-bottom: 15px; text-transform: uppercase;">
      INVENTAIRE #${inventaire.id}
    </div>

    ${printRow('Date:', formatDateFr(inventaire.date))}
    ${printRow('Statut:', inventaire.status)}
    ${inventaire.user_name ? printRow('Par:', inventaire.user_name) : ''}

    ${printDivider()}

    <table style="width: 100%; font-size: 0.75em; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 1px solid black;">
          <th style="text-align: left;">Produit</th>
          <th style="text-align: right;">Théo.</th>
          <th style="text-align: right;">Réel</th>
          <th style="text-align: right;">Écart</th>
        </tr>
      </thead>
      <tbody>
        ${inventaire.lignes.map(l => `
          <tr style="border-bottom: 1px dotted #ccc; ${l.ecart !== 0 ? 'font-weight: bold;' : ''}">
            <td style="padding: 2px 0;">${l.produit_nom}</td>
            <td style="text-align: right;">${l.stock_theorique}</td>
            <td style="text-align: right;">${l.stock_reel}</td>
            <td style="text-align: right; ${l.ecart < 0 ? 'color: red;' : l.ecart > 0 ? 'color: green;' : ''}">
              ${l.ecart > 0 ? '+' : ''}${l.ecart}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    ${inventaire.total_ecart_valeur !== undefined ? `
      ${printDivider()}
      ${printTotal('Écart Valeur:', `${formatMoney(inventaire.total_ecart_valeur)} F`)}
    ` : ''}

    <div style="text-align: center; margin-top: 10px; font-size: 0.8em;">
      ${inventaire.lignes.length} ligne(s) - ${inventaire.lignes.filter(l => l.ecart !== 0).length} écart(s)
    </div>
  `;
}

export default {
  generateClotureTemplate,
  generatePromisTemplate,
  generateStockRayonTemplate,
  generateInventaireTemplate
};
