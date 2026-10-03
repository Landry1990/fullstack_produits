import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Plus, Minus, Trash2, User, ShoppingCart, Send, Pencil } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCaisseSession } from '../hooks/caisse/useCaisseSession'
import { useProductSearch } from '../hooks/useProductSearch'
import { useCart } from '../hooks/useCart'
import { useFacturationClients } from '../hooks/useFacturationClients'
import { useSudo } from '../hooks/useSudo'
import { useSecureCartOperations } from '../hooks/useSecureCartOperations'
import useSaleCompletion from '../hooks/useSaleCompletion'
import SudoValidationModal from './common/SudoValidationModal'
import { gooeyToast } from 'goey-toast'
import { calculateCartStats, calculateFactureTotals } from '../utils/finance'
import { getApiErrorDetail } from '../utils/errorHandling'
import type { ProduitModel } from '../types'

const formatAmount = (value: number | string) =>
  Number(value || 0).toLocaleString('fr-FR')

export default function VenteTablette() {
  const { t } = useTranslation(['sales', 'facturation', 'common'])
  const { user } = useAuth()
  const { myActivePoste } = useCaisseSession()
  const [showClientSelector, setShowClientSelector] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [remiseGlobale, setRemiseGlobale] = useState('0')
  const [remiseMode, setRemiseMode] = useState<'taux' | 'montant'>('taux')
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState('')
  const [remiseSudoCreds, setRemiseSudoCreds] = useState<{ validatorId: number; password: string } | null>(null)
  const [prixSudoCreds, setPrixSudoCreds] = useState<{ validatorId: number; password: string } | null>(null)
  const { sudoState, requireSudo, closeSudo } = useSudo()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const cartRef = useRef<HTMLDivElement>(null)

  const clientsHook = useFacturationClients()
  const {
    clients,
    selectedClient,
    selectedClientData,
    setSelectedClient,
    useManualClient,
    setUseManualClient,
    manualClientName,
    setManualClientName,
    showNewAyantDroit,
    setShowNewAyantDroit,
    ayantDroitNom,
    setAyantDroitNom,
    ayantDroitMatricule,
    setAyantDroitMatricule,
  } = clientsHook

  const cart = useCart({
    onForceStock: (produit) => {
      // En tablette on force l'ajout ; le backend fera une vérification stock temps réel à la finalisation
      cart.addProduit(produit, { forceStock: true })
    },
  })

  const maxDiscountRate = user?.is_superuser ? 100 : Number(user?.profile?.max_discount_rate || 0)
  const { secureUpdatePrix, secureSetRemiseGlobale } = useSecureCartOperations({
    cart,
    requireSudo,
    setRemiseSudoCreds,
    remiseSudoCreds,
    setPrixSudoCreds,
    prixSudoCreds,
    t,
    triggerUiRefresh: () => setEditingPriceId(null),
    maxDiscountRate,
  })

  const productSearch = useProductSearch({
    minSearchLength: 2,
    pageSize: 8,
    onBarcodeMatch: (produit) => {
      handleAddProduct(produit)
    },
  })

  const handleAddProduct = useCallback(
    async (produit: ProduitModel) => {
      await cart.addProduit(produit, { forceStock: true })
      productSearch.setSearchQuery('')
      if (searchInputRef.current) {
        searchInputRef.current.focus()
      }
    },
    [cart, productSearch]
  )

  const cartStats = useMemo(() => calculateCartStats(cart.lignesFacture), [cart.lignesFacture])
  const totals = useMemo(
    () => calculateFactureTotals(cartStats, selectedClientData, remiseGlobale, remiseMode),
    [cartStats, selectedClientData, remiseGlobale, remiseMode]
  )

  const { completeSale, loading: submitLoading } = useSaleCompletion({
    onSuccess: () => {
      cart.clearCart()
      setClientSearch('')
      setRemiseGlobale('0')
      setRemiseSudoCreds(null)
      setPrixSudoCreds(null)
      setEditingPriceId(null)
      gooeyToast.success(t('sales:messages.success', { defaultValue: 'Vente enregistrée' }))
    },
    onError: (err) => {
      gooeyToast.error(err)
    },
  })

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase()
    if (!query) return clients.slice(0, 8)
    return clients
      .filter((c) => c.name.toLowerCase().includes(query) || (c.phone || '').toLowerCase().includes(query))
      .slice(0, 8)
  }, [clients, clientSearch])

  const handleSelectClient = useCallback(
    (clientId: number | null, isManual = false, manualName = '') => {
      if (isManual) {
        setUseManualClient(true)
        setManualClientName(manualName)
        setSelectedClient(null)
      } else {
        setUseManualClient(false)
        setSelectedClient(clientId)
      }
      setShowNewAyantDroit(false)
      setAyantDroitNom('')
      setAyantDroitMatricule('')
      setShowClientSelector(false)
      setClientSearch('')
    },
    [setSelectedClient, setUseManualClient, setManualClientName, setShowNewAyantDroit, setAyantDroitNom, setAyantDroitMatricule]
  )

  const handleValidate = useCallback(async () => {
    if (!myActivePoste) {
      gooeyToast.error(t('sales:messages.no_active_cash_register', { defaultValue: 'Aucun point de vente actif' }))
      return
    }
    if (cart.lignesFacture.length === 0) return

    const selectedClientObj = selectedClientData
    if (selectedClientObj?.client_type === 'PROFESSIONNEL') {
      setShowNewAyantDroit(true)
      if (!ayantDroitNom.trim() || !ayantDroitMatricule.trim()) {
        gooeyToast.error(
          t('facturation:validation.pro_client_beneficiary_info', {
            defaultValue: "Renseignez le nom et le matricule de l'ayant droit",
          })
        )
        return
      }
    }

    await completeSale({
      selectedClient,
      useManualClient,
      manualClientName,
      clients,
      selectedAyantDroit: null,
      ayantDroitNom,
      ayantDroitMatricule,
      ayantDroitSociete: '',
      ayantsDroitList: [],
      showNewAyantDroit,
      lignesFacture: cart.lignesFacture,
      totals,
      modePaiement: 'especes',
      montantPaye: totals.totalTtc.toString(),
      paiements: [],
      reference: '',
      couponNumero: '',
      usePendingDiscount: false,
      pointsToUse: 0,
      isRetrocession: false,
      centralizedCashRegister: true,
      isModificationMode: false,
      modificationInvoiceId: null,
      devisIdToValidate: null,
      tempOrdonnanceData: null,
      poste_vente_id: myActivePoste.id,
      isFactureA4: false,
      remise_validated_by_id: remiseSudoCreds?.validatorId || null,
      remise_validated_password: remiseSudoCreds?.password || undefined,
      prix_validated_by_id: prixSudoCreds?.validatorId || null,
      prix_validated_password: prixSudoCreds?.password || undefined,
    })
  }, [
    myActivePoste,
    cart.lignesFacture,
    selectedClient,
    selectedClientData,
    useManualClient,
    manualClientName,
    clients,
    ayantDroitNom,
    ayantDroitMatricule,
    showNewAyantDroit,
    totals,
    completeSale,
    remiseSudoCreds,
    prixSudoCreds,
    setShowNewAyantDroit,
    t,
  ])

  // Scroll panier vers le bas quand on ajoute un produit
  useEffect(() => {
    if (cartRef.current && cart.lignesFacture.length > 0) {
      cartRef.current.scrollTop = cartRef.current.scrollHeight
    }
  }, [cart.lignesFacture.length])

  if (!myActivePoste) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 p-6">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <ShoppingCart className="mx-auto mb-6 size-16 text-emerald-600" />
          <h1 className="text-3xl font-bold text-slate-800">{t('sales:tablet.no_session', { defaultValue: 'Point de vente fermé' })}</h1>
          <p className="mt-4 text-xl text-slate-600">
            {t('sales:tablet.open_session_first', { defaultValue: 'Ouvrez un point de vente depuis la caisse centrale' })}
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col bg-slate-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t('sales:tablet.title', { defaultValue: 'Vente tablette' })}</h1>
          <p className="text-sm text-slate-500">
            {myActivePoste.nom} • {cart.lignesFacture.length} {t('sales:tablet.items', { defaultValue: 'article(s)' })}
          </p>
        </div>
        <button
          type="button"
          onClick={cart.clearCart}
          disabled={cart.lignesFacture.length === 0 || cart.loading}
          className="flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 font-semibold text-red-600 disabled:opacity-40"
        >
          <Trash2 className="size-5" />
          {t('common:cancel', { defaultValue: 'Annuler' })}
        </button>
      </header>

      {/* Recherche produit */}
      <section className="border-b border-slate-200 bg-white p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 size-6 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={productSearch.searchQuery}
            onChange={(e) => productSearch.setSearchQuery(e.target.value)}
            placeholder={t('common:search_product_placeholder', { defaultValue: 'Rechercher un produit...' })}
            className="h-14 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 pl-14 pr-4 text-lg text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20"
            autoFocus
          />
          {productSearch.loading && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              {t('common:loading', { defaultValue: 'Chargement...' })}
            </span>
          )}
        </div>

        {productSearch.searchQuery.trim().length >= 2 && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {productSearch.produits.length === 0 && !productSearch.loading ? (
              <p className="col-span-full rounded-xl border border-dashed border-slate-300 p-4 text-center text-slate-500">
                {t('common:no_results', { defaultValue: 'Aucun résultat' })}
              </p>
            ) : (
              productSearch.produits.slice(0, 6).map((produit) => (
                <button
                  key={produit.id}
                  type="button"
                  onClick={() => handleAddProduct(produit)}
                  disabled={cart.loading}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.99] active:bg-emerald-50"
                >
                  <span className="line-clamp-2 font-semibold text-slate-800">{produit.name}</span>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500">{produit.cip1 || produit.cip2 || '—'}</span>
                    <span className="font-bold text-emerald-600">{formatAmount(produit.selling_price)} F</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Stock : {produit.stock ?? 0}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </section>

      {/* Panier */}
      <section ref={cartRef} className="flex-1 overflow-y-auto p-4">
        {cart.lignesFacture.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 text-slate-400">
            <ShoppingCart className="mb-4 size-16" />
            <p className="text-lg">{t('sales:tablet.empty_cart', { defaultValue: 'Ajoutez des produits pour commencer' })}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.lignesFacture.map((ligne) => (
              <div
                key={ligne.lineId}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{ligne.produit.name}</p>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    {editingPriceId === ligne.lineId ? (
                      <input
                        type="number"
                        min="0"
                        inputMode="decimal"
                        autoFocus
                        value={editingPrice}
                        onChange={(e) => setEditingPrice(e.target.value)}
                        onBlur={() => {
                          if (editingPrice.trim() && Number(editingPrice) >= 0) {
                            secureUpdatePrix(ligne.lineId, editingPrice)
                          }
                          setEditingPriceId(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                          if (e.key === 'Escape') setEditingPriceId(null)
                        }}
                        className="h-9 w-24 rounded-lg border border-emerald-400 px-2 text-slate-800 outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPriceId(ligne.lineId)
                          setEditingPrice(String(ligne.prix_unitaire))
                        }}
                        className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 font-medium text-slate-600 active:bg-emerald-50"
                      >
                        {formatAmount(ligne.prix_unitaire)} F
                        <Pencil className="size-3.5 text-slate-400" />
                      </button>
                    )}
                    {ligne.lotText ? <span>• Lot {ligne.lotText}</span> : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => cart.updateQuantite(ligne.lineId, ligne.quantite - 1)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 active:bg-slate-100"
                  >
                    <Minus className="size-5" />
                  </button>
                  <span className="min-w-[2rem] text-center text-lg font-bold text-slate-800">{ligne.quantite}</span>
                  <button
                    type="button"
                    onClick={() => cart.updateQuantite(ligne.lineId, ligne.quantite + 1)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 active:bg-slate-100"
                  >
                    <Plus className="size-5" />
                  </button>
                </div>

                <div className="min-w-[5rem] text-right">
                  <p className="font-bold text-emerald-600">{formatAmount(ligne.total_ligne)} F</p>
                </div>

                <button
                  type="button"
                  onClick={() => cart.removeLigne(ligne.lineId)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-red-500 active:bg-red-50"
                >
                  <Trash2 className="size-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Client + total + valider */}
      <footer className="border-t border-slate-200 bg-white p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {/* Sélection client */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowClientSelector((s) => !s)}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <User className="size-6 text-slate-400" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('common:client', { defaultValue: 'Client' })}</p>
                <p className="font-semibold text-slate-800">
                  {useManualClient
                    ? manualClientName || t('common:passerby_client', { defaultValue: 'Client de passage' })
                    : selectedClientData?.name || t('common:passerby_client', { defaultValue: 'Client de passage' })}
                </p>
              </div>
            </div>
            <span className="text-sm font-semibold text-emerald-600">{t('common:change', { defaultValue: 'Modifier' })}</span>
          </button>

          {showClientSelector && (
            <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder={t('common:search', { defaultValue: 'Rechercher...' })}
                  className="h-12 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-slate-800 outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => handleSelectClient(null, true, '')}
                  className={`w-full rounded-xl px-3 py-3 text-left font-medium ${
                    useManualClient ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t('common:passerby_client', { defaultValue: 'Client de passage' })}
                </button>
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleSelectClient(client.id)}
                    className={`w-full rounded-xl px-3 py-3 text-left font-medium ${
                      selectedClient === client.id && !useManualClient
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {client.name}
                    {client.phone ? <span className="ml-2 text-sm text-slate-400">{client.phone}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ayant droit pour client PRO */}
          {selectedClientData?.client_type === 'PROFESSIONNEL' && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <input
                type="text"
                value={ayantDroitNom}
                onChange={(e) => {
                  setAyantDroitNom(e.target.value)
                  setShowNewAyantDroit(true)
                }}
                placeholder={t('facturation:client.beneficiary_name', { defaultValue: "Nom de l'ayant droit" })}
                className="h-12 rounded-xl border border-slate-200 px-4 text-slate-800 outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={ayantDroitMatricule}
                onChange={(e) => {
                  setAyantDroitMatricule(e.target.value)
                  setShowNewAyantDroit(true)
                }}
                placeholder={t('facturation:client.beneficiary_matricule', { defaultValue: "Matricule de l'ayant droit" })}
                className="h-12 rounded-xl border border-slate-200 px-4 text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>
          )}
        </div>

        {/* Remise globale */}
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-500">
            {t('facturation:totals.discount', { defaultValue: 'Remise globale' })}
          </label>
          <div className="flex flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <input
              type="number"
              min="0"
              inputMode="decimal"
              value={remiseGlobale === '0' ? '' : remiseGlobale}
              onChange={(e) => {
                const v = e.target.value
                if (!v || Number(v) <= 0) {
                  setRemiseGlobale('0')
                } else {
                  secureSetRemiseGlobale(v, remiseMode, cartStats.totalTTC, setRemiseGlobale)
                }
              }}
              placeholder="0"
              className="h-12 w-full bg-transparent px-4 text-lg font-semibold text-slate-800 outline-none"
            />
            <button
              type="button"
              onClick={() => setRemiseMode((m) => (m === 'taux' ? 'montant' : 'taux'))}
              className="border-l border-slate-200 bg-white px-4 font-bold text-emerald-600 active:bg-emerald-50"
            >
              {remiseMode === 'taux' ? '%' : 'F'}
            </button>
          </div>
          {totals.remiseMontant > 0 && (
            <span className="whitespace-nowrap font-bold text-emerald-600">
              −{formatAmount(totals.remiseMontant)} F
            </span>
          )}
        </div>

        {/* Total + valider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 rounded-2xl bg-slate-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('common:total', { defaultValue: 'Total' })}</p>
            <p className="text-3xl font-bold text-emerald-600">{formatAmount(totals.totalTtc)} F</p>
          </div>
          <button
            type="button"
            onClick={handleValidate}
            disabled={cart.lignesFacture.length === 0 || submitLoading || cart.loading}
            className="flex h-24 flex-1 items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-6 text-xl font-bold text-white shadow-lg transition hover:bg-emerald-700 disabled:bg-slate-300 disabled:shadow-none"
          >
            {submitLoading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block size-6 animate-spin rounded-full border-2 border-white border-b-transparent" />
                {t('common:loading', { defaultValue: 'Envoi...' })}
              </span>
            ) : (
              <>
                <Send className="size-6" />
                {t('sales:tablet.send_to_cashier', { defaultValue: 'Envoyer en caisse' })}
              </>
            )}
          </button>
        </div>
      </footer>

      <SudoValidationModal
        isOpen={sudoState.isOpen}
        onClose={closeSudo}
        onValidate={sudoState.onValidate}
        saving={sudoState.isValidating}
        title={sudoState.title}
        message={sudoState.message}
        permission={sudoState.permission}
      />
    </main>
  )
}
