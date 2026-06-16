import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters'
import type { LigneFacture, ProduitModel } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-hot-toast'
import { Button } from '../shadcn/button'
import { Badge } from '../shadcn/badge'
import { Tag, X, Package, Trash2, ShoppingCart } from 'lucide-react'

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
  refreshTrigger?: number
  isSidebarStyle?: boolean
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
  refreshTrigger?: number
  isSidebarStyle?: boolean
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
  t,
  refreshTrigger,
  isSidebarStyle
}: CartRowProps) => {
  const [localQty, setLocalQty] = React.useState(() => ligne.quantite.toString())
  const [localPrice, setLocalPrice] = React.useState(() => ligne.prix_unitaire)
  const [localRemise, setLocalRemise] = React.useState(() => ligne.remise_produit)

  // Sync local states when external state changes (shortcuts, barcode, etc.)
  React.useEffect(() => {
    setLocalQty(ligne.quantite.toString())
    setLocalPrice(ligne.prix_unitaire)
    setLocalRemise(ligne.remise_produit)
  }, [ligne.quantite, ligne.prix_unitaire, ligne.remise_produit, refreshTrigger])

  const handleQtyChange = (value: string) => {
    // Regex: allow only digits and a single minus sign at the very beginning
    const filteredValue = value.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '')
    setLocalQty(filteredValue)
    // Ne PAS mettre à jour le parent ici — attendre la confirmation (Entrée / blur)
  }

  const handleQtySubmit = () => {
    const numValue = normalizeNumberInput(localQty)
    if (!isNaN(numValue) && numValue !== 0) {
      updateQuantite(ligne.produit.id, numValue)
    } else if (localQty === '' || localQty === '0') {
      // Si l'utilisateur efface ou met 0, remettre à 1
      setLocalQty(ligne.quantite.toString())
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
      toast.error(t('facturation:messages.discount_limit_error', { rate: maxDiscount }))
      setLocalRemise(String(maxDiscount))
      updateRemiseProduit(ligne.produit.id, String(maxDiscount))
    } else if (localRemise !== ligne.remise_produit) {
      updateRemiseProduit(ligne.produit.id, localRemise || '0')
    }
  }

  const isReturn = normalizeNumberInput(ligne.quantite) < 0

  if (isSidebarStyle) {
    return (
      <div
        onClick={() => onSelectLine?.(index)}
        className={`group relative flex flex-col p-3 border-b border-slate-100 transition-all duration-200 cursor-pointer
          ${index === selectedIndex ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'hover:bg-slate-50'}
          ${isReturn ? 'bg-red-50' : ''}`}
      >
        {/* Ligne Haut: Nom Produit + Total + Action */}
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
             <div className="flex items-center gap-1.5">
               <h4 className={`text-sm font-semibold truncate leading-tight ${isReturn ? 'text-red-600' : 'text-slate-800'}`} title={ligne.produit.name}>
                 {ligne.produit.name}
               </h4>
               {ligne.isPromis && <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-amber-100 text-amber-700 border-amber-200">PROMIS</Badge>}
             </div>
             {ligne.produit.stock !== undefined && (
                <div className={`text-[10px] leading-none mt-1 ${ligne.produit.stock <= 0 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                  Stock: {ligne.produit.stock}
                </div>
             )}
          </div>

          <div className="flex items-start shrink-0 gap-2">
             <span className="text-sm font-bold text-slate-900 font-mono whitespace-nowrap">
                {formatCurrency(normalizeNumberInput(ligne.total_ligne))}
             </span>
             <Button
               variant="ghost"
               size="icon"
               onClick={(e) => { e.stopPropagation(); removeLigne(ligne.produit.id); }}
               className="size-7 text-slate-300 hover:text-red-500 hover:bg-red-50 lg:opacity-0 lg:group-hover:opacity-100 transition-all"
             >
               <X className="size-4" />
             </Button>
          </div>
        </div>

        {/* Ligne Bas: Block (Qté x Prix) + Bouton Lot */}
        <div className="flex items-center gap-2 mt-2">
           {/* Combo Input Qté + Prix Unitaire + Remise */}
           <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg focus-within:border-emerald-300 focus-within:ring-1 focus-within:ring-emerald-100 overflow-hidden transition-all">
             <input
               ref={(el) => {
                 if (el) quantityInputsRef.current.set(ligne.produit.id, el)
                 else quantityInputsRef.current.delete(ligne.produit.id)
               }}
               type="text"
               inputMode="numeric"
               value={localQty}
               onChange={(e) => handleQtyChange(e.target.value)}
               onBlur={handleQtySubmit}
               onKeyDown={(e) => {
                 if (e.key === 'Enter') {
                   e.preventDefault()
                   handleQtySubmit()
                   onReturnFocus()
                 }
               }}
               className="w-12 h-9 bg-transparent px-1 text-xs text-center font-semibold text-slate-700 focus:bg-white focus:outline-none"
             />
             <div className="flex items-center h-9 px-1.5 bg-slate-50 border-l border-slate-200 text-[10px] font-semibold text-slate-400">
                <span className="mr-1">×</span>
                <input
                   type="text"
                   inputMode="decimal"
                   value={localPrice}
                   onChange={(e) => setLocalPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                   onBlur={handlePriceSubmit}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                       e.preventDefault()
                       handlePriceSubmit()
                       onReturnFocus()
                     }
                   }}
                   disabled={!canModifyPrice}
                   className={`w-16 bg-transparent text-left font-semibold border-none focus:outline-none focus:text-slate-800 ${!canModifyPrice ? 'text-slate-400 cursor-not-allowed' : 'text-slate-600'}`}
                   title={!canModifyPrice ? t('facturation:messages.price_modification_forbidden') : t('facturation:cart.edit_price')}
                />
             </div>
             {/* Champ de Remise */}
             <div className="flex items-center h-9 px-1.5 bg-amber-50 border-l border-amber-200 text-[10px] w-14 focus-within:bg-amber-100">
                <span className="text-amber-500 font-bold mr-0.5">-</span>
                <input
                   type="text"
                   inputMode="decimal"
                   value={localRemise}
                   onChange={(e) => setLocalRemise(e.target.value.replace(/[^0-9.]/g, ''))}
                   onBlur={handleRemiseSubmit}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                       e.preventDefault()
                       handleRemiseSubmit()
                       onReturnFocus()
                     }
                   }}
                   className="w-full bg-transparent text-left font-semibold text-amber-600 focus:text-amber-700 focus:outline-none placeholder-amber-300"
                   placeholder="Rem."
                   title={t('facturation:cart.discount_amount')}
                />
             </div>
           </div>

           {/* Bouton Lot FEFO condensé */}
           <Button
             variant="outline"
             size="sm"
             onClick={(e) => { e.stopPropagation(); onOpenLotModal(ligne.produit, ligne.lotId || null); }}
             className={`h-9 px-2 text-[11px] font-semibold uppercase transition-colors shrink gap-1.5
               ${ligne.lotId ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300' : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200 hover:text-slate-600'}`}
             title={ligne.lotId ? `Lot : ${ligne.lotText}` : "Géré en Auto FEFO"}
           >
             <Tag className="size-3 shrink-0" />
             <span className="truncate max-w-[140px] tracking-wide">{ligne.lotId ? ligne.lotText : 'AUTO'}</span>
           </Button>
        </div>
      </div>
    )

  }

  return (
    <tr
      className={`hover:bg-slate-50/50 group border-b border-slate-100 last:border-0 cursor-pointer transition-colors duration-150
        ${index === selectedIndex ? '!bg-emerald-50/70 border-l-4 border-l-emerald-500 shadow-sm' : ''}
        ${isReturn ? 'bg-red-50 text-red-600 font-semibold' : ''}`}
      ref={index === selectedIndex ? (el) => el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) : null}
      onClick={() => onSelectLine?.(index)}
    >
      <td className="pl-2 md:pl-4 py-2">
        <div className={`font-medium ${ligne.produit.is_deleted ? 'italic' : ''}`}>
          <div className="flex items-center gap-2">
            <span className="truncate text-slate-800">{ligne.produit.name}</span>
            {ligne.isPromis && (
              <Badge variant="secondary" className="text-[10px] h-5 bg-amber-100 text-amber-700 border-amber-200 animate-pulse shrink-0">
                PROMIS
              </Badge>
            )}
          </div>
          {ligne.produit.is_deleted && <span className="text-xs ml-2 opacity-75 text-red-500">{t('facturation:cart.product_status.deleted')}</span>}
          {ligne.produit.is_chronic && (
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" className="text-[10px] h-5 bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
               <span>{t('facturation:cart.product_status.chronic')}</span>
              </Badge>
              <div className="flex items-center gap-1 border border-emerald-200 rounded px-1.5 bg-emerald-50">
                <span className="text-[10px] text-emerald-600">{t('facturation:cart.product_status.treatment')}</span>
                <input
                   type="number"
                   className="w-8 bg-transparent text-[10px] font-semibold text-emerald-700 outline-none"
                    value={ligne.treatment_duration_days || ''}
                    onChange={(e) => updateTreatmentDuration?.(ligne.produit.id, normalizeNumberInput(e.target.value) || 0)}
                    min={1}
                />
                <span className="text-[10px] text-emerald-600">{t('facturation:cart.product_status.days_unit')}</span>
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
          onBlur={handleQtySubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleQtySubmit()
              onReturnFocus()
            }
          }}
          className="w-full text-right font-medium text-sm bg-transparent border border-slate-200 rounded px-2 py-1 focus:bg-white focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-100 min-h-[32px] sm:min-h-0"
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
          className={`w-full text-right font-medium text-sm bg-transparent border border-slate-200 rounded px-2 py-1 focus:bg-white focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-100 min-h-[32px] sm:min-h-0 ${!canModifyPrice ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700'}`}
          disabled={!canModifyPrice}
          title={!canModifyPrice ? t('facturation:messages.price_modification_forbidden') : ""}
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
          className="w-full text-right font-medium text-sm bg-transparent border border-slate-200 rounded px-2 py-1 focus:bg-white focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-100 text-amber-600 placeholder-amber-300"
          placeholder="%"
        />
      </td>
      <td className="text-center py-2 hidden md:table-cell">
        <div className={`font-mono font-semibold ${
          (ligne.produit.stock ?? 0) <= 0 ? 'text-red-500' :
          (ligne.produit.stock ?? 0) < 5 ? 'text-amber-500' : 'text-emerald-600'
        }`}>
          {ligne.produit.stock ?? 0}
        </div>
      </td>
      <td className="text-center py-2 hidden md:table-cell">
        <Button
          variant={ligne.lotId ? 'default' : 'outline'}
          size="sm"
          onClick={() => onOpenLotModal(ligne.produit, ligne.lotId || null)}
          className={`w-full max-w-[80px] truncate text-xs h-7 ${ligne.lotId ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          title={ligne.lotId ? `${t('facturation:cart.headers.lot')}: ${ligne.lotText}` : `${t('facturation:cart.headers.lot')}: ${t('facturation:cart.product_status.auto_lot')} (FEFO)`}
        >
          {ligne.lotId ? ligne.lotText : t('facturation:cart.product_status.auto_lot')}
        </Button>
      </td>
      <td className="text-right font-semibold text-slate-800 pr-2 md:pr-4 py-2">
        {formatCurrency(normalizeNumberInput(ligne.total_ligne))}
      </td>
      <td className="text-center py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => removeLigne(ligne.produit.id)}
          className="size-7 text-slate-300 hover:text-red-500 hover:bg-red-50 sm:opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <span className="sr-only">{t('facturation:cart.actions.remove')}</span>
          <Trash2 className="size-3.5" />
        </Button>
      </td>
    </tr>
  )
})

const CartTable = React.memo(({
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
  onSelectLine,
  refreshTrigger,
  isSidebarStyle
}: CartTableProps) => {
  const { user } = useAuth()
  const { t } = useTranslation(['facturation', 'common'])

  // Permission Checks
  const canModifyPrice = user?.is_superuser || user?.profile?.can_modify_price
  const maxDiscount = user?.is_superuser ? 100 : (normalizeNumberInput(user?.profile?.max_discount_rate || 0))

  if (lignesFacture.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 min-h-[200px] text-slate-300">
        <ShoppingCart className="size-16" />
        <p className="font-light text-slate-400">{t('facturation:cart.empty')}</p>
      </div>
    )
  }

  if (isSidebarStyle) {
    return (
      <div className="flex flex-col">
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
            refreshTrigger={refreshTrigger}
            isSidebarStyle={true}
          />
        ))}
      </div>
    )
  }

  return (
    <table className="table table-pin-rows table-sm w-full">
      <thead className="sticky top-0 z-30 bg-slate-100">
        <tr className="bg-slate-100 uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200 text-xs">
          <th className="bg-slate-100 pl-2 md:pl-4 min-w-[120px] py-2">{t('facturation:cart.headers.product')}</th>
          <th className="bg-slate-100 text-right w-12 sm:w-20 py-2">{t('facturation:cart.headers.qty')}</th>
          <th className="bg-slate-100 text-right w-16 sm:w-24 py-2">{t('facturation:cart.headers.price')}</th>
          <th className="bg-slate-100 text-right w-14 md:w-16 hidden lg:table-cell py-2">{t('facturation:cart.headers.discount')}</th>
          <th className="bg-slate-100 text-center w-24 hidden md:table-cell py-2">{t('facturation:cart.headers.stock')}</th>
          <th className="bg-slate-100 text-center w-16 sm:w-20 hidden md:table-cell py-2">{t('facturation:cart.headers.lot')}</th>
          <th className="bg-slate-100 text-right w-18 sm:w-28 pr-2 md:pr-4 py-2">{t('facturation:cart.headers.total')}</th>
          <th className="bg-slate-100 w-8 py-2"></th>
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
            refreshTrigger={refreshTrigger}
          />
        ))}
      </tbody>
    </table>
  )
})

export default CartTable
