import { useState, useEffect, useMemo } from 'react'
import { Package, RotateCcw } from 'lucide-react'
import { useStockLots } from '../hooks/useStockLots'
import { formatPrice } from '../utils/formatters'
import { formatDate } from '../utils/dateUtils'
import type { ProduitModel, StockLot, LotAllocation } from '../types'
import PremiumModal from './common/PremiumModal'

type LotSelectionModalProps = {
  isOpen: boolean
  onClose: () => void
  produit: ProduitModel | null
  quantity: number
  currentAllocations: LotAllocation[] | null
  onSelectAllocations: (allocations: LotAllocation[] | null) => void
}

function sortLotsFEFO(lots: StockLot[]): StockLot[] {
  return lots.slice().sort((a, b) => {
    const expA = a.date_expiration ? new Date(a.date_expiration).getTime() : Infinity
    const expB = b.date_expiration ? new Date(b.date_expiration).getTime() : Infinity
    if (expA !== expB) return expA - expB
    const recA = a.date_reception ? new Date(a.date_reception).getTime() : 0
    const recB = b.date_reception ? new Date(b.date_reception).getTime() : 0
    return recA - recB
  })
}

function computeFEFO(lots: StockLot[], quantity: number): LotAllocation[] {
  const sorted = sortLotsFEFO(lots)
  const allocations: LotAllocation[] = []
  let remaining = quantity
  for (const lot of sorted) {
    if (remaining <= 0) break
    const available = lot.quantity_remaining ?? 0
    if (available <= 0) continue
    const qty = Math.min(available, remaining)
    allocations.push({
      lotId: lot.id,
      lotText: lot.lot,
      lotExpiration: lot.date_expiration || null,
      quantity: qty,
      sellingPrice: lot.selling_price ?? null,
    })
    remaining -= qty
  }
  return allocations
}

