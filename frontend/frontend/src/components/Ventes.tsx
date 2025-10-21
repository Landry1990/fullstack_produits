import React, { useState, useEffect, useMemo } from 'react'

interface Facture {
  id: number
  client_name: string
  numero_facture: string | null
  date: string
  status: string
  status_display: string
  total_ttc: string
}

export default function Ventes() {
  const [factures, setFactures] = useState<Facture[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

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
      const response = await fetch(facturesEndpoint)
      if (response.ok) {
        const data = await response.json()
        setFactures(data)
      } else {
        console.error('Erreur API factures:', response.status)
        // Données de test en cas d'erreur
        setFactures([
          {
            id: 1,
            client_name: 'Client Test 1',
            numero_facture: 'FAC-000001',
            date: '2024-01-15',
            status: 'VAL',
            status_display: 'Validée',
            total_ttc: '15000'
          },
          {
            id: 2,
            client_name: 'Client Test 2',
            numero_facture: null,
            date: '2024-01-16',
            status: 'BROU',
            status_display: 'Brouillon',
            total_ttc: '8500'
          }
        ])
      }
    } catch (error) {
      console.error('Erreur lors du chargement des factures:', error)
      // Données de test en cas d'erreur
      setFactures([
        {
          id: 1,
          client_name: 'Client Test 1',
          numero_facture: 'FAC-000001',
          date: '2024-01-15',
          status: 'VAL',
          status_display: 'Validée',
          total_ttc: '15000'
        },
        {
          id: 2,
          client_name: 'Client Test 2',
          numero_facture: null,
          date: '2024-01-16',
          status: 'BROU',
          status_display: 'Brouillon',
          total_ttc: '8500'
        }
      ])
    } finally {
      setLoading(false)
    }
  }

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
    facture.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
        <div className="text-sm text-gray-600">
          {factures.length} facture{factures.length > 1 ? 's' : ''} au total
        </div>
      </div>

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
                  <th className="px-6 py-3 text-right text-xs font-medium text-base-content uppercase tracking-wider">
                    Total TTC
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
                      {facture.client_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(facture.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(facture.status)}`}>
                        {facture.status_display}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-base-content text-right">
                      {parseFloat(facture.total_ttc).toFixed(0)} F
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}