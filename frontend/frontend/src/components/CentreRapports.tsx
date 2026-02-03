import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import DatePicker, { registerLocale } from 'react-datepicker'
import { fr } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'

// Register French locale
registerLocale('fr', fr)

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
    description: 'Stock < Rotation Moyenne OU Stock <= Seuil Minimum',
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
    name: 'Ventes par Tranche Horaire',
    description: 'Produits vendus sur une période donnée',
    endpoint: '/api/historique-ventes/ventes_par_tranche/',
    params: [
      { key: 'date_debut', label: 'Début', type: 'datetime', required: true },
      { key: 'date_fin', label: 'Fin', type: 'datetime', required: true }
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
    description: 'Produits avec stock négatif ou faible, triés par quantité',
    endpoint: '/api/produits/',
    params: [
      { key: 'stock_lt', label: 'Stock inférieur à', type: 'number', default: 0 },
      { key: 'ordering', label: 'Tri', type: 'text', default: 'stock' }
    ],
    resultType: 'table'
  },
  {
    id: 'valeur_stock_journalier',
    name: 'Valeur Stock Journalier',
    description: 'Reconstitution historique de la valeur du stock, achats et ventes',
    endpoint: '/api/rapports/valeur_stock_journalier/',
    params: [
      { key: 'date_debut', label: 'Date début', type: 'date', required: true },
      { key: 'date_fin', label: 'Date fin', type: 'date', required: true }
    ],
    resultType: 'table'
  },
  {
    id: 'produits_tva',
    name: 'Produits avec TVA',
    description: 'Liste des produits soumis à la TVA (> 0%)',
    endpoint: '/api/produits/',
    params: [
        { key: 'tva_gt', label: 'TVA supérieure à (%)', type: 'number', default: 0 },
        { key: 'ordering', label: 'Tri', type: 'text', default: '-tva' }
    ],
    resultType: 'table'
  },
  {
    id: 'stocks_morts',
    name: 'Stocks Dormants (Dead Stock)',
    description: 'Produits à forte valeur (Argent qui dort) sans vente',
    endpoint: '/api/rapports/stocks_morts/',
    params: [
        { key: 'min_value', label: 'Valeur Min (F)', type: 'number', default: 100000 },
        { key: 'months', label: 'Mois sans vente', type: 'number', default: 6 }
    ],
    resultType: 'table'
  },
  {
    id: 'alertes_annulations',
    name: 'Alertes Annulations Suspectes',
    description: 'Utilisateurs avec un taux d\'annulation élevé (> seuil)',
    endpoint: '/api/statistiques/cancel_alerts/',
    params: [
        { key: 'threshold', label: 'Seuil annulations', type: 'number', default: 5 },
        { key: 'days', label: 'Sur les derniers (jours)', type: 'number', default: 30 }
    ],
    resultType: 'table'
  },
  {
    id: 'stats_vendeurs',
    name: 'Stats par Vendeurs',
    description: 'Classement des vendeurs par CA (hors caissiers)',
    endpoint: '/api/rapports/stats_vendeurs/',
    params: [
      { key: 'date_debut', label: 'Début', type: 'datetime', required: true },
      { key: 'date_fin', label: 'Fin', type: 'datetime', required: true }
    ],
    resultType: 'table'
  },
  {
    id: 'produits_vendus_tva',
    name: 'Produits Vendus (Soumis à TVA)',
    description: 'Produits avec TVA > 0 vendus sur la période',
    endpoint: '/api/rapports/rapport_tva_vendus/',
    params: [
      { key: 'date_debut', label: 'Début', type: 'date', required: true },
      { key: 'date_fin', label: 'Fin', type: 'date', required: true }
    ],
    resultType: 'table'
  }
]

