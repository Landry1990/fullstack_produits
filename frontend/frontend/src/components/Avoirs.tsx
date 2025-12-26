import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import axios from 'axios'
import { useDebounce } from 'use-debounce'
import type { Fournisseur, ProduitModel, Avoir, LigneAvoir } from '../types'
import { useSearchNavigation } from '../hooks/useSearchNavigation'
import { useProductSearch } from '../hooks/useProductSearch'

export default function Avoirs() {
  const [avoirs, setAvoirs] = useState<Avoir[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  // const [error, setError] = useState<string | null>(null)
  
  // Selection
  const [selectedAvoir, setSelectedAvoir] = useState<Avoir | null>(null)
  
  // Create/Edit State
  const [viewMode, setViewMode] = useState<'LIST' | 'CREATE' | 'EDIT' | 'DETAILS'>('LIST')
  // const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]) // Removed unused state
  
  // Form State
  const [selectedFournisseurId, setSelectedFournisseurId] = useState<string>('')
  const [typeAvoir, setTypeAvoir] = useState<string>('PERIME')
  const [observations, setObservations] = useState<string>('')
  const [lignes, setLignes] = useState<LigneAvoir[]>([])
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)
  const fournisseurSelectRef = useRef<HTMLInputElement>(null)
  
  // Search
  const { 
    produits: produitsList, 
    searchQuery: searchProduitQuery,
    setSearchQuery: setSearchProduitQuery
  } = useProductSearch({ minSearchLength: 2, debounceMs: 200 })

  // List Search
  const [listSearchQuery, setListSearchQuery] = useState('')
  const [debouncedListSearch] = useDebounce(listSearchQuery, 500)

  // API Endpoints
  const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_BASE_URL ?? '', [])
  const avoirsEndpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/avoirs/`
  const fournisseursEndpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/fournisseurs/`
  const ligneAvoirsEndpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/ligne-avoirs/`


  
  // Supplier Search (Create/Edit)
  const [fournisseurSearch, setFournisseurSearch] = useState('')
  const [debouncedFournisseurSearch] = useDebounce(fournisseurSearch, 300)
  const [filteredFournisseurs, setFilteredFournisseurs] = useState<Fournisseur[]>([])
  const [isSearchingFournisseur, setIsSearchingFournisseur] = useState(false)
  const [showFournisseurList, setShowFournisseurList] = useState(false)
  
  // Search Suppliers Effect
  useEffect(() => {
    if (!fournisseurSearch && viewMode !== 'CREATE') return
    
    // Si on a sélectionné un fournisseur (l'input correspond exactement au nom), on ne relance pas la recherche
    // Sauf si on veut explicitement chercher. Ici on cherche quand même pour rafraîchir.
    
    const searchFournisseurs = async () => {
        setIsSearchingFournisseur(true)
        try {
            const url = `${fournisseursEndpoint}?search=${encodeURIComponent(debouncedFournisseurSearch)}`
            const res = await axios.get(url)
            const data = res.data
            setFilteredFournisseurs(Array.isArray(data) ? data : (data.results || []))
        } catch (error) {
            console.error("Erreur recherche fournisseur", error)
        } finally {
            setIsSearchingFournisseur(false)
        }
    }

    searchFournisseurs()
  }, [debouncedFournisseurSearch, fournisseursEndpoint, viewMode])

  const selectFournisseur = (f: Fournisseur) => {
    setSelectedFournisseurId(f.id.toString())
    setFournisseurSearch(f.name)
    setShowFournisseurList(false)
  }



  // Fetch Data
  const fetchAvoirs = useCallback(async (search = '') => {
    setLoading(true)
    try {
      const url = search 
        ? `${avoirsEndpoint}?search=${encodeURIComponent(search)}`
        : avoirsEndpoint

      const res = await axios.get(url)
      
      const avoirsData = res.data
      
      setAvoirs(Array.isArray(avoirsData) ? avoirsData : (avoirsData.results || []))
    } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
             // Silence error or show toast, using state only if needed
             console.error(err)
             // setError(err.response?.data?.message ?? err.message ?? 'Erreur lors du chargement')
        } else {
             console.error(err)
             // setError('Erreur inconnue')
        }
    } finally {
      setLoading(false)
    }
  }, [avoirsEndpoint])

  useEffect(() => {
    fetchAvoirs(debouncedListSearch)
  }, [fetchAvoirs, debouncedListSearch])

  // Handlers
  const handleCreateNew = () => {
    setViewMode('CREATE')
    setSelectedAvoir(null)
    setSelectedFournisseurId('')
    setFournisseurSearch('')
    setTypeAvoir('PERIME')
    setObservations('')
    setLignes([])
    setSearchProduitQuery('')
  }

  const handleBackToList = () => {
    if (viewMode === 'DETAILS') {
      setViewMode('LIST')
      setSelectedAvoir(null)
      return
    }
    
    if (confirm('Voulez-vous vraiment quitter ? Les modifications non enregistrées seront perdues.')) {
      setViewMode('LIST')
      setSelectedAvoir(null)
    }
  }

  // Add Product to List
  const selectProduct = (product: ProduitModel) => {
    const existing = lignes.find(l => 
        (typeof l.produit === 'object' ? l.produit.id : l.produit) === product.id
    )
    
    if (existing) {
        alert('Ce produit est déjà dans la liste')
        return
    }
    
    const newLine: LigneAvoir = {
        id: Date.now(), // Temp ID
        avoir: 0,
        produit: product,
        quantity: 1,
        price: product.cost_price || '0',
        lot: '',
        date_expiration: '',
        total: product.cost_price || '0'
    }
    
    setLignes(prev => [newLine, ...prev])
    setSearchProduitQuery('')
    searchInputRef.current?.focus()
  }

  // Product Search Navigation
  const { getItemProps, handleKeyDown: hookHandleKeyDown } = useSearchNavigation(
    produitsList,
    selectProduct,
    {
      resetOnSelect: true
    }
  )

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        hookHandleKeyDown(e)
    }
  }

  // Update Line
  const updateLine = (index: number, field: keyof LigneAvoir, value: any) => {
    setLignes(prev => {
        const newLignes = [...prev]
        const line = { ...newLignes[index] }
        
        // @ts-ignore
        line[field] = value
        
        // Recalculate total if quantity or price changes
        if (field === 'quantity' || field === 'price') {
             const qty = field === 'quantity' ? Number(value) : Number(line.quantity)
             const price = field === 'price' ? Number(value) : Number(line.price)
             line.total = (qty * price).toString()
        }
        
        newLignes[index] = line
        return newLignes
    })
  }

  // Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedFournisseurId) {
        alert('Veuillez sélectionner un fournisseur')
        return
    }
    
    if (lignes.length === 0) {
        alert('Veuillez ajouter au moins un produit')
        return
    }
    
    try {
        setLoading(true)
        
        // 1. Create Avoir
        const avoirPayload = {
            fournisseur: parseInt(selectedFournisseurId),
            type_avoir: typeAvoir,
            observations
        }
        
        const { data: newAvoir } = await axios.post(avoirsEndpoint, avoirPayload)
        
        // 2. Create Lines
        const linePromises = lignes.map(ligne => {
             const produitId = typeof ligne.produit === 'object' ? ligne.produit.id : ligne.produit
             return axios.post(ligneAvoirsEndpoint, {
                 avoir: newAvoir.id,
                 produit: produitId,
                 quantity: ligne.quantity,
                 price: ligne.price,
                 lot: ligne.lot,
                 date_expiration: ligne.date_expiration || null
             })
        })
        
        await Promise.all(linePromises)
        
        alert('Avoir créé avec succès (Brouillon)')
        setViewMode('LIST')
        fetchAvoirs()
    } catch (err: any) {
        console.error(err)
        alert('Erreur lors de la création: ' + (err.response?.data?.message || err.message))
    } finally {
        setLoading(false)
    }
  }

  // Delete
  const handleDelete = async (avoir: Avoir) => {
    if (!confirm(`Voulez-vous vraiment supprimer l'avoir brouillon ${avoir.numero} ?`)) return
    
    try {
        setLoading(true)
        await axios.delete(`${avoirsEndpoint}${avoir.id}/`)
        alert('Avoir supprimé avec succès')
        fetchAvoirs()
        if (viewMode === 'DETAILS') setViewMode('LIST')
    } catch (err: any) {
        alert('Erreur: ' + (err.response?.data?.error || err.message))
        console.error(err)
    } finally {
        setLoading(false)
    }
  }

  // Validate
  const handleValidate = async (avoir: Avoir) => {
    if (!confirm(`Confirmer la validation de l'avoir ${avoir.numero} ? \nCela retirera les produits du stock.`)) return
    
    try {
        setLoading(true)
        await axios.post(`${avoirsEndpoint}${avoir.id}/valider/`)
        alert('Avoir validé et stock mis à jour')
        fetchAvoirs()
        if (viewMode === 'DETAILS') setViewMode('LIST')
    } catch (err: any) {
        alert('Erreur: ' + (err.response?.data?.error || err.message))
    } finally {
        setLoading(false)
    }
  }

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (viewMode !== 'CREATE' && viewMode !== 'EDIT') return
        
        if (e.key === 'F2') {
            e.preventDefault()
            searchInputRef.current?.focus()
        }
        if (e.key === 'F4') {
            e.preventDefault()
            fournisseurSelectRef.current?.focus()
        }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewMode])

  
  // --- Render Functions ---

  const renderListCheck = () => (
    <div className="flex flex-col h-full p-4 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h1 className="text-2xl font-bold">Avoirs Fournisseurs (Retours)</h1>
            <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:flex-none">
                    <input 
                        type="text" 
                        placeholder="Rechercher (N°, Fournisseur)..." 
                        className="input input-bordered w-full md:w-64 pl-10" 
                        value={listSearchQuery}
                        onChange={(e) => setListSearchQuery(e.target.value)}
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <button className="btn btn-primary" onClick={handleCreateNew}>
                    + Nouvel Avoir
                </button>
            </div>
        </div>
        
        {loading && !avoirs.length ? (
            <div className="flex justify-center p-8"><span className="loading loading-spinner"></span></div>
        ) : (
            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="table table-xs">
                    <thead className="bg-base-200">
                        <tr>
                            <th>Numéro</th>
                            <th>Date</th>
                            <th>Fournisseur</th>
                            <th>Type</th>
                            <th className="text-right">Total HT</th>
                            <th>Statut</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {avoirs.map(avoir => (
                            <tr key={avoir.id} className="hover">
                                <td className="font-mono font-bold">{avoir.numero}</td>
                                <td>{new Date(avoir.created_at).toLocaleDateString()}</td>
                                <td>{avoir.fournisseur_name}</td>
                                <td>
                                    <div className="badge badge-outline">{avoir.type_avoir}</div>
                                </td>
                                <td className="text-right font-bold text-error">
                                    -{Number(avoir.total_ht).toLocaleString()} F
                                </td>
                                <td>
                                    <div className={`badge ${avoir.status === 'VALIDEE' ? 'badge-success text-white' : 'badge-warning'}`}>
                                        {avoir.status}
                                    </div>
                                </td>
                                <td>
                                    <div className="join">
                                        <button 
                                            className="btn btn-sm btn-ghost join-item"
                                            onClick={() => {
                                                setSelectedAvoir(avoir)
                                                setViewMode('DETAILS')
                                            }}
                                        >
                                            Voir
                                        </button>
                                        {avoir.status === 'BROUILLON' && (
                                            <>
                                                <button 
                                                    className="btn btn-sm btn-success btn-outline join-item"
                                                    onClick={() => handleValidate(avoir)}
                                                >
                                                    Valider
                                                </button>
                                                <button 
                                                    className="btn btn-sm btn-error btn-outline join-item"
                                                    onClick={() => handleDelete(avoir)}
                                                >
                                                    Supprimer
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!avoirs.length && (
                    <div className="text-center p-8 text-gray-500">Aucun avoir trouvé</div>
                )}
            </div>
        )}
    </div>
  )

  const renderCreate = () => (
    <div className="flex flex-col h-full p-4 space-y-4 max-w-full">
         <div className="flex items-center gap-4">
            <button onClick={handleBackToList} className="btn btn-circle btn-sm btn-ghost">
                ←
            </button>
            <h2 className="text-xl font-bold">Nouvel Avoir (Retour Stock)</h2>
            
            <div className="ml-auto flex gap-2">
                 <kbd className="kbd kbd-sm">F2: Rechercher</kbd>
                 <kbd className="kbd kbd-sm">F4: Fournisseur</kbd>
            </div>
        </div>
        
        <form onSubmit={handleSave} className="flex flex-col gap-4 flex-1">
            {/* Header Form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-lg shadow-sm">
                <div className="form-control">
                    <label className="label font-bold text-xs uppercase text-gray-500">Fournisseur *</label>
                    <div className="relative">
                        <input
                            ref={fournisseurSelectRef}
                            type="text"
                            className="input input-bordered w-full"
                            value={fournisseurSearch}
                            onChange={e => {
                                setFournisseurSearch(e.target.value)
                                setSelectedFournisseurId('') // Clear selection when typing
                                setShowFournisseurList(true)
                            }}
                            onFocus={() => setShowFournisseurList(true)}
                            onBlur={() => setTimeout(() => setShowFournisseurList(false), 200)}
                            placeholder="Rechercher fournisseur..."
                            required={!selectedFournisseurId} // Required if no ID selected
                        />
                        {showFournisseurList && (
                            <div className="absolute top-full left-0 right-0 bg-white border border-base-300 rounded-b-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                                {isSearchingFournisseur ? (
                                    <div className="p-2 text-center text-sm text-gray-400">Recherche...</div>
                                ) : filteredFournisseurs.length > 0 ? (
                                    filteredFournisseurs.map(f => (
                                        <div
                                            key={f.id}
                                            className="p-2 hover:bg-base-200 cursor-pointer border-b border-base-100 last:border-0"
                                            onClick={() => selectFournisseur(f)}
                                        >
                                            <div className="font-bold">{f.name}</div>
                                            {f.phone && <div className="text-xs text-gray-500">{f.phone}</div>}
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-2 text-gray-400 text-sm text-center">Aucun fournisseur trouvé</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="form-control">
                    <label className="label font-bold text-xs uppercase text-gray-500">Type d'Avoir</label>
                    <select 
                        className="select select-bordered w-full"
                        value={typeAvoir}
                        onChange={e => setTypeAvoir(e.target.value)}
                    >
                        <option value="PERIME">Produit Périmé</option>
                        <option value="AVARIE">Produit Avarié</option>
                        <option value="NON_FACTURE">Livré non facturé</option>
                        <option value="ERREUR">Erreur de livraison</option>
                        <option value="AUTRE">Autre</option>
                    </select>
                </div>
                
                <div className="form-control">
                    <label className="label font-bold text-xs uppercase text-gray-500">Observations</label>
                    <textarea 
                        className="textarea textarea-bordered h-10 min-h-[3rem]"
                        value={observations}
                        onChange={e => setObservations(e.target.value)}
                        placeholder="Motif détaillé..."
                    />
                </div>
            </div>
            
            {/* Product Search */}
            <div className="relative">
                <input
                    ref={searchInputRef}
                    type="text"
                    className="input input-bordered w-full pl-10"
                    placeholder="Rechercher produit à retourner (F2) - Nom ou CIP..."
                    value={searchProduitQuery}
                    onChange={e => setSearchProduitQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                />
                <span className="absolute left-3 top-3 text-gray-400">🔍</span>
                
                {/* Search Results */}
                {searchProduitQuery && produitsList.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white shadow-xl rounded-b-lg border z-50 max-h-60 overflow-y-auto">
                        {produitsList.map((p, idx) => {
                             const itemProps = getItemProps(idx);
                             return (
                                <div
                                    key={p.id}
                                    {...itemProps}
                                    onClick={() => selectProduct(p)}
                                    className={`p-3 cursor-pointer border-b flex justify-between items-center ${
                                        itemProps.className ? 'bg-base-200' : 'hover:bg-base-100'
                                    }`}
                                >
                                    <div>
                                        <div className="font-bold">{p.name}</div>
                                        <div className="text-xs text-gray-500">CIP: {p.cip1} | Stock: {p.stock}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-mono">{p.selling_price} F</div>
                                    </div>
                                </div>
                             )
                        })}
                    </div>
                )}
            </div>
            
            {/* Lines Table */}
            <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="table table-pin-rows table-xs">
                        <thead className="bg-base-200">
                            <tr>
                                <th>Produit</th>
                                <th className="text-error w-24">Quantité</th>
                                <th className="w-32 text-right">Prix Retour</th>
                                <th className="w-32">Lot</th>
                                <th className="w-32">Expiration</th>
                                <th className="text-right text-error w-32">Total</th>
                                <th className="w-16"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {lignes.map((line, idx) => (
                                <tr key={line.id}>
                                    <td>
                                        <div className="font-medium">
                                            {typeof line.produit === 'object' ? line.produit.name : line.produit}
                                        </div>
                                    </td>
                                    <td>
                                        <input 
                                            type="number" 
                                            className="input input-sm input-bordered w-full text-error font-bold"
                                            value={line.quantity}
                                            onChange={e => updateLine(idx, 'quantity', e.target.value)}
                                            min="1"
                                        />
                                    </td>
                                    <td>
                                        <input 
                                            type="number" 
                                            className="input input-sm input-bordered w-full text-right"
                                            value={line.price}
                                            onChange={e => updateLine(idx, 'price', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <input 
                                            type="text" 
                                            className="input input-sm input-bordered w-full"
                                            value={line.lot}
                                            onChange={e => updateLine(idx, 'lot', e.target.value)}
                                            placeholder="N° Lot"
                                        />
                                    </td>
                                    <td>
                                        <input 
                                            type="date" 
                                            className="input input-sm input-bordered w-full"
                                            value={line.date_expiration}
                                            onChange={e => updateLine(idx, 'date_expiration', e.target.value)}
                                        />
                                    </td>
                                    <td className="text-right text-error font-bold">
                                        -{Number(line.total).toLocaleString()} F
                                    </td>
                                    <td>
                                        <button 
                                            type="button"
                                            className="btn btn-ghost btn-xs text-error"
                                            onClick={() => setLignes(prev => prev.filter((_, i) => i !== idx))}
                                        >
                                            ✕
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!lignes.length && (
                                <tr>
                                    <td colSpan={7} className="text-center py-8 text-gray-400">
                                        Ajoutez des produits pour créer un avoir
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="bg-base-100 font-bold">
                                <td colSpan={5} className="text-right">TOTAL AVOIR :</td>
                                <td className="text-right text-error text-lg">
                                    -{lignes.reduce((acc, l) => acc + Number(l.total), 0).toLocaleString()} F
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            
            <div className="flex justify-end gap-2 p-4 bg-white border-t">
                <button type="button" onClick={handleBackToList} className="btn">Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={loading || !lignes.length}>
                    {loading ? <span className="loading loading-spinner"></span> : 'Enregistrer Brouillon'}
                </button>
            </div>
        </form>
    </div>
  )

  const renderDetails = () => {
    if (!selectedAvoir) return null
    
    return (
        <div className="flex flex-col h-full p-4 space-y-4">
             <div className="flex items-center gap-4">
                <button onClick={handleBackToList} className="btn btn-circle btn-sm btn-ghost">←</button>
                <h2 className="text-xl font-bold">Détails Avoir {selectedAvoir.numero}</h2>
                <div className={`ml-auto badge ${selectedAvoir.status === 'VALIDEE' ? 'badge-success text-white' : 'badge-warning'}`}>
                    {selectedAvoir.status}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded-lg shadow-sm">
                <div>
                    <div className="text-xs text-gray-500 uppercase">Fournisseur</div>
                    <div className="font-bold">{selectedAvoir.fournisseur_name}</div>
                </div>
                <div>
                    <div className="text-xs text-gray-500 uppercase">Type</div>
                    <div className="font-bold">{selectedAvoir.type_avoir}</div>
                </div>
                <div>
                    <div className="text-xs text-gray-500 uppercase">Date</div>
                    <div>{new Date(selectedAvoir.created_at).toLocaleString()}</div>
                </div>
                 <div>
                    <div className="text-xs text-gray-500 uppercase">Créé par</div>
                    <div>{selectedAvoir.created_by_name}</div>
                </div>
                <div className="col-span-full">
                    <div className="text-xs text-gray-500 uppercase">Observations</div>
                    <div>{selectedAvoir.observations || '-'}</div>
                </div>
            </div>
            
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="table table-xs">
                    <thead className="bg-base-200">
                        <tr>
                            <th>Produit</th>
                            <th className="text-right">Qté</th>
                            <th className="text-right">Prix</th>
                            <th>Lot</th>
                            <th className="text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {selectedAvoir.produits?.map(p => (
                            <tr key={p.id}>
                                <td>
                                    <div className="font-bold">{p.produit_nom}</div>
                                    <div className="text-xs text-gray-500">{p.produit_cip}</div>
                                </td>
                                <td className="text-right text-error font-bold">-{p.quantity}</td>
                                <td className="text-right">{Number(p.price).toLocaleString()} F</td>
                                <td>{p.lot} <span className="text-xs text-gray-400">{p.date_expiration}</span></td>
                                <td className="text-right text-error">-{Number(p.total).toLocaleString()} F</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                         <tr className="bg-base-100 font-bold">
                            <td colSpan={4} className="text-right">TOTAL</td>
                            <td className="text-right text-error text-lg">-{Number(selectedAvoir.total_ht).toLocaleString()} F</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            {selectedAvoir.status === 'BROUILLON' && (
                <div className="flex justify-end p-4 gap-2">
                    <button 
                        className="btn btn-error btn-outline"
                        onClick={() => handleDelete(selectedAvoir)}
                    >
                        Supprimer Brouillon
                    </button>
                    <button 
                        className="btn btn-success text-white"
                        onClick={() => handleValidate(selectedAvoir)}
                    >
                        Valider et Retirer du Stock
                    </button>
                </div>
            )}
        </div>
    )
  }

  if (viewMode === 'CREATE') return renderCreate()
  if (viewMode === 'DETAILS') return renderDetails()
      
  return renderListCheck()
}
