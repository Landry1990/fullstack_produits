import { useState, useCallback, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'

// Types pour les requêtes
type ParamType = 'month' | 'date' | 'datetime' | 'select' | 'number' | 'text' | 'client_id'

interface QueryParam {
  key: string
  label: string
  type: ParamType
  default?: string | number
  options?: { value: string; label: string }[]
  required?: boolean
}

interface QueryDefinition {
  id: string
  name: string
  description?: string
  endpoint: string
  method?: 'GET' | 'POST'
  params: QueryParam[]
  resultType: 'table' | 'cards' | 'raw'
}

interface Client {
  id: number
  name: string
  phone?: string
}

// Définition des requêtes disponibles
const QUERIES: QueryDefinition[] = [
  {
    id: 'rapport_mensuel',
    name: 'Rapport Mensuel',
    description: 'CA, marges, créances pour un mois donné',
    endpoint: '/api/rapports/rapport_mensuel/',
    params: [
      { key: 'mois', label: 'Mois', type: 'month', required: true }
    ],
    resultType: 'cards'
  },
  {
    id: 'historique_client',
    name: 'Historique Client',
    description: 'Tous les produits achetés par un client avec dates et quantités',
    endpoint: '/api/facture-produits/',
    params: [
      { key: 'facture__client', label: 'Client', type: 'client_id', required: true }
    ],
    resultType: 'table'
  },
  {
    id: 'ca_periode',
    name: 'CA par Période',
    description: 'Chiffre d\'affaires sur une période',
    endpoint: '/api/factures/caisse_par_tranche_horaire/',
    params: [
      { key: 'date_debut', label: 'Date début', type: 'datetime', required: true },
      { key: 'date_fin', label: 'Date fin', type: 'datetime', required: true }
    ],
    resultType: 'cards'
  },
  {
    id: 'alertes_stock',
    name: 'Alertes Stock',
    description: 'Produits en rupture ou sous le seuil minimum',
    endpoint: '/api/produits/stock_alerts/',
    params: [],
    resultType: 'table'
  },
  {
    id: 'produits_perimes',
    name: 'Produits Périmés / Proches',
    description: 'Produits périmés ou proches de la péremption',
    endpoint: '/api/stock-lots/',
    params: [
      { key: 'expiring_within_days', label: 'Jours avant péremption', type: 'number', default: 90 }
    ],
    resultType: 'table'
  },
  {
    id: 'creances',
    name: 'Créances en Cours',
    description: 'Factures avec solde restant à payer',
    endpoint: '/api/creances/',
    params: [],
    resultType: 'table'
  },
  {
    id: 'historique_ventes',
    name: 'Historique Ventes du Jour',
    description: 'Toutes les ventes d\'une journée',
    endpoint: '/api/historique-ventes/',
    params: [
      { key: 'date', label: 'Date', type: 'date', required: true }
    ],
    resultType: 'table'
  },
  {
    id: 'produits_non_vendus',
    name: 'Produits Non Vendus',
    description: 'Produits sans vente depuis X jours',
    endpoint: '/api/produits/',
    params: [
      { key: 'jours_sans_vente', label: 'Jours sans vente', type: 'number', default: 90 }
    ],
    resultType: 'table'
  },
  {
    id: 'stock_negatif',
    name: 'Stock Négatif',
    description: 'Produits avec stock négatif',
    endpoint: '/api/produits/',
    params: [
      { key: 'stock__lt', label: 'Stock inférieur à', type: 'number', default: 0 }
    ],
    resultType: 'table'
  }
]

// Helper pour formater les valeurs
const formatValue = (key: string, value: any): string => {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') {
    return Math.round(value).toLocaleString('fr-FR') + (key.includes('montant') || key.includes('total') || key.includes('ca') || key.includes('price') ? ' F' : '')
  }
  if (typeof value === 'object') {
    // Pour les objets imbriqués comme produit, afficher le nom
    if (value.name) return value.name
    if (value.numero_facture) return value.numero_facture
    return JSON.stringify(value)
  }
  return String(value)
}

// Helper pour obtenir la date actuelle formatée
const getCurrentMonth = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const getCurrentDateTime = (): string => {
  const now = new Date()
  return now.toISOString().slice(0, 16)
}

const getTodayDate = (): string => {
  return new Date().toISOString().slice(0, 10)
}