export default function LotSelectionModal({
  isOpen,
  onClose,
  produit,
  quantity,
  currentAllocations,
  onSelectAllocations,
}: LotSelectionModalProps) {
  const { lots, loading, error } = useStockLots(produit?.id || null)
  const [isAuto, setIsAuto] = useState(!currentAllocations)
  const [allocations, setAllocations] = useState<LotAllocation[]>(currentAllocations || [])

  useEffect(() => {
    if (!isOpen) return
    setIsAuto(!currentAllocations)
    if (currentAllocations) {
      setAllocations(currentAllocations)
    } else if (lots.length > 0 && quantity > 0) {
      setAllocations(computeFEFO(lots, quantity))
    } else {
      setAllocations([])
    }
  }, [isOpen, lots.length, quantity, currentAllocations])

  const totalAllocated = useMemo(() => allocations.reduce((sum, a) => sum + (a.quantity || 0), 0), [allocations])
  const isValid = totalAllocated === quantity && quantity > 0
  const remaining = quantity - totalAllocated

  const handleResetFEFO = () => {
    setIsAuto(true)
    setAllocations(computeFEFO(lots, quantity))
  }

  const handleSwitchAuto = () => {
    setIsAuto(true)
    setAllocations(computeFEFO(lots, quantity))
  }

  const handleQuantityChange = (lotId: string | number, value: string) => {
    const qty = value === '' ? 0 : Math.max(0, parseInt(value, 10) || 0)
    setIsAuto(false)
    setAllocations(prev => {
      const existing = prev.find(a => String(a.lotId) === String(lotId))
      if (existing) {
        return prev.map(a => (String(a.lotId) === String(lotId) ? { ...a, quantity: qty } : a))
      }
      const lot = lots.find(l => String(l.id) === String(lotId))
      if (!lot) return prev
      return [
        ...prev,
        {
          lotId: lot.id,
          lotText: lot.lot,
          lotExpiration: lot.date_expiration || null,
          quantity: qty,
          sellingPrice: lot.selling_price ?? null,
        },
      ]
    })
  }

  const handleConfirm = () => {
    if (isAuto) {
      onSelectAllocations(null)
    } else {
      onSelectAllocations(allocations.filter(a => a.quantity > 0))
    }
    onClose()
  }

  if (!produit) return null

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Répartition des lots`}
      subtitle={`${produit.name} — Qté: ${quantity}`}
      icon={<Package className="size-5 text-blue-500" />}
      gradientFrom="blue-50"
      gradientTo="indigo-50"
      maxWidth="max-w-2xl"
    >
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="inline-block w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl flex items-center gap-2">
            <span className="font-medium">{error}</span>
          </div>
        ) : (
          <>
            {/* Option Auto / FEFO */}
            <div
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors mb-3 ${
                isAuto ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
              onClick={handleSwitchAuto}
            >
              <div className={`size-4 rounded-full border-2 flex items-center justify-center ${isAuto ? 'border-blue-600' : 'border-slate-300'}`}>
                {isAuto && <div className="size-2 bg-blue-600 rounded-full"></div>}
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm text-blue-700">🚀 AUTOMATIQUE (FEFO)</div>
                <div className="text-xs text-slate-500">Le système choisira automatiquement les lots expirant le plus tôt.</div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-100/50">
                  <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Lot</th>
                    <th className="px-4 py-3">Expiration</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3 text-right">Prix</th>
                    <th className="px-4 py-3 text-center w-32">Qté</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortLotsFEFO(lots).map(lot => {
                    const now = new Date()
                    const expire = lot.date_expiration ? new Date(lot.date_expiration) : null
                    let expiryColor = 'text-emerald-600'
                    if (expire) {
                      const days = Math.ceil((expire.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                      if (days < 0) expiryColor = 'text-red-600 font-bold'
                      else if (days < 30) expiryColor = 'text-amber-500 font-bold'
                    }
                    const allocation = allocations.find(a => String(a.lotId) === String(lot.id))
                    const allocatedQty = allocation?.quantity || 0

                    return (
                      <tr key={lot.id} className={`${isAuto ? 'opacity-60' : 'hover:bg-slate-50'}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{lot.lot}</div>
                          <div className="text-xs text-slate-400">Reçu le {formatDate(lot.date_reception)}</div>
                        </td>
                        <td className={`px-4 py-3 font-medium ${expiryColor}`}>
                          {lot.date_expiration ? (() => { const d = new Date(lot.date_expiration); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`; })() : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{lot.quantity_remaining}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-slate-800">{formatPrice(Number(lot.selling_price))} F</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            max={lot.quantity_remaining}
                            value={allocatedQty || ''}
                            onChange={(e) => handleQuantityChange(lot.id, e.target.value)}
                            className="w-20 px-2 py-1 text-sm text-center border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {lots.length === 0 && (
                <div className="text-center py-4 text-slate-400 italic text-sm">
                  Aucun lot spécifique disponible. Le stock global sera utilisé.
                </div>
              )}
            </div>

            {/* Résumé */}
            <div className="mt-3 flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-sm">
                <span className="font-medium text-slate-600">Alloué: </span>
                <span className={`font-bold ${isValid ? 'text-emerald-600' : 'text-amber-600'}`}>{totalAllocated}</span>
                <span className="text-slate-500"> / {quantity}</span>
              </div>
              {!isValid && !isAuto && (
                <div className="text-xs font-medium text-amber-600">
                  {remaining > 0 ? `Il manque ${remaining} unité(s)` : `Excès de ${-remaining} unité(s)`}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
            onClick={handleResetFEFO}
            disabled={isAuto}
            type="button"
          >
            <RotateCcw className="size-4" />
            FEFO
          </button>
          <button
            className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            onClick={onClose}
            type="button"
          >
            Fermer
          </button>
          <button
            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleConfirm}
            disabled={!isAuto && !isValid}
            type="button"
          >
            Valider
          </button>
        </div>
      </div>
    </PremiumModal>
  )
}

