import i18next from 'i18next';
import type { CouponMonnaie, PharmacySettings } from '../../types';
import { formatCurrency } from '../formatters';
import { getDocumentLocale, getDocumentLanguage } from '../documentLang';
import { COMPACT_LINE_SPACING, getTicketCols } from './ticketEscpos';
import * as esc from './encoder';

/** Coupon de monnaie en ESC/POS natif (QZ Tray), même contenu que la version HTML. */
export function buildCouponEscpos(coupon: CouponMonnaie, settings: PharmacySettings): string {
  const docLocale = getDocumentLocale();
  const t = i18next.getFixedT(getDocumentLanguage(), 'printing');
  const cols = getTicketCols(settings);

  const dateStr = new Date(coupon.date_creation).toLocaleString(docLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const location = [settings.city, settings.country].filter(Boolean).join(', ');

  const parts: string[] = [esc.init(), esc.lineSpacing(COMPACT_LINE_SPACING)];

  // HEADER
  parts.push(esc.center(), esc.defaultLineSpacing(), esc.doubleSize(true), esc.boldOn());
  parts.push(esc.line(settings.pharmacy_name || t('coupon.pharmacy_fallback')));
  parts.push(esc.normalSize(), esc.boldOff(), esc.lineSpacing(COMPACT_LINE_SPACING));
  parts.push(
    esc.joinedLines([location, settings.phone ? `${t('invoice.tel')}: ${settings.phone}` : null], cols),
    esc.joinedLines(
      [
        settings.niu ? `${t('invoice.niu')}: ${settings.niu}` : null,
        settings.registre_commerce ? `${t('invoice.rc')}: ${settings.registre_commerce}` : null,
      ],
      cols
    )
  );
  parts.push(esc.hr(cols, '='));

  // CORPS DU COUPON
  parts.push(esc.boldOn(), esc.line(t('coupon.title').toUpperCase()));
  parts.push(esc.defaultLineSpacing(), esc.doubleSize(true));
  parts.push(esc.line(`#${coupon.numero}`));
  parts.push(esc.line(formatCurrency(Math.round(Number(coupon.montant)), docLocale)));
  parts.push(esc.normalSize(), esc.boldOff(), esc.lineSpacing(COMPACT_LINE_SPACING));
  parts.push(esc.hr(cols, '='));

  // INFOS
  parts.push(esc.left());
  parts.push(esc.columns(t('coupon.status'), coupon.status_display || coupon.status, cols));
  parts.push(esc.columns(t('coupon.generated_by'), coupon.cree_par_nom || t('coupon.system'), cols));
  parts.push(esc.columns(t('coupon.date'), dateStr, cols));
  if (coupon.facture_origine) {
    parts.push(esc.columns(t('coupon.origin_invoice'), `#${coupon.facture_origine}`, cols));
  }
  if (coupon.notes) {
    parts.push(esc.lf(), esc.line(`${t('coupon.notes')}: ${coupon.notes}`));
  }
  parts.push(esc.hr(cols));

  // FOOTER
  parts.push(esc.center());
  parts.push(esc.line(t('coupon.validity')));
  parts.push(esc.line(settings.ticket_footer_message || t('ticket.visit_thanks')));
  parts.push(esc.left(), esc.defaultLineSpacing());

  parts.push(esc.feed(2), esc.cut(true));
  return parts.join('');
}
