import { useEffect, useState, useMemo, type FormEvent, useRef } from 'react';
import axios from 'axios';

import type { Client } from '../types';

const emptyForm: Omit<Client, 'id'> = {
  name: '',
  address: '',
  phone: '',
  email: '',
};

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [newClient, setNewClient] = useState(emptyForm);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
      const { data } = await axios.get<Client[]>(clientsEndpoint);
      setClients(data);
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
    setIsAddModalOpen(true);
  }

  function closeAddModal() {
    setIsAddModalOpen(false);
    setError(null); // Réinitialiser l'erreur lors de la fermeture
    setNewClient(emptyForm); // Réinitialiser le formulaire
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

  function selectClient(client: Client) {
    setSelectedClient(client);
    setSearchTerm('');
    setHighlightedIndex(-1);
  }

  function openEditModal() {
    if (!selectedClient) return;
    setEditingClient(selectedClient);
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

  async function handleAddClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); // Réinitialiser l'erreur avant la tentative
    setIsSubmitting(true);
    try {
      const { data: addedClient } = await axios.post<Client>(clientsEndpoint, newClient);
      setClients(prev => [addedClient, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedClient(addedClient);
      setNewClient(emptyForm); // Réinitialiser le formulaire
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
    try {
      const { data: updatedClient } = await axios.patch<Client>(
        `${clientsEndpoint}${editingClient.id}/`,
        editingClient
      );
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
                  placeholder="Rechercher un client... (utilisez ↑↓ pour naviguer, Entrée pour sélectionner)" 
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
                    <th>Téléphone</th>
                    <th>Email</th>
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
                        <td>{client.phone}</td>
                        <td>{client.email}</td>
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
                  <span className="font-semibold col-span-1">ID</span>
                  <span className="col-span-2">{selectedClient.id}</span>
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */} 
      <dialog className={`modal ${isAddModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-xl">Ajouter un nouveau client</h3>
            <button 
              type="button" 
              className="btn btn-sm btn-circle btn-ghost" 
              onClick={closeAddModal}
              disabled={isSubmitting}
            >
              ✕
            </button>
          </div>
          
          <form className="space-y-6" onSubmit={handleAddClient}>
            {/* Informations personnelles */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-base-content/80 border-b border-base-300 pb-2">
                Informations personnelles
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Nom complet *</span>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Ex: Jean Dupont" 
                    value={newClient.name} 
                    onChange={e => setNewClient(c => ({...c, name: e.target.value}))} 
                    className="input input-bordered w-full" 
                    required 
                    disabled={isSubmitting}
                  />
                </label>
                
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Téléphone *</span>
                  </div>
                  <input 
                    type="tel" 
                    placeholder="Ex: 0123456789" 
                    value={newClient.phone} 
                    onChange={e => setNewClient(c => ({...c, phone: e.target.value}))} 
                    className="input input-bordered w-full" 
                    required 
                    disabled={isSubmitting}
                  />
                </label>
              </div>
              
              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text font-medium">Adresse email *</span>
                </div>
                <input 
                  type="email" 
                  placeholder="Ex: jean.dupont@email.com" 
                  value={newClient.email} 
                  onChange={e => setNewClient(c => ({...c, email: e.target.value}))} 
                  className="input input-bordered w-full" 
                  required 
                  disabled={isSubmitting}
                />
              </label>
            </div>

            {/* Adresse */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-base-content/80 border-b border-base-300 pb-2">
                Adresse
              </h4>
              
              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text font-medium">Adresse complète *</span>
                </div>
                <textarea 
                  placeholder="Ex: 123 Rue de la Paix&#10;75001 Paris, France" 
                  value={newClient.address} 
                  onChange={e => setNewClient(c => ({...c, address: e.target.value}))} 
                  className="textarea textarea-bordered w-full h-24 resize-none" 
                  required 
                  disabled={isSubmitting}
                />
                <div className="label">
                  <span className="label-text-alt">Séparez les lignes d'adresse par des retours à la ligne</span>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="modal-action pt-4">
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={closeAddModal} 
                disabled={isSubmitting}
              >
                Annuler
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Ajouter le client
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop" onSubmit={closeAddModal}>
          <button>close</button>
        </form>
      </dialog>

      {/* Edit Modal */} 
      <dialog className={`modal ${isEditModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-xl">Modifier le client</h3>
            <button 
              type="button" 
              className="btn btn-sm btn-circle btn-ghost" 
              onClick={closeEditModal}
            >
              ✕
            </button>
          </div>
          
          {editingClient && (
            <form className="space-y-6" onSubmit={handleEditClient}>
              {/* Informations personnelles */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-base-content/80 border-b border-base-300 pb-2">
                  Informations personnelles
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="form-control w-full">
                    <div className="label">
                      <span className="label-text font-medium">Nom complet *</span>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Ex: Jean Dupont" 
                      value={editingClient.name} 
                      onChange={e => setEditingClient(c => c ? ({...c, name: e.target.value}) : null)} 
                      className="input input-bordered w-full" 
                      required 
                    />
                  </label>
                  
                  <label className="form-control w-full">
                    <div className="label">
                      <span className="label-text font-medium">Téléphone *</span>
                    </div>
                    <input 
                      type="tel" 
                      placeholder="Ex: 0123456789" 
                      value={editingClient.phone} 
                      onChange={e => setEditingClient(c => c ? ({...c, phone: e.target.value}) : null)} 
                      className="input input-bordered w-full" 
                      required 
                    />
                  </label>
                </div>
                
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Adresse email *</span>
                  </div>
                  <input 
                    type="email" 
                    placeholder="Ex: jean.dupont@email.com" 
                    value={editingClient.email} 
                    onChange={e => setEditingClient(c => c ? ({...c, email: e.target.value}) : null)} 
                    className="input input-bordered w-full" 
                    required 
                  />
                </label>
              </div>

              {/* Adresse */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-base-content/80 border-b border-base-300 pb-2">
                  Adresse
                </h4>
                
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Adresse complète *</span>
                  </div>
                  <textarea 
                    placeholder="Ex: 123 Rue de la Paix&#10;75001 Paris, France" 
                    value={editingClient.address} 
                    onChange={e => setEditingClient(c => c ? ({...c, address: e.target.value}) : null)} 
                    className="textarea textarea-bordered w-full h-24 resize-none" 
                    required 
                  />
                  <div className="label">
                    <span className="label-text-alt">Séparez les lignes d'adresse par des retours à la ligne</span>
                  </div>
                </label>
              </div>

              {/* Actions */}
              <div className="modal-action pt-4">
                <button 
                  type="button" 
                  className="btn btn-ghost" 
                  onClick={closeEditModal}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          )}
        </div>
        <form method="dialog" className="modal-backdrop" onSubmit={closeEditModal}>
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}