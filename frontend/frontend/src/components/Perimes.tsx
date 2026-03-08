import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { 
  BarChart2, 
  List, 
  History, 
  RefreshCw, 
  AlertTriangle, 
  Trash2, 
  Calendar, 
  MoreVertical, 
  X,
  PieChart,
  Check
} from 'lucide-react'
import type { StockLot } from '../types'
import { formatCurrency } from '../utils/formatters'
import SudoValidationModal from './common/SudoValidationModal'
import { useSudo } from '../hooks/useSudo'
import { usePrint } from '../hooks/usePrint'
import type { StockAdjustment } from '../types'

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
  const [selectedLotIds, setSelectedLotIds] = useState<number[]>([])
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])
  const [loadingAdjustments, setLoadingAdjustments] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'history'>('dashboard')
  
  const [dateDebut, setDateDebut] = useState<string>(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [dateFin, setDateFin] = useState<string>(() => new Date().toISOString().split('T')[0])

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
    fetchAdjustments()
  }, [])

  useEffect(() => {
    if (activeTab === 'list') {
      fetchLots()
    } else if (activeTab === 'history') {
      fetchAdjustments()
    }
  }, [filterDays, showExpiredOnly, activeTab, dateDebut, dateFin])

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

  const fetchAdjustments = async () => {
    setLoadingAdjustments(true)
    try {
      const response = await axios.get(`${apiBaseUrl}/api/stock-adjustments/`, {
        params: {
          reason_type: 'PERIME',
          created_at__date__gte: dateDebut,
          created_at__date__lte: dateFin,
          limit: 100
        }
      })
      const data: any = response.data
      setAdjustments(Array.isArray(data) ? data : (data.results || []))
    } catch (err) {
      console.error('Erreur chargement historiques:', err)
    } finally {
      setLoadingAdjustments(false)
    }
  }

  const fetchLots = async () => {
    setLoading(true)
    setError(null)
    setSelectedLotIds([]) // Reset selection on refresh
    try {
      const today = new Date()
      const thresholdDate = new Date()
      thresholdDate.setDate(today.getDate() + filterDays)
      
      const dateStr = thresholdDate.toISOString().split('T')[0]
      
      const response = await axios.get<StockLot[]>(stockLotsEndpoint, {
        params: {
          date_expiration_lte: dateStr,
          include_empty: 'true' // We want to see depleted lots to disable the button
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
          sudo_password: password
        })
        toast.success('Sortie de stock effectuée.')
        fetchLots()
        fetchStats() 
      } catch (err: any) {
        console.error('Erreur sortie stock:', err)
        toast.error('Erreur: ' + (err.response?.data?.detail || err.response?.data?.error || err.message || 'Erreur inconnue'))
      } finally {
        setProcessing(false)
      }
    }, {
      title: `Sortie de stock - Périmés`,
      message: `Confirmer la sortie de <strong>${qty} unités</strong> du produit <strong>${lot.produit_nom}</strong> (Lot ${lot.lot}) ?<br/><br/>Cette action est irréversible.`
    });
  }

  const handleBulkSortir = async () => {
      if (selectedLotIds.length === 0) return

      requireSudo(async (validatorId, password) => {
          try {
              setProcessing(true)
              await axios.post(`${stockLotsEndpoint}bulk_sortir_perimes/`, {
                  lot_ids: selectedLotIds,
                  reason: 'Sortie groupée périmés',
                  validated_by_id: validatorId,
                  sudo_password: password
              })
              toast.success(`${selectedLotIds.length} lots sortis avec succès.`)
              fetchLots()
              fetchStats()
          } catch (err: any) {
              console.error('Erreur sortie groupée:', err)
              toast.error('Erreur lors de la sortie groupée.')
          } finally {
              setProcessing(false)
          }
      }, {
          title: 'Sortie Groupée - Périmés',
          message: `Voulez-vous sortir <strong>${selectedLotIds.length} lots</strong> du stock ?<br/>Leur stock passera à 0.`
      })
  }

  const toggleLotSelection = (id: number) => {
      setSelectedLotIds(prev => 
          prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      )
  }

  const toggleAllSelection = () => {
      if (selectedLotIds.length === lots.filter(l => l.quantity_remaining > 0).length) {
          setSelectedLotIds([])
      } else {
          setSelectedLotIds(lots.filter(l => l.quantity_remaining > 0).map(l => l.id))
      }
  }

  const { printWithTemplate } = usePrint()

  const handlePrintHistory = () => {
    if (adjustments.length === 0) return

    const totalVal = adjustments.reduce((sum, adj) => sum + (adj.valorisation || 0), 0)

    const content = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h3 style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px;">Journal des Sorties - Produits Périmés</h3>
        <p style="text-align: center; font-size: 0.9em; margin-bottom: 20px;">
          Période: ${new Date(dateDebut).toLocaleDateString()} au ${new Date(dateFin).toLocaleDateString()}
        </p>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.85em;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Date</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Produit</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Lot</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Qté</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Valorisation</th>
            </tr>
          </thead>
          <tbody>
            ${adjustments.map(adj => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${new Date(adj.created_at).toLocaleDateString()}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${adj.produit_name}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${adj.lot_number || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${Math.abs(adj.quantity_change)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(adj.valorisation)} F</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #f9fafb; font-weight: bold;">
              <td colspan="4" style="border: 1px solid #ddd; padding: 8px; text-align: right;">TOTAL VALORISATION</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right; color: #dc2626;">${formatCurrency(totalVal)} F</td>
            </tr>
          </tfoot>
        </table>
        
        <div style="text-align: right; font-size: 0.8em; margin-top: 30px;">
          <p>Document généré le ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `

    printWithTemplate(content, { title: 'Journal des Sorties Périmés', width: 800 })
  }

  const handleExportExcel = () => {
    const url = `${apiBaseUrl}/api/stock-adjustments/export_excel/?reason_type=PERIME&created_at__date__gte=${dateDebut}&created_at__date__lte=${dateFin}`
    window.open(url, '_blank')
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



  // Calcul urgence pour couleur de la carte de prévision
  const getUrgencyClass = (valeur: number) => {
    if (valeur > 500000) return 'border-error bg-error/10'
    if (valeur > 100000) return 'border-warning bg-warning/10'
    return 'border-success bg-success/10'
  }

  return (
    <div className="h-full flex flex-col bg-base-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-base-100/50 backdrop-blur-md sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-error/10 text-error rounded-xl shadow-inner">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-base-content">{t('perimes.title', 'Gestion des Périmés')}</h1>
            <p className="text-[11px] font-medium text-base-content/40 uppercase tracking-widest">{t('perimes.subtitle', 'Analyse des pertes et prévisions')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="tabs tabs-boxed bg-base-200/50 p-1 border border-base-300/50 rounded-xl">
            <button 
              className={`tab tab-sm gap-2 h-8 rounded-lg transition-all duration-200 ${activeTab === 'dashboard' ? 'tab-active bg-primary text-primary-content shadow-md' : 'hover:bg-base-300'}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span className="font-semibold">Dashboard</span>
            </button>
            <button 
              className={`tab tab-sm gap-2 h-8 rounded-lg transition-all duration-200 ${activeTab === 'list' ? 'tab-active bg-primary text-primary-content shadow-md' : 'hover:bg-base-300'}`}
              onClick={() => setActiveTab('list')}
            >
              <List className="w-3.5 h-3.5" />
              <span className="font-semibold">Liste</span>
            </button>
            <button 
              className={`tab tab-sm gap-2 h-8 rounded-lg transition-all duration-200 ${activeTab === 'history' ? 'tab-active bg-primary text-primary-content shadow-md' : 'hover:bg-base-300'}`}
              onClick={() => setActiveTab('history')}
            >
              <History className="w-3.5 h-3.5" />
              <span className="font-semibold">Historique</span>
            </button>
          </div>
          <button 
            onClick={() => { fetchLots(); fetchStats() }} 
            className="btn btn-sm btn-ghost gap-2 h-9 px-3 rounded-lg hover:bg-base-300" 
            disabled={loading || loadingStats}
          >
            {(loading || loadingStats) ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span className="font-semibold">{t('common.refresh', 'Actualiser')}</span>
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
                          <p className="text-2xl font-bold text-error">{formatCurrency(stats.perimes.valeur_cout)} F</p>
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
                          <p className="text-2xl font-bold text-warning">{formatCurrency(stats.perimes.valeur_vente_perdue)} F</p>
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
                          <p className="text-xs text-base-content/50">{t('perimes.stats.vs_ca', 'vs CA')} ({formatCurrency(stats.indicateurs.ca_periode)} F)</p>
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
                        <p className="text-xl font-bold">{formatCurrency(stats.previsions['30j'].valeur_vente)} F</p>
                        <p className="text-xs text-base-content/60 mt-1">Valeur vente potentielle à risque</p>
                      </div>

                      {/* 60 jours */}
                      <div className={`border-2 rounded-xl p-4 ${getUrgencyClass(stats.previsions['60j'].valeur_vente)}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-base-content">60 jours</span>
                          <span className="badge badge-sm">{stats.previsions['60j'].count_lots} lots</span>
                        </div>
                        <p className="text-xl font-bold">{formatCurrency(stats.previsions['60j'].valeur_vente)} F</p>
                        <p className="text-xs text-base-content/60 mt-1">Valeur vente potentielle à risque</p>
                      </div>

                      {/* 90 jours */}
                      <div className={`border-2 rounded-xl p-4 ${getUrgencyClass(stats.previsions['90j'].valeur_vente)}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-base-content">90 jours</span>
                          <span className="badge badge-sm">{stats.previsions['90j'].count_lots} lots</span>
                        </div>
                        <p className="text-xl font-bold">{formatCurrency(stats.previsions['90j'].valeur_vente)} F</p>
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
                                <td className="text-right text-error">{formatCurrency(item.valeur_cout)} F</td>
                                <td className="text-right text-warning">{formatCurrency(item.valeur_vente)} F</td>
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
        ) : activeTab === 'list' ? (
          /* ========== LIST VIEW ========== */
          <div className="flex flex-col h-full bg-base-100 rounded-2xl border border-base-200 shadow-sm overflow-hidden">
            {/* Professional Dynamic Header */}
            <div className="p-0 border-b border-base-200 bg-base-100 relative z-20 shrink-0 sticky top-0 overflow-visible">
               <div className="p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-center h-10">
                     {selectedLotIds.length > 0 ? (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                          <div className="dropdown dropdown-bottom">
                            <div tabIndex={0} role="button" className="btn btn-sm btn-primary gap-2 h-9">
                              <MoreVertical className="w-4 h-4" />
                              {t('common.actions_title', { defaultValue: 'Actions' })}
                              <span className="badge badge-sm bg-primary-focus border-none text-white">{selectedLotIds.length}</span>
                            </div>
                            <ul tabIndex={0} className="dropdown-content z-[100] menu p-2 shadow-2xl bg-base-100 rounded-box w-56 border border-base-200 mt-2">
                              <li className="menu-title px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-base-content/40">
                                {t('common.bulk_actions', { defaultValue: 'Actions Groupées' })}
                              </li>
                              <li>
                                <a onClick={handleBulkSortir} className="flex items-center gap-3 py-3 hover:bg-error/10 text-error font-medium">
                                  <Trash2 className="w-4 h-4" /> {t('common.delete', 'Sortir du stock')}
                                </a>
                              </li>
                            </ul>
                          </div>
                          <button 
                            onClick={() => setSelectedLotIds([])}
                            className="btn btn-sm btn-ghost gap-2 text-base-content/60 hover:text-base-content h-9"
                          >
                            <X className="w-4 h-4" />
                            {t('common.actions.cancel', { defaultValue: 'Annuler' })}
                          </button>
                        </div>
                     ) : (
                        <>
                           <div className="flex items-center gap-2 animate-in fade-in duration-300">
                              <div className="p-2 bg-error/10 text-error rounded-lg">
                                <AlertTriangle className="w-5 h-5" />
                              </div>
                              <h2 className="font-bold text-lg tracking-tight">Lots à Risque</h2>
                              <span className="bg-base-200 text-base-content/60 px-2.5 py-0.5 rounded-full text-[10px] font-black">{lots.length}</span>
                           </div>
                           <div className="flex gap-3 items-center">
                              <div className="flex items-center gap-2 bg-base-200/50 p-1 px-3 rounded-xl border border-base-300/50">
                                <span className="text-[10px] font-bold text-base-content/40 uppercase">{t('common.filters', 'Filtres')}</span>
                                <div className="h-4 w-[1px] bg-base-300 mx-1"></div>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                  <input 
                                      type="checkbox" 
                                      className="checkbox checkbox-xs checkbox-error rounded-md" 
                                      checked={showExpiredOnly} 
                                      onChange={(e) => setShowExpiredOnly(e.target.checked)}
                                  />
                                  <span className="text-[11px] font-semibold text-base-content/60 group-hover:text-base-content transition-colors">Déjà périmés</span> 
                                </label>
                                
                                {!showExpiredOnly && (
                                    <select 
                                        className="select select-ghost select-xs font-bold text-[11px] h-7 focus:bg-transparent" 
                                        value={filterDays} 
                                        onChange={(e) => setFilterDays(parseInt(e.target.value))}
                                    >
                                        <option value={30}>30 jours</option>
                                        <option value={60}>60 jours</option>
                                        <option value={90}>90 jours</option>
                                        <option value={180}>180 jours</option>
                                    </select>
                                )}
                              </div>
                           </div>
                        </>
                     )}
                  </div>
               </div>
            </div>

            {/* Lots Table */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <span className="loading loading-spinner loading-lg text-primary opacity-20"></span>
                </div>
              ) : lots.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-base-content/20 gap-4">
                  <PieChart className="w-16 h-16 opacity-10" />
                  <p className="text-sm font-bold uppercase tracking-widest">{t('perimes.no_result', 'Aucun lot à risque trouvé')}</p>
                </div>
              ) : (
                <table className="table table-xs table-pin-rows w-full border-separate border-spacing-0">
                  <thead className="bg-base-200/80 backdrop-blur-sm">
                    <tr className="text-base-content/50 uppercase text-[10px] tracking-widest font-black">
                      <th className="py-3 px-4 w-12 bg-transparent text-center">
                          <input 
                            type="checkbox" 
                            className="checkbox checkbox-xs rounded-md" 
                            checked={selectedLotIds.length === lots.filter(l => l.quantity_remaining > 0).length && lots.filter(l => l.quantity_remaining > 0).length > 0}
                            onChange={toggleAllSelection}
                          />
                      </th>
                      <th className="py-3 px-4 bg-transparent">{t('perimes.table.product', 'Produit')}</th>
                      <th className="py-3 px-4 bg-transparent text-center">{t('perimes.table.lot', 'Lot')}</th>
                      <th className="py-3 px-4 bg-transparent text-center">{t('perimes.table.expiration', 'Expiration')}</th>
                      <th className="py-3 px-4 bg-transparent">{t('perimes.table.provider', 'Fournisseur')}</th>
                      <th className="py-3 px-4 bg-transparent text-right">{t('perimes.table.stock', 'Stock')}</th>
                      <th className="py-3 px-4 bg-transparent text-right">{t('perimes.table.value', 'Valeur')}</th>
                      <th className="py-3 px-4 bg-transparent text-center">{t('perimes.table.actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-200">
                    {lots.map((lot) => (
                      <tr key={lot.id} className={`hover:bg-base-200/30 transition-colors group ${lot.quantity_remaining <= 0 ? 'bg-base-100/50' : ''} ${selectedLotIds.includes(lot.id) ? 'bg-primary/5' : ''}`}>
                        <td className="py-2.5 px-4 text-center">
                            <input 
                                type="checkbox" 
                                className="checkbox checkbox-xs checkbox-primary rounded-md" 
                                checked={selectedLotIds.includes(lot.id)}
                                onChange={() => toggleLotSelection(lot.id)}
                                disabled={lot.quantity_remaining <= 0}
                            />
                        </td>
                        <td className="py-2.5 px-4">
                            <div className="font-bold text-sm text-base-content group-hover:text-primary transition-colors">{lot.produit_nom}</div>
                            <div className="text-[10px] font-mono text-base-content/40">#{lot.produit}</div>
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono text-[11px] font-bold text-base-content/60">
                            {lot.lot || '-'}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <div className={`badge badge-sm font-black px-2 py-2 gap-1.5 ${lot.date_expiration && isExpired(lot.date_expiration) ? 'bg-error/10 text-error border-none' : 'bg-warning/10 text-warning border-none'}`}>
                            <Calendar className="w-3 h-3" />
                            {formatDate(lot.date_expiration || '')}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-xs font-semibold text-base-content/50 truncate max-w-[140px]" title={lot.fournisseur_nom}>
                            {lot.fournisseur_nom}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                            <div className={`font-black text-sm ${lot.quantity_remaining > 0 ? 'text-base-content' : 'text-base-content/20'}`}>
                                {lot.quantity_remaining}
                            </div>
                        </td>
                        <td className="py-2.5 px-4 text-right text-error font-mono font-black text-xs">
                          {formatCurrency(Number(lot.price_cost || 0) * lot.quantity_remaining)} F
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {lot.quantity_remaining > 0 ? (
                            <button 
                                className="btn btn-xs btn-error btn-outline h-7 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-all transform hover:scale-105"
                                onClick={() => handleSortirStock(lot)}
                                disabled={processing}
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                {t('common.exit', 'Sortir')}
                            </button>
                          ) : (
                            <span className="text-[10px] font-black text-base-content/20 uppercase tracking-widest flex items-center justify-center gap-1">
                                <Check className="w-3 h-3" />
                                Sorti
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          /* ========== HISTORY VIEW ========== */
          <div className="space-y-4">
             {/* Filters */}
             <div className="mb-4 flex flex-wrap gap-4 items-center justify-between bg-base-50 p-4 rounded-xl border border-base-200">
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-base-content/40 uppercase pl-1">Du</span>
                        <input 
                            type="date" 
                            className="input input-bordered input-sm rounded-lg" 
                            value={dateDebut}
                            onChange={(e) => setDateDebut(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-base-content/40 uppercase pl-1">Au</span>
                        <input 
                            type="date" 
                            className="input input-bordered input-sm rounded-lg" 
                            value={dateFin}
                            onChange={(e) => setDateFin(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        className="btn btn-sm btn-outline gap-2 rounded-lg"
                        onClick={handlePrintHistory}
                        disabled={adjustments.length === 0}
                    >
                        🖨️ Imprimer
                    </button>
                    <button 
                        className="btn btn-sm btn-success text-white gap-2 rounded-lg"
                        onClick={handleExportExcel}
                        disabled={adjustments.length === 0}
                    >
                        Excel
                    </button>
                </div>
             </div>

             {/* Total Valorisation Summary Card */}
             {adjustments.length > 0 && (
                 <div className="stats shadow-sm border border-base-200 w-full mb-4">
                    <div className="stat">
                        <div className="stat-title text-xs font-bold uppercase text-base-content/50">Valorisation Totale des Sorties</div>
                        <div className="stat-value text-error text-2xl">
                            {formatCurrency(adjustments.reduce((sum, a) => sum + (a.valorisation || 0), 0))} F
                        </div>
                        <div className="stat-desc font-medium text-base-content/40">{adjustments.length} opérations sur la période</div>
                    </div>
                 </div>
             )}

             {/* Adjustments Table */}
             {loadingAdjustments ? (
                <div className="flex items-center justify-center h-64">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
             ) : adjustments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-base-content/30 border-2 border-dashed border-base-200 rounded-2xl">
                    <p className="text-lg font-bold">Aucune sortie trouvée sur cette période</p>
                </div>
             ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-base-200 overflow-hidden">
                    <table className="table table-sm w-full">
                        <thead>
                            <tr className="bg-base-100">
                                <th>Date</th>
                                <th>Produit</th>
                                <th>Lot</th>
                                <th className="text-right">Qté Sortie</th>
                                <th className="text-right">Valorisation</th>
                                <th>Utilisateur</th>
                                <th>Détails</th>
                            </tr>
                        </thead>
                        <tbody>
                            {adjustments.map((adj) => (
                                <tr key={adj.id} className="hover:bg-base-50/50 transition-colors">
                                    <td className="text-xs">{new Date(adj.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <div className="font-bold text-xs">{adj.produit_name}</div>
                                        <div className="text-[10px] opacity-40 font-mono">{adj.produit_cip}</div>
                                    </td>
                                    <td className="font-mono text-[11px]">{adj.lot_number || '-'}</td>
                                    <td className="text-right font-bold text-error">
                                        {Math.abs(adj.quantity_change)}
                                    </td>
                                    <td className="text-right text-error font-mono font-bold text-xs">
                                        {formatCurrency(adj.valorisation)}
                                    </td>
                                    <td className="text-xs text-base-content/60">{adj.user_name || adj.username}</td>
                                    <td className="text-[10px] italic text-base-content/50">{adj.reason_detail}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             )}
          </div>
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
