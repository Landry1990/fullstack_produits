import { useEffect, useState, useMemo, type FormEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useConfirm } from '../hooks/useConfirm';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import PasswordConfirmModal from './PasswordConfirmModal';
import PremiumModal from './common/PremiumModal';
import type { Fournisseur } from '../types';
import FinanceFournisseurModal from './FinanceFournisseurModal';

interface CatalogueItem {
  produit_id: number;
  produit_nom: string;
  cip: string;
  dernier_prix_achat: number;
  derniere_commande: string | null;
  prix_vente: number;
  marge: number;
  marge_pourcent: number;
  qte_totale: number;
  stock_actuel: number;
}

interface CatalogueResponse {
  fournisseur_id: number;
  fournisseur_nom: string;
  total_produits: number;
  produits: CatalogueItem[];
}

const emptyForm: Omit<Fournisseur, 'id'> = {
  name: '',
  address: '',
  phone: '',
  email: '',
};

export default function Fournisseurs() {
  const { t } = useTranslation();
  const confirm = useConfirm()
  const { user } = useAuth();
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [selectedFournisseur, setSelectedFournisseur] = useState<Fournisseur | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Sudo Mode State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordModalConfig, setPasswordModalConfig] = useState<{ title: string; message: string }>({ title: '', message: '' });
  const [pendingAction, setPendingAction] = useState<() => Promise<void>>(() => Promise.resolve());
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [newFournisseur, setNewFournisseur] = useState(emptyForm);
  const [editingFournisseur, setEditingFournisseur] = useState<Fournisseur | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Catalogue state
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState<boolean>(false);
  const [catalogueSearch, setCatalogueSearch] = useState<string>('');
  const [showCatalogue, setShowCatalogue] = useState<boolean>(true);
  const [showInactive, setShowInactive] = useState<boolean>(false);

  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false);

  // Auto-refresh selectedFournisseur when list changes
  useEffect(() => {
    if (selectedFournisseur) {
      const updated = fournisseurs.find(f => f.id === selectedFournisseur.id);
      if (updated && updated !== selectedFournisseur) {
        setSelectedFournisseur(updated);
      }
    }
  }, [fournisseurs, selectedFournisseur]);

  // Auto-refresh selectedFournisseur when list changes
  useEffect(() => {
    if (selectedFournisseur) {
      const updated = fournisseurs.find(f => f.id === selectedFournisseur.id);
      if (updated && updated !== selectedFournisseur) {
        setSelectedFournisseur(updated);
      }
    }
  }, [fournisseurs, selectedFournisseur]);

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL ?? ''),
    []
  );
  const fournisseursEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/fournisseurs/` 
    : '/api/fournisseurs/';

  // Filtrer les fournisseurs selon le terme de recherche
  const filteredFournisseurs = useMemo(() => {
    if (!searchTerm.trim()) return fournisseurs;
    
    const term = searchTerm.toLowerCase();
    return fournisseurs.filter(fournisseur => 
      fournisseur.name.toLowerCase().includes(term) ||
      fournisseur.email.toLowerCase().includes(term) ||
      fournisseur.phone.includes(term) ||
      fournisseur.address.toLowerCase().includes(term)
    );
  }, [fournisseurs, searchTerm]);

  // Filtrer le catalogue selon le terme de recherche
  const filteredCatalogue = useMemo(() => {
    if (!catalogueSearch.trim()) return catalogue;
    
    const term = catalogueSearch.toLowerCase();
    return catalogue.filter(item => 
      item.produit_nom.toLowerCase().includes(term) ||
      item.cip.toLowerCase().includes(term)
    );
  }, [catalogue, catalogueSearch]);

  // Charger le catalogue quand un fournisseur est sélectionné
  async function fetchCatalogue(fournisseurId: number) {
    setCatalogueLoading(true);
    try {
      const response = await axios.get<CatalogueResponse>(
        `${fournisseursEndpoint}${fournisseurId}/catalogue/`
      );
      setCatalogue(response.data.produits || []);
    } catch (err) {
      console.error('Erreur lors du chargement du catalogue:', err);
      setCatalogue([]);
    } finally {
      setCatalogueLoading(false);
    }
  }

  // Charger le catalogue quand le fournisseur sélectionné change
  useEffect(() => {
    if (selectedFournisseur) {
      fetchCatalogue(selectedFournisseur.id);
      setCatalogueSearch('');
    } else {
      setCatalogue([]);
    }
  }, [selectedFournisseur?.id]);

  async function fetchFournisseurs() {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(fournisseursEndpoint, {
        params: { include_inactive: showInactive }
      });
      // Handle paginated response
      const data: any = response.data;
      setFournisseurs(Array.isArray(data) ? data : (data.results || []));
    } catch (err: unknown) {
      if (axios.isCancel(err)) return;
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? err.message ?? 'Erreur réseau');
      } else {
        setError(t('providers.messages.load_error') || 'Erreur inconnue lors du chargement des fournisseurs');
      }
    } finally {
      setLoading(false);
    }
  }

  // Charger les fournisseurs au montage
  useEffect(() => {
    fetchFournisseurs();
  }, [fournisseursEndpoint, showInactive]);

  useEffect(() => {
    if (selectedFournisseur && !fournisseurs.some(f => f.id === selectedFournisseur.id)) {
      setSelectedFournisseur(null);
    }
  }, [fournisseurs, selectedFournisseur]);

  function openAddModal() {
    setNewFournisseur(emptyForm);
    setIsAddModalOpen(true);
  }

  function closeAddModal() {
    setIsAddModalOpen(false);
    setError(null); // Réinitialiser l'erreur lors de la fermeture
    setNewFournisseur(emptyForm); // Réinitialiser le formulaire
  }

  // Fonctions de navigation au clavier
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!searchTerm) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredFournisseurs.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredFournisseurs.length) {
          const selectedFournisseur = filteredFournisseurs[highlightedIndex];
          setSelectedFournisseur(selectedFournisseur);
          setSearchTerm('');
          setHighlightedIndex(-1);
        }
        break;
      case 'Escape':
        setSearchTerm('');
        setHighlightedIndex(-1);
        break;
    }
  }

  function selectFournisseur(fournisseur: Fournisseur) {
    setSelectedFournisseur(fournisseur);
    setSearchTerm('');
    setHighlightedIndex(-1);
  }

  function openEditModal() {
    if (!selectedFournisseur) return;
    setEditingFournisseur(selectedFournisseur);
    setIsEditModalOpen(true);
  }

  function closeEditModal() {
    setIsEditModalOpen(false);
  }

  function formatBackendErrors(data: unknown): string {
    if (data == null) return t('common.unknown_error') || 'Erreur inconnue du serveur'
    if (typeof data === 'string') return data
    if (typeof data === 'object') {
      try {
        const entries = Object.entries(data as Record<string, unknown>)
        const parts = entries.map(([field, messages]) => {
          if (Array.isArray(messages)) return `${field}: ${messages.join(', ')}`
          if (typeof messages === 'string') return `${field}: ${messages}`
          return `${field}: ${JSON.stringify(messages)}`
        })
        return parts.join(' | ')
      } catch {
        return JSON.stringify(data)
      }
    }
    return String(data)
  }

  async function handleAddFournisseur(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); // Réinitialiser l'erreur avant la tentative
    setIsSubmitting(true);
    try {
      const { data: addedFournisseur } = await axios.post<Fournisseur>(fournisseursEndpoint, newFournisseur);
      setFournisseurs(prev => [addedFournisseur, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedFournisseur(addedFournisseur);
      setNewFournisseur(emptyForm); // Réinitialiser le formulaire
      closeAddModal();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data ?? err.message
        setError(typeof detail === 'string' ? detail : formatBackendErrors(detail))
      } else {
        setError(t('providers.messages.save_error') || "Erreur inconnue lors de l'ajout du fournisseur")
      }
      console.error('Erreur lors de l\'ajout du fournisseur:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEditFournisseur(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingFournisseur) return;
    try {
      const { data: updatedFournisseur } = await axios.patch<Fournisseur>(
        `${fournisseursEndpoint}${editingFournisseur.id}/`,
        editingFournisseur
      );
      setFournisseurs(prev => 
        prev.map(f => (f.id === updatedFournisseur.id ? updatedFournisseur : f))
      );
      setSelectedFournisseur(updatedFournisseur);
      closeEditModal();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data ?? err.message
        setError(typeof detail === 'string' ? detail : formatBackendErrors(detail))
      } else {
        setError(t('providers.messages.save_error') || "Erreur inconnue lors de la modification du fournisseur")
      }
      console.error('Erreur lors de la modification du fournisseur:', err);
    }
  }

  const executeDeleteFournisseur = async (id: number) => {
    try {
      await axios.delete(`${fournisseursEndpoint}${id}/`);
      setFournisseurs(prev => prev.filter(f => f.id !== id));
      setSelectedFournisseur(null);
      toast.success(t('providers.messages.delete_success'));
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        // Handle FK protect errors explicitly
        if (err.response?.status === 500 || (err.response?.data?.detail && String(err.response.data.detail).includes('protected'))) {
             toast.error(t('providers.messages.delete_protected'));
        } else {
             const msg = err.response?.data?.message ?? err.message ?? t('common.network_error');
             toast.error(`${t('common.error')}: ${msg}`);
        }
      } else {
        toast.error(t('providers.messages.delete_error'));
      }
      console.error('Erreur lors de la suppression du fournisseur:', err);
    }
  }

  async function handleDeleteFournisseur() {
    if (!selectedFournisseur) return;
    
    // Permission Check
    if (!user?.is_superuser && !user?.can_delete_fournisseur) {
        toast.error(t('providers.messages.access_denied_delete'))
        return
    }
    
    const confirmed = await confirm({
      title: t('providers.messages.delete_confirm_title'),
      message: t('providers.messages.delete_confirm_message', { name: selectedFournisseur.name }),
      variant: 'danger',
      confirmText: t('providers.messages.delete_btn')
    })
    
    if (confirmed) {
        // Trigger Password Modal
        setPasswordModalConfig({
            title: t('providers.messages.sudo_title'),
            message: t('providers.messages.sudo_message')
        })
        setPendingAction(() => () => executeDeleteFournisseur(selectedFournisseur.id));
        setIsPasswordModalOpen(true);
    }
  }

  async function handleToggleActive() {
    if (!selectedFournisseur) return;
    try {
      const response = await axios.post(`${fournisseursEndpoint}${selectedFournisseur.id}/toggle_active/`);
      const isActive = response.data.is_active;
      toast.success(isActive ? t('providers.messages.reactivated') : t('providers.messages.hidden'));
      setSelectedFournisseur(prev => prev ? ({ ...prev, is_active: isActive }) : null);
      fetchFournisseurs();
    } catch (err) {
      toast.error(t('providers.messages.status_change_error'));
      console.error(err);
    }
  }

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {error && (
        <div role="alert" className="alert alert-error shrink-0">
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-full min-h-0">
         {/* Left Panel: List */}
         <div className="md:col-span-1 bg-white rounded-lg shadow flex flex-col overflow-hidden h-full">
            {/* Header with Search and Actions */}
            <div className="p-4 border-b flex flex-wrap gap-4 justify-between items-center shrink-0 bg-white">
               <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-800">Fournisseurs</h2>
                  {loading ? (
                      <span className="loading loading-spinner loading-xs text-primary"></span>
                  ) : (
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-xs font-bold">{fournisseurs.length}</span>
                  )}
               </div>
               
               <div className="flex items-center gap-2 flex-1 max-w-md">
                 <div className="relative w-full">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input 
                       ref={searchInputRef}
                       type="text" 
                       placeholder={t('providers.search_placeholder')}
                       className="input input-sm input-bordered w-full pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-all h-9" 
                       value={searchTerm}
                       onChange={(e) => {
                         setSearchTerm(e.target.value);
                         setHighlightedIndex(-1);
                       }}
                       onKeyDown={handleKeyDown}
                     />
                 </div>
                 <button 
                    className={`btn btn-sm btn-square ${showInactive ? 'btn-neutral' : 'btn-ghost'}`} 
                    onClick={() => setShowInactive(!showInactive)}
                    title={showInactive ? "Masquer les inactifs" : "Afficher les inactifs"}
                 >
                    {showInactive ? '👁️' : '🙈'}
                 </button>
                 <button className="btn btn-primary btn-sm gap-2 h-9" onClick={openAddModal}>
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                   </svg>
                   {t('providers.new_provider')}
                 </button>
               </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
               <table className="table table-xs table-pin-rows w-full">
                 <thead className="bg-[#f8fafc] text-[#64748b]">
                    <tr>
                      <th className="py-2 px-2 font-semibold uppercase text-xs tracking-wider text-left">{t('providers.table.provider')}</th>
                      <th className="py-2 px-2 font-semibold uppercase text-xs tracking-wider text-center">{t('providers.table.phone')}</th>
                    </tr>
                 </thead>
                 <tbody>
                    {filteredFournisseurs.length > 0 ? (
                      filteredFournisseurs.map((fournisseur, index) => (
                         <tr 
                           key={fournisseur.id} 
                           className={`hover cursor-pointer transition-all border-b border-slate-50 ${
                             selectedFournisseur?.id === fournisseur.id ? 'bg-blue-50/50 text-primary' : 'text-slate-600'
                           } ${
                             searchTerm && highlightedIndex === index ? 'bg-slate-100' : ''
                           }`}
                           onClick={() => selectFournisseur(fournisseur)}
                         >
                           <td className="py-1.5 px-2">
                             <div className="font-semibold text-sm truncate max-w-[140px]" title={fournisseur.name}>{fournisseur.name}</div>
                           </td>
                           <td className="py-1.5 px-2 text-center">
                             <span className="font-mono text-xs text-slate-500">{fournisseur.phone || '-'}</span>
                           </td>
                         </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="text-center py-6 opacity-50">
                           <div className="flex flex-col items-center gap-1">
                             <span className="text-xl">📭</span>
                             <span className="text-xs">{searchTerm ? t('providers.no_result') : t('providers.empty_list')}</span>
                           </div>
                        </td>
                      </tr>
                    )}
                 </tbody>
               </table>
            </div>
         </div>

         {/* Right Panel: Details */}
         <div className="md:col-span-2 bg-white rounded-lg shadow flex flex-col h-full overflow-hidden">
             {selectedFournisseur ? (
                <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="p-6 border-b bg-gradient-to-r from-slate-50 to-white shrink-0 flex justify-between items-start">
                     <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">Fournisseur</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 leading-tight">{selectedFournisseur.name}</h2>
                     </div>
                     <div className="flex gap-2">
                        <button className="btn btn-sm btn-circle btn-ghost text-slate-400 hover:text-primary transition-colors" onClick={openEditModal} title="Modifier">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button className="btn btn-sm btn-circle btn-ghost text-slate-400 hover:text-error transition-colors" onClick={handleDeleteFournisseur} title="Supprimer">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <button 
                          className={`btn btn-sm btn-circle btn-ghost transition-colors ${selectedFournisseur.is_active === false ? 'text-warning' : 'text-slate-400 hover:text-warning'}`}
                          onClick={handleToggleActive}
                          title={selectedFournisseur.is_active === false ? 'Réactiver' : 'Masquer'}
                        >
                          {selectedFournisseur.is_active === false ? '👁️' : '🙈'}
                        </button>
                     </div>
                  </div>
                  
                  <div className="p-8 space-y-8 overflow-y-auto flex-1">
                      <div className="space-y-6">
                          <div className="flex gap-4 group">
                              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 group-hover:bg-blue-50 group-hover:text-primary transition-all duration-300">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{t('providers.details.contact_address')}</div>
                                  <div className="text-slate-700 font-medium whitespace-pre-wrap leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                                    {selectedFournisseur.address || t('providers.details.not_provided')}
                                  </div>
                              </div>
                          </div>

                          <div className="grid grid-cols-1 gap-6">
                            <div className="flex gap-4 group">
                                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 group-hover:bg-blue-50 group-hover:text-primary transition-all duration-300">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{t('providers.details.direct_line')}</div>
                                    <div className="text-lg font-black text-slate-700 font-mono tracking-tight">{selectedFournisseur.phone || '-'}</div>
                                </div>
                            </div>

                            <div className="flex gap-4 group">
                                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 group-hover:bg-blue-50 group-hover:text-primary transition-all duration-300">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{t('providers.details.email')}</div>
                                    <div className="text-slate-600 font-semibold break-all selection:bg-blue-100 underline decoration-blue-200 decoration-2 underline-offset-4">{selectedFournisseur.email || '-'}</div>
                                </div>
                            </div>
                          </div>
                      </div>
                      
                      <div className="pt-6 mt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-slate-800 flex items-center gap-2">
                             <span className="w-8 h-8 rounded-lg bg-emerald-100/50 text-emerald-600 flex items-center justify-center text-sm">💰</span>
                             {t('providers.details.financial_situation')}
                          </h3>
                          <button 
                            className="btn btn-sm btn-outline btn-primary gap-2"
                            onClick={() => setIsFinanceModalOpen(true)}
                          >
                            {t('providers.details.manage_payments')}
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('providers.details.debt_balance')}</div>
                              <div className={`text-2xl font-black font-mono ${Number(selectedFournisseur.solde_dette) > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                 {Number(selectedFournisseur.solde_dette || 0).toLocaleString('fr-FR')} F
                              </div>
                           </div>
                           <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 text-xs italic">
                              Historique disponible dans le gestionnaire
                           </div>
                        </div>
                      </div>

                      <div className="pt-8 mt-4 border-t border-slate-100">
                        <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('providers.details.internal_ref')}</span>
                          <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">#{selectedFournisseur.id}</span>
                        </div>
                      </div>

                      {/* Catalogue Fournisseur */}
                      <div className="pt-6 mt-4 border-t border-slate-100">
                        <div 
                          className="flex items-center justify-between cursor-pointer group"
                          onClick={() => setShowCatalogue(!showCatalogue)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-800">{t('providers.details.product_catalogue')}</h3>
                              <p className="text-[11px] text-slate-400">
                                {catalogueLoading ? t('providers.details.loading') : t('providers.details.products_ordered_plural', { count: catalogue.length })}
                              </p>
                            </div>
                          </div>
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${showCatalogue ? 'rotate-180' : ''}`} 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>

                        {showCatalogue && (
                          <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            {/* Barre de recherche du catalogue */}
                            {catalogue.length > 0 && (
                              <div className="relative mb-3">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                </div>
                                <input 
                                  type="text" 
                                  placeholder={t('providers.catalogue.search_placeholder')}
                                  className="input input-sm input-bordered w-full pl-9 bg-white text-xs h-8" 
                                  value={catalogueSearch}
                                  onChange={(e) => setCatalogueSearch(e.target.value)}
                                />
                              </div>
                            )}

                            {catalogueLoading ? (
                              <div className="flex justify-center py-8">
                                <span className="loading loading-spinner loading-md text-primary"></span>
                              </div>
                            ) : filteredCatalogue.length === 0 ? (
                              <div className="text-center py-6 text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <p className="text-xs font-medium">
                                  {catalogueSearch ? t('providers.catalogue.no_result') : t('providers.catalogue.empty')}
                                </p>
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="table table-xs w-full">
                                  <thead className="bg-slate-50">
                                    <tr>
                                      <th className="text-[10px] font-bold text-slate-500 uppercase">{t('providers.catalogue.headers.cip')}</th>
                                      <th className="text-[10px] font-bold text-slate-500 uppercase">{t('providers.catalogue.headers.product')}</th>
                                      <th className="text-[10px] font-bold text-slate-500 uppercase text-right">{t('providers.catalogue.headers.last_price')}</th>
                                      <th className="text-[10px] font-bold text-slate-500 uppercase text-center">{t('providers.catalogue.headers.last_order')}</th>
                                      <th className="text-[10px] font-bold text-slate-500 uppercase text-right">{t('providers.catalogue.headers.margin')}</th>
                                      <th className="text-[10px] font-bold text-slate-500 uppercase text-center">{t('providers.catalogue.headers.total_qty')}</th>
                                      <th className="text-[10px] font-bold text-slate-500 uppercase text-center">{t('providers.catalogue.headers.stock')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredCatalogue.map((item) => (
                                      <tr key={item.produit_id} className="hover:bg-slate-50/50 border-b border-slate-100 last:border-0">
                                        <td className="py-2">
                                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                            {item.cip}
                                          </span>
                                        </td>
                                        <td className="py-2">
                                          <span className="text-xs font-medium text-slate-700 line-clamp-1" title={item.produit_nom}>
                                            {item.produit_nom}
                                          </span>
                                        </td>
                                        <td className="py-2 text-right">
                                          <span className="text-xs font-semibold text-slate-700">
                                            {item.dernier_prix_achat.toLocaleString('fr-FR')} F
                                          </span>
                                        </td>
                                        <td className="py-2 text-center">
                                          <span className="text-[10px] text-slate-500">
                                            {item.derniere_commande 
                                              ? new Date(item.derniere_commande).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
                                              : '-'
                                            }
                                          </span>
                                        </td>
                                        <td className="py-2 text-right">
                                          <span className={`text-xs font-semibold ${item.marge >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {item.marge.toLocaleString('fr-FR')} F
                                          </span>
                                          <span className="text-[9px] text-slate-400 ml-1">
                                            ({item.marge_pourcent}%)
                                          </span>
                                        </td>
                                        <td className="py-2 text-center">
                                          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                            {item.qte_totale}
                                          </span>
                                        </td>
                                        <td className="py-2 text-center">
                                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                            item.stock_actuel <= 0 
                                              ? 'bg-red-100 text-red-600' 
                                              : item.stock_actuel < 10 
                                                ? 'bg-amber-100 text-amber-600' 
                                                : 'bg-emerald-100 text-emerald-600'
                                          }`}>
                                            {item.stock_actuel}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                  </div>
                </div>
             ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-10 text-center animate-pulse">
                    <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <p className="font-bold text-slate-400">{t('providers.details.no_provider_selected')}</p>
                    <p className="text-sm text-slate-300 mt-1 max-w-[200px]">{t('providers.details.select_instruction')}</p>
                </div>
             )}
         </div>
      </div>

      {/* Add Modal */}
      <PremiumModal
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
        title={t('providers.form.add_title')}
        subtitle="Enregistrer un nouveau fournisseur"
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        }
        maxWidth="max-w-2xl"
        disableClose={isSubmitting}
      >
        <form className="p-6 space-y-6" onSubmit={handleAddFournisseur}>
          {/* Informations de l'entreprise */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-2">
              {t('providers.form.company_info')}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('providers.form.name')} *</label>
                <input 
                  type="text" 
                  placeholder={t('providers.form.name_placeholder')}
                  value={newFournisseur.name} 
                  onChange={e => setNewFournisseur(f => ({...f, name: e.target.value}))} 
                  className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                  required 
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('providers.form.phone')} *</label>
                <input 
                  type="tel" 
                  placeholder={t('providers.form.phone_placeholder')}
                  value={newFournisseur.phone} 
                  onChange={e => setNewFournisseur(f => ({...f, phone: e.target.value}))} 
                  className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                  required 
                  disabled={isSubmitting}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('providers.form.email')} *</label>
              <input 
                type="email" 
                placeholder={t('providers.form.email_placeholder')}
                value={newFournisseur.email} 
                onChange={e => setNewFournisseur(f => ({...f, email: e.target.value}))} 
                className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                required 
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Adresse */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-2">
              {t('providers.form.address_section')}
            </h4>
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('providers.form.address')} *</label>
              <textarea 
                placeholder={t('providers.form.address_placeholder')}
                value={newFournisseur.address} 
                onChange={e => setNewFournisseur(f => ({...f, address: e.target.value}))} 
                className="textarea textarea-bordered w-full h-24 rounded-xl resize-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                required 
                disabled={isSubmitting}
              />
              <p className="text-[11px] text-gray-400 mt-1">{t('providers.form.address_hint')}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn btn-ghost px-6 rounded-xl" onClick={closeAddModal} disabled={isSubmitting}>
              {t('providers.form.cancel')}
            </button>
            <button type="submit" className="btn btn-primary px-8 rounded-xl shadow-lg shadow-primary/20" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  {t('providers.form.saving')}
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {t('providers.form.add_btn')}
                </>
              )}
            </button>
          </div>
        </form>
      </PremiumModal>

      {/* Edit Modal */}
      <PremiumModal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        title={t('providers.form.edit_title')}
        subtitle={editingFournisseur?.name || ''}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        }
        gradientFrom="secondary/10"
        gradientVia="primary/5"
        gradientTo="accent/10"
        maxWidth="max-w-2xl"
      >
        {editingFournisseur && (
          <form className="p-6 space-y-6" onSubmit={handleEditFournisseur}>
            {/* Informations de l'entreprise */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-2">
                {t('providers.form.company_info')}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('providers.form.name')} *</label>
                  <input 
                    type="text" 
                    placeholder={t('providers.form.name_placeholder')}
                    value={editingFournisseur.name} 
                    onChange={e => setEditingFournisseur(f => f ? {...f, name: e.target.value} : null)} 
                    className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                    required 
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('providers.form.phone')} *</label>
                  <input 
                    type="tel" 
                    placeholder={t('providers.form.phone_placeholder')}
                    value={editingFournisseur.phone} 
                    onChange={e => setEditingFournisseur(f => f ? {...f, phone: e.target.value} : null)} 
                    className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                    required 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('providers.form.email')} *</label>
                <input 
                  type="email" 
                  placeholder={t('providers.form.email_placeholder')}
                  value={editingFournisseur.email} 
                  onChange={e => setEditingFournisseur(f => f ? {...f, email: e.target.value} : null)} 
                  className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                  required 
                />
              </div>
            </div>

            {/* Adresse */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-2">
                {t('providers.form.address_section')}
              </h4>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('providers.form.address')} *</label>
                <textarea 
                  placeholder={t('providers.form.address_placeholder')}
                  value={editingFournisseur.address} 
                  onChange={e => setEditingFournisseur(f => f ? {...f, address: e.target.value} : null)} 
                  className="textarea textarea-bordered w-full h-24 rounded-xl resize-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                  required 
                />
                <p className="text-[11px] text-gray-400 mt-1">{t('providers.form.address_hint')}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn btn-ghost px-6 rounded-xl" onClick={closeEditModal}>
                {t('providers.form.cancel')}
              </button>
              <button type="submit" className="btn btn-secondary px-8 rounded-xl shadow-lg shadow-secondary/20">
                {t('providers.form.save_btn')}
              </button>
            </div>
          </form>
        )}
      </PremiumModal>

      {/* Finance Modal */}
      {selectedFournisseur && (
          <FinanceFournisseurModal 
            isOpen={isFinanceModalOpen}
            onClose={() => {
                setIsFinanceModalOpen(false);
            }}
            fournisseur={selectedFournisseur}
            onSuccess={fetchFournisseurs}
          />
      )}


      {/* Sudo Mode Password Modal */}
      <PasswordConfirmModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={pendingAction}
        title={passwordModalConfig.title}
        message={passwordModalConfig.message}
      />

    </div>
  );
}
