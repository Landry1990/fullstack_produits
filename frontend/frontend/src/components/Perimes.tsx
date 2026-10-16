import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { gooeyToast } from 'goey-toast'
import { useTranslation } from 'react-i18next'
import { getApiErrorDetail } from '../utils/errorHandling'
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
  Check,
  Printer,
  FileSpreadsheet,
  RotateCcw,
  ExternalLink,
  Pin,
  PinOff
} from 'lucide-react'
import type { StockLot } from '../types'
import { formatCurrency } from '../utils/formatters'
import { formatDate, toApiDateEnd } from '../utils/dateUtils'
import SudoValidationModal from './common/SudoValidationModal'
import { useSudo } from '../hooks/useSudo'
import { useConfirm } from '../hooks/useConfirm'
import usePrint from '../hooks/usePrint'
import { useDocumentLocale, usePharmacySettings } from '../hooks/usePharmacySettings'
import { exportToExcel } from '../utils/excelExport'
import type { StockAdjustment } from '../types'
import { Button } from './shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from './shadcn/card'
import { Badge } from './shadcn/badge'
import { Tabs, TabsList, TabsTrigger } from './shadcn/tabs'
import { Checkbox } from './shadcn/checkbox'
import { LocalizedDateInput } from './LocalizedDateInput'
import { QuantityInputDialog } from './products/modals/QuantityInputDialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './shadcn/table'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './shadcn/dropdown-menu'
import { cn } from '../lib/utils'
import { EmptyState } from './ui/EmptyState'
import { Skeleton } from './ui/Skeleton'
import SkeletonTable from './ui/SkeletonTable'
import { logger } from '../utils/logger'

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

const toLocalISODate = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const getExpiryEndOfMonthISO = (dateString: string) => {
  const [datePart] = dateString.split('T')
  const [yStr, mStr] = datePart.split('-')
  const y = Number(yStr)
  const m = Number(mStr)
  if (!y || !m) return null
  const lastDay = new Date(y, m, 0).getDate()
  return `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`
}

const _formatDateShort = (dateString: string) => {
  if (!dateString) return '-'
  const [datePart] = dateString.split('T')
  const [, m, y] = datePart.split('-')
  if (!m || !y) return dateString
  return `${m}/${y.slice(-2)}`
}

const getUrgencyClass = (valeur: number) => {
  if (valeur > 500000) return 'border-red-400 bg-red-50'
  if (valeur > 100000) return 'border-amber-400 bg-amber-50'
  return 'border-emerald-400 bg-emerald-50'
}

const isExpiredByEndOfMonth = (dateString: string) => {
  if (!dateString) return false
  const expiryEom = getExpiryEndOfMonthISO(dateString)
  if (!expiryEom) return false
  const todayStr = toLocalISODate(new Date())
  return expiryEom < todayStr
}

