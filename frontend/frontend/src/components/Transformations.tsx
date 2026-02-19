import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../hooks/useConfirm';
import { useProductSearch } from '../hooks/useProductSearch';
import { useSearchNavigation } from '../hooks/useSearchNavigation';
import PremiumModal from './common/PremiumModal';
import type { ProduitModel } from '../types';

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
  label, icon, selected, onSelect, onClear, placeholder = 'Rechercher un produit...'
}) => {
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
              <span>CIP: {selected.cip1 || 'N/A'}</span>
              <span>Stock: <b className={selected.stock <= 0 ? 'text-error' : 'text-success'}>{selected.stock}</b></span>
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
          placeholder={placeholder}
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
                Aucun produit trouvé
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
                      <span>CIP: {p.cip1 || 'N/A'}</span>
                      <span>Stock: <b>{p.stock}</b></span>
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
  const { t } = useTranslation();
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
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL 
    ? `${String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')}/api`
    : '/api';

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
        ratio: parseFloat(ratioValue)
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
    <div className="p-6 bg-base-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
          {t('transformations.title')}
        </h1>
        <button 
          onClick={() => { resetRelationForm(); setIsRelationModalOpen(true); }}
          className="btn btn-primary"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          {t('transformations.new_relation_btn')}
        </button>
      </div>

      <div className="tabs tabs-boxed mb-6">
        <a 
          className={`tab ${activeTab === 'relations' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('relations')}
        >
          {t('transformations.tabs.configured_relations')}
        </a>
        <a 
          className={`tab ${activeTab === 'historique' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('historique')}
        >
          {t('transformations.tabs.history')}
        </a>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><span className="loading loading-spinner loading-lg"></span></div>
      ) : (
        <>
          {activeTab === 'relations' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {relations.map(relation => (
                <div key={relation.id} className="card bg-base-200 shadow-xl">
                  <div className="card-body">
                    <h2 className="card-title text-sm">
                      {relation.produit_source_nom}
                      <span className="text-gray-400 mx-2">➔</span>
                      {relation.produit_destination_nom}
                    </h2>
                    <div className="badge badge-secondary badge-outline mb-2">{t('transformations.card.ratio', { ratio: relation.ratio })}</div>
                    <div className="card-actions justify-end mt-4">
                      <button 
                        className="btn btn-sm btn-accent"
                        onClick={() => openTransformerModal(relation)}
                      >
                        {t('transformations.card.transform_btn')}
                      </button>
                      <button 
                        className="btn btn-sm btn-ghost text-error"
                        onClick={() => handleDeleteRelation(relation.id)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {relations.length === 0 && (
                <div className="col-span-full text-center py-10 text-gray-500">
                  Aucune relation de transformation configurée.
                </div>
              )}
            </div>
          )}

          {activeTab === 'historique' && (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>{t('transformations.table_history.date')}</th>
                    <th>{t('transformations.table_history.user')}</th>
                    <th>{t('transformations.table_history.transformation')}</th>
                    <th>{t('transformations.table_history.quantities')}</th>
                    <th>{t('transformations.table_history.notes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {historique.map(hist => (
                    <tr key={hist.id}>
                      <td>{new Date(hist.date_transformation).toLocaleString()}</td>
                      <td>{hist.user_nom}</td>
                      <td>
                        {hist.produit_source_nom} 
                        <span className="text-gray-400 mx-2">➔</span>
                        {hist.produit_destination_nom}
                      </td>
                      <td>
                        <span className="text-error font-bold">-{hist.quantite_source}</span>
                        <span className="mx-2">/</span>
                        <span className="text-success font-bold">+{hist.quantite_destination}</span>
                      </td>
                      <td className="italic text-gray-500">{hist.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ===== Modal Création Relation ===== */}
      <PremiumModal
        isOpen={isRelationModalOpen}
        onClose={() => setIsRelationModalOpen(false)}
        title={t('transformations.modal_relation.title')}
        subtitle="Configurez une nouvelle règle de transformation"
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
            placeholder="Rechercher le produit source..."
          />

          {/* Flèche séparatrice */}
          <div className="flex items-center justify-center py-1">
            <div className="flex items-center gap-2 text-gray-300">
              <div className="h-px w-12 bg-gray-200"></div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-b from-primary/10 to-secondary/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
              <div className="h-px w-12 bg-gray-200"></div>
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
            placeholder="Rechercher le produit destination..."
          />

          {/* Ratio */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
              {t('transformations.modal_relation.ratio_label')}
            </label>
            <input 
              type="number" 
              step="0.01"
              className="input input-bordered w-full h-12 rounded-xl text-lg font-semibold text-center focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
              placeholder="Ex: 20"
              value={ratioValue}
              onChange={e => setRatioValue(e.target.value)}
              required
            />
            <p className="text-[11px] text-gray-400 mt-1.5 text-center">
              {t('transformations.modal_relation.ratio_help')}
            </p>
          </div>

          {/* Preview */}
          {selectedSource && selectedDestination && ratioValue && (
            <div className="bg-gradient-to-r from-success/5 to-info/5 border border-success/20 rounded-xl p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="text-center flex-1">
                  <div className="font-bold text-gray-700 truncate">{selectedSource.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">×1</div>
                </div>
                <div className="px-3 text-gray-400 flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                  <span className="text-[10px] font-mono">×{ratioValue}</span>
                </div>
                <div className="text-center flex-1">
                  <div className="font-bold text-success truncate">{selectedDestination.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">×{Math.floor(parseFloat(ratioValue) || 0)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn btn-ghost px-6 rounded-xl" onClick={() => setIsRelationModalOpen(false)}>
              {t('transformations.modal_relation.cancel')}
            </button>
            <button 
              type="submit" 
              className="btn btn-primary px-8 rounded-xl shadow-lg shadow-primary/20"
              disabled={!selectedSource || !selectedDestination || !ratioValue}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
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
        subtitle="Exécuter une transformation de stock"
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
              <div className="flex-1 bg-gradient-to-b from-error/5 to-transparent border border-error/20 rounded-xl p-4 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-error/60 mb-2 flex items-center justify-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                  </svg>
                  Source
                </div>
                <div className="font-bold text-gray-800 text-sm mb-3 truncate">{transformationData.relation.produit_source_nom}</div>
                <input 
                  type="number" 
                  className="input input-bordered w-full text-center text-2xl font-black h-14 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  min="1"
                  value={transformationData.quantite}
                  onChange={e => setTransformationData({...transformationData, quantite: parseInt(e.target.value) || 0})}
                  required
                  autoFocus
                />
                <div className="text-[10px] text-gray-400 mt-2">{t('transformations.modal_transform.qty_to_transform')}</div>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center justify-center gap-1 px-1 pt-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-error/10 to-success/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">×{transformationData.relation.ratio}</span>
              </div>

              {/* Destination */}
              <div className="flex-1 bg-gradient-to-b from-success/5 to-transparent border border-success/20 rounded-xl p-4 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-success/60 mb-2 flex items-center justify-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Destination
                </div>
                <div className="font-bold text-gray-800 text-sm mb-3 truncate">{transformationData.relation.produit_destination_nom}</div>
                <div className="w-full h-14 rounded-xl bg-success/10 border-2 border-success/20 flex items-center justify-center font-black text-2xl text-success">
                  {quantiteDestinationCalculee}
                </div>
                <div className="text-[10px] text-gray-400 mt-2">{t('transformations.modal_transform.qty_obtained')}</div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {t('transformations.modal_transform.notes_label')}
              </label>
              <textarea 
                className="textarea textarea-bordered w-full h-20 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none" 
                placeholder={t('transformations.modal_transform.notes_placeholder')}
                value={transformationData.notes}
                onChange={e => setTransformationData({...transformationData, notes: e.target.value})}
              ></textarea>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button" 
                className="btn btn-ghost px-6 rounded-xl" 
                onClick={() => setIsTransformerModalOpen(false)} 
                disabled={submitting}
              >
                {t('transformations.modal_relation.cancel')}
              </button>
              <button 
                type="submit" 
                className="btn btn-accent px-8 rounded-xl shadow-lg shadow-accent/20"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="loading loading-spinner text-white"></span>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
