import { useState, useMemo, useEffect, useRef, useCallback, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { gooeyToast } from 'goey-toast'

import api from '../services/api'
import { getApiErrorDetail } from '../utils/errorHandling'
import { useConfirm } from './useConfirm'
import { useAuth } from '../context/AuthContext'
import type { ProduitModel, Facture } from '../types'
import {
  useProduits, useProduit, useRayons, useFournisseurs, useFormes, useGroupes,
  useProduitLots, useProduitStats, useProduitAchats, useProduitHistory,
  useAdjustStock
} from './useProduits'
import type { StockMovement } from './useProduits'
import { useTVA } from './useTVA'

export type ActiveTab = 'general' | 'prix' | 'achats' | 'lots' | 'stats' | 'mvmts'

export interface AdjustForm {
  new_quantity: string
  new_reserve_quantity: string
  reason_type: string
  stock_lot_id: string
  new_lot_number: string
  new_lot_expiration: string
}

/**
 * État + données + handlers de la page Produits (liste + fiche détail).
 * La vue reste dans ProduitShadcn.tsx et ses sous-composants.
 */
export function useProduitPage() {
  const confirm = useConfirm()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation(['products', 'common'])
  const { user } = useAuth()
  const queryClient = useQueryClient()

  /* ── Pagination & Filters ── */
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterRayon, setFilterRayon] = useState('')
  const [filterForme, setFilterForme] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showInStockOnly, setShowInStockOnly] = useState(false)

  /* ── Selection ── */
  const [selectedProduit, setSelectedProduit] = useState<ProduitModel | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('general')
  const [pendingProduitId, setPendingProduitId] = useState<number | null>(null)
  const [pendingProduitAction, setPendingProduitAction] = useState<'edit' | 'adjust' | 'movements' | null>(null)
  const { data: pendingProduit, isError: pendingProduitError } = useProduit(pendingProduitId)

  /* ── Modals ── */
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [passwordConfig, setPasswordConfig] = useState({ title: '', message: '' })
  const [showSalesModal, setShowSalesModal] = useState(false)
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null)
  const [loadingFacture, setLoadingFacture] = useState(false)
  const [showAvoirModal, setShowAvoirModal] = useState(false)
  const [selectedAvoirId, setSelectedAvoirId] = useState<number | null>(null)
  const pendingActionRef = useRef<() => Promise<void>>(() => Promise.resolve())

  /* ── Forms ── */
  const [editForm, setEditForm] = useState<Record<string, unknown>>({})
  const [createInitialData, setCreateInitialData] = useState<Record<string, unknown>>({})
  const [adjustForm, setAdjustForm] = useState<AdjustForm>({
    new_quantity: '',
    new_reserve_quantity: '',
    reason_type: 'INVENTAIRE',
    stock_lot_id: '',
    new_lot_number: '',
    new_lot_expiration: ''
  })
  const adjustStockMutation = useAdjustStock()
  const [transferLoading, setTransferLoading] = useState(false)
  const [labelProduct, setLabelProduct] = useState<ProduitModel | null>(null)
  const [transferProduct, setTransferProduct] = useState<ProduitModel | null>(null)

  /* ── Debounce search ── */
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(searchQuery); setPage(1) }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    setPage(1)
  }, [showInStockOnly, showInactive, filterRayon, filterForme])

  /* ── Data ── */
  const { data: productsData, isLoading, error: loadError, refetch } = useProduits({
    search: debouncedSearch,
    page,
    page_size: 50,
    rayon: filterRayon,
    forme: filterForme,
    include_inactive: showInactive,
    only_in_stock: showInStockOnly,
  })

  const { data: lots = [] } = useProduitLots(selectedProduit?.id || null)
  const { data: monthlyStats = [] } = useProduitStats(selectedProduit?.id || null)
  const { data: achats = [] } = useProduitAchats(selectedProduit?.id || null)
  const { data: stockHistory = [], isLoading: loadingHistory } = useProduitHistory(selectedProduit?.id || null, activeTab)

  useEffect(() => {
    if (location.state?.action === 'NEW_PRODUCT') {
      setCreateInitialData({})
      setIsCreateOpen(true)
      navigate(location.pathname, { replace: true, state: {} })
      return
    }

    const pid = location.state?.searchProduitId
    if (!pid) return

    setPendingProduitId(pid)
    const action = location.state?.openProductAction
    setPendingProduitAction(action === 'edit' || action === 'adjust' || action === 'movements' ? action : null)
  }, [location.state, location.pathname, navigate])

  const { data: rayons = [] } = useRayons()
  const { data: fournisseurs = [] } = useFournisseurs()
  const { data: formes = [] } = useFormes()
  const { data: groupes = [] } = useGroupes()
  useTVA()

  const produits = useMemo(() => productsData?.results || [], [productsData])
  const totalCount = productsData?.count || 0
  const totalPages = Math.ceil(totalCount / 50) || 1

  /* ── Stats ── */
  // Seuil d'alerte = stock_minimum (même règle que les alertes backend : stock <= min, min > 0)
  const lowStockCount = useMemo(() => produits.filter(p => !p.is_service && (p.stock_minimum ?? 0) > 0 && (p.stock ?? 0) <= (p.stock_minimum ?? 0) && (p.stock ?? 0) > 0).length, [produits])
  const outOfStockCount = useMemo(() => produits.filter(p => !p.is_service && (p.stock ?? 0) <= 0).length, [produits])
  const error = loadError instanceof Error ? loadError.message : (loadError ? String(loadError) : null)

  /* ── Handlers ── */
  const handleDelete = async (produit: ProduitModel) => {
    if (!user?.is_superuser && !user?.profile?.can_delete_product && !user?.can_delete_product) {
      gooeyToast.error(t('products:messages.access_denied_delete')); return
    }
    const ok = await confirm({
      title: t('products:messages.delete_confirm_title'),
      message: t('products:messages.delete_confirm_body', { name: produit.name }),
      variant: 'danger',
      confirmText: t('products:actions.delete')
    })
    if (!ok) return
    setPasswordConfig({
      title: t('products:messages.password_confirm_delete_title'),
      message: t('products:messages.password_confirm_delete_body', { name: produit.name })
    })
    pendingActionRef.current = async () => {
      await api.delete(`produits/${produit.id}/`)
      setSelectedProduit(null)
      refetch()
      gooeyToast.success(t('products:messages.delete_success'))
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
      gooeyToast.success(t('products:messages.adjust_success', { change: `${qtyChangeStr}${data.quantity_change ?? 0}` }))
      setSelectedProduit(prev => prev ? { ...prev, stock: (prev.stock ?? 0) + (data.quantity_change ?? 0), stock_reserve: (prev.stock_reserve ?? 0) + ((data as unknown as Record<string, number>).reserve_change ?? 0) } : null)
      setIsAdjustOpen(false)
      refetch()
    } catch (err) {
      gooeyToast.error(getApiErrorDetail(err, t('products:messages.adjust_error')))
    }
  }

  const handleStockAdjustmentSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!selectedProduit) return
    if (!user?.is_superuser && !user?.profile?.can_adjust_stock && !user?.can_adjust_stock) {
      gooeyToast.error(t('products:messages.access_denied_adjust')); return
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

  // Ouverture du modal de création — pré-remplit le nom avec le texte
  // recherché quand l'utilisateur crée depuis l'état vide (« produit absent »).
  const handleOpenCreate = useCallback((initialName = '') => {
    setCreateInitialData(initialName.trim() ? { name: initialName.trim() } : {})
    setIsCreateOpen(true)
  }, [])

  const handleOpenAdjust = useCallback((produit: ProduitModel) => {
    setAdjustForm({
      new_quantity: String(produit.stock ?? 0),
      new_reserve_quantity: String(produit.stock_reserve ?? 0),
      reason_type: 'INVENTAIRE',
      stock_lot_id: '',
      new_lot_number: '',
      new_lot_expiration: ''
    })
    setIsAdjustOpen(true)
  }, [])

  const handleToggleActive = async (produit: ProduitModel) => {
    try {
      const response = await api.post(`produits/${produit.id}/toggle_active/`)
      const isActive = response.data.is_active
      gooeyToast.success(isActive ? t('products:messages.status_reactivated') : t('products:messages.status_hidden'))
      setSelectedProduit(prev => prev ? { ...prev, is_active: isActive } : null)
      refetch()
    } catch (err) { gooeyToast.error(getApiErrorDetail(err, t('products:messages.status_error'))) }
  }

  const handleGenerateLabels = (produit: ProduitModel) => setLabelProduct(produit)

  const handleTransferToRayon = (produit: ProduitModel) => {
    if (produit.has_reserve_storage && (produit.stock_reserve ?? 0) > 0) setTransferProduct(produit)
  }

  const confirmTransferToRayon = async (quantity: number) => {
    if (!transferProduct) return
    setTransferLoading(true)
    try {
      await api.post(`produits/${transferProduct.id}/transfer_to_shelf/`, { quantity })
      gooeyToast.success(t('products:messages.transfer_success', { count: quantity }))
      setTransferProduct(null)
      refetch()
    } catch (err) {
      gooeyToast.error(getApiErrorDetail(err, t('products:messages.transfer_error')))
    } finally { setTransferLoading(false) }
  }

  const handleMovementClick = async (item: StockMovement) => {
    if (item.facture) {
      setSelectedFacture(null)
      setLoadingFacture(true)
      setShowSalesModal(true)
      try {
        const { data } = await api.get(`factures/${item.facture}/`)
        setSelectedFacture(data)
      } catch {
        gooeyToast.error(t('products:messages.facture_load_error'))
        setShowSalesModal(false)
      } finally {
        setLoadingFacture(false)
      }
    } else if (item.commande) {
      navigate('/app/commandes/locales', { state: { openDetailsId: item.commande } })
    } else if (item.avoir) {
      const numero = item.avoir_client_numero || item.avoir_numero || String(item.avoir)
      try {
        await navigator.clipboard.writeText(numero)
        gooeyToast.success(t('products:messages.avoir_copied', { numero, defaultValue: `Avoir client ${numero} copié dans le presse-papiers` }))
      } catch {
        gooeyToast.success(t('products:messages.avoir_number', { numero, defaultValue: `Avoir client : ${numero}` }))
      }
    }
  }

  const handleOpenEdit = useCallback((produit: ProduitModel) => {
    setEditForm({
      id: produit.id,
      name: produit.name,
      stock: String(produit.stock ?? ''),
      cost_price: String(produit.cost_price ?? ''),
      selling_price: String(produit.selling_price ?? ''),
      cip1: produit.cip1 || '',
      cip2: produit.cip2 || '',
      cip3: produit.cip3 || '',
      cip4: produit.cip4 || '',
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
  }, [])

  useEffect(() => {
    if (!pendingProduitId) return

    const target = produits.find((produit) => produit.id === pendingProduitId) || pendingProduit
    if (target) {
      setSelectedProduit(target)
      setActiveTab(pendingProduitAction === 'movements' ? 'mvmts' : 'stats')
      if (pendingProduitAction === 'edit') handleOpenEdit(target)
      if (pendingProduitAction === 'adjust') handleOpenAdjust(target)
      setPendingProduitId(null)
      setPendingProduitAction(null)
      navigate(location.pathname, { replace: true, state: {} })
      return
    }

    if (pendingProduitError) {
      setSearchQuery(String(pendingProduitId))
      setPendingProduitId(null)
      setPendingProduitAction(null)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [
    pendingProduitId,
    pendingProduit,
    pendingProduitError,
    pendingProduitAction,
    produits,
    handleOpenEdit,
    handleOpenAdjust,
    navigate,
    location.pathname,
  ])

  const resetFilters = () => {
    setSearchQuery('')
    setFilterRayon('')
    setFilterForme('')
    setShowInactive(false)
    setShowInStockOnly(false)
  }

  /* ── Keyboard nav ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement
      if (el?.tagName === 'TEXTAREA' || (el?.tagName === 'INPUT' && el.getAttribute('type') !== 'text')) return
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

  return {
    /* data */
    produits, totalCount, totalPages, isLoading, error, refetch,
    lots, monthlyStats, achats, stockHistory, loadingHistory,
    rayons, fournisseurs, formes, groupes,
    /* filters */
    searchQuery, setSearchQuery,
    filterRayon, setFilterRayon,
    filterForme, setFilterForme,
    showInactive, setShowInactive,
    showInStockOnly, setShowInStockOnly,
    resetFilters,
    page, setPage,
    /* selection */
    selectedProduit, setSelectedProduit,
    activeTab, setActiveTab,
    lowStockCount, outOfStockCount,
    /* modals */
    isCreateOpen, setIsCreateOpen,
    isEditOpen, setIsEditOpen,
    isAdjustOpen, setIsAdjustOpen,
    isPasswordOpen, setIsPasswordOpen,
    passwordConfig, setPasswordConfig,
    isImportOpen, setIsImportOpen,
    showSalesModal, setShowSalesModal, selectedFacture, setSelectedFacture, loadingFacture,
    showAvoirModal, setShowAvoirModal, selectedAvoirId, setSelectedAvoirId,
    pendingActionRef,
    /* forms */
    editForm, createInitialData, adjustForm, setAdjustForm, adjustStockMutation, transferLoading,
    labelProduct, setLabelProduct, transferProduct, setTransferProduct,
    /* handlers */
    handleDelete, handleStockAdjustmentSubmit, handleOpenAdjust, handleOpenCreate,
    handleToggleActive, handleGenerateLabels,
    handleTransferToRayon, confirmTransferToRayon,
    handleMovementClick, handleOpenEdit,
    queryClient,
  }
}
