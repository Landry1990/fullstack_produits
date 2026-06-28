import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../services/api'
import { toast } from 'react-hot-toast'
import { fr } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import DatePicker, { registerLocale } from 'react-datepicker'
import { generateClotureTemplate } from '../utils/print/printTemplates'
import BestCashierMetric from './BestCashierMetric'
import { format } from 'date-fns'
import { formatCurrency, normalizeNumberInput } from '../utils/formatters'
import { useTranslation } from 'react-i18next'
import { usePharmacySettings } from '../hooks/usePharmacySettings'
import { useAuth } from '../context/AuthContext'
import { Button } from './shadcn/button'
import { Badge } from './shadcn/badge'
import { cn } from '../lib/utils'

registerLocale('fr', fr)

import { 
  CheckCircle,
  XCircle,
  Banknote,
  Eye,
  Printer,
  Monitor,
  Clock,
  PlayCircle,
  StopCircle,
  X,
  List,
  CalendarDays
} from 'lucide-react'

interface ClotureCaisse {
  id: number
  date: string
  montant_reel: string
  montant_theorique: string
  ecart_caisse: string
  total_ventes: string | number
  total_entrees: string | number
  total_sorties: string | number
  details_paiement: Record<string, any>
  date_debut: string | null
  date_fin: string | null
  user: number | null
  user_name: string
  cloture_par_name?: string
  username: string
  observation: string | null
}

interface SessionCaisse {
  id: number
  poste: number
  poste_nom: string
  ouvert_par: number | null
  ouvert_par_name: string
  fond_de_caisse: string | null
  date_ouverture: string
  date_fermeture: string | null
  montant_total_encaisse: string | null
  est_active: boolean
  ventilation_paiements: Record<string, number>
}

