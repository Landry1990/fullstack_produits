import i18next from 'i18next';
import { formatDateTime } from '../dateUtils';
import { getDocumentLanguage, getDocumentLocale } from '../documentLang';
import type { PromisTicketData } from '../print/promisPdfDraft';
import { COMPACT_LINE_SPACING, getTicketCols } from './ticketEscpos';
import * as esc from './encoder';

/**
 * Ticket promis en ESC/POS natif (QZ Tray) : exemplaire pharmacie + exemplaire
 * client, chacun suivi d'une coupe partielle (remplace le « découper ici »).
 */
export function buildPromisEscpos(data: PromisTicketData): string {
  const t = i18next.getFixedT(getDocumentLanguage(), 'printing');
  const docLocale = getDocumentLocale();
  const cols = getTicketCols(data.pharmacy);
  const dateStr = formatDateTime(data.date ? new Date(data.date) : new Date(), docLocale);
  const statusText = data.status_label ?? (data.is_paid ? t('promis.status_paid') : t('promis.status_to_pay'));
  const ids = data.items.map((i) => i.id).filter(Boolean).join(', ');

  const copy = (title: string): string => {
    const parts: string[] = [esc.lineSpacing(COMPACT_LINE_SPACING)];

    // HEADER
    parts.push(esc.center(), esc.defaultLineSpacing(), esc.doubleSize(true), esc.boldOn());
    parts.push(esc.line((data.pharmacy.pharmacy_name || '').toUpperCase()));
    parts.push(esc.normalSize(), esc.boldOff(), esc.lineSpacing(COMPACT_LINE_SPACING));
    parts.push(
      esc.joinedLines(
        [data.pharmacy.phone ? `${t('reglement.phone_short')}${data.pharmacy.phone}` : null, data.pharmacy.city],
        cols
      )
    );
    parts.push(esc.boldOn(), esc.line(t('promis.ticket_title')), esc.boldOff());
    parts.push(esc.line(`(${title})`));
    parts.push(esc.left(), esc.hr(cols));

    // CLIENT
    const clientLeft = `${t('promis.client_label')} ${data.client_name}`;
    const phone = data.client_phone ? `${t('reglement.phone_short')}${data.client_phone}` : '';
    if (phone && clientLeft.length + 1 + phone.length <= cols) {
      parts.push(esc.columns(clientLeft, phone, cols));
    } else {
      parts.push(esc.line(clientLeft));
      if (phone) parts.push(esc.line(phone));
    }
    parts.push(esc.columns(t('reglement.date'), dateStr, cols));
    if (data.facture_id) parts.push(esc.line(t('promis.ref_transaction', { id: data.facture_id })));
    parts.push(esc.hr(cols));

    // PRODUITS
    parts.push(esc.boldOn(), esc.columns(t('promis.col_product'), t('promis.col_qty'), cols), esc.boldOff());
    for (const item of data.items) {
      const qty = String(item.promisQuantity);
      const code = item.produit?.cip1 || item.produit?.cip2;
      if (item.produit_nom.length + 1 + qty.length <= cols) {
        parts.push(esc.columns(item.produit_nom, qty, cols));
        if (code) parts.push(esc.line(`  ${t('promis.code', { code })}`));
      } else {
        parts.push(esc.line(item.produit_nom));
        parts.push(esc.columns(code ? `  ${t('promis.code', { code })}` : '', qty, cols));
      }
    }
    parts.push(esc.hr(cols));

    // FOOTER
    parts.push(esc.center(), esc.boldOn(), esc.line(statusText), esc.boldOff());
    parts.push(esc.line(t('promis.keep_for_pickup')));
    if (ids) parts.push(esc.line(t('promis.promis_no', { ids })));
    parts.push(esc.left(), esc.defaultLineSpacing());
    parts.push(esc.feed(2), esc.cut(true));
    return parts.join('');
  };

  return esc.init() + copy(t('promis.store_copy')) + copy(t('promis.customer_copy'));
}
