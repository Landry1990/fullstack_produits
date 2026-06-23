import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, History, Check, ShieldAlert, BadgeInfo, Search, Plus, ShoppingBag, Download, Filter } from 'lucide-react';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dateUtils';
import { toast } from 'react-hot-toast';
import { getApiErrorDetail } from '../../utils/errorHandling';
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
      const res = await api.post(
        'commandes/ajouter_produits_bulk/',
        { produit_ids: ids, quantity: 1 },
        { headers: { 'Idempotency-Key': crypto.randomUUID() } }
      );
      toast.success(res.data.message);
      clearSelection();
    } catch (error) {
      toast.error(getApiErrorDetail(error, t('common:error_generic')));
    } finally {
      setIsBulkAdding(false);
    }
  };

  // Load Filters Data
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [resRayons, resFournisseurs] = await Promise.all([
          api.get('rayons/'),
          api.get('fournisseurs/')
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
      let url = `produits/?stock__lte=0&rotation_moyenne__gt=1&latest_supplier=true&page=${page}&page_size=50`;
      if (selectedRayon) url += `&rayon=${selectedRayon}`;
      if (selectedFournisseur) url += `&fournisseur=${selectedFournisseur}`;
      
      const res = await api.get(url);
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
      const res = await api.get('ruptures-fournisseurs/?est_resolu=false');
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
        ? `ruptures-fournisseurs/statistiques_frequence/`
        : `ruptures-fournisseurs/statistiques_frequence/?days=${statsDays}`;
      const res = await api.get(url);
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
        const res = await api.get(`produits/?search=${searchQuery}`);
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
      await api.post('ruptures-fournisseurs/', {
        produit: produitId,
        est_resolu: false
      });
      toast.success(t('ruptures.fournisseur.declare_success', 'Signalé avec succès'));
      setSearchQuery('');
      if (activeTab === 'fournisseur') fetchFournisseurRuptures();
      if (activeTab === 'pharmacie') fetchPharmacieRuptures(pharmaciePage);
    } catch (error) {
        toast.error(getApiErrorDetail(error, t('ruptures.fournisseur.declare_error', 'Erreur de signalement')));
    }
  };

  const ajouterACommande = async (produitId: number) => {
    try {
      const res = await api.post(
        'commandes/ajouter_produit_auto/',
        { produit_id: produitId, quantity: 1 },
        { headers: { 'Idempotency-Key': crypto.randomUUID() } }
      );
      toast.success(res.data.message || t('ruptures.pharmacie.added_to_order_success', 'Ajouté à la commande'));
    } catch (error) {
      toast.error(getApiErrorDetail(error, t('ruptures.pharmacie.added_to_order_error', 'Erreur d\'ajout à la commande')));
    }
  };

  const exportStats = async () => {
    try {
      const url = statsDays === 'all' 
        ? `ruptures-fournisseurs/export_frequence_csv/`
        : `ruptures-fournisseurs/export_frequence_csv/?days=${statsDays}`;
      
      const response = await api.get(url, { responseType: 'blob' });
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
      await api.post(`ruptures-fournisseurs/${id}/resoudre/`);
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
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter mb-1 uppercase italic">{t('ruptures.title', 'Gestion des Ruptures')}</h1>
          <p className="text-sm text-slate-500 font-medium">{t('ruptures.subtitle', 'Suivi des manques en pharmacie et chez les grossistes')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 bg-white p-1 rounded-2xl shadow-sm border border-slate-200">
          <button
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'pharmacie' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => setActiveTab('pharmacie')}
          >
            <Package className="size-4" />
            {t('ruptures.tabs.pharmacie', 'Ruptures Pharmacie')}
          </button>
          <button
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'fournisseur' ? 'bg-red-500 text-white shadow' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => setActiveTab('fournisseur')}
          >
            <ShieldAlert className="size-4" />
            {t('ruptures.tabs.fournisseur', 'Ruptures Grossistes')}
          </button>
          <button
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'stats' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => setActiveTab('stats')}
          >
            <History className="size-4" />
            {t('ruptures.tabs.stats', 'Analyses & Stats')}
          </button>
        </div>
      </div>

      {activeTab === 'pharmacie' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white shadow-sm border border-slate-200 rounded-2xl p-4 flex flex-row items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <Filter className="size-6" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase text-slate-400 mb-1">{t('ruptures.pharmacie.filters.rayon', 'Filtrer par Rayon')}</p>
                <select
                  className="w-full text-sm font-bold text-slate-700 bg-transparent focus:outline-none"
                  value={selectedRayon}
                  onChange={(e) => { setSelectedRayon(e.target.value); setPharmaciePage(1); }}
                >
                  <option value="">{t('common:all', 'Tous les rayons')}</option>
                  {rayons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-white shadow-sm border border-slate-200 rounded-2xl p-4 flex flex-row items-center gap-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <ShoppingBag className="size-6" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase text-slate-400 mb-1">{t('ruptures.pharmacie.filters.fournisseur', 'Filtrer par Fournisseur')}</p>
                <select
                  className="w-full text-sm font-bold text-slate-700 bg-transparent focus:outline-none"
                  value={selectedFournisseur}
                  onChange={(e) => { setSelectedFournisseur(e.target.value); setPharmaciePage(1); }}
                >
                  <option value="">{t('common:all', 'Tous les fournisseurs')}</option>
                  {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
            <div>
              <div className="flex items-center gap-2 p-4 text-emerald-700 bg-emerald-50 border-b border-emerald-100">
                <BadgeInfo className="size-5 shrink-0" />
                <p className="text-xs font-semibold">{t('ruptures.pharmacie.info', 'Affichage des produits à forte rotation (en rupture de stock)')}</p>
              </div>
              
              <div className="overflow-x-auto">
                {pharmacieLoading ? (
                  <div className="p-4"><SkeletonTable rows={10} columns={9} /></div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="w-10 px-4 py-3">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-slate-300 accent-emerald-600"
                            checked={pharmacieData.length > 0 && pharmacieData.every(p => selectedPharmacyIds.has(p.id))}
                            onChange={() => toggleSelectAll('pharmacie')}
                          />
                        </th>
                        <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap py-3 text-left">{t('ruptures.pharmacie.columns.cip', 'CIP')}</th>
                        <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap py-3 text-left">{t('ruptures.pharmacie.columns.produit', 'Produit')}</th>
                        <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap py-3 text-left">{t('ruptures.pharmacie.columns.rayon', 'Rayon')}</th>
                        <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap py-3 text-center">{t('ruptures.pharmacie.columns.rotation', 'Rotation')}</th>
                        <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap py-3 text-left">{t('ruptures.pharmacie.columns.fournisseur', 'Fournisseur')}</th>
                        <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap py-3 text-left">{t('ruptures.pharmacie.columns.dernier_achat', 'Dernier Achat')}</th>
                        <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap py-3 text-left">{t('ruptures.pharmacie.columns.prix_achat', 'Prix Achat')}</th>
                        <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 text-center">{t('common:actions_title', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pharmacieData.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-12 text-slate-400 font-medium italic">{t('ruptures.pharmacie.empty', 'Aucune rupture critique détectée')}</td></tr>
                      ) : (
                        pharmacieData.map((p) => {
                          const isHighRotation = Number(p.rotation_moyenne) > 5;
                          return (
                            <tr key={p.id} className={`hover:bg-slate-50 transition-colors border-b border-slate-100 ${isHighRotation ? 'bg-red-50/40' : ''}`}>
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  className="size-4 rounded border-slate-300 accent-emerald-600"
                                  checked={selectedPharmacyIds.has(p.id)}
                                  onChange={() => toggleSelection(p.id, 'pharmacie')}
                                />
                              </td>
                              <td className="font-mono text-xs whitespace-nowrap text-slate-500 py-3">{p.cip1 || '-'}</td>
                              <td className="font-black whitespace-nowrap py-3">
                                {p.name}
                                {isHighRotation && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-red-500 text-white uppercase">URGENT</span>}
                              </td>
                              <td className="text-sm whitespace-nowrap font-medium text-slate-600 py-3">{p.rayon_name || '-'}</td>
                              <td className="text-center whitespace-nowrap py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                  isHighRotation ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {Number(p.rotation_moyenne).toFixed(1)} {t('ruptures.pharmacie.per_month', '/ mois')}
                                </span>
                              </td>
                              <td className="text-sm whitespace-nowrap font-medium text-slate-500 py-3">{p.fournisseur_name || p.latest_fournisseur_name || '-'}</td>
                              <td className="text-xs text-slate-500 whitespace-nowrap font-bold py-3">{formatDate(p.dernier_achat)}</td>
                              <td className="font-mono text-xs whitespace-nowrap font-bold text-slate-700 py-3">{formatCurrency(p.cost_price)}</td>
                              <td className="text-center py-3">
                                <button
                                  onClick={() => declarerRuptureFournisseur(p.id)}
                                  className="inline-flex items-center justify-center size-7 rounded-lg bg-red-500 text-white hover:bg-red-600 hover:scale-110 transition-all shadow-sm"
                                  title={t('ruptures.actions.signal_shortage', 'Signaler en rupture grossiste')}
                                >
                                  <ShieldAlert className="size-3.5" />
                                </button>
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
                  <div className="flex justify-center p-6 border-t border-slate-100">
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
                          <button
                              className="inline-flex items-center justify-center h-8 px-4 rounded-xl text-sm font-bold text-slate-500 hover:bg-white hover:text-emerald-600 disabled:opacity-30 transition-all"
                              disabled={pharmaciePage === 1}
                              onClick={() => setPharmaciePage(p => p - 1)}
                          >
                              «
                          </button>
                          <span className="px-4 text-sm font-black text-slate-600">
                              Page {pharmaciePage} / {pharmacieTotalPages}
                          </span>
                          <button
                              className="inline-flex items-center justify-center h-8 px-4 rounded-xl text-sm font-bold text-slate-500 hover:bg-white hover:text-emerald-600 disabled:opacity-30 transition-all"
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
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 w-full max-w-md px-4">
                <div className="bg-slate-800 text-white rounded-[24px] shadow-2xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-emerald-500 flex items-center justify-center font-black text-white">
                            {selectedPharmacyIds.size}
                        </div>
                        <span className="font-bold italic text-sm uppercase tracking-tight">
                            {t('common:selection_count', { count: selectedPharmacyIds.size })}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            className="inline-flex items-center h-9 px-4 rounded-xl text-sm font-bold text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                            onClick={() => setSelectedPharmacyIds(new Set())}
                        >
                            {t('common:cancel', 'Annuler')}
                        </button>
                        <button
                            className="inline-flex items-center justify-center h-9 px-4 rounded-xl text-sm font-black gap-2 bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg disabled:opacity-60 transition-colors"
                            onClick={() => generateBulkOrders('pharmacie')}
                            disabled={isBulkAdding}
                        >
                            {isBulkAdding ? <span className="animate-spin rounded-full size-4 border-b-2 border-white"></span> : <ShoppingBag className="size-4" />}
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
                <div className="bg-white shadow-sm border border-slate-200 rounded-2xl">
                    <div className="p-6">
                        <h2 className="text-xl font-black mb-4 uppercase italic tracking-tighter text-slate-800">{t('ruptures.fournisseur.signaler', 'Signaler un Manque')}</h2>
                        <div className="relative">
                            <div className="relative">
                                <Search className="size-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input
                                    type="text"
                                    placeholder={t('ruptures.fournisseur.search_placeholder', 'Rechercher un produit...')}
                                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-bold text-slate-700 focus:outline-none transition-all"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            {searchQuery.length > 2 && (
                                <ul className="bg-white rounded-xl border border-slate-200 shadow-xl mt-2 max-h-60 overflow-y-auto absolute w-full top-full z-10">
                                    {isSearching ? (
                                        <li className="p-4 text-center"><div className="animate-spin rounded-full size-5 border-b-2 border-emerald-500 mx-auto"></div></li>
                                    ) : searchResults.length === 0 ? (
                                        <li className="p-4 text-center text-sm font-medium text-slate-400">{t('ruptures.fournisseur.no_results', 'Aucun produit trouvé')}</li>
                                    ) : (
                                        searchResults.map(p => (
                                            <li key={p.id} className="border-b border-slate-50 last:border-b-0">
                                                <button onClick={() => declarerRuptureFournisseur(p.id)} className="w-full flex items-center justify-between py-3 px-4 hover:bg-slate-50 text-left">
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-sm text-slate-800">{p.name}</span>
                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('ruptures.fournisseur.stock', 'Stock')}: {p.stock} | {p.fournisseur_name || 'N/A'}</span>
                                                    </div>
                                                    <Plus className="size-5 text-emerald-500" />
                                                </button>
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
                <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
                    <div>
                        <div className="p-6 pb-4 flex items-center justify-between bg-slate-50 border-b border-slate-100">
                            <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-800">
                                {t('ruptures.fournisseur.active_list', 'Ruptures actives chez les grossistes')}
                            </h2>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-600">{fournisseurData.length}</span>
                        </div>

                        <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="w-10 px-4 py-3">
                                    <input
                                        type="checkbox"
                                        className="size-4 rounded border-slate-300 accent-emerald-600"
                                        checked={fournisseurData.length > 0 && fournisseurData.every(r => selectedProviderIds.has(r.produit))}
                                        onChange={() => toggleSelectAll('fournisseur')}
                                    />
                                </th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 text-left">{t('ruptures.fournisseur.columns.produit', 'Produit')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 text-left">{t('ruptures.fournisseur.columns.fournisseur', 'Fournisseur')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 text-left">{t('ruptures.fournisseur.columns.date', 'Signalé le')}</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 text-right">{t('common:actions_title', 'Actions')}</th>
                            </tr>
                            </thead>
                            <tbody>
                            {fournisseurLoading ? (
                                <tr><td colSpan={5} className="p-4"><SkeletonTable rows={5} columns={5} /></td></tr>
                            ) : fournisseurData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-20 text-slate-300 italic">
                                        <ShieldAlert className="size-16 mx-auto mb-4 opacity-20" />
                                        <p className="text-lg font-black uppercase tracking-tighter text-slate-300">{t('ruptures.fournisseur.empty', 'Aucune rupture fournisseur active')}</p>
                                    </td>
                                </tr>
                            ) : (
                                fournisseurData.map((r) => (
                                <tr key={r.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50">
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            className="size-4 rounded border-slate-300 accent-emerald-600"
                                            checked={selectedProviderIds.has(r.produit)}
                                            onChange={() => toggleSelection(r.produit, 'fournisseur')}
                                        />
                                    </td>
                                    <td className="font-black text-red-500 py-3">
                                        {r.produit_nom}
                                        {r.remarques && <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">{r.remarques}</p>}
                                    </td>
                                    <td className="text-sm font-bold text-slate-500 py-3">{r.fournisseur_nom || '-'}</td>
                                    <td className="text-sm font-mono text-slate-400 py-3">
                                        {formatDate(r.date_debut)}
                                    </td>
                                    <td className="text-right py-3">
                                        <button
                                            className="inline-flex items-center gap-2 h-8 px-3 rounded-xl text-xs font-black text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                                            onClick={() => marquerResolu(r.id)}
                                            title={t('ruptures.fournisseur.mark_resolved', 'Marquer comme résolu')}
                                        >
                                            <Check className="size-4" />
                                            <span className="hidden md:inline uppercase italic">{t('ruptures.fournisseur.resolve', 'Résolu')}</span>
                                        </button>
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
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 w-full max-w-md px-4">
                        <div className="bg-slate-800 text-white rounded-[24px] shadow-2xl p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="size-9 rounded-xl bg-red-500 flex items-center justify-center font-black text-white">
                                    {selectedProviderIds.size}
                                </div>
                                <span className="font-bold italic text-sm uppercase tracking-tight">
                                    {t('common:selection_count', { count: selectedProviderIds.size })}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    className="inline-flex items-center h-9 px-4 rounded-xl text-sm font-bold text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                                    onClick={() => setSelectedProviderIds(new Set())}
                                >
                                    {t('common:cancel', 'Annuler')}
                                </button>
                                <button
                                    className="inline-flex items-center justify-center h-9 px-4 rounded-xl text-sm font-black gap-2 bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg disabled:opacity-60 transition-colors"
                                    onClick={() => generateBulkOrders('fournisseur')}
                                    disabled={isBulkAdding}
                                >
                                    {isBulkAdding ? <span className="animate-spin rounded-full size-4 border-b-2 border-white"></span> : <ShoppingBag className="size-4" />}
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
           <div className="bg-slate-800 text-white p-6 rounded-2xl shadow-xl overflow-hidden relative">
              <div className="absolute right-0 top-0 p-8 opacity-10 pointer-events-none">
                 <AlertTriangle className="size-32" />
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div>
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-2">
                      <AlertTriangle className="size-6 text-amber-400" />
                      {t('ruptures.stats.title', 'Analyses de Fréquence')}
                  </h2>
                  <p className="text-white/60 text-sm font-medium mt-1">{t('ruptures.stats.subtitle', 'Top des produits les plus souvent absents')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-0 rounded-xl overflow-hidden border border-white/20 shadow-lg">
                        <select
                          className="h-9 px-3 bg-slate-700 text-white text-sm font-black italic focus:outline-none border-none"
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
                          className="inline-flex items-center h-9 px-4 bg-white text-slate-800 text-xs font-black italic gap-2 hover:bg-slate-100 transition-colors"
                        >
                          <Download className="size-4" />
                          EXPORTER CSV
                        </button>
                    </div>
                </div>
              </div>
           </div>

           <div className="bg-white shadow-sm border border-slate-200 rounded-2xl max-w-4xl overflow-hidden">
              <div className="overflow-x-auto">
                {statsLoading ? (
                  <div className="p-4"><SkeletonTable rows={10} columns={3} /></div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="w-20 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-3">{t('ruptures.stats.columns.rang', 'RANG')}</th>
                        <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 text-left">{t('ruptures.stats.columns.produit', 'PRODUIT')}</th>
                        <th className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-3">{t('ruptures.stats.columns.frequence', 'FRÉQUENCE')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsData.length === 0 ? (
                        <tr><td colSpan={3} className="text-center py-20 text-slate-400 italic font-medium">{t('ruptures.stats.empty', 'Pas de données statistiques pour cette période')}</td></tr>
                      ) : (
                        statsData.map((stat, index) => (
                          <tr key={stat.produit_id} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0 group">
                            <td className="text-center py-4">
                               <div className={`size-8 rounded-lg flex items-center justify-center mx-auto text-sm font-black ${
                                 index < 3 ? 'bg-amber-400 text-amber-900 shadow-md' : 'bg-slate-100 text-slate-400'
                               }`}>
                                  {index + 1}
                               </div>
                            </td>
                            <td className="font-black group-hover:text-emerald-600 transition-colors text-base py-4">
                              {stat.produit_name}
                            </td>
                            <td className="text-center py-4">
                                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black italic bg-slate-100 text-slate-600">
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
      )}
    </div>
  );
}
