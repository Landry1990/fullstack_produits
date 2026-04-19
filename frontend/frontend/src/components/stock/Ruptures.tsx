import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, History, Check, ShieldAlert, BadgeInfo, Search, Plus } from 'lucide-react';
import axios from '../../config/axios';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-hot-toast';

export default function Ruptures() {
  const { t } = useTranslation(['stock', 'common']);
  const [activeTab, setActiveTab] = useState<'pharmacie' | 'fournisseur' | 'stats'>('pharmacie');

  // Pharmacie State
  const [pharmacieData, setPharmacieData] = useState<any[]>([]);
  const [pharmacieLoading, setPharmacieLoading] = useState(false);
  const [pharmaciePage, setPharmaciePage] = useState(1);
  const [pharmacieTotalPages, setPharmacieTotalPages] = useState(1);

  // Fournisseur State
  const [fournisseurData, setFournisseurData] = useState<any[]>([]);
  const [fournisseurLoading, setFournisseurLoading] = useState(false);
  
  // Stats State
  const [statsData, setStatsData] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Search Products for Supplier Shortage
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchPharmacieRuptures = async (page = 1) => {
    setPharmacieLoading(true);
    try {
      // Rotation_moyenne > 1 implies > 1 boite par mois, stock <= 0 (per user request)
      const res = await axios.get(`/api/produits/?stock__lte=0&rotation_moyenne__gt=1&latest_supplier=true&page=${page}`);
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
      const res = await axios.get(`/api/ruptures-fournisseurs/statistiques_frequence/`);
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
  }, [activeTab, pharmaciePage]);

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
    const timeoutId = setTimeout(search, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const declarerRuptureFournisseur = async (produitId: number) => {
    try {
      await axios.post('/api/ruptures-fournisseurs/', {
        produit: produitId,
        est_resolu: false
      });
      toast.success(t('ruptures.fournisseur.declare_success'));
      setSearchQuery('');
      fetchFournisseurRuptures();
    } catch (error: any) {
        if (error.response?.data?.non_field_errors) {
             toast.error(error.response.data.non_field_errors[0]);
        } else {
             toast.error(t('ruptures.fournisseur.declare_error'));
        }
    }
  };

  const marquerResolu = async (id: number) => {
    try {
      await axios.post(`/api/ruptures-fournisseurs/${id}/resoudre/`);
      toast.success(t('ruptures.fournisseur.resolve_success'));
      fetchFournisseurRuptures();
    } catch (error) {
      toast.error(t('ruptures.fournisseur.resolve_error'));
    }
  };

  return (
    <div className="p-2 md:p-4 max-w-full mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-base-content tracking-tight">{t('ruptures.title')}</h1>
          <p className="text-sm text-base-content/60 font-medium">{t('ruptures.subtitle')}</p>
        </div>
      </div>

      <div className="tabs tabs-boxed bg-base-100 p-1 shadow-sm font-bold inline-flex">
        <a 
          className={`tab px-6 transition-all ${activeTab === 'pharmacie' ? 'tab-active bg-primary text-white' : ''}`}
          onClick={() => setActiveTab('pharmacie')}
        >
          <Package className="w-4 h-4 mr-2" />
          {t('ruptures.tabs.pharmacie')}
        </a>
        <a 
          className={`tab px-6 transition-all ${activeTab === 'fournisseur' ? 'tab-active bg-red-500 text-white' : ''}`}
          onClick={() => setActiveTab('fournisseur')}
        >
          <ShieldAlert className="w-4 h-4 mr-2" />
          {t('ruptures.tabs.fournisseur')}
        </a>
        <a 
          className={`tab px-6 transition-all ${activeTab === 'stats' ? 'tab-active bg-neutral text-white' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <History className="w-4 h-4 mr-2" />
          {t('ruptures.tabs.stats')}
        </a>
      </div>

      {activeTab === 'pharmacie' && (
        <div className="card bg-base-100 shadow-sm border border-base-200">
          <div className="card-body p-2 md:p-4">
            <div className="flex items-center gap-2 mb-4 text-emerald-700 bg-emerald-50 p-4 rounded-xl">
              <BadgeInfo className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium" dangerouslySetInnerHTML={{ __html: t('ruptures.pharmacie.info') }}></p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="bg-base-200">
                    <th className="whitespace-nowrap">{t('ruptures.pharmacie.columns.cip', 'CIP')}</th>
                    <th className="whitespace-nowrap">{t('ruptures.pharmacie.columns.produit')}</th>
                    <th className="whitespace-nowrap">{t('ruptures.pharmacie.columns.rayon')}</th>
                    <th className="text-center whitespace-nowrap">{t('ruptures.pharmacie.columns.rotation')}</th>
                    <th className="whitespace-nowrap">{t('ruptures.pharmacie.columns.fournisseur')}</th>
                    <th className="whitespace-nowrap">{t('ruptures.pharmacie.columns.dernier_achat')}</th>
                    <th className="whitespace-nowrap">{t('ruptures.pharmacie.columns.dernier_vente')}</th>
                    <th className="text-right whitespace-nowrap">{t('ruptures.pharmacie.columns.prix_achat')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pharmacieLoading ? (
                    <tr><td colSpan={8} className="text-center py-8"><span className="loading loading-spinner"></span></td></tr>
                  ) : pharmacieData.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-base-content/50">{t('ruptures.pharmacie.empty')}</td></tr>
                  ) : (
                    pharmacieData.map((p) => (
                      <tr key={p.id} className="hover:bg-base-50 transition-colors">
                        <td className="font-mono text-sm whitespace-nowrap">{p.cip1 || '-'}</td>
                        <td className="font-bold whitespace-nowrap">{p.name}</td>
                        <td className="text-sm whitespace-nowrap">{p.rayon_name || '-'}</td>
                        <td className="text-center whitespace-nowrap">
                          <span className="badge badge-error gap-1 font-bold whitespace-nowrap">
                            {Number(p.rotation_moyenne).toFixed(1)} {t('ruptures.pharmacie.per_month')}
                          </span>
                        </td>
                        <td className="text-sm whitespace-nowrap">{p.fournisseur_name || '-'}</td>
                        <td className="text-sm text-base-content/70 whitespace-nowrap">
                          {p.dernier_achat ? new Date(p.dernier_achat).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td className="text-sm text-base-content/70 whitespace-nowrap">
                          {p.dernier_vente ? new Date(p.dernier_vente).toLocaleDateString('fr-FR') : '-'}
                        </td>
                        <td className="text-right font-mono text-sm whitespace-nowrap">{formatCurrency(p.cost_price)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {pharmacieTotalPages > 1 && (
                <div className="flex justify-center mt-6">
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
      )}

      {activeTab === 'fournisseur' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
                <div className="card bg-base-100 shadow-sm border border-base-200">
                    <div className="card-body">
                        <h2 className="card-title text-base mb-4">{t('ruptures.fournisseur.signaler')}</h2>
                        <div className="form-control relative">
                            <div className="relative">
                                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                                <input 
                                    type="text" 
                                    placeholder={t('ruptures.fournisseur.search_placeholder')} 
                                    className="input input-bordered w-full pl-10 bg-base-200/50 focus:bg-base-100 transition-colors"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            {searchQuery.length > 2 && (
                                <ul className="menu bg-base-100 rounded-box border border-base-200 shadow-xl mt-2 max-h-60 overflow-y-auto absolute w-full top-full z-10">
                                    {isSearching ? (
                                        <li className="p-4 text-center disabled"><span className="loading loading-spinner mx-auto"></span></li>
                                    ) : searchResults.length === 0 ? (
                                        <li className="p-4 text-center text-sm disabled">{t('ruptures.fournisseur.no_results')}</li>
                                    ) : (
                                        searchResults.map(p => (
                                            <li key={p.id}>
                                                <a onClick={() => declarerRuptureFournisseur(p.id)} className="flex items-center justify-between py-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">{p.name}</span>
                                                        <span className="text-[10px] opacity-70">{t('ruptures.fournisseur.stock')}: {p.stock} | {t('ruptures.fournisseur.fournisseur')}: {p.fournisseur_name || 'N/A'}</span>
                                                    </div>
                                                    <Plus className="w-4 h-4 text-primary" />
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
                <div className="card bg-base-100 shadow-sm border border-base-200">
                    <div className="card-body">
                        <h2 className="card-title text-base mb-4 flex items-center justify-between">
                            <span>{t('ruptures.fournisseur.active_list')}</span>
                            <span className="badge badge-neutral">{fournisseurData.length}</span>
                        </h2>
                        
                        <div className="overflow-x-auto">
                        <table className="table w-full relative">
                            <thead>
                            <tr className="bg-base-200">
                                <th>{t('ruptures.fournisseur.columns.produit')}</th>
                                <th>{t('ruptures.fournisseur.columns.fournisseur')}</th>
                                <th>{t('ruptures.fournisseur.columns.date')}</th>
                                <th className="text-right">{t('ruptures.fournisseur.columns.action')}</th>
                            </tr>
                            </thead>
                            <tbody>
                            {fournisseurLoading ? (
                                <tr><td colSpan={4} className="text-center py-8"><span className="loading loading-spinner"></span></td></tr>
                            ) : fournisseurData.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-12 text-base-content/40">
                                        <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        {t('ruptures.fournisseur.empty')}
                                    </td>
                                </tr>
                            ) : (
                                fournisseurData.map((r) => (
                                <tr key={r.id} className="hover:bg-red-50/30 transition-colors">
                                    <td className="font-bold text-red-700">
                                        {r.produit_nom}
                                        {r.remarques && <p className="text-[10px] font-normal text-base-content/60 mt-1">{r.remarques}</p>}
                                    </td>
                                    <td className="text-sm">{r.fournisseur_nom || '-'}</td>
                                    <td className="text-sm">
                                        {new Date(r.date_debut).toLocaleDateString('fr-FR')}
                                    </td>
                                    <td className="text-right">
                                        <button 
                                            className="btn btn-sm btn-ghost hover:bg-emerald-100 hover:text-emerald-700 text-base-content/50"
                                            onClick={() => marquerResolu(r.id)}
                                            title={t('ruptures.fournisseur.mark_resolved_title')}
                                        >
                                            <Check className="w-4 h-4" /> {t('ruptures.fournisseur.mark_resolved')}
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
            </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="card bg-base-100 shadow-sm border border-base-200 max-w-4xl">
          <div className="card-body">
            <h2 className="card-title text-base mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                {t('ruptures.stats.title')}
            </h2>
            
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="bg-base-200">
                    <th className="w-16 text-center">{t('ruptures.stats.columns.rang')}</th>
                    <th>{t('ruptures.stats.columns.produit')}</th>
                    <th className="text-center">{t('ruptures.stats.columns.frequence')}</th>
                  </tr>
                </thead>
                <tbody>
                  {statsLoading ? (
                    <tr><td colSpan={3} className="text-center py-8"><span className="loading loading-spinner"></span></td></tr>
                  ) : statsData.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-8 text-base-content/50">{t('ruptures.stats.empty')}</td></tr>
                  ) : (
                    statsData.map((stat, index) => (
                      <tr key={stat.produit_id} className="hover:bg-base-50 transition-colors group">
                        <td className="text-center font-bold text-base-content/40 text-lg">#{index + 1}</td>
                        <td className="font-bold group-hover:text-primary transition-colors">{stat.produit_name}</td>
                        <td className="text-center">
                            <span className="badge badge-neutral font-mono font-bold">
                                {stat.total_ruptures} {t('ruptures.stats.times')}
                            </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
