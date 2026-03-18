import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../hooks/useConfirm';
import { useProductSearch } from '../hooks/useProductSearch';
import { useSearchNavigation } from '../hooks/useSearchNavigation';
import PremiumModal from './common/PremiumModal';
import type { ProduitModel } from '../types';
import { 
  ChevronRight, Trash2, Plus 
} from 'lucide-react';
import { normalizeNumberInput, formatNumber } from '../utils/formatters';

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
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-2">
          {icon} {label}
        </label>
        <div className="flex items-center gap-3 bg-gradient-to-r from-primary/5 to-primary/10 border-2 border-primary/30 rounded-xl px-4 py-3 transition-all">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-black text-sm">
            {selected.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-gray-800 truncate">{selected.name}</div>
            <div className="text-[11px] text-gray-500 flex gap-3">
              <span>{t('common:cip')}: {selected.cip1 || t('common:not_available')}</span>
              <span>{t('common:stock')}: <b className={selected.stock <= 0 ? 'text-error' : 'text-success'}>{formatNumber(selected.stock)}</b></span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="btn btn-ghost btn-circle btn-sm text-gray-400 hover:text-error hover:bg-error/10 transition-colors"
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
      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-2">
        {icon} {label}
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          className="input input-bordered w-full pl-10 h-12 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all rounded-xl"
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
            <span className="loading loading-spinner loading-sm text-primary"></span>
          </div>
        )}

        {/* Dropdown résultats */}
        {showResults && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
            {produits.length === 0 && !loading && (
              <div className="p-4 text-center text-gray-400 italic text-sm">
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
                  className={`px-4 py-3 cursor-pointer border-b last:border-0 flex items-center gap-3 transition-colors group ${itemProps.className}`}
                  style={itemProps.style}
                  onClick={() => handleSelect(p)}
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-primary/10 flex items-center justify-center text-gray-500 group-hover:text-primary font-bold text-xs transition-colors"
                    style={itemProps.style.backgroundColor ? { backgroundColor: 'rgba(255,255,255,0.2)' } : {}}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{p.name}</div>
                    <div className="text-[10px] flex gap-3" style={itemProps.style.color ? { color: 'rgba(255,255,255,0.7)' } : { color: '#9ca3af' }}>
                      <span>{t('common:cip')}: {p.cip1 || t('common:not_available')}</span>
                      <span>{t('common:stock')}: <b>{formatNumber(p.stock)}</b></span>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-30 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

  const [submitting, setSubmitting] = useState(false);

  // URL de base API dynamique
  const apiBaseUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    return baseUrl ? `${String(baseUrl).replace(/\/$/, '')}/api` : '/api'
  }, [])

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [relationsRes, historiqueRes] = await Promise.all([
        axios.get(`${apiBaseUrl}/relations-transformation/`),
        axios.get(`${apiBaseUrl}/historique-transformation/`)
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
      await axios.post(`${apiBaseUrl}/relations-transformation/`, {
        produit_source: selectedSource.id,
        produit_destination: selectedDestination.id,
        ratio: normalizeNumberInput(ratioValue)
      });
      toast.success(t('transformations.messages.create_success'));
      setIsRelationModalOpen(false);
      resetRelationForm();
      fetchData();
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.response?.data?.non_field_errors?.[0] 
        || error.response?.data?.error 
        || error.response?.data?.detail
        || t('transformations.messages.create_error');
      
      if (typeof error.response?.data === 'object') {
         const firstError = Object.values(error.response.data)[0];
         if (Array.isArray(firstError)) {
             toast.error(`${Object.keys(error.response.data)[0]}: ${firstError[0]}`);
             return;
         }
      }
      
      toast.error(errorMsg);
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
      await axios.delete(`${apiBaseUrl}/relations-transformation/${id}/`);
      toast.success(t('transformations.messages.delete_success'));
      fetchData();
    } catch (error) {
      toast.error(t('transformations.messages.delete_error'));
    }
  };

  const openTransformerModal = (relation: RelationTransformation) => {
    setSubmitting(false);
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
    
    setSubmitting(true);
    try {
      const res = await axios.post(`${apiBaseUrl}/relations-transformation/${transformationData.relation.id}/transformer/`, {
        quantite: transformationData.quantite,
        notes: transformationData.notes
      });
      
      if (res.data.success) {
        toast.success(res.data.message || t('transformations.messages.transform_success'));
        setIsTransformerModalOpen(false);
        fetchData(); 
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('transformations.messages.transform_error'));
      setSubmitting(false);
    }
  };

  // Calculs dynamiques pour le modal transformer
  const quantiteDestinationCalculee = transformationData.relation 
    ? Math.floor(transformationData.quantite * transformationData.relation.ratio) 
    : 0;

  return (
    <div className="h-full flex flex-col bg-base-200 overflow-hidden font-sans">
      {/* Header Section */}
      <div className="bg-base-100 border-b border-base-200 sticky top-0 z-30 opacity-100 flex flex-col shrink-0">
        <div className="px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-base-content tracking-tight">{t('transformations.title')}</h1>
              <p className="text-[11px] font-medium text-base-content/40 uppercase tracking-widest mt-0.5">{t('transformations.subtitle')}</p>
            </div>
          </div>
          <button 
            onClick={() => { resetRelationForm(); setIsRelationModalOpen(true); }}
            className="btn btn-primary btn-sm h-10 px-5 rounded-xl shadow-lg shadow-primary/20 gap-2 font-bold"
          >
            <Plus size={18} />
            {t('transformations.new_relation_btn')}
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2 bg-base-100/50 flex gap-1 border-t border-base-200/50">
          <button 
            className={`btn btn-xs h-8 rounded-lg px-4 transition-all duration-200 font-bold ${activeTab === 'relations' ? 'btn-primary shadow-md' : 'btn-ghost opacity-60'}`}
            onClick={() => setActiveTab('relations')}
          >
            {t('transformations.tabs.configured_relations')}
          </button>
          <button 
            className={`btn btn-xs h-8 rounded-lg px-4 transition-all duration-200 font-bold ${activeTab === 'historique' ? 'btn-primary shadow-md' : 'btn-ghost opacity-60'}`}
            onClick={() => setActiveTab('historique')}
          >
            {t('transformations.tabs.history')}
          </button>
        </div>
      </div>

      {/* Main Content Section */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <span className="loading loading-spinner loading-lg text-primary opacity-20"></span>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-30">{t('common:loading')}</p>
          </div>
        ) : (
          <div className="h-full">
            {activeTab === 'relations' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                {relations.map(relation => (
                  <div key={relation.id} className="group relative bg-base-100 border border-base-200 rounded-2xl p-5 hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-primary/5 flex flex-col">
                    <div className="flex items-center justify-between mb-5">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-black shadow-inner">
                             {relation.produit_source_nom.charAt(0).toUpperCase()}
                          </div>
                          <div className="max-w-[120px]">
                             <div className="text-[9px] font-black opacity-30 uppercase tracking-widest mb-0.5">{t('common:source')}</div>
                             <div className="font-bold text-xs truncate" title={relation.produit_source_nom}>{relation.produit_source_nom}</div>
                          </div>
                       </div>
                       <div className="text-primary/20 group-hover:text-primary transition-colors flex flex-col items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                       </div>
                        <div className="flex items-center gap-3 text-right">
                          <div className="max-w-[120px]">
                             <div className="text-[9px] font-black opacity-30 uppercase tracking-widest mb-0.5">{t('stock:transformations.labels.dest')}</div>
                             <div className="font-bold text-xs truncate text-success" title={relation.produit_destination_nom}>{relation.produit_destination_nom}</div>
                          </div>
                        </div>
                    </div>

                    <div className="bg-base-200/50 rounded-xl p-3 flex justify-between items-center mb-6 border border-base-300/30">
                       <div className="text-[10px] font-bold opacity-40 uppercase tracking-wider">{t('transformations.modal_relation.ratio_label')}</div>
                       <div className="badge border-none bg-primary text-white font-mono font-black text-[11px] h-6">1 : {formatNumber(relation.ratio)}</div>
                    </div>

                    <div className="mt-auto flex gap-2 pt-2 border-t border-base-200/50">
                        <button 
                          className="btn btn-primary btn-sm flex-1 rounded-lg h-9 font-bold"
                          onClick={() => openTransformerModal(relation)}
                        >
                          {t('stock:transformations.labels.transformer')}
                        </button>
                       <button 
                         className="btn btn-ghost btn-sm btn-square text-error hover:bg-error/10 rounded-lg h-9"
                         onClick={() => handleDeleteRelation(relation.id)}
                       >
                         <Trash2 size={16} />
                       </button>
                    </div>
                  </div>
                ))}
                {relations.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-20 italic">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    <p className="font-bold uppercase tracking-widest text-xs">{t('stock:transformations.labels.no_relations')}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'historique' && (
              <div className="bg-base-100 rounded-2xl border border-base-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto whitespace-nowrap">
                  <table className="table table-sm w-full border-separate border-spacing-0">
                    <thead className="bg-base-200 sticky top-0 z-10 opacity-100 border-b border-base-300">
                      <tr className="text-base-content/50 uppercase text-[10px] tracking-widest font-black h-12">
                        <th className="pl-6 bg-transparent">{t('transformations.table_history.date')}</th>
                        <th className="bg-transparent">{t('transformations.table_history.user')}</th>
                        <th className="bg-transparent">{t('transformations.table_history.transformation')}</th>
                        <th className="bg-transparent">{t('transformations.table_history.quantities')}</th>
                        <th className="bg-transparent pr-6">{t('transformations.table_history.notes')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-200">
                      {historique.map(hist => (
                        <tr key={hist.id} className="hover:bg-base-200/30 transition-colors group">
                          <td className="pl-6 py-4">
                             <div className="font-bold text-xs">{new Date(hist.date_transformation).toLocaleDateString()}</div>
                             <div className="text-[10px] opacity-40 font-mono uppercase tracking-tighter">{new Date(hist.date_transformation).toLocaleTimeString()}</div>
                          </td>
                          <td className="font-black text-xs text-primary/70">{hist.user_nom}</td>
                          <td className="max-w-xs">
                             <div className="flex items-center gap-2 text-xs font-bold truncate">
                                <span className="opacity-40">{hist.produit_source_nom}</span>
                                <ChevronRight size={12} className="opacity-20" />
                                <span className="text-success">{hist.produit_destination_nom}</span>
                             </div>
                          </td>
                          <td>
                             <div className="flex items-center gap-3">
                                <div className="bg-error/10 text-error px-2 py-0.5 rounded text-[10px] font-black font-mono">-{formatNumber(hist.quantite_source)}</div>
                                <ChevronRight size={12} className="opacity-10" />
                                <div className="bg-success/10 text-success px-2 py-0.5 rounded text-[10px] font-black font-mono">+{formatNumber(hist.quantite_destination)}</div>
                             </div>
                          </td>
                          <td className="pr-6 italic text-base-content/40 text-[11px] max-w-sm truncate group-hover:whitespace-normal group-hover:overflow-visible transition-all">
                             {hist.notes || '-'}
                          </td>
                        </tr>
                      ))}
                      {historique.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-20 opacity-20 italic font-bold uppercase tracking-widest text-xs">{t('stock:transformations.table_history.empty')}</td>
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
              <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              className="input input-bordered w-full h-12 rounded-xl text-lg font-black text-center focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all border-2" 
              placeholder="Ex: 20"
              value={ratioValue}
              onChange={e => setRatioValue(e.target.value)}
              required
            />
            <p className="text-[11px] font-medium text-base-content/40 mt-1.5 text-center px-4">
              {t('transformations.modal_relation.ratio_help')}
            </p>
          </div>

          {/* Preview */}
          {selectedSource && selectedDestination && ratioValue && (
            <div className="bg-gradient-to-br from-success/5 to-primary/5 border border-success/20 rounded-xl p-4 shadow-inner">
              <div className="flex items-center justify-between text-sm">
                  <div className="text-center flex-1">
                    <div className="font-bold text-base-content truncate text-xs">{selectedSource.name}</div>
                    <div className="text-[10px] font-black opacity-30 mt-0.5">× 1 {t('stock:transformations.labels.unit')}</div>
                  </div>
                  <div className="px-4 text-primary/40 flex flex-col items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <span className="text-[10px] font-black mt-1 bg-primary/10 px-2 py-0.5 rounded-full">× {ratioValue}</span>
                  </div>
                  <div className="text-center flex-1">
                    <div className="font-bold text-success truncate text-xs">{selectedDestination.name}</div>
                    <div className="text-[10px] font-black text-success/40 mt-0.5">× {Math.floor(normalizeNumberInput(ratioValue))} {t('stock:transformations.labels.units')}</div>
                  </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-base-200">
            <button type="button" className="btn btn-ghost px-6 rounded-xl font-bold" onClick={() => setIsRelationModalOpen(false)}>
              {t('transformations.modal_relation.cancel')}
            </button>
            <button 
              type="submit" 
              className="btn btn-primary px-8 rounded-xl shadow-lg shadow-primary/20 font-bold"
              disabled={!selectedSource || !selectedDestination || !ratioValue}
            >
              <Plus size={18} />
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
              <div className="flex-1 bg-gradient-to-b from-error/5 to-transparent border border-error/20 rounded-2xl p-4 text-center">
                <div className="text-[9px] font-black uppercase tracking-widest text-error/40 mb-3 flex items-center justify-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" />
                  </svg>
                  {t('common:source')}
                </div>
                <div className="font-bold text-base-content text-xs mb-4 h-8 flex items-center justify-center line-clamp-2" title={transformationData.relation.produit_source_nom}>{transformationData.relation.produit_source_nom}</div>
                <input 
                  type="number" 
                  className="input input-bordered w-full text-center text-2xl font-black h-14 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all border-2"
                  min="1"
                  value={transformationData.quantite}
                  onChange={e => setTransformationData({...transformationData, quantite: normalizeNumberInput(e.target.value)})}
                  required
                  autoFocus
                />
                <div className="text-[10px] uppercase font-black opacity-30 mt-3">{t('transformations.modal_transform.qty_to_transform')}</div>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center justify-center gap-2 px-1 pt-6">
                <div className="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-base-content/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
                <span className="text-[9px] font-black text-primary/60 bg-primary/5 px-2.5 py-1 rounded-full border border-primary/10">× {transformationData.relation.ratio}</span>
              </div>

              {/* Destination */}
              <div className="flex-1 bg-gradient-to-b from-success/5 to-transparent border border-success/20 rounded-2xl p-4 text-center">
                <div className="text-[9px] font-black uppercase tracking-widest text-success/40 mb-3 flex items-center justify-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                  </svg>
                  {t('common:destination')}
                </div>
                <div className="font-bold text-base-content text-xs mb-4 h-8 flex items-center justify-center line-clamp-2" title={transformationData.relation.produit_destination_nom}>{transformationData.relation.produit_destination_nom}</div>
                <div className="w-full h-14 rounded-xl bg-success/10 border-2 border-success/20 flex items-center justify-center font-black text-2xl text-success shadow-inner">
                  {formatNumber(quantiteDestinationCalculee)}
                </div>
                <div className="text-[10px] uppercase font-black text-success/40 mt-3">{t('transformations.modal_transform.qty_obtained')}</div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {t('transformations.modal_transform.notes_label')}
              </label>
              <textarea 
                className="textarea textarea-bordered w-full h-20 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none border-2 p-4 text-sm font-medium" 
                placeholder={t('transformations.modal_transform.notes_placeholder')}
                value={transformationData.notes}
                onChange={e => setTransformationData({...transformationData, notes: e.target.value})}
              ></textarea>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-base-200">
              <button 
                type="button" 
                className="btn btn-ghost px-6 rounded-xl font-bold" 
                onClick={() => setIsTransformerModalOpen(false)} 
                disabled={submitting}
              >
                {t('transformations.modal_relation.cancel')}
              </button>
              <button 
                type="submit" 
                className="btn btn-accent px-8 rounded-xl shadow-lg shadow-accent/20 font-bold"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="loading loading-spinner text-white"></span>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
