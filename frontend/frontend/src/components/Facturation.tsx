import React, { useState, useEffect, useMemo } from 'react'


interface Produit {
  id: number
  name: string
  stock: number
  selling_price: string
}

interface LigneFacture {
  produit: Produit
  quantite: number
  prix_unitaire: string
  total_ligne: number
}

export default function Facturation() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [clients, setClients] = useState<{id: number, name: string}[]>([])
  const [selectedClient, setSelectedClient] = useState<number | null>(null)
  const [lignesFacture, setLignesFacture] = useState<LigneFacture[]>([])
  const [loading, setLoading] = useState(false)
  const [remise, setRemise] = useState('0')
  const [tva, setTva] = useState('19.25')
  const [searchQuery, setSearchQuery] = useState('')

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL ?? ''),
    [],
  )
  const produitsEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/produits/`
    : '/api/produits/'
  const clientsEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/clients/`
    : '/api/clients/'

  useEffect(() => {
    fetchProduits()
    fetchClients()
  }, [])

  const fetchProduits = async () => {
    try {
      const response = await fetch(produitsEndpoint)
      if (response.ok) {
        const data = await response.json()
        setProduits(data)
      } else {
        console.error('Erreur API produits:', response.status)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error)
    }
  }

  const fetchClients = async () => {
    try {
      const response = await fetch(clientsEndpoint)
      if (response.ok) {
        const data = await response.json()
        setClients(data)
      } else {
        console.error('Erreur API clients:', response.status)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des clients:', error)
    }
  }

  const addProduitToFacture = (produit: Produit) => {
    const existingLigne = lignesFacture.find(ligne => ligne.produit.id === produit.id)
    
    if (existingLigne) {
      // Si le produit existe déjà, augmenter la quantité
      const updatedLignes = lignesFacture.map(ligne => 
        ligne.produit.id === produit.id 
          ? { ...ligne, quantite: ligne.quantite + 1, total_ligne: (ligne.quantite + 1) * parseFloat(ligne.prix_unitaire) }
          : ligne
      )
      setLignesFacture(updatedLignes)
    } else {
      // Ajouter une nouvelle ligne
      const nouvelleLigne: LigneFacture = {
        produit,
        quantite: 1,
        prix_unitaire: produit.selling_price,
        total_ligne: parseFloat(produit.selling_price)
      }
      setLignesFacture([...lignesFacture, nouvelleLigne])
    }
  }

  const updateQuantite = (produitId: number, quantite: number) => {
    if (quantite <= 0) {
      // Supprimer la ligne si quantité = 0
      setLignesFacture(lignesFacture.filter(ligne => ligne.produit.id !== produitId))
      return
    }

    const updatedLignes = lignesFacture.map(ligne => 
      ligne.produit.id === produitId 
        ? { ...ligne, quantite, total_ligne: quantite * parseFloat(ligne.prix_unitaire) }
        : ligne
    )
    setLignesFacture(updatedLignes)
  }

  const updatePrix = (produitId: number, prix: string) => {
    const updatedLignes = lignesFacture.map(ligne => 
      ligne.produit.id === produitId 
        ? { ...ligne, prix_unitaire: prix, total_ligne: ligne.quantite * parseFloat(prix) }
        : ligne
    )
    setLignesFacture(updatedLignes)
  }

  const removeLigne = (produitId: number) => {
    setLignesFacture(lignesFacture.filter(ligne => ligne.produit.id !== produitId))
  }

  const calculateTotal = () => {
    const sousTotal = lignesFacture.reduce((total, ligne) => total + ligne.total_ligne, 0)
    const remiseMontant = parseFloat(remise)
    const montantTva = (sousTotal - remiseMontant) * (parseFloat(tva) / 100)
    return sousTotal - remiseMontant + montantTva
  }

  // Filtrer les produits selon la recherche
  const filteredProduits = produits.filter(produit =>
    produit.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const createFacture = async () => {
    if (!selectedClient) {
      alert('Veuillez sélectionner un client')
      return
    }
    if (lignesFacture.length === 0) {
      alert('Veuillez ajouter au moins un produit')
      return
    }

    setLoading(true)
    try {
      const facturesEndpoint = apiBaseUrl
        ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/factures/`
        : '/api/factures/'
      const factureProduitsEndpoint = apiBaseUrl
        ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/facture-produits/`
        : '/api/facture-produits/'

      // Créer la facture
      const response = await fetch(facturesEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client: selectedClient,
          remise: remise,
          tva: tva
        })
      })

      if (response.ok) {
        const facture = await response.json()
        
        // Ajouter les produits à la facture
        for (const ligne of lignesFacture) {
          await fetch(factureProduitsEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              facture: facture.id,
              produit_id: ligne.produit.id,
              quantity: ligne.quantite,
              selling_price: ligne.prix_unitaire
            })
          })
        }

        alert('Facture créée avec succès !')
        // Réinitialiser le formulaire
        setLignesFacture([])
        setSelectedClient(null)
        setRemise('0')
      } else {
        alert('Erreur lors de la création de la facture')
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la création de la facture')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Facturation</h1>
      
      {/* Sélection du client */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-3">Informations Client</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select
              value={selectedClient || ''}
              onChange={(e) => setSelectedClient(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-black"
            >
              <option value="">Sélectionner un client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remise (F)</label>
            <input
              type="number"
              step="0.01"
              value={remise}
              onChange={(e) => setRemise(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-black"
            />
          </div>
    <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">TVA (%)</label>
            <input
              type="number"
              step="0.01"
              value={tva}
              onChange={(e) => setTva(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-black"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Liste des produits disponibles */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Produits Disponibles</h2>
          </div>
          <div className="p-4">
            {/* Champ de recherche */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              />
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredProduits.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  {searchQuery ? 'Aucun produit trouvé' : 'Aucun produit disponible'}
                </div>
              ) : (
                filteredProduits.map((produit) => (
                  <div key={produit.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{produit.name}</div>
                      <div className="text-sm text-gray-600">
                        Stock: <span className={produit.stock === 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>{produit.stock}</span> | 
                        Prix: <span className="text-blue-600 font-medium">{produit.selling_price} F</span>
                      </div>
                    </div>
                    <button
                      onClick={() => addProduitToFacture(produit)}
                      disabled={produit.stock === 0}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {produit.stock === 0 ? 'Rupture' : 'Ajouter'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Tableau de la facture */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Facture</h2>
          </div>
          <div className="p-4">
            {lignesFacture.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucun produit ajouté à la facture
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-3 px-2 font-medium text-gray-900">Produit</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-900">Qty</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-900">Prix</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-900">Total</th>
                        <th className="text-center py-3 px-2 font-medium text-gray-900">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignesFacture.map((ligne) => (
                        <tr key={ligne.produit.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="py-3 px-2">
                            <div className="font-medium text-gray-900">{ligne.produit.name}</div>
                            <div className="text-sm text-gray-600">Stock: <span className="font-medium">{ligne.produit.stock}</span></div>
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="number"
                              min="1"
                              max={ligne.produit.stock}
                              value={ligne.quantite}
                              onChange={(e) => updateQuantite(ligne.produit.id, parseInt(e.target.value))}
                              className="w-16 text-right border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                            />
                          </td>
                          <td className="py-3 px-2">
                            <input
                              type="number"
                              step="0.01"
                              value={ligne.prix_unitaire}
                              onChange={(e) => updatePrix(ligne.produit.id, e.target.value)}
                              className="w-20 text-right border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                            />
                          </td>
                          <td className="py-3 px-2 text-right font-medium text-gray-900">
                            {ligne.total_ligne.toFixed(0)} F
                          </td>
                          <td className="py-3 px-2 text-center">
                            <button
                              onClick={() => removeLigne(ligne.produit.id)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1 rounded text-sm transition-colors"
                              title="Supprimer"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totaux */}
                <div className="mt-4 pt-4 border-t text-black">
                  <div className="flex justify-between mb-2">
                    <span>Sous-total:</span>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">{lignesFacture.reduce((total, ligne) => total + ligne.total_ligne, 0).toFixed(0)} F</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span>Remise:</span>
                    <span>-{parseFloat(remise).toFixed(0)} F</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span>TVA ({tva}%):</span>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">{((lignesFacture.reduce((total, ligne) => total + ligne.total_ligne, 0) - parseFloat(remise)) * (parseFloat(tva) / 100)).toFixed(0)} F</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-2xl border-t pt-2 text-black">
                    <span>Total TTC:</span>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">{calculateTotal().toFixed(0)} F</span>
                  </div>
                </div>

                {/* Bouton de création */}
                <div className="mt-6">
                  <button
                    onClick={createFacture}
                    disabled={loading || !selectedClient || lignesFacture.length === 0}
                    className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Création...' : 'Créer la Facture'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}