export default function Perimes() {
  const { t } = useTranslation(['stock', 'common'])
  const navigate = useNavigate()
  const openProduct = (productId: number) => navigate('/app/produits', { state: { searchProduitId: productId } })
  const openSupplier = (supplierId: number) => navigate('/app/fournisseurs', { state: { selectedSupplierId: supplierId } })
  const [searchParams] = useSearchParams()
  // Langue des documents imprimés (PharmacySettings.locale), découplée de l'UI.
  const { lang: docLang, locale: docLocale } = useDocumentLocale()
  const { t: docT } = useTranslation(['stock', 'common'], { lng: docLang })
  const { settings: pharmacySettings } = usePharmacySettings()
  const [lots, setLots] = useState<StockLot[]>([])
  const [stats, setStats] = useState<PerimesStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingStats, setLoadingStats] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterDays, setFilterDays] = useState<number>(() => {
    const days = Number(searchParams.get('days'))
    return [30, 60, 90, 180].includes(days) ? days : 30
  })
  const [showExpiredOnly, setShowExpiredOnly] = useState<boolean>(() => searchParams.get('expired') !== 'false')
  // Classement de la liste pour la collecte physique : chronologique,
  // ou groupé par rayon / forme puis alphabétique (« Non classé » en fin).
  const [groupMode, setGroupMode] = useState<'date' | 'rayon' | 'forme'>('rayon')
  const [selectedLotIds, setSelectedLotIds] = useState<Set<number>>(new Set())
  // Étagère physique « proches péremption » : lots marqués manuellement
  // (StockLot.deplace_peremption_le non nul). Liste dédiée, distincte de la
  // liste de collecte qui garde tous les lots avec un simple badge.
  const [shelfLots, setShelfLots] = useState<StockLot[]>([])
  const [loadingShelf, setLoadingShelf] = useState(false)
  const [selectedShelfIds, setSelectedShelfIds] = useState<Set<number>>(new Set())
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])
  const [loadingAdjustments, setLoadingAdjustments] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'shelf' | 'history'>(() => {
    const tab = searchParams.get('tab')
    return tab === 'list' || tab === 'shelf' || tab === 'history' ? tab : 'dashboard'
  })

  useEffect(() => {
    const tab = searchParams.get('tab')
    setActiveTab(tab === 'list' || tab === 'shelf' || tab === 'history' ? tab : 'dashboard')
    setShowExpiredOnly(searchParams.get('expired') !== 'false')
    const days = Number(searchParams.get('days'))
    setFilterDays([30, 60, 90, 180].includes(days) ? days : 30)
  }, [searchParams])
  
  const [dateDebut, setDateDebut] = useState<string>(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [dateFin, setDateFin] = useState<string>(() => new Date().toISOString().split('T')[0])

  const { sudoState, requireSudo, closeSudo } = useSudo()
  const confirm = useConfirm()
  const [processing, setProcessing] = useState(false)
  const [pendingExitLot, setPendingExitLot] = useState<StockLot | null>(null)



  useEffect(() => {
    fetchStats()
    fetchLots()
    fetchAdjustments()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (activeTab === 'list') {
      fetchLots()
    } else if (activeTab === 'shelf') {
      fetchShelf()
    } else if (activeTab === 'history') {
      fetchAdjustments()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDays, showExpiredOnly, activeTab, dateDebut, dateFin])

  const fetchStats = async () => {
    setLoadingStats(true)
    try {
      const response = await api.get<PerimesStats>('stock-lots/stats_perimes/')
      setStats(response.data)
    } catch (err) {
      logger.error('Erreur chargement stats:', err)
      gooeyToast.error(t('perimes.messages.error_stats'))
    } finally {
      setLoadingStats(false)
    }
  }

  const fetchAdjustments = async () => {
    setLoadingAdjustments(true)
    try {
      const response = await api.get('stock-adjustments/', {
        params: {
          reason_type: 'PERIME',
          created_at__gte: dateDebut,
          created_at__lte: toApiDateEnd(new Date(dateFin + 'T00:00:00')),
          page_size: 100
        }
      })
      const data: unknown = response.data
      setAdjustments(Array.isArray(data) ? data : (data.results || []))
    } catch (err) {
      logger.error('Erreur chargement historiques:', err)
      gooeyToast.error(t('perimes.messages.error_history'))
    } finally {
      setLoadingAdjustments(false)
    }
  }

  const fetchLots = async () => {
    setLoading(true)
    setError(null)
    setSelectedLotIds(new Set()) // Reset selection on refresh
    try {
      const today = new Date()
      const thresholdDate = new Date()
      thresholdDate.setDate(today.getDate() + filterDays)

      const dateStr = toLocalISODate(thresholdDate)
      
      const response = await api.get<StockLot[]>('stock-lots/', {
        params: {
          date_expiration_lte: dateStr,
          include_empty: 'false' // Hide depleted lots as they are redundant in the list view (available in History)
        }
      })
      
      const data: unknown = response.data
      let fetchedLots: StockLot[] = Array.isArray(data) ? data : (data.results || [])
      
      if (showExpiredOnly) {
         fetchedLots = fetchedLots.filter(l => !!l.date_expiration && isExpiredByEndOfMonth(l.date_expiration))
      }
      
      setLots(fetchedLots)
    } catch (err) {
      logger.error('Erreur chargement lots:', err)
      setError(t('perimes.messages.error_loading'))
    } finally {
      setLoading(false)
    }
  }

  const fetchShelf = async () => {
    setLoadingShelf(true)
    setSelectedShelfIds(new Set())
    try {
      const response = await api.get<StockLot[]>('stock-lots/', {
        params: { en_rayon_peremption: 'true', page_size: 500 }
      })
      const data: unknown = response.data
      setShelfLots(Array.isArray(data) ? data : (data.results || []))
    } catch (err) {
      logger.error('Erreur chargement étagère péremption:', err)
      gooeyToast.error(t('perimes.shelf.error_loading'))
    } finally {
      setLoadingShelf(false)
    }
  }

  // Marquage manuel « étagère proches péremption » — non destructif,
  // aucune quantité ne bouge, donc pas de sudo (tracé en audit backend).
  const markShelf = async (lotIds: number[], deplace: boolean) => {
    if (lotIds.length === 0) return
    try {
      setProcessing(true)
      await api.post('stock-lots/marquer_rayon_peremption/', { lot_ids: lotIds, deplace })
      gooeyToast.success(
        deplace
          ? t('perimes.shelf.marked', { count: lotIds.length })
          : t('perimes.shelf.unmarked', { count: lotIds.length })
      )
      setSelectedLotIds(new Set())
      setSelectedShelfIds(new Set())
      fetchLots()
      fetchShelf()
    } catch (err) {
      logger.error('Erreur marquage étagère péremption:', err)
      gooeyToast.error(getApiErrorDetail(err, t('perimes.shelf.error_marking')))
    } finally {
      setProcessing(false)
    }
  }

  const toggleShelfSelection = (id: number) => {
    setSelectedShelfIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      return newSet
    })
  }

  const toggleAllShelfSelection = () => {
    if (selectedShelfIds.size === shelfLots.length) {
      setSelectedShelfIds(new Set())
    } else {
      setSelectedShelfIds(new Set(shelfLots.map(l => l.id)))
    }
  }

  const handleSortirStock = (lot: StockLot) => setPendingExitLot(lot)

  const confirmSortirStock = (qty: number) => {
    if (!pendingExitLot) return
    const lot = pendingExitLot
    setPendingExitLot(null)
    requireSudo(async (validatorId, password) => {
      try {
        setProcessing(true)
        await api.post(`stock-lots/${lot.id}/sortir_perimes/`, {
          quantity: qty,
          reason: t('stock:ajustements.filters.reasons.PERIME') + ' / ' + t('stock:ajustements.filters.reasons.AVARIE'),
          validated_by_id: validatorId,
          sudo_password: password
        })
        gooeyToast.success(t('perimes.messages.success_exit'))
        fetchLots()
        fetchStats() 
      } catch (err) {
        logger.error('Erreur sortie stock:', err);
        gooeyToast.error(t('perimes.messages.error_exit') + ': ' + getApiErrorDetail(err, t('common:messages.error_generic')))
        throw err;
      } finally {
        setProcessing(false)
      }
    }, {
      title: t('perimes.confirm.exit_title'),
      message: t('perimes.confirm.exit_message', { qty, product: lot.produit_nom, lot: lot.lot }),
      permission: 'can_manage_perimes'
    });
  }

  const handleRestoreAdjustment = async (adjustment: StockAdjustment) => {
    const quantity = Math.abs(adjustment.quantity_change)
    const confirmed = await confirm({
      title: t('perimes.restore.title'),
      message: t('perimes.restore.message', { product: adjustment.produit_name, lot: adjustment.lot_number, quantity }),
      confirmText: t('perimes.restore.action')
    })
    if (!confirmed) return

    requireSudo(async (validatorId, password) => {
      try {
        setProcessing(true)
        await api.post(`stock-adjustments/${adjustment.id}/restaurer_sortie_perimee/`, {
          validated_by_id: validatorId,
          sudo_password: password
        })
        gooeyToast.success(t('perimes.restore.success'))
        await Promise.all([fetchAdjustments(), fetchLots(), fetchStats()])
      } catch (err) {
        gooeyToast.error(getApiErrorDetail(err, t('perimes.restore.error')))
        throw err
      } finally {
        setProcessing(false)
      }
    }, {
      title: t('perimes.restore.sudo_title'),
      message: t('perimes.restore.sudo_message'),
      permission: 'can_manage_perimes'
    })
  }

  const handleBulkSortir = async () => {
      if (selectedLotIds.size === 0) return
      const selectedLots = lots.filter(lot => selectedLotIds.has(lot.id))
      const totalQuantity = selectedLots.reduce((sum, lot) => sum + lot.quantity_remaining, 0)
      const confirmed = await confirm({
        title: t('perimes.confirm.bulk_exit_title'),
        message: t('perimes.confirm.bulk_exit_summary', { count: selectedLots.length, quantity: totalQuantity }),
        variant: 'danger',
        confirmText: t('perimes.table.exit_btn')
      })
      if (!confirmed) return

      requireSudo(async (validatorId, password) => {
          try {
              setProcessing(true)
              await api.post('stock-lots/bulk_sortir_perimes/', {
                  lot_ids: Array.from(selectedLotIds),
                  reason: t('stock:perimes.confirm.bulk_exit_title'),
                  validated_by_id: validatorId,
                  sudo_password: password
              })
              gooeyToast.success(t('perimes.messages.success_bulk_exit', { count: selectedLotIds.size }))
              fetchLots()
              fetchStats()
          } catch (err) {
              logger.error('Erreur sortie groupée:', err)
              gooeyToast.error(getApiErrorDetail(err, t('perimes.messages.error_bulk_exit')))
              throw err;
          } finally {
              setProcessing(false)
          }
      }, {
          title: t('perimes.confirm.bulk_exit_title'),
          message: t('perimes.confirm.bulk_exit_message', { count: selectedLotIds.size }),
          permission: 'can_manage_perimes'
      })
  }

  // Export Excel de la liste telle qu'affichée : en mode groupé, l'ordre
  // suit les en-têtes rayon/forme (utile comme feuille de collecte).
  const handleExportLots = () => {
    if (lots.length === 0) return
    const rows = displayRows
      .filter((r): r is { kind: 'lot'; key: number; lot: StockLot } => r.kind === 'lot')
      .map(({ lot }) => ({
        [docT('stock:perimes.col_rayon')]: lot.produit_rayon ?? '',
        [docT('stock:perimes.col_forme')]: lot.produit_forme ?? '',
        [docT('stock:perimes.col_shelf')]: lot.deplace_peremption_le ? '✓' : '',
        [docT('stock:perimes.table.product')]: lot.produit_nom,
        [docT('stock:perimes.table.lot')]: lot.lot ?? '',
        [docT('stock:perimes.table.expiration')]: lot.date_expiration ? formatDate(lot.date_expiration, docLocale) : '',
        [docT('stock:perimes.table.provider')]: lot.fournisseur_nom ?? '',
        [docT('stock:perimes.table.qty')]: lot.quantity_remaining,
        [docT('stock:perimes.table.value_cost')]: Math.round(Number(lot.price_cost || 0) * lot.quantity_remaining),
      }))
    exportToExcel(rows, pharmacySettings, {
      sheetName: 'Périmés',
      filename: `perimes_${toLocalISODate(new Date())}.xlsx`,
      title: docT('stock:perimes.risk_lots'),
    })
  }

  const toggleLotSelection = (id: number) => {
      setSelectedLotIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(id)) {
              newSet.delete(id);
          } else {
              newSet.add(id);
          }
          return newSet;
      });
  }

  const toggleAllSelection = () => {
      const availableLots = lots.filter(l => l.quantity_remaining > 0);
      if (selectedLotIds.size === availableLots.length) {
          setSelectedLotIds(new Set())
      } else {
          setSelectedLotIds(new Set(availableLots.map(l => l.id)))
      }
  }

  const { printWithTemplate } = usePrint()

  // Affichage du tableau : en mode date = ordre serveur (chronologique) ;
  // sinon en-têtes de groupe (alpha, « Non classé » en dernier) puis lots
  // alphabétiques par produit puis par date d'expiration (FEFO).
  type DisplayRow =
    | { kind: 'header'; key: string; label: string; count: number }
    | { kind: 'lot'; key: number; lot: StockLot }
  const displayRows = useMemo<DisplayRow[]>(() => {
    if (groupMode === 'date') return lots.map((lot) => ({ kind: 'lot', key: lot.id, lot }))
    const field = groupMode === 'rayon' ? 'produit_rayon' : 'produit_forme'
    const noGroupLabel = t('perimes.no_group')
    const groups = new Map<string, StockLot[]>()
    for (const lot of lots) {
      const label = lot[field] || noGroupLabel
      const arr = groups.get(label)
      if (arr) arr.push(lot)
      else groups.set(label, [lot])
    }
    const labels = [...groups.keys()].sort((a, b) => {
      if (a === noGroupLabel) return 1
      if (b === noGroupLabel) return -1
      return a.localeCompare(b, 'fr')
    })
    const rows: DisplayRow[] = []
    for (const label of labels) {
      const groupLots = groups.get(label)!.sort((a, b) =>
        a.produit_nom.localeCompare(b.produit_nom, 'fr') ||
        (a.date_expiration ?? '9999').localeCompare(b.date_expiration ?? '9999')
      )
      rows.push({ kind: 'header', key: `h-${label}`, label, count: groupLots.length })
      for (const lot of groupLots) rows.push({ kind: 'lot', key: lot.id, lot })
    }
    return rows
  }, [lots, groupMode, t])

  // Étagère dédiée : alphabétique produit puis FEFO (même logique de
  // collecte que les groupes rayon/forme de la liste principale).
  const shelfRows = useMemo(() =>
    [...shelfLots].sort((a, b) =>
      a.produit_nom.localeCompare(b.produit_nom, 'fr') ||
      (a.date_expiration ?? '9999').localeCompare(b.date_expiration ?? '9999')
    ),
  [shelfLots])

  const handlePrintHistory = () => {
    if (adjustments.length === 0) return

    const totalVal = adjustments.reduce((sum, adj) => sum + (adj.valorisation || 0), 0)

    const content = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h3 style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px;">${docT('stock:perimes.history.title')}</h3>
        <p style="text-align: center; font-size: 0.9em; margin-bottom: 20px;">
          ${docT('common:period')}: ${formatDate(dateDebut, docLocale)} ${docT('common:to').toLowerCase()} ${formatDate(dateFin, docLocale)}
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.85em;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${docT('stock:perimes.history.table.date')}</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${docT('stock:perimes.history.table.product')}</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${docT('stock:perimes.history.table.lot')}</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">${docT('stock:perimes.history.table.qty')}</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">${docT('stock:perimes.history.table.value')}</th>
            </tr>
          </thead>
          <tbody>
            ${adjustments.map(adj => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${formatDate(adj.created_at, docLocale)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${adj.produit_name}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${adj.lot_number || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${Math.abs(adj.quantity_change)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(adj.valorisation, docLocale)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #f9fafb; font-weight: bold;">
              <td colspan="4" style="border: 1px solid #ddd; padding: 8px; text-align: right;">${docT('stock:perimes.history.total_valorization').toUpperCase()}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right; color: #dc2626;">${formatCurrency(totalVal, docLocale)}</td>
            </tr>
          </tfoot>
        </table>

        <div style="text-align: right; font-size: 0.8em; margin-top: 30px;">
          <p>${docT('stock:perimes.history_print_generated')} ${new Date().toLocaleString(docLocale)}</p>
        </div>
      </div>
    `

    printWithTemplate(content, { title: docT('stock:perimes.history.title'), width: 800 })
  }

  const handleExportExcel = () => {
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
    window.open(`${baseUrl}/api/stock-adjustments/export_excel/?reason_type=PERIME&created_at__gte=${dateDebut}&created_at__lte=${toApiDateEnd(new Date(dateFin + 'T00:00:00'))}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 lg:px-6 py-2 lg:py-4 border-b border-slate-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-2 lg:gap-4">
          <div className="p-1.5 lg:p-2.5 bg-red-50 text-red-500 rounded-lg lg:rounded-xl">
            <AlertTriangle className="size-5 lg:size-6" />
          </div>
          <div>
            <h1 className="text-base lg:text-xl font-bold tracking-tight text-slate-800">{t('perimes.title')}</h1>
            <p className="text-label font-medium text-slate-400 uppercase tracking-widest hidden lg:block">{t('perimes.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 lg:gap-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="bg-slate-100">
              <TabsTrigger value="dashboard" className="gap-1.5 text-xs" aria-label={t('perimes.tabs.dashboard')}>
                <BarChart2 className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline font-semibold">{t('perimes.tabs.dashboard')}</span>
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5 text-xs" aria-label={t('perimes.tabs.list')}>
                <List className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline font-semibold">{t('perimes.tabs.list')}</span>
              </TabsTrigger>
              <TabsTrigger value="shelf" className="gap-1.5 text-xs" aria-label={t('perimes.tabs.shelf')}>
                <Pin className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline font-semibold">{t('perimes.tabs.shelf')}</span>
                {shelfLots.length > 0 && <Badge variant="secondary" className="bg-amber-100 text-amber-700">{shelfLots.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 text-xs" aria-label={t('perimes.tabs.history')}>
                <History className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline font-semibold">{t('perimes.tabs.history')}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchLots(); fetchStats() }}
            disabled={loading || loadingStats}
            className="gap-2"
            aria-label={t('common:refresh')}
            aria-busy={loading || loadingStats}
          >
            <RefreshCw className={cn("size-4", (loading || loadingStats) && "animate-spin")} aria-hidden="true" />
            <span className="hidden sm:inline">{t('common:refresh')}</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-3 lg:px-6 pt-2 lg:pt-4 shrink-0">
          <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2 text-sm font-medium">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-3 lg:px-6 py-2 lg:py-4">
        {activeTab === 'dashboard' ? (
          /* ========== DASHBOARD VIEW ========== */
          <div className="space-y-4 lg:space-y-6">
            {/* KPI Cards Row */}
            {loadingStats ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 lg:gap-4">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : stats ? (
              <>
                {/* Main KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 lg:gap-4">
                  <Card className="bg-gradient-to-br from-red-50 to-red-50/40 border-red-200">
                    <CardContent className="p-3 lg:p-5">
                      <div className="flex items-center gap-2 lg:gap-3">
                        <div className="size-10 lg:size-12 rounded-full bg-red-100 flex items-center justify-center text-xl lg:text-2xl">💸</div>
                        <div>
                          <p className="text-xs lg:text-sm text-slate-500">{t('perimes.stats.valeur_perimes')}</p>
                          <p className="text-lg lg:text-2xl font-bold text-red-600">{formatCurrency(stats.perimes.valeur_cout)}</p>
                          <p className="text-xs text-slate-400">{t('perimes.stats.lots_count', { count: stats.perimes.count_lots })}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-amber-50 to-amber-50/40 border-amber-200">
                    <CardContent className="p-3 lg:p-5">
                      <div className="flex items-center gap-2 lg:gap-3">
                        <div className="size-10 lg:size-12 rounded-full bg-amber-100 flex items-center justify-center text-xl lg:text-2xl">📉</div>
                        <div>
                          <p className="text-xs lg:text-sm text-slate-500">{t('perimes.stats.manque_gagner')}</p>
                          <p className="text-lg lg:text-2xl font-bold text-amber-600">{formatCurrency(stats.perimes.valeur_vente_perdue)}</p>
                          <p className="text-xs text-slate-400">{t('perimes.stats.at_sale_price')}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-blue-50 to-blue-50/40 border-blue-200">
                    <CardContent className="p-3 lg:p-5">
                      <div className="flex items-center gap-2 lg:gap-3">
                        <div className="size-10 lg:size-12 rounded-full bg-blue-100 flex items-center justify-center text-xl lg:text-2xl">📊</div>
                        <div>
                          <p className="text-xs lg:text-sm text-slate-500">{t('perimes.stats.taux_perte')}</p>
                          <p className="text-lg lg:text-2xl font-bold text-blue-600">{stats.indicateurs.taux_perte_pct}%</p>
                          <p className="text-xs text-slate-400">{t('perimes.stats.vs_ca')} ({formatCurrency(stats.indicateurs.ca_periode)})</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Prévisions Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">⏰ {t('perimes.prevision.title')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:gap-4">
                      {(['30j', '60j', '90j'] as const).map((key, i) => (
                        <div key={key} className={cn("border-2 rounded-xl p-3 lg:p-4", getUrgencyClass(stats.previsions[key].valeur_vente))}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-700">{t('common:count_days', { count: [30, 60, 90][i] })}</span>
                            <Badge variant="outline" className="bg-white/80 text-slate-600">{t('perimes.prevision.lots_count', { count: stats.previsions[key].count_lots })}</Badge>
                          </div>
                          <p className="text-lg lg:text-xl font-bold text-slate-800">{formatCurrency(stats.previsions[key].valeur_vente)}</p>
                          <p className="text-xs text-slate-500 mt-1">{t('perimes.prevision.potential_risk')}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Produits Périmés */}
                {stats.perimes.details.length > 0 && (
                  <Card className="overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-lg">🚨 {t('perimes.top_perimes')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table className="w-full text-sm">
                          <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                              <TableHead className="text-left px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400">{t('perimes.table.product')}</TableHead>
                              <TableHead className="text-left px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400">{t('perimes.table.lot')}</TableHead>
                              <TableHead className="text-left px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400">{t('perimes.table.expiration')}</TableHead>
                              <TableHead className="text-right px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400">{t('perimes.table.qty')}</TableHead>
                              <TableHead className="text-right px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400">{t('perimes.table.value_cost')}</TableHead>
                              <TableHead className="text-right px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400">{t('perimes.table.value_sale')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stats.perimes.details.slice(0, 10).map((item) => (
                              <TableRow key={item.lot_id} className="hover:bg-slate-50 transition-colors">
                                <TableCell className="font-medium px-4 py-2.5 text-slate-700">
                                  <button
                                    type="button"
                                    onClick={() => openProduct(item.produit_id)}
                                    className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-left font-medium text-emerald-700 hover:text-emerald-800 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    aria-label={t('perimes.view_product', { name: item.produit_nom })}
                                  >
                                    <span className="truncate">{item.produit_nom}</span>
                                    <ExternalLink className="size-3.5 shrink-0" />
                                  </button>
                                </TableCell>
                                <TableCell className="font-mono text-xs px-4 py-2.5 text-slate-500">{item.lot_numero || '-'}</TableCell>
                                <TableCell className="px-4 py-2.5">
                                  <Badge variant="outline" className="bg-red-50 text-red-500 border-red-200">{item.date_expiration ? formatDate(item.date_expiration) : '-'}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-bold px-4 py-2.5 text-slate-700">{item.quantity}</TableCell>
                                <TableCell className="text-right px-4 py-2.5 text-red-500 font-medium">{formatCurrency(item.valeur_cout)}</TableCell>
                                <TableCell className="text-right px-4 py-2.5 text-amber-600 font-medium">{formatCurrency(item.valeur_vente)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {stats.perimes.details.length > 10 && (
                        <div className="mt-3 text-center">
                          <Button variant="link" size="sm" onClick={() => setActiveTab('list')}>
                            {t('perimes.view_all_lots', { count: stats.perimes.count_lots })}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <p>{t('stock:perimes.no_data')}</p>
              </div>
            )}
          </div>
        ) : activeTab === 'list' ? (
          /* ========== LIST VIEW ========== */
          <Card className="flex flex-col h-full overflow-hidden">
            <CardHeader className="p-2 lg:p-4 border-b border-slate-100 space-y-0 shrink-0">
               <div className="flex flex-wrap justify-between items-center gap-2 min-h-10 py-1">
                  {selectedLotIds.size > 0 ? (
                     <div className="flex items-center gap-2">
                       <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                           <Button variant="destructive" size="sm" className="gap-2">
                             <MoreVertical className="size-4" />
                             {t('common:actions_title')}
                             <Badge variant="destructive" className="bg-red-500">{selectedLotIds.size}</Badge>
                           </Button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent align="start" className="w-56">
                           <DropdownMenuLabel>{t('common:bulk_actions')}</DropdownMenuLabel>
                           <DropdownMenuSeparator />
                           <DropdownMenuItem onClick={() => markShelf(Array.from(selectedLotIds), true)}>
                             <Pin className="size-4 mr-2" /> {t('perimes.shelf.mark')}
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => markShelf(Array.from(selectedLotIds), false)}>
                             <PinOff className="size-4 mr-2" /> {t('perimes.shelf.unmark')}
                           </DropdownMenuItem>
                           <DropdownMenuSeparator />
                           <DropdownMenuItem onClick={handleBulkSortir} className="text-red-500 focus:bg-red-50 focus:text-red-600">
                             <Trash2 className="size-4 mr-2" /> {t('perimes.table.exit_btn')}
                           </DropdownMenuItem>
                         </DropdownMenuContent>
                       </DropdownMenu>
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => setSelectedLotIds(new Set())}
                         className="gap-2"
                       >
                         <X className="size-4" />
                         {t('common:cancel')}
                       </Button>
                     </div>
                  ) : (
                     <>
                        <div className="flex items-center gap-2">
                           <div className="p-1.5 lg:p-2 bg-red-50 text-red-500 rounded-lg"><AlertTriangle className="size-4 lg:size-5" /></div>
                           <h2 className="font-bold text-base lg:text-lg tracking-tight text-slate-800">{t('perimes.risk_lots')}</h2>
                           <Badge variant="secondary" className="bg-slate-100 text-slate-500">{lots.length}</Badge>
                        </div>
                        <div className="flex gap-3 items-center">
                           <div className="flex items-center gap-2 bg-slate-50 p-1 px-3 rounded-xl border border-slate-200">
                             <span className="text-caption font-bold text-slate-400 uppercase">{t('common:filters')}</span>
                             <div className="h-4 w-px bg-slate-200 mx-1"></div>
                             <label className="flex items-center gap-2 cursor-pointer">
                               <Checkbox
                                 checked={showExpiredOnly}
                                 onCheckedChange={(checked) => setShowExpiredOnly(checked === true)}
                                 className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                               />
                               <span className="text-label font-semibold text-slate-500">{t('stock:perimes.show_expired_only')}</span>
                             </label>
                             {!showExpiredOnly && (
                               <select
                                 className="rounded-lg border border-slate-200 bg-white h-7 px-2 text-label font-bold text-slate-700 focus:outline-none focus:border-red-400 transition-all"
                                 aria-label={t('common:filters')}
                                 value={filterDays}
                                 onChange={(e) => setFilterDays(parseInt(e.target.value))}
                               >
                                 <option value={30}>{t('common:count_days', { count: 30 })}</option>
                                 <option value={60}>{t('common:count_days', { count: 60 })}</option>
                                 <option value={90}>{t('common:count_days', { count: 90 })}</option>
                                 <option value={180}>{t('common:count_days', { count: 180 })}</option>
                               </select>
                             )}
                             <div className="h-4 w-px bg-slate-200 mx-1"></div>
                             <select
                               className="rounded-lg border border-slate-200 bg-white h-7 px-2 text-label font-bold text-slate-700 focus:outline-none focus:border-red-400 transition-all"
                               aria-label={t('perimes.group_by')}
                               value={groupMode}
                               onChange={(e) => setGroupMode(e.target.value as typeof groupMode)}
                             >
                               <option value="date">{t('perimes.group_date')}</option>
                               <option value="rayon">{t('perimes.group_rayon')}</option>
                               <option value="forme">{t('perimes.group_forme')}</option>
                             </select>
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={handleExportLots}
                               disabled={lots.length === 0}
                               className="gap-2"
                               aria-label={t('perimes.export_excel')}
                             >
                               <FileSpreadsheet className="size-4" />
                               {t('perimes.export_excel')}
                             </Button>
                           </div>
                        </div>
                     </>
                  )}
               </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-auto">
              {loading ? (
                <SkeletonTable rows={8} columns={8} />
              ) : lots.length === 0 ? (
                <EmptyState
                  icon={<PieChart className="size-8" />}
                  title={t('perimes.no_result')}
                  className="h-64"
                />
              ) : (
                <Table className="w-full text-xs">
                  <TableHeader className="bg-slate-50 sticky top-0 z-30 border-b border-slate-100">
                    <TableRow className="text-slate-400 uppercase text-caption tracking-widest font-black hover:bg-slate-50">
                      <TableHead className="py-3 px-4 w-12 text-center">
                        <Checkbox
                          checked={selectedLotIds.size === lots.filter(l => l.quantity_remaining > 0).length && lots.filter(l => l.quantity_remaining > 0).length > 0}
                          onCheckedChange={toggleAllSelection}
                          className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                          aria-label={t('stock:cadencier.select_all')}
                        />
                      </TableHead>
                      <TableHead className="py-3 px-4 text-left">{t('perimes.table.product')}</TableHead>
                      <TableHead className="py-3 px-4 text-center">{t('perimes.table.lot')}</TableHead>
                      <TableHead className="py-3 px-4 text-center">{t('perimes.table.expiration')}</TableHead>
                      <TableHead className="py-3 px-4 text-left">{t('perimes.table.provider')}</TableHead>
                      <TableHead className="py-3 px-4 text-right">{t('perimes.table.stock')}</TableHead>
                      <TableHead className="py-3 px-4 text-right">{t('perimes.table.value')}</TableHead>
                      <TableHead className="py-3 px-4 text-center">{t('perimes.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayRows.map((row) => row.kind === 'header' ? (
                      <TableRow key={row.key} className="bg-slate-100/80 hover:bg-slate-100/80">
                        <TableCell colSpan={8} className="py-1.5 px-4 text-caption font-black uppercase tracking-widest text-slate-500">
                          {row.label} · {row.count}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={row.key} className={cn("hover:bg-slate-50 transition-colors group", row.lot.quantity_remaining <= 0 && 'opacity-50', selectedLotIds.has(row.lot.id) && 'bg-red-50/40')}>
                        <TableCell className="py-2.5 px-4 text-center">
                          <Checkbox
                            checked={selectedLotIds.has(row.lot.id)}
                            onCheckedChange={() => toggleLotSelection(row.lot.id)}
                            disabled={row.lot.quantity_remaining <= 0}
                            className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                            aria-label={t('stock:reappro.select_product_aria', { name: row.lot.produit_nom })}
                          />
                        </TableCell>
                        <TableCell className="py-2.5 px-4">
                          <button
                            type="button"
                            onClick={() => openProduct(row.lot.produit)}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-left font-bold text-sm text-emerald-700 hover:text-emerald-800 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            aria-label={t('perimes.view_product', { name: row.lot.produit_nom })}
                          >
                            <span className="truncate">{row.lot.produit_nom}</span>
                            <ExternalLink className="size-3.5 shrink-0" />
                          </button>
                          <div className="flex items-center gap-1.5">
                            <span className="text-caption font-mono text-slate-400">#{row.lot.produit}</span>
                            {row.lot.deplace_peremption_le && (
                              <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-300 text-caption">
                                <Pin className="size-3" />
                                {t('perimes.shelf.badge')}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-center font-mono text-label font-bold text-slate-500">
                          {row.lot.lot || '-'}
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-center">
                          <Badge variant="outline" className={cn("gap-1.5", row.lot.date_expiration && isExpiredByEndOfMonth(row.lot.date_expiration) ? 'bg-red-50 text-red-500 border-red-200' : 'bg-amber-50 text-amber-600 border-amber-200')}>
                            <Calendar className="size-3" />
                            {formatDate(row.lot.date_expiration || '')}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-xs font-semibold text-slate-500 truncate max-w-[140px]" title={row.lot.fournisseur_nom}>
                          {row.lot.fournisseur ? (
                            <button
                              type="button"
                              onClick={() => openSupplier(row.lot.fournisseur)}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-blue-600 hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                              aria-label={t('perimes.view_supplier', { name: row.lot.fournisseur_nom })}
                            >
                              <span className="truncate">{row.lot.fournisseur_nom}</span>
                              <ExternalLink className="size-3 shrink-0" />
                            </button>
                          ) : row.lot.fournisseur_nom}
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-right">
                          <div className={cn("font-black text-sm", row.lot.quantity_remaining > 0 ? 'text-slate-800' : 'text-slate-300')}>
                            {row.lot.quantity_remaining}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-right text-red-500 font-mono font-black text-xs">
                          {formatCurrency(Number(row.lot.price_cost || 0) * row.lot.quantity_remaining)}
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {row.lot.quantity_remaining > 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn("size-7", row.lot.deplace_peremption_le ? 'text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 opacity-0 group-hover:opacity-100')}
                                onClick={() => markShelf([row.lot.id], !row.lot.deplace_peremption_le)}
                                disabled={processing}
                                title={row.lot.deplace_peremption_le ? t('perimes.shelf.unmark') : t('perimes.shelf.mark')}
                                aria-label={row.lot.deplace_peremption_le ? t('perimes.shelf.unmark') : t('perimes.shelf.mark')}
                              >
                                {row.lot.deplace_peremption_le ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                              </Button>
                            )}
                            {row.lot.quantity_remaining > 0 ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 border-red-200 bg-red-50 text-red-500 hover:bg-red-100 opacity-0 group-hover:opacity-100"
                                onClick={() => handleSortirStock(row.lot)}
                                disabled={processing}
                              >
                                <Trash2 className="size-3.5" />
                                {t('perimes.table.exit_btn')}
                              </Button>
                            ) : (
                            <span className="text-caption font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1">
                              <Check className="size-3" />
                              {t('perimes.table.sorti')}
                            </span>
                          )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ) : activeTab === 'shelf' ? (
          /* ========== SHELF VIEW (étagère « proches péremption ») ========== */
          <Card className="flex flex-col h-full overflow-hidden">
            <CardHeader className="p-2 lg:p-4 border-b border-slate-100 space-y-0 shrink-0">
              <div className="flex flex-wrap justify-between items-center gap-2 min-h-10 py-1">
                {selectedShelfIds.size > 0 ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-2"
                      onClick={() => markShelf(Array.from(selectedShelfIds), false)}
                      disabled={processing}
                    >
                      <PinOff className="size-4" />
                      {t('perimes.shelf.unmark')}
                      <Badge variant="secondary">{selectedShelfIds.size}</Badge>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedShelfIds(new Set())}
                      className="gap-2"
                    >
                      <X className="size-4" />
                      {t('common:cancel')}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 lg:p-2 bg-amber-50 text-amber-600 rounded-lg"><Pin className="size-4 lg:size-5" /></div>
                    <h2 className="font-bold text-base lg:text-lg tracking-tight text-slate-800">{t('perimes.shelf.title')}</h2>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-500">{shelfLots.length}</Badge>
                    <p className="text-xs text-slate-400 hidden lg:block">{t('perimes.shelf.hint')}</p>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto">
              {loadingShelf ? (
                <SkeletonTable rows={8} columns={8} />
              ) : shelfRows.length === 0 ? (
                <EmptyState
                  icon={<Pin className="size-8" />}
                  title={t('perimes.shelf.empty')}
                  className="h-64"
                />
              ) : (
                <Table className="w-full text-xs">
                  <TableHeader className="bg-slate-50 sticky top-0 z-30 border-b border-slate-100">
                    <TableRow className="text-slate-400 uppercase text-caption tracking-widest font-black hover:bg-slate-50">
                      <TableHead className="py-3 px-4 w-12 text-center">
                        <Checkbox
                          checked={selectedShelfIds.size === shelfLots.length && shelfLots.length > 0}
                          onCheckedChange={toggleAllShelfSelection}
                          className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                          aria-label={t('stock:cadencier.select_all')}
                        />
                      </TableHead>
                      <TableHead className="py-3 px-4 text-left">{t('perimes.table.product')}</TableHead>
                      <TableHead className="py-3 px-4 text-center">{t('perimes.table.lot')}</TableHead>
                      <TableHead className="py-3 px-4 text-center">{t('perimes.table.expiration')}</TableHead>
                      <TableHead className="py-3 px-4 text-left">{t('perimes.table.provider')}</TableHead>
                      <TableHead className="py-3 px-4 text-right">{t('perimes.table.stock')}</TableHead>
                      <TableHead className="py-3 px-4 text-center">{t('perimes.shelf.moved_at')}</TableHead>
                      <TableHead className="py-3 px-4 text-center">{t('perimes.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shelfRows.map((lot) => (
                      <TableRow key={lot.id} className={cn("hover:bg-slate-50 transition-colors", selectedShelfIds.has(lot.id) && 'bg-amber-50/40')}>
                        <TableCell className="py-2.5 px-4 text-center">
                          <Checkbox
                            checked={selectedShelfIds.has(lot.id)}
                            onCheckedChange={() => toggleShelfSelection(lot.id)}
                            className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                            aria-label={t('stock:reappro.select_product_aria', { name: lot.produit_nom })}
                          />
                        </TableCell>
                        <TableCell className="py-2.5 px-4">
                          <button
                            type="button"
                            onClick={() => openProduct(lot.produit)}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-left font-bold text-sm text-emerald-700 hover:text-emerald-800 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            aria-label={t('perimes.view_product', { name: lot.produit_nom })}
                          >
                            <span className="truncate">{lot.produit_nom}</span>
                            <ExternalLink className="size-3.5 shrink-0" />
                          </button>
                          <div className="text-caption font-mono text-slate-400">#{lot.produit}</div>
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-center font-mono text-label font-bold text-slate-500">
                          {lot.lot || '-'}
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-center">
                          <Badge variant="outline" className={cn("gap-1.5", lot.date_expiration && isExpiredByEndOfMonth(lot.date_expiration) ? 'bg-red-50 text-red-500 border-red-200' : 'bg-amber-50 text-amber-600 border-amber-200')}>
                            <Calendar className="size-3" />
                            {formatDate(lot.date_expiration || '')}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-xs font-semibold text-slate-500 truncate max-w-[140px]" title={lot.fournisseur_nom}>
                          {lot.fournisseur_nom}
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-right">
                          <div className={cn("font-black text-sm", lot.quantity_remaining > 0 ? 'text-slate-800' : 'text-slate-300')}>
                            {lot.quantity_remaining}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-center text-xs text-slate-500">
                          {lot.deplace_peremption_le ? formatDate(lot.deplace_peremption_le) : '-'}
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                            onClick={() => markShelf([lot.id], false)}
                            disabled={processing}
                          >
                            <PinOff className="size-3.5" />
                            {t('perimes.shelf.unmark')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ) : (
          /* ========== HISTORY VIEW ========== */
          <div className="space-y-4 lg:space-y-6">
             <Card>
               <CardContent className="p-3 lg:p-4 flex flex-wrap gap-2 lg:gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-2 lg:gap-4 items-center">
                    <div className="flex flex-col gap-1">
                        <span className="text-caption font-bold text-slate-400 uppercase pl-1">{t('common:from')}</span>
                        <LocalizedDateInput
                            className="h-9 w-auto"
                            aria-label={t('common:from')}
                            value={dateDebut}
                            onChange={(e) => setDateDebut(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-caption font-bold text-slate-400 uppercase pl-1">{t('common:to')}</span>
                        <LocalizedDateInput
                            className="h-9 w-auto"
                            aria-label={t('common:to')}
                            value={dateFin}
                            onChange={(e) => setDateFin(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrintHistory}
                        disabled={adjustments.length === 0}
                        className="gap-2"
                    >
                        <Printer className="size-4" />
                        {t('perimes.history.print')}
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleExportExcel}
                        disabled={adjustments.length === 0}
                        className="gap-2"
                    >
                        <FileSpreadsheet className="size-4" />
                        {t('perimes.history.excel')}
                    </Button>
                </div>
               </CardContent>
             </Card>

             {adjustments.length > 0 && (
               <Card className="bg-gradient-to-br from-red-50 to-red-50/40 border-red-200">
                 <CardContent className="p-3 lg:p-5">
                   <div className="flex items-center gap-2 lg:gap-3">
                     <div className="size-10 lg:size-12 rounded-full bg-red-100 flex items-center justify-center text-xl lg:text-2xl">💸</div>
                     <div>
                       <p className="text-xs lg:text-sm text-slate-500">{t('perimes.history.total_valorization')}</p>
                       <p className="text-lg lg:text-2xl font-bold text-red-600">
                         {formatCurrency(adjustments.reduce((sum, a) => sum + (a.valorisation || 0), 0))}
                       </p>
                       <p className="text-xs text-slate-400">{t('perimes.history.operations_count', { count: adjustments.length })}</p>
                     </div>
                   </div>
                 </CardContent>
               </Card>
             )}

             {loadingAdjustments ? (
               <SkeletonTable rows={6} columns={7} />
             ) : adjustments.length === 0 ? (
               <EmptyState
                 title={t('perimes.history.no_result')}
                 className="h-64 border-2 border-dashed border-slate-200 rounded-2xl"
               />
             ) : (
               <Card className="overflow-hidden">
                 <CardHeader>
                   <CardTitle className="text-lg">📜 {t('perimes.history.title')}</CardTitle>
                 </CardHeader>
                 <CardContent>
                 <div className="overflow-x-auto">
                   <Table className="w-full text-sm">
                     <TableHeader>
                       <TableRow className="bg-slate-50 hover:bg-slate-50">
                         <TableHead className="text-left px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400">{t('perimes.history.table.date')}</TableHead>
                         <TableHead className="text-left px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400">{t('perimes.history.table.product')}</TableHead>
                         <TableHead className="text-left px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400">{t('perimes.history.table.lot')}</TableHead>
                         <TableHead className="text-right px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400">{t('perimes.history.table.qty')}</TableHead>
                         <TableHead className="text-right px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400">{t('perimes.history.table.value')}</TableHead>
                         <TableHead className="text-left px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400">{t('perimes.history.table.user')}</TableHead>
                         <TableHead className="text-left px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400">{t('perimes.history.table.details')}</TableHead>
                         <TableHead className="text-right px-4 py-3 text-caption font-black uppercase tracking-widest text-slate-400">{t('common:actions_title')}</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {adjustments.map((adj) => (
                         <TableRow key={adj.id} className="hover:bg-slate-50 transition-colors">
                           <TableCell className="text-xs px-4 py-2.5 text-slate-500">{formatDate(adj.created_at)}</TableCell>
                           <TableCell className="px-4 py-2.5">
                             <div className="font-bold text-xs text-slate-800">{adj.produit_name}</div>
                             <div className="text-caption text-slate-400 font-mono">{adj.produit_cip}</div>
                           </TableCell>
                           <TableCell className="font-mono text-label px-4 py-2.5 text-slate-500">{adj.lot_number || '-'}</TableCell>
                           <TableCell className="text-right font-bold text-red-500 px-4 py-2.5">{adj.quantity_change}</TableCell>
                           <TableCell className="text-right font-bold px-4 py-2.5 text-slate-700">{formatCurrency(adj.valorisation)}</TableCell>
                           <TableCell className="text-xs px-4 py-2.5 text-slate-500">{adj.user_name}</TableCell>
                           <TableCell className="text-xs truncate max-w-[150px] px-4 py-2.5 text-slate-500" title={adj.reason_detail}>
                             {t(`stock:ajustements.filters.reasons.${adj.reason_type}`, { defaultValue: adj.reason_type_display })} {adj.reason_detail ? `- ${adj.reason_detail}` : ''}
                           </TableCell>
                           <TableCell className="text-right px-4 py-2.5">
                             {adj.reason_type === 'PERIME' && adj.quantity_change < 0 && !adj.restored && (
                               <Button
                                 variant="outline"
                                 size="sm"
                                 className="gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                 onClick={() => handleRestoreAdjustment(adj)}
                                 disabled={processing}
                               >
                                 <RotateCcw className="size-3.5" />
                                 {t('perimes.restore.action')}
                               </Button>
                             )}
                             {adj.restored && <Badge variant="outline">{t('perimes.restore.restored')}</Badge>}
                           </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 </div>
                 </CardContent>
               </Card>
             )}
          </div>
        )}
      </div>

      <QuantityInputDialog
        open={Boolean(pendingExitLot)}
        title={t('perimes.confirm.exit_title')}
        description={t('perimes.prompt.qty', { lot: pendingExitLot?.lot || '', max: pendingExitLot?.quantity_remaining ?? 0 })}
        initialValue={pendingExitLot?.quantity_remaining ?? 1}
        max={pendingExitLot?.quantity_remaining}
        onClose={() => setPendingExitLot(null)}
        onConfirm={confirmSortirStock}
      />
      <SudoValidationModal
        isOpen={sudoState.isOpen}
        onClose={closeSudo}
        onValidate={sudoState.onValidate}
        title={sudoState.title}
        message={sudoState.message}
        permission={sudoState.permission}
        forceCurrentUser={sudoState.forceCurrentUser}
        saving={sudoState.isValidating}
      />
    </div>
  )
}
