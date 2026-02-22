import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { safeStorage } from '../utils/storage';
import { toast } from 'react-hot-toast';
import { useConfirm } from '../hooks/useConfirm';
import type { Groupe, ProduitModel } from '../types';
import ImportProductsModal from './products/ImportProductsModal';
import PremiumModal from './common/PremiumModal';

interface ScopedProduit extends ProduitModel {
  // Add any extra fields if needed for UI
}

export default function Groupes() {
  const confirm = useConfirm()
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroupe, setSelectedGroupe] = useState<Groupe | null>(null);
  
  // Products state
  const [products, setProducts] = useState<ScopedProduit[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  
  // Groupe Form State
  const [editingGroupe, setEditingGroupe] = useState<Groupe | null>(null);
  const [formData, setFormData] = useState({ nom: '', description: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Add Product Modal State
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ScopedProduit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),
    []
  );

  // --- Fetch Data ---

  const fetchGroupes = async () => {
    try {
      setLoading(true);
      const token = safeStorage.getItem('authToken');
      const res = await axios.get(`${apiBaseUrl}/api/groupes/`, {
        headers: { Authorization: `Token ${token}` }
      });
      const data = res.data.results || res.data;
      setGroupes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching groupes:", err);
      toast.error("Erreur lors du chargement des groupes");
      setGroupes([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductsForGroupe = async (groupeId: number) => {
    try {
      setProductsLoading(true);
      const token = safeStorage.getItem('authToken');
      // Using search param logic or maybe we need to filter on client side if API doesn't support specific filter yet?
      // But standard ModelViewSet filterset_fields usually works if configured.
      // We didn't enable filterset_fields in GroupeViewSet explicitly for 'produits' (reverse) but we can filter products by 'groupe'.
      // API call should be to /api/produits/?groupe=ID
      const res = await axios.get(`${apiBaseUrl}/api/produits/?groupe=${groupeId}`, {
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
    fetchGroupes();
  }, [apiBaseUrl]);

  useEffect(() => {
    if (selectedGroupe) {
      fetchProductsForGroupe(selectedGroupe.id);
    } else {
      setProducts([]);
    }
  }, [selectedGroupe, apiBaseUrl]);

  // --- Groupe Management ---

  const handleSubmitGroupe = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = safeStorage.getItem('authToken');
    
    const payload = {
      nom: formData.nom,
      description: formData.description
    };

    try {
      if (editingGroupe) {
        await axios.put(`${apiBaseUrl}/api/groupes/${editingGroupe.id}/`, payload, {
          headers: { Authorization: `Token ${token}` }
        });
        toast.success("Groupe modifié");
      } else {
        await axios.post(`${apiBaseUrl}/api/groupes/`, payload, {
          headers: { Authorization: `Token ${token}` }
        });
        toast.success("Groupe créé");
      }
      closeModal();
      fetchGroupes();
    } catch (err) {
      console.error("Error saving groupe:", err);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleDeleteGroupe = async (id: number) => {
    const confirmed = await confirm({
      title: 'Supprimer le groupe',
      message: 'Attention: Supprimer un groupe ne supprime pas les produits, ils seront "Sans groupe". Continuer ?',
      variant: 'danger',
      confirmText: 'Supprimer'
    })
    if (!confirmed) return;
    
    const token = safeStorage.getItem('authToken');
    try {
      await axios.delete(`${apiBaseUrl}/api/groupes/${id}/`, {
        headers: { Authorization: `Token ${token}` }
      });
      toast.success("Groupe supprimé");
      if (selectedGroupe?.id === id) setSelectedGroupe(null);
      fetchGroupes();
    } catch (err) {
      console.error("Error deleting groupe:", err);
      toast.error("Erreur lors de la suppression");
    }
  };

  const openModal = (groupe?: Groupe) => {
    if (groupe) {
      setEditingGroupe(groupe);
      setFormData({ 
        nom: groupe.nom, 
        description: groupe.description || '' 
      });
    } else {
      setEditingGroupe(null);
      setFormData({ nom: '', description: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingGroupe(null);
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
      // Filter out products already in this groupe
      const currentIds = new Set(products.map(p => p.id));
      const results = (res.data.results || res.data).filter((p: ProduitModel) => !currentIds.has(p.id));
      setSearchResults(results);
    } catch (err) {
      console.error("Error searching products:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddProductToGroupe = async (product: ProduitModel) => {
    if (!selectedGroupe) return;

    // Check if product is already in another groupe
    if (product.groupe && product.groupe !== selectedGroupe.id) {
        const confirmed = await confirm({
            title: 'Déplacer le produit ?',
            message: `Le produit "${product.name}" est déjà dans le groupe "${product.groupe_nom}". Voulez-vous le déplacer vers "${selectedGroupe.nom}" ?`,
            variant: 'warning',
            confirmText: 'Déplacer',
            cancelText: 'Annuler'
        });
        if (!confirmed) return;
    }

    try {
      const token = safeStorage.getItem('authToken');
      // Update product's groupe
      await axios.patch(`${apiBaseUrl}/api/produits/${product.id}/`, {
        groupe: selectedGroupe.id
      }, {
        headers: { Authorization: `Token ${token}` }
      });
      
      toast.success(`${product.name} ajouté à ${selectedGroupe.nom}`);
      setSearchResults(prev => prev.filter(p => p.id !== product.id));
      fetchProductsForGroupe(selectedGroupe.id); // Refresh list
    } catch (err) {
      console.error("Error adding product to groupe:", err);
      toast.error("Erreur lors de l'ajout du produit");
    }
  };

  const handleRemoveProductFromGroupe = async (product: ProduitModel) => {
    if (!selectedGroupe) return;
    
    const confirmed = await confirm({
      title: 'Retirer le produit',
      message: `Retirer "${product.name}" du groupe "${selectedGroupe.nom}" ? Le produit ne sera pas supprimé, juste détaché de ce groupe.`,
      variant: 'warning',
      confirmText: 'Retirer'
    });
    if (!confirmed) return;

    try {
      const token = safeStorage.getItem('authToken');
      // Set groupe to null
      await axios.patch(`${apiBaseUrl}/api/produits/${product.id}/`, {
        groupe: null
      }, {
        headers: { Authorization: `Token ${token}` }
      });
      
      toast.success("Produit retiré du groupe");
      fetchProductsForGroupe(selectedGroupe.id); // Refresh list
    } catch (err) {
      console.error("Error removing product from groupe:", err);
      toast.error("Erreur lors du retrait du produit");
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* LEFT PANEL: GROUPES LIST */}
      <div className="w-1/3 border-r border-base-200 bg-base-100 flex flex-col">
        <div className="p-4 border-b border-base-200 flex justify-between items-center bg-base-100 relative z-10">
          <h2 className="font-bold text-lg">Groupes</h2>
          <div className="flex gap-2">
            <button 
              className="btn btn-sm btn-ghost"
              onClick={() => setIsImporting(true)}
              title="Importer Catalogue CSV/Excel"
            >
              📂 Importer
            </button>
            <button onClick={() => openModal()} className="btn btn-sm btn-primary">
              + Créer
            </button>
          </div>
          {isImporting && (
             <ImportProductsModal
               onClose={() => setIsImporting(false)}
               onSuccess={() => {
                 fetchGroupes();
                 if (selectedGroupe) fetchProductsForGroupe(selectedGroupe.id);
                 toast.success("Catalogue importé");
               }}
             />
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
           {loading ? (
             <div className="flex justify-center p-8"><span className="loading loading-spinner"></span></div>
           ) : groupes.length === 0 ? (
             <div className="text-center p-8 text-base-content/50">Aucun groupe</div>
           ) : (
             <ul className="menu bg-base-100 w-full rounded-box">
                {groupes.map(groupe => (
                  <li key={groupe.id} className="mb-1">
                    <a 
                      className={`flex justify-between items-center ${selectedGroupe?.id === groupe.id ? 'active' : ''}`}
                      onClick={() => setSelectedGroupe(groupe)}
                    >
                       <span className="flex items-center gap-2">
                          📂 {groupe.nom}
                       </span>
                       <div className="flex gap-1 opacity-60 hover:opacity-100">
                          <button 
                            className="btn btn-xs btn-ghost btn-square"
                            onClick={(e) => { e.stopPropagation(); openModal(groupe); }}
                          >
                            ✏️
                          </button>
                          <button 
                            className="btn btn-xs btn-ghost btn-square text-error"
                            onClick={(e) => { e.stopPropagation(); handleDeleteGroupe(groupe.id); }}
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
         {selectedGroupe ? (
            <>
              <div className="p-6 border-b border-base-200 bg-base-100 shadow-sm flex justify-between items-center">
                 <div>
                    <h2 className="text-2xl font-bold">{selectedGroupe.nom}</h2>
                    <p className="text-sm opacity-60">
                        {selectedGroupe.description}
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
                       <p className="text-lg">Ce groupe est vide</p>
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
                                    data-tip="Retirer du groupe"
                                    onClick={() => handleRemoveProductFromGroupe(p)}
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
               <svg className="w-24 h-24 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
               <p className="text-xl font-medium">Sélectionnez un groupe</p>
               <p className="text-sm">Gérez les groupes de produits</p>
            </div>
         )}
      </div>

      {/* MODAL: CREATE/EDIT GROUPE */}
      <PremiumModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingGroupe ? 'Modifier le groupe' : 'Nouveau groupe'}
        gradientFrom="primary/20"
        gradientTo="secondary/20"
        icon={editingGroupe ? <span>✏️</span> : <span>📂</span>}
      >
        <form onSubmit={handleSubmitGroupe} className="p-6">
          <div className="form-control w-full mb-4">
            <label className="label"><span className="label-text font-semibold">Nom du groupe</span></label>
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


      {/* MODAL: ADD PRODUCT TO GROUPE */}
      <PremiumModal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        title={`Ajouter des produits à "${selectedGroupe?.nom}"`}
        subtitle="Recherchez des produits et cliquez sur le + pour les associer à ce groupe."
        maxWidth="max-w-3xl"
        icon={<span>➕</span>}
        gradientFrom="primary/10"
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
                         <th>Groupe Actuel</th>
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
                                {p.groupe_nom ? (
                                   <span className="badge badge-sm badge-ghost">{p.groupe_nom}</span>
                                ) : (
                                   <span className="text-xs opacity-40 italic">Aucun</span>
                                )
                                }
                             </td>
                             <td className="text-right">
                                <button 
                                  className="btn btn-sm btn-circle btn-primary btn-outline"
                                  onClick={() => handleAddProductToGroupe(p)}
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
