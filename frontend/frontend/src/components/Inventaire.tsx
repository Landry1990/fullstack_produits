import { useState, useEffect } from 'react';
import axios from 'axios';
import type { ProduitModel } from '../types';

export default function Inventaire() {
  const [produits, setProduits] = useState<ProduitModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRayon, setFilterRayon] = useState('');

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
  const produitsEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/produits/`
    : '/api/produits/';

  useEffect(() => {
    const fetchProduits = async () => {
      try {
        setLoading(true);
        const response = await axios.get<ProduitModel[]>(produitsEndpoint);
        setProduits(response.data);
      } catch (error) {
        console.error('Erreur lors du chargement des produits:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduits();
  }, [produitsEndpoint]);

  const [sortConfig, setSortConfig] = useState<{ key: keyof ProduitModel | 'rayon_name' | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  const [valuationType, setValuationType] = useState<'achat' | 'vente'>('vente');
  const [tvaRate, setTvaRate] = useState(18);

  const filteredProduits = produits.filter(produit => {
    const matchesSearch = produit.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRayon = !filterRayon || produit.rayon_name === filterRayon;
    return matchesSearch && matchesRayon;
  });

  const sortedProduits = [...filteredProduits].sort((a, b) => {
    if (!sortConfig.key) return 0;
    
    const aValue = a[sortConfig.key as keyof ProduitModel];
    const bValue = b[sortConfig.key as keyof ProduitModel];

    if (aValue === bValue) return 0;
    
    // Handle numeric values
    if (['stock', 'stock_alert', 'cost_price', 'selling_price'].includes(sortConfig.key)) {
      return sortConfig.direction === 'asc' 
        ? Number(aValue) - Number(bValue) 
        : Number(bValue) - Number(aValue);
    }

    // Handle string values
    const aString = String(aValue || '').toLowerCase();
    const bString = String(bValue || '').toLowerCase();

    if (aString < bString) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aString > bString) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const requestSort = (key: keyof ProduitModel | 'rayon_name') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
    return sortConfig.direction === 'asc' 
      ? <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
      : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" /></svg>;
  };

  const rayons = Array.from(new Set(produits.map(p => p.rayon_name).filter(Boolean)));

  const totalStock = filteredProduits.reduce((sum, p) => sum + (p.stock || 0), 0);
  const lowStockCount = filteredProduits.filter(p => (p.stock || 0) <= (p.stock_alert || 0)).length;

  // Calculate Valuation
  const totalValuationHT = filteredProduits.reduce((sum, p) => {
    const price = valuationType === 'achat' ? Number(p.cost_price || 0) : Number(p.selling_price || 0);
    return sum + (price * (p.stock || 0));
  }, 0);

  const totalValuationTTC = totalValuationHT * (1 + tvaRate / 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Inventaire</h1>
          <p className="text-sm text-base-content/80">Gestion de l'inventaire des produits</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-base-100 shadow-sm border border-base-200">
          <div className="card-body p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-base-content/70">Total Produits</p>
                <h3 className="text-2xl font-bold text-base-content">{filteredProduits.length}</h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm border border-base-200">
          <div className="card-body p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-base-content/70">Stock Total</p>
                <h3 className="text-2xl font-bold text-base-content">{totalStock.toLocaleString('fr-FR')}</h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm border border-base-200">
          <div className="card-body p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-base-content/70">Alertes Stock</p>
                <h3 className="text-2xl font-bold text-error">{lowStockCount}</h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Valuation Section */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-4">
          <h2 className="card-title text-lg mb-4">Valorisation du Stock</h2>
          <div className="flex flex-col md:flex-row gap-6 items-end">
            <div className="form-control w-full md:w-auto">
              <label className="label"><span className="label-text">Type de valorisation</span></label>
              <select 
                className="select select-bordered w-full md:w-64"
                value={valuationType}
                onChange={(e) => setValuationType(e.target.value as 'achat' | 'vente')}
              >
                <option value="achat">Prix d'Achat (Coût)</option>
                <option value="vente">Prix de Vente (CA Potentiel)</option>
              </select>
            </div>
            <div className="form-control w-full md:w-auto">
              <label className="label"><span className="label-text">Taux TVA (%)</span></label>
              <input 
                type="number" 
                className="input input-bordered w-full md:w-32"
                value={tvaRate}
                onChange={(e) => setTvaRate(Number(e.target.value))}
                min="0"
                max="100"
              />
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row gap-4 justify-end items-center bg-base-200/50 p-4 rounded-lg">
              <div className="text-center md:text-right">
                <p className="text-sm text-base-content/70">Valeur HT</p>
                <p className="text-2xl font-bold text-primary">{Math.round(totalValuationHT).toLocaleString('fr-FR')} F</p>
              </div>
              <div className="divider md:divider-horizontal"></div>
              <div className="text-center md:text-right">
                <p className="text-sm text-base-content/70">Valeur TTC</p>
                <p className="text-2xl font-bold text-secondary">{Math.round(totalValuationTTC).toLocaleString('fr-FR')} F</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label"><span className="label-text">Rechercher</span></label>
              <input
                type="text"
                placeholder="Nom du produit..."
                className="input input-bordered"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Filtrer par rayon</span></label>
              <select
                className="select select-bordered"
                value={filterRayon}
                onChange={(e) => setFilterRayon(e.target.value)}
              >
                <option value="">Tous les rayons</option>
                {rayons.map(rayon => (
                  <option key={rayon} value={rayon}>{rayon}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead className="bg-base-200/50">
              <tr>
                <th className="cursor-pointer hover:bg-base-300 transition-colors" onClick={() => requestSort('name')}>
                  <div className="flex items-center gap-2">Produit {getSortIcon('name')}</div>
                </th>
                <th className="cursor-pointer hover:bg-base-300 transition-colors" onClick={() => requestSort('rayon_name')}>
                  <div className="flex items-center gap-2">Rayon {getSortIcon('rayon_name')}</div>
                </th>
                <th className="text-right cursor-pointer hover:bg-base-300 transition-colors" onClick={() => requestSort('stock')}>
                  <div className="flex items-center justify-end gap-2">Stock {getSortIcon('stock')}</div>
                </th>
                <th className="text-right cursor-pointer hover:bg-base-300 transition-colors" onClick={() => requestSort('stock_alert')}>
                  <div className="flex items-center justify-end gap-2">Alerte {getSortIcon('stock_alert')}</div>
                </th>
                <th className="text-right cursor-pointer hover:bg-base-300 transition-colors" onClick={() => requestSort('cost_price')}>
                  <div className="flex items-center justify-end gap-2">Prix Achat {getSortIcon('cost_price')}</div>
                </th>
                <th className="text-right cursor-pointer hover:bg-base-300 transition-colors" onClick={() => requestSort('selling_price')}>
                  <div className="flex items-center justify-end gap-2">Prix Vente {getSortIcon('selling_price')}</div>
                </th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8"><span className="loading loading-spinner"></span></td></tr>
              ) : sortedProduits.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-base-content/50">Aucun produit trouvé</td></tr>
              ) : (
                sortedProduits.map(produit => (
                  <tr key={produit.id} className="hover:bg-base-200/30">
                    <td className="font-medium">{produit.name}</td>
                    <td>{produit.rayon_name || '-'}</td>
                    <td className="text-right font-bold">{produit.stock}</td>
                    <td className="text-right">{produit.stock_alert}</td>
                    <td className="text-right">{Math.round(Number(produit.cost_price)).toLocaleString('fr-FR')} F</td>
                    <td className="text-right">{Math.round(Number(produit.selling_price)).toLocaleString('fr-FR')} F</td>
                    <td>
                      {(produit.stock || 0) <= 0 ? (
                        <span className="badge badge-error badge-sm">Rupture</span>
                      ) : (produit.stock || 0) <= (produit.stock_alert || 0) ? (
                        <span className="badge badge-warning badge-sm">Faible</span>
                      ) : (
                        <span className="badge badge-success badge-sm">OK</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
