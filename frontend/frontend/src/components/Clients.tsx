import { useEffect, useState, useMemo, type FormEvent } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';

import type { Client } from '../types';
import LoyaltyConfigModal from './LoyaltyConfigModal';

interface AyantDroit {
  id?: number;
  matricule: string;
  nom: string;
  societe?: string;
  date_creation?: string;
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

  
  // View/Navigation State - REPLACED with Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [newClient, setNewClient] = useState(emptyForm);
  const [editingClient, setEditingClient] = useState<ExtendedClient | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoyaltyConfigOpen, setIsLoyaltyConfigOpen] = useState(false);

  // State for managing Ayants Droit in forms
  const [tempAyantDroit, setTempAyantDroit] = useState<AyantDroit>({ matricule: '', nom: '' });

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL ?? ''),
    []
  );
  const clientsEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/clients/` 
    : '/api/clients/';
  


  // Filtrer les clients selon le terme de recherche
  const filteredClients = useMemo(() => {
    // Only filter if there is a search term
    if (!searchTerm.trim()) return clients;
    
    const term = searchTerm.toLowerCase();
    return clients.filter(client => 
      client.name.toLowerCase().includes(term) ||
      client.email.toLowerCase().includes(term) ||
      client.phone.includes(term) ||
      client.address.toLowerCase().includes(term)
    );
  }, [clients, searchTerm]);

  async function fetchClients() {
    setLoading(true);

    try {
      const response = await axios.get(clientsEndpoint);
      // Handle both paginated and non-paginated responses
      const data: any = response.data;
      setClients(Array.isArray(data) ? data : (data.results || []));
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
  }, [clientsEndpoint]);

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

  async function selectClient(client: ExtendedClient) {
    // Just set selected, no API call needed if list has full data, but let's refresh details to be safe or just use list data
    // Optimizing: If list data is enough, use it. But often list is summary. 
    // Given the previous code fetched details, let's keep fetching or just use what we have if it's full.
    // The previous code fetched details.
    setLoading(true);
    try {
       const response = await axios.get<ExtendedClient>(`${clientsEndpoint}${client.id}/`);
       setSelectedClient(response.data);
    } catch (err) {
       console.error("Error fetching details", err);
       // Fallback to local data
       setSelectedClient(client);
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

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* LEFT PANEL: CLIENT LIST (1/3) */}
      <div className="w-1/3 border-r border-base-200 bg-base-100 flex flex-col">
          {/* Header & Search */}
           <div className="p-4 border-b border-base-200 flex flex-col gap-3 bg-base-100 relative z-10 shrink-0">
             <div className="flex justify-between items-center">
                <h2 className="font-bold text-xl">{t('clients.title')}</h2>
                <div className="flex gap-1">
                   <button 
                      className="btn btn-sm btn-ghost btn-square text-secondary" 
                      onClick={() => setIsLoyaltyConfigOpen(true)}
                      title={t('clients.actions.fidelity_config')}
                   >
                      💎
                   </button>
                   <button 
                      className="btn btn-sm btn-primary" 
                      onClick={handleOpenCreateModal}
                   >
                      + {t('clients.actions.create')}
                   </button>
                </div>
             </div>
             <div className="relative">
                <input 
                   type="text" 
                   className="input input-bordered w-full pl-9" 
                   placeholder={t('clients.filters.search_placeholder')} 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                />
                <span className="absolute left-3 top-3 opacity-50">🔍</span>
             </div>
          </div>
          
          {/* List */}
          <div className="flex-1 overflow-y-auto p-2">
             {loading && clients.length === 0 ? (
               <div className="flex justify-center p-8"><span className="loading loading-spinner"></span></div>
             ) : (
                <ul className="menu bg-base-100 w-full rounded-box p-0">
                   {filteredClients.map(client => (
                      <li key={client.id} className="mb-1 border-b border-base-100 last:border-0">
                         <a 
                           className={`flex flex-col items-start gap-1 py-3 ${selectedClient?.id === client.id ? 'active' : ''}`}
                           onClick={() => selectClient(client)}
                         >
                            <div className="flex justify-between w-full">
                               <span className="font-bold text-base">{client.name}</span>
                               <span className={`badge badge-sm ${client.client_type === 'PROFESSIONNEL' ? 'badge-secondary' : 'badge-ghost'}`}>
                                  {client.client_type === 'PROFESSIONNEL' ? t('clients.types.professional') : t('clients.types.individual')}
                               </span>
                            </div>
                            <div className="flex justify-between w-full text-sm opacity-70">
                               <span className="font-mono">{client.phone}</span>
                            </div>
                         </a>
                      </li>
                   ))}
                   {filteredClients.length === 0 && (
                      <div className="text-center p-8 text-base-content/50 text-sm">
                         {t('clients.filters.no_results')}
                      </div>
                   )}
                </ul>
             )}
          </div>
      </div>

      {/* RIGHT PANEL: SELECTED CLIENT DETAILS (2/3) */}
      <div className="w-2/3 bg-base-50 flex flex-col">
         {selectedClient ? (
            <>
               {/* Details Header */}
               <div className="p-6 border-b border-base-200 bg-white/50 flex justify-between items-start">
                  <div>
                      <div className="flex items-center gap-2 mb-1">
                          <h2 className="text-2xl font-bold">{selectedClient.name}</h2>
                          <span className={`badge ${selectedClient.client_type === 'PROFESSIONNEL' ? 'badge-secondary' : 'badge-neutral'}`}>
                             {selectedClient.client_type}
                          </span>
                      </div>
                      <div className="text-sm opacity-60 flex gap-4">
                          <span>📧 {selectedClient.email || '-'}</span>
                          <span>📞 {selectedClient.phone || '-'}</span>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <button 
                        className="btn btn-ghost btn-sm text-secondary"
                        onClick={() => handleOpenEditModal(selectedClient)}
                      >
                         ✏️ {t('clients.actions.edit')}
                      </button>
                      <button 
                        className="btn btn-ghost btn-sm text-error"
                        onClick={handleDeleteClient}
                      >
                         🗑️ {t('clients.actions.delete')}
                      </button>
                  </div>
               </div>

               {/* Details Content */}
               <div className="flex-1 overflow-auto p-6">
                  {/* Grid Layout for details */}
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                       
                       {/* Section 1: Coordonnées & Adresse */}
                       <div className="card bg-white shadow-sm border border-base-200">
                          <div className="card-body p-4">
                             <h3 className="card-title text-sm uppercase opacity-50 mb-2 border-b pb-2">{t('clients.sections.contact')}</h3>
                             <div className="space-y-3 text-sm">
                                <div className="flex flex-col">
                                   <span className="font-bold text-xs opacity-60">{t('clients.fields.address')}</span>
                                   <span className="whitespace-pre-wrap">{selectedClient.address || '-'}</span>
                                </div>
                                <div className="flex flex-col">
                                   <span className="font-bold text-xs opacity-60">{t('clients.fields.internal_id')}</span>
                                   <span className="font-mono">#{selectedClient.id}</span>
                                </div>
                             </div>
                          </div>
                       </div>

                       {/* Section 2: Fidélité & Statut (Particulier) */}
                       {selectedClient.client_type === 'PARTICULIER' && (
                          <div className="card bg-white shadow-sm border border-base-200">
                             <div className="card-body p-4">
                                <h3 className="card-title text-sm uppercase opacity-50 mb-2 border-b pb-2">{t('clients.sections.programs')}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-xl">💎</div>
                                      <div>
                                         <div className="text-xs opacity-60">{t('clients.fidelity.points')}</div>
                                         <div className="font-bold text-accent text-lg">{selectedClient.points_fidelite || 0}</div>
                                      </div>
                                   </div>
                                   {Number(selectedClient.pending_discount) > 0 && (
                                       <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center text-xl">🎁</div>
                                          <div>
                                             <div className="text-xs opacity-60">{t('clients.fidelity.discount')}</div>
                                             <div className="font-bold text-warning text-lg">-{Number(selectedClient.pending_discount)}%</div>
                                          </div>
                                       </div>
                                   )}
                                   <div className="col-span-2">
                                      <div className="flex justify-between items-center bg-base-50 p-2 rounded">
                                         <span className="text-xs font-semibold">{t('clients.fidelity.auto_discount')}</span>
                                         <span className="badge badge-sm">{selectedClient.remise_automatique || 0}%</span>
                                      </div>
                                   </div>
                                </div>
                             </div>
                          </div>
                       )}

                       {/* Section 3: Professionnel (Finance & Ayants Droit) */}
                       {selectedClient.client_type === 'PROFESSIONNEL' && (
                          <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
                             {/* Finance */}
                             <div className="card bg-white shadow-sm border border-base-200">
                                <div className="card-body p-4">
                                   <h3 className="card-title text-sm uppercase opacity-50 mb-2 border-b pb-2">{t('clients.finance.title')}</h3>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                      <div className="bg-base-50 p-2 rounded">
                                         <div className="text-xs opacity-60">{t('clients.finance.credit_limit')}</div>
                                         <div className="font-bold">{Number(selectedClient.plafond || 0).toLocaleString()} F</div>
                                      </div>
                                      <div className="bg-base-50 p-2 rounded">
                                         <div className="text-xs opacity-60">{t('clients.finance.debt')}</div>
                                         <div className={`font-bold ${Number(selectedClient.current_debt) > Number(selectedClient.plafond) ? 'text-error' : 'text-success'}`}>
                                            {Number(selectedClient.current_debt || 0).toLocaleString()} F
                                         </div>
                                      </div>
                                      <div className="bg-base-50 p-2 rounded">
                                         <div className="text-xs opacity-60">{t('clients.finance.coverage')}</div>
                                         <div className="font-bold text-info">{Number(selectedClient.taux_couverture || 0)}%</div>
                                      </div>
                                   </div>
                                </div>
                             </div>

                             {/* Ayants Droit */}
                             <div className="card bg-white shadow-sm border border-base-200">
                                <div className="card-body p-4">
                                   <h3 className="card-title text-sm uppercase opacity-50 mb-2 border-b pb-2">
                                      {t('clients.beneficiaries.title')} ({selectedClient.ayants_droit?.length || 0})
                                   </h3>
                                   <div className="overflow-y-auto max-h-40">
                                      <table className="table table-xs">
                                         <tbody>
                                            {selectedClient.ayants_droit && selectedClient.ayants_droit.length > 0 ? (
                                                selectedClient.ayants_droit.map(ad => (
                                                   <tr key={ad.id}>
                                                      <td className="font-bold">{ad.nom}</td>
                                                      <td className="text-right font-mono bg-base-50 px-2 rounded">{ad.matricule}</td>
                                                   </tr>
                                                ))
                                            ) : (
                                                <tr><td className="text-center text-base-content/50 py-4">{t('clients.beneficiaries.empty')}</td></tr>
                                            )}
                                         </tbody>
                                      </table>
                                   </div>
                                </div>
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
      {isCreateModalOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box w-11/12 max-w-3xl">
            <h3 className="font-bold text-lg mb-4">{t('clients.modals.create_title')}</h3>
             <form onSubmit={handleAddClient} className="flex flex-col gap-4">
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

                <div className="modal-action">
                    <button type="button" className="btn btn-ghost" onClick={() => setIsCreateModalOpen(false)} disabled={isSubmitting}>{t('clients.actions.cancel')}</button>
                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                        {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : t('clients.actions.create')}
                    </button>
                </div>
             </form>
          </div>
          <div className="modal-backdrop" onClick={() => setIsCreateModalOpen(false)}></div>
        </dialog>
      )}

      {/* MODAL: EDITION CLIENT */}
      {isEditModalOpen && editingClient && (
        <dialog className="modal modal-open">
            <div className="modal-box w-11/12 max-w-3xl">
                <h3 className="font-bold text-lg mb-4">{t('clients.modals.edit_title')}</h3>
                <form onSubmit={handleEditClient} className="flex flex-col gap-4">
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

                    <div className="modal-action">
                        <button type="button" className="btn btn-ghost" onClick={() => setIsEditModalOpen(false)}>{t('clients.actions.cancel')}</button>
                        <button type="submit" className="btn btn-primary">{t('clients.actions.create')}</button>
                    </div>
                </form>
            </div>
            <div className="modal-backdrop" onClick={() => setIsEditModalOpen(false)}></div>
        </dialog>
      )}
      <LoyaltyConfigModal isOpen={isLoyaltyConfigOpen} onClose={() => setIsLoyaltyConfigOpen(false)} />
    </div>
  );
}