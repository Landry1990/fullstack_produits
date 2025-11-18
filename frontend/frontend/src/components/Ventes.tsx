import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import type { Facture } from '../types'

export default function Ventes() {
  const [factures, setFactures] = useState<Facture[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [deletingBrouillons, setDeletingBrouillons] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL ?? ''),
    [],
  )
  const facturesEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/factures/`
    : '/api/factures/'

  useEffect(() => {
    fetchFactures()
  }, [])

  const fetchFactures = async () => {
    try {
      const response = await axios.get<Facture[]>(facturesEndpoint)
      setFactures(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement des factures:', error)
      setFactures([])
    } finally {
      setLoading(false)
    }
  }

  const fetchFactureDetails = async (factureId: number) => {
    setLoadingDetails(true)
    try {
      const response = await axios.get<Facture>(`${facturesEndpoint}${factureId}/`)
      setSelectedFacture(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement des détails de la facture:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleViewProducts = async (facture: Facture) => {
    // Si la facture a déjà les produits chargés, les afficher directement
    if (facture.produits && facture.produits.length > 0) {
      setSelectedFacture(facture)
    } else {
      // Sinon, charger les détails complets
      await fetchFactureDetails(facture.id)
    }
  }

  const handleDeleteBrouillons = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer toutes les factures brouillons ? Cette action est irréversible.')) {
      return
    }

    setDeletingBrouillons(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await axios.delete(`${facturesEndpoint}supprimer_brouillons/`)
      setSuccessMessage(response.data.detail || `${response.data.count} facture(s) brouillon supprimée(s) avec succès.`)
      // Rafraîchir la liste des factures
      await fetchFactures()
      // Effacer le message de succès après 5 secondes
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Erreur lors de la suppression des factures brouillons.')
      } else {
        setError('Erreur lors de la suppression des factures brouillons.')
      }
      console.error('Erreur lors de la suppression des factures brouillons:', err)
    } finally {
      setDeletingBrouillons(false)
    }
  }

  const brouillonsCount = factures.filter(f => f.status === 'BROU').length

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'BROU': return 'bg-yellow-100 text-yellow-800'
      case 'VAL': return 'bg-green-100 text-green-800'
      case 'PAY': return 'bg-blue-100 text-blue-800'
      case 'ANN': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Filtrer les factures
  const filteredFactures = factures.filter(facture =>
    (facture.client_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (facture.numero_facture && facture.numero_facture.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-gray-600">Chargement des factures...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gestion des Ventes</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            {factures.length} facture{factures.length > 1 ? 's' : ''} au total
            {brouillonsCount > 0 && (
              <span className="ml-2 text-yellow-600 font-semibold">
                ({brouillonsCount} brouillon{brouillonsCount > 1 ? 's' : ''})
              </span>
            )}
          </div>
          {brouillonsCount > 0 && (
            <button
              onClick={handleDeleteBrouillons}
              disabled={deletingBrouillons}
              className="btn btn-sm btn-error"
            >
              {deletingBrouillons ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Suppression...
                </>
              ) : (
                `Supprimer ${brouillonsCount} brouillon${brouillonsCount > 1 ? 's' : ''}`
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {successMessage && (
        <div role="alert" className="alert alert-success mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{successMessage}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setSuccessMessage(null)}>✕</button>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rechercher</label>
          <input
            type="text"
            placeholder="Rechercher par client ou numéro de facture..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
          />
        </div>
      </div>

      {/* Liste des factures */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredFactures.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? 'Aucune facture trouvée' : 'Aucune facture créée'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Facture
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant TTC
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredFactures.map((facture) => (
                  <tr key={facture.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {facture.numero_facture || `Brouillon ${facture.id}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {facture.id}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {facture.client_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(facture.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(facture.status)}`}>
                        {facture.status_display}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-bold text-primary">
                        {Math.round(Number(facture.total_ttc || 0)).toLocaleString('fr-FR')} F
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleViewProducts(facture)}
                        className="btn btn-sm btn-outline btn-primary"
                        disabled={loadingDetails}
                      >
                        {loadingDetails && selectedFacture?.id === facture.id ? (
                          <span className="loading loading-spinner loading-xs"></span>
                        ) : (
                          'Voir produits'
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal pour afficher les produits de la facture */}
      {selectedFacture && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4">
              Produits de la facture {selectedFacture.numero_facture || `Brouillon ${selectedFacture.id}`}
            </h3>
            
            {loadingDetails ? (
              <div className="flex justify-center items-center py-8">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : selectedFacture.produits && selectedFacture.produits.length > 0 ? (
              <>
                <div className="mb-4 p-4 bg-base-200 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold">Client:</span> {selectedFacture.client_name || 'N/A'}
                    </div>
                    <div>
                      <span className="font-semibold">Date:</span> {new Date(selectedFacture.date).toLocaleDateString('fr-FR')}
                    </div>
                    <div>
                      <span className="font-semibold">Total HT:</span> {Math.round(Number(selectedFacture.total_ht || 0)).toLocaleString('fr-FR')} F
                    </div>
                    <div>
                      <span className="font-semibold">TVA:</span> {Math.round(Number(selectedFacture.total_tva || 0)).toLocaleString('fr-FR')} F
                    </div>
                    <div className="col-span-2">
                      <span className="font-semibold">Total TTC:</span> 
                      <span className="text-primary font-bold text-lg ml-2">
                        {Math.round(Number(selectedFacture.total_ttc || 0)).toLocaleString('fr-FR')} F
                      </span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th className="text-right">Quantité</th>
                        <th className="text-right">Prix unitaire</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedFacture.produits.map((produit) => (
                        <tr key={produit.id}>
                          <td>
                            <div className="font-medium">{produit.produit.name}</div>
                            {produit.produit.description && (
                              <div className="text-sm opacity-70">{produit.produit.description}</div>
                            )}
                          </td>
                          <td className="text-right">{produit.quantity}</td>
                          <td className="text-right">{Math.round(Number(produit.selling_price || 0)).toLocaleString('fr-FR')} F</td>
                          <td className="text-right font-semibold">
                            {Math.round(produit.quantity * Number(produit.selling_price || 0)).toLocaleString('fr-FR')} F
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold">
                        <td colSpan={3} className="text-right">Total:</td>
                        <td className="text-right text-primary">
                          {Math.round(Number(selectedFacture.total_ttc || 0)).toLocaleString('fr-FR')} F
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Aucun produit dans cette facture
              </div>
            )}

            <div className="modal-action">
              <button 
                className="btn" 
                onClick={() => setSelectedFacture(null)}
              >
                Fermer
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setSelectedFacture(null)}></div>
        </div>
      )}
    </div>
  )
}