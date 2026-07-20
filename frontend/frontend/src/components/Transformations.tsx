import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { getApiErrorDetail } from '../utils/errorHandling';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../hooks/useConfirm';
import { useProductSearch } from '../hooks/useProductSearch';
import { useSearchNavigation } from '../hooks/useSearchNavigation';
import PremiumModal from './common/PremiumModal';
import { Checkbox } from './ui/Checkbox';
import type { ProduitModel } from '../types';
import { 
  ChevronRight, Trash2, Plus 
} from 'lucide-react';
import { normalizeNumberInput, formatNumber } from '../utils/formatters';
import { formatDate, formatDateTime } from '../utils/dateUtils';

// Interfaces
interface RelationTransformation {
  id: number;
  produit_source: number;
  produit_source_nom: string;
  produit_destination: number;
  produit_destination_nom: string;
  ratio: number;
  actif: boolean;
}

interface HistoriqueTransformation {
  id: number;
  produit_source_nom: string;
  produit_destination_nom: string;
  quantite_source: number;
  quantite_destination: number;
  user_nom: string;
  date_transformation: string;
  notes: string;
}

// --- Composant Autocomplete Produit ---
interface ProductAutocompleteProps {
  label: string;
  icon: React.ReactNode;
  selected: ProduitModel | null;
  onSelect: (product: ProduitModel) => void;
  onClear: () => void;
  placeholder?: string;
}

