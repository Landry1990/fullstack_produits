import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { safeStorage } from '../utils/storage';
import { toast } from 'react-hot-toast';
import { useConfirm } from '../hooks/useConfirm';
import type { Rayon, ProduitModel } from '../types';
import PremiumModal from './common/PremiumModal';

interface ScopedProduit extends ProduitModel {
  // Add any extra fields if needed for UI
}

export default function Categories() {
  const { t } = useTranslation();
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
      toast.error(t('rayons.messages.load_error'));
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
      toast.error(t('rayons.messages.load_products_error'));
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
        toast.success(t('rayons.messages.save_success_edit'));
      } else {
        await axios.post(`${apiBaseUrl}/api/categories/`, payload, {
          headers: { Authorization: `Token ${token}` }
        });
        toast.success(t('rayons.messages.save_success_create'));
      }
      closeModal();
      fetchRayons();
    } catch (err) {
      console.error("Error saving rayon:", err);
      toast.error(t('rayons.messages.save_error'));
    }
  };

  const handleDeleteRayon = async (id: number) => {
    const confirmed = await confirm({
      title: t('rayons.messages.delete_confirm_title'),
      message: t('rayons.messages.delete_confirm_message_detailed'),
      variant: 'danger',
      confirmText: t('rayons.messages.delete_btn')
    })
    if (!confirmed) return;
    
    const token = safeStorage.getItem('authToken');
    try {
      await axios.delete(`${apiBaseUrl}/api/categories/${id}/`, {
        headers: { Authorization: `Token ${token}` }
      });
      toast.success(t('rayons.messages.delete_success'));
      if (selectedRayon?.id === id) setSelectedRayon(null);
      fetchRayons();
    } catch (err) {
      console.error("Error deleting rayon:", err);
      toast.error(t('rayons.messages.delete_error'));
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
      
      toast.success(t('rayons.messages.product_added_to', { product: product.name, rayon: selectedRayon.name }));
      setSearchResults(prev => prev.filter(p => p.id !== product.id));
      fetchProductsForRayon(selectedRayon.id); // Refresh list
    } catch (err) {
      console.error("Error adding product to rayon:", err);
      toast.error(t('rayons.messages.add_product_error'));
    }
  };

  const handleRemoveProductFromRayon = async (product: ProduitModel) => {
    if (!selectedRayon) return;
    
    const confirmed = await confirm({
      title: t('rayons.remove_product_title'),
      message: t('rayons.remove_product_message', { product: product.name, rayon: selectedRayon.name }),
      variant: 'warning',
      confirmText: t('rayons.remove_btn')
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
      
      toast.success(t('rayons.messages.product_removed'));
      fetchProductsForRayon(selectedRayon.id); // Refresh list
    } catch (err) {
      console.error("Error removing product from rayon:", err);
      toast.error(t('rayons.messages.remove_product_error'));
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
          <h2 className="font-bold text-lg">{t('sidebar.stock.rayons')}</h2>
          <button onClick={() => openModal()} className="btn btn-sm btn-primary">
            + {t('rayons.create_btn')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
           {loading ? (
             <div className="flex justify-center p-8"><span className="loading loading-spinner"></span></div>
           ) : hierarchy.length === 0 ? (
             <div className="text-center p-8 text-base-content/50">{t('rayons.no_rayon')}</div>
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
                        {productsLoading ? t('common.loading') : t('rayons.count_products', { count: products.length })}
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
                       ➕ {t('rayons.add_products_btn')}
                    </button>
                 </div>
              </div>

              <div className="flex-1 overflow-auto p-6">
                 {productsLoading ? (
                    <div className="text-center p-12"><span className="loading loading-spinner loading-lg"></span></div>
                 ) : products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-base-content/40">
                       <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                       <p className="text-lg">{t('rayons.empty_rayon')}</p>
                       <button 
                          className="btn btn-ghost mt-2"
                          onClick={() => {
                            setProductSearchTerm('');
                            setSearchResults([]);
                            setIsAddProductModalOpen(true);
                          }}
                        >
                          {t('rayons.add_existing_product')}
                       </button>
                    </div>
                 ) : (
                    <div className="overflow-x-auto bg-base-100 rounded-box shadow">
                      <table className="table table-zebra w-full">
                        <thead>
                          <tr>
                            <th>{t('rayons.table.product')}</th>
                            <th>{t('rayons.table.cip')}</th>
                            <th className="text-right">{t('rayons.table.stock')}</th>
                            <th className="text-right">{t('rayons.table.price')}</th>
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
                                    data-tip={t('rayons.remove_from_rayon')}
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
               <p className="text-xl font-medium">{t('rayons.select_rayon')}</p>
               <p className="text-sm">{t('rayons.manage_rayons_hint')}</p>
            </div>
         )}
      </div>

      {/* MODAL: CREATE/EDIT CATEGORY */}
      <PremiumModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingRayon ? t('rayons.modal.title_edit') : t('rayons.modal.title_new')}
        gradientFrom="primary/20"
        gradientTo="accent/20"
        icon={editingRayon ? <span>✏️</span> : <span>📁</span>}
      >
        <form onSubmit={handleSubmitRayon} className="p-6">
          <div className="form-control w-full mb-4">
            <label className="label"><span className="label-text font-semibold">{t('rayons.modal.name')}</span></label>
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
            <label className="label"><span className="label-text font-semibold">{t('rayons.modal.parent')}</span></label>
            <select 
              className="select select-bordered w-full"
              value={formData.parent}
              onChange={e => setFormData({...formData, parent: e.target.value})}
            >
              <option value="">{t('rayons.modal.none')}</option>
              {availableParents.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-ghost" onClick={closeModal}>{t('rayons.modal.cancel')}</button>
            <button type="submit" className="btn btn-primary px-8">{t('rayons.modal.save')}</button>
          </div>
        </form>
      </PremiumModal>


      {/* MODAL: ADD PRODUCT TO CATEGORY */}
      <PremiumModal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        title={t('rayons.add_product_to', { rayon: selectedRayon?.name })}
        subtitle={t('rayons.add_product_help')}
        maxWidth="max-w-3xl"
        icon={<span>➕</span>}
        gradientFrom="primary/10"
        gradientTo="accent/10"
      >
        <div className="p-6 flex flex-col h-[500px]">
          <div className="form-control mb-4">
             <input 
               type="text" 
               placeholder={t('rayons.search_placeholder')}
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
                         <th>{t('rayons.table.product')}</th>
                         <th>{t('rayons.table.current_rayon')}</th>
                         <th className="text-right">{t('rayons.table.action')}</th>
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
                                   <span className="text-xs opacity-40 italic">{t('rayons.table.none')}</span>
                                )
                                }
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
                 <div className="text-center p-8 text-base-content/50">{t('rayons.no_product_found')}</div>
              ) : (
                 <div className="text-center p-8 text-base-content/50 italic">{t('rayons.search_hint')}</div>
              )}
          </div>

          <div className="mt-6 flex justify-end">
             <button className="btn btn-ghost px-8" onClick={() => setIsAddProductModalOpen(false)}>{t('common.close')}</button>
          </div>
        </div>
      </PremiumModal>


    </div>
  );
}
