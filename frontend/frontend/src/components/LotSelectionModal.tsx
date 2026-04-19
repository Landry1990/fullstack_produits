import { useStockLots } from '../hooks/useStockLots'
import { formatPrice } from '../utils/formatters'
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
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      }
      gradientFrom="info/10"
      gradientTo="primary/10"
    >
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : error ? (
          <div className="alert alert-error text-sm rounded-xl">{error}</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="table table-sm w-full">
              <thead className="bg-base-200/50">
                <tr>
                  <th>Lot</th>
                  <th>Expiration</th>
                  <th className="text-right">Stock</th>
                  <th className="text-right">Prix</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {/* Option Auto / FEFO */}
                <tr className="hover:bg-base-200 cursor-pointer" onClick={() => onSelectLot(null)}>
                  <td className="font-bold text-primary">
                    🚀 AUTOMATIQUE (FEFO)
                    {currentLotId === null && <span className="badge badge-sm badge-primary ml-2">Actuel</span>}
                  </td>
                  <td className="text-xs italic" colSpan={3}>
                    Le système choisira le lot expirant le plus tôt.
                  </td>
                  <td>
                    {!currentLotId && <div className="badge badge-success badge-xs"></div>}
                  </td>
                </tr>

                {lots.map(lot => {
                    const isSelected = String(lot.id) === String(currentLotId)
                    const now = new Date()
                    const expire = lot.date_expiration ? new Date(lot.date_expiration) : null
                    let expiryColor = "text-success"
                    if (expire) {
                        const days = Math.ceil((expire.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                        if (days < 0) expiryColor = "text-error font-bold"
                        else if (days < 30) expiryColor = "text-warning font-bold"
                    }

                    return (
                        <tr 
                            key={lot.id} 
                            className={`hover:bg-base-200 cursor-pointer ${isSelected ? 'bg-base-200' : ''}`}
                            onClick={() => onSelectLot(lot)}
                        >
                          <td>
                            <div className="font-medium">{lot.lot}</div>
                            <div className="text-xs opacity-50">Reçu le {new Date(lot.date_reception).toLocaleDateString('fr-FR')}</div>
                          </td>
                          <td className={expiryColor}>
                            {lot.date_expiration ? (() => { const d = new Date(lot.date_expiration); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`; })() : 'N/A'}
                          </td>
                          <td className="text-right font-medium">
                            {lot.quantity_remaining}
                          </td>
                          <td className="text-right whitespace-nowrap">
                            {formatPrice(Number(lot.selling_price))} F
                          </td>
                          <td>
                            {isSelected && <div className="badge badge-primary badge-xs"></div>}
                          </td>
                        </tr>
                    )
                })}
              </tbody>
            </table>
            
            {lots.length === 0 && (
                <div className="text-center py-4 text-base-content/50 italic">
                    Aucun lot spécifique disponible. Le stock global sera utilisé.
                </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost px-6 rounded-xl" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </PremiumModal>
  )
}

