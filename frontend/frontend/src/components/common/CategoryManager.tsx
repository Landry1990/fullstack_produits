import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { 
  Sparkles, Pencil, Trash2, Plus, 
  Search, Package, LayoutGrid, Printer,
  Download, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { useConfirm } from '../../hooks/useConfirm';
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters';
import PremiumModal from './PremiumModal';
import SmartOrganizerModal from './SmartOrganizerModal';


interface Category {
  id: number;
  name?: string; // Rayon uses 'name'
  nom?: string;  // Forme/Groupe use 'nom'
  description?: string;
  parent?: number | null;
  parent_name?: string | null;
}

interface Product {
  id: number;
  name: string;
  cip1: string;
  stock: number;
  stock_alert: number;
  selling_price: string;
  description?: string;
}

interface CategoryManagerProps {
  type: 'rayon' | 'forme' | 'groupe';
  title: string;
  icon: React.ReactNode;
  apiPath: string;
  hasHierarchy?: boolean;
  hasDescription?: boolean;
}

export default function CategoryManager({ 
  type, 
  title, 
  icon, 
  apiPath, 
  hasHierarchy = false,
  hasDescription = true 
}: CategoryManagerProps) {
  const { t } = useTranslation(['stock', 'common']);
  const confirm = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  
  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', parent: '' });
  
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [isOrganizerOpen, setIsOrganizerOpen] = useState(false);
  const [organizerTarget, setOrganizerTarget] = useState<{id: number, name: string} | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  // Printing state (Rayon only)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printTarget, setPrintTarget] = useState<{id: number, name: string} | null>(null);
  const [excludeZeroStock, setExcludeZeroStock] = useState(false);


  const getCategoryName = (cat: Category) => cat.name || cat.nom || '';

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api.get(apiPath.replace(/^\/api\//, ''));
      const data = res.data.results || res.data;
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(`Error fetching ${type}s:`, err);
      toast.error(t('stock:organisation.category_manager.load_error', { type }));
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (catId: number, page: number = 1) => {
    try {
      setProductsLoading(true);
      const res = await api.get(`produits/?${type}=${catId}&page=${page}&page_size=${pageSize}`);
      
      const data = res.data.results || res.data;
      setProducts(Array.isArray(data) ? data : []);
      
      if (res.data.count !== undefined) {
        setTotalCount(res.data.count);
        setTotalPages(Math.ceil(res.data.count / pageSize));
      } else {
        setTotalCount(Array.isArray(data) ? data.length : 0);
        setTotalPages(1);
      }
      setCurrentPage(page);
    } catch (err) {
      console.error("Error fetching products:", err);
      toast.error(t('common:messages.load_error', { defaultValue: "Erreur lors du chargement des produits" }));
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [type, apiPath]);

  useEffect(() => {
    if (selectedCategory) {
      fetchProducts(selectedCategory.id, 1);
    } else {
      setProducts([]);
      setTotalCount(0);
      setTotalPages(1);
      setCurrentPage(1);
    }
  }, [selectedCategory]);

  const handleExportExcel = async () => {
    if (!selectedCategory) return;
    try {
      const response = await api.get(`produits/export_csv/?${type}=${selectedCategory.id}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      const filename = `export_${type}_${getCategoryName(selectedCategory).replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      
      toast.success(t('common:export_success'));
    } catch (err) {
      console.error("Export error:", err);
      toast.error(t('common:export_error'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {};
    if (type === 'rayon') {
      payload.name = formData.name;
      payload.parent = formData.parent ? parseInt(formData.parent) : null;
    } else {
      payload.nom = formData.name;
      payload.description = formData.description;
    }

    try {
      if (editingCategory) {
        const { data: updatedCat } = await api.put(`${apiPath.replace(/^\/api\//, '')}${editingCategory.id}/`, payload);
        setCategories(prev => prev.map(c => c.id === updatedCat.id ? updatedCat : c));
        if (selectedCategory?.id === updatedCat.id) setSelectedCategory(updatedCat);
        toast.success(t('stock:organisation.category_manager.success_save', { type: title }));
      } else {
        const { data: newCat } = await api.post(apiPath.replace(/^\/api\//, ''), payload);
        setCategories(prev => [...prev, newCat].toSorted((a, b) => {
            const nameA = a.name || a.nom || '';
            const nameB = b.name || b.nom || '';
            return nameA.localeCompare(nameB);
        }));
        toast.success(t('stock:organisation.category_manager.success_save', { type: title }));
      }
      setIsModalOpen(false);
    } catch (err) {
      toast.error(t('common:messages.error_saving'));
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: t('stock:organisation.category_manager.delete_confirm_title'),
      message: t('stock:organisation.category_manager.delete_confirm_msg'),
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      await api.delete(`${apiPath.replace(/^\/api\//, '')}${id}/`);
      toast.success(t('stock:organisation.category_manager.success_delete', { type: "" }));
      if (selectedCategory?.id === id) setSelectedCategory(null);
      fetchCategories();
    } catch (err) {
      toast.error(t('common:messages.error_deleting'));
    }
  };

  const openPrintModal = (id: number, name: string) => {
    setPrintTarget({ id, name });
    setExcludeZeroStock(false);
    setIsPrintModalOpen(true);
  };

  const handleConfirmPrint = () => {
    if (!printTarget) return;
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    let url = "";
    if (printTarget.id === -1) {
      url = `${baseUrl}/api/rayons/imprimer_sans_rayon/?exclude_zero=${excludeZeroStock}`;
    } else {
      url = `${baseUrl}${apiPath}${printTarget.id}/imprimer_etat_stock/?exclude_zero=${excludeZeroStock}`;
    }
    window.open(url, '_blank');
    setIsPrintModalOpen(false);
  };

  const handleSearchProducts = async (term: string) => {
    setProductSearchTerm(term);
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const res = await api.get(`produits/?search=${term}`);
      setSearchResults(res.data.results || res.data);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddProduct = async (product: Product) => {
    if (!selectedCategory) return;
    try {
      const payload: any = {};
      payload[type] = selectedCategory.id;

      const { data: updatedProduct } = await api.patch(`produits/${product.id}/`, payload);
      toast.success(t('stock:organisation.category_manager.product_added', { name: product.name, type }));
      
      // Update local products list
      setProducts(prev => [...prev, updatedProduct].toSorted((a, b) => a.name.localeCompare(b.name)));
      setTotalCount(prev => prev + 1);
      
      // Remove from search results to avoid double add
      setSearchResults(prev => prev.filter(p => p.id !== product.id));
    } catch (err) {
      toast.error(t('common:messages.error_update'));
    }
  };

  const handleRemoveProduct = async (product: Product) => {
    const confirmed = await confirm({
      title: t('stock:organisation.category_manager.remove_product_title'),
      message: t('stock:organisation.category_manager.remove_product_msg', { name: product.name, type }),
    });
    if (!confirmed) return;

    try {
      const payload: any = {};
      payload[type] = null;

      await api.patch(`produits/${product.id}/`, payload);
      toast.success(t('stock:organisation.category_manager.product_removed'));
      setProducts(prev => prev.filter(p => p.id !== product.id));
      setTotalCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      toast.error(t('common:messages.error_deleting'));
    }
  };

  // Rayon Specific Hierarchy
  const hierarchy = useMemo(() => {
    if (!hasHierarchy) return categories;
    const parents = categories.filter(c => !c.parent);
    const children = categories.filter(c => c.parent);
    return parents.map(p => ({
      ...p,
      children: children.filter(c => c.parent === p.id)
    }));
  }, [categories, hasHierarchy]);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-6 ">
      
      {/* Sidebar: Category List */}
      <div className="w-full lg:w-96 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-transparent">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
                    {icon}
                 </div>
                 <h2 className="text-xl font-bold tracking-tight text-slate-800">
                    {type === 'rayon' ? t('stock:organisation.tabs.rayons') :
                     type === 'forme' ? t('stock:organisation.tabs.formes') :
                     t('stock:organisation.tabs.groupes')}
                 </h2>
              </div>
              <div className="flex gap-2">
                 {type === 'rayon' && (
                    <button
                      className="inline-flex items-center justify-center size-7 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
                      onClick={() => openPrintModal(-1, t('stock:organisation.category_manager.no_rayon'))}
                      title={t('stock:organisation.category_manager.print_no_rayon_title')}
                    >
                      <Printer size={16} />
                    </button>
                 )}
                 <button
                   className="inline-flex items-center justify-center size-8 bg-emerald-600 text-white rounded-full text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                   onClick={() => {
                     setEditingCategory(null);
                     setFormData({ name: '', description: '', parent: '' });
                     setIsModalOpen(true);
                   }}
                 >
                   <Plus size={18} />
                 </button>
              </div>
           </div>
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
              <input
                type="text"
                placeholder={t('stock:organisation.category_manager.search', { type })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 h-8 text-sm font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
           {loading ? (
              <div className="flex justify-center p-8"><span className="size-6 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></span></div>
           ) : hierarchy.length === 0 ? (
              <div className="text-center p-8 text-slate-400 italic text-sm">{t('stock:organisation.category_manager.no_items', { type })}</div>
           ) : (
              hierarchy.map((cat: any) => (
                <div key={cat.id} className="space-y-1">
                  <button
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${
                      selectedCategory?.id === cat.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                       <LayoutGrid size={16} className={selectedCategory?.id === cat.id ? 'text-white' : 'text-slate-400'} />
                       <span className="font-medium truncate">{getCategoryName(cat)}</span>
                    </div>
                    <div className={`flex gap-1 items-center transition-opacity ${selectedCategory?.id === cat.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                       {type === 'rayon' && (
                          <button
                            className={`inline-flex items-center justify-center size-7 rounded-md transition-colors ${selectedCategory?.id === cat.id ? 'text-white/70 hover:bg-white/20' : 'text-blue-500 hover:bg-blue-50'}`}
                            onClick={(e) => { e.stopPropagation(); openPrintModal(cat.id, getCategoryName(cat)); }}
                            title={t('stock:organisation.category_manager.print_stock_title')}
                          >
                            <Printer size={12} />
                          </button>
                       )}
                       <button
                         className={`inline-flex items-center justify-center size-7 rounded-md transition-colors ${selectedCategory?.id === cat.id ? 'text-white/70 hover:bg-white/20' : 'text-purple-500 hover:bg-purple-50'}`}
                         onClick={(e) => { e.stopPropagation(); setOrganizerTarget({id: cat.id, name: getCategoryName(cat)}); setIsOrganizerOpen(true); }}
                         title={t('stock:organisation.smart_organizer.title')}
                       >
                         <Sparkles size={12} />
                       </button>
                       <button
                         className={`inline-flex items-center justify-center size-7 rounded-md transition-colors ${selectedCategory?.id === cat.id ? 'text-white/70 hover:bg-white/20' : 'text-slate-400 hover:bg-slate-200'}`}
                         onClick={(e) => {
                           e.stopPropagation();
                           setEditingCategory(cat);
                           setFormData({
                             name: getCategoryName(cat),
                             description: cat.description || '',
                             parent: cat.parent?.toString() || ''
                           });
                           setIsModalOpen(true);
                         }}
                       >
                         <Pencil size={12} />
                       </button>
                    </div>
                  </button>

                  {cat.children && cat.children.length > 0 && (
                    <div className="pl-6 space-y-1 border-l-2 border-slate-100 ml-5 mt-1">
                      {cat.children.map((child: any) => (
                        <button
                          key={child.id}
                          onClick={() => setSelectedCategory(child)}
                          className={`w-full flex items-center justify-between p-2 rounded-xl transition-all group text-sm ${
                            selectedCategory?.id === child.id
                            ? 'bg-emerald-50 text-emerald-700 font-semibold'
                            : 'hover:bg-slate-100 text-slate-600'
                          }`}
                        >
                          <span className="truncate">↳ {getCategoryName(child)}</span>
                          <div className={`flex gap-1 items-center ${selectedCategory?.id === child.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                             {type === 'rayon' && (
                                <button
                                  className="inline-flex items-center justify-center size-6 rounded-md text-blue-500 hover:bg-blue-50 transition-colors"
                                  onClick={(e) => { e.stopPropagation(); openPrintModal(child.id, getCategoryName(child)); }}
                                >
                                  <Printer size={10} />
                                </button>
                             )}
                             <button
                               className="inline-flex items-center justify-center size-6 rounded-md text-purple-500 hover:bg-purple-50 transition-colors"
                               onClick={(e) => { e.stopPropagation(); setOrganizerTarget({id: child.id, name: getCategoryName(child)}); setIsOrganizerOpen(true); }}
                             >
                               <Sparkles size={10} />
                             </button>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
           )}
        </div>
      </div>

      {/* Detail View: Products */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
         {selectedCategory ? (
            <>
               <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-transparent">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                     <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">
                           <LayoutGrid size={12} />
                           {t('stock:organisation.category_manager.details_title', { type })}
                        </div>
                        <h1 className="text-3xl font-black text-slate-800">{getCategoryName(selectedCategory)}</h1>
                        {selectedCategory.description && (
                           <p className="mt-2 text-slate-500 max-w-2xl">{selectedCategory.description}</p>
                        )}
                        {selectedCategory.parent_name && (
                           <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border border-slate-200 text-slate-500">{t('stock:organisation.category_manager.parent_label')}: {selectedCategory.parent_name}</div>
                        )}
                     </div>
                     <div className="flex gap-2">
                        <button
                           onClick={handleExportExcel}
                           className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-all"
                           title={t('common:export_csv_title')}
                        >
                           <Download size={18} />
                           {t('common:buttons.excel')}
                        </button>
                        <button
                          onClick={() => setIsAddProductModalOpen(true)}
                          className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                          <Plus size={18} />
                          {t('stock:organisation.category_manager.add_products_btn')}
                        </button>
                        <button
                           onClick={() => handleDelete(selectedCategory.id)}
                           className="inline-flex items-center justify-center size-9 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors"
                        >
                           <Trash2 size={18} />
                        </button>
                     </div>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-4">
                  {productsLoading ? (
                     <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <span className="size-8 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></span>
                        <p className="text-sm font-medium text-slate-400">{t('common:loading')}</p>
                     </div>
                  ) : products.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                        <Package size={64} strokeWidth={1} className="mb-4" />
                        <p className="text-lg font-bold text-slate-400">{t('stock:organisation.category_manager.no_items', { type: 'produit' })}</p>
                        <p className="text-sm text-slate-400">{t('stock:organisation.category_manager.select_item_hint')}</p>
                     </div>
                  ) : (
                     <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {products.map(p => (
                           <div key={p.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between group hover:bg-slate-100 transition-all">
                              <div className="flex items-center gap-4 overflow-hidden">
                                 <div className="size-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                                    <Package size={20} className="text-slate-300" />
                                 </div>
                                 <div className="overflow-hidden">
                                    <h4 className="font-bold truncate text-slate-800">{p.name}</h4>
                                    <p className="text-xs text-slate-400 font-mono">{p.cip1} • Stock: <span className={p.stock <= p.stock_alert ? 'text-red-500 font-bold' : 'text-slate-600'}>{p.stock}</span></p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-3">
                                 <div className="text-right hidden sm:block">
                                    <div className="font-bold text-sm text-slate-700">{formatCurrency(normalizeNumberInput(p.selling_price))}</div>
                                 </div>
                                 <button
                                   onClick={() => handleRemoveProduct(p)}
                                   className="inline-flex items-center justify-center size-8 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                 >
                                    ✕
                                 </button>
                              </div>
                           </div>
                        ))}
                     </div>
                    )}
                 </div>

                 {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                       <div className="text-xs font-medium text-slate-400">
                          {t('common:pagination_info', { page: currentPage, total: totalPages, count: totalCount, label: t('common:items') })}
                       </div>
                       <div className="flex items-center gap-2">
                          <button
                             className="inline-flex items-center justify-center size-8 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-40"
                             disabled={currentPage === 1}
                             onClick={() => fetchProducts(selectedCategory.id, currentPage - 1)}
                          >
                             <ChevronLeft size={18} />
                          </button>
                          <div className="px-3 py-1 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-700">
                             {t('common:pagination.page_of', { page: currentPage, count: totalPages })}
                          </div>
                          <button
                             className="inline-flex items-center justify-center size-8 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-40"
                             disabled={currentPage === totalPages}
                             onClick={() => fetchProducts(selectedCategory.id, currentPage + 1)}
                          >
                             <ChevronRight size={18} />
                          </button>
                       </div>
                    </div>
                 )}
              </>
         ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-200">
               <div className="relative mb-8">
                  <div className="absolute inset-0 bg-emerald-100 blur-3xl rounded-full scale-150 animate-pulse"></div>
                  <LayoutGrid size={120} strokeWidth={1} className="relative text-slate-200" />
               </div>
               <h3 className="text-2xl font-black mb-2 text-slate-400 tracking-tight">{t('stock:organisation.category_manager.select_item', { type })}</h3>
               <p className="text-sm font-medium text-slate-400">{t('stock:organisation.category_manager.select_item_hint')}</p>
            </div>
         )}
      </div>

      {/* MODAL: CREATE/EDIT */}
      <PremiumModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory
          ? t('stock:organisation.category_manager.edit_title', { type })
          : t('stock:organisation.category_manager.new_title', { type })}
        subtitle={editingCategory
          ? t('stock:organisation.category_manager.edit_subtitle')
          : t('stock:organisation.category_manager.new_subtitle', { type: title })}
        icon={editingCategory ? <Pencil className="size-5" /> : <Plus className="size-5" />}
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
           <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('stock:organisation.category_manager.name_label', { type })}</label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 h-12 text-sm font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                required
                autoFocus
              />
           </div>

           {hasHierarchy && (
              <div>
                 <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('stock:organisation.category_manager.parent_label')}</label>
                 <select
                   className="w-full rounded-xl border border-slate-200 bg-slate-50 h-12 px-3 text-sm font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                   value={formData.parent}
                   onChange={e => setFormData({...formData, parent: e.target.value})}
                 >
                   <option value="">{t('stock:organisation.category_manager.parent_select_none')}</option>
                   {categories.filter(c => !c.parent && c.id !== editingCategory?.id).map(c => (
                     <option key={c.id} value={c.id.toString()}>{getCategoryName(c)}</option>
                   ))}
                 </select>
              </div>
           )}

           {hasDescription && (
              <div>
                 <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('stock:organisation.category_manager.description_label')}</label>
                 <textarea
                   className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                   value={formData.description}
                   onChange={e => setFormData({...formData, description: e.target.value})}
                   rows={3}
                 />
              </div>
           )}

           <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" className="inline-flex items-center h-9 px-5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors" onClick={() => setIsModalOpen(false)}>{t('stock:organisation.category_manager.cancel')}</button>
              <button type="submit" className="inline-flex items-center justify-center h-9 px-8 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm">{t('stock:organisation.category_manager.save')}</button>
           </div>
        </form>
      </PremiumModal>

      {/* MODAL: ADD PRODUCT */}
      <PremiumModal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        title={t('stock:organisation.category_manager.assoc_products_title')}
        subtitle={t('stock:organisation.category_manager.assoc_products_subtitle', { name: selectedCategory ? getCategoryName(selectedCategory) : '' })}
        maxWidth="max-w-4xl"
        icon={<Plus className="size-6" />}
      >
        <div className="p-6 flex flex-col h-[600px]">
           <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-300" />
              <input
                type="text"
                placeholder={t('stock:organisation.category_manager.search_products_placeholder')}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 h-14 text-sm font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                value={productSearchTerm}
                onChange={e => handleSearchProducts(e.target.value)}
                autoFocus
              />
           </div>

           <div className="flex-1 overflow-auto bg-slate-50 rounded-2xl p-4 border border-slate-200">
               {isSearching ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4">
                     <span className="size-8 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></span>
                     <p className="text-sm font-bold text-slate-400">{t('common:loading')}</p>
                  </div>
               ) : searchResults.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     {searchResults.map(p => (
                        <div key={p.id} className="bg-white rounded-xl p-4 flex items-center justify-between shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                           <div className="overflow-hidden">
                              <h5 className="font-bold truncate text-slate-800">{p.name}</h5>
                              <p className="text-xs text-slate-400">{p.cip1}</p>
                           </div>
                           <button
                             className="inline-flex items-center justify-center size-8 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                             onClick={() => handleAddProduct(p)}
                           >
                             <Plus size={16} />
                           </button>
                        </div>
                     ))}
                  </div>
               ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 italic">
                     <Search size={48} className="mb-2 text-slate-200" />
                     {productSearchTerm.length < 2 ? t('common:messages.hint_min_char') : t('common:no_results_found')}
                  </div>
               )}
           </div>

           <div className="mt-6 flex justify-end">
              <button className="inline-flex items-center h-9 px-8 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors" onClick={() => setIsAddProductModalOpen(false)}>{t('common:buttons.done')}</button>
           </div>
        </div>
      </PremiumModal>

      {/* Smart Organizer Modal */}
      {organizerTarget && (
        <SmartOrganizerModal
          isOpen={isOrganizerOpen}
          onClose={() => setIsOrganizerOpen(false)}
          targetCategory={{
            type: type,
            id: organizerTarget.id,
            name: organizerTarget.name
          }}
          onSuccess={() => {
            fetchCategories();
            if (selectedCategory?.id === organizerTarget.id) fetchProducts(selectedCategory.id);
          }}
        />
      )}

      {/* Print Modal */}
      <PremiumModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={t('stock:organisation.category_manager.print_stock_title')}
        subtitle={printTarget?.name || ''}
        icon={<Printer className="h-5 w-5 text-blue-500" />}
      >
        <div className="p-6 space-y-6">
           <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <p className="text-sm text-blue-700">{t('stock:organisation.category_manager.print_help')}</p>
           </div>

           <div className="space-y-1.5">
              <label className="flex items-center gap-3 cursor-pointer">
                 <input
                   type="checkbox"
                   className="size-4 rounded border-slate-300 accent-blue-600 cursor-pointer"
                   checked={excludeZeroStock}
                   onChange={e => setExcludeZeroStock(e.target.checked)}
                 />
                 <span className="text-sm font-bold text-slate-500">{t('stock:organisation.category_manager.exclude_zero_stock')}</span>
              </label>
           </div>

           <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button className="inline-flex items-center h-9 px-5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors" onClick={() => setIsPrintModalOpen(false)}>{t('stock:organisation.category_manager.cancel')}</button>
              <button
                className="inline-flex items-center gap-2 h-9 px-8 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
                onClick={handleConfirmPrint}
              >
                <Printer size={18} />
                {t('stock:organisation.category_manager.print_btn')}
              </button>
           </div>
        </div>
      </PremiumModal>
    </div>
  );
}
