import { useEffect, useState, useMemo, type FormEvent, useRef } from 'react';
import axios from 'axios';

import type { Client } from '../types';

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
  ayants_droit?: AyantDroit[];
  current_debt?: string;
}

const emptyForm: Omit<ExtendedClient, 'id'> = {
  name: '',
  address: '',
  phone: '',
  email: '',
  client_type: 'PARTICULIER',
  plafond: '0',
  ayants_droit: []
};

export default function Clients() {
  const [clients, setClients] = useState<ExtendedClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<ExtendedClient | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [newClient, setNewClient] = useState(emptyForm);
  const [editingClient, setEditingClient] = useState<ExtendedClient | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (selectedClient && !clients.some(c => c.id === selectedClient.id)) {
      setSelectedClient(null);
    }
  }, [clients, selectedClient]);

  function openAddModal() {
    setNewClient(emptyForm);
    setTempAyantDroit({ matricule: '', nom: '' });
    setIsAddModalOpen(true);
  }

  function closeAddModal() {
    setIsAddModalOpen(false);
    setError(null);
    setNewClient(emptyForm);
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
          const selectedClient = filteredClients[highlightedIndex];
          setSelectedClient(selectedClient);
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
    setSearchTerm('');
    setHighlightedIndex(-1);
  }

  function openEditModal() {
    if (!selectedClient) return;
    setEditingClient(JSON.parse(JSON.stringify(selectedClient))); // Deep copy
    setTempAyantDroit({ matricule: '', nom: '' });
    setIsEditModalOpen(true);
  }

  function closeEditModal() {
    setIsEditModalOpen(false);
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

      // Refresh to get full data (though addedClient should have it now with the new serializer)
      // We'll trust the response from create first, but a refresh ensures calculating fields like debt are correct
      const { data: refreshedClient } = await axios.get<ExtendedClient>(`${clientsEndpoint}${addedClient.id}/`);
      
      setClients(prev => [refreshedClient, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedClient(refreshedClient);
      setNewClient(emptyForm);
      closeAddModal();
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
      // Send Update including nested ayants_droit
      await axios.patch<ExtendedClient>(
        `${clientsEndpoint}${editingClient.id}/`,
        {
            name: editingClient.name,
            address: editingClient.address,
            phone: editingClient.phone,
            email: editingClient.email,
            client_type: editingClient.client_type,
            plafond: editingClient.plafond,
            ayants_droit: editingClient.ayants_droit // Send the full list for synchronization
        }
      );

      // Refresh
      const { data: updatedClient } = await axios.get<ExtendedClient>(`${clientsEndpoint}${editingClient.id}/`);

      setClients(prev => 
        prev.map(c => (c.id === updatedClient.id ? updatedClient : c))
      );
      setSelectedClient(updatedClient);
      closeEditModal();
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title">Liste des clients</h2>
              <div className="card-actions">
                {loading && <span className="loading loading-spinner loading-sm" />}
                <button className="btn btn-primary" onClick={openAddModal}>Ajouter</button>
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
                />
                <button className="btn btn-square" type="button">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Type</th>
                    <th>Téléphone</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.length > 0 ? (
                    filteredClients.map((client, index) => (
                      <tr 
                        key={client.id} 
                        className={`hover cursor-pointer ${
                          selectedClient?.id === client.id ? 'active' : ''
                        } ${
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
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="text-center text-base-content/70 py-8">
                        {searchTerm ? 'Aucun client trouvé pour cette recherche' : 'Aucun client enregistré'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex justify-between items-center">
              <h2 className="card-title">Détails du client</h2>
              {selectedClient && (
                <div className="card-actions">
                  <button className="btn btn-secondary btn-sm" onClick={openEditModal}>Modifier</button>
                  <button className="btn btn-error btn-sm" onClick={handleDeleteClient}>Supprimer</button>
                </div>
              )}
            </div>
            {!selectedClient ? (
              <p className="text-base-content/70">Sélectionnez un client dans la liste.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold col-span-1">Type</span>
                  <span className="col-span-2">
                    <span className={`badge ${selectedClient.client_type === 'PROFESSIONNEL' ? 'badge-secondary' : 'badge-ghost'}`}>
                        {selectedClient.client_type}
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold col-span-1">Nom</span>
                  <span className="col-span-2">{selectedClient.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold col-span-1">Adresse</span>
                  <span className="col-span-2 whitespace-pre-wrap">{selectedClient.address}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold col-span-1">Téléphone</span>
                  <span className="col-span-2">{selectedClient.phone}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold col-span-1">Email</span>
                  <span className="col-span-2">{selectedClient.email}</span>
                </div>
                
                {selectedClient.client_type === 'PROFESSIONNEL' && (
                    <>
                        <div className="divider">Informations Pro</div>
                        <div className="grid grid-cols-3 gap-2">
                            <span className="font-semibold col-span-1">Plafond</span>
                            <span className="col-span-2">{Number(selectedClient.plafond).toLocaleString()} F</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <span className="font-semibold col-span-1">Dette Actuelle</span>
                            <span className={`col-span-2 font-bold ${Number(selectedClient.current_debt) > Number(selectedClient.plafond) ? 'text-error' : 'text-success'}`}>
                                {Number(selectedClient.current_debt).toLocaleString()} F
                            </span>
                        </div>
                        
                        <div className="mt-4">
                            <h4 className="font-semibold mb-2">Ayants Droit</h4>
                            {selectedClient.ayants_droit && selectedClient.ayants_droit.length > 0 ? (
                                <ul className="list-disc list-inside text-sm">
                                    {selectedClient.ayants_droit.map(ad => (
                                        <li key={ad.id}>{ad.nom} (Mat: {ad.matricule}){ad.societe ? ` - ${ad.societe}` : ''}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-base-content/70">Aucun ayant droit enregistré.</p>
                            )}
                        </div>
                    </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */} 
      <dialog className={`modal ${isAddModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-xl">Ajouter un nouveau client</h3>
            <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={closeAddModal} disabled={isSubmitting}>✕</button>
          </div>
          
          <form className="space-y-6" onSubmit={handleAddClient}>
            {/* Type de Client */}
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

            {/* Informations personnelles */}
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

            {/* Champs Professionnels */}
            {newClient.client_type === 'PROFESSIONNEL' && (
                <div className="bg-base-200 p-4 rounded-lg space-y-4">
                    <h4 className="font-bold text-secondary">Informations Professionnelles</h4>
                    
                    <label className="form-control w-full">
                        <div className="label"><span className="label-text font-medium">Plafond de crédit (F)</span></div>
                        <input type="number" value={newClient.plafond} onChange={e => setNewClient({...newClient, plafond: e.target.value})} className="input input-bordered w-full" min="0"/>
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

            <div className="modal-action pt-4">
              <button type="button" className="btn btn-ghost" onClick={closeAddModal} disabled={isSubmitting}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? <span className="loading loading-spinner loading-sm"></span> : 'Ajouter le client'}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop" onSubmit={closeAddModal}><button>close</button></form>
      </dialog>

      {/* Edit Modal */} 
      <dialog className={`modal ${isEditModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-xl">Modifier le client</h3>
            <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={closeEditModal}>✕</button>
          </div>
          
          {editingClient && (
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

                {editingClient.client_type === 'PROFESSIONNEL' && (
                    <div className="bg-base-200 p-4 rounded-lg space-y-4">
                        <h4 className="font-bold text-secondary">Informations Professionnelles</h4>
                        
                        <label className="form-control w-full">
                            <div className="label"><span className="label-text font-medium">Plafond de crédit (F)</span></div>
                            <input type="number" value={editingClient.plafond} onChange={e => setEditingClient({...editingClient, plafond: e.target.value})} className="input input-bordered w-full" min="0"/>
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

              <div className="modal-action pt-4">
                <button type="button" className="btn btn-ghost" onClick={closeEditModal}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer les modifications</button>
              </div>
            </form>
          )}
        </div>
        <form method="dialog" className="modal-backdrop" onSubmit={closeEditModal}><button>close</button></form>
      </dialog>
    </>
  );
}