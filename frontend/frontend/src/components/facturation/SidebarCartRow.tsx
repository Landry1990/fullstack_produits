import React from 'react'
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters'
import type { LigneFacture, ProduitModel, LotAllocation } from '../../types'
import { Button } from '../shadcn/button'
import { Badge } from '../shadcn/badge'
import { Tag, X } from 'lucide-react'
import { useLotDisplay } from '../../hooks/useLotDisplay'
import { useCartRowState } from '../../hooks/useCartRowState'

export interface SidebarCartRowProps {
  ligne: LigneFacture
  index: number
  selectedIndex: number
  onSelectLine?: (index: number) => void
  updateQuantite: (produitId: number, quantite: number) => void
  updatePrix: (produitId: number, prix: string) => void
  updateRemiseProduit: (produitId: number, remise: string) => void
  removeLigne: (produitId: number) => void
  onOpenLotModal: (product: ProduitModel, currentLotId: string | null, quantity: number, currentAllocations: LotAllocation[] | null) => void
  quantityInputsRef: React.MutableRefObject<Map<number, HTMLInputElement>>
  onReturnFocus: () => void
  canModifyPrice: boolean
  maxDiscount: number
  t: (key: string, options?: unknown) => string
  refreshTrigger?: number
  flashId?: number | null
}

export default React.memo(function SidebarCartRow({
  ligne,
  index,
  selectedIndex,
  onSelectLine,
  updateQuantite,
  updatePrix,
  updateRemiseProduit,
  removeLigne,
  onOpenLotModal,
  quantityInputsRef,
  onReturnFocus,
  canModifyPrice,
  maxDiscount,
  t,
  refreshTrigger,
  flashId,
}: SidebarCartRowProps) {
  const {
    localQty,
    localPrice, setLocalPrice,
    localRemise, setLocalRemise,
    handleQtyChange, handleQtyStep, handleQtySubmit,
    handlePriceSubmit, handleRemiseSubmit,
    isReturn,
  } = useCartRowState({ ligne, updateQuantite, updatePrix, updateRemiseProduit, maxDiscount, t, refreshTrigger })

  const { lotDisplayText, lotTooltip } = useLotDisplay({ ligne, t })

  return (
    <div
      onClick={() => onSelectLine?.(index)}
      className={`group relative flex flex-col p-3 border-b border-slate-100 transition-all duration-200 cursor-pointer
        ${index === selectedIndex ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'hover:bg-slate-50'}
        ${isReturn ? 'bg-red-50' : ''}
        ${flashId === ligne.produit.id ? 'animate-pulse bg-emerald-100' : ''}`}
    >
      {/* Ligne Haut: Nom Produit + Total + Action */}
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
           <div className="flex items-center gap-1.5">
             <h4 className={`text-sm font-semibold truncate leading-tight ${isReturn ? 'text-red-600' : 'text-slate-800'}`} title={`${t('facturation:cart.headers.total')} ${formatCurrency(normalizeNumberInput(ligne.total_ligne))}`}>
               {ligne.produit.name}
             </h4>
             {ligne.isPromis && <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-amber-100 text-amber-700 border-amber-200">{t('facturation:cart_extra.promis')}</Badge>}
           </div>
           {ligne.produit.stock !== undefined && (
              <div className={`text-[10px] leading-none mt-1 ${ligne.produit.stock <= 0 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                {t('facturation:cart_extra.stock_label')} {ligne.produit.stock}
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
              if ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault()
                handleQtyStep(e.key === 'ArrowUp' ? 1 : -1)
                return
              }
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
                 placeholder={t('facturation:cart_extra.rem_placeholder')}
                 title={t('facturation:cart.discount_amount')}
              />
           </div>
         </div>

         {/* Bouton Lot FEFO condensé */}
         <Button
           variant="outline"
           size="sm"
           onClick={(e) => { e.stopPropagation(); onOpenLotModal(ligne.produit, ligne.lotId || null, ligne.quantite, ligne.lotAllocations || null); }}
           className={`h-9 px-2 text-[11px] font-semibold uppercase transition-colors shrink gap-1.5
             ${(ligne.lotId || ligne.lotAllocations?.length)
               ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
               : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200 hover:text-slate-600'}`}
           title={lotTooltip}
         >
           <Tag className="size-3 shrink-0" />
           <span className="truncate max-w-[320px] tracking-wide">{lotDisplayText}</span>
         </Button>
      </div>
    </div>
  )
})
