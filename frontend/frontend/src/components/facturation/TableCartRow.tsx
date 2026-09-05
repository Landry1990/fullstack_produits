import React from 'react'
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters'
import type { LigneFacture, ProduitModel, LotAllocation } from '../../types'
import { Button } from '../shadcn/button'
import { Badge } from '../shadcn/badge'
import { Input } from '../shadcn/input'
import { TableCell, TableRow } from '../shadcn/table'
import { Trash2 } from 'lucide-react'
import { useLotDisplay } from '../../hooks/useLotDisplay'
import { useCartRowState } from '../../hooks/useCartRowState'

export interface TableCartRowProps {
  ligne: LigneFacture
  index: number
  selectedIndex: number
  onSelectLine?: (index: number) => void
  updateQuantite: (lineId: string, quantite: number) => void
  updatePrix: (lineId: string, prix: string) => void
  updateRemiseProduit: (lineId: string, remise: string) => void
  updateTreatmentDuration?: (lineId: string, duration: number) => void
  removeLigne: (lineId: string) => void
  onOpenLotModal: (product: ProduitModel, currentLotId: string | null, quantity: number, currentAllocations: LotAllocation[] | null, lineId?: string | null) => void
  quantityInputsRef: React.MutableRefObject<Map<number, HTMLInputElement>>
  onReturnFocus: () => void
  canModifyPrice: boolean
  canDoRemise: boolean
  maxDiscount: number
  t: (key: string, options?: unknown) => string
  refreshTrigger?: number
  flashId?: string | null
}

export default React.memo(function TableCartRow({
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
  canDoRemise,
  maxDiscount,
  t,
  refreshTrigger,
  flashId,
}: TableCartRowProps) {
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
    <TableRow
      className={`hover:bg-slate-50/50 group border-b border-slate-100 last:border-0 cursor-pointer transition-colors duration-150
        ${index === selectedIndex ? '!bg-emerald-50/70 border-l-4 border-l-emerald-500 shadow-sm' : ''}
        ${isReturn ? 'bg-red-50 text-red-600 font-semibold' : ''}
        ${flashId === ligne.lineId ? 'animate-pulse bg-emerald-100' : ''}`}
      ref={index === selectedIndex ? (el) => el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) : null}
      onClick={() => onSelectLine?.(index)}
    >
      <TableCell className="pl-2 md:pl-4 py-2">
        <div className={`font-medium ${ligne.produit.is_deleted ? 'italic' : ''}`}>
          <div className="flex items-center gap-2">
            <span className="truncate text-slate-800" title={`${t('facturation:cart.headers.total')} ${formatCurrency(normalizeNumberInput(ligne.total_ligne))}`}>{ligne.produit.name}</span>
            {ligne.isPromis && (
              <Badge variant="secondary" className="text-[10px] h-5 bg-amber-100 text-amber-700 border-amber-200 animate-pulse shrink-0">
                {t('facturation:cart_extra.promis')}
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
                   onChange={(e) => updateTreatmentDuration?.(ligne.lineId, normalizeNumberInput(e.target.value) || 0)}
                   min={1}
                />
                <span className="text-[10px] text-emerald-600">{t('facturation:cart.product_status.days_unit')}</span>
              </div>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right py-1">
        <Input
          ref={(el) => {
            if (el) quantityInputsRef.current.set(ligne.produit.id, el)
            else quantityInputsRef.current.delete(ligne.produit.id)
          }}
          type="text"
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
          className="w-full text-right font-medium text-sm h-8 min-h-[32px] sm:min-h-0"
        />
      </TableCell>
      <TableCell className="text-right py-1">
        <Input
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
          className={`w-full text-right font-medium text-sm h-8 min-h-[32px] sm:min-h-0 ${!canModifyPrice ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700'}`}
          disabled={!canModifyPrice}
          title={!canModifyPrice ? t('facturation:messages.price_modification_forbidden') : ""}
        />
      </TableCell>
      <TableCell className="text-right py-1 hidden lg:table-cell">
        <Input
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
          className={`w-full text-right font-medium text-sm h-8 min-h-[32px] sm:min-h-0 ${!canDoRemise ? 'text-slate-400 cursor-not-allowed' : 'text-amber-600 placeholder-amber-300'}`}
          disabled={!canDoRemise}
          title={!canDoRemise ? t('facturation:messages.discount_modification_forbidden') : ''}
          placeholder="%"
        />
      </TableCell>
      <TableCell className="text-center py-2 hidden md:table-cell">
        <div className={`font-mono font-semibold ${
          (ligne.produit.stock ?? 0) <= 0 ? 'text-red-500' :
          (ligne.produit.stock ?? 0) < 5 ? 'text-amber-500' : 'text-emerald-600'
        }`}>
          {ligne.produit.stock ?? 0}
        </div>
      </TableCell>
      <TableCell className="text-center py-2 hidden md:table-cell">
        <Button
          variant={(ligne.lotId || ligne.lotAllocations?.length) ? 'default' : 'outline'}
          size="sm"
          onClick={() => onOpenLotModal(ligne.produit, ligne.lotId || null, ligne.quantite, ligne.lotAllocations || null, ligne.lineId)}
          className={`w-full max-w-[260px] truncate text-xs h-7 ${(ligne.lotId || ligne.lotAllocations?.length) ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          title={lotTooltip}
        >
          {lotDisplayText}
        </Button>
      </TableCell>
      <TableCell className="text-right font-semibold text-slate-800 pr-2 md:pr-4 py-2">
        {formatCurrency(normalizeNumberInput(ligne.total_ligne))}
      </TableCell>
      <TableCell className="text-center py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => removeLigne(ligne.lineId)}
          className="size-7 text-slate-300 hover:text-red-500 hover:bg-red-50 sm:opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <span className="sr-only">{t('facturation:cart.actions.remove')}</span>
          <Trash2 className="size-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  )
})
