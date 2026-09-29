import i18next from 'i18next';
import type { TicketCaisse, PharmacySettings, FactureProduit, PaymentDetails } from '../../types';
import { formatNumber } from '../formatters';
import { getDocumentLocale, getDocumentLanguage } from '../documentLang';
import * as esc from './encoder';

const CHAR_WIDTH_80 = 46;
const CHAR_WIDTH_58 = 32;

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
  const ticketWidth = settings.ticket_paper_width || 80;
  const cols = ticketWidth <= 60 ? CHAR_WIDTH_58 : CHAR_WIDTH_80;

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

  // Initialisation + page code
  parts.push(esc.init());

  // HEADER
  parts.push(esc.center());
  if (settings.pharmacy_name) {
    parts.push(esc.doubleSize(), esc.boldOn());
    parts.push(esc.line(settings.pharmacy_name));
    parts.push(esc.normalSize(), esc.boldOff());
  }
  if (settings.address) parts.push(esc.line(settings.address));
  if (settings.phone || settings.phone2) {
    const phones = [settings.phone, settings.phone2].filter(Boolean).join(' / ');
    parts.push(esc.line(`${t('invoice.tel')}: ${phones}`));
  }
  if (settings.email) parts.push(esc.line(`${t('invoice.email')}: ${settings.email}`));
  if (settings.niu) parts.push(esc.line(`${t('invoice.niu')}: ${settings.niu}`));
  if (settings.registre_commerce) parts.push(esc.line(`${t('invoice.rc')}: ${settings.registre_commerce}`));
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
  parts.push(esc.columns(t('ticket.ticket_no'), barcodeValue || `#${ticket.id}`, cols));
  parts.push(esc.columns(t('invoice.date'), formatDate(ticket.date_paiement, docLocale), cols));
  parts.push(esc.columns(t('invoice.customer'), clientName, cols));
  if (ticket.client_solde_depot && Number(ticket.client_solde_depot) > 0) {
    parts.push(esc.columns(t('invoice.remaining_deposit'), formatM(ticket.client_solde_depot), cols));
  }
  if (ticket.client_points_fidelite !== undefined && ticket.client_points_fidelite !== null) {
    parts.push(esc.columns(t('ticket.points_fidelity'), `${ticket.client_points_fidelite} ${t('ticket.pts')}`, cols));
  }
  parts.push(esc.columns(t('ticket.seller'), facture?.created_by_name || t('invoice.na'), cols));
  parts.push(esc.columns(t('ticket.cashier'), ticket.user_details?.username || t('ticket.na'), cols));
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

  parts.push(esc.center(), esc.boldOn(), esc.doubleSize());
  parts.push(esc.line(t('ticket.net_a_payer_cfa')));
  parts.push(esc.line(formatM(totalTTC)));
  parts.push(esc.normalSize(), esc.boldOff(), esc.left());

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
  }
  parts.push(esc.lf(), esc.lf());
  parts.push(esc.left());

  // Coupe + tiroir optionnel
  parts.push(esc.feed(3));
  if (opts?.openDrawer) {
    parts.push(esc.drawerPulse());
  }
  parts.push(esc.cut(true));

  return parts.join('');
}
