import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters'
import type { LigneFacture, ProduitModel } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-hot-toast'

interface CartTableProps {
  lignesFacture: LigneFacture[]
  updateQuantite: (produitId: number, quantite: number) => void
  updatePrix: (produitId: number, prix: string) => void
  updateRemiseProduit: (produitId: number, remise: string) => void
  updateTreatmentDuration?: (produitId: number, duration: number) => void
  removeLigne: (produitId: number) => void
  onOpenLotModal: (product: ProduitModel, currentLotId: string | null) => void
  quantityInputsRef: React.MutableRefObject<Map<number, HTMLInputElement>>
  onReturnFocus: () => void
  selectedIndex?: number
  onSelectLine?: (index: number) => void
}

interface CartRowProps {
  ligne: LigneFacture
  index: number
  selectedIndex: number
  onSelectLine?: (index: number) => void
  updateQuantite: (produitId: number, quantite: number) => void
  updatePrix: (produitId: number, prix: string) => void
  updateRemiseProduit: (produitId: number, remise: string) => void
  updateTreatmentDuration?: (produitId: number, duration: number) => void
  removeLigne: (produitId: number) => void
  onOpenLotModal: (product: ProduitModel, currentLotId: string | null) => void
  quantityInputsRef: React.MutableRefObject<Map<number, HTMLInputElement>>
  onReturnFocus: () => void
  canModifyPrice: boolean
  maxDiscount: number
  t: (key: string, options?: any) => string
}

const CartRow = React.memo(({
  ligne,
  index,
  selectedIndex,
  onSelectLine,
  updateQuantite,
  updatePrix,
  updateRemiseProduit,
  updateTreatmentDuration,
  removeLigne,
  onOpenLotModal,
  quantityInputsRef,
  onReturnFocus,
  canModifyPrice,
  maxDiscount,
  t
}: CartRowProps) => {
  const [localQty, setLocalQty] = React.useState(ligne.quantite.toString())
  const [localPrice, setLocalPrice] = React.useState(ligne.prix_unitaire)
  const [localRemise, setLocalRemise] = React.useState(ligne.remise_produit)

  // Sync local states when external state changes (shortcuts, barcode, etc.)
  React.useEffect(() => {
    setLocalQty(ligne.quantite.toString())
    setLocalPrice(ligne.prix_unitaire)
    setLocalRemise(ligne.remise_produit)
  }, [ligne.quantite, ligne.prix_unitaire, ligne.remise_produit])

  const handleQtyChange = (value: string) => {
    // Regex: allow only digits and a single minus sign at the very beginning
    const filteredValue = value.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '')
    setLocalQty(filteredValue)

    // Only update parent if it's a valid number and not just a "-" sign
    const numValue = normalizeNumberInput(filteredValue)
    if (!isNaN(numValue) && (filteredValue !== '-' || numValue !== 0)) {
      updateQuantite(ligne.produit.id, numValue)
    }
  }

  const handlePriceSubmit = () => {
    if (localPrice !== ligne.prix_unitaire) {
      updatePrix(ligne.produit.id, localPrice)
    }
  }

  const handleRemiseSubmit = () => {
    const numValue = normalizeNumberInput(localRemise)
    if (!isNaN(numValue) && numValue > maxDiscount) {
      toast.error(t('facturation.messages.discount_limit_error', { rate: maxDiscount }))
      setLocalRemise(String(maxDiscount))
      updateRemiseProduit(ligne.produit.id, String(maxDiscount))
    } else if (localRemise !== ligne.remise_produit) {
      updateRemiseProduit(ligne.produit.id, localRemise || '0')
    }
  }

  const isReturn = normalizeNumberInput(ligne.quantite) < 0

  return (
    <tr
      className={`hover:bg-base-50/50 group border-b border-base-100 last:border-0 cursor-pointer transition-colors duration-150 
        ${index === selectedIndex ? '!bg-blue-500/20 border-l-4 border-l-primary' : ''}
        ${isReturn ? 'bg-red-50 text-red-600 font-semibold' : ''}`}
      ref={index === selectedIndex ? (el) => el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) : null}
      onClick={() => onSelectLine?.(index)}
    >
      <td className="pl-2 md:pl-4 py-1">
        <div className={`font-medium ${ligne.produit.is_deleted ? 'italic' : ''}`}>
          {ligne.produit.name}
          {ligne.produit.is_deleted && <span className="text-xs ml-2 opacity-75">(Supprimé)</span>}
          {ligne.produit.is_chronic && (
            <div className="flex items-center gap-2 mt-1">
              <span className="badge badge-success badge-xs gap-1 py-1.5 px-2">
                 <span className="text-[10px]">Chronique</span>
              </span>
              <div className="flex items-center gap-1 border rounded px-1.5 bg-success/5 border-success/20">
                <span className="text-[10px] opacity-60">Traitement:</span>
                <input 
                   type="number"
                   className="w-8 bg-transparent text-[10px] font-bold outline-none"
                    value={ligne.treatment_duration_days || ''}
                    onChange={(e) => updateTreatmentDuration?.(ligne.produit.id, normalizeNumberInput(e.target.value) || 0)}
                    min={1}
                />
                <span className="text-[10px] opacity-60">j</span>
              </div>
            </div>
          )}
        </div>
      </td>
      <td className="text-right py-1">
        <input
          ref={(el) => {
            if (el) quantityInputsRef.current.set(ligne.produit.id, el)
            else quantityInputsRef.current.delete(ligne.produit.id)
          }}
          type="text"
          value={localQty}
          onChange={(e) => handleQtyChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onReturnFocus()
            }
          }}
          className="input input-ghost input-xs sm:input-sm w-full text-right font-medium focus:bg-base-100 focus:text-primary min-h-[32px] sm:min-h-0"
        />
      </td>
      <td className="text-right py-1">
        <input
          type="text"
          value={localPrice}
          onChange={(e) => setLocalPrice(e.target.value.replace(/[^0-9.]/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handlePriceSubmit()
              onReturnFocus()
            }
          }}
          className={`input input-ghost input-xs sm:input-sm w-full text-right focus:bg-base-100 focus:text-primary min-h-[32px] sm:min-h-0 ${!canModifyPrice ? 'opacity-70 cursor-not-allowed' : ''}`}
          disabled={!canModifyPrice}
          title={!canModifyPrice ? t('facturation.messages.price_modification_forbidden') : ""}
        />
      </td>
      <td className="text-right py-1 hidden lg:table-cell">
        <input
          type="text"
          value={localRemise}
          onChange={(e) => setLocalRemise(e.target.value.replace(/[^0-9.]/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleRemiseSubmit()
              onReturnFocus()
            }
          }}
          className="input input-ghost input-xs w-full text-right focus:bg-base-100 focus:text-primary"
          placeholder="%"
        />
      </td>
      <td className="text-center py-1 hidden md:table-cell">
        <div className={`font-mono font-bold ${
          (ligne.produit.stock ?? 0) <= 0 ? 'text-error' :
          (ligne.produit.stock ?? 0) < 5 ? 'text-warning' : 'text-success'
        }`}>
          {ligne.produit.stock ?? 0}
        </div>
      </td>
      <td className="text-center py-1 hidden md:table-cell">
        <button
          className={`btn btn-xs ${ligne.lotId ? 'btn-primary' : 'btn-ghost text-base-content/50'} w-full max-w-[80px] truncate`}
          onClick={() => onOpenLotModal(ligne.produit, ligne.lotId || null)}
          title={ligne.lotId ? `Lot: ${ligne.lotText}` : "Lot: Automatique (FEFO)"}
        >
          {ligne.lotId ? ligne.lotText : 'Auto'}
        </button>
      </td>
      <td className="text-right font-medium text-base-content pr-2 md:pr-4 py-1">
        {formatCurrency(normalizeNumberInput(ligne.total_ligne))}
      </td>
      <td className="text-center py-1">
        <button
          onClick={() => removeLigne(ligne.produit.id)}
          className="btn btn-ghost btn-xs text-error/50 hover:text-error btn-square sm:opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <span className="sr-only">{t('facturation.cart.actions.remove')}</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </td>
    </tr>
  )
})

