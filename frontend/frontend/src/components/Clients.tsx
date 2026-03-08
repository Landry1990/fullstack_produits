import React, { useEffect, useState, useMemo, type FormEvent } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { 
  UserPlus, 
  Users, 
  Settings, 
  Trash2, 
  Eye, 
  EyeOff, 
  Search, 
  MoreVertical, 
  X,
  CreditCard,
  Phone,
  MapPin,
  Mail,
  User,
  ShoppingBag,
  History as HistoryIcon,
  ShieldCheck,
  TrendingUp,
  ChevronRight,
  Edit,
  Activity
} from 'lucide-react';
import type { Client } from '../types';
import LoyaltyConfigModal from './LoyaltyConfigModal';
import PremiumModal from './common/PremiumModal';
import { formatCurrency, normalizeNumberInput } from '../utils/formatters'

interface AyantDroit {
  id?: number;
  matricule: string;
  nom: string;
  societe?: string;
  date_creation?: string;
}

interface PurchaseProduct {
  id: number | null;
  nom: string;
  quantite: number;
  prix_unitaire: number;
  total: number;
}

interface PurchaseHistoryItem {
  id: number;
  date: string;
  numero_facture: string;
  total_ttc: number;
  status: string;
  produits: PurchaseProduct[];
}

interface PurchaseHistoryData {
  client_id: number;
  client_name: string;
  total_factures: number;
  factures: PurchaseHistoryItem[];
}



interface ExtendedClient extends Client {
  client_type: 'PARTICULIER' | 'PROFESSIONNEL';
  plafond: string;
  taux_couverture?: string;
  remise_automatique?: string;
  ayants_droit?: AyantDroit[];
  current_debt?: string;
  points_fidelite?: number;
  pending_discount?: string;
  is_loyalty_member?: boolean;
}

const emptyForm: Omit<ExtendedClient, 'id'> = {
  name: '',
  address: '',
  phone: '',
  email: '',
  client_type: 'PARTICULIER',
  plafond: '0',
  taux_couverture: '0',
  remise_automatique: '0',
  ayants_droit: [],
  is_loyalty_member: true
};

