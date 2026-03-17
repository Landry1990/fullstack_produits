import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  ShoppingBag, 
  History as HistoryIcon,
  ChevronRight,
  TrendingUp,
  PackageCheck,
  CalendarDays
} from 'lucide-react';
import { formatCurrency, formatDateFr } from '../../utils/formatters';

interface PurchaseProduct {
  id: number | null;
  nom: string;
  quantite: number;
  prix_unitaire: number;
  total: number;
}

interface PurchaseHistoryItem {
  id: number;
  date: string;
  numero_facture: string;
  total_ttc: number;
  status: string;
  produits: PurchaseProduct[];
}

interface PurchaseHistoryData {
  client_id: number;
  client_name: string;
  total_factures: number;
  factures: PurchaseHistoryItem[];
}

interface PurchaseHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: PurchaseHistoryData | null;
  loading: boolean;
}

export default function PurchaseHistoryDrawer({ 
  isOpen, 
  onClose, 
  data, 
  loading 
}: PurchaseHistoryDrawerProps) {
  const { t } = useTranslation(['clients', 'common']);
  const [expandedInvoice, setExpandedInvoice] = useState<number | null>(null);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-base-content/20 backdrop-blur-sm" onClick={onClose} />
      
      <div className={`absolute right-0 top-0 bottom-0 w-full max-w-xl bg-base-100 shadow-2xl transition-transform duration-500 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        {/* Header */}
        <div className="p-6 border-b border-base-200 bg-base-50/80 backdrop-blur-md flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <div className="p-2.5 bg-primary/10 text-primary rounded-2xl">
               <HistoryIcon className="w-6 h-6" />
             </div>
             <div>
               <h3 className="text-xl font-black tracking-tight">{t('clients:sections.purchase_history')}</h3>
               <p className="text-xs font-semibold text-base-content/40 uppercase tracking-widest">{data?.client_name}</p>
             </div>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost transition-all hover:rotate-90">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
           {loading ? (
             <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-xs font-black uppercase tracking-widest">{t('common:loading')}</p>
             </div>
           ) : data && data.factures.length > 0 ? (
             <>
               {/* Stats Summary */}
               <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                   <div className="bg-primary/5 p-4 rounded-3xl border border-primary/10 flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary/40">
                         <ShoppingBag className="w-3 h-3" /> {t('clients:history.total_visits')}
                      </div>
                      <div className="text-2xl font-black text-primary">{data.total_factures}</div>
                   </div>
                   <div className="bg-secondary/5 p-4 rounded-3xl border border-secondary/10 flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-secondary/40">
                         <TrendingUp className="w-3 h-3" /> {t('clients:history.loyalty')}
                      </div>
                      <div className="text-2xl font-black text-secondary">{Math.floor(data.total_factures * 1.5)} {t('clients:units.pts')}</div>
                   </div>
               </div>

               {/* Invoice List */}
               <div className="space-y-3">
                  {data.factures.map((facture) => (
                    <div 
                      key={facture.id} 
                      className={`group border border-base-200 rounded-3xl transition-all duration-300 ${expandedInvoice === facture.id ? 'bg-base-200/30 ring-1 ring-primary/20' : 'bg-base-100 hover:border-primary/30'}`}
                    >
                       <div 
                         className="p-4 flex items-center justify-between cursor-pointer"
                         onClick={() => setExpandedInvoice(expandedInvoice === facture.id ? null : facture.id)}
                       >
                          <div className="flex items-center gap-4">
                             <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${expandedInvoice === facture.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-base-200 text-base-content/40 group-hover:bg-primary/10 group-hover:text-primary'}`}>
                                <PackageCheck className="w-5 h-5" />
                             </div>
                             <div>
                                <div className="text-sm font-black text-base-content">{t('clients:history.invoice_no', { no: facture.numero_facture })}</div>
                                <div className="text-[10px] font-bold text-base-content/40 flex items-center gap-1">
                                   <CalendarDays className="w-3 h-3" /> {formatDateFr(facture.date)}
                                </div>
                             </div>
                          </div>
                          <div className="flex items-center gap-4">
                             <div className="text-right">
                                <div className="text-sm font-black text-base-content">{formatCurrency(facture.total_ttc)}</div>
                                <div className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded leading-none mt-0.5 ${facture.status === 'VALIDEE' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                                   {facture.status === 'VALIDEE' ? t('clients:history.status_validee') : facture.status}
                                </div>
                             </div>
                             <ChevronRight className={`w-4 h-4 text-base-content/20 transition-transform duration-300 ${expandedInvoice === facture.id ? 'rotate-90 text-primary' : ''}`} />
                          </div>
                       </div>

                       {/* Expanded Details */}
                       {expandedInvoice === facture.id && (
                          <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                             <div className="bg-base-100 rounded-2xl border border-base-200/50 overflow-hidden shadow-sm">
                                <table className="table table-xs w-full">
                                   <thead className="bg-base-50">
                                      <tr>
                                         <th className="py-2 text-[9px] uppercase font-black tracking-widest text-base-content/40">{t('common:product')}</th>
                                         <th className="py-2 text-[9px] uppercase font-black tracking-widest text-base-content/40 text-center">{t('clients:history.quantity_short')}</th>
                                         <th className="py-2 text-[9px] uppercase font-black tracking-widest text-base-content/40 text-right pr-4">{t('common:total')}</th>
                                      </tr>
                                   </thead>
                                   <tbody>
                                      {facture.produits.map((prod, idx) => (
                                         <tr key={idx} className="border-b border-base-200/30 last:border-0 hover:bg-base-50/50">
                                            <td className="py-2.5 px-3">
                                               <div className="text-xs font-bold leading-tight line-clamp-1">{prod.nom}</div>
                                               <div className="text-[9px] opacity-40 font-mono tracking-tighter">{prod.prix_unitaire} {t('clients:units.per_unit')}</div>
                                            </td>
                                            <td className="py-2 px-3 text-center text-xs font-black">× {prod.quantite}</td>
                                            <td className="py-2 px-3 text-right text-xs font-black pr-4">{formatCurrency(prod.total)}</td>
                                         </tr>
                                      ))}
                                   </tbody>
                                </table>
                             </div>
                          </div>
                       )}
                    </div>
                  ))}
               </div>
             </>
           ) : (
             <div className="flex flex-col items-center justify-center h-full gap-4 text-center opacity-40 grayscale py-12">
                <div className="w-20 h-20 bg-base-200 rounded-full flex items-center justify-center">
                  <ShoppingBag className="w-10 h-10" />
                </div>
                <div>
                   <h4 className="font-black text-lg">{t('clients:history.empty_title')}</h4>
                   <p className="text-xs font-bold">{t('clients:history.empty_desc')}</p>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
