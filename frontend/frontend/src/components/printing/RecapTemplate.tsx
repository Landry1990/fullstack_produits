import { formatDate as formatLocaleDate } from '../../utils/dateUtils';
import { formatNumber, formatCurrency } from '../../utils/formatters';
import { useTranslation } from 'react-i18next';
import type { PharmacySettings } from './InvoiceTemplate';

export interface RecapFactureItem {
  numero_facture: string
  date: string
  total_ttc: number | string
  status?: string
  produits: RecapProduitItem[]
}

export interface RecapProduitItem {
  produit_nom?: string
  produit_name?: string
  quantity?: number
  quantite?: number
  selling_price?: number | string
  prix_vente?: number | string
  discount?: number | string
  tva?: number | string
  lot?: string
  date_expiration?: string
}

export interface RecapData {
  factures: RecapFactureItem[]
  recap: {
    nombre_factures: number
    total_ht: number
    total_tva: number
    total_ttc: number
    total_remise: number
    periode: { debut: string | null; fin: string | null }
  }
  client_name: string
}

interface RecapTemplateProps {
  settings: PharmacySettings
  data: RecapData
}

const formatExpiryDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${year}`;
};

const RecapTemplate: React.FC<RecapTemplateProps> = ({ settings, data }) => {
  const { t } = useTranslation('printing');

  // Build flat product list across all factures
  const allLines: { ticket: string; date: string; name: string; qty: number; price: number; total: number; lot?: string; dateExp?: string; cancelled?: boolean }[] = []

  data.factures.forEach(facture => {
    const isCancelled = facture.status === 'ANN' || facture.status === 'ANNULEE'
    const produits = facture.produits || []
    if (produits.length === 0) {
      allLines.push({
        ticket: facture.numero_facture || '-',
        date: facture.date,
        name: '-',
        qty: 0,
        price: 0,
        total: Number(facture.total_ttc || 0),
        cancelled: isCancelled
      })
    } else {
      produits.forEach((p, idx) => {
        const name = p.produit_nom || p.produit_name || '?'
        const qty = p.quantity || p.quantite || 1
        const price = Number(p.selling_price || p.prix_vente || 0)
        allLines.push({
          ticket: idx === 0 ? (facture.numero_facture || '-') : '',
          date: idx === 0 ? facture.date : '',
          name,
          qty,
          price,
          total: qty * price,
          lot: p.lot || undefined,
          dateExp: p.date_expiration || undefined,
          cancelled: isCancelled
        })
      })
    }
  })

  const totalQuantity = allLines.reduce((acc, l) => acc + l.qty, 0)

  return (
    <div data-theme="light" className="bg-base-100 p-4 max-w-[210mm] mx-auto text-base-content font-sans text-[11px] leading-tight shadow-none print:shadow-none print:max-w-none print:w-full" style={{ display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-start mb-6 border-b-2 border-slate-900 pb-4">
        
        {/* Left: Pharmacy Info */}
        <div className="flex-1 flex items-start gap-4">
            {settings.logo && (
              <img src={settings.logo} alt="Logo" className="w-20 h-20 object-contain shrink-0" />
            )}
            <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-base-content mb-1 leading-none">
                {settings.pharmacy_name}
            </h1>
            
            <div className="space-y-1 text-base-content/60 max-w-sm text-[11px]">
                <div className="whitespace-pre-line leading-tight italic">
                    {settings.address}
                </div>
                <div className="flex flex-col gap-0.5 mt-2 font-bold text-base-content/90">
                    {(settings.phone || settings.phone2) && (
                      <div className="flex items-center gap-1">
                        <span>{t('invoice.tel')} : {settings.phone}{settings.phone2 ? ` | ${settings.phone2}` : ''}</span>
                      </div>
                    )}
                    {settings.email && (
                      <div className="flex items-center gap-1">
                        <span>{t('invoice.email', { defaultValue: 'Email' })} : {settings.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 uppercase">
                        {settings.niu && <span>{t('invoice.niu')} : {settings.niu} |</span>}
                        {settings.registre_commerce && <span>{t('invoice.rc')} : {settings.registre_commerce}</span>}
                    </div>
                </div>
            </div>
            </div>
        </div>

        {/* Right: Document Info Boxed */}
        <div className="text-right">
            <div className="border-2 border-slate-900 text-base-content px-6 py-2 rounded-sm text-lg font-black mb-2 inline-block uppercase tracking-wider">
                {t('recap.document_title', { defaultValue: 'RÉCAPITULATIF' })}
            </div>
            <div className="text-base-content/60 font-bold text-[10px] uppercase tracking-widest">
                {data.recap.nombre_factures} {t('recap.tickets_label', { defaultValue: 'ticket(s)' })}
            </div>
        </div>
      </div>

      {/* METADATA BOXES */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
            <div className="text-[9px] uppercase tracking-widest font-black text-base-content/40 mb-2 border-b border-slate-100 pb-1.5">
                {t('invoice.client')}
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-bold text-base-content uppercase">{data.client_name || t('invoice.walk_in_customer')}</p>
            </div>
        </div>

        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
            <div className="text-[9px] uppercase tracking-widest font-black text-base-content/40 mb-2 border-b border-slate-100 pb-1.5">
                {t('recap.details_title', { defaultValue: 'Détails' })}
            </div>
            <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                    <span className="text-base-content/60">{t('recap.generated_on', { defaultValue: 'Généré le' })} :</span>
                    <span className="font-bold">{new Date().toLocaleDateString('fr-FR')}</span>
                </div>
                {data.recap.periode.debut && (
                  <div className="flex justify-between">
                      <span className="text-base-content/60">{t('recap.period', { defaultValue: 'Période' })} :</span>
                      <span className="font-bold">
                        {formatLocaleDate(data.recap.periode.debut)} — {formatLocaleDate(data.recap.periode.fin || '')}
                      </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-100 pt-1 mt-1">
                    <span className="text-base-content/60">{t('recap.nb_tickets', { defaultValue: 'Nb. tickets' })} :</span>
                    <span className="font-bold">{data.recap.nombre_factures}</span>
                </div>
            </div>
        </div>
      </div>

      {/* PRODUCTS TABLE */}
      <div className="flex-grow">
        <table className="w-full mb-4 border-collapse">
            <thead className="table-header-group">
                <tr className="bg-base-200/50 text-base-content border-b-2 border-slate-900 text-[9px] uppercase tracking-[0.1em]">
                    <th className="py-2.5 px-3 text-left font-black rounded-l w-24">{t('recap.col_ticket', { defaultValue: 'Ticket' })}</th>
                    <th className="py-2.5 px-2 text-left font-black w-20">{t('invoice.date', { defaultValue: 'Date' })}</th>
                    <th className="py-2.5 px-3 text-left font-black">{t('invoice.designation')}</th>
                    <th className="py-2.5 px-2 text-center font-black w-12">{t('invoice.qty')}</th>
                    <th className="py-2.5 px-2 text-right font-black w-24">{t('recap.col_pu', { defaultValue: 'P.U. TTC' })}</th>
                    <th className="py-2.5 px-3 text-right font-black w-28 rounded-r">{t('recap.col_total', { defaultValue: 'Total' })}</th>
                </tr>
            </thead>
            <tbody className="text-[10px]">
                {allLines.map((line) => (
                  <tr key={`${line.ticket}-${line.name}-${line.qty}-${line.price}-${line.total}`} className={`group border-b border-slate-50 hover:bg-base-200/30 transition-colors break-inside-avoid ${line.cancelled ? 'opacity-40' : ''}`}>
                      <td className="py-2 px-3 font-mono font-bold text-base-content/80">
                        <span className={line.cancelled ? 'line-through' : ''}>{line.ticket}</span>
                        {line.ticket && line.cancelled && <div className="text-[7px] font-sans uppercase font-black text-base-content/60 no-underline">{t('recap.cancelled_label', { defaultValue: 'ANNULÉ' })}</div>}
                      </td>
                      <td className="py-2 px-2 text-base-content/60 text-[9px]">
                        {line.date ? new Date(line.date).toLocaleDateString('fr-FR') : ''}
                      </td>
                      <td className="py-2 px-3">
                          <div className={`font-bold text-base-content text-[10.5px] uppercase leading-tight ${line.cancelled ? 'line-through' : ''}`}>{line.name}</div>
                          {(line.lot || line.dateExp) && (
                            <div className="text-[7.5px] text-base-content/60 font-mono mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                {line.lot && <span>{t('invoice.lot', { defaultValue: 'Lot' })}: {line.lot}</span>}
                                {line.dateExp && <span>{t('invoice.exp', { defaultValue: 'Exp' })}: {formatExpiryDate(line.dateExp)}</span>}
                            </div>
                          )}
                      </td>
                      <td className={`py-2 px-2 text-center align-middle font-bold text-base-content ${line.cancelled ? 'line-through' : ''}`}>{line.qty || ''}</td>
                      <td className={`py-2 px-2 text-right align-middle text-base-content/80 font-medium ${line.cancelled ? 'line-through' : ''}`}>{line.price > 0 ? formatNumber(line.price, 0) : ''}</td>
                      <td className={`py-2 px-3 text-right align-middle font-black text-base-content text-[10.5px] ${line.cancelled ? 'line-through' : ''}`}>{line.total > 0 ? formatNumber(line.total, 0) : ''}</td>
                  </tr>
                ))}
            </tbody>
        </table>
        
        <div className="px-3 py-2 bg-base-200/50 rounded-lg flex justify-between items-center text-[9px] uppercase font-bold text-base-content/40 tracking-widest">
             <div className="flex gap-6">
               <span>{t('invoice.lines')} : <span className="text-base-content">{allLines.length}</span></span>
               <span>{t('invoice.items')} : <span className="text-base-content">{totalQuantity}</span></span>
             </div>
             <div className="text-base-content/30 italic">{t('recap.non_accounting', { defaultValue: 'Document non comptable' })}</div>
        </div>
      </div>

      {/* FOOTER AREA */}
      <div className="mt-6">
        <div className="flex gap-8 items-start border-t-2 border-slate-900 pt-4">
            
            {/* Left: Note */}
            <div className="flex-1">
                <div className="bg-base-200/50 border border-slate-100 rounded-lg p-3">
                    <div className="text-[8.5px] uppercase tracking-[0.2em] font-black text-base-content/40 mb-1.5">
                      {t('recap.note_title', { defaultValue: 'Note' })}
                    </div>
                    <div className="text-[10px] text-base-content/70 italic">
                      {t('recap.note_body', { defaultValue: 'Ce document est un récapitulatif des achats établi à la demande du client. Il ne constitue pas une facture au sens comptable.' })}
                    </div>
                </div>
            </div>

            {/* Right: Totals */}
            <div className="w-64">
                <div className="space-y-1 mt-4 p-0">
                    
                    {/* Total HT */}
                    <div className="grid grid-cols-[1fr,115px] items-center px-1 text-base-content/60">
                        <span className="text-[9px] uppercase font-bold tracking-widest pl-1">{t('invoice.subtotal_ht')}</span>
                        <div className="text-right font-mono font-bold text-base-content pr-2">
                          {formatCurrency(Math.round(data.recap.total_ht))}
                        </div>
                    </div>

                    {data.recap.total_tva > 0 && (
                      <div className="grid grid-cols-[1fr,115px] items-center px-1 text-base-content/60">
                          <span className="text-[9px] uppercase font-bold tracking-widest pl-1">{t('invoice.taxes_tva')}</span>
                          <div className="text-right font-mono font-bold text-base-content pr-2">
                            {formatCurrency(Math.round(data.recap.total_tva))}
                          </div>
                      </div>
                    )}
                    
                    {data.recap.total_remise > 0 && (
                      <div className="grid grid-cols-[1fr,115px] items-center px-1 py-1 bg-error/10/50 rounded-md text-error border border-red-100/50">
                          <span className="text-[9px] uppercase font-black tracking-widest pl-1">{t('invoice.discount_label')}</span>
                          <div className="text-right font-mono font-black pr-2">
                            -{formatCurrency(Math.round(data.recap.total_remise))}
                          </div>
                      </div>
                    )}

                    <div className="border-t border-base-200 my-1 mx-2"></div>
                    
                    {/* TOTAL TTC */}
                    <div className="mx-0 rounded-lg py-2.5 shadow-sm bg-slate-900 text-white overflow-hidden relative">
                        <div className="grid grid-cols-[1fr,115px] items-center px-1">
                          <span className="text-[8px] uppercase font-black tracking-[0.2em] pl-1 text-white/60">
                            {t('recap.total_label', { defaultValue: 'TOTAL GÉNÉRAL' })}
                          </span>
                          <div className="text-right font-black font-mono tracking-tighter pr-2 text-xl">
                            {formatCurrency(Math.round(data.recap.total_ttc))}
                          </div>
                        </div>
                    </div>
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
        <div className="mt-8 pt-4 border-t border-base-200 text-center">
            <p className="font-bold text-base-content text-[10.5px] mb-1.5">{settings.ticket_footer_message || t('invoice.thank_you')}</p>
            
            <div className="flex justify-center flex-wrap gap-x-8 gap-y-1 text-[8.5px] uppercase tracking-[0.1em] font-bold text-base-content/30">
               {settings.niu && <div className="flex items-center gap-1">{t('invoice.niu')}: <span className="text-base-content/80">{settings.niu}</span></div>}
               {settings.registre_commerce && <div className="flex items-center gap-1">{t('invoice.rc')}: <span className="text-base-content/80">{settings.registre_commerce}</span></div>}
            </div>
        </div>
      </div>
    </div>
  );
};

export default RecapTemplate;
