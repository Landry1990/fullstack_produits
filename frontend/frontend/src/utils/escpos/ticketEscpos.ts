import i18next from 'i18next';
import type { TicketCaisse, PharmacySettings, FactureProduit, PaymentDetails } from '../../types';
import { formatNumber } from '../formatters';
import { getDocumentLocale, getDocumentLanguage } from '../documentLang';
import * as esc from './encoder';

const CHAR_WIDTH_80 = 46;
const CHAR_WIDTH_58 = 32;
// Interligne compact (points) : police A = 24 pts de haut, défaut imprimante ≈ 30.
export const COMPACT_LINE_SPACING = 26;

/** Nombre de colonnes (police A) selon la largeur papier configurée. */
export function getTicketCols(settings: PharmacySettings): number {
  return (settings.ticket_paper_width || 80) <= 60 ? CHAR_WIDTH_58 : CHAR_WIDTH_80;
}

function formatDate(dateStr: string, locale: string): string {
  try {
    return new Date(dateStr).toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatMoney(value: number | string, locale: string): string {
  return formatNumber(Math.round(Number(value)), 0, locale);
}

function getProductName(p: FactureProduit, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!p) return t('ticket.unknown_article');
  if (typeof p.produit === 'object' && p.produit?.name) return p.produit.name;
  return p.produit_nom || `${t('ticket.product')} #${p.produit || '?'}`;
}

function getModeLabel(mode: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  return t(`ticket.payment_modes.${mode}`, { defaultValue: mode?.toUpperCase() || 'N/A' });
}

function getPaymentRowLabel(
  paiement: PaymentDetails,
  isTiersPayant: boolean,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (isTiersPayant && paiement.part_assurance != null && Number(paiement.part_assurance) > 0) {
    return t('ticket.part_assurance_row', { mode: getModeLabel(paiement.mode, t) });
  }
  if (isTiersPayant && paiement.part_patient != null && Number(paiement.part_patient) > 0) {
    return t('ticket.part_patient_row', { mode: getModeLabel(paiement.mode, t) });
  }
  return getModeLabel(paiement.mode, t);
}

interface BuildTicketEscposOptions {
  openDrawer?: boolean;
}

export function buildTicketEscpos(
  ticket: TicketCaisse,
  settings: PharmacySettings,
  opts?: BuildTicketEscposOptions
): string {
  const docLocale = getDocumentLocale();
  const docLang = getDocumentLanguage();
  const t = i18next.getFixedT(docLang, 'printing');
  const formatM = (val: number | string) => formatMoney(val, docLocale);

  const facture = typeof ticket.facture === 'object' ? ticket.facture : null;
  const isTiersPayant = facture?.client_type === 'PROFESSIONNEL';
  const produits = facture?.produits || [];
  const cols = getTicketCols(settings);

  const totalTTC = Math.round(Number(ticket.montant || facture?.total_ttc || 0));
  const totalTVA = facture ? Math.round(Number(facture.total_tva || 0)) : 0;
  const totalHT = totalTTC - totalTVA;
  const remiseGlobale = facture ? Number(facture.remise || 0) : 0;
  const totalRemisesLignes = produits.reduce(
    (sum: number, p: FactureProduit) => sum + Math.abs(Number(p.quantity || 0)) * Number(p.discount || 0),
    0
  );
  const sousTotalBrut = produits.reduce(
    (sum: number, p: FactureProduit) => sum + Math.abs(Number(p.quantity || 0)) * Number(p.selling_price || 0),
    0
  );
  const hasDiscount = totalRemisesLignes > 0 || remiseGlobale > 0;

  const clientName =
    ticket.client_name ||
    facture?.client_name_override ||
    facture?.client_name ||
    (facture?.client && typeof facture.client === 'object' && 'name' in facture.client
      ? String((facture.client as Record<string, unknown>).name)
      : null) ||
    t('invoice.walk_in_customer');

  const barcodeValue = ticket.facture_numero || facture?.numero_facture || '';

  const parts: string[] = [];

  // Deux paires label/valeur sur une ligne (gauche/droite) si elles tiennent, sinon deux lignes classiques.
  const pairedColumns = (l1: string, v1: string, l2: string, v2: string, sep = ' '): string[] => {
    const leftPart = `${l1}${sep}${v1}`;
    const rightPart = `${l2}${sep}${v2}`;
    return leftPart.length + 1 + rightPart.length <= cols
      ? [esc.columns(leftPart, rightPart, cols)]
      : [esc.columns(l1, v1, cols), esc.columns(l2, v2, cols)];
  };

  // Initialisation + page code + interligne compact
  parts.push(esc.init(), esc.lineSpacing(COMPACT_LINE_SPACING));

  // HEADER
  parts.push(esc.center());
  if (settings.pharmacy_name) {
    parts.push(esc.defaultLineSpacing(), esc.doubleSize(true), esc.boldOn());
    parts.push(esc.line(settings.pharmacy_name));
    parts.push(esc.normalSize(), esc.boldOff(), esc.lineSpacing(COMPACT_LINE_SPACING));
  }
  if (settings.address) parts.push(esc.line(settings.address));
  const phones = [settings.phone, settings.phone2].filter(Boolean).join(' / ');
  parts.push(
    esc.joinedLines(
      [phones ? `${t('invoice.tel')}: ${phones}` : null, settings.email ? `${t('invoice.email')}: ${settings.email}` : null],
      cols
    ),
    esc.joinedLines(
      [
        settings.niu ? `${t('invoice.niu')}: ${settings.niu}` : null,
        settings.registre_commerce ? `${t('invoice.rc')}: ${settings.registre_commerce}` : null,
      ],
      cols
    )
  );
  if (settings.show_pharmacist_on_documents && settings.pharmacist_name) {
    parts.push(esc.line(`${t('invoice.pharmacist')}: ${settings.pharmacist_name}`));
  }
  if (settings.receipt_header) parts.push(esc.line(settings.receipt_header));
  parts.push(esc.left());
  parts.push(esc.hr(cols));

  // DUPLICATA
  if (ticket.is_duplicate) {
    parts.push(esc.center(), esc.boldOn());
    parts.push(esc.line(`*** ${t('ticket.duplicate')} ***`));
    parts.push(esc.boldOff(), esc.left());
  }

  // INFOS TICKET
  const ticketNo = barcodeValue || `#${ticket.id}`;
  const dateStr = formatDate(ticket.date_paiement, docLocale);
  if (`${t('ticket.ticket_no')} ${ticketNo}`.length + 1 + dateStr.length <= cols) {
    parts.push(esc.columns(`${t('ticket.ticket_no')} ${ticketNo}`, dateStr, cols));
  } else {
    parts.push(esc.columns(t('ticket.ticket_no'), ticketNo, cols));
    parts.push(esc.columns(t('invoice.date'), dateStr, cols));
  }
  parts.push(esc.columns(t('invoice.customer'), clientName, cols));
  if (ticket.client_solde_depot && Number(ticket.client_solde_depot) > 0) {
    parts.push(esc.columns(t('invoice.remaining_deposit'), formatM(ticket.client_solde_depot), cols));
  }
  if (ticket.client_points_fidelite !== undefined && ticket.client_points_fidelite !== null) {
    parts.push(esc.columns(t('ticket.points_fidelity'), `${ticket.client_points_fidelite} ${t('ticket.pts')}`, cols));
  }
  parts.push(
    ...pairedColumns(
      t('ticket.seller'),
      facture?.created_by_name || t('invoice.na'),
      t('ticket.cashier'),
      ticket.user_details?.username || t('ticket.na'),
      ': '
    )
  );
  parts.push(esc.hr(cols));

  // PRODUITS
  parts.push(esc.columns(t('invoice.designation'), t('ticket.total'), cols));
  for (const p of produits) {
    const qty = Math.abs(p.quantity);
    const price = Number(p.selling_price || 0);
    const unitDiscount = Number(p.discount || 0);
    const lineDiscount = qty * unitDiscount;
    const lineTotal = qty * (price - unitDiscount);

    parts.push(esc.line(getProductName(p, t)));
    parts.push(esc.columns(`${qty} x ${formatM(price)}`, formatM(lineTotal), cols));
    if (lineDiscount > 0) {
      parts.push(esc.columns(`  ${t('ticket.line_discount')}: -${formatM(lineDiscount)}`, '', cols));
    }
  }
  parts.push(esc.hr(cols));

  // TOTAUX
  if (hasDiscount) {
    parts.push(esc.columns(t('ticket.gross_subtotal'), formatM(sousTotalBrut), cols));
  }
  if (totalRemisesLignes > 0) {
    parts.push(esc.columns(t('ticket.line_discounts_minus'), `-${formatM(totalRemisesLignes)}`, cols));
  }
  if (remiseGlobale > 0) {
    parts.push(esc.columns(t('ticket.global_discount_minus'), `-${formatM(remiseGlobale)}`, cols));
  }

  parts.push(esc.left(), esc.defaultLineSpacing());
  parts.push(esc.totalLine(t('ticket.net_a_payer_cfa'), formatM(totalTTC), cols));
  parts.push(esc.lineSpacing(COMPACT_LINE_SPACING));

  const totalLettres = ticket.total_lettres || facture?.total_lettres;
  if (totalLettres) {
    parts.push(esc.center());
    parts.push(esc.line(totalLettres));
    parts.push(esc.left());
  }
  parts.push(esc.hr(cols));

  // PAIEMENTS
  if (ticket.paiements_details && ticket.paiements_details.length > 0) {
    for (const paiement of ticket.paiements_details) {
      parts.push(esc.columns(`[${getPaymentRowLabel(paiement, isTiersPayant, t)}]`, formatM(paiement.montant), cols));
    }
  } else {
    parts.push(esc.columns(`[${getModeLabel(ticket.mode_paiement, t)}]`, formatM(totalTTC), cols));
  }

  // MONNAIE
  if (Number(ticket.montant_verse) > 0 || Number(ticket.rendu) > 0) {
    parts.push(esc.hr(cols));
    if (Number(ticket.montant_verse) > 0) {
      parts.push(esc.columns(t('ticket.cash_received'), formatM(ticket.montant_verse || 0), cols));
    }
    if (Number(ticket.rendu) > 0) {
      parts.push(esc.columns(t('ticket.change_returned'), formatM(ticket.rendu || 0), cols));
    }
  }

  // TVA
  if (totalTVA > 0) {
    parts.push(esc.center());
    parts.push(esc.line(`${t('ticket.base_ht')}: ${formatM(totalHT)} | ${t('ticket.tva')}: ${formatM(totalTVA)}`));
    parts.push(esc.left());
  }

  // FOOTER
  parts.push(esc.center());
  parts.push(esc.line(settings.ticket_footer_message || t('ticket.visit_thanks')));
  if (barcodeValue) {
    parts.push(esc.barcodeCODE128(barcodeValue));
    // Le HRI est désactivé (GS H 0) — on imprime le numéro en clair sous le
    // code-barres comme dans l'aperçu HTML, avec de l'air autour.
    parts.push(esc.lf());
    parts.push(esc.line(barcodeValue));
  }
  parts.push(esc.line('ZENITH POS SYSTEM'));
  parts.push(esc.left(), esc.defaultLineSpacing());

  // Coupe + tiroir optionnel
  parts.push(esc.feed(2));
  if (opts?.openDrawer) {
    parts.push(esc.drawerPulse());
  }
  parts.push(esc.cut(true));

  return parts.join('');
}
