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
                       placeholder="Rechercher un fournisseur..." 
                       className="input input-sm input-bordered w-full pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-all h-9" 
                       value={searchTerm}
                       onChange={(e) => {
                         setSearchTerm(e.target.value);
                         setHighlightedIndex(-1);
                       }}
                       onKeyDown={handleKeyDown}
                     />
                 </div>
                 <button className="btn btn-primary btn-sm gap-2 h-9" onClick={openAddModal}>
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                   </svg>
                   Nouveau
                 </button>
               </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
               <table className="table table-xs table-pin-rows w-full">
                 <thead className="bg-[#f8fafc] text-[#64748b]">
                   <tr>
                     <th className="py-3 px-4 font-semibold uppercase text-[11px] tracking-wider text-left">Nom du Fournisseur</th>
                     <th className="py-3 px-4 font-semibold uppercase text-[11px] tracking-wider text-center">Téléphone</th>
                     <th className="py-3 px-4 font-semibold uppercase text-[11px] tracking-wider text-left">Email</th>
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
                           <td className="py-3 px-4">
                             <div className="font-bold">{fournisseur.name}</div>
                           </td>
                           <td className="py-3 px-4 text-center">
                             <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">{fournisseur.phone || '-'}</span>
                           </td>
                           <td className="py-3 px-4 opacity-80 text-sm">{fournisseur.email || '-'}</td>
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
                                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Adresse de contact</div>
                                  <div className="text-slate-700 font-medium whitespace-pre-wrap leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                                    {selectedFournisseur.address || 'Non renseignée'}
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
                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Ligne directe</div>
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
                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email professionnel</div>
                                    <div className="text-slate-600 font-semibold break-all selection:bg-blue-100 underline decoration-blue-200 decoration-2 underline-offset-4">{selectedFournisseur.email || '-'}</div>
                                </div>
                            </div>
                          </div>
                      </div>
                      
                      <div className="pt-8 mt-4 border-t border-slate-100">
                        <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Référence interne</span>
                          <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">#{selectedFournisseur.id}</span>
                        </div>
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
                    <p className="font-bold text-slate-400">Aucun fournisseur sélectionné</p>
                    <p className="text-sm text-slate-300 mt-1 max-w-[200px]">Sélectionnez une entreprise dans la liste pour voir ses coordonnées</p>
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
