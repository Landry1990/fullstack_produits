import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import type { ProduitModel, Inventaire, LigneInventaire } from '../types';


export default function InventaireComponent() {
  // Modes: LIST, CREATE, EDIT
  const [viewMode, setViewMode] = useState<'LIST' | 'CREATE' | 'EDIT'>('LIST');

  // Data
  const [inventaires, setInventaires] = useState<Inventaire[]>([]);
  const [activeInventaire, setActiveInventaire] = useState<Inventaire | null>(null);
  const [lignes, setLignes] = useState<LigneInventaire[]>([]);
  
  // Form Data (Header)
  const [description, setDescription] = useState('');
  const [dateInventaire, setDateInventaire] = useState(new Date().toISOString().split('T')[0]);

  // Product Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProduitModel[]>([]);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Focus management
  const focusInput = (index: number) => {
      setTimeout(() => {
          const el = document.getElementById(`qty-input-${index}`);
          if (el) {
              (el as HTMLInputElement).focus();
              (el as HTMLInputElement).select();
          } else if (searchInputRef.current) {
              searchInputRef.current.focus();
          }
      }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          // Always focus Search after Enter on Quantity (User Request)
          searchInputRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
          if (index < lignes.length - 1) focusInput(index + 1);
      } else if (e.key === 'ArrowUp') {
          if (index > 0) focusInput(index - 1);
          else searchInputRef.current?.focus();
      }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
      // Allow navigation even if no results? No.
      if (searchResults.length === 0) return;

      if (e.key === 'ArrowDown' || e.key === 'Down') {
          e.preventDefault();
          setSelectedSearchIndex(prev => {
              const newIndex = prev < searchResults.length - 1 ? prev + 1 : prev;
              // Smooth scroll to element?
              const el = document.getElementById(`search-result-${newIndex}`);
              el?.scrollIntoView({ block: 'nearest' });
              return newIndex;
          });
      } else if (e.key === 'ArrowUp' || e.key === 'Up') {
          e.preventDefault();
          setSelectedSearchIndex(prev => {
              const newIndex = prev > 0 ? prev - 1 : 0;
               const el = document.getElementById(`search-result-${newIndex}`);
              el?.scrollIntoView({ block: 'nearest' });
              return newIndex;
          });
      } else if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedSearchIndex >= 0 && selectedSearchIndex < searchResults.length) {
              handleAddProduct(searchResults[selectedSearchIndex]);
          } else if (searchResults.length > 0) {
              handleAddProduct(searchResults[0]);
          }
      }
  };

  // API Base URL
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
  const inventairesEndpoint = `${String(apiBaseUrl).replace(/\/$/, '')}/api/inventaires/`;
  const lignesEndpoint = `${String(apiBaseUrl).replace(/\/$/, '')}/api/ligne-inventaires/`;
  const produitsEndpoint = `${String(apiBaseUrl).replace(/\/$/, '')}/api/produits/`;

  // === FETCH LIST ===
  useEffect(() => {
    if (viewMode === 'LIST') {
      fetchInventaires();
    }
  }, [viewMode]);

  const fetchInventaires = async () => {
    try {
      setLoading(true);
      const res = await axios.get(inventairesEndpoint);
      setInventaires(Array.isArray(res.data) ? res.data : res.data.results);
    } catch (err) {
      console.error("Erreur fetch inventaires", err);
    } finally {
      setLoading(false);
    }
  };

  // === SEARCH PRODUCTS ===
  useEffect(() => {
    const timer = setTimeout(() => {
        if (searchQuery.length >= 2) {
            performSearch();
        } else {
            setSearchResults([]);
        }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const performSearch = async () => {
      setLoadingSearch(true);
      try {
          const res = await axios.get(`${produitsEndpoint}?search=${searchQuery}`);
          setSearchResults(Array.isArray(res.data) ? res.data : res.data.results || []);
          setSelectedSearchIndex(-1); // Reset selection on new search
      } catch (err) {
          console.error("Erreur recherche", err);
      } finally {
          setLoadingSearch(false);
      }
  };

  // === ACTIONS ===

  const handleCreate = () => {
      setActiveInventaire(null);
      setLignes([]);
      setDescription('');
      setDateInventaire(new Date().toISOString().split('T')[0]);
      setViewMode('CREATE');
  };

  const handleEdit = async (inv: Inventaire) => {
      setActiveInventaire(inv);
      setDescription(inv.description);
      setDateInventaire(inv.date.split('T')[0]);
      setViewMode('EDIT');
      
      // Fetch lines
      try {
          const res = await axios.get(`${lignesEndpoint}?inventaire=${inv.id}`);
          setLignes(res.data.results || res.data);
      } catch(err) {
          console.error("Erreur chargement lignes", err);
      }
  };

  const handleDelete = async (id: number) => {
      if (!confirm('Supprimer cet inventaire ?')) return;
      try {
          await axios.delete(`${inventairesEndpoint}${id}/`);
          fetchInventaires();
      } catch (err) {
          alert("Erreur lors de la suppression");
      }
  };

  const handleAddProduct = async (product: ProduitModel) => {
      // Check if line exists locally
      const exists = lignes.find(l => l.produit === ((typeof product === 'object') ? product.id as any : product) ||  (l.produit && l.produit.id === product.id));
      
      if (exists) {
          alert("Ce produit est déjà dans l'inventaire.");
          setSearchQuery('');
          return;
      }
      
      // CREATE MODE logic: If no ID, create draft.
      let invId = activeInventaire?.id;
      if (!invId) {
          try {
              const res = await axios.post(inventairesEndpoint, {
                  date: dateInventaire,
                  description: description || 'Nouvel Inventaire',
                  status: 'EN_COURS'
              });
              invId = res.data.id;
              setActiveInventaire(res.data);
              // Update list 
              setInventaires(prev => [res.data, ...prev]);
          } catch(err) {
              console.error("Erreur création inventaire", err);
              alert("Impossible de créer l'inventaire automatiquement.");
              return;
          }
      }

      // Inject full product details for local display immediately (before re-fetch)
      const cost = product.cost_price || '0';
      const pmp = product.pmp || '0';

      try {
          const payload = {
              inventaire: invId,
              produit: product.id,
              stock_theorique: product.stock, 
              quantite_physique: product.stock, 
          };
          const res = await axios.post(lignesEndpoint, payload);
          
           const newLine: LigneInventaire = {
               ...res.data,
               produit: product, 
               produit_nom: product.name,
               produit_cip: product.cip1,
               produit_rayon: product.rayon_name,
               produit_description: product.description,
               produit_cost_price: cost,
               produit_pmp: pmp,
           };
           const newLignes = [...lignes, newLine];
           setLignes(newLignes);
           
           setTimeout(() => focusInput(newLignes.length - 1), 100);

      } catch (err) {
          console.error("Erreur ajout ligne", err);
      }
      setSearchQuery('');
  };

  const handleUpdateQuantity = async (lineId: number, newQty: number) => {
      // Optimistic update
      const updatedLignes = lignes.map(l => l.id === lineId ? { ...l, quantite_physique: newQty, ecart: newQty - l.stock_theorique } : l);
      setLignes(updatedLignes);

      // Debounced save could be better, but direct save for now
      try {
          await axios.patch(`${lignesEndpoint}${lineId}/`, { quantite_physique: newQty });
      } catch (err) {
          console.error("Erreur update quantite", err);
      }
  };

  const handleValidate = async () => {
      if (!activeInventaire) return;
      if (!confirm("Valider l'inventaire ? Cela mettra à jour le stock de tous les produits listés.")) return;

      try {
          setSaving(true);
          await axios.post(`${inventairesEndpoint}${activeInventaire.id}/validate/`);
          alert("Inventaire validé avec succès !");
          setViewMode('LIST');
          fetchInventaires();
      } catch (err) {
          alert("Erreur lors de la validation");
          console.error(err);
      } finally {
          setSaving(false);
      }
  };

  const handleSaveHeader = async () => {
      // Just update description/date
      if (!activeInventaire) return;
      try {
           await axios.patch(`${inventairesEndpoint}${activeInventaire.id}/`, {
               date: dateInventaire,
               description
           });
           alert("En-tête sauvegardé");
      } catch(err) {
          alert("Erreur sauvegarde");
      }
  };


  // === RENDER ===

  if (viewMode === 'LIST') {
      return (
          <div className="space-y-6">
              <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold">Inventaires</h1>
                  <button className="btn btn-primary" onClick={handleCreate}>
                      + Nouvel Inventaire
                  </button>
              </div>

              <div className="card bg-base-100 shadow">
                  <div className="overflow-x-auto">
                      <table className="table">
                          <thead>
                              <tr>
                                  <th>Date</th>
                                  <th>Description</th>
                                  <th className="text-right">Val. Théorique</th>
                                  <th className="text-right">Val. Saisie</th>
                                  <th className="text-right">Ecart Valeur</th>
                                  <th>Statut</th>
                                  <th>Crée par</th>
                                  <th>Actions</th>
                              </tr>
                          </thead>
                          <tbody>
                              {loading ? (
                                  <tr>
                                      <td colSpan={8} className="text-center py-4">
                                          <span className="loading loading-spinner"></span> Chargement...
                                      </td>
                                  </tr>
                              ) : inventaires.map(inv => (
                                  <tr key={inv.id} className="hover:bg-base-200 cursor-pointer" onClick={() => handleEdit(inv)}>
                                      <td>{new Date(inv.date).toLocaleDateString()}</td>
                                      <td>{inv.description || '-'}</td>
                                      <td className="text-right font-mono">{(inv.total_valeur_theorique || 0).toLocaleString()} F</td>
                                      <td className="text-right font-bold">{(inv.total_valeur_physique || 0).toLocaleString()} F</td>
                                      <td className={`text-right font-bold ${(inv.total_ecart_valeur || 0) < 0 ? 'text-error' : (inv.total_ecart_valeur || 0) > 0 ? 'text-success' : ''}`}>
                                          {(inv.total_ecart_valeur || 0).toLocaleString()} F
                                      </td>
                                      <td>
                                          <span className={`badge ${inv.status === 'VALIDEE' ? 'badge-success' : 'badge-warning'}`}>
                                              {inv.status}
                                          </span>
                                      </td>
                                      <td>{inv.created_by_name || '-'}</td>
                                      <td onClick={e => e.stopPropagation()}>
                                          <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(inv.id)} disabled={inv.status === 'VALIDEE'}>
                                              Supprimer
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                              {inventaires.length === 0 && (
                                  <tr>
                                      <td colSpan={5} className="text-center py-4 text-gray-500">Aucun inventaire</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      );
  }

  // Create / Edit View Variables
  const isReadOnly = activeInventaire?.status === 'VALIDEE';
  const totalEcartValeur = lignes.reduce((sum, l) => {
      const price = parseFloat(l.produit_cost_price || l.pmp_snapshot || '0');
      return sum + (l.ecart * price);
  }, 0);
  const totalValeurPhysique = lignes.reduce((sum, l) => {
      const price = parseFloat(l.produit_cost_price || l.pmp_snapshot || '0');
      return sum + (l.quantite_physique * price);
  }, 0);
  const totalValeurTheorique = lignes.reduce((sum, l) => {
      const price = parseFloat(l.produit_cost_price || l.pmp_snapshot || '0');
      return sum + (l.stock_theorique * price);
  }, 0);

  return (
      <div className="space-y-6">
          <div className="flex justify-between items-center">
              <div className="flex gap-4 items-center">
                   <button className="btn btn-ghost" onClick={() => setViewMode('LIST')}>← Retour</button>
                   <h1 className="text-2xl font-bold">
                       {viewMode === 'CREATE' ? 'Nouvel Inventaire' : `Inventaire #${activeInventaire?.id}`}
                   </h1>
                   {isReadOnly && <span className="badge badge-success badge-lg">VALIDÉE</span>}
              </div>
              <div className="flex gap-2">
                  {!isReadOnly && activeInventaire && (
                       <>
                           {/* Save Button (Implicitly saved via API calls but we can add a global 'Done' or similar if needed) 
                               Actually, since we save line by line, this is mostly for the header or just status.
                               User requested SEPARATE buttons. One for Validating.
                           */}
                           <button className="btn btn-warning" disabled>Enregistré auto.</button> {/* Feedback only */}
                           
                           <button className="btn btn-success text-white" onClick={handleValidate} disabled={saving}>
                               {saving ? 'Validation...' : '✓ Valider et Mettre à jour Stock'}
                           </button>
                       </>
                  )}
              </div>
          </div>

          {/* Header Form */}
          <div className="card bg-base-100 shadow p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-control">
                      <label className="label">Date</label>
                      <input 
                          type="date" 
                          className="input input-bordered" 
                          value={dateInventaire} 
                          onChange={e => setDateInventaire(e.target.value)}
                          disabled={isReadOnly}
                          onBlur={handleSaveHeader}
                      />
                  </div>
                  <div className="form-control md:col-span-2">
                      <label className="label">Description</label>
                      <input 
                          type="text" 
                          className="input input-bordered" 
                          placeholder="Ex: Inventaire Annuel 2025..."
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          disabled={isReadOnly}
                          onBlur={handleSaveHeader}
                      />
                  </div>
              </div>
          </div>

          {/* Product Search */}
          {!isReadOnly && (
              <div className="card bg-base-100 shadow p-4 overflow-visible relative">
                  <div className="form-control w-full">
                       <label className="label font-bold">Ajouter un produit (Recherche par Nom ou CIP)</label>
                       <input 
                           ref={searchInputRef}
                           type="text" 
                           className="input input-bordered w-full" 
                           placeholder="Scanner ou taper le nom..."
                           value={searchQuery}
                           onChange={e => setSearchQuery(e.target.value)}
                           onKeyDown={handleSearchKeyDown}
                           autoFocus
                       />
                       {loadingSearch && <span className="absolute right-4 top-12 loading loading-spinner"></span>}
                  </div>
                  {/* Dropdown Results */}
                  {searchResults.length > 0 && (
                      <ul className="menu bg-base-100 w-full shadow-xl rounded-box absolute top-24 z-50 border border-base-300 max-h-60 overflow-y-auto">
                          {searchResults.map((p, idx) => (
                              <li key={p.id} id={`search-result-${idx}`}>
                                  <a 
                                      onClick={() => handleAddProduct(p)} 
                                      className={`flex justify-between ${idx === selectedSearchIndex ? 'active' : ''}`}
                                  >
                                      <span>{p.name} <span className="text-xs opacity-50">({p.cip1})</span></span>
                                      <span className="badge badge-sm">Stock: {p.stock}</span>
                                  </a>
                              </li>
                          ))}
                      </ul>
                  )}
              </div>
          )}

          {/* Lines Table */}
          <div className="card bg-base-100 shadow">
              <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                      <thead>
                          <tr>
                              <th>Produit</th>
                              <th>Forme</th>
                              <th>Rayon</th>
                              <th className="text-right">Prix Achat</th>
                              <th className="text-center">Stock Théo.</th>
                              <th className="text-center">Qté Saisie</th>
                              <th className="text-center">Ecart Qté</th>
                              <th className="text-right">Ecart Val.</th>
                              {!isReadOnly && <th>Actions</th>}
                          </tr>
                      </thead>
                      <tbody>
                          {lignes.map((ligne, index) => {
                              const price = parseFloat(ligne.produit_cost_price || ligne.pmp_snapshot || '0');
                              const ecartValeur = ligne.ecart * price;
                              return (
                              <tr key={ligne.id}>
                                  <td>
                                      <div className="font-bold">
                                          {typeof ligne.produit === 'object' ? ligne.produit.name : ligne.produit_nom}
                                      </div>
                                      <div className="text-xs opacity-50">
                                          {typeof ligne.produit === 'object' ? ligne.produit.cip1 : ligne.produit_cip}
                                      </div>
                                  </td>
                                  <td>{typeof ligne.produit === 'object' ? ligne.produit.description : ligne.produit_description}</td>
                                  <td>{typeof ligne.produit === 'object' ? ligne.produit.rayon_name : ligne.produit_rayon}</td>
                                  <td className="text-right">{price.toLocaleString()} F</td>
                                  <td className="text-center text-lg">{ligne.stock_theorique}</td>
                                  
                                  <td className="text-center">
                                      {isReadOnly ? (
                                          <span className="font-bold text-lg">{ligne.quantite_physique}</span>
                                      ) : (
                                          <input 
                                              id={`qty-input-${lignes.indexOf(ligne)}`}
                                              type="text" 
                                              inputMode="numeric"
                                              className="input input-bordered input-sm w-32 text-center font-bold"
                                              value={ligne.quantite_physique}
                                              onChange={(e) => {
                                                  const val = e.target.value;
                                                  if (/^\d*$/.test(val)) {
                                                      handleUpdateQuantity(ligne.id, val === '' ? 0 : parseInt(val));
                                                  }
                                              }}
                                              onFocus={(e) => e.target.select()}
                                              onKeyDown={(e) => handleKeyDown(e, lignes.indexOf(ligne))}
                                          />
                                      )}
                                  </td>
                                  
                                  <td className="text-center">
                                      <span className={`badge ${ligne.ecart < 0 ? 'badge-error' : ligne.ecart > 0 ? 'badge-success' : 'badge-ghost'} badge-lg`}>
                                          {ligne.ecart > 0 ? '+' : ''}{ligne.ecart}
                                      </span>
                                  </td>
                                  <td className={`text-right font-bold ${ecartValeur < 0 ? 'text-error' : ecartValeur > 0 ? 'text-success' : ''}`}>
                                      {ecartValeur.toLocaleString()} F
                                  </td>
                                  {!isReadOnly && (
                                      <td>
                                          {/* Delete line logic could be added here */}
                                      </td>
                                  )}
                              </tr>
                              );
                          })}
                          {lignes.length === 0 && (
                              <tr>
                                  <td colSpan={6} className="text-center py-8 opacity-50">
                                      Scanner ou ajouter des produits pour commencer le comptage.
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
              <div className="p-4 bg-base-200 border-t flex justify-end gap-8">
                  <div className="text-right">
                      <div className="text-sm opacity-50">Valeur Théorique</div>
                      <div className="text-xl font-bold">{totalValeurTheorique.toLocaleString()} F</div>
                  </div>
                  <div className="text-right">
                      <div className="text-sm opacity-50">Valeur Saisie</div>
                      <div className="text-xl font-bold">{totalValeurPhysique.toLocaleString()} F</div>
                  </div>
                  <div className="text-right">
                      <div className="text-sm opacity-50">Ecart Valeur</div>
                      <div className={`text-xl font-bold ${totalEcartValeur < 0 ? 'text-error' : totalEcartValeur > 0 ? 'text-success' : ''}`}>
                          {totalEcartValeur > 0 ? '+' : ''}{totalEcartValeur.toLocaleString()} F
                      </div>
                  </div>
              </div>
          </div>
      </div>
  );
}
