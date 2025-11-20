import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import type { ProduitModel } from '../types'

type TransactionHistory = {
  type: 'ENTREE' | 'SORTIE'
  date: string
  quantity: number
  libelle: string
  prix_unitaire: string
  stock_avant: number
  stock_apres: number
}

export default function StatistiquesProduit() {
  const [produits, setProduits] = useState<ProduitModel[]>([])
  const [selectedProduit, setSelectedProduit] = useState<ProduitModel | null>(null)
  const [history, setHistory] = useState<TransactionHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(false)

  const apiBaseUrl = useMemo(() => (import.meta.env.VITE_API_BASE_URL ?? ''), [])
  const produitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/produits/` : '/api/produits/'

  useEffect(() => {
    const fetchProduits = async () => {
      setLoading(true)
      try {
        const response = await axios.get<ProduitModel[]>(produitsEndpoint)
        setProduits(response.data)
      } catch (error) {
        console.error('Erreur lors du chargement des produits:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProduits()
  }, [produitsEndpoint])

  const fetchHistory = async (produitId: number) => {
    setLoadingHistory(true)
    try {
      const response = await axios.get<TransactionHistory[]>(`${produitsEndpoint}${produitId}/history/`)
      setHistory(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique:', error)
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleProductSelect = (produit: ProduitModel) => {
    setSelectedProduit(produit)
    fetchHistory(produit.id)
    setSearchQuery('') // Clear search to show selection clearly
  }

  const filteredProduits = produits.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Statistiques Produit</h1>
          <p className="text-base-content/70">Historique des mouvements de stock</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Search Panel */}
        <div className="lg:col-span-1 card bg-base-100 shadow-sm border border-base-200 h-fit">
          <div className="card-body p-4">
            <h2 className="card-title text-sm uppercase tracking-wider text-base-content/80 mb-2">Recherche</h2>
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input input-bordered w-full pl-10"
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-4"><span className="loading loading-spinner"></span></div>
              ) : (
                filteredProduits.map(produit => (
                  <div 
                    key={produit.id}
                    onClick={() => handleProductSelect(produit)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedProduit?.id === produit.id 
                        ? 'bg-primary text-primary-content border-primary' 
                        : 'bg-base-100 border-base-200 hover:border-primary/50 hover:bg-base-200'
                    }`}
                  >
                    <div className="font-medium">{produit.name}</div>
                    <div className={`text-xs mt-1 ${selectedProduit?.id === produit.id ? 'text-primary-content/80' : 'text-base-content/60'}`}>
                      Stock actuel: {produit.stock}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* History Panel */}
        <div className="lg:col-span-3 card bg-base-100 shadow-sm border border-base-200">
          <div className="card-body p-0">
            {selectedProduit ? (
              <>
                <div className="p-6 border-b border-base-200 bg-base-200/30">
                  <h2 className="text-xl font-bold">{selectedProduit.name}</h2>
                  <div className="flex gap-4 mt-2 text-sm">
                    <div className="badge badge-outline">Stock Actuel: {selectedProduit.stock}</div>
                    <div className="badge badge-outline">Prix Vente: {selectedProduit.selling_price} F</div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead className="bg-base-200/50">
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Libellé</th>
                        <th className="text-right">Quantité</th>
                        <th className="text-right">Stock Avant</th>
                        <th className="text-right">Stock Après</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingHistory ? (
                        <tr>
                          <td colSpan={6} className="text-center py-12">
                            <span className="loading loading-spinner loading-lg"></span>
                          </td>
                        </tr>
                      ) : history.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-base-content/50">
                            Aucun mouvement de stock enregistré
                          </td>
                        </tr>
                      ) : (
                        history.map((item, index) => (
                          <tr key={index} className="hover:bg-base-200/30">
                            <td className="whitespace-nowrap text-sm">
                              {new Date(item.date).toLocaleString('fr-FR')}
                            </td>
                            <td>
                              <span className={`badge badge-sm font-medium ${
                                item.type === 'ENTREE' ? 'badge-success text-white' : 'badge-error text-white'
                              }`}>
                                {item.type}
                              </span>
                            </td>
                            <td className="max-w-xs truncate" title={item.libelle}>
                              {item.libelle}
                            </td>
                            <td className={`text-right font-bold ${
                              item.type === 'ENTREE' ? 'text-success' : 'text-error'
                            }`}>
                              {item.type === 'ENTREE' ? '+' : '-'}{item.quantity}
                            </td>
                            <td className="text-right font-mono">{item.stock_avant}</td>
                            <td className="text-right font-mono font-bold">{item.stock_apres}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-base-content/40">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
                <p className="text-lg font-medium">Sélectionnez un produit pour voir son historique</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
