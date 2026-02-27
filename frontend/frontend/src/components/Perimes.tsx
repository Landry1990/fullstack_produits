import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import type { StockLot } from '../types'
import SudoValidationModal from './common/SudoValidationModal'
import { useSudo } from '../hooks/useSudo'

// Types pour les statistiques
interface PerimesStats {
  date_reference: string
  periode_ca_jours: number
  perimes: {
    count_lots: number
    valeur_cout: number
    valeur_vente_perdue: number
    details: Array<{
      lot_id: number
      produit_id: number
      produit_nom: string
      lot_numero: string
      date_expiration: string | null
      quantity: number
      valeur_cout: number
      valeur_vente: number
    }>
  }
  previsions: {
    '30j': { jours: number; count_lots: number; valeur_cout: number; valeur_vente: number }
    '60j': { jours: number; count_lots: number; valeur_cout: number; valeur_vente: number }
    '90j': { jours: number; count_lots: number; valeur_cout: number; valeur_vente: number }
  }
  indicateurs: {
    ca_periode: number
    taux_perte_pct: number
    pertes_historiques_qty: number
  }
}

export default function Perimes() {
  const { t } = useTranslation()
  const [lots, setLots] = useState<StockLot[]>([])
  const [stats, setStats] = useState<PerimesStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingStats, setLoadingStats] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterDays, setFilterDays] = useState<number>(30)
  const [showExpiredOnly, setShowExpiredOnly] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list'>('dashboard')

  const { sudoState, requireSudo, closeSudo } = useSudo()
  const [processing, setProcessing] = useState(false)

  const apiBaseUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    return baseUrl ? String(baseUrl).replace(/\/$/, '') : ''
  }, [])

  const stockLotsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/stock-lots/` : '/api/stock-lots/'

  useEffect(() => {
    fetchStats()
    fetchLots()
  }, [])

  useEffect(() => {
    if (activeTab === 'list') {
      fetchLots()
    }
  }, [filterDays, showExpiredOnly, activeTab])

  const fetchStats = async () => {
    setLoadingStats(true)
    try {
      const response = await axios.get<PerimesStats>(`${stockLotsEndpoint}stats_perimes/`)
      setStats(response.data)
    } catch (err) {
      console.error('Erreur chargement stats:', err)
    } finally {
      setLoadingStats(false)
    }
  }

  const fetchLots = async () => {
    setLoading(true)
    setError(null)
    try {
      const today = new Date()
      const thresholdDate = new Date()
      thresholdDate.setDate(today.getDate() + filterDays)
      
      const dateStr = thresholdDate.toISOString().split('T')[0]
      
      const response = await axios.get<StockLot[]>(stockLotsEndpoint, {
        params: {
          date_expiration_lte: dateStr,
          include_empty: 'false'
        }
      })
      
      const data: any = response.data
      let fetchedLots: StockLot[] = Array.isArray(data) ? data : (data.results || [])
      
      if (showExpiredOnly) {
         const todayStr = new Date().toISOString().split('T')[0]
         fetchedLots = fetchedLots.filter(l => l.date_expiration && l.date_expiration < todayStr)
      }
      
      setLots(fetchedLots)
    } catch (err) {
      console.error('Erreur chargement lots:', err)
      setError('Impossible de charger les lots')
    } finally {
      setLoading(false)
    }
  }

  const handleSortirStock = async (lot: StockLot) => {
    const quantity = prompt(`Combien d'unités voulez-vous sortir du stock pour le lot ${lot.lot} ? (Max: ${lot.quantity_remaining})`, String(lot.quantity_remaining))
    
    if (!quantity) return
    
    const qty = parseInt(quantity, 10)
    if (isNaN(qty) || qty <= 0 || qty > lot.quantity_remaining) {
      toast.error('Quantité invalide.')
      return
    }

    requireSudo(async (validatorId, password) => {
      try {
        setProcessing(true)
        await axios.post(`${stockLotsEndpoint}${lot.id}/sortir_perimes/`, {
          quantity: qty,
          reason: 'Périmé / Avarie',
          validated_by_id: validatorId,
          password: password
        })
        toast.success('Sortie de stock effectuée.')
        fetchLots()
        fetchStats() 
      } catch (err: any) {
        console.error('Erreur sortie stock:', err)
        toast.error('Erreur: ' + (err.response?.data?.error || err.message || 'Erreur inconnue'))
      } finally {
        setProcessing(false)
      }
    }, {
      title: `Sortie de stock - Périmés`,
      message: `Confirmer la sortie de <strong>${qty} unités</strong> du produit <strong>${lot.produit_nom}</strong> (Lot ${lot.lot}) ?<br/><br/>Cette action est irréversible.`
    });
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear().toString().slice(-2)
    return `${month}/${year}`
  }

  const isExpired = (dateString: string) => {
    if (!dateString) return false
    return new Date(dateString) < new Date()
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'decimal', 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(value) + ' F'
  }

  // Calcul urgence pour couleur de la carte de prévision
  const getUrgencyClass = (valeur: number) => {
    if (valeur > 500000) return 'border-error bg-error/10'
    if (valeur > 100000) return 'border-warning bg-warning/10'
    return 'border-success bg-success/10'
  }

  return (
    <div className="h-full flex flex-col bg-base-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-white shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-base-content">{t('perimes.title', 'Gestion des Périmés')}</h1>
          <p className="text-sm text-base-content/60 mt-1">{t('perimes.subtitle', 'Analyse des pertes et prévisions d\'expiration')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="tabs tabs-boxed">
            <button 
              className={`tab ${activeTab === 'dashboard' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Dashboard
            </button>
            <button 
              className={`tab ${activeTab === 'list' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('list')}
            >
              📋 Liste
            </button>
          </div>
          <button 
            onClick={() => { fetchLots(); fetchStats() }} 
            className="btn btn-sm btn-ghost gap-2" 
            disabled={loading || loadingStats}
          >
            {(loading || loadingStats) ? <span className="loading loading-spinner loading-xs"></span> : '🔄'}
            {t('common.refresh', 'Actualiser')}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-6 pt-4 shrink-0">
          <div role="alert" className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {activeTab === 'dashboard' ? (
          /* ========== DASHBOARD VIEW ========== */
          <div className="space-y-6">
            {/* KPI Cards Row */}
            {loadingStats ? (
              <div className="flex items-center justify-center py-12">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : stats ? (
              <>
                {/* Main KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Valeur Périmés (Coût) */}
                  <div className="card bg-gradient-to-br from-error/10 to-error/5 border border-error/30 shadow-sm">
                    <div className="card-body p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-error/20 flex items-center justify-center text-2xl">
                          💸
                        </div>
                        <div>
                          <p className="text-sm text-base-content/60">{t('perimes.stats.valeur_perimes', 'Pertes (Coût)')}</p>
                          <p className="text-2xl font-bold text-error">{formatCurrency(stats.perimes.valeur_cout)}</p>
                          <p className="text-xs text-base-content/50">{stats.perimes.count_lots} lots périmés</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Manque à Gagner (Prix Vente) */}
                  <div className="card bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/30 shadow-sm">
                    <div className="card-body p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center text-2xl">
                          📉
                        </div>
                        <div>
                          <p className="text-sm text-base-content/60">{t('perimes.stats.manque_gagner', 'Manque à Gagner')}</p>
                          <p className="text-2xl font-bold text-warning">{formatCurrency(stats.perimes.valeur_vente_perdue)}</p>
                          <p className="text-xs text-base-content/50">Au prix de vente</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Taux de Perte */}
                  <div className="card bg-gradient-to-br from-info/10 to-info/5 border border-info/30 shadow-sm">
                    <div className="card-body p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-info/20 flex items-center justify-center text-2xl">
                          📊
                        </div>
                        <div>
                          <p className="text-sm text-base-content/60">{t('perimes.stats.taux_perte', 'Taux de Perte')}</p>
                          <p className="text-2xl font-bold text-info">{stats.indicateurs.taux_perte_pct}%</p>
                          <p className="text-xs text-base-content/50">vs CA ({formatCurrency(stats.indicateurs.ca_periode)})</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prévisions Section */}
                <div className="card bg-base-100 border border-base-200 shadow-sm">
                  <div className="card-body">
                    <h2 className="card-title text-lg mb-4">
                      ⏰ {t('perimes.prevision.title', 'Prévisions d\'Expiration')}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* 30 jours */}
                      <div className={`border-2 rounded-xl p-4 ${getUrgencyClass(stats.previsions['30j'].valeur_vente)}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-base-content">30 jours</span>
                          <span className="badge badge-sm">{stats.previsions['30j'].count_lots} lots</span>
                        </div>
                        <p className="text-xl font-bold">{formatCurrency(stats.previsions['30j'].valeur_vente)}</p>
                        <p className="text-xs text-base-content/60 mt-1">Valeur vente potentielle à risque</p>
                      </div>

                      {/* 60 jours */}
                      <div className={`border-2 rounded-xl p-4 ${getUrgencyClass(stats.previsions['60j'].valeur_vente)}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-base-content">60 jours</span>
                          <span className="badge badge-sm">{stats.previsions['60j'].count_lots} lots</span>
                        </div>
                        <p className="text-xl font-bold">{formatCurrency(stats.previsions['60j'].valeur_vente)}</p>
                        <p className="text-xs text-base-content/60 mt-1">Valeur vente potentielle à risque</p>
                      </div>

                      {/* 90 jours */}
                      <div className={`border-2 rounded-xl p-4 ${getUrgencyClass(stats.previsions['90j'].valeur_vente)}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-base-content">90 jours</span>
                          <span className="badge badge-sm">{stats.previsions['90j'].count_lots} lots</span>
                        </div>
                        <p className="text-xl font-bold">{formatCurrency(stats.previsions['90j'].valeur_vente)}</p>
                        <p className="text-xs text-base-content/60 mt-1">Valeur vente potentielle à risque</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Produits Périmés */}
                {stats.perimes.details.length > 0 && (
                  <div className="card bg-base-100 border border-base-200 shadow-sm">
                    <div className="card-body">
                      <h2 className="card-title text-lg mb-4">
                        🚨 {t('perimes.top_perimes', 'Produits Périmés en Stock')}
                      </h2>
                      <div className="overflow-x-auto">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>Produit</th>
                              <th>Lot</th>
                              <th>Expiration</th>
                              <th className="text-right">Qté</th>
                              <th className="text-right">Valeur Coût</th>
                              <th className="text-right">Valeur Vente</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.perimes.details.slice(0, 10).map((item) => (
                              <tr key={item.lot_id} className="hover">
                                <td className="font-medium">{item.produit_nom}</td>
                                <td className="font-mono text-sm">{item.lot_numero || '-'}</td>
                                <td>
                                  <span className="badge badge-error badge-sm">
                                    {item.date_expiration ? formatDate(item.date_expiration) : '-'}
                                  </span>
                                </td>
                                <td className="text-right font-bold">{item.quantity}</td>
                                <td className="text-right text-error">{formatCurrency(item.valeur_cout)}</td>
                                <td className="text-right text-warning">{formatCurrency(item.valeur_vente)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {stats.perimes.details.length > 10 && (
                        <div className="mt-3 text-center">
                          <button 
                            className="btn btn-sm btn-ghost"
                            onClick={() => setActiveTab('list')}
                          >
                            Voir tous les {stats.perimes.count_lots} lots →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-base-content/60">
                <p>Aucune donnée disponible</p>
              </div>
            )}
          </div>
        ) : (
          /* ========== LIST VIEW ========== */
          <>
            {/* Filters */}
            <div className="mb-4 flex gap-4 items-center bg-base-50 p-3 rounded-lg border border-base-200">
              <div className="form-control">
                <label className="label cursor-pointer gap-2">
                  <span className="label-text font-medium">Uniquement déjà périmés</span> 
                  <input 
                    type="checkbox" 
                    className="toggle toggle-error" 
                    checked={showExpiredOnly} 
                    onChange={(e) => setShowExpiredOnly(e.target.checked)}
                  />
                </label>
              </div>
              
              {!showExpiredOnly && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Expire dans les</span>
                  <select 
                    className="select select-bordered select-sm" 
                    value={filterDays} 
                    onChange={(e) => setFilterDays(parseInt(e.target.value))}
                  >
                    <option value={30}>30 jours</option>
                    <option value={60}>60 jours</option>
                    <option value={90}>90 jours</option>
                    <option value={180}>6 mois</option>
                  </select>
                </div>
              )}
            </div>

            {/* Lots Table */}
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : lots.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-base-content/40">
                <p className="text-lg">Aucun lot trouvé</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr className="bg-base-200">
                      <th>Produit</th>
                      <th>Lot</th>
                      <th>Date Expiration</th>
                      <th>Fournisseur</th>
                      <th className="text-right">Stock</th>
                      <th className="text-right">Valeur</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((lot) => (
                      <tr key={lot.id} className="hover">
                        <td className="font-bold">{lot.produit_nom}</td>
                        <td className="font-mono">{lot.lot || '-'}</td>
                        <td>
                          <span className={`badge ${lot.date_expiration && isExpired(lot.date_expiration) ? 'badge-error' : 'badge-warning'}`}>
                            {formatDate(lot.date_expiration || '')}
                          </span>
                        </td>
                        <td>{lot.fournisseur_nom}</td>
                        <td className="text-right font-bold">{lot.quantity_remaining}</td>
                        <td className="text-right text-error">
                          {formatCurrency(Number(lot.price_cost || 0) * lot.quantity_remaining)}
                        </td>
                        <td>
                          <button 
                            className="btn btn-xs btn-error btn-outline"
                            onClick={() => handleSortirStock(lot)}
                          >
                            🗑️ Sortir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sudo Validation Modal */}
      <SudoValidationModal
        isOpen={sudoState.isOpen}
        onClose={closeSudo}
        onValidate={sudoState.onValidate}
        saving={processing}
        title={sudoState.title || `Sortie de stock - Périmés`}
        message={sudoState.message || ''}
      />
    </div>
  )
}
