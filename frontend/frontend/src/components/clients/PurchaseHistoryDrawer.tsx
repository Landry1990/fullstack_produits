import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  ShoppingBag,
  History as HistoryIcon,
  ChevronRight,
  TrendingUp,
  PackageCheck,
  CalendarDays,
  Wallet,
  Clock,
  BarChart2,
  Medal,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Save,
  XCircle,
  ShieldAlert,
} from 'lucide-react';
import { formatCurrency, formatDateFr } from '../../utils/formatters';
import clientService from '../../services/clientService';
import { toast } from 'react-hot-toast';

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

interface TopProduct {
  id: number | string;
  nom: string;
  quantite: number;
  total: number;
}

interface CaMois {
  mois: string;
  ca: number;
}

interface PurchaseHistoryData {
  client_id: number;
  client_name: string;
  client_type?: string;
  total_factures: number;
  total_ca?: number;
  avg_basket?: number;
  last_visit?: string | null;
  visit_frequency?: number | null;
  top_products?: TopProduct[];
  ca_12_mois?: CaMois[];
  message_alerte?: string | null;
  blocking_alerte?: boolean;
  factures: PurchaseHistoryItem[];
}

interface PurchaseHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: PurchaseHistoryData | null;
  loading: boolean;
  onAlerteSaved?: (message: string, blocking: boolean) => void;
}

type Tab = 'stats' | 'history' | 'alerte';

