import { useEffect, useState, useMemo, type FormEvent, useRef } from 'react';
import axios from 'axios';

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
  const [clients, setClients] = useState<ExtendedClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<ExtendedClient | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // View/Navigation State
  const [viewMode, setViewMode] = useState<'LIST' | 'DETAILS' | 'CREATE' | 'EDIT'>('LIST');

  const [newClient, setNewClient] = useState(emptyForm);
  const [editingClient, setEditingClient] = useState<ExtendedClient | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
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
    setError(null);
    try {
      const response = await axios.get(clientsEndpoint);
      // Handle both paginated and non-paginated responses
      const data: any = response.data;
      setClients(Array.isArray(data) ? data : (data.results || []));
    } catch (err: unknown) {
      if (axios.isCancel(err)) return;
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? err.message ?? 'Erreur réseau');
      } else {
        setError('Erreur inconnue lors du chargement des clients');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClients();
  }, [clientsEndpoint]);

  // Si le client sélectionné disparaît de la liste (ex: suppression), retour liste
  useEffect(() => {
    if (selectedClient && !clients.some(c => c.id === selectedClient.id)) {
      setSelectedClient(null);
      if (viewMode === 'DETAILS' || viewMode === 'EDIT') {
          setViewMode('LIST');
      }
    }
  }, [clients, selectedClient, viewMode]);

  function openCreateView() {
    setNewClient(emptyForm);
    setTempAyantDroit({ matricule: '', nom: '' });
    setViewMode('CREATE');
  }

  function handleBackToList() {
    setViewMode('LIST');
    setSelectedClient(null);
    setError(null);
  }

  // Fonctions de navigation au clavier
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!searchTerm) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredClients.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredClients.length) {
          const client = filteredClients[highlightedIndex];
          setSelectedClient(client);
          setViewMode('DETAILS');
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

  function selectClient(client: ExtendedClient) {
    setSelectedClient(client);
    setViewMode('DETAILS');
    setSearchTerm('');
    setHighlightedIndex(-1);
  }

  function openEditView() {
    if (!selectedClient) return;
    setEditingClient(JSON.parse(JSON.stringify(selectedClient))); // Deep copy
    setTempAyantDroit({ matricule: '', nom: '' });
    setViewMode('EDIT');
  }

  function formatBackendErrors(data: unknown): string {
    if (data == null) return 'Erreur inconnue du serveur'
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
    setError(null);
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
      setViewMode('DETAILS'); // Go to details of created client
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data ?? err.message
        setError(typeof detail === 'string' ? detail : formatBackendErrors(detail))
      } else {
        setError("Erreur inconnue lors de l'ajout du client")
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
      setViewMode('DETAILS'); // Return to details
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data ?? err.message
        setError(typeof detail === 'string' ? detail : formatBackendErrors(detail))
      } else {
        setError("Erreur inconnue lors de la modification du client")
      }
      console.error(err);
    } finally {
        setIsSubmitting(false);
    }
  }

  async function handleDeleteClient() {
    if (!selectedClient) return;
    if (window.confirm(`Supprimer le client "${selectedClient.name}" ?`)) {
      try {
        await axios.delete(`${clientsEndpoint}${selectedClient.id}/`);
        setClients(prev => prev.filter(c => c.id !== selectedClient.id));
        setSelectedClient(null);
        setViewMode('LIST');
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.message ?? err.message ?? 'Erreur réseau')
        } else {
          setError('Erreur inconnue lors de la suppression du client')
        }
        console.error(err);
      }
    }
  }

  return (
    <>
      <h1 className="text-3xl font-bold mb-4 text-center">Gestion des Clients</h1>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {/* VUE LISTE */}
      {viewMode === 'LIST' && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title">Liste des clients</h2>
              <div className="card-actions">
                {loading && <span className="loading loading-spinner loading-sm" />}
                <button className="btn btn-ghost btn-sm text-secondary gap-2 mr-2" onClick={() => setIsLoyaltyConfigOpen(true)}>
                    <span className="text-lg">💎</span> Config.
                </button>
                <button className="btn btn-primary" onClick={openCreateView}>+ Ajouter</button>
              </div>
            </div>
            
            {/* Champ de recherche */}
            <div className="form-control mb-4">
              <div className="input-group">
                <input 
                  ref={searchInputRef}
                  type="text" 
                  placeholder="Rechercher un client..." 
                  className="input input-bordered flex-1" 
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setHighlightedIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
                <button className="btn btn-square" type="button">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-zebra table-hover table-xs">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Type</th>
                    <th>Téléphone</th>
                    <th>Points</th>
                    <th>Dette</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.length > 0 ? (
                    filteredClients.map((client, index) => (
                      <tr 
                        key={client.id} 
                        className={`hover cursor-pointer ${
                          searchTerm && highlightedIndex === index ? 'bg-primary text-primary-content' : ''
                        }`}
                        onClick={() => selectClient(client)}
                      >
                        <td>{client.name}</td>
                        <td>
                            <span className={`badge ${client.client_type === 'PROFESSIONNEL' ? 'badge-secondary' : 'badge-ghost'}`}>
                                {client.client_type === 'PROFESSIONNEL' ? 'Pro' : 'Particulier'}
                            </span>
                        </td>
                        <td>{client.phone}</td>
                        <td className="font-bold text-accent">
                          {client.client_type !== 'PROFESSIONNEL' && (
                            <>
                              {client.points_fidelite || 0}
                              {Number(client.pending_discount) > 0 && (
                                <span className="badge badge-sm badge-warning ml-2" title="Remise en attente">-{Number(client.pending_discount)}%</span>
                              )}
                            </>
                          )}
                        </td>
                        <td>
                            {Number(client.current_debt || 0) > 0 && (
                                <span className="text-error font-bold">{Number(client.current_debt).toLocaleString()} F</span>
                            )}
                        </td>
                        <td className="text-right">
                            <button className="btn btn-ghost btn-xs">Voir</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center text-base-content/70 py-8">
                        {searchTerm ? 'Aucun client trouvé pour cette recherche' : 'Aucun client enregistré'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VUE DETAILS */}
      {viewMode === 'DETAILS' && selectedClient && (
         <div className="space-y-4">
             <button onClick={handleBackToList} className="btn btn-outline btn-sm gap-2">
                 ⬅️ Retour à la liste
             </button>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <div className="flex justify-between items-center border-b pb-4 mb-4">
                  <div>
                      <h2 className="card-title text-2xl">{selectedClient.name}</h2>
                      <div className="badge badge-lg mt-1 gap-2">
                        {selectedClient.client_type}
                        {selectedClient.client_type === 'PROFESSIONNEL' && selectedClient.plafond && (
                            <span className="badge badge-neutral text-xs">Plafond: {Number(selectedClient.plafond).toLocaleString()}</span>
                        )}
                      </div>
                  </div>
                  <div className="card-actions flex-col sm:flex-row">
                    <button className="btn btn-secondary btn-sm" onClick={openEditView}>✏️ Modifier</button>
                    <button className="btn btn-error btn-sm" onClick={handleDeleteClient}>🗑️ Supprimer</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Informations Fidélité (Particuliers) */}
                    {selectedClient.client_type !== 'PROFESSIONNEL' && (
                        <div className="stats shadow w-full md:col-span-2">
                            <div className="stat place-items-center">
                                <div className="stat-title">Points Fidélité</div>
                                <div className="stat-value text-accent">{selectedClient.points_fidelite || 0}</div>
                                <div className="stat-desc">💎 Points cumulés</div>
                            </div>
                            {Number(selectedClient.pending_discount) > 0 && (
                                <div className="stat place-items-center bg-warning/10">
                                    <div className="stat-title text-warning-content">Remise acquise</div>
                                    <div className="stat-value text-warning">-{Number(selectedClient.pending_discount)}%</div>
                                    <div className="stat-desc text-warning-content font-bold">À valider au prochain achat</div>
                                </div>
                            )}
                        </div>
                    )}
                    {/* Informations Contact */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-lg opacity-70">Coordonnées</h3>
                        <div className="grid grid-cols-[100px_1fr] gap-2">
                            <span className="font-semibold">Adresse:</span>
                            <span className="whitespace-pre-wrap">{selectedClient.address}</span>
                            
                            <span className="font-semibold">Téléphone:</span>
                            <span>{selectedClient.phone}</span>
                            
                            <span className="font-semibold">Email:</span>
                            <span>{selectedClient.email}</span>
                        </div>
                    </div>

                    {/* Informations Professionnelles */}
                    {selectedClient.client_type === 'PROFESSIONNEL' && (
                        <div className="space-y-4">
                            <h3 className="font-bold text-lg opacity-70">Finance & Assurance</h3>
                            <div className="stats shadow w-full">
                                <div className="stat place-items-center">
                                    <div className="stat-title">Dette Actuelle</div>
                                    <div className={`stat-value text-2xl ${Number(selectedClient.current_debt) > Number(selectedClient.plafond) ? 'text-error' : 'text-success'}`}>
                                        {Number(selectedClient.current_debt).toLocaleString()} F
                                    </div>
                                    <div className="stat-desc">Plafond: {Number(selectedClient.plafond).toLocaleString()} F</div>
                                </div>
                                
                                <div className="stat place-items-center">
                                    <div className="stat-title">Couverture</div>
                                    <div className="stat-value text-2xl text-info">{Number(selectedClient.taux_couverture || 0)}%</div>
                                    <div className="stat-desc">Part assurance</div>
                                </div>
                            </div>

                            <div className="bg-base-200 p-4 rounded-lg mt-4">
                                <h4 className="font-bold mb-2">Ayants Droit ({selectedClient.ayants_droit?.length || 0})</h4>
                                {selectedClient.ayants_droit && selectedClient.ayants_droit.length > 0 ? (
                                    <ul className="list-disc list-inside text-sm space-y-1">
                                        {selectedClient.ayants_droit.map(ad => (
                                            <li key={ad.id}>
                                                <span className="font-bold">{ad.nom}</span> 
                                                <span className="opacity-70 mx-2">|</span> 
                                                Mat: <span className="font-mono bg-base-100 px-1 rounded">{ad.matricule}</span>
                                                {ad.societe && <span className="ml-2 text-xs italic">({ad.societe})</span>}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-base-content/70">Aucun ayant droit enregistré.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
              </div>
            </div>
         </div>
      )}

      {/* VUE CREATION */}
      {viewMode === 'CREATE' && (
        <div className="card bg-base-100 shadow-xl max-w-3xl mx-auto">
            <div className="card-body">
                <div className="flex items-center justify-between mb-6 border-b pb-4">
                    <h2 className="card-title text-xl">Ajouter un nouveau client</h2>
                    <button onClick={handleBackToList} className="btn btn-sm btn-ghost">Annuler ✕</button>
                </div>

                <form className="space-y-6" onSubmit={handleAddClient}>
                    {/* ... Form Content (Reused from previous modal) ... */}
                    {/* Copié adapté pour CREATE */}
                    <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-4">
                            <span className="label-text font-semibold">Type de Client:</span>
                            <label className="label cursor-pointer gap-2">
                                <input 
                                    type="radio" 
                                    name="client_type" 
                                    className="radio radio-primary" 
                                    checked={newClient.client_type === 'PARTICULIER'}
                                    onChange={() => setNewClient({...newClient, client_type: 'PARTICULIER'})} 
                                />
                                <span className="label-text">Particulier</span>
                            </label>
                            <label className="label cursor-pointer gap-2">
                                <input 
                                    type="radio" 
                                    name="client_type" 
                                    className="radio radio-secondary" 
                                    checked={newClient.client_type === 'PROFESSIONNEL'}
                                    onChange={() => setNewClient({...newClient, client_type: 'PROFESSIONNEL'})} 
                                />
                                <span className="label-text">Professionnel</span>
                            </label>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="form-control w-full">
                        <div className="label"><span className="label-text font-medium">Nom complet *</span></div>
                        <input type="text" placeholder="Ex: Jean Dupont" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} className="input input-bordered w-full" required disabled={isSubmitting}/>
                        </label>
                        
                        <label className="form-control w-full">
                        <div className="label"><span className="label-text font-medium">Téléphone *</span></div>
                        <input type="tel" placeholder="Ex: 0123456789" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} className="input input-bordered w-full" required disabled={isSubmitting}/>
                        </label>
                    </div>
                    
                    <label className="form-control w-full">
                        <div className="label"><span className="label-text font-medium">Adresse email *</span></div>
                        <input type="email" placeholder="Ex: jean.dupont@email.com" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} className="input input-bordered w-full" required disabled={isSubmitting}/>
                    </label>

                    <label className="form-control w-full">
                        <div className="label"><span className="label-text font-medium">Adresse complète *</span></div>
                        <textarea placeholder="Ex: 123 Rue de la Paix" value={newClient.address} onChange={e => setNewClient({...newClient, address: e.target.value})} className="textarea textarea-bordered w-full h-20 resize-none" required disabled={isSubmitting}/>
                    </label>

                    {newClient.client_type === 'PARTICULIER' && (
                        <div className="form-control bg-base-200 rounded-lg p-3">
                            <label className="label cursor-pointer justify-between">
                                <div>
                                    <span className="label-text font-bold text-secondary flex items-center gap-2">💎 Programme de Fidélité</span>
                                    <div className="text-xs opacity-60 mt-1">Permet le cumul de points et les remises.</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="label-text text-xs">{newClient.is_loyalty_member !== false ? 'Activé' : 'Désactivé'}</span>
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

                    {/* Remise automatique - disponible pour tous les clients */}
                    <label className="form-control w-full">
                        <div className="label">
                            <span className="label-text font-medium">Remise automatique (%)</span>
                            <span className="label-text-alt text-success">Appliquée sur toutes les ventes</span>
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
                        <div className="label">
                            <span className="label-text-alt">Pourcentage de remise appliqué automatiquement lors de la facturation</span>
                        </div>
                    </label>

                    {newClient.client_type === 'PROFESSIONNEL' && (
                        <div className="bg-base-200 p-4 rounded-lg space-y-4">
                            <h4 className="font-bold text-secondary">Informations Professionnelles</h4>
                            
                            <label className="form-control w-full">
                                <div className="label"><span className="label-text font-medium">Plafond de crédit (F)</span></div>
                                <input type="number" value={newClient.plafond} onChange={e => setNewClient({...newClient, plafond: e.target.value})} className="input input-bordered w-full" min="0"/>
                            </label>
                            
                            <label className="form-control w-full">
                                <div className="label">
                                    <span className="label-text font-medium">Taux de couverture assurance (%)</span>
                                    <span className="label-text-alt text-info">Pour tiers payant</span>
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

                            <div className="divider">Ayants Droit</div>
                            
                            <div className="flex gap-2 items-end">
                                <label className="form-control flex-1">
                                    <span className="label-text text-xs">Nom</span>
                                    <input type="text" value={tempAyantDroit.nom} onChange={e => setTempAyantDroit({...tempAyantDroit, nom: e.target.value})} className="input input-bordered input-sm" placeholder="Nom de l'ayant droit"/>
                                </label>
                                <label className="form-control flex-1">
                                    <span className="label-text text-xs">Matricule</span>
                                    <input type="text" value={tempAyantDroit.matricule} onChange={e => setTempAyantDroit({...tempAyantDroit, matricule: e.target.value})} className="input input-bordered input-sm" placeholder="Matricule"/>
                                </label>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => addAyantDroitToForm(false)}>Ajouter</button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="table table-xs bg-base-100">
                                    <thead><tr><th>Nom</th><th>Matricule</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {newClient.ayants_droit?.map((ad, idx) => (
                                            <tr key={idx}>
                                                <td>{ad.nom}</td>
                                                <td>{ad.matricule}</td>
                                                <td><button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => removeAyantDroitFromForm(idx, false)}>Supprimer</button></td>
                                            </tr>
                                        ))}
                                        {(!newClient.ayants_droit || newClient.ayants_droit.length === 0) && (
                                            <tr><td colSpan={3} className="text-center text-base-content/50">Aucun ayant droit ajouté</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="card-actions justify-end pt-4">
                        <button type="button" className="btn btn-ghost" onClick={handleBackToList} disabled={isSubmitting}>Annuler</button>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : 'Ajouter le client'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* VUE VISUALISATION */}
      {viewMode === 'EDIT' && editingClient && (
        <div className="card bg-base-100 shadow-xl max-w-3xl mx-auto">
            <div className="card-body">
                <div className="flex items-center justify-between mb-6 border-b pb-4">
                    <h2 className="card-title text-xl">Modifier le client</h2>
                    <button onClick={() => setViewMode('DETAILS')} className="btn btn-sm btn-ghost">Annuler ✕</button>
                </div>
            
                <form className="space-y-6" onSubmit={handleEditClient}>
                    <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-4">
                            <span className="label-text font-semibold">Type de Client:</span>
                            <label className="label cursor-pointer gap-2">
                                <input 
                                    type="radio" 
                                    name="edit_client_type" 
                                    className="radio radio-primary" 
                                    checked={editingClient.client_type === 'PARTICULIER'}
                                    onChange={() => setEditingClient({...editingClient, client_type: 'PARTICULIER'})} 
                                />
                                <span className="label-text">Particulier</span>
                            </label>
                            <label className="label cursor-pointer gap-2">
                                <input 
                                    type="radio" 
                                    name="edit_client_type" 
                                    className="radio radio-secondary" 
                                    checked={editingClient.client_type === 'PROFESSIONNEL'}
                                    onChange={() => setEditingClient({...editingClient, client_type: 'PROFESSIONNEL'})} 
                                />
                                <span className="label-text">Professionnel</span>
                            </label>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="form-control w-full">
                            <div className="label"><span className="label-text font-medium">Nom complet *</span></div>
                            <input type="text" value={editingClient.name} onChange={e => setEditingClient({...editingClient, name: e.target.value})} className="input input-bordered w-full" required/>
                        </label>
                        <label className="form-control w-full">
                            <div className="label"><span className="label-text font-medium">Téléphone *</span></div>
                            <input type="tel" value={editingClient.phone} onChange={e => setEditingClient({...editingClient, phone: e.target.value})} className="input input-bordered w-full" required/>
                        </label>
                    </div>
                    
                    <label className="form-control w-full">
                        <div className="label"><span className="label-text font-medium">Adresse email *</span></div>
                        <input type="email" value={editingClient.email} onChange={e => setEditingClient({...editingClient, email: e.target.value})} className="input input-bordered w-full" required/>
                    </label>

                    <label className="form-control w-full">
                        <div className="label"><span className="label-text font-medium">Adresse complète *</span></div>
                        <textarea value={editingClient.address} onChange={e => setEditingClient({...editingClient, address: e.target.value})} className="textarea textarea-bordered w-full h-20 resize-none" required/>
                    </label>

                    {editingClient.client_type === 'PARTICULIER' && (
                        <div className="form-control bg-base-200 rounded-lg p-3">
                            <label className="label cursor-pointer justify-between">
                                <div>
                                    <span className="label-text font-bold text-secondary flex items-center gap-2">💎 Programme de Fidélité</span>
                                    <div className="text-xs opacity-60 mt-1">Permet le cumul de points et les remises.</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="label-text text-xs">{editingClient.is_loyalty_member !== false ? 'Activé' : 'Désactivé'}</span>
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

                    {/* Remise automatique - disponible pour tous les clients */}
                    <label className="form-control w-full">
                        <div className="label">
                            <span className="label-text font-medium">Remise automatique (%)</span>
                            <span className="label-text-alt text-success">Appliquée sur toutes les ventes</span>
                        </div>
                        <input 
                            type="number" 
                            value={editingClient.remise_automatique || '0'} 
                            onChange={e => setEditingClient({...editingClient, remise_automatique: e.target.value})} 
                            className="input input-bordered w-full" 
                            min="0" 
                            max="100"
                            step="0.01"
                            placeholder="0"
                        />
                        <div className="label">
                            <span className="label-text-alt">Pourcentage de remise appliqué automatiquement lors de la facturation</span>
                        </div>
                    </label>

                    {editingClient.client_type === 'PROFESSIONNEL' && (
                        <div className="bg-base-200 p-4 rounded-lg space-y-4">
                            <h4 className="font-bold text-secondary">Informations Professionnelles</h4>
                            
                            <label className="form-control w-full">
                                <div className="label"><span className="label-text font-medium">Plafond de crédit (F)</span></div>
                                <input type="number" value={editingClient.plafond} onChange={e => setEditingClient({...editingClient, plafond: e.target.value})} className="input input-bordered w-full" min="0"/>
                            </label>
                            
                            <label className="form-control w-full">
                                <div className="label">
                                    <span className="label-text font-medium">Taux de couverture assurance (%)</span>
                                    <span className="label-text-alt text-info">Pour tiers payant</span>
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

                            <div className="divider">Ayants Droit</div>
                            
                            <div className="flex gap-2 items-end">
                                <label className="form-control flex-1">
                                    <span className="label-text text-xs">Nom</span>
                                    <input type="text" value={tempAyantDroit.nom} onChange={e => setTempAyantDroit({...tempAyantDroit, nom: e.target.value})} className="input input-bordered input-sm" placeholder="Nom de l'ayant droit"/>
                                </label>
                                <label className="form-control flex-1">
                                    <span className="label-text text-xs">Matricule</span>
                                    <input type="text" value={tempAyantDroit.matricule} onChange={e => setTempAyantDroit({...tempAyantDroit, matricule: e.target.value})} className="input input-bordered input-sm" placeholder="Matricule"/>
                                </label>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => addAyantDroitToForm(true)}>Ajouter</button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="table table-xs bg-base-100">
                                    <thead><tr><th>Nom</th><th>Matricule</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {editingClient.ayants_droit?.map((ad, idx) => (
                                            <tr key={idx}>
                                                <td>{ad.nom}</td>
                                                <td>{ad.matricule}</td>
                                                <td><button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => removeAyantDroitFromForm(idx, true)}>Supprimer</button></td>
                                            </tr>
                                        ))}
                                        {(!editingClient.ayants_droit || editingClient.ayants_droit.length === 0) && (
                                            <tr><td colSpan={3} className="text-center text-base-content/50">Aucun ayant droit ajouté</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="card-actions justify-end pt-4">
                        <button type="button" className="btn btn-ghost" onClick={() => setViewMode('DETAILS')}>Annuler</button>
                        <button type="submit" className="btn btn-primary">Enregistrer les modifications</button>
                    </div>
                </form>
            </div>
        </div>
      )}
      <LoyaltyConfigModal isOpen={isLoyaltyConfigOpen} onClose={() => setIsLoyaltyConfigOpen(false)} />
    </>
  );
}