export default function HistoriqueClotures() {
  const { t } = useTranslation(['cash_closings', 'common'])
  const { settings: pharmacySettings } = usePharmacySettings()
  const { user: currentUser } = useAuth()
  const currentLocale = t('common:locale', { defaultValue: 'fr-FR' })
  const currencySymbol = t(['common:currency_symbol', 'currency_symbol'], 'F')
  const [clotures, setClotures] = useState<ClotureCaisse[]>([])
  const [loading, setLoading] = useState(false)
  
  // Onglet actif: 'clotures' | 'sessions'
  const [activeTab, setActiveTab] = useState<'clotures' | 'sessions'>('clotures')
  
  // Permission pour voir les sessions
  const [canViewSessions, setCanViewSessions] = useState(false)
  
  // Sessions de caisse
  const [sessions, setSessions] = useState<SessionCaisse[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [selectedSession, setSelectedSession] = useState<SessionCaisse | null>(null)
  
  // Utilisateurs pour le filtrage
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('')
  
  // Filtres — par défaut : mois en cours
  const [dateDebut, setDateDebut] = useState<Date | null>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [dateFin, setDateFin] = useState<Date | null>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + 1, 0)
  })
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(31)
  const [totalItems, setTotalItems] = useState(0)
  
  // Totaux globaux de la période
  const [globalTotals, setGlobalTotals] = useState<any>(null)

  // Multi-Caisse
  const [postesCaisses, setPostesCaisses] = useState<any[]>([])
  const [selectedPosteCaisse, setSelectedPosteCaisse] = useState<string>('')
  const [isMultiCaisse, setIsMultiCaisse] = useState(false)
  
  // Mode d'affichage: liste détaillée ou agrégation par jour
  const [viewMode, setViewMode] = useState<'list' | 'daily'>('list')

  // Sélection
  const [selectedCloture, setSelectedCloture] = useState<ClotureCaisse | null>(null)

  // Metric month/year (default to now)
  const [metricMonth, setMetricMonth] = useState<string>(() => format(new Date(), 'MM'))
  const [metricYear, setMetricYear] = useState<string>(() => format(new Date(), 'yyyy'))
  const [showMetric, setShowMetric] = useState(false)


  // Récupérer les données initiales (utilisateurs, réglages, postes, permissions)
  useEffect(() => {
    const initPage = async () => {
      try {
        const [usersRes, settingsRes, postesRes, meRes] = await Promise.all([
          api.get('caisse/page_init/'),
          api.get('invoice-settings/'),
          api.get('postes-caisses/'),
          api.get('users/me/')
        ])
        
        setUsers(usersRes.data.users || [])
        setIsMultiCaisse(settingsRes.data.is_multi_caisse ?? false)
        setPostesCaisses(postesRes.data.results || postesRes.data || [])
        
        // Vérifier la permission can_view_cash_sessions
        const profile = meRes.data?.profile
        const isSuperuser = meRes.data?.is_superuser || currentUser?.is_superuser
        setCanViewSessions(isSuperuser || profile?.can_view_cash_sessions || false)
      } catch (err) {
        console.error('Erreur initialisation HistoriqueClotures:', err)
      }
    }
    initPage()
  }, [])

  // Helper pour formater la date en YYYY-MM-DD
  const formatDateForApi = (date: Date): string => {
    const pad = (num: number) => num.toString().padStart(2, '0')
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    return `${year}-${month}-${day}`
  }

  const fetchClotures = useCallback(async (page = currentPage) => {
    setLoading(true)
    try {
      const params: Record<string, any> = {
        page,
        page_size: pageSize
      }
      
      if (dateDebut) params.date_debut = formatDateForApi(dateDebut)
      if (dateFin) params.date_fin = formatDateForApi(dateFin)
      if (selectedUser) params.user = selectedUser
      if (selectedPosteCaisse) params.poste_caisse = selectedPosteCaisse
      
      const response = await api.get('clotures-caisse/', { params })
      
      const { results, count, totals } = response.data
      setClotures(results || [])
      setTotalItems(count || 0)
      setGlobalTotals(totals || null)
    } catch (err) {
      console.error('Erreur chargement clôtures:', err)
      toast.error(t('table.loading_error') || 'Erreur lors du chargement des clôtures')
    } finally {
      setLoading(false)
    }
  }, [pageSize, dateDebut, dateFin, selectedUser, selectedPosteCaisse, t])

  // Fetch data whenever filters or page change
  useEffect(() => {
    fetchClotures(currentPage)
  }, [fetchClotures, currentPage, dateDebut, dateFin, selectedUser, selectedPosteCaisse])

  const handleSearch = () => {
    setCurrentPage(1)
    fetchClotures(1)
  }

  const resetFilters = () => {
    const now = new Date()
    setDateDebut(new Date(now.getFullYear(), now.getMonth(), 1))
    setDateFin(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    setSelectedUser('')
    setSelectedPosteCaisse('')
    setCurrentPage(1)
  }

  // Pagination sessions (côté frontend)
  const SESSION_PAGE_SIZE = 15
  const [sessionPage, setSessionPage] = useState(1)

  // Fetch des sessions de caisse
  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const response = await api.get('sessions-caisses/')
      const data = Array.isArray(response.data) ? response.data : (response.data.results || [])
      setSessions(data)
    } catch (err) {
      console.error('Erreur chargement sessions:', err)
      toast.error('Erreur lors du chargement des sessions de caisse')
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  // Charger les sessions quand l'onglet est activé
  useEffect(() => {
    if (activeTab === 'sessions' && canViewSessions) {
      fetchSessions()
      setSessionPage(1)
    }
  }, [activeTab, canViewSessions, fetchSessions])

  const sessionsTotalPages = Math.ceil(sessions.length / SESSION_PAGE_SIZE)
  const sessionsPaged = sessions.slice((sessionPage - 1) * SESSION_PAGE_SIZE, sessionPage * SESSION_PAGE_SIZE)

  const totalPages = Math.ceil(totalItems / pageSize)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(currentLocale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatMoney = (value: string | number) => {
    return formatCurrency(normalizeNumberInput(value), currentLocale, currencySymbol)
  }

  const getModeLabel = (mode: string) => {
    return t(`common:payment_modes.${mode}`, { defaultValue: mode })
  }

  // Agrégation journalière
  const dailyData = useMemo(() => {
    const map = new Map<string, {
      date: string
      count: number
      montant_theorique: number
      montant_reel: number
      ecart_caisse: number
      total_ventes: number
      total_entrees: number
      total_sorties: number
    }>()

    clotures.forEach(c => {
      const d = c.date?.split('T')[0] || ''
      if (!d) return
      const existing = map.get(d)
      if (existing) {
        existing.count += 1
        existing.montant_theorique += normalizeNumberInput(c.montant_theorique)
        existing.montant_reel += normalizeNumberInput(c.montant_reel)
        existing.ecart_caisse += normalizeNumberInput(c.ecart_caisse)
        existing.total_ventes += normalizeNumberInput(c.total_ventes)
        existing.total_entrees += normalizeNumberInput(c.total_entrees)
        existing.total_sorties += normalizeNumberInput(c.total_sorties)
      } else {
        map.set(d, {
          date: d,
          count: 1,
          montant_theorique: normalizeNumberInput(c.montant_theorique),
          montant_reel: normalizeNumberInput(c.montant_reel),
          ecart_caisse: normalizeNumberInput(c.ecart_caisse),
          total_ventes: normalizeNumberInput(c.total_ventes),
          total_entrees: normalizeNumberInput(c.total_entrees),
          total_sorties: normalizeNumberInput(c.total_sorties),
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date))
  }, [clotures])

  const formatDay = (dateString: string) => {
    return new Date(dateString + 'T00:00:00').toLocaleDateString(currentLocale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const handlePrint = (cloture: ClotureCaisse) => {
    const win = window.open('', '', 'height=600,width=400')
    if (win) {
      const htmlContent = generateClotureTemplate({
        ...cloture,
        montant_reel: cloture.montant_reel,
        montant_theorique: cloture.montant_theorique,
        ecart_caisse: cloture.ecart_caisse,
        total_ventes: cloture.total_ventes,
        total_entrees: cloture.total_entrees,
        total_sorties: cloture.total_sorties,
        details_paiement: cloture.details_paiement,
        pharmacy_name: pharmacySettings.pharmacy_name
      });
      
      win.document.write(`
        <html>
          <head>
            <title>Clôture Caisse #${cloture.id}</title>
            <style>
              @media print {
                body { margin: 0; padding: 0; }
                @page { margin: 0; }
              }
              body { margin: 0; padding: 2mm; width: 80mm; background: white; }
            </style>
          </head>
          <body>
            ${htmlContent}
          </body>
        </html>
      `)
      win.document.close()
      
      // Wait for resources if any (none in this template currently but good practice)
      win.onload = () => {
        win.print();
        // win.close(); // Optionnel: fermer après impression
      };
      
      // Fallback if onload doesn't trigger
      setTimeout(() => {
        if (win) win.print();
      }, 500);
    }
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header and Filters Card */}
      <div className="bg-white border-b border-slate-200 shrink-0 p-6">
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                <Banknote className="size-6" />
              </div>
              {t('title')}
            </h1>
            <p className="text-slate-500 mt-1 pl-12 text-sm">
              {t('description')}
            </p>

            {/* Tab Selector */}
            {canViewSessions && (
              <div className="flex gap-1 mt-4 ml-12 bg-slate-100 rounded-lg p-1 w-fit">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('clotures')}
                  className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all", activeTab === 'clotures' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                >
                  <Banknote className="size-4" />
                  Clôtures de caisse
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('sessions')}
                  className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all", activeTab === 'sessions' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                >
                  <Clock className="size-4" />
                  Sessions de caisse
                  {sessions.filter(s => s.est_active).length > 0 && (
                    <Badge variant="outline" className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-600 border-emerald-200 animate-pulse">
                      {sessions.filter(s => s.est_active).length} active{sessions.filter(s => s.est_active).length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap lg:flex-nowrap gap-3 items-end w-full lg:w-auto">
            <div className="flex-1 lg:w-48">
              <label className="block py-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{t('filters.date_start')}</span>
              </label>
              <DatePicker
                selected={dateDebut}
                onChange={(date: Date | null) => {
                  const now = new Date()
                  setDateDebut(date ?? new Date(now.getFullYear(), now.getMonth(), 1))
                  setCurrentPage(1)
                }}
                dateFormat="dd/MM/yyyy"
                placeholderText={t('filters.select_placeholder')}
                locale="fr"
                className="w-full h-9 px-3 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
                isClearable
              />
            </div>

            <div className="flex-1 lg:w-48">
              <label className="block py-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{t('filters.date_end')}</span>
              </label>
              <DatePicker
                selected={dateFin}
                onChange={(date: Date | null) => {
                  const now = new Date()
                  setDateFin(date ?? new Date(now.getFullYear(), now.getMonth() + 1, 0))
                  setCurrentPage(1)
                }}
                dateFormat="dd/MM/yyyy"
                placeholderText={t('filters.select_placeholder')}
                locale="fr"
                className="w-full h-9 px-3 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
                isClearable
                minDate={dateDebut || undefined}
              />
            </div>

            <div className="flex-1 lg:w-48">
                <label className="block py-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{t('filters.cashier')}</span>
                </label>
                <select
                    value={selectedUser}
                    onChange={(e) => {
                        setSelectedUser(e.target.value)
                        setCurrentPage(1)
                    }}
                    className="w-full h-9 px-3 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all font-medium"
                >
                    <option value="">👤 {t('filters.all_cashiers') || 'Tous les caissiers'}</option>
                    {users.map((u: any) => (
                        <option key={u.id} value={u.id}>
                            {u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.username}
                        </option>
                    ))}
                </select>
            </div>

            {isMultiCaisse && (
                <div className="flex-1 lg:w-48">
                    <label className="block py-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Poste de Caisse</span>
                    </label>
                    <select
                        value={selectedPosteCaisse}
                        onChange={(e) => {
                            setSelectedPosteCaisse(e.target.value)
                            setCurrentPage(1)
                        }}
                        className="w-full h-9 px-3 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all font-medium"
                    >
                        <option value="">🖥️ Tous les postes</option>
                        {postesCaisses.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.nom}</option>
                        ))}
                    </select>
                </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSearch}
                disabled={loading}
                className="lg:px-6"
              >
                {loading ? <div className="animate-spin rounded-full size-4 border-b-2 border-white" /> : t('filters.filter_btn')}
              </Button>

              {(dateDebut || dateFin) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  title={t('filters.reset_title')}
                  disabled={loading}
                >
                  ✕ {t('filters.reset_btn')}
                </Button>
              )}
{/* 
              <button 
                onClick={exportExcel}
                className="btn btn-sm btn-outline btn-success gap-2"
                disabled={loading || clotures.length === 0}
              >
                <Download className="size-4" />
                Excel
              </button> */}
            </div>
          </div>
        </div>
      </div>

      {/* Contenu conditionnel selon l'onglet */}
      {activeTab === 'sessions' && canViewSessions ? (
        /* ========== ONGLET SESSIONS DE CAISSE ========== */
        <div className="flex-1 px-3 sm:px-6 py-4 sm:py-6 overflow-hidden flex flex-col gap-4">
          {/* Active Sessions Banner */}
          {sessions.filter(s => s.est_active).length > 0 && (
            <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <h3 className="font-bold text-emerald-600 text-sm uppercase tracking-wider flex items-center gap-2 mb-3">
                <PlayCircle className="size-4 animate-pulse" />
                Sessions actives en cours
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sessions.filter(s => s.est_active).map(session => (
                  <div key={session.id} className="bg-white rounded-lg p-4 border border-emerald-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">{session.poste_nom}</span>
                      <Badge className="bg-emerald-500 text-white gap-1 font-bold">
                        <span className="size-1.5 rounded-full bg-white animate-pulse"></span>
                        En cours
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500 space-y-1">
                      <div>👤 {session.ouvert_par_name}</div>
                      <div>🕐 Ouvert le {formatDate(session.date_ouverture)}</div>
                      {session.fond_de_caisse && <div>💰 Fond: {formatMoney(session.fond_de_caisse)}</div>}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSession(session)}
                      className="w-full text-emerald-600 mt-2"
                    >
                      <Eye className="size-3" /> Voir détails
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sessions Table */}
          <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 overflow-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">Statut</th>
                    <th className="py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">Poste</th>
                    <th className="py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">Caissier</th>
                    <th className="py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">Ouverture</th>
                    <th className="py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">Fermeture</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">Fond de caisse</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">Total encaissé</th>
                    <th className="text-center py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {sessionsLoading ? (
                    <tr>
                      <td colSpan={8} className="h-64 text-center">
                        <div className="animate-spin rounded-full size-8 border-b-2 border-emerald-600 mx-auto"></div>
                      </td>
                    </tr>
                  ) : sessions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="h-64 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Clock className="size-12 text-slate-300" />
                          <p className="text-lg">Aucune session de caisse</p>
                          <p className="text-sm">Les sessions apparaîtront ici après l'ouverture d'un poste de caisse.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sessionsPaged.map(session => {
                      const totalVentilation = Object.values(session.ventilation_paiements || {}).reduce((s, v) => s + v, 0)
                      return (
                        <tr key={session.id} className={cn("hover:bg-slate-50 transition-colors", session.est_active ? 'bg-emerald-50/50' : '')}>
                          <td className="py-3 px-2">
                            {session.est_active ? (
                              <Badge className="bg-emerald-500 text-white gap-1 font-bold text-[10px]">
                                <PlayCircle className="size-3" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 font-bold text-slate-600 border-slate-200 text-[10px]">
                                <StopCircle className="size-3" />
                                Fermée
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <Monitor className="size-4 text-slate-400" />
                              <span className="font-bold text-sm">{session.poste_nom}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2 font-medium text-sm">{session.ouvert_par_name}</td>
                          <td className="py-3 px-2">
                            <div className="font-semibold text-sm">{formatDate(session.date_ouverture)}</div>
                          </td>
                          <td className="py-3 px-2">
                            {session.date_fermeture ? (
                              <div className="font-semibold text-sm">{formatDate(session.date_fermeture)}</div>
                            ) : (
                              <span className="text-emerald-600 font-bold text-xs animate-pulse">— En cours —</span>
                            )}
                          </td>
                          <td className="text-right py-3 px-2 font-medium text-slate-700 text-sm">
                            {session.fond_de_caisse ? formatMoney(session.fond_de_caisse) : '-'}
                          </td>
                          <td className="text-right py-3 px-2 font-bold text-emerald-600 text-sm">
                            {formatMoney(totalVentilation)}
                          </td>
                          <td className="text-center py-3 px-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedSession(session)}
                              className="text-emerald-600 h-8 w-8 p-0"
                              title="Voir le détail"
                            >
                              <Eye className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination sessions */}
            {sessions.length > SESSION_PAGE_SIZE && (
              <div className="bg-white border-t border-slate-200 p-3 flex items-center justify-between shrink-0">
                <span className="text-sm text-slate-500">
                  {(sessionPage - 1) * SESSION_PAGE_SIZE + 1}–{Math.min(sessionPage * SESSION_PAGE_SIZE, sessions.length)} sur {sessions.length} sessions
                </span>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => setSessionPage(p => Math.max(1, p - 1))} disabled={sessionPage === 1}>Précédent</Button>
                  <span className="px-3 py-1.5 text-xs font-bold bg-slate-100 rounded-md flex items-center">Page {sessionPage}/{sessionsTotalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setSessionPage(p => Math.min(sessionsTotalPages, p + 1))} disabled={sessionPage === sessionsTotalPages}>Suivant</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========== ONGLET CLÔTURES (existant) ========== */
        <>

      {/* Best Cashier Ranking Section */}
      <div className="px-3 sm:px-6 pt-4 sm:pt-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center bg-white">
            <h2 className="font-black text-sm uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
              {t('performance.title')}
            </h2>
            <div className="flex flex-wrap gap-2 items-center justify-end w-full sm:w-auto">
              <select
                className="h-8 px-2 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-300 font-bold"
                value={metricMonth}
                onChange={(e) => {
                  const m = e.target.value
                  setMetricMonth(m)
                  const y = parseInt(metricYear)
                  const mo = parseInt(m) - 1
                  setDateDebut(new Date(y, mo, 1))
                  setDateFin(new Date(y, mo + 1, 0))
                }}
              >
                <option value="01">{t('performance.months.01')}</option>
                <option value="02">{t('performance.months.02')}</option>
                <option value="03">{t('performance.months.03')}</option>
                <option value="04">{t('performance.months.04')}</option>
                <option value="05">{t('performance.months.05')}</option>
                <option value="06">{t('performance.months.06')}</option>
                <option value="07">{t('performance.months.07')}</option>
                <option value="08">{t('performance.months.08')}</option>
                <option value="09">{t('performance.months.09')}</option>
                <option value="10">{t('performance.months.10')}</option>
                <option value="11">{t('performance.months.11')}</option>
                <option value="12">{t('performance.months.12')}</option>
              </select>
              <select
                className="h-8 px-2 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-300 font-bold"
                value={metricYear}
                onChange={(e) => {
                  const y = e.target.value
                  setMetricYear(y)
                  const mo = parseInt(metricMonth) - 1
                  setDateDebut(new Date(parseInt(y), mo, 1))
                  setDateFin(new Date(parseInt(y), mo + 1, 0))
                }}
              >
                {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y.toString()}>{y}</option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMetric(!showMetric)}
                className="h-8 px-3 font-bold"
              >
                {showMetric ? t('performance.hide') : t('performance.show')}
              </Button>
            </div>
          </div>
          {showMetric && (
            <div className="p-3 bg-slate-50/50">
              <BestCashierMetric month={metricMonth} year={metricYear} userId={selectedUser || undefined} />
            </div>
          )}
        </div>
      </div>

      {/* Global Stats Cards */}
      {globalTotals && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 shrink-0">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center">
             <div className="flex justify-between items-start">
               <div>
                  <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('stats.theoretical_total')}</h3>
                  <p className="text-2xl font-bold mt-1">{formatMoney(globalTotals.montant_theorique)}</p>
               </div>
               <div className="p-3 bg-slate-100 rounded-lg text-slate-600">
                 <Banknote className="size-6" />
               </div>
             </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center">
             <div className="flex justify-between items-start">
               <div>
                  <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('stats.real_total')}</h3>
                  <p className="text-2xl font-bold mt-1 text-emerald-600">{formatMoney(globalTotals.montant_reel)}</p>
               </div>
               <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600">
                 <CheckCircle className="size-6" />
               </div>
             </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center">
             <div className="flex justify-between items-start">
               <div>
                  <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('stats.global_gap')}</h3>
                  <p className={cn("text-2xl font-bold mt-1", normalizeNumberInput(globalTotals.ecart_caisse) < 0 ? 'text-red-600' : normalizeNumberInput(globalTotals.ecart_caisse) > 0 ? 'text-emerald-600' : 'text-slate-400')}>
                    {normalizeNumberInput(globalTotals.ecart_caisse) > 0 ? '+' : ''}{formatMoney(globalTotals.ecart_caisse)}
                  </p>
               </div>
                <div className={cn("p-3 rounded-lg", normalizeNumberInput(globalTotals.ecart_caisse) < 0 ? 'bg-red-50 text-red-600' : normalizeNumberInput(globalTotals.ecart_caisse) > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500')}>
                 <XCircle className="size-6" />
               </div>
             </div>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="flex-1 px-3 sm:px-6 pb-4 sm:pb-6 overflow-hidden flex flex-col">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
          {/* Header + Toggle */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {viewMode === 'list' ? t('table.list_title', { defaultValue: 'Clôtures détaillées' }) : t('table.daily_title', { defaultValue: 'Récapitulatif journalier' })}
            </h3>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('list')}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all", viewMode === 'list' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
              >
                <List className="size-3.5" />
                {t('view_mode.list', { defaultValue: 'Liste' })}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('daily')}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all", viewMode === 'daily' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
              >
                <CalendarDays className="size-3.5" />
                {t('view_mode.daily', { defaultValue: 'Par jour' })}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            {viewMode === 'list' ? (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100 sticky top-0 z-10 opacity-100">
                  <tr>
                    <th className="py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('table.header_date')}</th>
                    {isMultiCaisse && <th className="py-3 px-4 text-left text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">Poste</th>}
                    <th className="py-3 px-4 text-left text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('table.header_cashier')}</th>
                    <th className="py-3 px-4 text-left text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('table.header_done_by')}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('table.header_theoretical')}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('table.header_real')}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('table.header_gap')}</th>
                    <th className="text-center py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('table.header_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="h-64 text-center">
                        <div className="animate-spin rounded-full size-8 border-b-2 border-emerald-600 mx-auto"></div>
                      </td>
                    </tr>
                  ) : clotures.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="h-64 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Banknote className="size-12 text-slate-300" />
                          <p className="text-lg">{t('table.no_cloture')}</p>
                          <p className="text-sm">{t('table.no_cloture_desc')}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    clotures.map((cloture) => (
                      <tr key={cloture.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-2">
                          <div className="font-semibold text-sm whitespace-nowrap">{formatDate(cloture.date)}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">
                            {t('table.period_desc', {
                              start: cloture.date_debut ? formatDate(cloture.date_debut) : '...',
                              end: cloture.date_fin ? formatDate(cloture.date_fin) : '...'
                            })}
                          </div>
                        </td>
                        {isMultiCaisse && (
                           <td className="py-3 px-4 align-middle">
                             <span className="font-medium text-sm text-slate-700">
                               {(cloture as any).poste_caisse_nom || '-'}
                             </span>
                           </td>
                        )}
                        <td className="py-3 px-4 align-middle">
                           <span className="font-medium text-sm text-slate-800">{cloture.user_name || cloture.username || 'N/A'}</span>
                        </td>
                        <td className="py-3 px-4 align-middle">
                           <span className="text-sm font-medium text-slate-500">{cloture.cloture_par_name || '-'}</span>
                        </td>
                        <td className="text-right py-3 px-2 text-slate-700 font-medium text-sm">
                          {formatMoney(cloture.montant_theorique)}
                        </td>
                        <td className="text-right py-3 px-2 font-bold text-emerald-600 text-sm">
                          {formatMoney(cloture.montant_reel)}
                        </td>
                        <td className="text-right py-3 px-2">
                          <Badge className={cn("font-bold px-2 py-0.5 text-[10px]", normalizeNumberInput(cloture.ecart_caisse) < 0 ? 'bg-red-500 text-white' : normalizeNumberInput(cloture.ecart_caisse) > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 border-slate-200')}>
                            {normalizeNumberInput(cloture.ecart_caisse) > 0 ? '+' : ''}{formatMoney(cloture.ecart_caisse)}
                          </Badge>
                        </td>
                        <td className="text-center py-3 px-2">
                          <div className="flex justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedCloture(cloture)}
                              className="text-emerald-600 h-8 w-8 p-0"
                              title={t('table.view_details')}
                            >
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePrint(cloture)}
                              className="text-slate-500 h-8 w-8 p-0"
                              title={t('table.print')}
                            >
                              <Printer className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Footer Totaux Période */}
                {globalTotals && clotures.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr className="text-slate-700 font-bold">
                      <td className="py-3 px-2 whitespace-nowrap" colSpan={isMultiCaisse ? 4 : 3}>
                        <span className="uppercase text-[10px] tracking-tight">{t('table.period_total', { count: totalItems })}</span>
                      </td>
                      <td className="text-right py-3 px-2 text-slate-700 font-bold">{formatMoney(globalTotals.montant_theorique)}</td>
                      <td className="text-right py-3 px-2 text-emerald-600 font-bold">{formatMoney(globalTotals.montant_reel)}</td>
                      <td className={cn("text-right py-3 px-2 font-bold", normalizeNumberInput(globalTotals.ecart_caisse) < 0 ? 'text-red-600' : normalizeNumberInput(globalTotals.ecart_caisse) > 0 ? 'text-emerald-600' : '')}>
                        {normalizeNumberInput(globalTotals.ecart_caisse) > 0 ? '+' : ''}{formatMoney(globalTotals.ecart_caisse)}
                      </td>
                      <td className="px-2"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            ) : (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100 sticky top-0 z-10 opacity-100">
                  <tr>
                    <th className="py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('daily.header_date', { defaultValue: 'Date' })}</th>
                    <th className="text-center py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('daily.header_count', { defaultValue: 'Clôtures' })}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('daily.header_theoretical', { defaultValue: 'Théorique' })}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('daily.header_real', { defaultValue: 'Réel' })}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('daily.header_gap', { defaultValue: 'Écart' })}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('daily.header_sales', { defaultValue: 'Ventes' })}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('daily.header_entries', { defaultValue: 'Entrées' })}</th>
                    <th className="text-right py-3 px-2 text-[10px] lg:text-xs tracking-wider uppercase text-slate-500 font-bold whitespace-nowrap">{t('daily.header_exits', { defaultValue: 'Sorties' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="h-64 text-center">
                        <div className="animate-spin rounded-full size-8 border-b-2 border-emerald-600 mx-auto"></div>
                      </td>
                    </tr>
                  ) : dailyData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="h-64 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Banknote className="size-12 text-slate-300" />
                          <p className="text-lg">{t('daily.no_data', { defaultValue: 'Aucune donnée journalière' })}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    dailyData.map((day) => (
                      <tr key={day.date} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-2">
                          <div className="font-semibold text-sm">{formatDay(day.date)}</div>
                        </td>
                        <td className="text-center py-3 px-2">
                          <Badge variant="outline" className="font-bold text-slate-600 border-slate-200 text-[10px]">
                            {day.count}
                          </Badge>
                        </td>
                        <td className="text-right py-3 px-2 text-slate-700 font-medium text-sm">{formatMoney(day.montant_theorique)}</td>
                        <td className="text-right py-3 px-2 font-bold text-emerald-600 text-sm">{formatMoney(day.montant_reel)}</td>
                        <td className="text-right py-3 px-2">
                          <Badge className={cn("font-bold px-2 py-0.5 text-[10px]", day.ecart_caisse < 0 ? 'bg-red-500 text-white' : day.ecart_caisse > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 border-slate-200')}>
                            {day.ecart_caisse > 0 ? '+' : ''}{formatMoney(day.ecart_caisse)}
                          </Badge>
                        </td>
                        <td className="text-right py-3 px-2 font-medium text-slate-700 text-sm">{formatMoney(day.total_ventes)}</td>
                        <td className="text-right py-3 px-2 font-medium text-emerald-600 text-sm">{formatMoney(day.total_entrees)}</td>
                        <td className="text-right py-3 px-2 font-medium text-red-600 text-sm">{formatMoney(day.total_sorties)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {dailyData.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr className="text-slate-700 font-bold">
                      <td className="py-3 px-2 whitespace-nowrap">
                        <span className="uppercase text-[10px] tracking-tight">{t('daily.footer_total', { defaultValue: 'Totaux' })}</span>
                      </td>
                      <td className="text-center py-3 px-2">{dailyData.reduce((s, d) => s + d.count, 0)}</td>
                      <td className="text-right py-3 px-2 text-slate-700 font-bold">{formatMoney(dailyData.reduce((s, d) => s + d.montant_theorique, 0))}</td>
                      <td className="text-right py-3 px-2 text-emerald-600 font-bold">{formatMoney(dailyData.reduce((s, d) => s + d.montant_reel, 0))}</td>
                      <td className={cn("text-right py-3 px-2 font-bold", dailyData.reduce((s, d) => s + d.ecart_caisse, 0) < 0 ? 'text-red-600' : dailyData.reduce((s, d) => s + d.ecart_caisse, 0) > 0 ? 'text-emerald-600' : '')}>
                        {dailyData.reduce((s, d) => s + d.ecart_caisse, 0) > 0 ? '+' : ''}{formatMoney(dailyData.reduce((s, d) => s + d.ecart_caisse, 0))}
                      </td>
                      <td className="text-right py-3 px-2 text-slate-700 font-bold">{formatMoney(dailyData.reduce((s, d) => s + d.total_ventes, 0))}</td>
                      <td className="text-right py-3 px-2 text-emerald-600 font-bold">{formatMoney(dailyData.reduce((s, d) => s + d.total_entrees, 0))}</td>
                      <td className="text-right py-3 px-2 text-red-600 font-bold">{formatMoney(dailyData.reduce((s, d) => s + d.total_sorties, 0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>

          {/* Pagination Controls */}
          {viewMode === 'list' && (
            <div className="bg-white border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
              <span className="text-sm text-slate-500">
                {t('pagination.showing', {
                  start: totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0,
                  end: Math.min(currentPage * pageSize, totalItems),
                  total: totalItems
                })}
                <Badge variant="outline" className="ml-2 text-xs border-slate-200 text-slate-500">{pageSize} {t('pagination.per_page')}</Badge>
              </span>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loading}
                >
                  {t('pagination.prev')}
                </Button>
                <span className="px-3 py-1.5 text-xs font-bold bg-slate-100 rounded-md flex items-center">
                  {totalPages > 0 ? t('pagination.page', { current: currentPage, total: totalPages }) : '-'}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0 || loading}
                >
                  {t('pagination.next')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal détails */}
      {selectedCloture && (
        <dialog open className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm w-full h-full p-0 m-0 border-none">
          <div className="w-full max-w-xl p-0 overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
            <div className="bg-emerald-600 p-6 text-white shrink-0">
              <h3 className="font-bold text-xl flex items-center gap-3">
                <Banknote className="size-6" />
                {t('modal.title')}
              </h3>
              <p className="opacity-80 text-sm mt-1 pb-1">
                {t('modal.cash_of', { name: selectedCloture.user_name || selectedCloture.username || t('common:unknown') })}
                {selectedCloture.cloture_par_name && t('modal.closed_by', { name: selectedCloture.cloture_par_name })}
              </p>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {/* En-tête Date / Période */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
                 <div className="flex-1">
                   <p className="text-xs uppercase font-bold text-slate-500">{t('modal.date_label')}</p>
                   <p className="font-mono text-lg">{formatDate(selectedCloture.date)}</p>
                 </div>
                 <div className="w-px h-10 bg-slate-200"></div>
                 <div className="flex-1 text-right">
                   <p className="text-xs uppercase font-bold text-slate-500">{t('modal.period_label')}</p>
                   <p className="text-sm">{t('modal.period_from', { date: selectedCloture.date_debut ? formatDate(selectedCloture.date_debut) : '...' })}</p>
                   <p className="text-sm">{t('modal.period_to', { date: selectedCloture.date_fin ? formatDate(selectedCloture.date_fin) : '...' })}</p>
                 </div>
              </div>

              {/* Stats principales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  <div className="text-xs uppercase font-bold text-slate-500 mb-1">{t('modal.theoretical_label')}</div>
                  <div className="text-2xl font-bold">{formatMoney(selectedCloture.montant_theorique)}</div>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                  <div className="text-xs uppercase font-bold text-emerald-600 mb-1">{t('modal.real_label')}</div>
                  <div className="text-2xl font-bold text-emerald-600">{formatMoney(selectedCloture.montant_reel)}</div>
                </div>
              </div>

              {/* Écart */}
              <div className={cn("p-4 rounded-xl flex items-center justify-between", normalizeNumberInput(selectedCloture.ecart_caisse) === 0 ? 'bg-emerald-50 text-emerald-600' : normalizeNumberInput(selectedCloture.ecart_caisse) > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
                <div className="font-bold uppercase tracking-wider text-sm">{t('modal.gap_label')}</div>
                <div className="font-bold text-xl">
                  {normalizeNumberInput(selectedCloture.ecart_caisse) > 0 ? '+' : ''}{formatMoney(selectedCloture.ecart_caisse)}
                </div>
              </div>

              {/* Flux financiers */}
              <div className="space-y-3">
                <h4 className="font-bold uppercase tracking-wider text-xs text-slate-500 border-b border-slate-200 pb-2">{t('modal.flows_summary')}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white border border-slate-200 p-3 rounded-lg text-center flex flex-col justify-center relative">
                    <div className="text-xs opacity-60 font-bold">{t('modal.ventes')} : {formatMoney(selectedCloture.total_ventes)}</div>
                    <div className="text-[10px] mt-1 text-slate-500">Pharmacie: {formatMoney(selectedCloture.details_paiement?.__meta__?.total_ca_pharmacie ?? selectedCloture.total_ventes)}</div>
                    {(selectedCloture.details_paiement?.__meta__?.total_ca_divers ?? 0) > 0 && (
                      <div className="text-[10px] text-slate-500">Diverses: {formatMoney(selectedCloture.details_paiement?.__meta__?.total_ca_divers)}</div>
                    )}
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-center">
                    <div className="text-xs opacity-60 text-emerald-600 uppercase">{t('modal.entries')}</div>
                    <div className="font-bold text-emerald-600">{formatMoney(selectedCloture.total_entrees)}</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-center">
                    <div className="text-xs opacity-60 text-red-600 uppercase">{t('modal.exits')}</div>
                    <div className="font-bold text-red-600">{formatMoney(selectedCloture.total_sorties)}</div>
                  </div>
                </div>
              </div>

              {/* Détails Paiement */}
              {selectedCloture.details_paiement && Object.keys(selectedCloture.details_paiement).length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold uppercase tracking-wider text-xs text-slate-500 border-b border-slate-200 pb-2">{t('modal.mode_details')}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(selectedCloture.details_paiement).filter(([mode]) => mode !== '__meta__').map(([mode, montant]) => (
                      <div key={mode} className="flex justify-between p-2 bg-slate-50 rounded text-sm">
                        <span className="flex items-center gap-2">
                          {mode === 'especes' && '💵'}
                          {mode === 'carte' && '💳'}
                          {mode === 'cheque' && '📝'}
                          {mode === 'virement' && '🏦'}
                          {mode === 'coupon' && '🎟️'}
                          {(mode === 'om' || mode === 'momo') && '📱'}
                          {getModeLabel(mode)}
                        </span>
                        <span className="font-semibold">{formatMoney(montant)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedCloture.observation && (
                <div className="space-y-2">
                  <h4 className="font-bold uppercase tracking-wider text-xs text-slate-500">{t('modal.observations')}</h4>
                  <p className="text-sm bg-slate-50 p-3 rounded-lg border border-slate-200 italic">"{selectedCloture.observation}"</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 p-4 bg-slate-50 shrink-0 flex gap-2">
              <Button variant="outline" onClick={() => handlePrint(selectedCloture)} className="gap-2 mr-auto border-emerald-300 text-emerald-600 hover:bg-emerald-50">
                <Printer className="size-5" />
                {t('modal.print')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setSelectedCloture(null)}
              >
                {t('modal.close')}
              </Button>
            </div>
          </div>
        </dialog>
      )}
        </>
      )}

      {/* Modal Détail Session de Caisse */}
      {selectedSession && (
        <dialog open className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm w-full h-full p-0 m-0 border-none">
          <div className="w-full max-w-lg p-0 overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
            <div className={cn("p-6 shrink-0", selectedSession.est_active ? 'bg-emerald-600 text-white' : 'bg-emerald-600 text-white')}>
              <h3 className="font-bold text-xl flex items-center gap-3">
                <Clock className="size-6" />
                Détail de la session
              </h3>
              <p className="opacity-80 text-sm mt-1">
                {selectedSession.poste_nom} — {selectedSession.ouvert_par_name}
              </p>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Infos session */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  <div className="text-xs uppercase font-bold text-slate-500 mb-1">Ouverture</div>
                  <div className="font-mono text-sm font-bold">{formatDate(selectedSession.date_ouverture)}</div>
                </div>
                <div className={cn("p-4 rounded-xl border", selectedSession.est_active ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200')}>
                  <div className="text-xs uppercase font-bold text-slate-500 mb-1">Fermeture</div>
                  {selectedSession.date_fermeture ? (
                    <div className="font-mono text-sm font-bold">{formatDate(selectedSession.date_fermeture)}</div>
                  ) : (
                    <div className="text-emerald-600 font-bold text-sm animate-pulse">En cours...</div>
                  )}
                </div>
              </div>

              {selectedSession.fond_de_caisse && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                  <span className="text-xs uppercase font-bold text-slate-500">Fond de caisse</span>
                  <span className="font-bold text-lg">{formatMoney(selectedSession.fond_de_caisse)}</span>
                </div>
              )}

              {/* Ventilation paiements */}
              <div className="space-y-3">
                <h4 className="font-bold uppercase tracking-wider text-xs text-slate-500 border-b border-slate-200 pb-2">
                  Ventilation des paiements
                </h4>
                {Object.keys(selectedSession.ventilation_paiements || {}).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(selectedSession.ventilation_paiements).map(([mode, montant]) => (
                      <div key={mode} className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200 hover:border-emerald-300 transition-colors">
                        <span className="flex items-center gap-2 font-medium text-sm">
                          {mode === 'especes' && '💵'}
                          {mode === 'carte' && '💳'}
                          {mode === 'cheque' && '📝'}
                          {mode === 'virement' && '🏦'}
                          {mode === 'coupon' && '🎟️'}
                          {(mode === 'om' || mode === 'momo') && '📱'}
                          {getModeLabel(mode)}
                        </span>
                        <span className="font-bold text-emerald-600">{formatMoney(montant)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-200 mt-2">
                      <span className="font-bold text-sm uppercase tracking-wider">Total encaissé</span>
                      <span className="font-bold text-xl text-emerald-600">
                        {formatMoney(Object.values(selectedSession.ventilation_paiements).reduce((s, v) => s + v, 0))}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Banknote className="size-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Aucun paiement enregistré pour cette session</p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 p-4 bg-slate-50 shrink-0">
              <Button
                variant="ghost"
                onClick={() => setSelectedSession(null)}
              >
                Fermer
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  )
}
