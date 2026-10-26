import i18next from 'i18next';
import type { PharmacySettings } from '../../types';
import { formatNumber } from '../formatters';
import { getDocumentLocale, getDocumentLanguage } from '../documentLang';
import * as esc from './encoder';

const CHAR_WIDTH_80 = 46;
const CHAR_WIDTH_58 = 32;

export interface ClotureEscposData {
  id?: number;
  date?: string;
  date_debut?: string | null;
  start_date?: string | null;
  date_fin?: string | null;
  end_date?: string | null;
  user?: string | number | null;
  user_name?: string;
  username?: string;
  cloture_par_name?: string;
  montant_theorique?: number | string;
  total_theorique?: number | string;
  montant_reel?: number | string;
  ecart_caisse?: number | string;
  total_ventes?: number | string;
  total_entrees?: number | string;
  total_sorties?: number | string;
  total_ca_pharmacie?: number | string;
  total_ca_divers?: number | string;
  details_paiement?: Record<string, unknown>;
  details?: Record<string, unknown>;
  observation?: string | null;
}

function formatDate(dateStr: string | undefined | null, locale: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
}

function formatMoney(value: number | string | undefined | null, locale: string): string {
  if (value == null) return '0';
  return formatNumber(Math.round(Number(value)), 0, locale);
}

function normalizeRecord(
  value: Record<string, unknown> | undefined | null
): Record<string, string | number> {
  if (!value) return {};
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith('__')) continue;
    if (typeof v === 'number') out[k] = v;
    else if (typeof v === 'string') {
      const n = Number(v);
      out[k] = Number.isNaN(n) ? v : n;
    }
  }
  return out;
}

export function buildClotureEscpos(
  data: ClotureEscposData,
  settings: PharmacySettings
): string {
  const docLocale = getDocumentLocale();
  const docLang = getDocumentLanguage();
  const t = i18next.getFixedT(docLang, 'printing');
  const formatM = (val: number | string | undefined | null) => formatMoney(val, docLocale);

  const ticketWidth = settings.ticket_paper_width || 80;
  const cols = ticketWidth <= 60 ? CHAR_WIDTH_58 : CHAR_WIDTH_80;

  const pharmacyName = settings.pharmacy_name || t('cloture.pharmacy_default', { defaultValue: 'PHARMACIE' });
  const startDate = data.date_debut ?? data.start_date;
  const endDate = data.date_fin ?? data.end_date;
  const cashierName =
    data.user_name ||
    data.username ||
    data.cloture_par_name ||
    (typeof data.user === 'string' ? data.user : null) ||
    t('cloture.cashier_default', { defaultValue: 'N/A' });

  const totalTheorique = Number(
    data.montant_theorique ?? data.total_theorique ?? 0
  );
  const montantReel = Number(data.montant_reel ?? 0);
  const ecartCaisse = Number(data.ecart_caisse ?? montantReel - totalTheorique);

  const totalVentes = Number(data.total_ventes ?? 0);
  const totalEntrees = Number(data.total_entrees ?? 0);
  const totalSorties = Number(data.total_sorties ?? 0);

  const meta = (data.details_paiement?.__meta__ as Record<string, unknown> | undefined) || {};
  const totalCaPharmacie = Number(
    data.total_ca_pharmacie ?? meta?.total_ca_pharmacie ?? totalVentes
  );
  const totalCaDivers = Number(data.total_ca_divers ?? meta?.total_ca_divers ?? 0);

  const details = normalizeRecord(data.details_paiement || data.details);

  const parts: string[] = [];

  parts.push(esc.init());

  // HEADER
  parts.push(esc.center());
  parts.push(esc.doubleSize(true), esc.boldOn());
  parts.push(esc.line(pharmacyName));
  parts.push(esc.normalSize(), esc.boldOff());
  parts.push(esc.line(t('cloture.report_title')));
  parts.push(esc.left());
  parts.push(esc.hr(cols));

  // INFOS GÉNÉRALES
  parts.push(esc.columns(t('cloture.date'), formatDate(data.date, docLocale), cols));
  parts.push(esc.columns(t('cloture.cashier'), cashierName.toUpperCase(), cols));
  if (data.id) {
    parts.push(esc.columns(t('cloture.id_label', { defaultValue: 'ID' }), `#${data.id}`, cols));
  }
  parts.push(esc.hr(cols));

  // PÉRIODE
  parts.push(esc.center(), esc.boldOn());
  parts.push(esc.line(t('cloture.closed_period')));
  parts.push(esc.boldOff(), esc.left());
  parts.push(esc.columns(t('cloture.from'), formatDate(startDate, docLocale) || t('cloture.beginning'), cols));
  parts.push(esc.columns(t('cloture.to'), formatDate(endDate, docLocale) || t('cloture.now'), cols));
  parts.push(esc.hr(cols));

  // DÉTAILS PAR MODE
  parts.push(esc.center(), esc.boldOn());
  parts.push(esc.line(t('cloture.details_by_mode')));
  parts.push(esc.boldOff(), esc.left());
  if (Object.keys(details).length > 0) {
    for (const [mode, montant] of Object.entries(details)) {
      const label = t(`ticket.payment_modes.${mode}`, { defaultValue: mode.toUpperCase() });
      parts.push(esc.columns(label, `${formatM(montant)} F`, cols));
    }
  } else {
    parts.push(esc.line(t('cloture.no_details', { defaultValue: 'Aucun detail' })));
  }
  parts.push(esc.hr(cols));

  // ACTIVITÉ
  parts.push(esc.center(), esc.boldOn());
  parts.push(esc.line(t('cloture.activity_summary', { defaultValue: 'ACTIVITE' })));
  parts.push(esc.boldOff(), esc.left());
  if (totalCaDivers > 0) {
    parts.push(esc.columns(t('cloture.pharmacy_sales'), `${formatM(totalCaPharmacie)} F`, cols));
    parts.push(esc.columns(t('cloture.misc_sales'), `${formatM(totalCaDivers)} F`, cols));
    parts.push(esc.columns(t('cloture.total_sales'), `${formatM(totalVentes)} F`, cols));
  } else {
    parts.push(esc.columns(t('cloture.total_sales'), `${formatM(totalVentes)} F`, cols));
  }
  parts.push(esc.columns(t('cloture.entries'), `+${formatM(totalEntrees)} F`, cols));
  parts.push(esc.columns(t('cloture.exits'), `-${formatM(totalSorties)} F`, cols));
  parts.push(esc.hr(cols));

  // TOTALS
  parts.push(esc.columns(t('cloture.theoretical'), `${formatM(totalTheorique)} F`, cols));
  parts.push(esc.columns(t('cloture.actual_collected'), `${formatM(montantReel)} F`, cols));
  const ecartSign = ecartCaisse > 0 ? '+' : '';
  parts.push(esc.boldOn());
  parts.push(esc.columns(t('cloture.observed_gap'), `${ecartSign}${formatM(ecartCaisse)} F`, cols));
  parts.push(esc.boldOff());

  // OBSERVATION
  if (data.observation) {
    parts.push(esc.lf());
    parts.push(esc.line(`${t('cloture.observation')}: ${data.observation}`));
  }

  // FOOTER
  parts.push(esc.lf(), esc.lf());
  parts.push(esc.center());
  parts.push(esc.line('ZENITH POS SYSTEM'));
  parts.push(esc.line(t('cloture.end_of_report')));
  parts.push(esc.left());

  parts.push(esc.feed(3));
  parts.push(esc.cut(true));

  return parts.join('');
}
