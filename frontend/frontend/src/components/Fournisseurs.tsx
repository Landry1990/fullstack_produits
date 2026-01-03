import { useEffect, useState, useMemo, type FormEvent, useRef } from 'react';
import axios from 'axios';
import { useConfirm } from '../hooks/useConfirm';
import type { Fournisseur } from '../types';

const emptyForm: Omit<Fournisseur, 'id'> = {
  name: '',
  address: '',
  phone: '',
  email: '',
};

export default function Fournisseurs() {
  const confirm = useConfirm()
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [selectedFournisseur, setSelectedFournisseur] = useState<Fournisseur | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [newFournisseur, setNewFournisseur] = useState(emptyForm);
  const [editingFournisseur, setEditingFournisseur] = useState<Fournisseur | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  async function fetchFournisseurs() {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(fournisseursEndpoint);
      // Handle paginated response
      const data: any = response.data;
      setFournisseurs(Array.isArray(data) ? data : (data.results || []));
    } catch (err: unknown) {
      if (axios.isCancel(err)) return;
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? err.message ?? 'Erreur réseau');
      } else {
        setError('Erreur inconnue lors du chargement des fournisseurs');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFournisseurs();
  }, [fournisseursEndpoint]);

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
        setError("Erreur inconnue lors de l'ajout du fournisseur")
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
        setError("Erreur inconnue lors de la modification du fournisseur")
      }
      console.error('Erreur lors de la modification du fournisseur:', err);
    }
  }

  async function handleDeleteFournisseur() {
    if (!selectedFournisseur) return;
    
    const confirmed = await confirm({
      title: 'Supprimer le fournisseur',
      message: `Supprimer le fournisseur "${selectedFournisseur.name}" ?`,
      variant: 'danger',
      confirmText: 'Supprimer'
    })
    if (confirmed) {
      try {
        await axios.delete(`${fournisseursEndpoint}${selectedFournisseur.id}/`);
        setFournisseurs(prev => prev.filter(f => f.id !== selectedFournisseur.id));
        setSelectedFournisseur(null);
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.message ?? err.message ?? 'Erreur réseau')
        } else {
          setError('Erreur inconnue lors de la suppression du fournisseur')
        }
        console.error('Erreur lors de la suppression du fournisseur:', err);
      }
    }
  }

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {error && (
        <div role="alert" className="alert alert-error shrink-0">
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full min-h-0">
         {/* Left Panel: List */}
         <div className="md:col-span-1 lg:col-span-2 bg-white rounded-lg shadow flex flex-col overflow-hidden h-full">
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center shrink-0 bg-base-50/50">
               <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold">Fournisseurs</h2>
                  {loading ? (
                      <span className="loading loading-spinner loading-xs text-primary"></span>
                  ) : (
                      <span className="badge badge-sm badge-neutral text-xs">{fournisseurs.length}</span>
                  )}
               </div>
               <button className="btn btn-primary btn-sm gap-2" onClick={openAddModal}>
                 ➕ Nouveau
               </button>
            </div>
            
            {/* Search */}
            <div className="p-3 bg-white border-b">
                 <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <span className="opacity-50">🔍</span>
                   </div>
                   <input 
                      ref={searchInputRef}
                      type="text" 
                      placeholder="Rechercher (nom, tél, email)..." 
                      className="input input-sm input-bordered w-full pl-9" 
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setHighlightedIndex(-1);
                      }}
                      onKeyDown={handleKeyDown}
                    />
                 </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
               <table className="table table-xs table-pin-rows w-full">
                 <thead className="bg-base-100 text-base-content/70">
                   <tr>
                     <th>Nom</th>
                     <th>Téléphone</th>
                     <th>Email</th>
                   </tr>
                 </thead>
                 <tbody>
                    {filteredFournisseurs.length > 0 ? (
                      filteredFournisseurs.map((fournisseur, index) => (
                        <tr 
                          key={fournisseur.id} 
                          className={`hover cursor-pointer transition-colors ${
                            selectedFournisseur?.id === fournisseur.id ? 'bg-primary/10 border-l-4 border-primary' : ''
                          } ${
                            searchTerm && highlightedIndex === index ? 'bg-base-200' : ''
                          }`}
                          onClick={() => selectFournisseur(fournisseur)}
                        >
                          <td className="font-bold">{fournisseur.name}</td>
                          <td className="font-mono">{fournisseur.phone}</td>
                          <td className="opacity-70">{fournisseur.email}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="text-center py-10 opacity-50">
                           <div className="flex flex-col items-center gap-2">
                             <span className="text-2xl">📭</span>
                             <span>{searchTerm ? 'Aucun résultat' : 'Liste vide'}</span>
                           </div>
                        </td>
                      </tr>
                    )}
                 </tbody>
               </table>
            </div>
         </div>

         {/* Right Panel: Details */}
         <div className="bg-white rounded-lg shadow flex flex-col h-full overflow-hidden">
             {selectedFournisseur ? (
                <>
                  <div className="p-6 border-b bg-base-50/30 shrink-0 flex justify-between items-start">
                     <div>
                        <div className="text-xs uppercase font-bold opacity-40 mb-1">Détails Fournisseur</div>
                        <h2 className="text-xl font-bold text-base-content">{selectedFournisseur.name}</h2>
                     </div>
                     <div className="join shadow-sm">
                        <button className="btn btn-sm btn-outline join-item" onClick={openEditModal} title="Modifier">✏️</button>
                        <button className="btn btn-sm btn-outline btn-error join-item" onClick={handleDeleteFournisseur} title="Supprimer">🗑️</button>
                     </div>
                  </div>
                  
                  <div className="p-6 space-y-6 overflow-y-auto flex-1">
                      <div className="grid grid-cols-1 gap-6">
                          <div className="flex gap-4">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">📍</div>
                              <div>
                                  <div className="text-xs font-bold opacity-50 uppercase mb-1">Adresse</div>
                                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{selectedFournisseur.address || 'Non renseignée'}</div>
                              </div>
                          </div>
                          <div className="flex gap-4">
                              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary shrink-0">📞</div>
                              <div>
                                  <div className="text-xs font-bold opacity-50 uppercase mb-1">Téléphone</div>
                                  <div className="text-sm font-mono font-medium">{selectedFournisseur.phone || '-'}</div>
                              </div>
                          </div>
                          <div className="flex gap-4">
                              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">✉️</div>
                              <div>
                                  <div className="text-xs font-bold opacity-50 uppercase mb-1">Email</div>
                                  <div className="text-sm break-all">{selectedFournisseur.email || '-'}</div>
                              </div>
                          </div>
                      </div>
                      
                      <div className="divider"></div>
                      
                      <div className="text-xs text-center opacity-40">
                         ID Système: {selectedFournisseur.id}
                      </div>
                  </div>
                </>
             ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-base-content/30 p-10 text-center">
                    <span className="text-5xl mb-4 grayscale opacity-50">🏢</span>
                    <p className="font-medium">Sélectionnez un fournisseur<br/>pour consulter ses détails</p>
                </div>
             )}
         </div>
      </div>

      {/* Add Modal */}
      <dialog className={`modal ${isAddModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-xl">Ajouter un nouveau fournisseur</h3>
            <button 
              type="button" 
              className="btn btn-sm btn-circle btn-ghost" 
              onClick={closeAddModal}
              disabled={isSubmitting}
            >
              ✕
            </button>
          </div>
          
          <form className="space-y-6" onSubmit={handleAddFournisseur}>
            {/* Informations de l'entreprise */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-base-content/80 border-b border-base-300 pb-2">
                Informations de l'entreprise
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Nom de l'entreprise *</span>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Ex: PharmaCorp SARL" 
                    value={newFournisseur.name} 
                    onChange={e => setNewFournisseur(f => ({...f, name: e.target.value}))} 
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
                    value={newFournisseur.phone} 
                    onChange={e => setNewFournisseur(f => ({...f, phone: e.target.value}))} 
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
                  placeholder="Ex: contact@pharmacorp.com" 
                  value={newFournisseur.email} 
                  onChange={e => setNewFournisseur(f => ({...f, email: e.target.value}))} 
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
                  placeholder="Ex: 123 Avenue des Industries&#10;75001 Paris, France" 
                  value={newFournisseur.address} 
                  onChange={e => setNewFournisseur(f => ({...f, address: e.target.value}))} 
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
                    Ajouter le fournisseur
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
            <h3 className="font-bold text-xl">Modifier le fournisseur</h3>
            <button 
              type="button" 
              className="btn btn-sm btn-circle btn-ghost" 
              onClick={closeEditModal}
            >
              ✕
            </button>
          </div>
          
          {editingFournisseur && (
            <form className="space-y-6" onSubmit={handleEditFournisseur}>
              {/* Informations de l'entreprise */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-base-content/80 border-b border-base-300 pb-2">
                  Informations de l'entreprise
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="form-control w-full">
                    <div className="label">
                      <span className="label-text font-medium">Nom de l'entreprise *</span>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Ex: PharmaCorp SARL" 
                      value={editingFournisseur.name} 
                      onChange={e => setEditingFournisseur(f => f ? {...f, name: e.target.value} : null)} 
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
                      value={editingFournisseur.phone} 
                      onChange={e => setEditingFournisseur(f => f ? {...f, phone: e.target.value} : null)} 
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
                    placeholder="Ex: contact@pharmacorp.com" 
                    value={editingFournisseur.email} 
                    onChange={e => setEditingFournisseur(f => f ? {...f, email: e.target.value} : null)} 
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
                    placeholder="Ex: 123 Avenue des Industries&#10;75001 Paris, France" 
                    value={editingFournisseur.address} 
                    onChange={e => setEditingFournisseur(f => f ? {...f, address: e.target.value} : null)} 
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
    </div>
  );
}
