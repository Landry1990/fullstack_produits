import React from 'react'
import { useStockLots } from '../hooks/useStockLots'
import type { ProduitModel, StockLot } from '../types'

type LotSelectionModalProps = {
  isOpen: boolean
  onClose: () => void
  produit: ProduitModel | null
  onSelectLot: (lot: StockLot | null) => void // null means "Auto (FEFO)"
  currentLotId?: string | null // To highlight selected
}

export default function LotSelectionModal({ isOpen, onClose, produit, onSelectLot, currentLotId }: LotSelectionModalProps) {
  const { lots, loading, error } = useStockLots(produit?.id || null)

  if (!isOpen || !produit) return null

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">
          Sélection du lot pour {produit.name}
        </h3>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : error ? (
          <div className="alert alert-error text-sm">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
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
                    // Determine status color based on expiry
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
                            <div className="text-xs opacity-50">Reçu le {new Date(lot.date_reception).toLocaleDateString()}</div>
                          </td>
                          <td className={expiryColor}>
                            {lot.date_expiration ? new Date(lot.date_expiration).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="text-right font-medium">
                            {lot.quantity_remaining}
                          </td>
                          <td className="text-right">
                            {Number(lot.selling_price).toLocaleString()} F
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

        <div className="modal-action">
          <button className="btn" onClick={onClose}>Fermer</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>Fermer</button>
      </form>
    </div>
  )
}
