import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { safeStorage } from '../utils/storage';
import { toast } from 'react-hot-toast';
import { useConfirm } from '../hooks/useConfirm';
import type { Forme, ProduitModel } from '../types';
import PremiumModal from './common/PremiumModal';

interface ScopedProduit extends ProduitModel {
  // Add any extra fields if needed for UI
}

export default function Formes() {
  const confirm = useConfirm()
  const [formes, setFormes] = useState<Forme[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForme, setSelectedForme] = useState<Forme | null>(null);
  
  // Products state
  const [products, setProducts] = useState<ScopedProduit[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  
  // Forme Form State
  const [editingForme, setEditingForme] = useState<Forme | null>(null);
  const [formData, setFormData] = useState({ nom: '', description: '' });
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

  const fetchFormes = async () => {
    try {
      setLoading(true);
      const token = safeStorage.getItem('authToken');
      const res = await axios.get(`${apiBaseUrl}/api/formes/`, {
        headers: { Authorization: `Token ${token}` }
      });
      const data = res.data.results || res.data;
      setFormes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching formes:", err);
      toast.error("Erreur lors du chargement des formes");
      setFormes([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductsForForme = async (formeId: number) => {
    try {
      setProductsLoading(true);
      const token = safeStorage.getItem('authToken');
      // Note: We need to ensure the backend supports filtering by forme.
      // Assuming we implemented filtering in ProduitViewSet or will do so.
      const res = await axios.get(`${apiBaseUrl}/api/produits/?forme=${formeId}`, {
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
    fetchFormes();
  }, [apiBaseUrl]);

  useEffect(() => {
    if (selectedForme) {
      fetchProductsForForme(selectedForme.id);
    } else {
      setProducts([]);
    }
  }, [selectedForme, apiBaseUrl]);

  // --- Forme Management ---

  const handleSubmitForme = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = safeStorage.getItem('authToken');
    
    const payload = {
      nom: formData.nom,
      description: formData.description
    };

    try {
      if (editingForme) {
        await axios.put(`${apiBaseUrl}/api/formes/${editingForme.id}/`, payload, {
          headers: { Authorization: `Token ${token}` }
        });
        toast.success("Forme modifiée");
      } else {
        await axios.post(`${apiBaseUrl}/api/formes/`, payload, {
          headers: { Authorization: `Token ${token}` }
        });
        toast.success("Forme créée");
      }
      closeModal();
      fetchFormes();
    } catch (err) {
      console.error("Error saving forme:", err);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleDeleteForme = async (id: number) => {
    const confirmed = await confirm({
      title: 'Supprimer la forme',
      message: 'Attention: Supprimer une forme ne supprime pas les produits, ils seront "Sans forme". Continuer ?',
      variant: 'danger',
      confirmText: 'Supprimer'
    })
    if (!confirmed) return;
    
    const token = safeStorage.getItem('authToken');
    try {
      await axios.delete(`${apiBaseUrl}/api/formes/${id}/`, {
        headers: { Authorization: `Token ${token}` }
      });
      toast.success("Forme supprimée");
      if (selectedForme?.id === id) setSelectedForme(null);
      fetchFormes();
    } catch (err) {
      console.error("Error deleting forme:", err);
      toast.error("Erreur lors de la suppression");
    }
  };

  const openModal = (forme?: Forme) => {
    if (forme) {
      setEditingForme(forme);
      setFormData({ 
        nom: forme.nom, 
        description: forme.description || '' 
      });
    } else {
      setEditingForme(null);
      setFormData({ nom: '', description: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingForme(null);
    setFormData({ nom: '', description: '' });
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
      // Filter out products already in this forme
      const currentIds = new Set(products.map(p => p.id));
      const results = (res.data.results || res.data).filter((p: ProduitModel) => !currentIds.has(p.id));
      setSearchResults(results);
    } catch (err) {
      console.error("Error searching products:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddProductToForme = async (product: ProduitModel) => {
    if (!selectedForme) return;
    try {
      const token = safeStorage.getItem('authToken');
      // Update product's forme
      await axios.patch(`${apiBaseUrl}/api/produits/${product.id}/`, {
        forme: selectedForme.id
      }, {
        headers: { Authorization: `Token ${token}` }
      });
      
      toast.success(`${product.name} ajouté à ${selectedForme.nom}`);
      setSearchResults(prev => prev.filter(p => p.id !== product.id));
      fetchProductsForForme(selectedForme.id); // Refresh list
    } catch (err) {
      console.error("Error adding product to forme:", err);
      toast.error("Erreur lors de l'ajout du produit");
    }
  };

  const handleRemoveProductFromForme = async (product: ProduitModel) => {
    if (!selectedForme) return;
    
    const confirmed = await confirm({
      title: 'Retirer le produit',
      message: `Retirer "${product.name}" de la forme "${selectedForme.nom}" ? Le produit ne sera pas supprimé, juste détaché de cette forme.`,
      variant: 'warning',
      confirmText: 'Retirer'
    });
    if (!confirmed) return;

    try {
      const token = safeStorage.getItem('authToken');
      // Set forme to null
      await axios.patch(`${apiBaseUrl}/api/produits/${product.id}/`, {
        forme: null
      }, {
        headers: { Authorization: `Token ${token}` }
      });
      
      toast.success("Produit retiré de la forme");
      fetchProductsForForme(selectedForme.id); // Refresh list
    } catch (err) {
      console.error("Error removing product from forme:", err);
      toast.error("Erreur lors du retrait du produit");
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* LEFT PANEL: FORMES LIST */}
      <div className="w-1/3 border-r border-base-200 bg-base-100 flex flex-col">
        <div className="p-4 border-b border-base-200 flex justify-between items-center bg-base-100 relative z-10">
          <h2 className="font-bold text-lg">Formes</h2>
          <button onClick={() => openModal()} className="btn btn-sm btn-primary">
            + Créer
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
           {loading ? (
             <div className="flex justify-center p-8"><span className="loading loading-spinner"></span></div>
           ) : formes.length === 0 ? (
             <div className="text-center p-8 text-base-content/50">Aucune forme</div>
           ) : (
             <ul className="menu bg-base-100 w-full rounded-box">
                {formes.map(forme => (
                  <li key={forme.id} className="mb-1">
                    <a 
                      className={`flex justify-between items-center ${selectedForme?.id === forme.id ? 'active' : ''}`}
                      onClick={() => setSelectedForme(forme)}
                    >
                       <span className="flex items-center gap-2">
                          💊 {forme.nom}
                       </span>
                       <div className="flex gap-1 opacity-60 hover:opacity-100">
                          <button 
                            className="btn btn-xs btn-ghost btn-square"
                            onClick={(e) => { e.stopPropagation(); openModal(forme); }}
                          >
                            ✏️
                          </button>
                          <button 
                            className="btn btn-xs btn-ghost btn-square text-error"
                            onClick={(e) => { e.stopPropagation(); handleDeleteForme(forme.id); }}
                          >
                            🗑️
                          </button>
                       </div>
                    </a>
                  </li>
                ))}
             </ul>
           )}
        </div>
      </div>

      {/* RIGHT PANEL: PRODUCTS LIST */}
      <div className="w-2/3 bg-base-50 flex flex-col">
         {selectedForme ? (
            <>
              <div className="p-6 border-b border-base-200 bg-base-100 shadow-sm flex justify-between items-center">
                 <div>
                    <h2 className="text-2xl font-bold">{selectedForme.nom}</h2>
                    <p className="text-sm opacity-60">
                        {selectedForme.description}
                    </p>
                    <p className="text-xs opacity-50 mt-1">
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
                       <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                       <p className="text-lg">Cette forme est vide</p>
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
                                    data-tip="Retirer de la forme"
                                    onClick={() => handleRemoveProductFromForme(p)}
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
               <svg className="w-24 h-24 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
               <p className="text-xl font-medium">Sélectionnez une forme</p>
               <p className="text-sm">Gérez les formes galéniques et associez des produits</p>
            </div>
         )}
      </div>

      {/* MODAL: CREATE/EDIT FORME */}
      <PremiumModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingForme ? 'Modifier la forme' : 'Nouvelle forme'}
        gradientFrom="secondary/20"
        gradientTo="accent/20"
        icon={editingForme ? <span>✏️</span> : <span>💊</span>}
      >
        <form onSubmit={handleSubmitForme} className="p-6">
          <div className="form-control w-full mb-4">
            <label className="label"><span className="label-text font-semibold">Nom de la forme</span></label>
            <input 
              type="text" 
              className="input input-bordered w-full" 
              value={formData.nom}
              onChange={e => setFormData({...formData, nom: e.target.value})}
              required
              autoFocus
            />
          </div>
          
          <div className="form-control w-full mb-6">
            <label className="label"><span className="label-text font-semibold">Description (Optionnel)</span></label>
            <textarea 
              className="textarea textarea-bordered w-full"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-ghost" onClick={closeModal}>Annuler</button>
            <button type="submit" className="btn btn-primary px-8">Enregistrer</button>
          </div>
        </form>
      </PremiumModal>


      {/* MODAL: ADD PRODUCT TO FORME */}
      <PremiumModal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        title={`Ajouter des produits à "${selectedForme?.nom}"`}
        subtitle="Recherchez des produits et cliquez sur le + pour les associer à cette forme."
        maxWidth="max-w-3xl"
        icon={<span>➕</span>}
        gradientFrom="secondary/10"
        gradientTo="accent/10"
      >
        <div className="p-6 flex flex-col h-[500px]">
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

          <div className="flex-1 overflow-auto bg-base-200 rounded-xl p-2 border border-base-300">
              {isSearching ? (
                 <div className="text-center p-8"><span className="loading loading-spinner"></span></div>
              ) : searchResults.length > 0 ? (
                 <table className="table table-sm w-full bg-white rounded-lg overflow-hidden">
                    <thead>
                       <tr className="bg-base-100">
                         <th>Produit</th>
                         <th>Forme Actuelle</th>
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
                                {p.forme_nom ? (
                                   <span className="badge badge-sm badge-ghost">{p.forme_nom}</span>
                                ) : (
                                   <span className="text-xs opacity-40 italic">Aucune</span>
                                )
                                }
                             </td>
                             <td className="text-right">
                                <button 
                                  className="btn btn-sm btn-circle btn-primary btn-outline"
                                  onClick={() => handleAddProductToForme(p)}
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
                 <div className="text-center p-8 text-base-content/50 italic">Tapez au moins 2 caractères pour rechercher</div>
              )}
          </div>

          <div className="mt-6 flex justify-end">
             <button className="btn btn-ghost px-8" onClick={() => setIsAddProductModalOpen(false)}>Fermer</button>
          </div>
        </div>
      </PremiumModal>


    </div>
  );
}
