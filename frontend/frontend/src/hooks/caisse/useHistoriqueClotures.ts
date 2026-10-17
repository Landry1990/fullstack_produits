/**
 * Hook d'état de l'écran Historique des clôtures de caisse.
 * Regroupe toute la logique extraite de `components/HistoriqueClotures.tsx` :
 * init (utilisateurs, réglages, postes, permissions), fetch clôtures/sessions,
 * filtres, pagination, agrégation journalière, export Excel et impression.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { gooeyToast } from 'goey-toast'
import api from '../../services/api'
import { logger } from '../../utils/logger'
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters'
import { usePharmacySettings, useDocumentLocale } from '../usePharmacySettings'
import { useAuth } from '../../context/AuthContext'
import {
  formatDateForApi,
  buildDailyData,
  exportCloturesExcel,
  printCloture,
} from '../../components/caisse/clotures/utils'
import type {
  ClotureCaisse,
  SessionCaisse,
  ClotureUserOption,
  PosteCaisseOption,
  CloturesTab,
  CloturesViewMode,
  CloturesGlobalTotals,
} from '../../components/caisse/clotures/types'

export function useHistoriqueClotures() {
  const { t } = useTranslation(['cash_closings', 'common'])
  const { settings: pharmacySettings } = usePharmacySettings()
  // Langue des documents imprimés (PharmacySettings.locale), découplée de l'UI.
  const { lang: docLang } = useDocumentLocale()
  const { t: docT } = useTranslation(['cash_closings', 'common'], { lng: docLang })
  const { user: currentUser } = useAuth()
  const currentLocale = t('common:locale', { defaultValue: 'fr-FR' })
  const currencySymbol = t(['common:currency_symbol', 'currency_symbol'], 'F')
  const [clotures, setClotures] = useState<ClotureCaisse[]>([])
  const [loading, setLoading] = useState(false)

  // Onglet actif: 'clotures' | 'sessions'
  const [activeTab, setActiveTab] = useState<CloturesTab>('clotures')

  // Permission pour voir les sessions
  const [canViewSessions, setCanViewSessions] = useState(false)

  // Sessions de caisse
  const [sessions, setSessions] = useState<SessionCaisse[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [selectedSession, setSelectedSession] = useState<SessionCaisse | null>(null)

  // Utilisateurs pour le filtrage
  const [users, setUsers] = useState<ClotureUserOption[]>([])
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
  const [globalTotals, setGlobalTotals] = useState<CloturesGlobalTotals | null>(null)

  // Multi-Caisse
  const [postesCaisses, setPostesCaisses] = useState<PosteCaisseOption[]>([])
  const [selectedPosteCaisse, setSelectedPosteCaisse] = useState<string>('')
  const [isMultiCaisse, setIsMultiCaisse] = useState(false)

  // Mode d'affichage: liste détaillée ou agrégation par jour
  const [viewMode, setViewMode] = useState<CloturesViewMode>('list')

  // Sélection
  const [selectedCloture, setSelectedCloture] = useState<ClotureCaisse | null>(null)
  const [showBilletage, setShowBilletage] = useState(false)

  // Metric month/year (default to now)
  const [metricMonth, setMetricMonth] = useState<string>(() => { const now = new Date(); return String(now.getMonth() + 1).padStart(2, '0') })
  const [metricYear, setMetricYear] = useState<string>(() => { const now = new Date(); return String(now.getFullYear()) })
  const [showMetric, setShowMetric] = useState(false)

  // Sections repliables (persistées pour les écrans 14")
  const [showPerfSection, setShowPerfSection] = useState(() => localStorage.getItem('hist_clotures_show_perf') !== '0')
  const [showTotalsSection, setShowTotalsSection] = useState(() => localStorage.getItem('hist_clotures_show_totals') !== '0')
  const togglePerfSection = () => setShowPerfSection(v => { localStorage.setItem('hist_clotures_show_perf', v ? '0' : '1'); return !v })
  const toggleTotalsSection = () => setShowTotalsSection(v => { localStorage.setItem('hist_clotures_show_totals', v ? '0' : '1'); return !v })

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
        logger.error('Erreur initialisation HistoriqueClotures:', err)
      }
    }
    initPage()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchClotures = useCallback(async (page = currentPage) => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
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
      logger.error('Erreur chargement clôtures:', err)
      gooeyToast.error(t('messages.loading_closures'))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Fetch des sessions de caisse
  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const response = await api.get('sessions-caisses/')
      const data = Array.isArray(response.data) ? response.data : (response.data.results || [])
      setSessions(data)
    } catch (err) {
      logger.error('Erreur chargement sessions:', err)
      gooeyToast.error(t('messages.loading_sessions'))
    } finally {
      setSessionsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Charger les sessions quand l'onglet est activé
  useEffect(() => {
    if (activeTab === 'sessions' && canViewSessions) {
      fetchSessions()
    }
  }, [activeTab, canViewSessions, fetchSessions])

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
  const dailyData = useMemo(() => buildDailyData(clotures), [clotures])

  const exportExcel = async () => {
    await exportCloturesExcel({ viewMode, clotures, dailyData, t })
  }

  const handlePrint = async (cloture: ClotureCaisse) => {
    await printCloture(cloture, pharmacySettings, docT('modal.print_title', { id: cloture.id }))
  }

  return {
    t,
    clotures,
    loading,
    activeTab,
    setActiveTab,
    canViewSessions,
    sessions,
    sessionsLoading,
    selectedSession,
    setSelectedSession,
    users,
    selectedUser,
    setSelectedUser,
    dateDebut,
    setDateDebut,
    dateFin,
    setDateFin,
    currentPage,
    setCurrentPage,
    pageSize,
    totalItems,
    totalPages,
    globalTotals,
    postesCaisses,
    selectedPosteCaisse,
    setSelectedPosteCaisse,
    isMultiCaisse,
    viewMode,
    setViewMode,
    selectedCloture,
    setSelectedCloture,
    showBilletage,
    setShowBilletage,
    metricMonth,
    setMetricMonth,
    metricYear,
    setMetricYear,
    showMetric,
    setShowMetric,
    showPerfSection,
    togglePerfSection,
    showTotalsSection,
    toggleTotalsSection,
    dailyData,
    formatDate,
    formatMoney,
    getModeLabel,
    handleSearch,
    resetFilters,
    exportExcel,
    handlePrint,
  }
}
