import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { formatPrice } from '../../utils/formatters'
import type { Fournisseur, ProduitModel, CommandeProduit } from '../../types'
import PremiumModal from '../common/PremiumModal'
import { 
    Brain, 
    Calendar, 
    DollarSign, 
    Info,
    Package,
    Search,
    ChevronLeft,
    ShoppingCart,
    ArrowUpRight
} from 'lucide-react'

interface SuggestionCommandeModalProps {
  onClose: () => void
  onApply: (products: CommandeProduit[], fournisseurId: string) => void
  fournisseurs: Fournisseur[]
  produitsList: ProduitModel[] // Needed to resolve full product details
}

export default function SuggestionCommandeModal({ 
  onClose, 
  onApply, 
  fournisseurs,
  produitsList 
}: SuggestionCommandeModalProps) {
  const { t } = useTranslation(['orders', 'common'])
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
  
  // Internal State
  const [suggestionParams, setSuggestionParams] = useState({
      periode: 30,
      fournisseurId: '',
      mode: 'optimise', // 'simple' | 'optimise'
      budgetMax: '' // New field for budget limit
  });
  
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [totalHt, setTotalHt] = useState<number>(0); // New state for total amount
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [stepSuggestion, setStepSuggestion] = useState<1 | 2>(1); // 1 = Config, 2 = Résultats
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

  // Logic
  async function fetchSuggestions() {
      setLoadingSuggestions(true);
      try {
          const payload = {
              mode: suggestionParams.mode,
              periode: Number(suggestionParams.periode),
              fournisseur_id: suggestionParams.fournisseurId ? parseInt(suggestionParams.fournisseurId) : null,
              budget_max: suggestionParams.budgetMax ? Number(suggestionParams.budgetMax) : null
          };
          
          const response = await axios.post(`${apiBaseUrl ? apiBaseUrl.replace(/\/$/, '') : ''}/api/generer-suggestions/`, payload);
          setSuggestions(response.data.suggestions || []);
          setTotalHt(response.data.total_ht || 0); // Capture total HT
          
          // Select all by default
          const allIndices = new Set(response.data.suggestions.map((_: any, i: number) => i));
          setSelectedSuggestions(allIndices as Set<number>);
          
          setStepSuggestion(2);
      } catch (err: any) {
          const msg = err.response?.data?.message || err.message || t('orders:suggestion_modal.generation_error');
          toast.error(msg);
      } finally {
          setLoadingSuggestions(false);
      }
  }

  function handleApply() {
      // 1. Filter selected suggestions
      const selectedItems = suggestions.filter((_, i) => selectedSuggestions.has(i));
      
      if (selectedItems.length === 0) {
          toast(t('orders:suggestion_modal.no_selection'), { icon: '⚠️' });
          return;
      }

      // 2. Convert to command lines
      const newLines: CommandeProduit[] = selectedItems.map((item: any, index) => {
           const realProduct = produitsList.find(p => p.id === item.produit_id);
           
           let productStub: ProduitModel;
           
           if (realProduct) {
               productStub = realProduct;
           } else {
               // Fallback avec les données du backend
               productStub = {
                  id: item.produit_id,
                  name: item.produit_nom,
                  cip1: item.produit_ref,
                  stock: item.stock_actuel,
                  cost_price: String(item.prix_achat),
                  selling_price: String(item.prix_vente || item.prix_achat * 1.3),
                  tva: item.tva || '0',
                  taux_marge: item.taux_marge || '1.3'
              } as any;
           }

          return {
              id: Date.now() + index, // Temp ID
              produit: productStub,
              quantity: item.quantite_suggeree,
              unites_gratuites: 0,
              price: String(item.prix_achat || productStub.cost_price || 0),
              tva: item.tva || productStub.tva || '0',
              marge: item.taux_marge || productStub.taux_marge || '1.3',
              selling_price: String(item.prix_vente || productStub.selling_price || 0),
              lot: '',
              date_expiration: ''
          };
      });

      // Determined supplier ID
      let supplierId = '';
      if (suggestionParams.fournisseurId) {
          supplierId = suggestionParams.fournisseurId;
      } else if (selectedItems.length > 0 && selectedItems[0].fournisseur_id) {
          supplierId = String(selectedItems[0].fournisseur_id);
      }

      onApply(newLines, supplierId);
  }

  function toggleSuggestionSelection(index: number) {
      setSelectedSuggestions(prev => {
          const next = new Set(prev);
          if (next.has(index)) next.delete(index);
          else next.add(index);
          return next;
      });
  }

  const periodOptions = [
      { label: t('orders:suggestion_modal.period_guard'), value: 3 },
      { label: t('orders:suggestion_modal.period_week'), value: 7 },
      { label: t('orders:suggestion_modal.period_decade'), value: 10 },
      { label: t('orders:suggestion_modal.period_fortnight'), value: 15 },
      { label: t('orders:suggestion_modal.period_month'), value: 30 }
  ];

  const footer = (
    <div className="flex justify-between items-center w-full">
        {stepSuggestion === 2 ? (
            <button className="btn btn-ghost hover:bg-base-200" onClick={() => setStepSuggestion(1)}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                {t('orders:suggestion_modal.back_to_params')}
            </button>
        ) : (
            <button className="btn btn-ghost hover:bg-base-200 text-base-content/40" onClick={onClose}>
                {t('orders:suggestion_modal.close')}
            </button>
        )}
        
        {stepSuggestion === 1 ? (
            <button 
                className="btn btn-primary px-8 shadow-lg shadow-primary/20"
                onClick={fetchSuggestions}
                disabled={loadingSuggestions}
            >
                {loadingSuggestions ? (
                    <span className="loading loading-spinner loading-xs"></span>
                ) : (
                    <>
                        <Search className="w-4 h-4 mr-2" />
                        {t('orders:suggestion_modal.launch_analysis')}
                    </>
                )}
            </button>
        ) : (
            <div className="flex gap-3">
                <button 
                    className="btn btn-primary px-8 shadow-lg shadow-primary/20" 
                    onClick={handleApply}
                    disabled={selectedSuggestions.size === 0}
                >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {t('orders:suggestion_modal.create_order', { count: selectedSuggestions.size })}
                </button>
            </div>
        )}
    </div>
  );

  return (
    <PremiumModal
        isOpen={true}
        onClose={onClose}
        title={t('orders:suggestion_modal.title')}
        subtitle={stepSuggestion === 1 ? t('orders:suggestion_modal.subtitle_config') : t('orders:suggestion_modal.subtitle_results', { count: suggestions.length })}
        icon={<Brain className="w-6 h-6 text-primary" />}
        maxWidth="max-w-6xl"
        footer={footer}
    >
        <div className="p-6 bg-slate-50/50 min-h-[400px]">
            {stepSuggestion === 1 ? (
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Mode Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label 
                            className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border-2 transition-all ${
                                suggestionParams.mode === 'simple' 
                                ? 'border-primary bg-primary/5 shadow-md' 
                                : 'border-base-200 bg-base-100 hover:border-primary/50'
                            }`}
                        >
                            <input 
                                type="radio" 
                                name="mode" 
                                className="hidden" 
                                checked={suggestionParams.mode === 'simple'}
                                onChange={() => setSuggestionParams(prev => ({ ...prev, mode: 'simple' }))}
                            />
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-lg ${suggestionParams.mode === 'simple' ? 'bg-primary text-white' : 'bg-base-200 text-base-content/60'}`}>
                                    <Package className="w-5 h-5" />
                                </div>
                                <span className="font-bold text-base-content">{t('orders:suggestion_modal.mode_simple_title')}</span>
                            </div>
                            <p className="text-sm text-base-content/60">
                                {t('orders:suggestion_modal.mode_simple_desc')}
                            </p>
                            {suggestionParams.mode === 'simple' && (
                                <div className="absolute top-4 right-4 text-primary">
                                    <div className="w-2 h-2 rounded-full bg-primary animate-ping absolute"></div>
                                    <div className="w-2 h-2 rounded-full bg-primary relative"></div>
                                </div>
                            )}
                        </label>

                        <label 
                            className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border-2 transition-all ${
                                suggestionParams.mode === 'optimise' 
                                ? 'border-primary bg-primary/5 shadow-md' 
                                : 'border-base-200 bg-base-100 hover:border-primary/50'
                            }`}
                        >
                            <input 
                                type="radio" 
                                name="mode" 
                                className="hidden" 
                                checked={suggestionParams.mode === 'optimise'}
                                onChange={() => setSuggestionParams(prev => ({ ...prev, mode: 'optimise' }))}
                            />
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-lg ${suggestionParams.mode === 'optimise' ? 'bg-primary text-white' : 'bg-base-200 text-base-content/60'}`}>
                                    <Brain className="w-5 h-5" />
                                </div>
                                <span className="font-bold text-base-content">{t('orders:suggestion_modal.mode_smart_title')}</span>
                            </div>
                            <p className="text-sm text-base-content/60">
                                {t('orders:suggestion_modal.mode_smart_desc')}
                            </p>
                            {suggestionParams.mode === 'optimise' && (
                                <div className="absolute top-4 right-4 text-primary">
                                    <div className="w-2 h-2 rounded-full bg-primary animate-ping absolute"></div>
                                    <div className="w-2 h-2 rounded-full bg-primary relative"></div>
                                </div>
                            )}
                        </label>
                    </div>

                    <div className="bg-base-100 rounded-2xl p-6 border border-gray-100 shadow-sm space-y-6">
                        {/* Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-base-content/40 uppercase tracking-wider flex items-center gap-2">
                                    <Package className="w-3 h-3" />
                                    {t('orders:suggestion_modal.supplier_label')}
                                </label>
                                <select 
                                    className="select select-bordered w-full bg-base-200/50 border-base-200 focus:border-primary rounded-xl"
                                    value={suggestionParams.fournisseurId}
                                    onChange={(e) => setSuggestionParams(prev => ({ ...prev, fournisseurId: e.target.value }))}
                                >
                                    <option value="">{t('orders:suggestion_modal.all_suppliers')}</option>
                                    {fournisseurs.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-base-content/40 uppercase tracking-wider flex items-center gap-2">
                                    <DollarSign className="w-3 h-3" />
                                    {t('orders:suggestion_modal.budget_label')}
                                    <div className="tooltip" data-tip={t('orders:suggestion_modal.budget_tooltip')}>
                                        <Info className="w-3 h-3 text-base-content/30" />
                                    </div>
                                </label>
                                <div className="join w-full">
                                    <input 
                                        type="number" 
                                        placeholder={t('orders:suggestion_modal.budget_placeholder')}
                                        className="input input-bordered join-item w-full bg-base-200/50 border-base-200 focus:border-primary rounded-l-xl"
                                        value={suggestionParams.budgetMax}
                                        onChange={(e) => setSuggestionParams(prev => ({ ...prev, budgetMax: e.target.value }))}
                                    />
                                    <span className="join-item px-4 bg-base-200 border border-base-200 border-l-0 flex items-center font-bold text-base-content/40 rounded-r-xl">{t('common:currency_symbol', 'F')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Period Selection */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-base-content/40 uppercase tracking-wider flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                {t('orders:suggestion_modal.period_label')}
                            </label>
                            
                            <div className="flex flex-wrap gap-2">
                                {periodOptions.map(p => (
                                    <button
                                        key={p.value}
                                        type="button"
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                            suggestionParams.periode === p.value
                                            ? 'bg-primary text-white shadow-md'
                                            : 'bg-base-200 text-base-content/80 hover:bg-base-300'
                                        }`}
                                        onClick={() => setSuggestionParams(prev => ({ ...prev, periode: p.value }))}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                                <div className="flex items-center gap-2 px-3 py-1 bg-base-200/50 border border-base-200 rounded-full ml-auto">
                                   <input 
                                        type="number" 
                                        className="w-12 bg-transparent border-none focus:outline-none text-right font-bold text-primary"
                                        value={suggestionParams.periode}
                                        min={1}
                                        max={365}
                                        onChange={(e) => setSuggestionParams(prev => ({ ...prev, periode: parseInt(e.target.value) || 0 }))}
                                    />
                                    <span className="text-xs text-base-content/40 pr-1">{t('orders:suggestion_modal.days_unit')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* STEP 2 : RÉSULTATS */
                <div className="flex flex-col h-full gap-4 max-h-[600px]">
                    <div className="flex items-center justify-between gap-4 p-4 bg-base-100 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <Info className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-base-content">{t('orders:suggestion_modal.analysis_done')}</h4>
                                <p className="text-sm text-base-content/60">{t('orders:suggestion_modal.results_count', { count: suggestions.length })}</p>
                            </div>
                        </div>
                        <div className="bg-slate-900 text-white rounded-xl px-4 py-2 text-right">
                            <div className="text-[10px] uppercase font-bold text-base-content/40 flex items-center gap-1 justify-end">
                                <DollarSign className="w-3 h-3" />
                                {t('orders:suggestion_modal.total_estimated')}
                            </div>
                            <div className="text-xl font-mono font-bold">{formatPrice(totalHt)} <span className="text-xs">{t('common:currency_symbol', 'F')}</span></div>
                        </div>
                    </div>

                    {suggestions.length > 0 ? (
                        <div className="flex-1 overflow-auto rounded-2xl border border-gray-100 bg-base-100">
                            <table className="table table-pin-rows">
                                <thead className="bg-gray-50/80 backdrop-blur-md">
                                    <tr className="text-base-content/40 uppercase text-[10px] tracking-widest border-b border-gray-100">
                                        <th className="bg-transparent">
                                            <input 
                                                type="checkbox" 
                                                className="checkbox checkbox-sm checkbox-primary rounded-md" 
                                                checked={selectedSuggestions.size === suggestions.length && suggestions.length > 0}
                                                onChange={() => {
                                                    if (selectedSuggestions.size === suggestions.length) {
                                                        setSelectedSuggestions(new Set());
                                                    } else {
                                                        const all = new Set(suggestions.map((_, i) => i));
                                                        setSelectedSuggestions(all as Set<number>);
                                                    }
                                                }}
                                            />
                                        </th>
                                        <th className="bg-transparent">{t('orders:suggestion_modal.table_designation')}</th>
                                        <th className="text-center bg-transparent">{t('orders:suggestion_modal.table_stock')}</th>
                                        <th className="text-center bg-transparent">{t('orders:suggestion_modal.table_sales')}</th>
                                        <th className="text-right bg-transparent">{t('orders:suggestion_modal.table_qty')}</th>
                                        <th className="text-right bg-transparent">{t('orders:suggestion_modal.table_total_ht')}</th>
                                        <th className="bg-transparent">{t('orders:suggestion_modal.table_priority')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suggestions.map((item, index) => (
                                        <tr 
                                            key={index} 
                                            className={`hover:bg-primary/5 transition-colors cursor-pointer group ${selectedSuggestions.has(index) ? 'bg-primary/5' : ''}`}
                                            onClick={() => toggleSuggestionSelection(index)}
                                        >
                                            <td className="w-4">
                                                <input 
                                                    type="checkbox" 
                                                    className="checkbox checkbox-sm checkbox-primary rounded-md" 
                                                    checked={selectedSuggestions.has(index)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        toggleSuggestionSelection(index);
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <div className="flex flex-col">
                                                    <div className="font-bold text-base-content/90 flex items-center gap-2">
                                                        {item.produit_nom}
                                                        {item.is_supplier_exclusive && (
                                                            <span className="badge badge-sm badge-success text-[8px] font-bold text-white">{t('orders:suggestion_modal.exclusive_badge')}</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-base-content/40 font-mono tracking-tighter">REF: {item.produit_ref}</div>
                                                </div>
                                            </td>
                                            <td className="text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${item.stock_actuel <= 0 ? 'bg-red-100 text-red-600' : 'bg-base-200 text-base-content/80'}`}>
                                                    {item.stock_actuel}
                                                </span>
                                            </td>
                                            <td className="text-center text-sm font-medium text-base-content/60">
                                                {item.ventes_periode}
                                            </td>
                                            <td className="text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-lg font-bold text-primary">{item.quantite_suggeree}</span>
                                                    <span className="text-[10px] text-base-content/40">{formatPrice(item.prix_achat)} {t('common:currency_symbol', 'F')} / {t('common:units_short', 'u')}</span>
                                                </div>
                                            </td>
                                            <td className="text-right font-mono font-bold text-base-content/90">
                                                {formatPrice(item.montant_ht || (item.prix_achat * item.quantite_suggeree))} {t('common:currency_symbol', 'F')}
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    {item.score_urgence > 50 ? (
                                                        <div className="badge badge-error badge-xs animate-pulse">{t('orders:suggestion_modal.critical_badge')}</div>
                                                    ) : (
                                                        <div className="badge badge-ghost badge-xs text-base-content/40 uppercase font-bold text-[8px]">{t('orders:suggestion_modal.standard_badge')}</div>
                                                    )}
                                                    <div className="tooltip tooltip-left" data-tip={item.raison}>
                                                        <ArrowUpRight className="w-4 h-4 text-base-content/30 group-hover:text-primary transition-colors" />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center bg-base-100 rounded-2xl border-2 border-dashed border-gray-100 p-12 text-center">
                            <div className="w-16 h-16 bg-base-200/50 rounded-full flex items-center justify-center mb-4">
                                <Search className="w-8 h-8 text-base-content/30" />
                            </div>
                            <h3 className="text-lg font-bold text-base-content">{t('orders:suggestion_modal.no_results_title')}</h3>
                            <p className="text-base-content/60 max-w-sm mx-auto">
                                {t('orders:suggestion_modal.no_results_desc')}
                            </p>
                            <button className="btn btn-ghost btn-sm mt-4 text-primary" onClick={() => setStepSuggestion(1)}>
                                {t('orders:suggestion_modal.modify_params')}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    </PremiumModal>
  )
}