export default function CentreRapports() {
  const [selectedQuery, setSelectedQuery] = useState<QueryDefinition | null>(null)
  const [params, setParams] = useState<Record<string, any>>({})
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // State for client search
  const [clients, setClients] = useState<Client[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [filteredClients, setFilteredClients] = useState<Client[]>([])
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [selectedClientName, setSelectedClientName] = useState('')

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
  
  // Load clients on mount
  useEffect(() => {
    const loadClients = async () => {
      try {
        const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/clients/` : '/api/clients/'
        const { data } = await axios.get(endpoint)
        const clientList = data.results || data
        setClients(clientList)
      } catch (err) {
        console.error('Erreur chargement clients:', err)
      }
    }
    loadClients()
  }, [apiBaseUrl])
  
  // Filter clients based on search
  useEffect(() => {
    if (clientSearch.length > 0) {
      const filtered = clients.filter(c => 
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        (c.phone && c.phone.includes(clientSearch))
      )
      setFilteredClients(filtered.slice(0, 10))
      setShowClientDropdown(true)
    } else {
      setFilteredClients([])
      setShowClientDropdown(false)
    }
  }, [clientSearch, clients])

  // Sélectionner une requête
  const handleSelectQuery = useCallback((query: QueryDefinition) => {
    setSelectedQuery(query)
    setResults(null)
    setError(null)
    
    // Initialiser les paramètres avec les valeurs par défaut
    const defaultParams: Record<string, any> = {}
    query.params.forEach(p => {
      if (p.default !== undefined) {
        defaultParams[p.key] = p.default
      } else if (p.type === 'month') {
        defaultParams[p.key] = getCurrentMonth()
      } else if (p.type === 'datetime') {
        defaultParams[p.key] = getCurrentDateTime()
      } else if (p.type === 'date') {
        defaultParams[p.key] = getTodayDate()
      }
    })
    setParams(defaultParams)
  }, [])

  // Exécuter la requête
  const executeQuery = useCallback(async () => {
    if (!selectedQuery) return
    
    setLoading(true)
    setError(null)
    
    try {
      const endpoint = apiBaseUrl 
        ? `${apiBaseUrl.replace(/\/$/, '')}${selectedQuery.endpoint}`
        : selectedQuery.endpoint
      
      const response = await axios.get(endpoint, { params })
      
      // Normaliser les résultats
      let data = response.data
      if (data.results) {
        data = data.results // Pagination DRF
      }
      
      setResults(data)
      toast.success(`Requête "${selectedQuery.name}" exécutée`)
    } catch (err) {
      console.error('Erreur requête:', err)
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || err.message)
      } else {
        setError('Erreur lors de l\'exécution de la requête')
      }
      toast.error('Erreur lors de l\'exécution')
    } finally {
      setLoading(false)
    }
  }, [selectedQuery, params, apiBaseUrl])

  // Rendu des résultats selon le type
  const renderResults = () => {
    if (!results) return null
    
    if (selectedQuery?.resultType === 'cards' && typeof results === 'object' && !Array.isArray(results)) {
      // Affichage en cartes pour les objets
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(results).map(([key, value]) => {
            // Ignorer les objets imbriqués complexes pour l'affichage simple
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              return (
                <div key={key} className="bg-base-100 rounded-lg p-4 border border-base-200">
                  <div className="text-xs uppercase text-base-content/50 mb-2">{key.replace(/_/g, ' ')}</div>
                  <div className="space-y-1">
                    {Object.entries(value as object).map(([subKey, subValue]) => (
                      <div key={subKey} className="flex justify-between text-sm">
                        <span className="text-base-content/70">{subKey.replace(/_/g, ' ')}</span>
                        <span className="font-bold">{formatValue(subKey, subValue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
            return (
              <div key={key} className="bg-base-100 rounded-lg p-4 border border-base-200">
                <div className="text-xs uppercase text-base-content/50">{key.replace(/_/g, ' ')}</div>
                <div className="text-2xl font-bold mt-1">{formatValue(key, value)}</div>
              </div>
            )
          })}
        </div>
      )
    }
    
    if (Array.isArray(results)) {
      // Affichage en tableau pour les listes
      if (results.length === 0) {
        return (
          <div className="text-center py-12 text-base-content/50">
            <div className="text-4xl mb-2">📭</div>
            <div>Aucun résultat</div>
          </div>
        )
      }
      
      // Affichage spécial pour Historique Client - groupé par facture
      if (selectedQuery?.id === 'historique_client') {
        // Grouper par facture
        const groupedByFacture: Record<string, { date: string; numero: string; items: any[] }> = {}
        
        results.forEach((item: any) => {
          const factureId = item.facture?.id || item.facture || 'unknown'
          const factureNumero = item.facture?.numero_facture || `#${factureId}`
          const factureDate = item.facture?.created_at || item.created_at || ''
          
          if (!groupedByFacture[factureId]) {
            groupedByFacture[factureId] = {
              date: factureDate,
              numero: factureNumero,
              items: []
            }
          }
          groupedByFacture[factureId].items.push(item)
        })
        
        // Trier par date décroissante
        const sortedGroups = Object.entries(groupedByFacture).sort((a, b) => {
          return new Date(b[1].date).getTime() - new Date(a[1].date).getTime()
        })
        
        return (
          <div className="space-y-4">
            {sortedGroups.map(([factureId, group]) => (
              <div key={factureId} className="collapse collapse-arrow bg-base-100 border border-base-200 rounded-lg">
                <input type="checkbox" defaultChecked />
                <div className="collapse-title font-medium flex items-center gap-4">
                  <span className="badge badge-primary">{group.numero}</span>
                  <span className="text-sm text-base-content/70">
                    {group.date ? new Date(group.date).toLocaleDateString('fr-FR', { 
                      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                    }) : '-'}
                  </span>
                  <span className="text-xs text-base-content/50">
                    {group.items.length} produit(s)
                  </span>
                </div>
                <div className="collapse-content">
                  <table className="table table-sm w-full">
                    <thead>
                      <tr>
                        <th className="text-xs">Produit</th>
                        <th className="text-xs text-center">Qté</th>
                        <th className="text-xs text-right">Prix U.</th>
                        <th className="text-xs text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="text-sm">{item.produit?.name || item.produit_nom || '-'}</td>
                          <td className="text-sm text-center">{item.quantity}</td>
                          <td className="text-sm text-right">{Math.round(Number(item.selling_price || 0)).toLocaleString('fr-FR')} F</td>
                          <td className="text-sm text-right font-medium">
                            {Math.round(item.quantity * Number(item.selling_price || 0)).toLocaleString('fr-FR')} F
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            <div className="text-sm text-base-content/50 text-center">
              Total: {results.length} ligne(s) réparties sur {sortedGroups.length} facture(s)
            </div>
          </div>
        )
      }
      
      // Affichage tableau standard
      const columns = Object.keys(results[0]).filter(k => !k.startsWith('_') && k !== 'id')
      
      return (
        <div className="overflow-x-auto">
          <table className="table table-zebra table-sm w-full">
            <thead>
              <tr>
                {columns.slice(0, 8).map(col => (
                  <th key={col} className="text-xs uppercase">{col.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 100).map((row, idx) => (
                <tr key={idx}>
                  {columns.slice(0, 8).map(col => (
                    <td key={col} className="text-sm">{formatValue(col, row[col])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {results.length > 100 && (
            <div className="text-center text-sm text-base-content/50 mt-2">
              Affichage limité à 100 résultats sur {results.length}
            </div>
          )}
        </div>
      )
    }
    
    // Affichage brut pour tout le reste
    return (
      <pre className="bg-base-200 p-4 rounded-lg overflow-auto text-xs">
        {JSON.stringify(results, null, 2)}
      </pre>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-base-200 px-6 py-4 shrink-0">
        <h1 className="text-xl font-light text-base-content">Centre de Rapports</h1>
        <p className="text-sm text-base-content/50">Sélectionnez une requête, configurez les paramètres et affichez les résultats</p>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Liste des requêtes */}
        <div className="w-72 bg-base-50 border-r border-base-200 flex flex-col shrink-0">
          <div className="p-3 border-b border-base-200 bg-base-100">
            <div className="text-xs font-bold text-base-content/50 uppercase tracking-wider">Liste des requêtes</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {QUERIES.map(query => (
              <button
                key={query.id}
                onClick={() => handleSelectQuery(query)}
                className={`w-full text-left px-4 py-3 border-b border-base-200 hover:bg-base-100 transition-colors ${
                  selectedQuery?.id === query.id ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                }`}
              >
                <div className="font-medium text-sm">{query.name}</div>
                {query.description && (
                  <div className="text-xs text-base-content/50 mt-0.5">{query.description}</div>
                )}
              </button>
            ))}
          </div>
        </div>
        
        {/* Main Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedQuery ? (
            <>
              {/* Query Header & Parameters */}
              <div className="bg-white border-b border-base-200 p-4 shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">{selectedQuery.name}</h2>
                    {selectedQuery.description && (
                      <p className="text-sm text-base-content/60">{selectedQuery.description}</p>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={executeQuery}
                      disabled={loading}
                      className="btn btn-primary btn-sm gap-2"
                    >
                      {loading ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                      Écran
                    </button>
                    <button className="btn btn-outline btn-sm gap-2" disabled>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Imprimer
                    </button>
                  </div>
                </div>
                
                {/* Parameters */}
                {selectedQuery.params.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-4">
                    {selectedQuery.params.map(param => (
                      <div key={param.key} className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs">{param.label}</span>
                        </label>
                        {param.type === 'month' && (
                          <input
                            type="month"
                            value={params[param.key] || ''}
                            onChange={e => setParams(prev => ({ ...prev, [param.key]: e.target.value }))}
                            className="input input-bordered input-sm w-48"
                          />
                        )}
                        {param.type === 'date' && (
                          <input
                            type="date"
                            value={params[param.key] || ''}
                            onChange={e => setParams(prev => ({ ...prev, [param.key]: e.target.value }))}
                            className="input input-bordered input-sm w-40"
                          />
                        )}
                        {param.type === 'datetime' && (
                          <input
                            type="datetime-local"
                            value={params[param.key] || ''}
                            onChange={e => setParams(prev => ({ ...prev, [param.key]: e.target.value }))}
                            className="input input-bordered input-sm w-48"
                          />
                        )}
                        {param.type === 'number' && (
                          <input
                            type="number"
                            value={params[param.key] || ''}
                            onChange={e => setParams(prev => ({ ...prev, [param.key]: Number(e.target.value) }))}
                            className="input input-bordered input-sm w-24"
                          />
                        )}
                        {param.type === 'text' && (
                          <input
                            type="text"
                            value={params[param.key] || ''}
                            onChange={e => setParams(prev => ({ ...prev, [param.key]: e.target.value }))}
                            className="input input-bordered input-sm w-48"
                          />
                        )}
                        {param.type === 'client_id' && (
                          <div className="relative">
                            <input
                              type="text"
                              value={clientSearch || selectedClientName}
                              onChange={e => {
                                setClientSearch(e.target.value)
                                setSelectedClientName('')
                                setParams(prev => ({ ...prev, [param.key]: '' }))
                              }}
                              onFocus={() => clientSearch.length > 0 && setShowClientDropdown(true)}
                              placeholder="Rechercher un client..."
                              className="input input-bordered input-sm w-64"
                            />
                            {showClientDropdown && filteredClients.length > 0 && (
                              <ul className="absolute z-50 w-full bg-base-100 shadow-lg rounded-box mt-1 max-h-48 overflow-auto border border-base-200">
                                {filteredClients.map(client => (
                                  <li key={client.id}>
                                    <button
                                      type="button"
                                      className="w-full text-left px-3 py-2 hover:bg-base-200 text-sm"
                                      onClick={() => {
                                        setParams(prev => ({ ...prev, [param.key]: client.id }))
                                        setSelectedClientName(client.name)
                                        setClientSearch('')
                                        setShowClientDropdown(false)
                                      }}
                                    >
                                      <span className="font-medium">{client.name}</span>
                                      {client.phone && <span className="text-xs text-base-content/50 ml-2">{client.phone}</span>}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                        {param.type === 'select' && param.options && (
                          <select
                            value={params[param.key] || ''}
                            onChange={e => setParams(prev => ({ ...prev, [param.key]: e.target.value }))}
                            className="select select-bordered select-sm w-48"
                          >
                            {param.options.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Results Panel */}
              <div className="flex-1 overflow-auto p-4 bg-base-50">
                {error && (
                  <div className="alert alert-error mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
                
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                  </div>
                ) : results ? (
                  <div className="bg-white rounded-lg shadow-sm border border-base-200 p-4">
                    <div className="text-xs text-base-content/50 mb-3 uppercase font-bold">Résultats</div>
                    {renderResults()}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-base-content/40">
                    <div className="text-6xl mb-4">📊</div>
                    <div className="text-lg">Cliquez sur "Écran" pour exécuter la requête</div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-base-content/40">
              <div className="text-6xl mb-4">👈</div>
              <div className="text-lg">Sélectionnez une requête dans la liste</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
