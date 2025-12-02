import { useEffect, useMemo, useState, useRef } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'

import type { Fournisseur, Rayon, ProduitModel, ProduitForm, AchatProduit } from '../types'
import ProduitCreateModal from './ProduitFormModal' // Correction du nom du fichier

export default function Produit() {
  const [produits, setProduits] = useState<ProduitModel[]>([])
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false)
  const [newProduit, setNewProduit] = useState<ProduitForm>({
    name: '',
    description: '',
    stock: '',
    cost_price: '',
    selling_price: '',
    cip1: '',
    cip2: '',
    cip3: '',
    expire_date: '',
    stock_alert: '',
    stock_minimum: '',
    stock_maximum: '',
    rayon: '',
    fournisseur: '',
  })
  const [editProduit, setEditProduit] = useState<ProduitForm | null>(null)
  const [rayons, setRayons] = useState<Rayon[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [achats, setAchats] = useState<AchatProduit[]>([])
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
  const [isCreateProduitModalOpen, setIsCreateProduitModalOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null)

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL ?? ''),
    [],
  )
  const produitsEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/produits/`
    : '/api/produits/'
  const rayonsEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/rayons/`
    : '/api/rayons/'
  const fournisseursEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/fournisseurs/`
    : '/api/fournisseurs/'

  function openAddModal() {
    setNewProduit({
      name: '',
      description: '',
      stock: '',
      cost_price: '',
      selling_price: '',
      cip1: '',
      cip2: '',
      cip3: '',
      expire_date: '',
      stock_alert: '',
      stock_minimum: '',
      stock_maximum: '',
      rayon: '',
      fournisseur: '',
    })
    setIsAddModalOpen(true)
  }

  function closeAddModal() {
    setIsAddModalOpen(false)
  }

  // Fonctions de navigation au clavier
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!searchQuery) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredProduits.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredProduits.length) {
          const selectedProduct = filteredProduits[highlightedIndex];
          setSelectedProductId(selectedProduct.id);
          setSearchQuery('');
          setHighlightedIndex(-1);
        }
        break;
      case 'Escape':
        setSearchQuery('');
        setHighlightedIndex(-1);
        break;
    }
  }

  function selectProduct(product: ProduitModel) {
    setSelectedProductId(product.id);
    setSearchQuery('');
    setHighlightedIndex(-1);
  }

  async function fetchProduits(signal?: AbortSignal) {
    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.get<ProduitModel[]>(produitsEndpoint, { signal })
      setProduits(data)
      if (data.length > 0 && (selectedProductId == null || !data.some(p => p.id === selectedProductId))) {
        setSelectedProductId(data[0].id)
      }
    } catch (err: unknown) {
      if (axios.isCancel(err)) return
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? err.message ?? 'Erreur réseau')
      } else {
        setError('Erreur inconnue lors du chargement des produits')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchProduits(controller.signal)
    ;(async () => {
      try {
        const [{ data: r }, { data: f }] = await Promise.all([
          axios.get<Rayon[]>(rayonsEndpoint, { signal: controller.signal }),
          axios.get<Fournisseur[]>(fournisseursEndpoint, { signal: controller.signal }),
        ])
        setRayons(r)
        setFournisseurs(f)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        /* silent load */
      }
    })()
    return () => controller.abort()
  }, [])

  // Trie toujours les produits par ordre alphabétique (nom)
  const filteredProduits = useMemo(() => {
    let list = produits;
    if (searchQuery) {
      const q = searchQuery.trim().toLowerCase();
      list = produits.filter(p => {
        const inName = p.name?.toLowerCase().includes(q);
        const inCips = [p.cip1, p.cip2, p.cip3].some(c => (c || '').toLowerCase().includes(q));
        return inName || inCips;
      });
    }
    // Tri alphabétique par nom
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [produits, searchQuery]);

  const selectedProduit = useMemo(
    () => produits.find((p) => p.id === selectedProductId) ?? null,
    [produits, selectedProductId],
  )
  useEffect(() => {
    if (!selectedProduit) {
      setEditProduit(null)
      setIsEditing(false)
      setAchats([])
      return
    }
    setEditProduit({
      name: selectedProduit.name,
      description: selectedProduit.description ?? '',
      stock: String(selectedProduit.stock ?? ''),
      cost_price: String(selectedProduit.cost_price ?? ''),
      selling_price: String(selectedProduit.selling_price ?? ''),
      cip1: selectedProduit.cip1 ?? '',
      cip2: selectedProduit.cip2 ?? '',
      cip3: selectedProduit.cip3 ?? '',
      expire_date: selectedProduit.expire_date ?? '',
      stock_alert: String(selectedProduit.stock_alert ?? '0'),
      stock_minimum: String(selectedProduit.stock_minimum ?? '0'),
      stock_maximum: String(selectedProduit.stock_maximum ?? '0'),
      rayon: '',
      fournisseur: '',
    })
    ;(async () => {
      try {
        const base = apiBaseUrl ? `${String(apiBaseUrl).replace(/\/$/, '')}` : ''
        const { data } = await axios.get<AchatProduit[]>(
          `${base}/api/commande-produits/?produit=${selectedProduit.id}`
        )
        setAchats(data)
      } catch {
        setAchats([])
      }
    })()
  }, [apiBaseUrl, selectedProduit])

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

  async function handleAddProduit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      const stockValue = parseInt(newProduit.stock, 10)
      const payload = {
        name: newProduit.name.trim().toUpperCase(),
        description: newProduit.description.trim().toUpperCase(),
        stock: Number.isFinite(stockValue) ? stockValue : undefined,
        cost_price: newProduit.cost_price.trim(),
        selling_price: newProduit.selling_price.trim(),
        cip1: newProduit.cip1.trim() || null,
        cip2: newProduit.cip2.trim() || null,
        cip3: newProduit.cip3.trim() || null,
        expire_date: newProduit.expire_date.trim() || null,
        stock_alert: newProduit.stock_alert ? parseInt(newProduit.stock_alert, 10) : 0,
        stock_minimum: newProduit.stock_minimum ? parseInt(newProduit.stock_minimum, 10) : 0,
        stock_maximum: newProduit.stock_maximum ? parseInt(newProduit.stock_maximum, 10) : 0,
        rayon: newProduit.rayon ? parseInt(newProduit.rayon, 10) : undefined,
        fournisseur: newProduit.fournisseur ? parseInt(newProduit.fournisseur, 10) : undefined,
      }
      if (!payload.name || !payload.selling_price || !payload.cost_price || payload.stock == null) {
        setError('Les champs Nom, Stock, Prix de revient et Prix de vente sont obligatoires')
        return
      }
      const { data } = await axios.post<ProduitModel>(produitsEndpoint, payload)
      setProduits((prev) => [data, ...prev])
      setSelectedProductId(data.id)
      setIsAddModalOpen(false)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data ?? err.message
        setError(typeof detail === 'string' ? detail : formatBackendErrors(detail))
      } else {
        setError("Erreur inconnue lors de l'ajout du produit")
      }
    }
  }

  async function handleDeleteSelected() {
    if (selectedProduit == null) return
    const confirmDelete = window.confirm(
      `Supprimer le produit "${selectedProduit.name}" ?`,
    )
    if (!confirmDelete) return
    try {
      await axios.delete(`${produitsEndpoint}${selectedProduit.id}/`)
      setProduits((previousProduits) => {
        const nextProduits = previousProduits.filter((p) => p.id !== selectedProduit.id)
        setSelectedProductId(nextProduits.length ? nextProduits[0].id : null)
        return nextProduits
      })
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? err.message ?? 'Erreur réseau')
      } else {
        setError('Erreur inconnue lors de la suppression')
      }
    }
  }

  function handleRefresh() {
    const controller = new AbortController()
    fetchProduits(controller.signal)
  }

  // Callback pour ajouter le produit créé à la liste
  function handleProduitCreated(produit: ProduitModel) {
    setProduits(prev => [...prev, produit]);
    setIsCreateProduitModalOpen(false);
  }

  return (
    <div className="p-3 md:p-4 lg:p-6">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 text-center">Gestion des Produits</h1>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Bouton pour ouvrir le modal de création */}
      <div className="flex justify-end mb-4">
        <button
          className="btn btn-primary btn-sm md:btn-md"
          onClick={() => setIsCreateProduitModalOpen(true)}
        >
          <span className="hidden sm:inline">+ Créer un nouveau produit</span>
          <span className="sm:hidden">+ Nouveau</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Liste des produits */}
        <div className="card bg-base-100 shadow h-auto lg:h-[700px] flex flex-col">
          <div className="card-body p-0 flex-1 flex flex-col">
            <div className="flex items-center justify-between p-3 md:p-4 border-b">
              <h2 className="card-title text-base md:text-lg">Liste des produits</h2>
              {loading && <span className="loading loading-spinner loading-sm" />}
            </div>
            <div className="p-3 md:p-4 pb-0">
              <div className="join w-full">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="input input-bordered input-sm md:input-md join-item w-full"
                  placeholder="Rechercher par CIP ou Nom..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                />
                <button className="btn btn-sm md:btn-md join-item" onClick={() => setSearchQuery('')}>Effacer</button>
              </div>
            </div>
            {/* Barre de défilement ici */}
            <div className="overflow-x-auto flex-1">
              <div className="h-full max-h-[500px] overflow-y-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nom</th>
                      <th>Prix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProduits.map((produit, index) => {
                      const isSelected = produit.id === selectedProductId
                      const isHighlighted = searchQuery && highlightedIndex === index
                      return (
                        <tr
                          key={produit.id}
                          className={`cursor-pointer ${
                            isSelected ? 'active' : 'hover'
                          } ${
                            isHighlighted ? 'bg-primary text-primary-content' : ''
                          }`}
                          onClick={() => selectProduct(produit)}
                        >
                          <th>{produit.id}</th>
                          <td className="uppercase">{produit.name}</td>
                          <td>{produit.selling_price} F</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-3 md:p-4 border-t flex flex-wrap gap-2 justify-end">
              <button className="btn btn-outline btn-sm md:btn-md" onClick={handleRefresh}>
                Actualiser
              </button>
              <button className="btn btn-primary btn-sm md:btn-md" onClick={openAddModal}>
                Ajouter
              </button>
              <button
                className="btn btn-error btn-sm md:btn-md"
                onClick={handleDeleteSelected}
                disabled={!selectedProductId}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>

        {/* Détails du produit */}
        <div className="card bg-base-100 shadow h-auto lg:h-[700px] flex flex-col">
          <div className="card-body flex-1 p-3 md:p-6">
            <h2 className="card-title">Détails du produit</h2>
            {!selectedProduit ? (
              <p className="text-base-content/70">Sélectionnez un produit dans la liste.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="text-sm opacity-70">ID: {selectedProduit.id}</div>
                  <button className="btn btn-sm" onClick={() => setIsEditing((v) => !v)}>
                    {isEditing ? 'Annuler' : 'Modifier'}
                  </button>
                </div>

                {!isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-semibold col-span-1">Nom</span>
                      <span className="col-span-2 uppercase">{selectedProduit.name}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-semibold col-span-1">Description</span>
                      <span className="col-span-2 uppercase whitespace-pre-wrap">{selectedProduit.description || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-semibold col-span-1">Stock</span>
                      <span className="col-span-2">{selectedProduit.stock ?? '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-semibold col-span-1">Prix de revient</span>
                      <span className="col-span-2">{selectedProduit.cost_price ?? '—'} F</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-semibold col-span-1">Prix de vente</span>
                      <span className="col-span-2">{selectedProduit.selling_price ?? '—'} F</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-semibold col-span-1">CIP1</span>
                      <span className="col-span-2 uppercase">{selectedProduit.cip1 || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-semibold col-span-1">CIP2</span>
                      <span className="col-span-2 uppercase">{selectedProduit.cip2 || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-semibold col-span-1">CIP3</span>
                      <span className="col-span-2 uppercase">{selectedProduit.cip3 || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-semibold col-span-1">Expiration</span>
                      <span className="col-span-2">{selectedProduit.expire_date || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-semibold col-span-1">Alerte stock</span>
                      <span className="col-span-2">{selectedProduit.stock_alert ?? '0'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-semibold col-span-1">Stock minimum</span>
                      <span className="col-span-2">{selectedProduit.stock_minimum ?? '0'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-semibold col-span-1">Stock maximum</span>
                      <span className="col-span-2">{selectedProduit.stock_maximum ?? '0'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-semibold col-span-1">Rayon</span>
                      <span className="col-span-2 uppercase">{selectedProduit.rayon_name || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-semibold col-span-1">Fournisseur</span>
                      <span className="col-span-2">{selectedProduit.fournisseur_name || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-semibold col-span-1">Créé le</span>
                      <span className="col-span-2">{selectedProduit.created_at || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-semibold col-span-1">Mis à jour le</span>
                      <span className="col-span-2">{selectedProduit.updated_at || '—'}</span>
                    </div>

                    <div>
                      <span className="font-semibold">Historique d'achats</span>
                      <div className="mt-2 overflow-x-auto">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Fournisseur</th>
                              <th>Qté</th>
                              <th>Prix d'achat (F)</th>
                              <th>Lot</th>
                              <th>Expiration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {achats.length === 0 ? (
                              <tr><td colSpan={6} className="text-center opacity-70">Aucun achat</td></tr>
                            ) : (
                              achats.map(a => (
                                <tr key={a.id}>
                                  <td>{a.commande_date?.slice(0,10) || '—'}</td>
                                  <td className="uppercase">{a.fournisseur_name || '—'}</td>
                                  <td>{a.quantity}</td>
                                  <td>{a.price}</td>
                                  <td>{a.lot || '—'}</td>
                                  <td>{a.date_expiration || '—'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  editProduit && (
                    <form
                      className="space-y-4"
                      onSubmit={async (e) => {
                        e.preventDefault()
                        try {
                          const payload = {
                            name: editProduit.name.trim().toUpperCase(),
                            description: editProduit.description.trim().toUpperCase(),
                            stock: parseInt(editProduit.stock || '0', 10),
                            cost_price: editProduit.cost_price.trim(),
                            selling_price: editProduit.selling_price.trim(),
                            cip1: editProduit.cip1.trim() || null,
                            cip2: editProduit.cip2.trim() || null,
                            cip3: editProduit.cip3.trim() || null,
                            expire_date: editProduit.expire_date.trim() || null,
                            stock_alert: parseInt(editProduit.stock_alert || '0', 10),
                            stock_minimum: parseInt(editProduit.stock_minimum || '0', 10),
                            stock_maximum: parseInt(editProduit.stock_maximum || '0', 10),
                          }
                          const { data } = await axios.patch<ProduitModel>(`${produitsEndpoint}${selectedProduit.id}/`, payload)
                          setProduits((prev) => prev.map((p) => (p.id === data.id ? data : p)))
                          setIsEditing(false)
                        } catch (err: unknown) {
                          if (axios.isAxiosError(err)) {
                            const detail = err.response?.data ?? err.message
                            setError(typeof detail === 'string' ? detail : formatBackendErrors(detail))
                          } else {
                            setError('Erreur inconnue lors de la mise à jour')
                          }
                        }
                      }}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="form-control w-full">
                          <div className="label"><span className="label-text">Nom</span></div>
                          <input className="input input-bordered w-full" value={editProduit.name}
                            onChange={(e) => setEditProduit(p => p ? { ...p, name: e.target.value } : null)} />
                        </label>
                        <label className="form-control w-full">
                          <div className="label"><span className="label-text">Stock</span></div>
                          <input type="number" className="input input-bordered w-full" value={editProduit.stock}
                            onChange={(e) => setEditProduit(p => p ? { ...p, stock: e.target.value } : null)} />
                        </label>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="form-control w-full">
                          <div className="label"><span className="label-text">Prix de revient (F)</span></div>
                          <input type="number" className="input input-bordered w-full" value={editProduit.cost_price}
                            onChange={(e) => setEditProduit(p => p ? { ...p, cost_price: e.target.value } : null)} step="0.01" />
                        </label>
                        <label className="form-control w-full">
                          <div className="label"><span className="label-text">Prix de vente (F)</span></div>
                          <input type="number" className="input input-bordered w-full" value={editProduit.selling_price}
                            onChange={(e) => setEditProduit(p => p ? { ...p, selling_price: e.target.value } : null)} step="0.01" />
                        </label>
                      </div>
                      <label className="form-control w-full">
                        <div className="label"><span className="label-text">Description</span></div>
                        <textarea className="textarea textarea-bordered w-full" value={editProduit.description}
                          onChange={(e) => setEditProduit(p => p ? { ...p, description: e.target.value } : null)} rows={3} />
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <label className="form-control w-full"><div className="label"><span className="label-text">CIP1</span></div>
                          <input className="input input-bordered w-full" value={editProduit.cip1}
                            onChange={(e) => setEditProduit(p => p ? { ...p, cip1: e.target.value } : null)} />
                        </label>
                        <label className="form-control w-full"><div className="label"><span className="label-text">CIP2</span></div>
                          <input className="input input-bordered w-full" value={editProduit.cip2}
                            onChange={(e) => setEditProduit(p => p ? { ...p, cip2: e.target.value } : null)} />
                        </label>
                        <label className="form-control w-full"><div className="label"><span className="label-text">CIP3</span></div>
                          <input className="input input-bordered w-full" value={editProduit.cip3}
                            onChange={(e) => setEditProduit(p => p ? { ...p, cip3: e.target.value } : null)} />
                        </label>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <label className="form-control w-full"><div className="label"><span className="label-text">Expiration</span></div>
                          <input type="date" className="input input-bordered w-full" value={editProduit.expire_date}
                            onChange={(e) => setEditProduit(p => p ? { ...p, expire_date: e.target.value } : null)} />
                        </label>
                        <label className="form-control w-full"><div className="label"><span className="label-text">Alerte</span></div>
                          <input type="number" className="input input-bordered w-full" value={editProduit.stock_alert}
                            onChange={(e) => setEditProduit(p => p ? { ...p, stock_alert: e.target.value } : null)} />
                        </label>
                        <label className="form-control w-full"><div className="label"><span className="label-text">Min</span></div>
                          <input type="number" className="input input-bordered w-full" value={editProduit.stock_minimum}
                            onChange={(e) => setEditProduit(p => p ? { ...p, stock_minimum: e.target.value } : null)} />
                        </label>
                        <label className="form-control w-full"><div className="label"><span className="label-text">Max</span></div>
                          <input type="number" className="input input-bordered w-full" value={editProduit.stock_maximum}
                            onChange={(e) => setEditProduit(p => p ? { ...p, stock_maximum: e.target.value } : null)} />
                        </label>
                      </div>
                      <div className="modal-action">
                        <button type="submit" className="btn btn-primary">MODIFIER</button>
                      </div>
                    </form>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal d'ajout */}
      <dialog className={`modal ${isAddModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-2xl mx-4">
          <h3 className="font-bold text-lg mb-4">Ajouter un produit</h3>
          <form className="space-y-4" onSubmit={handleAddProduit}>
            <label className="form-control w-full">
              <div className="label">
                <span className="label-text">Nom</span>
              </div>
              <input
                type="text"
                className="input input-bordered w-full"
                value={newProduit.name}
                onChange={(e) => setNewProduit((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Stock</span>
                </div>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  value={newProduit.stock}
                  onChange={(e) => setNewProduit((p) => ({ ...p, stock: e.target.value }))}
                  min={0}
                  step={1}
                  required
                />
              </label>
              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Prix de revient (F)</span>
                </div>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  value={newProduit.cost_price}
                  onChange={(e) => setNewProduit((p) => ({ ...p, cost_price: e.target.value }))}
                  placeholder="Ex: 525"
                  step="0.01"
                  required
                />
              </label>
            </div>
            <label className="form-control w-full">
              <div className="label">
                <span className="label-text">Prix de vente (F)</span>
              </div>
              <input
                type="number"
                className="input input-bordered w-full"
                value={newProduit.selling_price}
                onChange={(e) => setNewProduit((p) => ({ ...p, selling_price: e.target.value }))}
                placeholder="Ex: 999"
                step="0.01"
                required
              />
            </label>
            <label className="form-control w-full">
              <div className="label">
                <span className="label-text">Description</span>
              </div>
              <textarea
                className="textarea textarea-bordered w-full"
                value={newProduit.description}
                onChange={(e) => setNewProduit((p) => ({ ...p, description: e.target.value }))}
                rows={3}
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="form-control w-full"><div className="label"><span className="label-text">CIP1</span></div>
                <input className="input input-bordered w-full" value={newProduit.cip1}
                  onChange={(e) => setNewProduit((p) => ({ ...p, cip1: e.target.value }))} />
              </label>
              <label className="form-control w-full"><div className="label"><span className="label-text">CIP2</span></div>
                <input className="input input-bordered w-full" value={newProduit.cip2}
                  onChange={(e) => setNewProduit((p) => ({ ...p, cip2: e.target.value }))} />
              </label>
              <label className="form-control w-full"><div className="label"><span className="label-text">CIP3</span></div>
                <input className="input input-bordered w-full" value={newProduit.cip3}
                  onChange={(e) => setNewProduit((p) => ({ ...p, cip3: e.target.value }))} />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="form-control w-full"><div className="label"><span className="label-text">Expiration</span></div>
                <input type="date" className="input input-bordered w-full" value={newProduit.expire_date}
                  onChange={(e) => setNewProduit((p) => ({ ...p, expire_date: e.target.value }))} />
              </label>
              <label className="form-control w-full"><div className="label"><span className="label-text">Alerte stock</span></div>
                <input type="number" className="input input-bordered w-full" value={newProduit.stock_alert}
                  onChange={(e) => setNewProduit((p) => ({ ...p, stock_alert: e.target.value }))} min={0} step={1} />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="form-control w-full"><div className="label"><span className="label-text">Stock minimum</span></div>
                <input type="number" className="input input-bordered w-full" value={newProduit.stock_minimum}
                  onChange={(e) => setNewProduit((p) => ({ ...p, stock_minimum: e.target.value }))} min={0} step={1} />
              </label>
              <label className="form-control w-full"><div className="label"><span className="label-text">Stock maximum</span></div>
                <input type="number" className="input input-bordered w-full" value={newProduit.stock_maximum}
                  onChange={(e) => setNewProduit((p) => ({ ...p, stock_maximum: e.target.value }))} min={0} step={1} />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="form-control w-full"><div className="label"><span className="label-text">Rayon</span></div>
                <select className="select select-bordered w-full" value={newProduit.rayon}
                  onChange={(e) => setNewProduit((p) => ({ ...p, rayon: e.target.value }))}>
                  <option value="">—</option>
                  {rayons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              <label className="form-control w-full"><div className="label"><span className="label-text">Fournisseur</span></div>
                <select className="select select-bordered w-full" value={newProduit.fournisseur}
                  onChange={(e) => setNewProduit((p) => ({ ...p, fournisseur: e.target.value }))}>
                  <option value="">—</option>
                  {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
            </div>
            <div className="modal-action">
              <button type="button" className="btn" onClick={closeAddModal}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary">
                Enregistrer
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop" onSubmit={closeAddModal}>
          <button>close</button>
        </form>
      </dialog>

      {/* Modal de création de produit réutilisable */}
      <ProduitCreateModal
        open={isCreateProduitModalOpen}
        onClose={() => setIsCreateProduitModalOpen(false)}
        produitsEndpoint={produitsEndpoint}
        onCreated={handleProduitCreated}
      />
    </div>
  )
}
