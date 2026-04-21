import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, History, Check, ShieldAlert, BadgeInfo, Search, Plus, ShoppingBag, Download, Filter } from 'lucide-react';
import axios from '../../config/axios';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import SkeletonTable from '../ui/SkeletonTable';

export default function Ruptures() {
  const { t } = useTranslation(['stock', 'common']);
  const [activeTab, setActiveTab] = useState<'pharmacie' | 'fournisseur' | 'stats'>('pharmacie');

  // Pharmacie State
  const [pharmacieData, setPharmacieData] = useState<any[]>([]);
  const [pharmacieLoading, setPharmacieLoading] = useState(false);
  const [pharmaciePage, setPharmaciePage] = useState(1);
  const [pharmacieTotalPages, setPharmacieTotalPages] = useState(1);
  
  // Filters for Pharmacie
  const [rayons, setRayons] = useState<any[]>([]);
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [selectedRayon, setSelectedRayon] = useState<string>('');
  const [selectedFournisseur, setSelectedFournisseur] = useState<string>('');

  // Fournisseur State
  const [fournisseurData, setFournisseurData] = useState<any[]>([]);
  const [fournisseurLoading, setFournisseurLoading] = useState(false);
  
  // Stats State
  const [statsData, setStatsData] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsDays, setStatsDays] = useState<string>('30');

  // Search Products for Supplier Shortage
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Selection State
  const [selectedPharmacyIds, setSelectedPharmacyIds] = useState<Set<number>>(new Set());
  const [selectedProviderIds, setSelectedProviderIds] = useState<Set<number>>(new Set());
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  // Toggle selection
  const toggleSelection = (id: number, type: 'pharmacie' | 'fournisseur') => {
    const set = type === 'pharmacie' ? new Set(selectedPharmacyIds) : new Set(selectedProviderIds);
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    if (type === 'pharmacie') setSelectedPharmacyIds(set);
    else setSelectedProviderIds(set);
  };

  // Select/Deselect All for current page
  const toggleSelectAll = (type: 'pharmacie' | 'fournisseur') => {
    const currentData = type === 'pharmacie' ? pharmacieData : fournisseurData;
    const currentSelected = type === 'pharmacie' ? selectedPharmacyIds : selectedProviderIds;
    
    // Check if all visible are already selected
    const allSelected = currentData.length > 0 && currentData.every(item => 
      currentSelected.has(type === 'fournisseur' ? item.produit : item.id)
    );
    
    const newSelected = new Set(currentSelected);
    if (allSelected) {
      // Unselect all visible
      currentData.forEach(item => newSelected.delete(type === 'fournisseur' ? item.produit : item.id));
    } else {
      // Select all visible
      currentData.forEach(item => newSelected.add(type === 'fournisseur' ? item.produit : item.id));
    }
    
    if (type === 'pharmacie') setSelectedPharmacyIds(newSelected);
    else setSelectedProviderIds(newSelected);
  };

  const clearSelection = () => {
    setSelectedPharmacyIds(new Set());
    setSelectedProviderIds(new Set());
  };

  const generateBulkOrders = async (type: 'pharmacie' | 'fournisseur') => {
    const ids = Array.from(type === 'pharmacie' ? selectedPharmacyIds : selectedProviderIds);
    if (ids.length === 0) return;

    setIsBulkAdding(true);
    try {
      const res = await axios.post('/api/commandes/ajouter_produits_bulk/', {
        produit_ids: ids,
        quantity: 1
      });
      toast.success(res.data.message);
      clearSelection();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('common:error_generic'));
    } finally {
      setIsBulkAdding(false);
    }
  };

  // Load Filters Data
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [resRayons, resFournisseurs] = await Promise.all([
          axios.get('/api/rayons/'),
          axios.get('/api/fournisseurs/')
        ]);
        setRayons(resRayons.data.results || resRayons.data || []);
        setFournisseurs(resFournisseurs.data.results || resFournisseurs.data || []);
      } catch (e) {
        console.error("Erreur chargement filtres", e);
      }
    };
    loadFilters();
  }, []);

  const fetchPharmacieRuptures = async (page = 1) => {
    setPharmacieLoading(true);
    try {
      let url = `/api/produits/?stock__lte=0&rotation_moyenne__gt=1&latest_supplier=true&page=${page}`;
      if (selectedRayon) url += `&rayon=${selectedRayon}`;
      if (selectedFournisseur) url += `&fournisseur=${selectedFournisseur}`;
      
      const res = await axios.get(url);
      setPharmacieData(res.data.results || []);
      setPharmacieTotalPages(Math.ceil((res.data.count || 0) / 50));
    } catch (error) {
      toast.error(t('common:error_loading_data', 'Erreur de chargement'));
    } finally {
      setPharmacieLoading(false);
    }
  };

  const fetchFournisseurRuptures = async () => {
    setFournisseurLoading(true);
    try {
      const res = await axios.get(`/api/ruptures-fournisseurs/?est_resolu=false`);
      setFournisseurData(res.data.results || res.data || []);
    } catch (error) {
      toast.error(t('common:error_loading_data', 'Erreur de chargement'));
    } finally {
      setFournisseurLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const url = statsDays === 'all' 
        ? `/api/ruptures-fournisseurs/statistiques_frequence/`
        : `/api/ruptures-fournisseurs/statistiques_frequence/?days=${statsDays}`;
      const res = await axios.get(url);
      setStatsData(res.data || []);
    } catch (error) {
      toast.error(t('common:error_loading_data', 'Erreur de chargement'));
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'pharmacie') fetchPharmacieRuptures(pharmaciePage);
    if (activeTab === 'fournisseur') fetchFournisseurRuptures();
    if (activeTab === 'stats') fetchStats();
  }, [activeTab, pharmaciePage, selectedRayon, selectedFournisseur, statsDays]);

  // Product Search for declaration
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }
    const search = async () => {
      setIsSearching(true);
      try {
        const res = await axios.get(`/api/produits/?search=${searchQuery}`);
        setSearchResults(res.data.results || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    };
    const timeoutId = setTimeout(search, 300); // 300ms for better responsiveness
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const declarerRuptureFournisseur = async (produitId: number) => {
    try {
      await axios.post('/api/ruptures-fournisseurs/', {
        produit: produitId,
        est_resolu: false
      });
      toast.success(t('ruptures.fournisseur.declare_success', 'Signalé avec succès'));
      setSearchQuery('');
      if (activeTab === 'fournisseur') fetchFournisseurRuptures();
      if (activeTab === 'pharmacie') fetchPharmacieRuptures(pharmaciePage);
    } catch (error: any) {
        if (error.response?.data?.non_field_errors) {
             toast.error(error.response.data.non_field_errors[0]);
        } else {
             toast.error(t('ruptures.fournisseur.declare_error', 'Erreur de signalement'));
        }
    }
  };

  const ajouterACommande = async (produitId: number) => {
    try {
      const res = await axios.post('/api/commandes/ajouter_produit_auto/', {
        produit_id: produitId,
        quantity: 1
      });
      toast.success(res.data.message || t('ruptures.pharmacie.added_to_order_success', 'Ajouté à la commande'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('ruptures.pharmacie.added_to_order_error', 'Erreur d\'ajout à la commande'));
    }
  };

  const exportStats = async () => {
    try {
      const url = statsDays === 'all' 
        ? `/api/ruptures-fournisseurs/export_frequence_csv/`
        : `/api/ruptures-fournisseurs/export_frequence_csv/?days=${statsDays}`;
      
      const response = await axios.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `frequence_ruptures_${statsDays}j.csv`;
      link.click();
      toast.success(t('common:export_success', 'Export réussi'));
    } catch (error) {
      toast.error(t('common:export_error', 'Erreur lors de l\'export'));
    }
  };

  const marquerResolu = async (id: number) => {
    try {
      await axios.post(`/api/ruptures-fournisseurs/${id}/resoudre/`);
      toast.success(t('ruptures.fournisseur.resolve_success', 'Résolu avec succès'));
      fetchFournisseurRuptures();
    } catch (error) {
      toast.error(t('ruptures.fournisseur.resolve_error', 'Erreur lors de la résolution'));
    }
  };

  return (
    <div className="p-2 md:p-4 max-w-full mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-base-content tracking-tighter mb-1 uppercase italic">{t('ruptures.title', 'Gestion des Ruptures')}</h1>
          <p className="text-sm text-base-content/60 font-medium">{t('ruptures.subtitle', 'Suivi des manques en pharmacie et chez les grossistes')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="tabs tabs-boxed bg-base-100 p-1 shadow-sm font-bold border border-base-200">
          <a 
            className={`tab px-6 transition-all ${activeTab === 'pharmacie' ? 'tab-active bg-primary text-white' : ''}`}
            onClick={() => setActiveTab('pharmacie')}
          >
            <Package className="w-4 h-4 mr-2" />
            {t('ruptures.tabs.pharmacie', 'Ruptures Pharmacie')}
          </a>
          <a 
            className={`tab px-6 transition-all ${activeTab === 'fournisseur' ? 'tab-active bg-red-500 text-white' : ''}`}
            onClick={() => setActiveTab('fournisseur')}
          >
            <ShieldAlert className="w-4 h-4 mr-2" />
            {t('ruptures.tabs.fournisseur', 'Ruptures Grossistes')}
          </a>
          <a 
            className={`tab px-6 transition-all ${activeTab === 'stats' ? 'tab-active bg-neutral text-white' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <History className="w-4 h-4 mr-2" />
            {t('ruptures.tabs.stats', 'Analyses & Stats')}
          </a>
        </div>
      </div>

      {activeTab === 'pharmacie' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card bg-base-100 shadow-sm border border-base-200 p-4 flex flex-row items-center gap-4">
              <div className="p-3 bg-primary/10 text-primary rounded-xl">
                 <Filter className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase opacity-50 mb-1">{t('ruptures.pharmacie.filters.rayon', 'Filtrer par Rayon')}</p>
                <select 
                  className="select select-ghost select-xs w-full font-bold focus:outline-none p-0 h-auto"
                  value={selectedRayon}
                  onChange={(e) => { setSelectedRayon(e.target.value); setPharmaciePage(1); }}
                >
                  <option value="">{t('common:all', 'Tous les rayons')}</option>
                  {rayons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            <div className="card bg-base-100 shadow-sm border border-base-200 p-4 flex flex-row items-center gap-4">
              <div className="p-3 bg-secondary/10 text-secondary rounded-xl">
                 <ShoppingBag className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase opacity-50 mb-1">{t('ruptures.pharmacie.filters.fournisseur', 'Filtrer par Fournisseur')}</p>
                <select 
                  className="select select-ghost select-xs w-full font-bold focus:outline-none p-0 h-auto"
                  value={selectedFournisseur}
                  onChange={(e) => { setSelectedFournisseur(e.target.value); setPharmaciePage(1); }}
                >
                  <option value="">{t('common:all', 'Tous les fournisseurs')}</option>
                  {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-sm border border-base-200 overflow-hidden">
            <div className="card-body p-0">
              <div className="flex items-center gap-2 p-4 text-emerald-700 bg-emerald-50 border-b border-emerald-100">
                <BadgeInfo className="w-5 h-5 shrink-0" />
                <p className="text-xs font-semibold" dangerouslySetInnerHTML={{ __html: t('ruptures.pharmacie.info', 'Affichage des produits à forte rotation (en rupture de stock)') }}></p>
              </div>
              
              <div className="overflow-x-auto">
                {pharmacieLoading ? (
                  <div className="p-4"><SkeletonTable rows={10} columns={9} /></div>
                ) : (
                  <table className="table table-sm w-full">
                    <thead>
                      <tr className="bg-base-200">
                        <th className="w-10">
                          <input 
                            type="checkbox" 
                            className="checkbox checkbox-primary checkbox-sm mt-1" 
                            checked={pharmacieData.length > 0 && pharmacieData.every(p => selectedPharmacyIds.has(p.id))}
                            onChange={() => toggleSelectAll('pharmacie')}
                          />
                        </th>
                        <th className="whitespace-nowrap">{t('ruptures.pharmacie.columns.cip', 'CIP')}</th>
                        <th className="whitespace-nowrap">{t('ruptures.pharmacie.columns.produit', 'Produit')}</th>
                        <th className="whitespace-nowrap">{t('ruptures.pharmacie.columns.rayon', 'Rayon')}</th>
                        <th className="text-center whitespace-nowrap">{t('ruptures.pharmacie.columns.rotation', 'Rotation')}</th>
                        <th className="whitespace-nowrap">{t('ruptures.pharmacie.columns.fournisseur', 'Fournisseur')}</th>
                        <th className="whitespace-nowrap">{t('ruptures.pharmacie.columns.dernier_achat', 'Dernier Achat')}</th>
                        <th className="whitespace-nowrap">{t('ruptures.pharmacie.columns.prix_achat', 'Prix Achat')}</th>
                        <th className="text-center">{t('common:actions_title', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pharmacieData.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-12 text-base-content/50 font-medium italic">{t('ruptures.pharmacie.empty', 'Aucune rupture critique détectée')}</td></tr>
                      ) : (
                        pharmacieData.map((p) => {
                          const isHighRotation = Number(p.rotation_moyenne) > 5;
                          return (
                            <tr key={p.id} className={`hover:bg-base-50 transition-colors border-b border-base-200/50 ${isHighRotation ? 'bg-red-50/40' : ''}`}>
                              <td>
                                <input 
                                  type="checkbox" 
                                  className="checkbox checkbox-primary checkbox-sm" 
                                  checked={selectedPharmacyIds.has(p.id)}
                                  onChange={() => toggleSelection(p.id, 'pharmacie')}
                                />
                              </td>
                              <td className="font-mono text-xs whitespace-nowrap opacity-70">{p.cip1 || '-'}</td>
                              <td className="font-black whitespace-nowrap">
                                {p.name}
                                {isHighRotation && <span className="ml-2 badge badge-error badge-xs font-bold pulse text-[8px]">URGENT</span>}
                              </td>
                              <td className="text-sm whitespace-nowrap font-medium">{p.rayon_name || '-'}</td>
                              <td className="text-center whitespace-nowrap">
                                <span className={`badge ${isHighRotation ? 'badge-error' : 'badge-ghost'} gap-1 font-bold whitespace-nowrap text-xs`}>
                                  {Number(p.rotation_moyenne).toFixed(1)} {t('ruptures.pharmacie.per_month', '/ mois')}
                                </span>
                              </td>
                              <td className="text-sm whitespace-nowrap font-medium text-base-content/70">{p.fournisseur_name || p.latest_fournisseur_name || '-'}</td>
                              <td className="text-xs text-base-content/60 whitespace-nowrap font-bold">
                                {p.dernier_achat ? new Date(p.dernier_achat).toLocaleDateString('fr-FR') : '-'}
                              </td>
                              <td className="font-mono text-xs whitespace-nowrap font-bold">{formatCurrency(p.cost_price)}</td>
                              <td className="text-center">
                                <div className="flex gap-1 justify-center">
                                  <button 
                                    onClick={() => declarerRuptureFournisseur(p.id)}
                                    className="btn btn-square btn-xs btn-error bg-red-500 border-none shadow-sm hover:scale-110" 
                                    title={t('ruptures.actions.signal_shortage', 'Signaler en rupture grossiste')}
                                  >
                                    <ShieldAlert className="w-3.5 h-3.5 text-white" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
              
              {pharmacieTotalPages > 1 && (
                  <div className="flex justify-center p-6 bg-base-50 border-t border-base-200">
                      <div className="join border border-base-200 shadow-sm">
                          <button 
                              className="join-item btn btn-sm bg-base-100 hover:bg-base-200" 
                              disabled={pharmaciePage === 1}
                              onClick={() => setPharmaciePage(p => p - 1)}
                          >
                              «
                          </button>
                          <button className="join-item btn btn-sm bg-base-100 no-animation">
                              Page {pharmaciePage} / {pharmacieTotalPages}
                          </button>
                          <button 
                              className="join-item btn btn-sm bg-base-100 hover:bg-base-200" 
                              disabled={pharmaciePage === pharmacieTotalPages}
                              onClick={() => setPharmaciePage(p => p + 1)}
                          >
                              »
                          </button>
                      </div>
                  </div>
              )}
            </div>
          </div>

          {selectedPharmacyIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="alert bg-neutral text-neutral-content shadow-2xl border-none pr-2 py-2 flex items-center gap-4">
                    <div className="flex items-center gap-3 px-2">
                        <div className="badge badge-primary font-black px-3 py-3">
                            {selectedPharmacyIds.size}
                        </div>
                        <span className="font-bold italic text-sm uppercase tracking-tight">
                            {t('common:selection_count', { count: selectedPharmacyIds.size })}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            className="btn btn-sm btn-ghost hover:bg-white/10 font-bold"
                            onClick={() => setSelectedPharmacyIds(new Set())}
                        >
                            {t('common:cancel', 'Annuler')}
                        </button>
                        <button 
                            className={`btn btn-sm btn-primary font-black italic gap-2 shadow-lg ${isBulkAdding ? 'loading' : ''}`}
                            onClick={() => generateBulkOrders('pharmacie')}
                            disabled={isBulkAdding}
                        >
                            <ShoppingBag className="w-4 h-4" />
                            {t('ruptures.actions.add_to_order', 'Ajouter aux commandes')}
                        </button>
                    </div>
                </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'fournisseur' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
                <div className="card bg-base-100 shadow-sm border border-base-200">
                    <div className="card-body p-6">
                        <h2 className="text-xl font-black mb-4 uppercase italic tracking-tighter">{t('ruptures.fournisseur.signaler', 'Signaler un Manque')}</h2>
                        <div className="form-control relative">
                            <div className="relative">
                                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                                <input 
                                    type="text" 
                                    placeholder={t('ruptures.fournisseur.search_placeholder', 'Rechercher un produit...')} 
                                    className="input input-bordered w-full pl-10 bg-base-200/50 focus:bg-base-100 transition-colors font-bold"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            {searchQuery.length > 2 && (
                                <ul className="menu bg-base-100 rounded-box border border-base-200 shadow-xl mt-2 max-h-60 overflow-y-auto absolute w-full top-full z-10 p-0">
                                    {isSearching ? (
                                        <li className="p-4 text-center disabled"><span className="loading loading-spinner mx-auto text-primary"></span></li>
                                    ) : searchResults.length === 0 ? (
                                        <li className="p-4 text-center text-sm disabled font-medium opacity-50">{t('ruptures.fournisseur.no_results', 'Aucun produit trouvé')}</li>
                                    ) : (
                                        searchResults.map(p => (
                                            <li key={p.id} className="border-b border-base-100 last:border-b-0">
                                                <a onClick={() => declarerRuptureFournisseur(p.id)} className="flex items-center justify-between py-4 px-4 hover:bg-base-200">
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-sm">{p.name}</span>
                                                        <span className="text-[10px] font-bold opacity-50 uppercase tracking-widest">{t('ruptures.fournisseur.stock', 'Stock')}: {p.stock} | {p.fournisseur_name || 'N/A'}</span>
                                                    </div>
                                                    <Plus className="w-5 h-5 text-primary" />
                                                </a>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-2">
                <div className="card bg-base-100 shadow-sm border border-base-200 overflow-hidden">
                    <div className="card-body p-0">
                        <h2 className="p-6 pb-4 text-xl font-black flex items-center justify-between uppercase italic tracking-tighter bg-base-200/30">
                            <span>{t('ruptures.fournisseur.active_list', 'Ruptures actives chez les grossistes')}</span>
                            <span className="badge badge-neutral font-bold">{fournisseurData.length}</span>
                        </h2>
                        
                        <div className="overflow-x-auto">
                        <table className="table w-full relative">
                            <thead>
                            <tr className="bg-base-200">
                                <th className="w-10">
                                    <input 
                                        type="checkbox" 
                                        className="checkbox checkbox-primary checkbox-sm mt-1" 
                                        checked={fournisseurData.length > 0 && fournisseurData.every(r => selectedProviderIds.has(r.produit))}
                                        onChange={() => toggleSelectAll('fournisseur')}
                                    />
                                </th>
                                <th>{t('ruptures.fournisseur.columns.produit', 'Produit')}</th>
                                <th>{t('ruptures.fournisseur.columns.fournisseur', 'Fournisseur')}</th>
                                <th>{t('ruptures.fournisseur.columns.date', 'Signalé le')}</th>
                                <th className="text-right">{t('common:actions_title', 'Actions')}</th>
                            </tr>
                            </thead>
                            <tbody>
                            {fournisseurLoading ? (
                                <tr><td colSpan={5} className="p-4"><SkeletonTable rows={5} columns={5} /></td></tr>
                            ) : fournisseurData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-20 text-base-content/30 italic">
                                        <ShieldAlert className="w-16 h-16 mx-auto mb-4 opacity-10" />
                                        <p className="text-lg font-black uppercase tracking-tighter opacity-20">{t('ruptures.fournisseur.empty', 'Aucune rupture fournisseur active')}</p>
                                    </td>
                                </tr>
                            ) : (
                                fournisseurData.map((r) => (
                                <tr key={r.id} className="hover:bg-red-50/20 transition-colors border-b border-base-200/50">
                                    <td>
                                        <input 
                                            type="checkbox" 
                                            className="checkbox checkbox-primary checkbox-sm" 
                                            checked={selectedProviderIds.has(r.produit)}
                                            onChange={() => toggleSelection(r.produit, 'fournisseur')}
                                        />
                                    </td>
                                    <td className="font-black text-red-600">
                                        {r.produit_nom}
                                        {r.remarques && <p className="text-[10px] font-bold text-base-content/40 mt-1 uppercase tracking-wider">{r.remarques}</p>}
                                    </td>
                                    <td className="text-sm font-bold opacity-70">{r.fournisseur_nom || '-'}</td>
                                    <td className="text-sm font-mono opacity-50">
                                        {new Date(r.date_debut).toLocaleDateString('fr-FR')}
                                    </td>
                                    <td className="text-right">
                                        <div className="flex gap-2 justify-end items-center">
                                            <button 
                                                className="btn btn-sm btn-ghost hover:bg-emerald-100 hover:text-emerald-700 text-base-content/40 hover:opacity-100 transition-all gap-2"
                                                onClick={() => marquerResolu(r.id)}
                                                title={t('ruptures.fournisseur.mark_resolved', 'Marquer comme résolu')}
                                            >
                                                <Check className="w-4 h-4" /> 
                                                <span className="hidden md:inline font-black uppercase italic text-xs">{t('ruptures.fournisseur.resolve', 'Résolu')}</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>

                {selectedProviderIds.size > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="alert bg-neutral text-neutral-content shadow-2xl border-none pr-2 py-2 flex items-center gap-4">
                            <div className="flex items-center gap-3 px-2">
                                <div className="badge badge-primary font-black px-3 py-3">
                                    {selectedProviderIds.size}
                                </div>
                                <span className="font-bold italic text-sm uppercase tracking-tight">
                                    {t('common:selection_count', { count: selectedProviderIds.size })}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    className="btn btn-sm btn-ghost hover:bg-white/10 font-bold"
                                    onClick={() => setSelectedProviderIds(new Set())}
                                >
                                    {t('common:cancel', 'Annuler')}
                                </button>
                                <button 
                                    className={`btn btn-sm btn-primary font-black italic gap-2 shadow-lg ${isBulkAdding ? 'loading' : ''}`}
                                    onClick={() => generateBulkOrders('fournisseur')}
                                    disabled={isBulkAdding}
                                >
                                    <ShoppingBag className="w-4 h-4" />
                                    {t('ruptures.actions.add_to_order', 'Ajouter aux commandes')}
                                </button>
                            </div>
                        </div>
                    </div>
                 )}
            </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-4">
           <div className="card bg-neutral text-neutral-content p-6 shadow-xl border-none overflow-hidden relative">
              <div className="absolute right-0 top-0 p-8 opacity-10 pointer-events-none">
                 <AlertTriangle className="w-32 h-32" />
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div>
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-2">
                      <AlertTriangle className="w-6 h-6 text-amber-400" />
                      {t('ruptures.stats.title', 'Analyses de Fréquence')}
                  </h2>
                  <p className="opacity-70 text-sm font-medium mt-1">{t('ruptures.stats.subtitle', 'Top des produits les plus souvent absents')}</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="join border border-neutral-content/20 shadow-lg">
                        <select 
                          className="select select-sm join-item bg-neutral text-neutral-content font-black italic focus:outline-none border-none"
                          value={statsDays}
                          onChange={(e) => setStatsDays(e.target.value)}
                        >
                          <option value="30">30 derniers jours</option>
                          <option value="90">3 derniers mois</option>
                          <option value="180">6 derniers mois</option>
                          <option value="365">12 derniers mois</option>
                          <option value="all">Depuis le début</option>
                        </select>
                        <button 
                          onClick={exportStats}
                          className="btn btn-sm join-item bg-neutral-content text-neutral border-none hover:bg-white gap-2"
                        >
                          <Download className="w-4 h-4" />
                          <span className="font-black italic text-xs">EXPORTER CSV</span>
                        </button>
                    </div>
                </div>
              </div>
           </div>

           <div className="card bg-base-100 shadow-sm border border-base-200 max-w-4xl overflow-hidden">
            <div className="card-body p-0">
              <div className="overflow-x-auto">
                {statsLoading ? (
                  <div className="p-4"><SkeletonTable rows={10} columns={3} /></div>
                ) : (
                  <table className="table w-full">
                    <thead>
                      <tr className="bg-base-200">
                        <th className="w-20 text-center font-black">{t('ruptures.stats.columns.rang', 'RANG')}</th>
                        <th className="font-black">{t('ruptures.stats.columns.produit', 'PRODUIT')}</th>
                        <th className="text-center font-black">{t('ruptures.stats.columns.frequence', 'FRÉQUENCE')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsData.length === 0 ? (
                        <tr><td colSpan={3} className="text-center py-20 text-base-content/40 italic font-medium">{t('ruptures.stats.empty', 'Pas de données statistiques pour cette période')}</td></tr>
                      ) : (
                        statsData.map((stat, index) => (
                          <tr key={stat.produit_id} className="hover:bg-base-50 transition-colors border-b border-base-100 last:border-b-0 group">
                            <td className="text-center">
                               <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto text-sm font-black ${index < 3 ? 'bg-amber-400 text-amber-900 shadow-md' : 'bg-base-200 opacity-50'}`}>
                                  {index + 1}
                               </div>
                            </td>
                            <td className="font-black group-hover:text-primary transition-colors text-base py-4">
                              {stat.produit_name}
                            </td>
                            <td className="text-center">
                                <span className="badge badge-lg badge-neutral font-black italic shadow-inner px-4 text-xs">
                                    {stat.total_ruptures} {t('ruptures.stats.times', 'RUPTURES')}
                                </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
