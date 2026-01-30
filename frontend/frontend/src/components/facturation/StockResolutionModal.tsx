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
  onConfirm: () => void
}

export default function StockResolutionModal({
  isOpen,
  onClose,
  stockResolutionItems,
  promisSelections,
  setPromisSelections,
  promisPhone,
  setPromisPhone,
  onConfirm
}: StockResolutionModalProps) {
  const { t } = useTranslation()

  if (!isOpen) return null

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-[600px] max-w-full">
        <h3 className="font-bold text-lg text-warning">{t('facturation.stock_resolution.title')}</h3>
        <div className="py-4">
          <div className="alert alert-warning text-sm py-2 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{t('facturation.stock_resolution.message')}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-compact w-full">
              <thead>
                <tr>
                  <th>{t('common.product')}</th>
                  <th className="text-right">{t('facturation.stock_resolution.demand')}</th>
                  <th className="text-right">{t('facturation.stock_resolution.stock')}</th>
                  <th className="text-right">{t('facturation.stock_resolution.missing')}</th>
                  <th className="text-center">{t('facturation.stock_resolution.promised')} ?</th>
                </tr>
              </thead>
              <tbody>
                {stockResolutionItems.map((item) => {
                  const manquant = Math.max(0, item.quantity - item.stock)
                  const isSelected = promisSelections.has(item.product.id)

                  return (
                    <tr key={item.product.id}>
                      <td className="font-medium">{item.product.name}</td>
                      <td className="text-right font-bold">{item.quantity}</td>
                      <td className="text-right">{item.stock}</td>
                      <td className="text-right text-error font-bold">{manquant}</td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-warning"
                          checked={isSelected}
                          onChange={(e) => {
                            const newSet = new Set(promisSelections)
                            if (e.target.checked) newSet.add(item.product.id)
                            else newSet.delete(item.product.id)
                            setPromisSelections(newSet)
                          }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="form-control w-full mt-4">
            <label className="label">
              <span className="label-text">{t('facturation.stock_resolution.client_phone_for_promised_ticket')}</span>
            </label>
            <input
              type="text"
              value={promisPhone}
              onChange={(e) => setPromisPhone(e.target.value)}
              placeholder={t('facturation.stock_resolution.phone_number_placeholder')}
              className="input input-bordered w-full"
            />
          </div>
        </div>

        <div className="modal-action flex justify-between">
          <button className="btn btn-ghost" onClick={onClose}>
            {t('facturation.stock_resolution.cancel_and_edit_cart')}
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
          >
            {t('facturation.stock_resolution.validate_and_cash')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