export default function CartTable({
  lignesFacture,
  updateQuantite,
  updatePrix,
  updateRemiseProduit,
  updateTreatmentDuration,
  removeLigne,
  onOpenLotModal,
  quantityInputsRef,
  onReturnFocus,
  selectedIndex = -1,
  onSelectLine
}: CartTableProps) {
  const { user } = useAuth()
  const { t } = useTranslation()

  // Permission Checks
  const canModifyPrice = user?.is_superuser || user?.profile?.can_modify_price
  const maxDiscount = user?.is_superuser ? 100 : (normalizeNumberInput(user?.profile?.max_discount_rate || 0))

  if (lignesFacture.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-base-content/30 gap-4 min-h-[200px]">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p className="font-light">{t('facturation.cart.empty')}</p>
      </div>
    )
  }

  return (
    <table className="table table-pin-rows table-sm w-full">
      <thead>
        <tr className="bg-base-50 uppercase tracking-wider text-base-content/60 font-semibold border-b border-base-200">
          <th className="bg-base-50 pl-2 md:pl-4 min-w-[120px]">{t('facturation.cart.headers.product')}</th>
          <th className="bg-base-50 text-right w-12 sm:w-20">{t('facturation.cart.headers.qty')}</th>
          <th className="bg-base-50 text-right w-16 sm:w-24">{t('facturation.cart.headers.price')}</th>
          <th className="bg-base-50 text-right w-14 md:w-16 hidden lg:table-cell">{t('facturation.cart.headers.discount')}</th>
          <th className="bg-base-50 text-center w-24 hidden md:table-cell">{t('facturation.cart.headers.stock')}</th>
          <th className="bg-base-50 text-center w-16 sm:w-20 hidden md:table-cell">{t('facturation.cart.headers.lot')}</th>
          <th className="bg-base-50 text-right w-18 sm:w-28 pr-2 md:pr-4">{t('facturation.cart.headers.total')}</th>
          <th className="bg-base-50 w-8"></th>
        </tr>
      </thead>
      <tbody>
        {lignesFacture.map((ligne, index) => (
          <CartRow
            key={ligne.produit.id}
            ligne={ligne}
            index={index}
            selectedIndex={selectedIndex}
            onSelectLine={onSelectLine}
            updateQuantite={updateQuantite}
            updatePrix={updatePrix}
            updateRemiseProduit={updateRemiseProduit}
            updateTreatmentDuration={updateTreatmentDuration}
            removeLigne={removeLigne}
            onOpenLotModal={onOpenLotModal}
            quantityInputsRef={quantityInputsRef}
            onReturnFocus={onReturnFocus}
            canModifyPrice={!!canModifyPrice}
            maxDiscount={maxDiscount}
            t={t}
          />
        ))}
      </tbody>
    </table>
  )
}
