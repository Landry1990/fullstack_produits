import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useConfirm } from '../hooks/useConfirm';
import type { ProduitModel, Inventaire, LigneInventaire, StockLot } from '../types';
import { useSearchNavigation } from '../hooks/useSearchNavigation';
import { useProductSearch } from '../hooks/useProductSearch';


export default function InventaireComponent() {
  const confirm = useConfirm()
  // Modes: LIST, CREATE, EDIT
  const [viewMode, setViewMode] = useState<'LIST' | 'CREATE' | 'EDIT'>('LIST');

  // Data
  const [inventaires, setInventaires] = useState<Inventaire[]>([]);
  const [activeInventaire, setActiveInventaire] = useState<Inventaire | null>(null);
  const [lignes, setLignes] = useState<LigneInventaire[]>([]);
  
  // Form Data (Header)
  const [description, setDescription] = useState('');
  const [dateInventaire, setDateInventaire] = useState(new Date().toISOString().split('T')[0]);

  // Product Search using hook
  const { 
    produits: searchResults, 
    loading: loadingSearch,
    searchQuery, 
    setSearchQuery 
  } = useProductSearch({ minSearchLength: 1, debounceMs: 300 })
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lot Selection State
  const [showLotModal, setShowLotModal] = useState(false);
  const [selectedProductForLot, setSelectedProductForLot] = useState<ProduitModel | null>(null);
  const [availableLots, setAvailableLots] = useState<StockLot[]>([]);
  const [loadingLots, setLoadingLots] = useState(false);

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




  // API Base URL
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
  const inventairesEndpoint = `${String(apiBaseUrl).replace(/\/$/, '')}/api/inventaires/`;
  const lignesEndpoint = `${String(apiBaseUrl).replace(/\/$/, '')}/api/ligne-inventaires/`;
  // produitsEndpoint removed - products are loaded via useProductSearch hook

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

  // Search is now handled by useProductSearch hook

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
      const confirmed = await confirm({
        title: 'Supprimer l\'inventaire',
        message: 'Supprimer cet inventaire ?',
        variant: 'danger',
        confirmText: 'Supprimer'
      })
      if (!confirmed) return;
      try {
          await axios.delete(`${inventairesEndpoint}${id}/`);
          fetchInventaires();
      } catch (err) {
          toast.error("Erreur lors de la suppression");
      }
  };

  const fetchAvailableLots = async (productId: number) => {
      setLoadingLots(true);
      try {
          // Include empty lots to see all history if needed, but for inventory we usually want what exists. 
          // However, for counting, we might tap into an empty lot to refill it if we find stock?
          // Let's stick to include_empty=true just in case they find a lost item.
          const res = await axios.get(`${String(apiBaseUrl).replace(/\/$/, '')}/api/stock-lots/?produit=${productId}&include_empty=true`);
          setAvailableLots(res.data.results || res.data);
      } catch (err) {
          console.error("Error fetching lots", err);
          toast.error("Impossible de charger les lots");
      } finally {
          setLoadingLots(false);
      }
  };

  const handleProductSelect = async (product: ProduitModel) => {
      // Fetch full details because search results use ProduitListSerializer (missing cost_price, etc.)
      setLoading(true);
      try {
          const produitsEndpoint = `${apiBaseUrl ? String(apiBaseUrl).replace(/\/$/, '') : ''}/api/produits/`;
          const { data: fullProduct } = await axios.get<ProduitModel>(`${produitsEndpoint}${product.id}/`);
          
          // Wrapper to check for lot management
          if (fullProduct.use_lot_management) {
              setSelectedProductForLot(fullProduct);
              setAvailableLots([]);
              setShowLotModal(true);
              fetchAvailableLots(fullProduct.id);
          } else {
              handleAddProduct(fullProduct);
          }
      } catch (err) {
          console.error("Erreur chargement détails produit", err);
          toast.error("Impossible de charger les détails complets du produit");
      } finally {
          setLoading(false);
      }
  };

  const handleLotSelection = (lotId: number) => {
      if (selectedProductForLot) {
          handleAddProduct(selectedProductForLot, lotId);
          setShowLotModal(false);
          setSelectedProductForLot(null);
      }
  };

  const handleAddProduct = async (product: ProduitModel, stockLotId?: number) => {
      // Check if line exists locally
      // If adding a specific lot, check if THAT lot is already added.
      // If adding generic product, check if generic product is added.
      
      const exists = lignes.find(l => {
          const sameProduct = (l.produit === ((typeof product === 'object') ? product.id as any : product) ||  (l.produit && l.produit.id === product.id));
          if (!sameProduct) return false;
          
          if (stockLotId) {
             // We need to know the lot ID of the existing line. 
             // The current local state 'lignes' might strictly be LigneInventaire interface which doesn't explicitly show 'stock_lot' ID at top level easily unless we check how backend returns it.
             // Backend serializer has `stock_lot` as ID? No, checking serializer...
             // LigneInventaireSerializer fields: `stock_lot` is PK. 
             // In `lignes` state (which comes from API), l.stock_lot is number (FK).
             return l.stock_lot === stockLotId;
          } else {
             // Generic add: check if any line with this product exists AND has NO lot? 
             // Or just if any line exists? 
             // If I have Lot A added, can I add "Generic" product too? Probably yes, for "Loose items".
             // So check strict equality on stock_lot being null/undefined.
             return !l.stock_lot; // Only clash if existing line has NO lot.
          }
      });
      
      if (exists) {
          toast('Ce produit (ou ce lot) est déjà dans l\'inventaire.', { icon: '⚠️' });
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
              toast.error("Impossible de créer l'inventaire automatiquement.");
              return;
          }
      }

      // Inject full product details for local display immediately (before re-fetch)
      const cost = product.cost_price || '0';
      const pmp = product.pmp || '0';

      try {
          const payload: any = {
              inventaire: invId,
              produit: product.id,
              stock_theorique: product.stock, 
              quantite_physique: product.stock, 
          };
          
          if (stockLotId) {
              payload.stock_lot = stockLotId;
              // If lot provided, backend handles theorical stock from lot (via our `create` view modification? 
              // Wait, I didn't modify `create` in backend yet?
              // The plan said "Backend is already compatible".
              // Let's re-verify ViewSet logic for `create`.
              // ViewSet LigneInventaireViewSet.create does check `stock_lot` and sets `stock_theorique` from it!
              // YES, I saw it in `views.py` lines 3165+. perfect.
          } else {
              // Backward compat logic
          }

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

  // Use search navigation hook (must be after handleAddProduct is declared)
  const { handleKeyDown: handleSearchKeyDown, getItemProps } = useSearchNavigation(
    searchResults,
    handleProductSelect, // Changed from handleAddProduct to handleProductSelect
    { resetOnSelect: true, searchInputRef }
  );

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

  const handleDeleteLine = async (lineId: number) => {
      const confirmed = await confirm({
        title: 'Retirer le produit',
        message: 'Retirer ce produit de l\'inventaire ?',
        variant: 'warning',
        confirmText: 'Retirer'
      })
      if (!confirmed) return;
      try {
          await axios.delete(`${lignesEndpoint}${lineId}/`);
          setLignes(prev => prev.filter(l => l.id !== lineId));
      } catch (err) {
          console.error("Erreur suppression ligne", err);
          toast.error("Impossible de supprimer la ligne.");
      }
  };

  const handleValidate = async () => {
      if (!activeInventaire) return;
      const confirmed = await confirm({
        title: 'Valider l\'inventaire',
        message: 'Valider l\'inventaire ?\n\nCela mettra à jour le stock de tous les produits listés.',
        variant: 'info',
        confirmText: 'Valider'
      })
      if (!confirmed) return;

      try {
          setSaving(true);
          await axios.post(`${inventairesEndpoint}${activeInventaire.id}/validate/`);
          toast.success("Inventaire validé avec succès !");
          setViewMode('LIST');
          fetchInventaires();
      } catch (err) {
          toast.error("Erreur lors de la validation");
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
           toast.success("En-tête sauvegardé");
      } catch(err) {
          toast.error("Erreur sauvegarde");
      }
  };

  const handlePrintEtat = () => {
      if (!activeInventaire) return;
      // Open PDF in new tab
      const url = `${inventairesEndpoint}${activeInventaire.id}/imprimer_etat/`;
      window.open(url, '_blank');
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
                      <table className="table table-xs">
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
                                      <td>{new Date(inv.date).toLocaleDateString('fr-FR')}</td>
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
                       <button 
                         className="btn btn-primary" 
                         onClick={handlePrintEtat}
                         disabled={!activeInventaire?.id}
                       >
                           🖨️ Imprimer Etat
                       </button>

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
                              <li key={p.id}>
                                  <a 
                                      {...getItemProps(idx)}
                                      onClick={() => handleProductSelect(p)}
                                      className={`flex justify-between ${getItemProps(idx).className}`}
                                  >
                                      <span>{p.name} <span className="text-xs opacity-50">({p.cip1})</span></span>
                                      <span className="badge badge-sm">Stock: {p.stock} {p.use_lot_management ? '(Lots)' : ''}</span>
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
                  <table className="table table-zebra w-full table-xs">
                      <thead>
                          <tr>
                              <th>Produit</th>
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
                          {lignes.map((ligne, _index) => {
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
                                      {ligne.lot_numero && (
                                           <div className="text-xs text-blue-600 font-mono mt-1">
                                               LOT: {ligne.lot_numero} (Exp: {ligne.lot_expiration})
                                           </div>
                                      )}
                                  </td>
                                  <td className="text-xs">{typeof ligne.produit === 'object' ? ligne.produit.rayon_name : ligne.produit_rayon}</td>
                                  <td className="text-right text-xs">{price.toLocaleString()} F</td>
                                  <td className="text-center font-bold opacity-70">{ligne.stock_theorique}</td>
                                  
                                  <td className="text-center p-1">
                                      {isReadOnly ? (
                                          <span className="font-bold">{ligne.quantite_physique}</span>
                                      ) : (
                                          <input 
                                              id={`qty-input-${lignes.indexOf(ligne)}`}
                                              type="text" 
                                              inputMode="numeric"
                                              className="input input-bordered input-xs w-24 text-center font-bold"
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
                                      <span className={`badge ${ligne.ecart < 0 ? 'badge-error' : ligne.ecart > 0 ? 'badge-success' : 'badge-ghost'} badge-sm`}>
                                          {ligne.ecart > 0 ? '+' : ''}{ligne.ecart}
                                      </span>
                                  </td>
                                  <td className={`text-right font-bold text-xs ${ecartValeur < 0 ? 'text-error' : ecartValeur > 0 ? 'text-success' : ''}`}>
                                      {ecartValeur.toLocaleString()} F
                                  </td>
                                  {!isReadOnly && (
                                      <td>
                                          <button 
                                            className="btn btn-ghost btn-xs text-error h-6 min-h-0"
                                            onClick={() => handleDeleteLine(ligne.id)}
                                            tabIndex={-1}
                                          >
                                            🗑️
                                          </button>
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

          {/* Lot Selection Modal */}
          {showLotModal && (
              <dialog className="modal modal-open">
                  <div className="modal-box">
                      <h3 className="font-bold text-lg">Sélectionner un Lot</h3>
                      <p className="py-2 text-sm text-gray-500">Pour: {selectedProductForLot?.name}</p>
                      
                      <div className="py-4">
                          {loadingLots ? (
                              <div className="flex justify-center"><span className="loading loading-spinner"></span></div>
                          ) : availableLots.length === 0 ? (
                              <div className="text-center text-gray-500">
                                  Aucun lot trouvé. 
                                  <br/>
                                  <button 
                                      className="btn btn-sm btn-outline mt-2" 
                                      onClick={() => handleAddProduct(selectedProductForLot!)}
                                  >
                                      Ajouter sans lot (Stock global)
                                  </button>
                              </div>
                          ) : (
                              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                                  {availableLots.map(lot => (
                                      <button 
                                          key={lot.id} 
                                          className="btn btn-outline justify-between h-auto py-2"
                                          onClick={() => handleLotSelection(lot.id)}
                                      >
                                          <div className="text-left">
                                              <div className="font-bold">Lot: {lot.lot || 'N/A'}</div>
                                              <div className="text-xs">Exp: {lot.date_expiration || 'N/A'}</div>
                                          </div>
                                          <div className="text-right">
                                              <div className="badge badge-ghost">Reste: {lot.quantity_remaining}</div>
                                          </div>
                                      </button>
                                  ))}
                              </div>
                          )}
                      </div>

                      <div className="modal-action justify-between">
                          <button 
                              className="btn btn-ghost" 
                              onClick={() => { setShowLotModal(false); setSelectedProductForLot(null); }}
                          >
                              Annuler
                          </button>
                          {availableLots.length > 0 && (
                             <button 
                                 className="btn btn-ghost btn-xs"
                                 onClick={() => handleAddProduct(selectedProductForLot!)}
                             >
                                 Ajouter sans lot (Hors lots)
                             </button>
                          )}
                      </div>
                  </div>
              </dialog>
          )}

      </div>
  );
}