// Helper pour formater les valeurs
const formatValue = (key: string, value: any): string => {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') {
    if (key.includes('pourcent') || key.includes('percent')) {
      return value.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %'
    }
    return Math.round(value).toLocaleString('fr-FR') + (key.includes('montant') || key.includes('total') || key.includes('ca') || key.includes('price') || key.includes('cout') || key.includes('marge') ? ' F' : '')
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

// Helper pour parser les dates de manière sécurisée
const safeDate = (dateStr: any): Date | null => {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

export default function CentreRapports() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [selectedQuery, setSelectedQuery] = useState<QueryDefinition | null>(null)
  const [params, setParams] = useState<Record<string, any>>({})
  const [results, setResults] = useState<any>(null)
  const [pagination, setPagination] = useState<{ count: number; next: string | null; previous: string | null } | null>(null)
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

  // Auto-select report from URL parameter
  useEffect(() => {
    const reportId = searchParams.get('report')
    if (reportId) {
      const query = QUERIES.find(q => q.id === reportId)
      if (query) {
        handleSelectQuery(query)
        // Auto-execute the query after a short delay to ensure UI is ready
        setTimeout(() => executeQuery(), 100)
      }
    }
  }, [searchParams])

  // Sélectionner une requête
  const handleSelectQuery = useCallback((query: QueryDefinition) => {
    setSelectedQuery(query)
    setResults(null)
    setPagination(null)
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
  const executeQuery = useCallback(async (urlOverride?: string) => {
    if (!selectedQuery) return
    
    setLoading(true)
    setError(null)
    
    try {
      let endpoint = urlOverride;
      
      if (!endpoint) {
          endpoint = apiBaseUrl 
            ? `${apiBaseUrl.replace(/\/$/, '')}${selectedQuery.endpoint}`
            : selectedQuery.endpoint
      }
      
      // Si on utilise une URL complète (pagination), on n'envoie pas les params de nouveau car ils sont déjà dans l'URL
      // Sauf si c'est la première requête (urlOverride undefined)
      const config = urlOverride ? {} : { params }
      
      const response = await axios.get(endpoint, config)
      
      // Normaliser les résultats
      let data = response.data
      
      // Helper: Extract path from absolute URL (to go through Vite proxy)
      const extractPath = (url: string | null): string | null => {
          if (!url) return null;
          try {
              const parsed = new URL(url);
              return parsed.pathname + parsed.search;
          } catch {
              return url; // Already a relative URL
          }
      }
      
      // Gestion de la pagination DRF
      if (data.results && Array.isArray(data.results)) {
        setResults(data.results)
        setPagination({
            count: data.count,
            // Use relative paths to go through Vite proxy
            next: extractPath(data.next), 
            previous: extractPath(data.previous)
        })
      } else {
        // Pas de pagination standard
        setResults(data)
        setPagination(null)
      }
      
      if (!urlOverride) toast.success(`Requête "${selectedQuery.name}" exécutée`)
      
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

  // Changer de page
  const handlePageChange = (url: string | null) => {
      if (url) {
          // Fix: Ensure we use the full URL correctly or handle relative if proxied
          // DRF returns absolute URLs usually.
          executeQuery(url)
      }
  }

  // Copier les résultats dans le presse-papier (format TSV pour Excel)
  const copyToClipboard = () => {
    if (!results) {
      toast.error('Aucun résultat à copier')
      return
    }
    
    let tsv = ''
    
    // Si les résultats sont un tableau (format table)
    if (Array.isArray(results) && results.length > 0) {
      // Récupérer les colonnes (max 8 comme dans renderResults)
      const columns = Object.keys(results[0]).filter(k => !k.startsWith('_') && k !== 'id').slice(0, 8)
      
      // En-têtes
      const headers = columns.map(col => col.replace(/_/g, ' '))
      
      // Lignes de données
      const rows = results.map(row =>
        columns.map(col => {
          const val = row[col]
          if (val === null || val === undefined) return ''
          if (typeof val === 'object') return val.name || JSON.stringify(val)
          return String(val)
        })
      )
      
      tsv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n')
    } 
    // Si les résultats sont un objet (format cards)
    else if (typeof results === 'object' && !Array.isArray(results)) {
      const entries = Object.entries(results).map(([key, value]) => {
        const formattedKey = key.replace(/_/g, ' ')
        let formattedValue = ''
        if (typeof value === 'object' && value !== null) {
          formattedValue = Object.entries(value as object).map(([k, v]) => `${k}: ${v}`).join(', ')
        } else {
          formattedValue = String(value ?? '')
        }
        return `${formattedKey}\t${formattedValue}`
      })
      tsv = entries.join('\n')
    } else {
      toast.error('Format de résultats non supporté')
      return
    }
    
    // Méthode fallback avec textarea pour compatibilité
    const textarea = document.createElement('textarea')
    textarea.value = tsv
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    
    try {
      document.execCommand('copy')
      const count = Array.isArray(results) ? results.length : Object.keys(results).length
      toast.success(`${count} éléments copiés ! Collez dans Excel.`)
    } catch (err) {
      toast.error('Erreur lors de la copie')
    } finally {
      document.body.removeChild(textarea)
    }
  }

  // Rendu des résultats selon le type
  const renderResults = () => {
    if (!results) return null
    
    // === SPECIAL RENDERER: Rapport Mensuel ===
    if (selectedQuery?.id === 'rapport_mensuel' && typeof results === 'object' && !Array.isArray(results)) {
      const data = results as any
      const formatMoney = (v: number) => Math.round(v || 0).toLocaleString('fr-FR') + ' F'
      
      return (
        <div className="space-y-6">
          {/* Header KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="stat bg-primary/10 rounded-lg p-4">
              <div className="stat-title text-xs">CA TTC</div>
              <div className="stat-value text-lg text-primary">{formatMoney(data.ca?.ca_ttc)}</div>
            </div>
            <div className="stat bg-success/10 rounded-lg p-4">
              <div className="stat-title text-xs">CA HT</div>
              <div className="stat-value text-lg text-success">{formatMoney(data.ca?.ca_ht)}</div>
            </div>
            <div className="stat bg-info/10 rounded-lg p-4">
              <div className="stat-title text-xs">Marge ({data.marge?.marge_pct || 0}%)</div>
              <div className="stat-value text-lg text-info">{formatMoney(data.marge?.marge_brute)}</div>
            </div>
            <div className="stat bg-base-200 rounded-lg p-4">
              <div className="stat-title text-xs">Nb Ventes</div>
              <div className="stat-value text-lg">{data.ca?.nb_ventes || 0}</div>
            </div>
            <div className="stat bg-warning/10 rounded-lg p-4">
              <div className="stat-title text-xs">Créances</div>
              <div className="stat-value text-lg text-warning">{formatMoney(data.creances?.total)}</div>
              <div className="stat-desc text-xs">{data.creances?.nb_factures || 0} factures</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Encaissements */}
            <div className="card bg-base-100 shadow border border-base-200">
              <div className="card-body p-4">
                <h3 className="font-bold text-sm mb-3">💰 Encaissements</h3>
                <div className="space-y-2">
                  {(data.encaissements || []).map((enc: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-base-content/70">{enc.mode_label || enc.mode}</span>
                      <span className="font-bold">{formatMoney(enc.montant)}</span>
                    </div>
                  ))}
                  {(!data.encaissements || data.encaissements.length === 0) && (
                    <div className="text-sm text-base-content/50">Aucun encaissement</div>
                  )}
                </div>
              </div>
            </div>

            {/* TVA */}
            <div className="card bg-base-100 shadow border border-base-200">
              <div className="card-body p-4">
                <h3 className="font-bold text-sm mb-3">📊 Répartition TVA</h3>
                <div className="space-y-2">
                  {(data.ca_par_tva || []).map((tva: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-base-content/70">TVA {tva.taux}%</span>
                      <span className="font-bold">{formatMoney(tva.montant_tva)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Mouvements Caisse */}
            {data.mouvements_caisse && (
              <div className="card bg-base-100 shadow border border-base-200">
                <div className="card-body p-4">
                  <h3 className="font-bold text-sm mb-3">🏦 Mouvements Caisse</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-success">Entrées</span>
                      <span className="font-bold text-success">{formatMoney(data.mouvements_caisse.total_entrees)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-error">Sorties</span>
                      <span className="font-bold text-error">{formatMoney(data.mouvements_caisse.total_sorties)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span>Solde</span>
                      <span className="font-bold">{formatMoney(data.mouvements_caisse.solde)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Fournisseurs */}
            {data.achats_par_fournisseur && data.achats_par_fournisseur.length > 0 && (
              <div className="card bg-base-100 shadow border border-base-200">
                <div className="card-body p-4">
                  <h3 className="font-bold text-sm mb-3">📦 Top Fournisseurs</h3>
                  <div className="space-y-2">
                    {data.achats_par_fournisseur.slice(0, 5).map((f: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-base-content/70 truncate max-w-[150px]">{f.fournisseur_nom}</span>
                        <span className="font-bold">{formatMoney(f.montant_total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Clients Pro */}
            {data.clients_professionnels && data.clients_professionnels.ca_total > 0 && (
              <div className="card bg-base-100 shadow border border-base-200">
                <div className="card-body p-4">
                  <h3 className="font-bold text-sm mb-3">🏢 Clients Pro</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>CA Total</span>
                      <span className="font-bold">{formatMoney(data.clients_professionnels.ca_total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Payé</span>
                      <span className="font-bold text-success">{formatMoney(data.clients_professionnels.montant_paye)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Reste</span>
                      <span className="font-bold text-warning">{formatMoney(data.clients_professionnels.reste_a_payer)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span>Recouvrement</span>
                      <span className="font-bold">{data.clients_professionnels.taux_recouvrement_pct}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* UG */}
            {data.unites_gratuites && data.unites_gratuites.valeur_totale > 0 && (
              <div className="card bg-base-100 shadow border border-base-200">
                <div className="card-body p-4">
                  <h3 className="font-bold text-sm mb-3">🎁 Unités Gratuites</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Valeur</span>
                      <span className="font-bold">{formatMoney(data.unites_gratuites.valeur_totale)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Quantité</span>
                      <span className="font-bold">{data.unites_gratuites.quantite_totale}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>% du CA</span>
                      <span className="font-bold">{data.unites_gratuites.pct_du_ca}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }
    
    if (selectedQuery?.resultType === 'cards' && typeof results === 'object' && !Array.isArray(results)) {
      // Affichage en cartes pour les objets (generic)
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
          const factureId = typeof item.facture === 'object' ? item.facture.id : item.facture
          const factureNumero = item.facture_numero || (typeof item.facture === 'object' ? item.facture.numero_facture : `#${factureId}`)
          const factureDate = item.facture_date || (typeof item.facture === 'object' ? item.facture.created_at : '') || item.created_at || ''
          
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
              Total: {pagination ? pagination.count : results.length} ligne(s) réparties sur {sortedGroups.length} facture(s)
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
          {results.length > 100 && !pagination && (
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
      <div className="bg-white border-b border-base-200 px-6 py-4 shrink-0 print:hidden">
        <h1 className="text-xl font-light text-base-content">{t('reports.title')}</h1>
        <p className="text-sm text-base-content/50">{t('reports.subtitle')}</p>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Liste des requêtes */}
        <div className="w-72 bg-base-50 border-r border-base-200 flex flex-col shrink-0 print:hidden">
          <div className="p-3 border-b border-base-200 bg-base-100">
            <div className="text-xs font-bold text-base-content/50 uppercase tracking-wider">{t('reports.queries_title')}</div>
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
                <div className="font-medium text-sm">{t(`reports.queries.${query.id}.name`)}</div>
                {t(`reports.queries.${query.id}.description`) && (
                  <div className="text-xs text-base-content/50 mt-0.5">{t(`reports.queries.${query.id}.description`)}</div>
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
                    <h2 className="text-lg font-bold">{t(`reports.queries.${selectedQuery.id}.name`)}</h2>
                    {t(`reports.queries.${selectedQuery.id}.description`) && (
                      <p className="text-sm text-base-content/60">{t(`reports.queries.${selectedQuery.id}.description`)}</p>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 shrink-0 print:hidden">
                    <button
                      onClick={() => executeQuery()}
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
                      {t('reports.execute')}
                    </button>
                    <button 
                      className="btn btn-outline btn-sm gap-2" 
                      onClick={() => window.print()}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      {t('common.print')}
                    </button>
                    <button 
                      className="btn btn-outline btn-sm gap-2"
                      onClick={copyToClipboard}
                      disabled={!results}
                    >
                      📋 {t('reports.copy')}
                    </button>
                  </div>
                </div>
                
                {/* Parameters */}
                {selectedQuery.params.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-4">
                    {selectedQuery.params.map(param => (
                      <div key={param.key} className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs">{t(`reports.params.${param.key}`) || param.label}</span>
                        </label>


                        {param.type === 'month' && (
                          <DatePicker
                            selected={safeDate(params[param.key] ? params[param.key] + '-01' : null)}
                            onChange={(date: Date | null) => {
                              if (date) {
                                const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                                setParams(prev => ({ ...prev, [param.key]: formatted }))
                              }
                            }}
                            dateFormat="MM/yyyy"
                            showMonthYearPicker
                            locale="fr"
                            placeholderText="mm/aaaa"
                            className="input input-bordered input-sm w-48"
                          />
                        )}
                        {param.type === 'date' && (
                          <DatePicker
                            selected={safeDate(params[param.key])}
                            onChange={(date: Date | null) => {
                              if (date) {
                                const formatted = date.toISOString().slice(0, 10)
                                setParams(prev => ({ ...prev, [param.key]: formatted }))
                              }
                            }}
                            dateFormat="dd/MM/yyyy"
                            locale="fr"
                            placeholderText="jj/mm/aaaa"
                            className="input input-bordered input-sm w-40"
                          />
                        )}
                        {param.type === 'datetime' && (
                          <DatePicker
                            selected={safeDate(params[param.key])}
                            onChange={(date: Date | null) => {
                              if (date) {
                                // Use local time format instead of toISOString() which converts to UTC
                                const year = date.getFullYear()
                                const month = String(date.getMonth() + 1).padStart(2, '0')
                                const day = String(date.getDate()).padStart(2, '0')
                                const hours = String(date.getHours()).padStart(2, '0')
                                const minutes = String(date.getMinutes()).padStart(2, '0')
                                const formatted = `${year}-${month}-${day}T${hours}:${minutes}`
                                setParams(prev => ({ ...prev, [param.key]: formatted }))
                              }
                            }}
                            showTimeSelect
                            timeFormat="HH:mm"
                            timeIntervals={15}
                            dateFormat="dd/MM/yyyy HH:mm"
                            locale="fr"
                            placeholderText="jj/mm/aaaa hh:mm"
                            className="input input-bordered input-sm w-48"
                          />
                        )}
                        {param.type === 'number' && (
                          <input
                            type="number"
                            value={params[param.key] !== undefined && params[param.key] !== null ? params[param.key] : ''}
                            onChange={e => setParams(prev => ({ ...prev, [param.key]: e.target.value === '' ? '' : Number(e.target.value) }))}
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
              <div className="flex-1 overflow-auto p-4 bg-base-50 flex flex-col">
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
                  <div className="bg-white rounded-lg shadow-sm border border-base-200 p-4 flex flex-col h-full">
                    <div className="text-xs text-base-content/50 mb-3 uppercase font-bold">{t('reports.results.title')}</div>
                    
                    <div className="flex-1 overflow-auto">
                        {renderResults()}
                    </div>

                    {/* Pagination Controls */}
                    {pagination && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-base-200">
                          <div className="text-sm text-base-content/60">
                             Total: <span className="font-bold text-base-content">{pagination.count}</span> éléments
                          </div>
                          <div className="join">
                            <button 
                                className="join-item btn btn-sm" 
                                disabled={!pagination.previous || loading}
                                onClick={() => handlePageChange(pagination.previous)}
                            >
                                « Précédent
                            </button>
                            <button 
                                className="join-item btn btn-sm"
                                disabled={!pagination.next || loading}
                                onClick={() => handlePageChange(pagination.next)}
                            >
                                Suivant »
                            </button>
                          </div>
                        </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-base-content/40">
                    <div className="text-6xl mb-4">📊</div>
                    <div className="text-lg">{t('reports.results.execute_prompt')}</div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-base-content/40">
              <div className="text-6xl mb-4">👈</div>
              <div className="text-lg">{t('reports.select_query_prompt')}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
