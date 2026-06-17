import { Package } from 'lucide-react'
import { useStockLots } from '../hooks/useStockLots'
import { formatPrice } from '../utils/formatters'
import { formatDate } from '../utils/dateUtils'
import type { ProduitModel, StockLot } from '../types'
import PremiumModal from './common/PremiumModal'

type LotSelectionModalProps = {
  isOpen: boolean
  onClose: () => void
  produit: ProduitModel | null
  onSelectLot: (lot: StockLot | null) => void
  currentLotId?: string | null
}

export default function LotSelectionModal({ isOpen, onClose, produit, onSelectLot, currentLotId }: LotSelectionModalProps) {
  const { lots, loading, error } = useStockLots(produit?.id || null)

  if (!produit) return null

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Sélection du lot`}
      subtitle={produit.name}
      icon={<Package className="size-5 text-blue-500" />}
      gradientFrom="blue-50"
      gradientTo="indigo-50"
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
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-100/50">
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Lot</th>
                  <th className="px-4 py-3">Expiration</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Prix</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Option Auto / FEFO */}
                <tr className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => onSelectLot(null)}>
                  <td className="px-4 py-3 font-bold text-blue-600">
                    <div className="flex items-center gap-2">
                      <span>🚀 AUTOMATIQUE (FEFO)</span>
                      {currentLotId === null && <span className="inline-flex items-center px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold">Actuel</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs italic text-slate-500" colSpan={3}>
                    Le système choisira le lot expirant le plus tôt.
                  </td>
                  <td className="px-4 py-3">
                    {!currentLotId && <div className="size-2.5 bg-emerald-500 rounded-full"></div>}
                  </td>
                </tr>

                {lots.map(lot => {
                    const isSelected = String(lot.id) === String(currentLotId)
                    const now = new Date()
                    const expire = lot.date_expiration ? new Date(lot.date_expiration) : null
                    let expiryColor = "text-emerald-600"
                    if (expire) {
                        const days = Math.ceil((expire.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                        if (days < 0) expiryColor = "text-red-600 font-bold"
                        else if (days < 30) expiryColor = "text-amber-500 font-bold"
                    }

                    return (
                        <tr 
                            key={lot.id} 
                            className={`hover:bg-slate-50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                            onClick={() => onSelectLot(lot)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{lot.lot}</div>
                            <div className="text-xs text-slate-400">Reçu le {formatDate(lot.date_reception)}</div>
                          </td>
                          <td className={`px-4 py-3 font-medium ${expiryColor}`}>
                            {lot.date_expiration ? (() => { const d = new Date(lot.date_expiration); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`; })() : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700">
                            {lot.quantity_remaining}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-slate-800">
                            {formatPrice(Number(lot.selling_price))} F
                          </td>
                          <td className="px-4 py-3">
                            {isSelected && <div className="size-2.5 bg-blue-600 rounded-full"></div>}
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
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </PremiumModal>
  )
}