export default function Clients() {
  const { t } = useTranslation();
  const [clients, setClients] = useState<ExtendedClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<ExtendedClient | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 50;

  
  // View/Navigation State - REPLACED with Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [newClient, setNewClient] = useState(emptyForm);
  const [editingClient, setEditingClient] = useState<ExtendedClient | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [isLoyaltyConfigOpen, setIsLoyaltyConfigOpen] = useState(false);

  // Purchase History State
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryData | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedInvoice, setExpandedInvoice] = useState<number | null>(null);

  // State for managing Ayants Droit in forms
  const [tempAyantDroit, setTempAyantDroit] = useState<AyantDroit>({ matricule: '', nom: '' });

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL ?? ''),
    []
  );
  const clientsEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/clients/` 
    : '/api/clients/';
  

  // Debounce search term to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Pagination details
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  async function fetchClients() {
    setLoading(true);

    try {
      const response = await axios.get(clientsEndpoint, {
        params: { 
          include_inactive: showInactive,
          page: currentPage,
          search: debouncedSearch
        }
      });
      
      // Handle paginated response structure { count, next, previous, results }
      const data: any = response.data;
      if (data && typeof data === 'object' && 'results' in data) {
         setClients(data.results);
         setTotalCount(data.count || 0);
      } else if (Array.isArray(data)) {
         setClients(data);
         setTotalCount(data.length);
      } else {
         setClients([]);
         setTotalCount(0);
      }
    } catch (err: unknown) {
      if (axios.isCancel(err)) return;
      if (axios.isAxiosError(err)) {
        toast.error(err.response?.data?.message ?? err.message ?? t('clients.messages.network_error'));
      } else {
        toast.error(t('clients.messages.unknown_error'));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClients();
  }, [clientsEndpoint, showInactive, currentPage, debouncedSearch]);

  // Si le client sélectionné disparaît de la liste (ex: suppression), désélectionner
  useEffect(() => {
    if (selectedClient && !clients.some(c => c.id === selectedClient.id)) {
      setSelectedClient(null);
    }
  }, [clients, selectedClient]);

  function handleOpenCreateModal() {
    setNewClient(emptyForm);
    setTempAyantDroit({ matricule: '', nom: '' });
    setIsCreateModalOpen(true);
  }

  function handleOpenEditModal(client: ExtendedClient) {
    setEditingClient(JSON.parse(JSON.stringify(client))); // Deep copy
    setTempAyantDroit({ matricule: '', nom: '' });
    setIsEditModalOpen(true);
  }

  async function fetchPurchaseHistory(clientId: number) {
    setLoadingHistory(true);
    setPurchaseHistory(null);
    setExpandedInvoice(null);
    try {
      const response = await axios.get<PurchaseHistoryData>(`${clientsEndpoint}${clientId}/purchase_history/`);
      setPurchaseHistory(response.data);
    } catch (err) {
      console.error("Error fetching purchase history", err);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function selectClient(client: ExtendedClient) {
    setLoading(true);
    try {
       const response = await axios.get<ExtendedClient>(`${clientsEndpoint}${client.id}/`);
       setSelectedClient(response.data);
       // Fetch purchase history when selecting a client
       fetchPurchaseHistory(client.id);
    } catch (err) {
       console.error("Error fetching details", err);
       setSelectedClient(client);
       fetchPurchaseHistory(client.id);
    } finally {
       setLoading(false);
    }
  }

  function formatBackendErrors(data: unknown): string {
    if (data == null) return t('clients.messages.unknown_error')
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

  // Helper to add Ayant Droit locally
  function addAyantDroitToForm(isEditing: boolean) {
    if (!tempAyantDroit.matricule || !tempAyantDroit.nom) return;
    
    if (isEditing && editingClient) {
      setEditingClient({
        ...editingClient,
        ayants_droit: [...(editingClient.ayants_droit || []), { ...tempAyantDroit }]
      });
    } else {
      setNewClient({
        ...newClient,
        ayants_droit: [...(newClient.ayants_droit || []), { ...tempAyantDroit }]
      });
    }
    setTempAyantDroit({ matricule: '', nom: '' });
  }

  function removeAyantDroitFromForm(index: number, isEditing: boolean) {
    if (isEditing && editingClient) {
      const updated = [...(editingClient.ayants_droit || [])];
      updated.splice(index, 1);
      setEditingClient({ ...editingClient, ayants_droit: updated });
    } else {
      const updated = [...(newClient.ayants_droit || [])];
      updated.splice(index, 1);
      setNewClient({ ...newClient, ayants_droit: updated });
    }
  }

  async function handleAddClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      // Create Client with nested Ayants Droit
      const { data: addedClient } = await axios.post<ExtendedClient>(clientsEndpoint, {
        ...newClient,
        // Ensure ayants_droit is sent if present, even if empty
        ayants_droit: newClient.ayants_droit || []
      });

      // Refresh to get full data
      const { data: refreshedClient } = await axios.get<ExtendedClient>(`${clientsEndpoint}${addedClient.id}/`);
      
      setClients(prev => [refreshedClient, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedClient(refreshedClient);
      setNewClient(emptyForm);
      setIsCreateModalOpen(false);
      toast.success(t('clients.messages.create_success'));
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data ?? err.message
        toast.error(typeof detail === 'string' ? detail : formatBackendErrors(detail))
      } else {
        toast.error(t('clients.messages.error_create'))
      }
      console.error('Erreur lors de l\'ajout du client:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEditClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingClient) return;
    setIsSubmitting(true);
    try {
      // Send Update including nested ayants_droit and taux_couverture
      await axios.patch<ExtendedClient>(
        `${clientsEndpoint}${editingClient.id}/`,
        {
            name: editingClient.name,
            address: editingClient.address,
            phone: editingClient.phone,
            email: editingClient.email,
            client_type: editingClient.client_type,
            plafond: editingClient.plafond,
            taux_couverture: editingClient.taux_couverture,
            remise_automatique: editingClient.remise_automatique,
            ayants_droit: editingClient.ayants_droit,
            is_loyalty_member: editingClient.is_loyalty_member
        }
      );

      // Refresh
      const { data: updatedClient } = await axios.get<ExtendedClient>(`${clientsEndpoint}${editingClient.id}/`);

      setClients(prev => 
        prev.map(c => (c.id === updatedClient.id ? updatedClient : c))
      );
      setSelectedClient(updatedClient);
      setIsEditModalOpen(false);
      toast.success(t('clients.messages.update_success'));
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data ?? err.message
        toast.error(typeof detail === 'string' ? detail : formatBackendErrors(detail))
      } else {
        toast.error(t('clients.messages.error_update'))
      }
      console.error(err);
    } finally {
        setIsSubmitting(false);
    }
  }

  async function handleDeleteClient() {
    if (!selectedClient) return;
    if (window.confirm(t('clients.modals.delete_confirm', { name: selectedClient.name }))) {
      try {
        await axios.delete(`${clientsEndpoint}${selectedClient.id}/`);
        setClients(prev => prev.filter(c => c.id !== selectedClient.id));
        setSelectedClient(null);
        toast.success(t('clients.messages.delete_success'));
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          toast.error(err.response?.data?.message ?? err.message ?? t('clients.messages.network_error'))
        } else {
          toast.error(t('clients.messages.error_delete'))
        }
        console.error(err);
      }
    }
  }

  async function handleToggleActive() {
    if (!selectedClient) return;
    try {
      const response = await axios.post(`${clientsEndpoint}${selectedClient.id}/toggle_active/`);
      const isActive = response.data.is_active;
      toast.success(isActive ? 'Client réactivé' : 'Client masqué');
      setSelectedClient(prev => prev ? ({ ...prev, is_active: isActive }) : null);
      fetchClients();
    } catch (err) {
      toast.error('Erreur lors du changement de statut');
      console.error(err);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    
    const confirmMessage = selectedIds.length === 1 
      ? t('clients.modals.delete_confirm', { name: clients.find(c => c.id === selectedIds[0])?.name })
      : `Êtes-vous sûr de vouloir supprimer ${selectedIds.length} clients ?`;

    if (window.confirm(confirmMessage)) {
      try {
        await axios.post(`${clientsEndpoint}bulk_delete/`, { ids: selectedIds });
        setClients(prev => prev.filter(c => !selectedIds.includes(c.id!)));
        setSelectedIds([]);
        if (selectedClient && selectedIds.includes(selectedClient.id!)) {
            setSelectedClient(null);
        }
        toast.success(`${selectedIds.length} client(s) supprimé(s) avec succès`);
      } catch (err: any) {
        toast.error(err.response?.data?.detail || err.response?.data?.error || "Erreur lors de la suppression groupée");
        console.error(err);
      }
    }
  }

  function toggleSelectAll() {
    if (selectedIds.length === clients.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(clients.map(c => c.id!));
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* LEFT PANEL: CLIENT LIST (1/3) */}
      <div className="w-1/3 border-r border-base-200 bg-base-100 flex flex-col">
          {/* Header & Search */}
           <div className="p-0 border-b border-base-200 bg-base-100 relative z-20 shrink-0 sticky top-0 overflow-visible">
             <div className="p-4 flex flex-col gap-3">
               <div className="flex justify-between items-center h-10">
                  {selectedIds.length > 0 ? (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                      <div className="dropdown dropdown-bottom">
                        <div tabIndex={0} role="button" className="btn btn-sm btn-primary gap-2 h-9">
                          <MoreVertical className="w-4 h-4" />
                          {t('common.actions_title', { defaultValue: 'Actions' })}
                          <span className="badge badge-sm bg-primary-focus border-none text-white">{selectedIds.length}</span>
                        </div>
                        <ul tabIndex={0} className="dropdown-content z-[100] menu p-2 shadow-2xl bg-base-100 rounded-box w-56 border border-base-200 mt-2">
                          <li className="menu-title px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-base-content/40">
                            {t('common.bulk_actions', { defaultValue: 'Actions Groupées' })}
                          </li>
                          <li>
                            <a onClick={handleBulkDelete} className="flex items-center gap-3 py-3 hover:bg-error/10 text-error font-medium">
                              <Trash2 className="w-4 h-4" /> {t('common.delete', 'Supprimer')}
                            </a>
                          </li>
                        </ul>
                      </div>
                      <button 
                        onClick={() => setSelectedIds([])}
                        className="btn btn-sm btn-ghost gap-2 text-base-content/60 hover:text-base-content h-9"
                      >
                        <X className="w-4 h-4" />
                        {t('common.actions.cancel', { defaultValue: 'Annuler' })}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 animate-in fade-in duration-300">
                        <div className="p-2 bg-primary/10 text-primary rounded-lg">
                          <Users className="w-5 h-5" />
                        </div>
                        <h2 className="font-bold text-lg tracking-tight">{t('clients.title')}</h2>
                      </div>
                      <div className="flex gap-1 items-center">
                         <button 
                            className={`btn btn-sm btn-ghost btn-square ${showInactive ? 'bg-base-200 text-base-content' : 'text-base-content/40'}`} 
                            onClick={() => setShowInactive(!showInactive)}
                            title={showInactive ? "Masquer les clients inactifs" : "Afficher les clients inactifs"}
                         >
                            {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                         </button>
                         <button 
                            className="btn btn-sm btn-ghost btn-square text-secondary/60 hover:text-secondary hover:bg-secondary/10" 
                            onClick={() => setIsLoyaltyConfigOpen(true)}
                            title={t('clients.actions.fidelity_config')}
                         >
                            <Settings className="w-4 h-4" />
                         </button>
                         <button 
                            className="btn btn-sm btn-primary gap-2 h-9 px-4 shadow-sm" 
                            onClick={handleOpenCreateModal}
                         >
                            <UserPlus className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('clients.actions.create')}</span>
                         </button>
                      </div>
                    </>
                  )}
               </div>
               <div className="relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 group-focus-within:text-primary transition-colors">
                    <Search className="w-4 h-4" />
                  </span>
                  <input 
                     type="text" 
                     className="input input-sm input-bordered w-full pl-10 h-10 bg-base-200/50 border-transparent focus:border-primary focus:bg-base-100 transition-all rounded-xl" 
                     placeholder={t('clients.filters.search_placeholder')} 
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                  />
               </div>
             </div>
          </div>
          
          {/* List */}
          <div className="flex-1 overflow-y-auto p-2">
             {loading && clients.length === 0 ? (
               <div className="flex justify-center p-8"><span className="loading loading-spinner"></span></div>
             ) : (
                 <ul className="menu bg-base-100 w-full rounded-box p-0">
                   {clients.length > 0 && (
                      <li className="mb-1 border-b border-base-200">
                         <div className="flex items-center gap-3 px-4 py-2 hover:bg-transparent">
                            <input 
                               type="checkbox" 
                               className="checkbox checkbox-sm checkbox-primary"
                               checked={selectedIds.length === clients.length && clients.length > 0}
                               onChange={toggleSelectAll}
                            />
                            <span className="text-xs font-semibold opacity-60 uppercase">Tout sélectionner</span>
                         </div>
                      </li>
                   )}
                   {clients.map(client => (
                      <li key={client.id} className="mb-0.5 last:mb-0 group">
                         <div className="flex items-center p-0 rounded-xl hover:bg-base-200/50 transition-all duration-200">
                            <div className="pl-4 pr-1">
                               <input 
                                  type="checkbox" 
                                  className="checkbox checkbox-xs rounded-md"
                                  checked={selectedIds.includes(client.id!)}
                                  onChange={() => toggleSelect(client.id!)}
                                  onClick={(e) => e.stopPropagation()}
                               />
                            </div>
                            <a 
                               className={`flex-1 flex flex-col items-start gap-0.5 py-2.5 px-3 rounded-xl transition-all ${selectedClient?.id === client.id ? 'bg-primary/10 !text-primary shadow-sm' : ''}`}
                               onClick={() => selectClient(client)}
                            >
                               <div className="flex justify-between items-center w-full">
                                  <span className={`text-sm font-black tracking-tight transition-colors ${selectedClient?.id === client.id ? 'text-primary' : 'text-base-content'}`}>
                                    {client.name}
                                  </span>
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${client.client_type === 'PROFESSIONNEL' ? 'bg-secondary/10 text-secondary' : 'bg-base-200 text-base-content/40'}`}>
                                     {client.client_type === 'PROFESSIONNEL' ? t('clients.types.professional') : t('clients.types.individual')}
                                  </span>
                               </div>
                               <div className="flex items-center gap-1.5 text-[11px] font-medium opacity-40">
                                  <Phone className="w-3 h-3" />
                                  <span className="font-mono">{client.phone || '-- -- -- --'}</span>
                               </div>
                            </a>
                         </div>
                      </li>
                   ))}
                   {clients.length === 0 && (
                      <div className="text-center p-8 text-base-content/50 text-sm">
                         {t('clients.filters.no_results')}
                      </div>
                   )}
                </ul>
              )}
          </div>
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-2 border-t border-base-200 bg-base-100 flex items-center justify-between text-xs shrink-0">
              <span className="text-base-content/60">
                {totalCount} client{totalCount > 1 ? 's' : ''}
              </span>
              <div className="join">
                <button
                  className="join-item btn btn-xs"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >«</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) { page = i + 1; }
                  else if (currentPage <= 3) { page = i + 1; }
                  else if (currentPage >= totalPages - 2) { page = totalPages - 4 + i; }
                  else { page = currentPage - 2 + i; }
                  return (
                    <button
                      key={page}
                      className={`join-item btn btn-xs ${currentPage === page ? 'btn-active btn-primary' : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >{page}</button>
                  );
                })}
                <button
                  className="join-item btn btn-xs"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >»</button>
              </div>
            </div>
          )}
      </div>

      {/* RIGHT PANEL: SELECTED CLIENT DETAILS (2/3) */}
      <div className="w-2/3 bg-base-50 flex flex-col">
         {selectedClient ? (
            <>
               <div className="p-6 border-b border-base-200 bg-base-100/50 backdrop-blur-md flex justify-between items-center sticky top-0 z-10 shrink-0">
                  <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-2xl shadow-inner italic font-black">
                        {selectedClient.name.charAt(0)}
                      </div>
                      <div>
                          <div className="flex items-center gap-2 mb-0.5">
                              <h2 className="text-xl font-black tracking-tight text-base-content">{selectedClient.name}</h2>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${selectedClient.client_type === 'PROFESSIONNEL' ? 'bg-secondary/10 text-secondary' : 'bg-base-200 text-base-content/40'}`}>
                                 {selectedClient.client_type}
                              </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs font-semibold text-base-content/40">
                             <div className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5" />
                                <span className="font-mono">{selectedClient.phone || '-'}</span>
                             </div>
                             <div className="w-1 h-1 bg-base-300 rounded-full"></div>
                             <div className="flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5" />
                                <span>{selectedClient.email || '-'}</span>
                             </div>
                          </div>
                      </div>
                  </div>
                  <div className="flex gap-2">
                     <button 
                        className="btn btn-sm btn-ghost gap-2 h-9 px-4 rounded-xl hover:bg-base-200 text-secondary font-bold" 
                        onClick={() => handleOpenEditModal(selectedClient)}
                     >
                        <Edit className="w-4 h-4" />
                        {t('clients.actions.edit')}
                     </button>
                     <button 
                        className="btn btn-sm btn-ghost gap-2 h-9 px-4 rounded-xl text-error font-bold" 
                        onClick={handleDeleteClient}
                     >
                        <Trash2 className="w-4 h-4" />
                        {t('clients.actions.delete')}
                     </button>
                     <button 
                        className={`btn btn-sm btn-ghost btn-square h-9 rounded-xl ${selectedClient.is_active === false ? 'text-warning' : 'text-slate-400 hover:text-warning'}`}
                        onClick={handleToggleActive}
                        title={selectedClient.is_active === false ? 'Réactiver' : 'Masquer'}
                      >
                         {selectedClient.is_active === false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                  </div>
               </div>

               {/* Details Content */}
               <div className="flex-1 overflow-auto p-6">
                  {/* Grid Layout for details */}
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                       
                       {/* Section 1: Coordonnées & Adresse */}
                       <div className="card bg-base-100 rounded-3xl border border-base-200 shadow-sm overflow-hidden">
                          <div className="p-5 border-b border-base-200 flex items-center gap-2">
                             <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                               <User className="w-4 h-4" />
                             </div>
                             <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                {t('clients.sections.contact')}
                             </h3>
                          </div>
                          <div className="p-5 space-y-4">
                             <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-base-content/30">{t('clients.fields.address')}</span>
                                <div className="flex items-start gap-2 text-sm text-base-content font-bold mt-1">
                                   <MapPin className="w-4 h-4 mt-0.5 text-base-content/20" />
                                   <span className="whitespace-pre-wrap">{selectedClient.address || t('common.no_address')}</span>
                                </div>
                             </div>
                             <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-base-content/30">{t('clients.fields.internal_id')}</span>
                                <span className="font-mono text-sm font-black text-secondary mt-1">#{selectedClient.id}</span>
                             </div>
                          </div>
                       </div>

                       {/* Section 2: Fidélité & Statut (Particulier) */}
                       {selectedClient.client_type === 'PARTICULIER' && (
                          <div className="card bg-base-100 rounded-3xl border border-base-200 shadow-sm overflow-hidden">
                             <div className="p-5 border-b border-base-200 flex items-center gap-2">
                                <div className="p-1.5 bg-secondary/10 text-secondary rounded-lg">
                                  <ShieldCheck className="w-4 h-4" />
                                </div>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                   {t('clients.sections.programs')}
                                </h3>
                             </div>
                             <div className="p-5 grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 p-3 bg-secondary/5 rounded-2xl border border-secondary/10">
                                   <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center text-xl">💎</div>
                                   <div>
                                      <div className="text-[10px] font-black uppercase tracking-widest text-secondary/40">{t('clients.fidelity.points')}</div>
                                      <div className="font-black text-secondary text-lg leading-tight">{selectedClient.points_fidelite || 0}</div>
                                   </div>
                                </div>
                                {Number(selectedClient.pending_discount) > 0 && (
                                    <div className="flex items-center gap-3 p-3 bg-warning/5 rounded-2xl border border-warning/10">
                                       <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center text-xl">🎁</div>
                                       <div>
                                          <div className="text-[10px] font-black uppercase tracking-widest text-warning/40">{t('clients.fidelity.discount')}</div>
                                          <div className="font-black text-warning text-lg leading-tight">-{Number(selectedClient.pending_discount)}%</div>
                                       </div>
                                    </div>
                                )}
                                <div className="col-span-2">
                                   <div className="flex justify-between items-center bg-base-200/50 p-3 rounded-2xl border border-base-300/30">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('clients.fidelity.auto_discount')}</span>
                                      <span className="badge badge-sm font-black bg-primary text-primary-content h-6 px-3">{selectedClient.remise_automatique || 0}%</span>
                                   </div>
                                </div>
                             </div>
                          </div>
                       )}

                       {/* Section 3: Professionnel (Finance & Ayants Droit) */}
                       {selectedClient.client_type === 'PROFESSIONNEL' && (
                          <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
                             {/* Finance */}
                             <div className="card bg-base-100 rounded-3xl border border-base-200 shadow-sm overflow-hidden">
                                <div className="p-5 border-b border-base-200 flex items-center gap-2">
                                   <Activity className="w-4 h-4 text-warning" />
                                   <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                      {t('clients.finance.title')}
                                   </h3>
                                </div>
                                <div className="p-5 grid grid-cols-3 gap-4">
                                   <div className="bg-base-200/50 p-3 rounded-2xl border border-base-300/30 flex flex-col gap-1">
                                      <div className="text-[9px] font-black uppercase tracking-widest text-base-content/30">{t('clients.finance.credit_limit')}</div>
                                       <div className="font-black text-sm text-base-content">{formatCurrency(normalizeNumberInput(selectedClient.plafond || '0'))}</div>
                                    </div>
                                    <div className="bg-base-200/50 p-3 rounded-2xl border border-base-300/30 flex flex-col gap-1">
                                       <div className="text-[9px] font-black uppercase tracking-widest text-base-content/30">{t('clients.finance.debt')}</div>
                                       <div className={`font-black text-sm ${normalizeNumberInput(selectedClient.current_debt || '0') > normalizeNumberInput(selectedClient.plafond || '0') ? 'text-error animate-pulse' : 'text-success'}`}>
                                          {formatCurrency(normalizeNumberInput(selectedClient.current_debt || '0'))}
                                       </div>
                                   </div>
                                   <div className="bg-base-200/50 p-3 rounded-2xl border border-base-300/30 flex flex-col gap-1">
                                      <div className="text-[9px] font-black uppercase tracking-widest text-base-content/30">{t('clients.finance.coverage')}</div>
                                      <div className="font-black text-sm text-info">{Number(selectedClient.taux_couverture || 0)}%</div>
                                   </div>
                                </div>
                             </div>

                             {/* Ayants Droit */}
                             <div className="card bg-base-100 rounded-3xl border border-base-200 shadow-sm overflow-hidden">
                                <div className="p-5 border-b border-base-200 flex items-center gap-2">
                                   <Users className="w-4 h-4 text-secondary" />
                                   <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                      {t('clients.beneficiaries.title')}
                                   </h3>
                                   <span className="badge badge-sm font-black border-none bg-secondary/10 text-secondary ml-auto">{selectedClient.ayants_droit?.length || 0}</span>
                                </div>
                                <div className="overflow-y-auto max-h-[160px]">
                                   <table className="table table-xs w-full">
                                      <thead className="bg-base-200/50 sticky top-0 z-10">
                                         <tr>
                                            <th className="text-[9px] uppercase tracking-widest py-3 text-base-content/40 text-center w-10 px-0">#</th>
                                            <th className="text-[9px] uppercase tracking-widest py-3 text-base-content/40">{t('common.name')}</th>
                                            <th className="text-[9px] uppercase tracking-widest py-3 text-base-content/40 text-right pr-6">Matricule</th>
                                         </tr>
                                      </thead>
                                      <tbody className="divide-y divide-base-200/50">
                                         {selectedClient.ayants_droit && selectedClient.ayants_droit.length > 0 ? (
                                             selectedClient.ayants_droit.map((ad, idx) => (
                                                <tr key={ad.id} className="hover:bg-base-200/20 transition-colors">
                                                   <td className="text-[10px] font-black text-base-content/20 text-center py-3 px-0">{idx + 1}</td>
                                                   <td className="font-black text-sm text-base-content py-3">{ad.nom}</td>
                                                   <td className="text-right font-mono text-[10px] font-black tracking-widest text-secondary py-3 pr-6">
                                                      <span className="bg-secondary/5 px-2 py-1 rounded">
                                                        {ad.matricule}
                                                      </span>
                                                   </td>
                                                </tr>
                                             ))
                                         ) : (
                                             <tr><td colSpan={3} className="text-center text-base-content/20 py-8 italic text-[11px] font-bold uppercase tracking-widest">{t('clients.beneficiaries.empty')}</td></tr>
                                         )}
                                      </tbody>
                                   </table>
                                </div>
                             </div>
                          </div>
                       )}

                        {/* Section 4: Historique des Achats */}
                        {selectedClient && !selectedClient.name.toLowerCase().includes('divers') && (
                        <div className="lg:col-span-2 bg-base-100 rounded-3xl border border-base-200 shadow-sm overflow-hidden flex flex-col">
                           <div className="p-5 border-b border-base-200 flex justify-between items-center bg-base-100">
                              <div className="flex items-center gap-2">
                                 <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                                    <ShoppingBag className="w-4 h-4" />
                                 </div>
                                 <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                    {t('clients.purchase_history.title')}
                                 </h3>
                              </div>
                              {purchaseHistory && (
                                 <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-primary/10 text-primary rounded-full">
                                    {purchaseHistory.total_factures} {t('clients.purchase_history.invoices')}
                                 </span>
                              )}
                           </div>
                           
                           <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[500px]">
                              {loadingHistory ? (
                                 <div className="flex justify-center items-center py-16">
                                    <span className="loading loading-spinner text-primary/20"></span>
                                 </div>
                              ) : purchaseHistory && purchaseHistory.factures.length > 0 ? (
                                 <table className="table table-xs w-full">
                                    <thead className="bg-base-200/50 text-base-content/40 font-black uppercase text-[9px] tracking-widest sticky top-0 z-10">
                                       <tr>
                                          <th className="w-10 text-center py-4"></th>
                                          <th className="py-4">{t('clients.purchase_history.date')}</th>
                                          <th className="py-4">{t('clients.purchase_history.invoice_number')}</th>
                                          <th className="text-right py-4 pr-6">{t('clients.purchase_history.total')}</th>
                                       </tr>
                                    </thead>
                                    <tbody className="divide-y divide-base-200/50">
                                       {purchaseHistory.factures.map(facture => {
                                           const isExpanded = expandedInvoice === facture.id;
                                           const dateObj = new Date(facture.date);
                                           const formattedDate = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
                                           const formattedTime = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                                           
                                           return (
                                           <React.Fragment key={facture.id}>
                                              <tr 
                                                 className={`hover:bg-primary/5 cursor-pointer transition-colors duration-200 ${isExpanded ? 'bg-primary/5' : ''}`}
                                                 onClick={() => setExpandedInvoice(isExpanded ? null : facture.id)}
                                              >
                                                 <td className="text-center text-base-content/20">
                                                    <ChevronRight className={`w-3.5 h-3.5 transform transition-transform duration-200 ${isExpanded ? 'rotate-90 text-primary' : ''}`} />
                                                 </td>
                                                 <td className="py-4">
                                                     <div className="flex flex-col">
                                                         <span className="font-black text-sm text-base-content">{formattedDate}</span>
                                                         <span className="text-[10px] font-bold opacity-30">{formattedTime}</span>
                                                     </div>
                                                 </td>
                                                 <td className="py-4">
                                                     <span className="text-[10px] font-black font-mono tracking-widest px-2 py-0.5 bg-base-200 text-base-content/60 rounded-md">
                                                         {facture.numero_facture}
                                                     </span>
                                                 </td>
                                                 <td className="text-right py-4 pr-6">
                                                    <span className="font-black text-sm text-base-content">
                                                       {formatCurrency(facture.total_ttc)}
                                                    </span>
                                                 </td>
                                              </tr>
                                              {isExpanded && (
                                                 <tr className="bg-base-200/20">
                                                    <td colSpan={4} className="p-0">
                                                         <div className="p-6 pl-14 space-y-4 animate-in fade-in slide-in-from-top-1">
                                                             <div className="flex items-center gap-2">
                                                                <div className="h-px bg-base-300 flex-1"></div>
                                                                <h4 className="text-[9px] font-black text-base-content/30 uppercase tracking-widest">{t('common.details', 'Détails')}</h4>
                                                                <div className="h-px bg-base-300 flex-1"></div>
                                                             </div>
                                                             <div className="bg-base-100 rounded-3xl border border-base-200 overflow-hidden shadow-sm">
                                                                <table className="table table-xs w-full">
                                                                  <tbody className="divide-y divide-base-200/50">
                                                                      {facture.produits.map((prod, idx) => (
                                                                          <tr key={idx} className="hover:bg-base-200/10 transition-colors">
                                                                              <td className="w-8 pl-5 py-3">
                                                                                 <span className="w-6 h-6 rounded-lg bg-base-200 border border-base-300 flex items-center justify-center text-[10px] font-black text-base-content/60 shadow-inner">{prod.quantite}</span>
                                                                              </td>
                                                                              <td className="max-w-[200px] truncate">
                                                                                 <div className="text-xs font-black text-base-content">{prod.nom}</div>
                                                                                 <div className="text-[9px] opacity-30 font-bold uppercase tracking-tighter">Article de vente</div>
                                                                              </td>
                                                                              <td className="text-right pr-6 font-mono text-xs font-black text-primary py-3">
                                                                                  {formatCurrency(prod.total)}
                                                                              </td>
                                                                          </tr>
                                                                      ))}
                                                                  </tbody>
                                                                </table>
                                                             </div>
                                                         </div>
                                                    </td>
                                                 </tr>
                                              )}
                                           </React.Fragment>
                                           );
                                       })}
                                    </tbody>
                                 </table>
                              ) : (
                                 <div className="flex flex-col items-center justify-center py-20 text-center opacity-10 grayscale">
                                    <ShoppingBag className="w-16 h-16 mb-4" />
                                    <h4 className="text-xs font-black uppercase tracking-widest">{t('clients.purchase_history.empty')}</h4>
                                 </div>
                              )}
                           </div>
                        </div>
                        )}
                   </div>
               </div>
            </>
         ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-base-content/30 bg-base-200/30">
                <div className="w-24 h-24 bg-base-200 rounded-full flex items-center justify-center text-4xl mb-4">
                   👥
                </div>
                <p className="text-lg font-medium">{t('clients.filters.select_prompt_title')}</p>
                <p className="text-sm">{t('clients.filters.select_prompt_subtitle')}</p>
            </div>
         )}
      </div>

      {/* MODAL: CREATION CLIENT */}
      <PremiumModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('clients.modals.create_title')}
        icon={<span className="text-primary text-xl">👥</span>}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button type="button" className="btn btn-base-200" onClick={() => setIsCreateModalOpen(false)} disabled={isSubmitting}>
              {t('clients.actions.cancel')}
            </button>
            <button type="submit" form="create-client-form" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : t('clients.actions.create')}
            </button>
          </div>
        }
      >
        <div className="p-6">
             <form id="create-client-form" onSubmit={handleAddClient} className="flex flex-col gap-4">
                {/* Type Client */}
                <div className="form-control">
                    <label className="label cursor-pointer justify-start gap-4">
                        <span className="label-text font-semibold">{t('clients.types.title')}:</span>
                        <label className="label cursor-pointer gap-2">
                            <input 
                                type="radio" 
                                name="client_type" 
                                className="radio radio-primary" 
                                checked={newClient.client_type === 'PARTICULIER'}
                                onChange={() => setNewClient({...newClient, client_type: 'PARTICULIER'})} 
                            />
                            <span className="label-text">{t('clients.types.individual')}</span>
                        </label>
                        <label className="label cursor-pointer gap-2">
                            <input 
                                type="radio" 
                                name="client_type" 
                                className="radio radio-secondary" 
                                checked={newClient.client_type === 'PROFESSIONNEL'}
                                onChange={() => setNewClient({...newClient, client_type: 'PROFESSIONNEL'})} 
                            />
                            <span className="label-text">{t('clients.types.professional')}</span>
                        </label>
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="form-control w-full">
                       <span className="label-text font-medium">{t('clients.fields.name')} *</span>
                       <input type="text" placeholder="Ex: Jean Dupont" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} className="input input-bordered w-full" required disabled={isSubmitting}/>
                    </label>
                    <label className="form-control w-full">
                       <span className="label-text font-medium">{t('clients.fields.phone')} *</span>
                       <input type="tel" placeholder="Ex: 0123456789" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} className="input input-bordered w-full" required disabled={isSubmitting}/>
                    </label>
                </div>
                
                <label className="form-control w-full">
                    <span className="label-text font-medium">Adresse email *</span>
                    <input type="email" placeholder="Ex: jean.dupont@email.com" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} className="input input-bordered w-full" required disabled={isSubmitting}/>
                </label>

                <label className="form-control w-full">
                    <span className="label-text font-medium">Adresse complète *</span>
                    <textarea placeholder="Ex: 123 Rue de la Paix" value={newClient.address} onChange={e => setNewClient({...newClient, address: e.target.value})} className="textarea textarea-bordered w-full h-20 resize-none" required disabled={isSubmitting}/>
                </label>

                {newClient.client_type === 'PARTICULIER' && (
                    <div className="form-control bg-base-200 rounded-lg p-3">
                        <label className="label cursor-pointer justify-between">
                            <div>
                                <span className="label-text font-bold text-secondary flex items-center gap-2">💎 {t('clients.fidelity.program_title')}</span>
                                <div className="text-xs opacity-60 mt-1">{t('clients.fidelity.program_desc')}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="label-text text-xs">{newClient.is_loyalty_member !== false ? t('clients.fidelity.status_active') : t('clients.fidelity.status_inactive')}</span>
                                <input 
                                    type="checkbox" 
                                    className="toggle toggle-secondary" 
                                    checked={newClient.is_loyalty_member ?? true}
                                    onChange={e => setNewClient({...newClient, is_loyalty_member: e.target.checked})} 
                                />
                            </div>
                        </label>
                    </div>
                )}

                <label className="form-control w-full">
                    <div className="label">
                        <span className="label-text font-medium">{t('clients.fidelity.auto_discount')}</span>
                        <span className="label-text-alt text-success">{t('clients.fidelity.auto_discount_hint')}</span>
                    </div>
                    <input 
                        type="number" 
                        value={newClient.remise_automatique || '0'} 
                        onChange={e => setNewClient({...newClient, remise_automatique: e.target.value})} 
                        className="input input-bordered w-full" 
                        min="0" 
                        max="100"
                        step="0.01"
                        placeholder="0"
                    />
                </label>

                {newClient.client_type === 'PROFESSIONNEL' && (
                    <div className="bg-base-200 p-4 rounded-lg space-y-4">
                        <h4 className="font-bold text-secondary">{t('clients.finance.pro_info_title')}</h4>
                        
                        <label className="form-control w-full">
                            <span className="label-text font-medium">{t('clients.finance.credit_limit')}</span>
                            <input type="number" value={newClient.plafond} onChange={e => setNewClient({...newClient, plafond: e.target.value})} className="input input-bordered w-full" min="0"/>
                        </label>
                        
                        <label className="form-control w-full">
                            <div className="label">
                                <span className="label-text font-medium">{t('clients.finance.coverage_rate')}</span>
                                <span className="label-text-alt text-info">{t('clients.finance.coverage_hint')}</span>
                            </div>
                            <input 
                                type="number" 
                                value={newClient.taux_couverture || '0'} 
                                onChange={e => setNewClient({...newClient, taux_couverture: e.target.value})} 
                                className="input input-bordered w-full" 
                                min="0" 
                                max="100"
                                step="0.01"
                            />
                        </label>

                        <div className="divider">{t('clients.beneficiaries.title')}</div>
                        
                        <div className="flex gap-2 items-end">
                            <label className="form-control flex-1">
                                <span className="label-text text-xs">{t('clients.beneficiaries.name')}</span>
                                <input type="text" value={tempAyantDroit.nom} onChange={e => setTempAyantDroit({...tempAyantDroit, nom: e.target.value})} className="input input-bordered input-sm" placeholder={t('clients.beneficiaries.placeholder_name')}/>
                            </label>
                            <label className="form-control flex-1">
                                <span className="label-text text-xs">{t('clients.beneficiaries.id')}</span>
                                <input type="text" value={tempAyantDroit.matricule} onChange={e => setTempAyantDroit({...tempAyantDroit, matricule: e.target.value})} className="input input-bordered input-sm" placeholder={t('clients.beneficiaries.placeholder_id')}/>
                            </label>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addAyantDroitToForm(false)}>{t('clients.actions.add_beneficiary')}</button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="table table-xs bg-base-100">
                                <thead><tr><th>{t('clients.beneficiaries.name')}</th><th>{t('clients.beneficiaries.id')}</th><th>Action</th></tr></thead>
                                <tbody>
                                    {newClient.ayants_droit?.map((ad, idx) => (
                                        <tr key={idx}>
                                            <td>{ad.nom}</td>
                                            <td>{ad.matricule}</td>
                                            <td><button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => removeAyantDroitFromForm(idx, false)}>{t('clients.actions.remove_beneficiary')}</button></td>
                                        </tr>
                                    ))}
                                    {(!newClient.ayants_droit || newClient.ayants_droit.length === 0) && (
                                        <tr><td colSpan={3} className="text-center text-base-content/50">{t('clients.beneficiaries.empty')}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

             </form>
        </div>
      </PremiumModal>

      {/* MODAL: EDITION CLIENT */}
      <PremiumModal
        isOpen={isEditModalOpen && !!editingClient}
        onClose={() => setIsEditModalOpen(false)}
        title={t('clients.modals.edit_title')}
        icon={<span className="text-primary text-xl">✏️</span>}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <button type="button" className="btn btn-base-200" onClick={() => setIsEditModalOpen(false)} disabled={isSubmitting}>
              {t('clients.actions.cancel')}
            </button>
            <button type="submit" form="edit-client-form" className="btn btn-primary" disabled={isSubmitting}>
               {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : t('common.save', { defaultValue: 'Enregistrer' })}
            </button>
          </div>
        }
      >
        <div className="p-6">
             {editingClient && (
             <form id="edit-client-form" onSubmit={handleEditClient} className="flex flex-col gap-4">
                     <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-4">
                            <span className="label-text font-semibold">{t('clients.types.title')}:</span>
                            <label className="label cursor-pointer gap-2">
                                <input 
                                    type="radio" 
                                    name="edit_client_type" 
                                    className="radio radio-primary" 
                                    checked={editingClient.client_type === 'PARTICULIER'}
                                    onChange={() => setEditingClient({...editingClient, client_type: 'PARTICULIER'})} 
                                />
                                <span className="label-text">{t('clients.types.individual')}</span>
                            </label>
                            <label className="label cursor-pointer gap-2">
                                <input 
                                    type="radio" 
                                    name="edit_client_type" 
                                    className="radio radio-secondary" 
                                    checked={editingClient.client_type === 'PROFESSIONNEL'}
                                    onChange={() => setEditingClient({...editingClient, client_type: 'PROFESSIONNEL'})} 
                                />
                                <span className="label-text">{t('clients.types.professional')}</span>
                            </label>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="form-control w-full">
                            <span className="label-text font-medium">{t('clients.fields.name')} *</span>
                            <input type="text" value={editingClient.name} onChange={e => setEditingClient({...editingClient, name: e.target.value})} className="input input-bordered w-full" required/>
                        </label>
                        <label className="form-control w-full">
                            <span className="label-text font-medium">{t('clients.fields.phone')} *</span>
                            <input type="tel" value={editingClient.phone} onChange={e => setEditingClient({...editingClient, phone: e.target.value})} className="input input-bordered w-full" required/>
                        </label>
                    </div>
                    
                    <label className="form-control w-full">
                        <span className="label-text font-medium">{t('clients.fields.email')} *</span>
                        <input type="email" value={editingClient.email} onChange={e => setEditingClient({...editingClient, email: e.target.value})} className="input input-bordered w-full" required/>
                    </label>

                    <label className="form-control w-full">
                        <span className="label-text font-medium">{t('clients.fields.address')} *</span>
                        <textarea value={editingClient.address} onChange={e => setEditingClient({...editingClient, address: e.target.value})} className="textarea textarea-bordered w-full h-20 resize-none" required/>
                    </label>

                    {editingClient.client_type === 'PARTICULIER' && (
                        <div className="form-control bg-base-200 rounded-lg p-3">
                            <label className="label cursor-pointer justify-between">
                                <div>
                                    <span className="label-text font-bold text-secondary flex items-center gap-2">💎 {t('clients.fidelity.program_title')}</span>
                                    <div className="text-xs opacity-60 mt-1">{t('clients.fidelity.program_desc')}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="label-text text-xs">{editingClient.is_loyalty_member !== false ? t('clients.fidelity.status_active') : t('clients.fidelity.status_inactive')}</span>
                                    <input 
                                        type="checkbox" 
                                        className="toggle toggle-secondary" 
                                        checked={editingClient.is_loyalty_member ?? true}
                                        onChange={e => setEditingClient({...editingClient, is_loyalty_member: e.target.checked})} 
                                    />
                                </div>
                            </label>
                        </div>
                    )}

                    <label className="form-control w-full">
                        <div className="label">
                            <span className="label-text font-medium">{t('clients.fidelity.auto_discount')}</span>
                            <span className="label-text-alt text-success">{t('clients.fidelity.auto_discount_hint')}</span>
                        </div>
                        <input 
                            type="number" 
                            value={editingClient.remise_automatique || '0'} 
                            onChange={e => setEditingClient({...editingClient, remise_automatique: e.target.value})} 
                            className="input input-bordered w-full" 
                            min="0" 
                            max="100"
                            step="0.01"
                        />
                    </label>

                    {editingClient.client_type === 'PROFESSIONNEL' && (
                        <div className="bg-base-200 p-4 rounded-lg space-y-4">
                            <h4 className="font-bold text-secondary">{t('clients.finance.pro_info_title')}</h4>
                            
                            <label className="form-control w-full">
                                <span className="label-text font-medium">{t('clients.finance.credit_limit')}</span>
                                <input type="number" value={editingClient.plafond} onChange={e => setEditingClient({...editingClient, plafond: e.target.value})} className="input input-bordered w-full" min="0"/>
                            </label>
                            
                            <label className="form-control w-full">
                                <div className="label">
                                    <span className="label-text font-medium">{t('clients.finance.coverage_rate')}</span>
                                    <span className="label-text-alt text-info">{t('clients.finance.coverage_hint')}</span>
                                </div>
                                <input 
                                    type="number" 
                                    value={editingClient.taux_couverture || '0'} 
                                    onChange={e => setEditingClient({...editingClient, taux_couverture: e.target.value})} 
                                    className="input input-bordered w-full" 
                                    min="0" 
                                    max="100"
                                    step="0.01"
                                />
                            </label>

                            <div className="divider">{t('clients.beneficiaries.title')}</div>
                            
                            <div className="flex gap-2 items-end">
                                <label className="form-control flex-1">
                                    <span className="label-text text-xs">{t('clients.beneficiaries.name')}</span>
                                    <input type="text" value={tempAyantDroit.nom} onChange={e => setTempAyantDroit({...tempAyantDroit, nom: e.target.value})} className="input input-bordered input-sm" placeholder={t('clients.beneficiaries.placeholder_name')}/>
                                </label>
                                <label className="form-control flex-1">
                                    <span className="label-text text-xs">{t('clients.beneficiaries.id')}</span>
                                    <input type="text" value={tempAyantDroit.matricule} onChange={e => setTempAyantDroit({...tempAyantDroit, matricule: e.target.value})} className="input input-bordered input-sm" placeholder={t('clients.beneficiaries.placeholder_id')}/>
                                </label>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => addAyantDroitToForm(true)}>{t('clients.actions.add_beneficiary')}</button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="table table-xs bg-base-100">
                                    <thead><tr><th>{t('clients.beneficiaries.name')}</th><th>{t('clients.beneficiaries.id')}</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {editingClient.ayants_droit?.map((ad, idx) => (
                                            <tr key={idx}>
                                                <td>{ad.nom}</td>
                                                <td>{ad.matricule}</td>
                                                <td><button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => removeAyantDroitFromForm(idx, true)}>{t('clients.actions.remove_beneficiary')}</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </form>
             )}
        </div>
      </PremiumModal>
      <LoyaltyConfigModal isOpen={isLoyaltyConfigOpen} onClose={() => setIsLoyaltyConfigOpen(false)} />
    </div>
  );
}