export default function PurchaseHistoryDrawer({
  isOpen,
  onClose,
  data,
  loading,
  onAlerteSaved,
}: PurchaseHistoryDrawerProps) {
  const { t } = useTranslation(['clients', 'common']);
  const [expandedInvoice, setExpandedInvoice] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [alerteText, setAlerteText] = useState<string>('');
  const [alerteBlocking, setAlerteBlocking] = useState<boolean>(false);
  const [editingAlerte, setEditingAlerte] = useState(false);
  const [savingAlerte, setSavingAlerte] = useState(false);

  const handleOpenAlerte = () => {
    setAlerteText(data?.message_alerte || '');
    setAlerteBlocking(data?.blocking_alerte || false);
    setEditingAlerte(true);
    setActiveTab('alerte');
  };

  const handleSaveAlerte = async () => {
    if (!data) return;
    setSavingAlerte(true);
    try {
      await clientService.updateAlerte(data.client_id, {
        message_alerte: alerteText,
        blocking_alerte: alerteBlocking,
      });
      toast.success(t('clients:history.alerte_saved', 'Alerte enregistrée'));
      onAlerteSaved?.(alerteText, alerteBlocking);
      setEditingAlerte(false);
    } catch {
      toast.error(t('clients:history.alerte_error', 'Erreur lors de la sauvegarde'));
    } finally {
      setSavingAlerte(false);
    }
  };

  if (!isOpen) return null;

  const maxCa = Math.max(...(data?.ca_12_mois?.map(m => m.ca) ?? [1]), 1);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'stats', label: t('clients:history.tab_stats', 'Stats') },
    { key: 'history', label: t('clients:history.tab_history', 'Historique') },
    { key: 'alerte', label: t('clients:history.tab_alerte', 'Alerte') },
  ];

  return (
    <div className={`fixed inset-0 z-[100] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={onClose} />

      <div className={`absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl transition-transform duration-500 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-0 border-b border-slate-200 bg-white shrink-0">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                <HistoryIcon className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight">{t('clients:sections.purchase_history')}</h3>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{data?.client_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenAlerte}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100 transition-colors"
              >
                <AlertTriangle className="size-3.5" />
                {t('clients:history.edit_alerte', 'Alerte')}
              </button>
              <button onClick={onClose} className="inline-flex items-center justify-center size-8 rounded-full text-slate-400 hover:bg-slate-100 transition-all hover:rotate-90">
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors ${activeTab === tab.key ? 'text-indigo-600 border-indigo-500 bg-indigo-50/50' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40">
              <span className="inline-block size-8 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-xs font-black uppercase tracking-widest">{t('common:loading')}</p>
            </div>

          ) : !data || data.factures.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
              <div className="size-20 bg-slate-100 rounded-full flex items-center justify-center">
                <ShoppingBag className="size-10 text-slate-300" />
              </div>
              <div>
                <h4 className="font-black text-lg text-slate-400">{t('clients:history.empty_title')}</h4>
                <p className="text-xs font-bold text-slate-300">{t('clients:history.empty_desc')}</p>
              </div>
            </div>

          ) : activeTab === 'stats' ? (
            <div className="p-6 space-y-6 animate-in fade-in duration-200">

              {/* KPI Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">
                    <ShoppingBag className="size-3" />{t('clients:history.total_visits', 'Visites')}
                  </div>
                  <div className="text-2xl font-black text-indigo-700">{data.total_factures}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">
                    <Wallet className="size-3" />{t('clients:history.total_ca', 'CA Total')}
                  </div>
                  <div className="text-2xl font-black text-emerald-700">{formatCurrency(data.total_ca ?? 0)}</div>
                </div>
                <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-sky-400 mb-1">
                    <TrendingUp className="size-3" />{t('clients:history.avg_basket', 'Panier Moyen')}
                  </div>
                  <div className="text-2xl font-black text-sky-700">{formatCurrency(data.avg_basket ?? 0)}</div>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">
                    <Clock className="size-3" />{t('clients:history.frequency', 'Fréquence')}
                  </div>
                  <div className="text-2xl font-black text-amber-700">
                    {data.visit_frequency != null
                      ? t('clients:history.every_n_days', '/ {{n}}j', { n: data.visit_frequency })
                      : '—'}
                  </div>
                </div>
              </div>

              {/* Dernière visite */}
              {data.last_visit && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                  <CalendarDays className="size-4 text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-500 font-medium">
                    {t('clients:history.last_visit', 'Dernière visite')} :
                  </span>
                  <span className="text-xs font-black text-slate-700">{formatDateFr(data.last_visit)}</span>
                </div>
              )}

              {/* Top Produits */}
              {data.top_products && data.top_products.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Medal className="size-4 text-amber-500" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
                      {t('clients:history.top_products', 'Produits habituels')}
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {data.top_products.map((p, i) => (
                      <div key={p.nom} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className={`size-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {i + 1}
                        </span>
                        <span className="flex-1 text-xs font-semibold text-slate-700 truncate">{p.nom}</span>
                        <span className="text-xs font-black text-indigo-600 shrink-0">×{p.quantite}</span>
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">{formatCurrency(p.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mini chart CA 12 mois */}
              {data.ca_12_mois && data.ca_12_mois.some(m => m.ca > 0) && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart2 className="size-4 text-indigo-500" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">
                      {t('clients:history.ca_trend', 'CA 12 derniers mois')}
                    </h4>
                  </div>
                  <div className="flex items-end gap-1 h-20 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                    {data.ca_12_mois.map((m, i) => (
                      <div key={m.mois} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                        <div
                          className="w-full rounded-sm bg-indigo-400 hover:bg-indigo-600 transition-colors cursor-default"
                          style={{ height: `${Math.max(2, (m.ca / maxCa) * 60)}px` }}
                        />
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                          {m.mois}: {formatCurrency(m.ca)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1 px-1">
                    <span className="text-[9px] text-slate-300 font-bold">{data.ca_12_mois[0]?.mois}</span>
                    <span className="text-[9px] text-slate-300 font-bold">{data.ca_12_mois[data.ca_12_mois.length - 1]?.mois}</span>
                  </div>
                </div>
              )}
            </div>

          ) : activeTab === 'history' ? (
            <div className="p-6 space-y-3 animate-in fade-in duration-200">
              {data.factures.map((facture) => (
                <div
                  key={facture.id}
                  className={`group border rounded-2xl transition-all duration-200 ${expandedInvoice === facture.id ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-slate-200 hover:border-indigo-200'}`}
                >
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedInvoice(expandedInvoice === facture.id ? null : facture.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`size-9 rounded-xl flex items-center justify-center transition-colors shrink-0 ${expandedInvoice === facture.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'}`}>
                        <PackageCheck className="size-4" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-800">{t('clients:history.invoice_no', { no: facture.numero_facture })}</div>
                        <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          <CalendarDays className="size-3" /> {formatDateFr(facture.date)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-black text-slate-800">{formatCurrency(facture.total_ttc)}</div>
                        <div className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded leading-none mt-0.5 ${facture.status === 'VAL' || facture.status === 'VALIDEE' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                          {facture.status === 'VAL' || facture.status === 'VALIDEE' ? t('clients:history.status_validee') : facture.status}
                        </div>
                      </div>
                      <ChevronRight className={`size-4 text-slate-300 transition-transform duration-300 ${expandedInvoice === facture.id ? 'rotate-90 text-indigo-500' : ''}`} />
                    </div>
                  </div>

                  {expandedInvoice === facture.id && (
                    <div className="px-4 pb-4 animate-in slide-in-from-top-1 duration-200">
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="py-2 px-3 text-[9px] uppercase font-black tracking-widest text-slate-400 text-left">{t('common:product')}</th>
                              <th className="py-2 px-3 text-[9px] uppercase font-black tracking-widest text-slate-400 text-center">{t('clients:history.quantity_short')}</th>
                              <th className="py-2 px-3 text-[9px] uppercase font-black tracking-widest text-slate-400 text-right">{t('common:total')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {facture.produits.map((prod) => (
                              <tr key={prod.nom} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="py-2 px-3">
                                  <div className="font-semibold text-slate-700 truncate">{prod.nom}</div>
                                  <div className="text-[9px] text-slate-400 font-mono">{prod.prix_unitaire} {t('clients:units.per_unit')}</div>
                                </td>
                                <td className="py-2 px-3 text-center font-black text-slate-600">×{prod.quantite}</td>
                                <td className="py-2 px-3 text-right font-black text-slate-700">{formatCurrency(prod.total)}</td>
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

          ) : (
            /* ── Tab Alerte ─────────────────────────────────── */
            <div className="p-6 space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-orange-50 border border-orange-100">
                <ShieldAlert className="size-5 text-orange-500 shrink-0" />
                <p className="text-xs font-semibold text-orange-700">
                  {t('clients:history.alerte_desc', "L'alerte s'affichera lors de chaque vente à ce client.")}
                </p>
              </div>

              {/* Alerte actuelle */}
              {data?.message_alerte && !editingAlerte && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm font-semibold text-red-700">{data.message_alerte}</p>
                  </div>
                  <button onClick={() => setEditingAlerte(true)} className="text-red-400 hover:text-red-600 shrink-0">
                    <Edit3 className="size-4" />
                  </button>
                </div>
              )}

              {!data?.message_alerte && !editingAlerte && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <CheckCircle2 className="size-10 text-emerald-400" />
                  <p className="text-sm text-slate-400 font-semibold">
                    {t('clients:history.no_alerte', 'Aucune alerte active pour ce client.')}
                  </p>
                  <button
                    onClick={() => setEditingAlerte(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors"
                  >
                    <Edit3 className="size-3.5" />
                    {t('clients:history.add_alerte', 'Ajouter une alerte')}
                  </button>
                </div>
              )}

              {editingAlerte && (
                <div className="space-y-4">
                  <textarea
                    className="w-full h-28 px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none text-sm font-medium text-slate-700 bg-white outline-none transition-all"
                    placeholder={t('clients:history.alerte_placeholder', 'Ex: Client a des antécédents de créances impayées...')}
                    value={alerteText}
                    onChange={e => setAlerteText(e.target.value)}
                  />
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div
                      className={`relative w-10 h-5 rounded-full transition-colors ${alerteBlocking ? 'bg-red-500' : 'bg-slate-200'}`}
                      onClick={() => setAlerteBlocking(!alerteBlocking)}
                    >
                      <div className={`absolute top-0.5 left-0.5 size-4 bg-white rounded-full shadow transition-transform ${alerteBlocking ? 'translate-x-5' : ''}`} />
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                      {t('clients:history.blocking_alerte', 'Alerte bloquante')}
                      <span className="ml-1 font-normal text-slate-400">
                        {t('clients:history.blocking_alerte_hint', '(empêche la vente)')}
                      </span>
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveAlerte}
                      disabled={savingAlerte}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold transition-colors"
                    >
                      <Save className="size-3.5" />
                      {savingAlerte ? t('common:saving', 'Enregistrement...') : t('common:save', 'Enregistrer')}
                    </button>
                    <button
                      onClick={() => { setEditingAlerte(false); setAlerteText(data?.message_alerte || ''); }}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-bold transition-colors"
                    >
                      <XCircle className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