const ProductAutocomplete: React.FC<ProductAutocompleteProps> = ({
  label, icon, selected, onSelect, onClear, placeholder
}) => {
  const { t } = useTranslation(['stock', 'common']);
  const placeholderText = placeholder || t('stock:transformations.modal_relation.source_placeholder');
  const { produits, loading, searchQuery, setSearchQuery } = useProductSearch({
    minSearchLength: 2,
    debounceMs: 250,
    pageSize: 1000,
  });
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard navigation
  const handleSelect = (product: ProduitModel) => {
    onSelect(product);
    setSearchQuery('');
    setIsFocused(false);
  };

  const { handleKeyDown, getItemProps } = useSearchNavigation(
    produits,
    handleSelect,
    { resetOnSelect: true, searchInputRef: inputRef }
  );

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (selected) {
    return (
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
          {icon} {label}
        </label>
        <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-emerald-100/60 border-2 border-emerald-200 rounded-xl px-4 py-3 transition-all">
          <div className="size-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 font-black text-sm">
            {selected.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-800 truncate">{selected.name}</div>
            <div className="text-[11px] text-slate-400 flex gap-3">
              <span>{t('common:cip')}: {selected.cip1 || t('common:not_available')}</span>
              <span>{t('common:stock')}: <b className={selected.stock <= 0 ? 'text-red-500' : 'text-emerald-600'}>{formatNumber(selected.stock)}</b></span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="size-7 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  const showResults = isFocused && searchQuery.length >= 2;

  return (
    <div ref={containerRef}>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
        {icon} {label}
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          className="w-full pl-10 h-12 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          placeholder={placeholderText}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={(e) => {
            if (showResults) {
              handleKeyDown(e);
            }
          }}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="size-4 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin inline-block"></span>
          </div>
        )}

        {/* Dropdown résultats */}
        {showResults && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
            {produits.length === 0 && !loading && (
              <div className="p-4 text-center text-slate-400 italic text-sm">
                {t('common:no_results_found')}
              </div>
            )}
            {produits.map((p, idx) => {
              const itemProps = getItemProps(idx);
              return (
                <div
                  key={p.id}
                  id={itemProps.id}
                  onMouseEnter={itemProps.onMouseEnter}
                  className={`px-4 py-3 cursor-pointer border-b border-slate-100 last:border-0 flex items-center gap-3 transition-colors group ${itemProps.className}`}
                  style={itemProps.style}
                  onClick={() => handleSelect(p)}
                >
                  <div className="size-8 rounded-lg bg-slate-100 group-hover:bg-emerald-50 flex items-center justify-center text-slate-500 group-hover:text-emerald-600 font-bold text-xs transition-colors"
                    style={itemProps.style.backgroundColor ? { backgroundColor: 'rgba(255,255,255,0.2)' } : {}}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate text-slate-700">{p.name}</div>
                    <div className="text-[10px] flex gap-3 text-slate-400">
                      <span>{t('common:cip')}: {p.cip1 || t('common:not_available')}</span>
                      <span>{t('common:stock')}: <b>{formatNumber(p.stock)}</b></span>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Composant Principal ---
const Transformations: React.FC = () => {
  const { t } = useTranslation(['stock', 'common']);
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'relations' | 'historique'>('relations');
  const [relations, setRelations] = useState<RelationTransformation[]>([]);
  const [historique, setHistorique] = useState<HistoriqueTransformation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isRelationModalOpen, setIsRelationModalOpen] = useState(false);
  const [isTransformerModalOpen, setIsTransformerModalOpen] = useState(false);
  
  // Création relation - produits sélectionnés
  const [selectedSource, setSelectedSource] = useState<ProduitModel | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<ProduitModel | null>(null);
  const [ratioValue, setRatioValue] = useState('');
  
  const [transformationData, setTransformationData] = useState({
    relation: null as RelationTransformation | null,
    quantite: 1,
    notes: ''
  });

  const [preview, setPreview] = useState<{
    stock_source: number;
    stock_source_after: number;
    stock_destination: number;
    stock_destination_after: number;
    quantite_source: number;
    quantite_destination: number;
    ratio: number;
    use_lot_management: boolean;
    lots: {
      lot_id: number;
      lot: string;
      quantity_remaining: number;
      quantity_consumed: number;
      quantity_remaining_after: number;
      date_expiration: string | null;
      fournisseur: string | null;
      selected: boolean;
    }[];
    manual_lots_enabled: boolean;
  } | null>(null);

  const [manualLots, setManualLots] = useState<Record<number, number>>({});

  const [submitting, setSubmitting] = useState(false);

  // URL de base API dynamique

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [relationsRes, historiqueRes] = await Promise.all([
        api.get('relations-transformation/'),
        api.get('historique-transformation/')
      ]);
      
      const relationsData = Array.isArray(relationsRes.data) ? relationsRes.data : (relationsRes.data.results || []);
      const historiqueData = Array.isArray(historiqueRes.data) ? historiqueRes.data : (historiqueRes.data.results || []);

      setRelations(relationsData);
      setHistorique(historiqueData);
      setLoading(false);
    } catch (error) {
      console.error("Erreur fetch:", error);
      toast.error(t('transformations.messages.load_error'));
      setLoading(false);
    }
  };

  const handleCreateRelation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSource || !selectedDestination || !ratioValue) return;

    try {
      await api.post('relations-transformation/', {
        produit_source: selectedSource.id,
        produit_destination: selectedDestination.id,
        ratio: normalizeNumberInput(ratioValue)
      });
      toast.success(t('transformations.messages.create_success'));
      setIsRelationModalOpen(false);
      resetRelationForm();
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorDetail(error, t('transformations.messages.create_error')));
    }
  };

  const resetRelationForm = () => {
    setSelectedSource(null);
    setSelectedDestination(null);
    setRatioValue('');
  };

  const handleDeleteRelation = async (id: number) => {
    const confirmed = await confirm({
      title: t('transformations.messages.delete_confirm_title'),
      message: t('transformations.messages.delete_confirm_message'),
      variant: 'danger',
      confirmText: t('transformations.messages.delete_confirm_btn')
    })
    if (!confirmed) return;
    try {
      await api.delete(`relations-transformation/${id}/`);
      toast.success(t('transformations.messages.delete_success'));
      fetchData();
    } catch {
      toast.error(t('transformations.messages.delete_error'));
    }
  };

  const openTransformerModal = (relation: RelationTransformation) => {
    setSubmitting(false);
    setManualLots({});
    setTransformationData({
      relation,
      quantite: 1,
      notes: ''
    });
    setIsTransformerModalOpen(true);
  };

  const handleTransformer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transformationData.relation) return;

    const confirmed = await confirm({
      title: t('transformations.messages.transform_confirm_title', { defaultValue: 'Confirmer la transformation' }),
      message: t('transformations.messages.transform_confirm_message', { defaultValue: `Transformer ${transformationData.quantite} ${transformationData.relation.produit_source_nom} en ${quantiteDestinationCalculee} ${transformationData.relation.produit_destination_nom} ?` }),
      variant: 'warning',
      confirmText: t('transformations.messages.transform_confirm_btn', { defaultValue: 'Oui, transformer' })
    });
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const res = await api.post(`relations-transformation/${transformationData.relation.id}/transformer/`, {
        quantite: transformationData.quantite,
        notes: transformationData.notes,
        lots: Object.entries(manualLots)
          .flatMap(([lot_id, qty]) => qty > 0 ? [{ lot_id: Number(lot_id), quantity: qty }] : [])
      });

      if (res.data.success) {
        toast.success(res.data.message || t('transformations.messages.transform_success'));
        setIsTransformerModalOpen(false);
        fetchData();
      }
    } catch (error) {
      toast.error(getApiErrorDetail(error, t('transformations.messages.transform_error')));
      setSubmitting(false);
    }
  };

  // Calculs dynamiques pour le modal transformer
  const quantiteDestinationCalculee = transformationData.relation 
    ? Math.floor(transformationData.quantite * transformationData.relation.ratio) 
    : 0;

  // Récupérer la prévisualisation des lots consommés
  const fetchPreview = async (relation: RelationTransformation, quantite: number) => {
    if (!relation || quantite <= 0) {
      setPreview(null);
      setManualLots({});
      return;
    }
    try {
      const res = await api.post(`relations-transformation/${relation.id}/preview/`, { quantite });
      setPreview(res.data);
      // Initialiser les lots manuels depuis la sélection FEFO
      const initialManual: Record<number, number> = {};
      res.data.lots?.forEach((lot: unknown) => {
        if (lot.quantity_consumed > 0) {
          initialManual[lot.lot_id] = lot.quantity_consumed;
        }
      });
      setManualLots(initialManual);
    } catch (error) {
      console.error('Erreur preview transformation:', error);
      setPreview(null);
      setManualLots({});
    }
  };

  useEffect(() => {
    if (transformationData.relation) {
      fetchPreview(transformationData.relation, transformationData.quantite);
    } else {
      setPreview(null);
      setManualLots({});
    }
  }, [transformationData.relation, transformationData.quantite]);

  // Calculer le total sélectionné manuellement
  const manualTotal = Object.values(manualLots).reduce((sum, qty) => sum + (qty || 0), 0);

  // Filtrage recherche
  const filteredRelations = relations.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return r.produit_source_nom.toLowerCase().includes(q) || r.produit_destination_nom.toLowerCase().includes(q);
  });
  const filteredHistorique = historique.filter(h => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return h.produit_source_nom.toLowerCase().includes(q) || h.produit_destination_nom.toLowerCase().includes(q);
  });

  // Mettre à jour la quantité d'un lot manuellement
  const updateManualLotQty = (lot_id: number, qty: number) => {
    setManualLots(prev => {
      const next = { ...prev };
      if (qty <= 0) {
        delete next[lot_id];
      } else {
        next[lot_id] = qty;
      }
      return next;
    });
  };

  // Basculer la sélection d'un lot
  const toggleManualLot = (lot_id: number, maxQty: number, currentQty: number) => {
    if (currentQty > 0) {
      updateManualLotQty(lot_id, 0);
    } else {
      // Attribuer automatiquement ce qui manque jusqu'à la quantité totale
      const remainingNeeded = transformationData.quantite - manualTotal;
      const qty = Math.min(maxQty, Math.max(0, remainingNeeded));
      if (qty > 0) {
        updateManualLotQty(lot_id, qty);
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden font-sans">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 flex flex-col shrink-0">
        <div className="px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">{t('transformations.title')}</h1>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">{t('transformations.subtitle')}</p>
            </div>
          </div>
          <button 
            onClick={() => { resetRelationForm(); setIsRelationModalOpen(true); }}
            className="inline-flex items-center gap-2 h-10 px-5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            {t('transformations.new_relation_btn')}
          </button>
        </div>

        {/* Tab Navigation + Search */}
        <div className="px-6 py-2 bg-slate-50 flex items-center gap-1 border-t border-slate-100">
          <button 
            className={`h-8 px-4 rounded-lg text-xs font-bold transition-all duration-200 ${
              activeTab === 'relations' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'
            }`}
            onClick={() => setActiveTab('relations')}
          >
            {t('transformations.tabs.configured_relations')}
          </button>
          <button 
            className={`h-8 px-4 rounded-lg text-xs font-bold transition-all duration-200 ${
              activeTab === 'historique' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'
            }`}
            onClick={() => setActiveTab('historique')}
          >
            {t('transformations.tabs.history')}
          </button>
          <div className="flex-1" />
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="h-8 w-56 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              placeholder={t('common:search', { defaultValue: 'Rechercher...' })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Main Content Section */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <span className="size-10 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></span>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('common:loading')}</p>
          </div>
        ) : (
          <div className="h-full">
            {activeTab === 'relations' && (
              <div className="space-y-3">
                {filteredRelations.map(relation => (
                  <div key={relation.id} className="group relative bg-white border border-slate-200 rounded-2xl px-5 py-4 hover:border-emerald-300 transition-all hover:shadow-md flex items-center gap-4">
                    {/* Source */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="size-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-black shadow-inner shrink-0">
                        {relation.produit_source_nom.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t('common:source')}</div>
                        <div className="font-bold text-sm text-slate-700 truncate" title={relation.produit_source_nom}>{relation.produit_source_nom}</div>
                      </div>
                    </div>

                    {/* Arrow + Ratio */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-300 group-hover:text-emerald-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      <span className="bg-emerald-600 text-white font-mono font-black text-[10px] h-5 px-2 rounded-full inline-flex items-center">1:{formatNumber(relation.ratio)}</span>
                    </div>

                    {/* Destination */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="min-w-0">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t('stock:transformations.labels.dest')}</div>
                        <div className="font-bold text-sm truncate text-emerald-600" title={relation.produit_destination_nom}>{relation.produit_destination_nom}</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        className="h-9 px-5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                        onClick={() => openTransformerModal(relation)}
                      >
                        {t('stock:transformations.labels.transformer')}
                      </button>
                      <button 
                        className="size-9 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                        onClick={() => handleDeleteRelation(relation.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredRelations.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-300 italic">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    <p className="font-bold uppercase tracking-widest text-xs">{searchQuery ? t('common:no_results_found', { defaultValue: 'Aucun résultat' }) : t('stock:transformations.labels.no_relations')}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'historique' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto whitespace-nowrap">
                  <table className="w-full border-separate border-spacing-0 text-sm">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                      <tr className="text-slate-400 uppercase text-[10px] tracking-widest font-black h-12">
                        <th className="pl-6 text-left font-black">{t('transformations.table_history.date')}</th>
                        <th className="px-4 text-left font-black">{t('transformations.table_history.user')}</th>
                        <th className="px-4 text-left font-black">{t('transformations.table_history.transformation')}</th>
                        <th className="px-4 text-left font-black">{t('transformations.table_history.quantities')}</th>
                        <th className="px-4 pr-6 text-left font-black">{t('transformations.table_history.notes')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredHistorique.map(hist => (
                        <tr key={hist.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="pl-6 py-4">
                             <div className="font-bold text-xs text-slate-800">{formatDate(hist.date_transformation)}</div>
                             <div className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">{formatDateTime(hist.date_transformation).split(' ').slice(1).join(' ')}</div>
                          </td>
                          <td className="px-4 font-black text-xs text-emerald-700">{hist.user_nom}</td>
                          <td className="px-4 max-w-xs">
                             <div className="flex items-center gap-2 text-xs font-bold truncate">
                                <span className="text-slate-400">{hist.produit_source_nom}</span>
                                <ChevronRight size={12} className="text-slate-300" />
                                <span className="text-emerald-600">{hist.produit_destination_nom}</span>
                             </div>
                          </td>
                          <td className="px-4">
                             <div className="flex items-center gap-3">
                                <div className="bg-red-50 text-red-500 px-2 py-0.5 rounded text-[10px] font-black font-mono">-{formatNumber(hist.quantite_source)}</div>
                                <ChevronRight size={12} className="text-slate-200" />
                                <div className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-black font-mono">+{formatNumber(hist.quantite_destination)}</div>
                             </div>
                          </td>
                          <td className="px-4 pr-6 italic text-slate-400 text-[11px] max-w-sm truncate group-hover:whitespace-normal group-hover:overflow-visible transition-all">
                             {hist.notes || '-'}
                          </td>
                        </tr>
                      ))}
                      {filteredHistorique.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-20 text-slate-300 italic font-bold uppercase tracking-widest text-xs">{searchQuery ? t('common:no_results_found', { defaultValue: 'Aucun résultat' }) : t('stock:transformations.table_history.empty')}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== Modal Création Relation ===== */}
      <PremiumModal
        isOpen={isRelationModalOpen}
        onClose={() => setIsRelationModalOpen(false)}
        title={t('transformations.modal_relation.title')}
        subtitle={t('transformations.modal_relation.subtitle')}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        }
      >
        <form onSubmit={handleCreateRelation} className="p-6 space-y-5">
          {/* Produit Source */}
          <ProductAutocomplete
            label={t('transformations.modal_relation.source')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
            selected={selectedSource}
            onSelect={setSelectedSource}
            onClear={() => setSelectedSource(null)}
            placeholder={t('transformations.modal_relation.source_placeholder')}
          />

          {/* Separation Arrow */}
          <div className="flex items-center justify-center py-1">
            <div className="flex items-center gap-2 text-base-200">
              <div className="h-px w-12 bg-base-300"></div>
              <div className="size-8 rounded-full bg-primary/5 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
              <div className="h-px w-12 bg-base-300"></div>
            </div>
          </div>

          {/* Produit Destination */}
          <ProductAutocomplete
            label={t('transformations.modal_relation.destination')}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            }
            selected={selectedDestination}
            onSelect={setSelectedDestination}
            onClear={() => setSelectedDestination(null)}
            placeholder={t('transformations.modal_relation.destination_placeholder')}
          />

          {/* Ratio */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
              {t('transformations.modal_relation.ratio_label')}
            </label>
            <input 
              type="number" 
              step="0.01"
              className="w-full h-12 rounded-xl border-2 border-slate-200 bg-slate-50 text-lg font-black text-center focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" 
              placeholder={t('stock:transformations.modal_relation.ratio_placeholder')}
              value={ratioValue}
              onChange={e => setRatioValue(e.target.value)}
              required
            />
            <p className="text-[11px] font-medium text-slate-400 mt-1.5 text-center px-4">
              {t('transformations.modal_relation.ratio_help')}
            </p>
          </div>

          {/* Preview */}
          {selectedSource && selectedDestination && ratioValue && (
            <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl p-4 shadow-inner">
              <div className="flex items-center justify-between text-sm">
                  <div className="text-center flex-1">
                    <div className="font-bold text-slate-800 truncate text-xs">{selectedSource.name}</div>
                    <div className="text-[10px] font-black text-slate-400 mt-0.5">× 1 {t('stock:transformations.labels.unit')}</div>
                  </div>
                  <div className="px-4 text-emerald-400 flex flex-col items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <span className="text-[10px] font-black mt-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">× {ratioValue}</span>
                  </div>
                  <div className="text-center flex-1">
                    <div className="font-bold text-emerald-600 truncate text-xs">{selectedDestination.name}</div>
                    <div className="text-[10px] font-black text-emerald-400/60 mt-0.5">× {Math.floor(normalizeNumberInput(ratioValue))} {t('stock:transformations.labels.units')}</div>
                  </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" className="h-10 px-6 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors" onClick={() => setIsRelationModalOpen(false)}>
              {t('transformations.modal_relation.cancel')}
            </button>
            <button 
              type="submit" 
              className="inline-flex items-center gap-2 h-10 px-8 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
              disabled={!selectedSource || !selectedDestination || !ratioValue}
            >
              <Plus size={16} />
              {t('transformations.modal_relation.create')}
            </button>
          </div>
        </form>
      </PremiumModal>

      {/* ===== Modal Transformer ===== */}
      <PremiumModal
        isOpen={isTransformerModalOpen && !!transformationData.relation}
        onClose={() => setIsTransformerModalOpen(false)}
        title={t('transformations.modal_transform.title')}
        subtitle={t('transformations.modal_transform.subtitle')}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        }
        gradientFrom="accent/10"
        gradientVia="primary/5"
        gradientTo="success/10"
        maxWidth="max-w-xl"
        disableClose={submitting}
      >
        {transformationData.relation && (
          <form onSubmit={handleTransformer} className="p-6 space-y-5">
            {/* Source → Destination cards */}
            <div className="flex items-stretch gap-3">
              {/* Source */}
              <div className="flex-1 bg-gradient-to-b from-red-50 to-transparent border border-red-200 rounded-2xl p-4 text-center">
                <div className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-3 flex items-center justify-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" />
                  </svg>
                  {t('common:source')}
                </div>
                <div className="font-bold text-slate-800 text-xs mb-4 h-8 flex items-center justify-center line-clamp-2" title={transformationData.relation.produit_source_nom}>{transformationData.relation.produit_source_nom}</div>
                <input 
                  type="number" 
                  className="w-full h-14 rounded-xl border-2 border-slate-200 bg-slate-50 text-2xl font-black text-center focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  min="1"
                  value={transformationData.quantite}
                  onChange={e => setTransformationData({...transformationData, quantite: normalizeNumberInput(e.target.value)})}
                  required
                  autoFocus
                />
                <div className="text-[10px] uppercase font-black text-slate-400 mt-3">{t('transformations.modal_transform.qty_to_transform')}</div>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center justify-center gap-2 px-1 pt-6">
                <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">× {transformationData.relation.ratio}</span>
              </div>

              {/* Destination */}
              <div className="flex-1 bg-gradient-to-b from-emerald-50 to-transparent border border-emerald-200 rounded-2xl p-4 text-center">
                <div className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-3 flex items-center justify-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                  </svg>
                  {t('common:destination')}
                </div>
                <div className="font-bold text-slate-800 text-xs mb-4 h-8 flex items-center justify-center line-clamp-2" title={transformationData.relation.produit_destination_nom}>{transformationData.relation.produit_destination_nom}</div>
                <div className="w-full h-14 rounded-xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center font-black text-2xl text-emerald-600 shadow-inner">
                  {formatNumber(quantiteDestinationCalculee)}
                </div>
                <div className="text-[10px] uppercase font-black text-emerald-400 mt-3">{t('transformations.modal_transform.qty_obtained')}</div>
                {preview && (
                  <div className="mt-3 pt-3 border-t border-emerald-100 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">{t('stock:transformations.preview.current_stock')}</span>
                      <span className="font-bold text-slate-600">{formatNumber(preview.stock_destination)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-emerald-400 font-bold uppercase tracking-wider">{t('stock:transformations.preview.stock_after')}</span>
                      <span className="font-bold text-emerald-600">{formatNumber(preview.stock_destination_after)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Informations stock source et lots */}
            {preview && (
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{t('stock:transformations.preview.stock_remaining')}</span>
                  <span className="font-bold text-slate-800">
                    {formatNumber(preview.stock_source - manualTotal)} / {formatNumber(preview.stock_source)}
                  </span>
                </div>
                {preview.use_lot_management && preview.lots.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {t('stock:transformations.preview.lots_consumed')}
                      </div>
                      <div className={`text-[10px] font-bold ${manualTotal === transformationData.quantite ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {formatNumber(manualTotal)} / {formatNumber(transformationData.quantite)} {t('stock:transformations.preview.selected')}
                      </div>
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {preview.lots.map((lot) => {
                        const currentQty = manualLots[lot.lot_id] || 0;
                        return (
                          <div key={lot.lot_id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-100 text-xs">
                            <Checkbox
                              checked={currentQty > 0}
                              onChange={() => toggleManualLot(lot.lot_id, lot.quantity_remaining, currentQty)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-emerald-600 truncate">{lot.lot}</span>
                                {lot.date_expiration && (
                                  <span className="text-[10px] text-slate-400">{formatDate(lot.date_expiration)}</span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {formatNumber(lot.quantity_remaining)} {t('stock:transformations.preview.available')}{lot.quantity_remaining > 1 ? 's' : ''}
                              </div>
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={lot.quantity_remaining}
                              value={currentQty}
                              disabled={currentQty <= 0}
                              onChange={(e) => {
                                const val = normalizeNumberInput(e.target.value);
                                updateManualLotQty(lot.lot_id, Math.min(val, lot.quantity_remaining));
                              }}
                              className="w-16 h-8 rounded-lg border border-slate-200 text-center text-xs font-bold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 disabled:text-slate-400"
                            />
                            <div className="text-right w-14 shrink-0 text-[10px] text-slate-400">
                              {formatNumber(lot.quantity_remaining - currentQty)} {t('stock:transformations.preview.remaining')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {manualTotal !== transformationData.quantite && (
                      <p className="text-[11px] text-amber-600 mt-2">
                        {t('stock:transformations.preview.lot_qty_mismatch', {
                          selected: formatNumber(manualTotal),
                          total: formatNumber(transformationData.quantite)
                        })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {t('transformations.modal_transform.notes_label')}
              </label>
              <textarea 
                className="w-full h-20 rounded-xl border-2 border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none" 
                placeholder={t('transformations.modal_transform.notes_placeholder')}
                value={transformationData.notes}
                onChange={e => setTransformationData({...transformationData, notes: e.target.value})}
              ></textarea>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button 
                type="button" 
                className="h-10 px-6 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50" 
                onClick={() => setIsTransformerModalOpen(false)} 
                disabled={submitting}
              >
                {t('transformations.modal_relation.cancel')}
              </button>
              <button 
                type="submit" 
                className="inline-flex items-center gap-2 h-10 px-8 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50"
                disabled={submitting || (preview?.use_lot_management && manualTotal !== transformationData.quantite)}
              >
                {submitting ? (
                  <span className="size-4 border-2 border-purple-300 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {t('transformations.modal_transform.confirm_btn')}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </PremiumModal>

    </div>
  );
};

export default Transformations;
