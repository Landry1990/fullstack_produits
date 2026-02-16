import { useMemo, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProduitModel } from '../../types'

interface StockResolutionModalProps {
  isOpen: boolean
  onClose: () => void
  stockResolutionItems: {
    product: ProduitModel
    quantity: number
    stock: number
  }[]
  promisSelections: Set<number>
  setPromisSelections: (val: Set<number>) => void
  promisPhone: string
  setPromisPhone: (val: string) => void
  promisClientName: string
  setPromisClientName: (val: string) => void
  onConfirm: () => void
  clients?: any[]
  selectedClientName?: string
}

export default function StockResolutionModal({
  isOpen,
  onClose,
  stockResolutionItems,
  promisSelections,
  setPromisSelections,
  promisPhone,
  setPromisPhone,
  promisClientName,
  setPromisClientName,
  onConfirm
}: StockResolutionModalProps) {
  const { t } = useTranslation()

  // --- Local States for Inputs (Performance & Robustness) ---
  const [localClientName, setLocalClientName] = useState(promisClientName)
  const [localPhone, setLocalPhone] = useState(promisPhone)

  // Sync local states when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalClientName(promisClientName)
      setLocalPhone(promisPhone)
    }
  }, [isOpen, promisClientName, promisPhone])

  // --- Memoized Data ---
  const conflicts = useMemo(() => stockResolutionItems.map(item => ({
    id: item.product.id,
    nom: item.product.name,
    cip: item.product.cip1 || '',
    qty: item.quantity
  })), [stockResolutionItems]);

  const stockMap = useMemo(() => stockResolutionItems.reduce((acc, item) => {
    acc[item.product.id] = item.stock;
    return acc;
  }, {} as Record<number, number>), [stockResolutionItems]);

  const itemsToPromis = useMemo(() => Array.from(promisSelections), [promisSelections]);

  // --- Callbacks ---
  const handleTogglePromis = useCallback((productId: number, checked: boolean) => {
    const newSelections = new Set(promisSelections)
    if (checked) {
      newSelections.add(productId)
    } else {
      newSelections.delete(productId)
    }
    setPromisSelections(newSelections)
  }, [promisSelections, setPromisSelections])

  const handleConfirm = useCallback(() => {
    // Sync local states back to parent only on confirm
    setPromisClientName(localClientName)
    setPromisPhone(localPhone)
    // Small delay to ensure state update before parent's logic runs
    setTimeout(() => {
      onConfirm()
    }, 0)
  }, [localClientName, localPhone, setPromisClientName, setPromisPhone, onConfirm])

  if (!isOpen) return null

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-11/12 max-w-5xl">
        <h3 className="font-bold text-lg text-warning flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            {t('facturation.stock_resolution.title')}
        </h3>
        
        <div className="alert alert-warning shadow-lg my-4">
            <div>
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span>{t('facturation.stock_resolution.message')}</span>
            </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>{t('common.product')}</th>
                <th>{t('facturation.stock_resolution.demand')}</th>
                <th className="text-right">{t('facturation.stock_resolution.stock')}</th>
                <th className="text-right">{t('facturation.stock_resolution.missing')}</th>
                <th className="text-center">{t('facturation.stock_resolution.promised')}</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map((item) => {
                const stock = stockMap[item.id] || 0
                const manquant = item.qty - stock
                const isPromis = itemsToPromis.includes(item.id)
                
                return (
                  <tr key={item.id} className={isPromis ? "bg-info/10 text-info-content" : "bg-error/10 text-error-content"}>
                    <td>
                        <div className="font-bold">{item.nom}</div>
                        <div className="text-xs opacity-60">{item.cip}</div>
                    </td>
                    <td className="font-mono">{item.qty}</td>
                    <td className="text-right font-mono">{stock}</td>
                    <td className="text-right font-mono font-bold text-error">-{manquant}</td>
                    <td className="text-center">
                        <input 
                            type="checkbox" 
                            className="toggle toggle-info" 
                            checked={isPromis}
                            onChange={(e) => handleTogglePromis(item.id, e.target.checked)}
                        />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {itemsToPromis.length > 0 && (
            <div className="mt-4 p-4 bg-base-200 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-semibold">{t('facturation.stock_resolution.client_name')} <span className="text-xs font-normal opacity-50">({t('facturation.stock_resolution.optional')})</span></span>
                        </label>
                        <input 
                            type="text" 
                            className="input input-bordered focus:input-primary" 
                            value={localClientName}
                            onChange={(e) => setLocalClientName(e.target.value)}
                            placeholder={t('facturation.client.manual_placeholder')}
                        />
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-semibold">{t('facturation.stock_resolution.client_phone_for_promised_ticket')}</span>
                        </label>
                        <input 
                            type="text" 
                            className="input input-bordered focus:input-primary" 
                            value={localPhone}
                            onChange={(e) => setLocalPhone(e.target.value)}
                            placeholder={t('facturation.stock_resolution.phone_number_placeholder')}
                        />
                    </div>
                </div>
            </div>
        )}

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
          {t('facturation.stock_resolution.cancel_and_edit_cart')}
          </button>
          <button className="btn btn-primary px-8" onClick={handleConfirm}>
          {t('facturation.stock_resolution.validate_and_cash')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
