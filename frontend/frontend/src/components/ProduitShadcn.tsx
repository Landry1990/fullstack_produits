import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import {
  Package, Upload, RefreshCw, Search, X,
  ChevronLeft, ChevronRight, AlertTriangle,
  BarChart3, Tags, Eye, EyeOff, Truck
} from 'lucide-react'

import api from '../services/api'
import { getApiErrorDetail } from '../utils/errorHandling'
import { useConfirm } from '../hooks/useConfirm'
import { useAuth } from '../context/AuthContext'
import type { ProduitModel } from '../types'
import type { Groupe } from '../types/catalog'

import {
  useProduits, useRayons, useFournisseurs, useFormes, useGroupes,
  useProduitLots, useProduitStats, useProduitAchats, useProduitHistory,
  useAdjustStock
} from '../hooks/useProduits'
import { useTVA } from '../hooks/useTVA'

import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Badge } from './ui/Badge'
import { Checkbox } from './ui/Checkbox'
import SkeletonTable from './ui/SkeletonTable'
import { ProductTabsContent } from './products/ProductTabsContent'
import ProduitCreateModal from './ProduitFormModal'
import PasswordConfirmModal from './PasswordConfirmModal'
import { StockAdjustmentModal } from './products/modals/StockAdjustmentModal'

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
type ActiveTab = 'general' | 'prix' | 'achats' | 'lots' | 'stats' | 'mvmts'

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function stockClass(stock: number): string {
  if (stock < 0) return 'text-red-600 font-bold'
  if (stock === 0) return 'text-slate-400 font-medium'
  return 'text-slate-800 font-bold'
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */
export default function ProduitShadcn() {
  /* ── Hooks ── */
  const confirm = useConfirm()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation(['products', 'common'])
  const { user } = useAuth()

  /* ── Pagination & Filters ── */
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterRayon, setFilterRayon] = useState('')
  const [filterFournisseur, setFilterFournisseur] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showInStockOnly, setShowInStockOnly] = useState(false)

  /* ── Selection ── */
  const [selectedProduit, setSelectedProduit] = useState<ProduitModel | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [activeTab, setActiveTab] = useState<ActiveTab>('general')

  /* ── Modals ── */
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [passwordConfig, setPasswordConfig] = useState({ title: '', message: '' })
  const pendingActionRef = useRef<() => Promise<void>>(() => Promise.resolve())

  /* ── Forms ── */
  const [editForm, setEditForm] = useState<Record<string, unknown>>({})
  const [adjustForm, setAdjustForm] = useState({
    new_quantity: '',
    new_reserve_quantity: '',
    reason_type: 'INVENTAIRE',
    stock_lot_id: '',
    new_lot_number: '',
    new_lot_expiration: ''
  })
  const adjustStockMutation = useAdjustStock()
  const [transferLoading, setTransferLoading] = useState(false)

  /* ── Debounce search ── */
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(searchQuery); setPage(1) }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    console.log('[Filter Change] showInStockOnly:', showInStockOnly, 'resetting page to 1')
    setPage(1)
  }, [showInStockOnly, showInactive, filterRayon, filterFournisseur])

  /* ── Data ── */
  const { data: productsData, isLoading, error: loadError, refetch } = useProduits({
    search: debouncedSearch,
    page,
    page_size: 50,
    rayon: filterRayon,
    fournisseur: filterFournisseur,
    include_inactive: showInactive,
    only_in_stock: showInStockOnly,
  })

  const { data: lots = [] } = useProduitLots(selectedProduit?.id || null)
  const { data: monthlyStats = [] } = useProduitStats(selectedProduit?.id || null)
  const { data: achats = [] } = useProduitAchats(selectedProduit?.id || null)
  const { data: stockHistory = [], isLoading: loadingHistory } = useProduitHistory(selectedProduit?.id || null, activeTab)

  useEffect(() => {
    if (location.state?.action === 'NEW_PRODUCT') {
      setIsCreateOpen(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
    if (location.state?.searchProduitId && productsData?.results) {
      const pid = location.state.searchProduitId
      const found = productsData.results.find((p: ProduitModel) => p.id === pid)
      if (found) { setSelectedProduit(found); setActiveTab('stats') }
      else if (searchQuery !== String(pid)) setSearchQuery(String(pid))
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [productsData])

  const { data: rayons = [] } = useRayons()
  const { data: fournisseurs = [] } = useFournisseurs()
  const { data: formes = [] } = useFormes()
  const { data: groupes = [] } = useGroupes()
  useTVA()

  const produits = useMemo(() => productsData?.results || [], [productsData])
  const totalCount = productsData?.count || 0
  const totalPages = Math.ceil(totalCount / 50) || 1

  // DEBUG pagination
  useEffect(() => {
    console.log('[Pagination Debug] page:', page, 'count:', totalCount, 'totalPages:', totalPages, 'results:', productsData?.results?.length)
  }, [page, productsData, totalCount, totalPages])

  /* ── Stats ── */
  const lowStockCount = useMemo(() => produits.filter(p => (p.stock ?? 0) <= (p.stock_alert ?? 0) && (p.stock ?? 0) > 0).length, [produits])
  const outOfStockCount = useMemo(() => produits.filter(p => (p.stock ?? 0) <= 0).length, [produits])
  const error = loadError instanceof Error ? loadError.message : (loadError ? String(loadError) : null)

  /* ── Handlers ── */
  const handleDelete = async (produit: ProduitModel) => {
    if (!user?.is_superuser && !user?.profile?.can_delete_product && !user?.can_delete_product) {
      toast.error(t('products:messages.access_denied_delete')); return
    }
    const ok = await confirm({
      title: t('products:messages.delete_confirm_title'),
      message: t('products:messages.delete_confirm_body', { name: produit.name }),
      variant: 'danger',
      confirmText: t('products:actions.delete')
    })
    if (!ok) return
    setPasswordConfig({ title: 'Confirmation', message: 'Entrez votre mot de passe pour supprimer' })
    pendingActionRef.current = async () => {
      await api.delete(`produits/${produit.id}/`)
      setSelectedProduit(null)
      refetch()
      toast.success(t('products:messages.delete_success'))
    }
    setIsPasswordOpen(true)
  }

  const handleStockAdjustment = async () => {
    if (!selectedProduit) return
    try {
      const data = await adjustStockMutation.mutateAsync({
        id: selectedProduit.id,
        quantity: parseInt(adjustForm.new_quantity),
        newReserveQuantity: selectedProduit.has_reserve_storage ? parseInt(adjustForm.new_reserve_quantity || '0') : undefined,
        reason: adjustForm.reason_type,
        stockLotId: adjustForm.stock_lot_id ? parseInt(adjustForm.stock_lot_id) : undefined,
        newLotNumber: adjustForm.new_lot_number || undefined,
        newLotExpiration: adjustForm.new_lot_expiration || undefined
      })
      const qtyChangeStr = (data.quantity_change ?? 0) >= 0 ? '+' : ''
      toast.success(t('products:messages.adjust_success', { change: `${qtyChangeStr}${data.quantity_change ?? 0}` }))
      setSelectedProduit(prev => prev ? { ...prev, stock: (prev.stock ?? 0) + (data.quantity_change ?? 0), stock_reserve: (prev.stock_reserve ?? 0) + ((data as unknown as Record<string, number>).reserve_change ?? 0) } : null)
      setIsAdjustOpen(false)
      refetch()
    } catch (err) {
      toast.error(getApiErrorDetail(err, t('products:messages.adjust_error', { defaultValue: 'Erreur lors de l\u00e9ajustement' })))
    }
  }

  const handleStockAdjustmentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduit) return
    if (!user?.is_superuser && !user?.profile?.can_adjust_stock && !user?.can_adjust_stock) {
      toast.error(t('products:messages.access_denied_adjust', { defaultValue: 'Acc\u00e8s refus\u00e9' })); return
    }
    setIsAdjustOpen(false)
    setPasswordConfig({
      title: t('products:messages.password_confirm_adjust_title', { defaultValue: 'Confirmation' }),
      message: t('products:messages.password_confirm_adjust_body', {
        name: selectedProduit.name,
        oldStock: selectedProduit.stock,
        newStock: adjustForm.new_quantity,
        defaultValue: 'Confirmer ajustement'
      })
    })
    pendingActionRef.current = handleStockAdjustment
    setIsPasswordOpen(true)
  }

  const handleToggleActive = async (produit: ProduitModel) => {
    try {
      const response = await api.post(`produits/${produit.id}/toggle_active/`)
      const isActive = response.data.is_active
      toast.success(isActive ? t('products:messages.status_reactivated', { defaultValue: 'Produit r\u00e9activ\u00e9' }) : t('products:messages.status_hidden', { defaultValue: 'Produit masqu\u00e9' }))
      setSelectedProduit(prev => prev ? { ...prev, is_active: isActive } : null)
      refetch()
    } catch (err) { toast.error(getApiErrorDetail(err, t('products:messages.status_error', { defaultValue: 'Erreur' }))) }
  }

  const handleGenerateLabels = async (produit: ProduitModel) => {
    const qtyStr = prompt(t('products:messages.labels_prompt', { name: produit.name, defaultValue: `Quantit\u00e9 \u00e9tiquettes pour ${produit.name}` }), "1")
    if (!qtyStr) return
    const quantity = parseInt(qtyStr, 10)
    if (isNaN(quantity) || quantity <= 0) { toast.error(t('products:messages.invalid_quantity', { defaultValue: 'Quantit\u00e9 invalide' })); return }
    try {
      const resp = await api.post('produits/generate_labels/', { products: [{ id: produit.id, quantity }] }, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([resp.data]))
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `etiquettes_${produit.name}.pdf`)
      document.body.appendChild(link); link.click(); link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) { toast.error(getApiErrorDetail(err, t('products:messages.generation_error', { defaultValue: 'Erreur g\u00e9n\u00e9ration' }))) }
  }

  const handleTransferToRayon = async (produit: ProduitModel) => {
    if (!produit.has_reserve_storage || (produit.stock_reserve ?? 0) <= 0) return
    const needed = Math.max(0, (produit.capacite_rayon ?? 0) - (produit.stock ?? 0))
    const suggest = Math.min(needed, produit.stock_reserve ?? 0)
    const qtyStr = prompt(t('products:messages.transfer_prompt', { reserve: produit.stock_reserve, capacity: produit.capacite_rayon, needed, defaultValue: 'Quantit\u00e9 \u00e0 transf\u00e9rer ?' }), String(suggest))
    if (qtyStr === null) return
    const qty = parseInt(qtyStr, 10)
    if (isNaN(qty) || qty <= 0) { toast.error(t('products:messages.invalid_quantity', { defaultValue: 'Quantit\u00e9 invalide' })); return }
    setTransferLoading(true)
    try {
      await api.post(`produits/${produit.id}/transfer_to_shelf/`, { quantity: qty })
      toast.success(t('products:messages.transfer_success', { count: qty, defaultValue: `${qty} unit\u00e9s transf\u00e9r\u00e9es` }))
      refetch()
    } catch (err) {
      toast.error(getApiErrorDetail(err, t('products:messages.transfer_error', { defaultValue: 'Erreur transfert' })))
    } finally { setTransferLoading(false) }
  }

  const handleMovementClick = async (item: { facture?: number; commande?: number; type?: string }) => {
    if (item.facture && (item.type === 'SORTIE' || item.type === 'RETOUR')) {
      try {
        await api.get(`factures/${item.facture}/`)
        toast.success(t('products:messages.facture_loaded', { defaultValue: 'Facture #' + item.facture }))
      } catch {
        toast.error(t('products:messages.facture_load_error', { defaultValue: 'Erreur chargement facture' }))
      }
    } else if (item.commande) {
      navigate('/app/commandes', { state: { openDetailsId: item.commande } })
    }
  }

  const handleOpenEdit = (produit: ProduitModel) => {
    setEditForm({
      id: produit.id,
      name: produit.name,
      stock: String(produit.stock ?? ''),
      cost_price: String(produit.cost_price ?? ''),
      selling_price: String(produit.selling_price ?? ''),
      cip1: produit.cip1 || '',
      cip2: produit.cip2 || '',
      cip3: produit.cip3 || '',
      expire_date: produit.expire_date || '',
      stock_alert: String(produit.stock_alert ?? '0'),
      stock_minimum: String(produit.stock_minimum ?? '0'),
      stock_maximum: String(produit.stock_maximum ?? '0'),
      tva: produit.tva || '19.25',
      rayon: produit.rayon ? String(produit.rayon) : '',
      fournisseur: produit.fournisseur ? String(produit.fournisseur) : '',
      forme: produit.forme ? String(produit.forme) : '',
      use_lot_management: produit.use_lot_management ?? true,
      requires_prescription: produit.requires_prescription ?? false,
      surveillance_category: produit.surveillance_category || 'NONE',
      is_supplier_exclusive: produit.is_supplier_exclusive ?? false,
      has_reserve_storage: produit.has_reserve_storage ?? false,
      capacite_rayon: String(produit.capacite_rayon ?? '0'),
      min_rayon: String(produit.min_rayon ?? '0'),
      message_alerte: produit.message_alerte || ''
    })
    setIsEditOpen(true)
  }

  const resetFilters = () => {
    setSearchQuery('')
    setFilterRayon('')
    setFilterFournisseur('')
    setShowInactive(false)
    setShowInStockOnly(false)
  }

  const isAllSelected = selectedIds.length === produits.length && produits.length > 0
  const isPartial = selectedIds.length > 0 && selectedIds.length < produits.length

  /* ── Keyboard nav ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement
      if (el?.tagName === 'TEXTAREA' || (el?.tagName === 'INPUT' && el.getAttribute('type') !== 'text')) return
      if (e.key === 'Enter' && selectedProduit) {
        e.preventDefault()
        setSelectedIds(prev => prev.includes(selectedProduit.id) ? prev.filter(id => id !== selectedProduit.id) : [...prev, selectedProduit.id])
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!produits.length) return
        const idx = selectedProduit ? produits.findIndex(p => p.id === selectedProduit.id) : -1
        const next = e.key === 'ArrowDown'
          ? (idx < produits.length - 1 ? idx + 1 : 0)
          : (idx > 0 ? idx - 1 : produits.length - 1)
        const p = produits[next]
        if (p) { setSelectedProduit(p); document.querySelector(`tr[data-product-id="${p.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [produits, selectedProduit])

  /* ═══════════════════════════════════════════════════════════════ */
  /*  RENDER                                                         */
  /* ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">

      {/* ── Header ── */}
      <header className="px-6 py-4 border-b border-slate-200 bg-white shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 rounded-xl">
            <Package className="size-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{t('products:title', { defaultValue: 'Gestion des produits' })}</h1>
            <p className="text-xs text-slate-400 font-medium">{t('products:subtitle', { defaultValue: 'Créez et gérez vos produits et services' })}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading} leftIcon={isLoading ? <RefreshCw className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}>
            {t('common:actions.refresh', { defaultValue: 'Rafraîchir' })}
          </Button>
          <Button variant="primary" size="sm" leftIcon={<Package className="size-4" />} onClick={() => setIsCreateOpen(true)}>
            {t('products:actions.new', { defaultValue: 'Nouveau' })}
          </Button>
          <Button variant="outline" size="sm" leftIcon={<Upload className="size-4" />} onClick={() => {}}>
            {t('products:import.title', { defaultValue: 'Importer' })}
          </Button>
        </div>
      </header>

      {/* ── Error Banner ── */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="size-4" />
          {error}
        </div>
      )}

      {/* ── Main Content ── */}
      <main className="flex-1 p-4 min-h-0 overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 h-full min-h-0 w-full overflow-hidden">

          {/* ═════ Left Panel : List ═════ */}
          <section className="xl:col-span-5 flex flex-col h-full min-h-0 gap-3">

            {/* Search & Filters */}
            <Card variant="default" padding="md" className="shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  placeholder={t('products:filters.search_placeholder')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
                  <Checkbox size="sm" checked={showInStockOnly} onChange={v => setShowInStockOnly(v)} />
                  {t('products:filters.in_stock_only', { defaultValue: 'En stock uniquement' })}
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
                  <Checkbox size="sm" checked={showInactive} onChange={v => setShowInactive(v)} />
                  {t('products:filters.show_inactive', { defaultValue: 'Afficher inactifs' })}
                </label>
                {(filterRayon || filterFournisseur || showInactive || showInStockOnly) && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} leftIcon={<X className="size-3" />}>
                    {t('products:filters.reset', { defaultValue: 'Réinitialiser' })}
                  </Button>
                )}
              </div>

              {/* Active filter chips */}
              {(filterRayon || filterFournisseur || showInactive || showInStockOnly) && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {filterRayon && <Badge variant="secondary" size="sm">{t('products:filters.rayon_active')}</Badge>}
                  {filterFournisseur && <Badge variant="warning" size="sm">{t('products:filters.provider_active')}</Badge>}
                  {showInactive && <Badge variant="ghost" size="sm">{t('products:filters.inactive_only')}</Badge>}
                  {showInStockOnly && <Badge variant="success" size="sm">{t('products:filters.in_stock_only', { defaultValue: 'En stock' })}</Badge>}
                </div>
              )}
            </Card>

            {/* Table */}
            <Card variant="default" padding="none" className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Table Header */}
              <div className="shrink-0 px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <Checkbox size="sm" checked={isAllSelected} indeterminate={isPartial} onChange={() => setSelectedIds(prev => prev.length === produits.length ? [] : produits.map(p => p.id))} />
                  <span>CIP</span>
                  <span className="ml-6">{t('products:table.product', { defaultValue: 'Produit' })}</span>
                </div>
              </div>

              {/* Table Body */}
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <SkeletonTable />
                ) : produits.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                      <Package className="size-8 text-slate-300" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-500">{t('products:table.empty_title', { defaultValue: 'Aucun produit' })}</h3>
                    <p className="text-slate-400 text-sm mt-1 max-w-sm">{t('products:table.empty_subtitle', { defaultValue: 'Créez votre premier produit ou service pour commencer.' })}</p>
                    <Button variant="primary" size="sm" className="mt-6" onClick={() => setIsCreateOpen(true)}>
                      + {t('products:actions.create', { defaultValue: 'Créer un produit' })}
                    </Button>
                  </div>
                ) : (
                  <table className="w-full">
                    <tbody className="divide-y divide-slate-100">
                      {produits.map(produit => {
                        const selectedSet = new Set(selectedIds);
                        const stock = produit.stock ?? 0
                        const isSelected = selectedProduit?.id === produit.id
                        const isChecked = selectedSet.has(produit.id)
                        return (
                          <tr
                            key={produit.id}
                            data-product-id={produit.id}
                            onClick={() => setSelectedProduit(produit)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-emerald-50 border-l-2 border-l-emerald-500' :
                              isChecked ? 'bg-emerald-50/50' :
                              'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-3 px-4 w-10" onClick={e => e.stopPropagation()}>
                              <Checkbox size="sm" checked={isChecked} onChange={() => setSelectedIds(prev => { const s = new Set(prev); return s.has(produit.id) ? prev.filter(id => id !== produit.id) : [...prev, produit.id]; })} />
                            </td>
                            <td className="py-3 px-2 w-36">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-mono text-xs text-slate-500">{produit.cip1 || '-'}</span>
                                {produit.cip2 && <span className="font-mono text-xs text-slate-400">{produit.cip2}</span>}
                                {produit.cip3 && <span className="font-mono text-xs text-slate-400">{produit.cip3}</span>}
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <span className={cn("text-sm uppercase truncate", stockClass(stock))} title={produit.name}>
                                  {produit.name}
                                </span>
                                {produit.is_supplier_exclusive && (
                                  <Badge variant="success" size="sm">EXCLU</Badge>
                                )}
                                {produit.is_active === false && (
                                  <Badge variant="ghost" size="sm">Inactif</Badge>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer stats */}
              <div className="shrink-0 px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Global</span>
                  <Badge variant="primary" size="sm">{totalCount}</Badge>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5" title="Stock Faible">
                    <div className="size-2 rounded-full bg-amber-400" />
                    <span className="text-amber-600 font-semibold text-sm">{lowStockCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5" title="Rupture">
                    <div className="size-2 rounded-full bg-red-500" />
                    <span className="text-red-600 font-semibold text-sm">{outOfStockCount}</span>
                  </div>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="shrink-0 px-4 py-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Page {page} / {totalPages}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} leftIcon={<ChevronLeft className="size-4" />}>
                      Précédent
                    </Button>
                    <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} rightIcon={<ChevronRight className="size-4" />}>
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </section>

          {/* ═════ Right Panel : Details ═════ */}
          <section className="xl:col-span-7 h-full min-h-0">
            <Card variant="default" padding="none" className="h-full flex flex-col overflow-hidden">
              {selectedProduit ? (
                <>
                  {/* Detail Header */}
                  <div className="shrink-0 px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h2 className="text-lg font-bold text-slate-900 truncate uppercase" title={selectedProduit.name}>
                          {selectedProduit.name}
                        </h2>
                        {selectedProduit.is_active === false && <Badge variant="ghost" size="sm">Inactif</Badge>}
                        {selectedProduit.is_supplier_exclusive && <Badge variant="success" size="sm">Exclusif</Badge>}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                          ((selectedProduit.total_stock ?? selectedProduit.stock) ?? 0) <= 0 ? 'bg-red-50 text-red-600' :
                          ((selectedProduit.total_stock ?? selectedProduit.stock) ?? 0) <= (selectedProduit.stock_alert ?? 0) ? 'bg-amber-50 text-amber-600' :
                          'bg-emerald-50 text-emerald-600'
                        }`}>
                          {selectedProduit.has_reserve_storage ? (
                            <>Rayon: {selectedProduit.stock ?? 0} / Réserve: {selectedProduit.stock_reserve ?? 0}</>
                          ) : (
                            <>Stock: {selectedProduit.stock ?? 0}</>
                          )}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <p className="text-sm text-slate-500 font-mono">CIP: <span className="text-slate-700">{selectedProduit.cip1 || '-'}</span></p>
                        {selectedProduit.cip2 && <p className="text-sm text-slate-400 font-mono">• <span className="text-slate-600">{selectedProduit.cip2}</span></p>}
                        {selectedProduit.cip3 && <p className="text-sm text-slate-400 font-mono">• <span className="text-slate-600">{selectedProduit.cip3}</span></p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => {
                        setAdjustForm({
                          new_quantity: String(selectedProduit?.stock || 0),
                          new_reserve_quantity: String(selectedProduit?.stock_reserve || 0),
                          reason_type: 'INVENTAIRE',
                          stock_lot_id: '',
                          new_lot_number: '',
                          new_lot_expiration: ''
                        })
                        setIsAdjustOpen(true)
                      }} leftIcon={<BarChart3 className="size-4" />} title={t('products:actions.adjust_stock', { defaultValue: 'Ajuster le stock' })}>
                        {t('products:actions.adjust_stock', { defaultValue: 'Stock' })}
                      </Button>
                      {selectedProduit.has_reserve_storage && (selectedProduit.stock_reserve ?? 0) > 0 && (
                        <Button variant="outline" size="sm" onClick={() => handleTransferToRayon(selectedProduit)} disabled={transferLoading} leftIcon={<Truck className="size-4" />} title={t('products:actions.refill_rayon', { defaultValue: 'R\u00e9approvisionner rayon' })} />
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleGenerateLabels(selectedProduit)} leftIcon={<Tags className="size-4" />} title={t('products:actions.labels', { defaultValue: '\u00c9tiquettes' })} />
                      <Button variant="outline" size="sm" onClick={() => handleOpenEdit(selectedProduit)} title={t('common:actions.edit', { defaultValue: 'Modifier' })}>
                        {t('common:actions.edit', { defaultValue: 'Modifier' })}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleToggleActive(selectedProduit)} title={selectedProduit.is_active === false ? t('products:actions.reactivate', { defaultValue: 'R\u00e9activer' }) : t('products:actions.deactivate', { defaultValue: 'D\u00e9sactiver' })}>
                        {selectedProduit.is_active === false ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(selectedProduit)}>
                        {t('common:actions.delete', { defaultValue: 'Supprimer' })}
                      </Button>
                    </div>
                  </div>

                  <ProductTabsContent
                    selectedProduit={selectedProduit}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    lots={lots}
                    monthlyStats={monthlyStats}
                    achats={achats}
                    stockHistory={stockHistory}
                    loadingHistory={loadingHistory}
                    onMovementClick={handleMovementClick}
                  />
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                  <Package className="size-16 mb-4 opacity-30" />
                  <p className="text-sm font-medium">{t('products:details.select_product', { defaultValue: 'Sélectionnez un produit pour voir les détails' })}</p>
                </div>
              )}
            </Card>
          </section>
        </div>
      </main>

      {/* ── Modals ── */}
      <ProduitCreateModal
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={(updated: ProduitModel) => { setSelectedProduit(updated); setIsEditOpen(false); refetch(); toast.success(t('products:messages.update_success')); }}
        produitsEndpoint="produits/"
        initialData={editForm}
        rayons={rayons}
        fournisseurs={fournisseurs}
        formes={formes}
        groupes={groupes as unknown as Groupe[]}
      />
      <StockAdjustmentModal
        isOpen={isAdjustOpen} onClose={() => setIsAdjustOpen(false)}
        selectedProduit={selectedProduit} form={adjustForm} setForm={setAdjustForm}
        onSubmit={handleStockAdjustmentSubmit}
      />
      <PasswordConfirmModal
        isOpen={isPasswordOpen}
        onClose={() => setIsPasswordOpen(false)}
        onConfirm={() => pendingActionRef.current()}
        title={passwordConfig.title}
        message={passwordConfig.message}
      />
      <ProduitCreateModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(produit: ProduitModel) => { refetch(); setIsCreateOpen(false); setSelectedProduit(produit); toast.success(`✅ ${produit.name} — ${t('products:messages.create_success', { defaultValue: 'Produit créé avec succès' })}`); }}
        produitsEndpoint={'produits/'}
        rayons={rayons}
        fournisseurs={fournisseurs}
        formes={formes}
        groupes={groupes as unknown as Groupe[]}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function _PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-bold text-slate-800">{value}</span>
    </div>
  )
}

/* helper cn */
function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
