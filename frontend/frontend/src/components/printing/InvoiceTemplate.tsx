import { formatDate as formatLocaleDate } from '../../utils/dateUtils';
import { formatNumber, formatCurrency } from '../../utils/formatters';
import { useTranslation } from 'react-i18next';
import { useDocumentLocale } from '../../context/PharmacySettingsContext';
import { PharmacyContactBlock } from './PharmacyContactBlock';

// Interfaces matching FacturePrintSerializer
export interface InvoiceClient {
  id?: number;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  niu?: string;
}

export interface InvoiceItem {
  produit_nom: string;
  produit_id?: number;
  quantity: number;
  selling_price: number; // TTC
  discount: number; // Remise unitaire
  tva: number;
  total_ligne?: number;
  cip?: string; // Code13Ref
  stock_lot?: unknown;
  lot?: string;
  date_expiration?: string;
}

export interface TvaAnalysisItem {
  taux: number; // ou string
  base_ht: number;
  montant_tva: number;
}

export interface InvoiceData {
  id: number;
  numero_facture: string;
  date: string;
  client: InvoiceClient | null;
  produits: InvoiceItem[];
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  remise: number;
  vendeur_nom?: string;
  validated_by_name?: string;
  type: string;
  status: string; // Added status
  montant_recu?: number;
  montant_rendu?: number;
  mode_reglement?: string;
  tva_analysis?: TvaAnalysisItem[];
  total_lettres?: string; // Added total_lettres
  notes?: string;
  client_name_override?: string;
  part_client?: number;
  part_assurance?: number;
  ayant_droit_details?: {
    nom: string;
    matricule: string;
    societe?: string;
  };
  client_solde_depot?: string;
}

export interface PharmacySettings {
  pharmacy_name: string;
  address: string;
  phone?: string;
  phone2?: string;
  email?: string;
  ticket_footer_message: string;
  niu?: string;
  registre_commerce?: string;
  pharmacist_name?: string;
  show_pharmacist_on_documents?: boolean;
  logo?: string;
  primary_color?: string;
}

interface InvoiceTemplateProps {
  settings: PharmacySettings;
  data: InvoiceData;
  isBonDeLivraison?: boolean;
  paperSize?: 'A4' | 'A5' | 'A5L';
}

const formatDate = (dateStr: string, locale?: string) => formatLocaleDate(dateStr, locale);

const formatExpiryDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${year}`;
};

const calculateHTUnit = (priceTTC: number, tva: number) => {
  return priceTTC / (1 + (Number(tva) || 0) / 100);
};

function TotalRow({ label, amount, rowClassName = '', labelClassName = 'text-micro uppercase font-bold tracking-widest pl-1', valueClassName = 'text-right font-mono font-bold text-base-content pr-2' }: {
  label: string;
  amount: React.ReactNode;
  rowClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div className={`grid grid-cols-[1fr,115px] items-center px-1 ${rowClassName}`}>
      <span className={labelClassName}>{label}</span>
      <div className={valueClassName}>{amount}</div>
    </div>
  );
}

function FooterItem({ label, value, valueClassName = '' }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center gap-1">{label}: <span className={`text-base-content/80 ${valueClassName}`}>{value}</span></div>
  );
}

const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ settings, data, isBonDeLivraison, paperSize = 'A4' }) => {
  const { lang: docLang, locale: docLocale } = useDocumentLocale();
  const { t } = useTranslation('printing', { lng: docLang });
  const isA5 = paperSize === 'A5';
  const _isA5L = paperSize === 'A5L';
  const isSmallWidth = isA5;

  const totalQuantity = data.produits.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div data-theme="light" className={`bg-base-100 p-4 mx-auto text-base-content font-sans text-label leading-tight shadow-none print:shadow-none print:max-w-none print:w-full ${isA5 ? 'max-w-[148mm]' : 'max-w-[210mm]'}`} style={{ display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER SECTION - SYNCED WITH IMAGE */}
      <div className="flex justify-between items-start mb-4 border-b-2 border-slate-900 pb-3">
        
        {/* Left: Pharmacy Info */}
        <div className="flex-1 flex items-start gap-4">
            {settings.logo && (
              <img src={settings.logo} alt={t('common:aria.logo', { defaultValue: 'Logo' })} className={`object-contain shrink-0 ${isSmallWidth ? 'w-16 h-16' : 'w-20 h-20'}`} />
            )}
            <div>
            <h1 className={`font-black uppercase tracking-tight text-base-content mb-1 leading-none ${isSmallWidth ? 'text-xl' : 'text-2xl'}`}>
                {settings.pharmacy_name}
            </h1>
            
            <PharmacyContactBlock settings={settings} t={t} />
            </div>
        </div>

        {/* Right: Invoice Info Boxed */}
        <div className="text-right">
            <div className="border-2 border-slate-900 text-base-content px-6 py-2 rounded-sm text-xl font-black mb-2 inline-block uppercase tracking-wider">
                {isBonDeLivraison ? t('invoice.delivery_note') : (data.type === 'DEVIS' || data.status === 'PROFORMA' || data.status === 'PROF' ? t('invoice.quote', { defaultValue: 'DEVIS' }) : t('invoice.invoice'))}
            </div>
            <div className="text-base-content/60 font-bold text-caption uppercase tracking-widest">
                {t('invoice.ref')} : {data.numero_facture || data.id}
            </div>
        </div>
      </div>

      {/* METADATA BOXES - SYNCED WITH IMAGE */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-base-100 p-3 rounded-xl border border-base-200">
            <div className="text-micro uppercase tracking-widest font-black text-base-content/40 mb-1.5 border-b border-slate-100 pb-1">
                {t('invoice.client')}
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-bold text-base-content uppercase">{data.client_name_override || data.client?.name || t('invoice.walk_in_customer')}</p>
              {data.ayant_droit_details && (
                <p className="font-medium text-info">{t('invoice.beneficiary')}: {data.ayant_droit_details.nom}</p>
              )}
              {data.client?.address && <p>{data.client.address}</p>}
              {data.client?.phone && <p>{t('invoice.tel')} : {data.client.phone}</p>}
              {data.client_solde_depot && Number(data.client_solde_depot) > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-caption font-black text-base-content/50 uppercase tracking-tighter">{t('invoice.remaining_deposit')}</span>
                    <span className="font-black text-base-content text-sm">{formatCurrency(Number(data.client_solde_depot), docLocale)}</span>
                </div>
              )}
            </div>
        </div>

        <div className="bg-base-100 p-3 rounded-xl border border-base-200">
            <div className="text-micro uppercase tracking-widest font-black text-base-content/40 mb-1.5 border-b border-slate-100 pb-1">
                {t('invoice.invoice_details')}
            </div>
            <div className="space-y-1 text-label">
                <div className="flex justify-between">
                    <span className="text-base-content/60">{t('invoice.date')} :</span>
                    <span className="font-bold">{formatDate(data.date, docLocale)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1 mt-1">
                    <span className="text-base-content/60">{t('invoice.entered_by')} :</span>
                    <span className="font-bold uppercase">{data.vendeur_nom || 'N/A'}</span>
                </div>
                {data.validated_by_name && (
                  <div className="flex justify-between">
                      <span className="text-base-content/60">{t('invoice.validated_by')} :</span>
                      <span className="font-bold uppercase">{data.validated_by_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                    <span className="text-base-content/60">{t('invoice.payment_method')} :</span>
                    <span className="font-bold uppercase text-success">{data.mode_reglement || t('invoice.cash')}</span>
                </div>
            </div>
        </div>
      </div>


      {/* PRODUCTS TABLE - PREMIUM COMPACT */}
      <div className="flex-grow">
        <table className="w-full mb-4 border-collapse">
            <thead className="table-header-group">
                <tr className="bg-base-200/50 text-base-content border-b-2 border-slate-900 text-micro uppercase tracking-[0.1em]">
                    <th className="py-2 px-2 text-left font-black rounded-l">{t('invoice.designation')}</th>
                    <th className="py-2 px-2 text-center font-black w-12">{t('invoice.qty')}</th>
                    <th className="py-2 px-2 text-right font-black w-24">{t('invoice.unit_price_ht')}</th>
                    <th className="py-2 px-2 text-right font-black w-20">{t('invoice.discount')}</th>
                    <th className="py-2 px-2 text-right font-black w-28 rounded-r">{t('invoice.total_ht')}</th>
                </tr>
            </thead>
            <tbody className="text-caption">
                {data.produits.map((item, _idx) => {
                    const htUnit = calculateHTUnit(item.selling_price, item.tva);
                    const totalLineNetHT = ((Number(item.selling_price) - Number(item.discount)) * item.quantity) / (1 + (Number(item.tva)||0)/100);
                    const infoParts: string[] = [];
                    if (item.cip) infoParts.push(`${t('invoice.cip')}: ${item.cip}`);
                    if (item.lot) infoParts.push(`${t('invoice.lot')}: ${item.lot}`);
                    if (item.date_expiration) infoParts.push(`${t('invoice.exp')}: ${formatExpiryDate(item.date_expiration)}`);

                    return (
                      <tr key={item.cip ?? item.produit_nom ?? `item-${item.lot}`} className="group border-b border-slate-50 hover:bg-base-200/30 transition-colors break-inside-avoid">
                          <td className="py-1.5 px-2">
                              <div className="font-bold text-base-content text-[9px] uppercase leading-tight">{item.produit_nom}</div>
                              {infoParts.length > 0 && (
                                <div className="text-[7.5px] text-base-content/55 font-mono mt-0.5 leading-tight">
                                  {infoParts.join(' | ')}
                                </div>
                              )}
                          </td>
                          <td className="py-1.5 px-2 text-center align-middle font-bold text-base-content">{item.quantity}</td>
                          <td className="py-1.5 px-2 text-right align-middle text-base-content/80 font-medium">{formatNumber(htUnit, 0, docLocale)}</td>
                          <td className="py-1.5 px-2 text-right align-middle text-red-400 font-medium">{item.discount > 0 ? `-${formatNumber(item.discount, 0, docLocale)}` : '-'}</td>
                          <td className="py-1.5 px-2 text-right align-middle font-black text-base-content text-[10px]">{formatNumber(totalLineNetHT, 0, docLocale)}</td>
                      </tr>
                    );
                })}
            </tbody>
        </table>
        
        <div className="px-3 py-2 bg-base-200/50 rounded-lg flex justify-between items-center text-micro uppercase font-bold text-base-content/40 tracking-widest">
             <div className="flex gap-6">
               <span>{t('invoice.lines')} : <span className="text-base-content">{data.produits.length}</span></span>
               <span>{t('invoice.items')} : <span className="text-base-content">{totalQuantity}</span></span>
             </div>
             <div className="text-base-content/30 italic">{t('invoice.certified_document')}</div>
        </div>
      </div>

      {/* FOOTER AREA */}
      <div className="mt-4">
        <div className={`items-start border-t-2 border-slate-900 pt-3 ${isSmallWidth ? 'flex flex-col gap-4' : 'flex gap-6'}`}>

            {/* VAT Analysis & Text Amount */}
            <div className="flex-1">
                <div className="text-micro uppercase tracking-widest font-black text-base-content/40 mb-2 ml-1">{t('invoice.vat_analysis')}</div>
                <div className="bg-base-200/50 rounded-lg p-3 border border-slate-100 mb-4">
                  <table className="w-full text-[9.5px]">
                      <thead>
                          <tr className="text-base-content/40 font-bold border-b border-base-200">
                              <th className="py-1 text-left pb-1">{t('invoice.vat_code')}</th>
                              <th className="py-1 text-right pb-1">{t('invoice.rate')}</th>
                              <th className="py-1 text-right pb-1">{t('invoice.base_ht')}</th>
                              <th className="py-1 text-right pb-1">{t('invoice.vat_amount')}</th>
                          </tr>
                      </thead>
                      <tbody className="leading-tight">
                          {data.tva_analysis && data.tva_analysis.length > 0 ? (
                              data.tva_analysis.map((line, tvaIdx) => (
                                  <tr key={`tva-${line.taux}`} className="text-base-content/90">
                                      <td className="py-1 text-left font-bold uppercase">TVA-{tvaIdx+1}</td>
                                      <td className="py-1 text-right font-medium">{formatNumber(Number(line.taux), 2, docLocale)}%</td>
                                      <td className="py-1 text-right">{formatNumber(line.base_ht, 0, docLocale)}</td>
                                      <td className="py-1 text-right font-bold text-base-content">{formatNumber(line.montant_tva, 0, docLocale)}</td>
                                  </tr>
                              ))
                          ) : (
                            <tr className="text-base-content/90">
                                <td className="py-1 text-left font-bold">{t('invoice.vat_exo')}</td>
                                <td className="py-1 text-right">0%</td>
                                <td className="py-1 text-right">{formatNumber(data.total_ht, 0, docLocale)}</td>
                                <td className="py-1 text-right font-bold">0</td>
                            </tr>
                          )}
                      </tbody>
                  </table>
                </div>
                
                <div className="bg-base-200/50 border border-slate-100 rounded-lg p-3">
                    <div className="text-[8.5px] uppercase tracking-[0.2em] font-black text-base-content/40 mb-1.5">{t('invoice.amount_in_words')}</div>
                    <div className="font-bold italic text-base-content text-[12.5px] uppercase leading-snug tracking-tight">
                       {data.total_lettres || '---'}
                    </div>
                </div>
            </div>

            {/* Totals & Signature */}
            <div className={isSmallWidth ? 'w-full' : 'w-64'}>
                <div className="space-y-1 mt-4 p-0">
                    {/* Rows use grid-cols-[1fr,115px] to have a fixed amount area */}
                    
                    {/* Total HT */}
                    <TotalRow
                      rowClassName="text-base-content/60"
                      label={t('invoice.subtotal_ht')}
                      amount={formatCurrency(Math.round(Number(data.total_ht)), docLocale)}
                    />

                    {Number(data.total_tva) > 0 && (
                      <TotalRow
                        rowClassName="text-base-content/60"
                        label={t('invoice.taxes_tva')}
                        amount={formatCurrency(Math.round(Number(data.total_tva)), docLocale)}
                      />
                    )}

                    {data.remise > 0 && (
                      <TotalRow
                        rowClassName="py-1 bg-error/10/50 rounded-md text-error border border-red-100/50"
                        labelClassName="text-micro uppercase font-black tracking-widest pl-1"
                        valueClassName="text-right font-mono font-black pr-2"
                        label={t('invoice.discount_label')}
                        amount={`-${formatCurrency(Math.round(Number(data.remise)), docLocale)}`}
                      />
                    )}

                    <div className="border-t border-base-200 my-1 mx-2"></div>
                    
                    {/* Bloc TOTAL GÉNÉRAL / NET À PAYER */}
                    <div className={`mx-0 rounded-lg py-2.5 shadow-sm transition-all overflow-hidden relative ${
                      (data.part_assurance ?? 0) > 0
                        ? 'bg-base-200/50 border border-base-200 text-base-content'
                        : 'bg-slate-900 text-white'
                    }`}>
                        <div className="grid grid-cols-[1fr,115px] items-center px-1">
                          <span className={`text-[8px] uppercase font-black tracking-[0.2em] pl-1 ${
                            (data.part_assurance ?? 0) > 0 ? 'text-base-content/40' : 'text-base-content/40'
                          }`}>
                            {(data.part_assurance ?? 0) > 0 ? t('invoice.total_general') : t('invoice.net_a_payer')}
                          </span>
                          <div className={`text-right font-black font-mono tracking-tighter pr-2 ${
                             (data.part_assurance ?? 0) > 0 ? 'text-lg' : 'text-xl'
                          }`}>
                            {formatCurrency(Math.round(Number(data.total_ttc)), docLocale)}
                          </div>
                        </div>
                    </div>

                    {/* Bloc Tiers-Payant (Patient/Assurance) */}
                    {(data.part_assurance ?? 0) > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <TotalRow
                          rowClassName="py-0.5 text-base-content/80"
                          valueClassName="text-right font-mono font-bold text-base-content text-base pr-2"
                          label={t('invoice.part_patient')}
                          amount={formatCurrency(Math.round(Number(data.part_client ?? 0)), docLocale)}
                        />
                        <div className="bg-success rounded-lg shadow-sm text-white grid grid-cols-[1fr,115px] items-center px-1 py-2.5 ring-1 ring-emerald-700/10">
                          <span className="text-micro uppercase font-black tracking-[0.1em] pl-1">{t('invoice.part_assurance')}</span>
                          <div className="text-right font-mono font-black text-lg leading-none pr-2 text-right">
                            {formatCurrency(Math.round(Number(data.part_assurance ?? 0)), docLocale)}
                          </div>
                        </div>
                      </div>
                    )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col items-center">
                    <div className="text-[8px] uppercase font-black tracking-widest text-base-content/40 mb-6 text-center">{t('invoice.stamp_signature')}</div>
                    <div className="w-full h-20 border-2 border-dashed border-slate-100 rounded-xl flex items-center justify-center text-[8px] text-slate-200 bg-base-200/10 italic">
                        {t('invoice.stamp_placeholder')}
                    </div>
                </div>
            </div>
        </div>

        {/* LEGAL FOOTER */}
        <div className="mt-4 pt-3 border-t border-base-200 text-center">
            <p className="font-bold text-base-content text-[10.5px] mb-1.5">{settings.ticket_footer_message || t('invoice.thank_you')}</p>
            
            <div className="flex justify-center flex-wrap gap-x-8 gap-y-1 text-[8.5px] uppercase tracking-[0.1em] font-bold text-base-content/30">
               {settings.show_pharmacist_on_documents && settings.pharmacist_name && <FooterItem label={t('invoice.pharmacist')} value={settings.pharmacist_name} />}
               {settings.niu && <FooterItem label={t('invoice.niu')} value={settings.niu} />}
               {settings.registre_commerce && <FooterItem label={t('invoice.rc')} value={settings.registre_commerce} />}
               <FooterItem label={t('invoice.software')} value="ZENITH" valueClassName="uppercase" />
            </div>
        </div>
      </div>

    </div>
  );
};

export default InvoiceTemplate;
