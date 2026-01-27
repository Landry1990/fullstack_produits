import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { safeStorage } from '../utils/storage';
import { toast } from 'react-hot-toast';
import { useConfirm } from '../hooks/useConfirm';
import type { Rayon, ProduitModel } from '../types';

interface ScopedProduit extends ProduitModel {
  // Add any extra fields if needed for UI
}

export default function Categories() {
  const confirm = useConfirm()
  const [rayons, setRayons] = useState<Rayon[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRayon, setSelectedRayon] = useState<Rayon | null>(null);
  
  // Products state
  const [products, setProducts] = useState<ScopedProduit[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  
  // Category Form State
  const [editingRayon, setEditingRayon] = useState<Rayon | null>(null);
  const [formData, setFormData] = useState({ name: '', parent: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Add Product Modal State
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ScopedProduit[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),
    []
  );

  // --- Fetch Data ---

  const fetchRayons = async () => {
    try {
      setLoading(true);
      const token = safeStorage.getItem('authToken');
      const res = await axios.get(`${apiBaseUrl}/api/categories/`, {
        headers: { Authorization: `Token ${token}` }
      });
      const data = res.data.results || res.data;
      setRayons(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching rayons:", err);
      toast.error("Erreur lors du chargement des rayons");
      setRayons([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductsForRayon = async (rayonId: number) => {
    try {
      setProductsLoading(true);
      const token = safeStorage.getItem('authToken');
      const res = await axios.get(`${apiBaseUrl}/api/produits/?rayon=${rayonId}`, {
         headers: { Authorization: `Token ${token}` }
      });
      const data = res.data.results || res.data;
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching products:", err);
      toast.error("Erreur lors du chargement des produits");
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    fetchRayons();
  }, [apiBaseUrl]);

  useEffect(() => {
    if (selectedRayon) {
      fetchProductsForRayon(selectedRayon.id);
    } else {
      setProducts([]);
    }
  }, [selectedRayon, apiBaseUrl]);

  // --- Category Management ---

  const handleSubmitRayon = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = safeStorage.getItem('authToken');
    
    const payload: any = {
      name: formData.name,
      parent: formData.parent ? parseInt(formData.parent) : null
    };

    try {
      if (editingRayon) {
        await axios.put(`${apiBaseUrl}/api/categories/${editingRayon.id}/`, payload, {
          headers: { Authorization: `Token ${token}` }
        });
        toast.success("Rayon modifié");
      } else {
        await axios.post(`${apiBaseUrl}/api/categories/`, payload, {
          headers: { Authorization: `Token ${token}` }
        });
        toast.success("Rayon créé");
      }
      closeModal();
      fetchRayons();
    } catch (err) {
      console.error("Error saving rayon:", err);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleDeleteRayon = async (id: number) => {
    const confirmed = await confirm({
      title: 'Supprimer le rayon',
      message: 'Attention: Supprimer un rayon ne supprime pas les produits, ils seront "Sans rayon". Continuer ?',
      variant: 'danger',
      confirmText: 'Supprimer'
    })
    if (!confirmed) return;
    
    const token = safeStorage.getItem('authToken');
    try {
      await axios.delete(`${apiBaseUrl}/api/categories/${id}/`, {
        headers: { Authorization: `Token ${token}` }
      });
      toast.success("Rayon supprimé");
      if (selectedRayon?.id === id) setSelectedRayon(null);
      fetchRayons();
    } catch (err) {
      console.error("Error deleting rayon:", err);
      toast.error("Erreur lors de la suppression");
    }
  };

  const openModal = (rayon?: Rayon) => {
    if (rayon) {
      setEditingRayon(rayon);
      setFormData({ 
        name: rayon.name, 
        parent: rayon.parent ? rayon.parent.toString() : '' 
      });
    } else {
      setEditingRayon(null);
      setFormData({ name: '', parent: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRayon(null);
    setFormData({ name: '', parent: '' });
  };

  // --- Product Management ---

  const handleSearchProducts = async (term: string) => {
    setProductSearchTerm(term);
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const token = safeStorage.getItem('authToken');
      const res = await axios.get(`${apiBaseUrl}/api/produits/?search=${term}`, {
        headers: { Authorization: `Token ${token}` }
      });
      // Filter out products already in this rayon
      const currentIds = new Set(products.map(p => p.id));
      const results = (res.data.results || res.data).filter((p: ProduitModel) => !currentIds.has(p.id));
      setSearchResults(results);
    } catch (err) {
      console.error("Error searching products:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddProductToRayon = async (product: ProduitModel) => {
    if (!selectedRayon) return;
    try {
      const token = safeStorage.getItem('authToken');
      // Update product's rayon
      await axios.patch(`${apiBaseUrl}/api/produits/${product.id}/`, {
        rayon: selectedRayon.id
      }, {
        headers: { Authorization: `Token ${token}` }
      });
      
      toast.success(`${product.name} ajouté à ${selectedRayon.name}`);
      setSearchResults(prev => prev.filter(p => p.id !== product.id));
      fetchProductsForRayon(selectedRayon.id); // Refresh list
    } catch (err) {
      console.error("Error adding product to rayon:", err);
      toast.error("Erreur lors de l'ajout du produit");
    }
  };

  const handleRemoveProductFromRayon = async (product: ProduitModel) => {
    if (!selectedRayon) return;
    
    const confirmed = await confirm({
      title: 'Retirer le produit',
      message: `Retirer "${product.name}" du rayon "${selectedRayon.name}" ? Le produit ne sera pas supprimé, juste détaché de ce rayon.`,
      variant: 'warning',
      confirmText: 'Retirer'
    });
    if (!confirmed) return;

    try {
      const token = safeStorage.getItem('authToken');
      // Set rayon to null
      await axios.patch(`${apiBaseUrl}/api/produits/${product.id}/`, {
        rayon: null
      }, {
        headers: { Authorization: `Token ${token}` }
      });
      
      toast.success("Produit retiré du rayon");
      fetchProductsForRayon(selectedRayon.id); // Refresh list
    } catch (err) {
      console.error("Error removing product from rayon:", err);
      toast.error("Erreur lors du retrait du produit");
    }
  };

  // --- Logic for Hierarchy ---
  const hierarchy = useMemo(() => {
    const parents = rayons.filter(r => !r.parent);
    const children = rayons.filter(r => r.parent);
    
    return parents.map(parent => ({
      ...parent,
      subRayons: children.filter(c => c.parent === parent.id)
    }));
  }, [rayons]);

  const availableParents = rayons.filter(r => !editingRayon || r.id !== editingRayon.id);


  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* LEFT PANEL: CATEGORIES LIST */}
      <div className="w-1/3 border-r border-base-200 bg-base-100 flex flex-col">
        <div className="p-4 border-b border-base-200 flex justify-between items-center bg-base-100 relative z-10">
          <h2 className="font-bold text-lg">Rayons</h2>
          <button onClick={() => openModal()} className="btn btn-sm btn-primary">
            + Créer
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
           {loading ? (
             <div className="flex justify-center p-8"><span className="loading loading-spinner"></span></div>
           ) : hierarchy.length === 0 ? (
             <div className="text-center p-8 text-base-content/50">Aucun rayon</div>
           ) : (
             <ul className="menu bg-base-100 w-full rounded-box">
                {hierarchy.map(parent => (
                  <li key={parent.id} className="mb-1">
                    <details open>
                      <summary 
                        className={`font-semibold ${selectedRayon?.id === parent.id ? 'active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault(); // Prevent details toggle when clicking the main area if needed, but we usually want generic behavior. 
                          // Actually for 'details > summary' click behavior is specific.
                          // Let's make the row selectable and have action buttons separate.
                          setSelectedRayon(parent);
                        }}
                      >
                         <div className="flex items-center justify-between w-full">
                            <span className="flex items-center gap-2">
                               📁 {parent.name}
                            </span>
                            <div className="flex gap-1">
                               <button 
                                 className="btn btn-xs btn-ghost btn-square"
                                 onClick={(e) => { e.stopPropagation(); openModal(parent); }}
                               >
                                 ✏️
                               </button>
                               <button 
                                 className="btn btn-xs btn-ghost btn-square text-error"
                                 onClick={(e) => { e.stopPropagation(); handleDeleteRayon(parent.id); }}
                               >
                                 🗑️
                               </button>
                            </div>
                         </div>
                      </summary>
                      <ul>
                        {parent.subRayons.map(child => (
                           <li key={child.id}>
                             <a 
                               className={`flex justify-between items-center ${selectedRayon?.id === child.id ? 'active' : ''}`}
                               onClick={() => setSelectedRayon(child)}
                             >
                                <span className="flex items-center gap-2">
                                  📄 {child.name}
                                </span>
                                <div className="flex gap-1 opacity-60 hover:opacity-100">
                                   <button 
                                     className="btn btn-xs btn-ghost btn-square"
                                     onClick={(e) => { e.stopPropagation(); openModal(child); }}
                                   >
                                     ✏️
                                   </button>
                                   <button 
                                     className="btn btn-xs btn-ghost btn-square text-error"
                                     onClick={(e) => { e.stopPropagation(); handleDeleteRayon(child.id); }}
                                   >
                                     🗑️
                                   </button>
                                </div>
                             </a>
                           </li>
                        ))}
                        {/* Empty placeholder to add sub-rayon easily? Or just use main create button with parent selection */}
                      </ul>
                    </details>
                  </li>
                ))}
             </ul>
           )}
        </div>
      </div>

      {/* RIGHT PANEL: PRODUCTS LIST */}
      <div className="w-2/3 bg-base-50 flex flex-col">
         {selectedRayon ? (
            <>
              <div className="p-6 border-b border-base-200 bg-base-100 shadow-sm flex justify-between items-center">
                 <div>
                    <h2 className="text-2xl font-bold">{selectedRayon.name}</h2>
                    <p className="text-sm opacity-60">
                        {productsLoading ? 'Chargement...' : `${products.length} produit(s)`}
                    </p>
                 </div>
                 <div className="flex gap-2">
                    <button 
                      className="btn btn-primary gap-2"
                      onClick={() => {
                        setProductSearchTerm('');
                        setSearchResults([]);
                        setIsAddProductModalOpen(true);
                      }}
                    >
                       ➕ Ajouter des produits
                    </button>
                 </div>
              </div>

              <div className="flex-1 overflow-auto p-6">
                 {productsLoading ? (
                    <div className="text-center p-12"><span className="loading loading-spinner loading-lg"></span></div>
                 ) : products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-base-content/40">
                       <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                       <p className="text-lg">Ce rayon est vide</p>
                       <button 
                          className="btn btn-ghost mt-2"
                          onClick={() => {
                            setProductSearchTerm('');
                            setSearchResults([]);
                            setIsAddProductModalOpen(true);
                          }}
                        >
                          Ajouter un produit existant
                       </button>
                    </div>
                 ) : (
                    <div className="overflow-x-auto bg-base-100 rounded-box shadow">
                      <table className="table table-zebra w-full">
                        <thead>
                          <tr>
                            <th>Produit</th>
                            <th>CIP</th>
                            <th className="text-right">Stock</th>
                            <th className="text-right">Prix</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                           {products.map(p => (
                             <tr key={p.id}>
                               <td>
                                 <div className="font-bold">{p.name}</div>
                                 <div className="text-xs opacity-50">{p.description && p.description.substring(0, 30)}</div>
                               </td>
                               <td className="font-mono text-xs">{p.cip1 || '-'}</td>
                               <td className={`text-right font-bold ${p.stock <= p.stock_alert ? 'text-error' : ''}`}>
                                  {p.stock}
                               </td>
                               <td className="text-right">{parseFloat(p.selling_price).toLocaleString()} F</td>
                               <td>
                                  <button 
                                    className="btn btn-ghost btn-xs text-error tooltip tooltip-left"
                                    data-tip="Retirer du rayon"
                                    onClick={() => handleRemoveProductFromRayon(p)}
                                  >
                                    ✕
                                  </button>
                               </td>
                             </tr>
                           ))}
                        </tbody>
                      </table>
                    </div>
                 )}
              </div>
            </>
         ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-base-content/30 bg-base-200/50">
               <svg className="w-24 h-24 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
               <p className="text-xl font-medium">Sélectionnez un rayon</p>
               <p className="text-sm">Gérez les rayons et associez des produits</p>
            </div>
         )}
      </div>

      {/* MODAL: CREATE/EDIT CATEGORY */}
      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">{editingRayon ? 'Modifier le rayon' : 'Nouveau rayon'}</h3>
            <form onSubmit={handleSubmitRayon}>
              <div className="form-control w-full mb-4">
                <label className="label"><span className="label-text">Nom du rayon</span></label>
                <input 
                  type="text" 
                  className="input input-bordered w-full" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                  autoFocus
                />
              </div>
              
              <div className="form-control w-full mb-6">
                <label className="label"><span className="label-text">Rayon Parent (Optionnel)</span></label>
                <select 
                  className="select select-bordered w-full"
                  value={formData.parent}
                  onChange={e => setFormData({...formData, parent: e.target.value})}
                >
                  <option value="">Aucun (Racine)</option>
                  {availableParents.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="modal-action">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={closeModal}></div>
        </div>
      )}

      {/* MODAL: ADD PRODUCT TO CATEGORY */}
      {isAddProductModalOpen && (
         <div className="modal modal-open">
           <div className="modal-box w-11/12 max-w-3xl h-[600px] flex flex-col">
              <h3 className="font-bold text-lg mb-2">Ajouter des produits à "{selectedRayon?.name}"</h3>
              <p className="text-sm opacity-60 mb-4">Recherchez des produits et cliquez sur le <b>+</b> pour les associer à ce rayon.</p>
              
              <div className="form-control mb-4">
                 <input 
                   type="text" 
                   placeholder="Rechercher par nom ou CIP..." 
                   className="input input-bordered w-full"
                   value={productSearchTerm}
                   onChange={e => handleSearchProducts(e.target.value)}
                   autoFocus
                 />
              </div>

              <div className="flex-1 overflow-auto bg-base-200 rounded-lg p-2 border border-base-300">
                  {isSearching ? (
                     <div className="text-center p-8"><span className="loading loading-spinner"></span></div>
                  ) : searchResults.length > 0 ? (
                     <table className="table table-sm w-full bg-base-100">
                        <thead>
                           <tr>
                             <th>Produit</th>
                             <th>Rayon Actuel</th>
                             <th className="text-right">Action</th>
                           </tr>
                        </thead>
                        <tbody>
                           {searchResults.map(p => (
                              <tr key={p.id} className="hover">
                                 <td>
                                    <div className="font-bold">{p.name}</div>
                                    <div className="text-xs opacity-50">{p.cip1} • Stock: {p.stock}</div>
                                 </td>
                                 <td>
                                    {p.rayon_name ? (
                                       <span className="badge badge-sm badge-ghost">{p.rayon_name}</span>
                                    ) : (
                                       <span className="text-xs opacity-40 italic">Aucun</span>
                                    )}
                                 </td>
                                 <td className="text-right">
                                    <button 
                                      className="btn btn-sm btn-circle btn-primary btn-outline"
                                      onClick={() => handleAddProductToRayon(p)}
                                    >
                                       +
                                    </button>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  ) : productSearchTerm.length > 1 ? (
                     <div className="text-center p-8 text-base-content/50">Aucun produit trouvé</div>
                  ) : (
                     <div className="text-center p-8 text-base-content/50">Tapez au moins 2 caractères pour rechercher</div>
                  )}
              </div>

              <div className="modal-action">
                 <button className="btn" onClick={() => setIsAddProductModalOpen(false)}>Fermer</button>
              </div>
           </div>
           <div className="modal-backdrop" onClick={() => setIsAddProductModalOpen(false)}></div>
         </div>
      )}

    </div>
  );
}
