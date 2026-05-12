import { useMemo, useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import PremiumModal from '../common/PremiumModal'
import { ShieldAlert, Package, ArrowDown, History, Zap } from 'lucide-react'
import type { ProduitModel, Client } from '../../types'

// Constante de module pour éviter la recréation à chaque render
const EMPTY_RESOLUTION_ACTIONS: Record<number, 'promis' | 'force' | 'reduce'> = {}

interface StockResolutionModalProps {
  isOpen: boolean
  onClose: () => void
  stockResolutionItems: {
    product: ProduitModel
    quantity: number
    stock: number
  }[]
  resolutionActions: Record<number, 'promis' | 'force' | 'reduce'>
  setResolutionActions: Dispatch<SetStateAction<Record<number, 'promis' | 'force' | 'reduce'>>>
  promisPhone: string
  setPromisPhone: (val: string) => void
  promisClientName: string
  setPromisClientName: (val: string) => void
  onConfirm: () => void
  clients?: Client[]
  selectedClientName?: string
}

export default function StockResolutionModal({
  isOpen,
  onClose,
  stockResolutionItems,
  resolutionActions = EMPTY_RESOLUTION_ACTIONS,
  setResolutionActions,
  promisPhone,
  setPromisPhone,
  promisClientName,
  setPromisClientName,
  onConfirm
}: StockResolutionModalProps) {
  const { t } = useTranslation(['facturation', 'common'])



  // --- Memoized Data ---
  const conflicts = useMemo(() => stockResolutionItems.map(item => ({
    id: item.product.id,
    nom: item.product.name,
    cip: item.product.cip1 || '',
    qty: item.quantity,
    stock: item.stock
  })), [stockResolutionItems]);

  const hasPromis = useMemo(() => resolutionActions && Object.values(resolutionActions).includes('promis'), [resolutionActions]);
  const hasForce = useMemo(() => resolutionActions && Object.values(resolutionActions).includes('force'), [resolutionActions]);

  // --- Callbacks ---
  const handleSetAction = useCallback((productId: number, action: 'promis' | 'force' | 'reduce') => {
    setResolutionActions(prev => ({
        ...prev,
        [productId]: action
    }))
  }, [setResolutionActions])

  const handleBulkAction = useCallback((action: 'promis' | 'force' | 'reduce') => {
    const newActions: Record<number, 'promis' | 'force' | 'reduce'> = {}
    conflicts.forEach(c => {
        newActions[c.id] = action
    })
    setResolutionActions(newActions)
  }, [conflicts, setResolutionActions])

  const handleConfirm = useCallback(() => {
    onConfirm()
  }, [onConfirm])

  if (!isOpen) return null

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('stock_resolution.title')}
      icon={<ShieldAlert className="h-6 w-6 text-warning" />}
      maxWidth="max-w-5xl"
      footer={
        <div className="flex justify-between items-center w-full">
            <div className="text-xs text-base-content/50 italic px-4">
                {hasForce && (
                    <span className="flex items-center gap-1.5 text-warning font-bold">
                        <ShieldAlert className="size-3.5" />
                        {t('stock_resolution.force_warning')}
                    </span>
                )}
            </div>
            <div className="flex gap-3">
                <button className="btn btn-ghost" onClick={onClose}>
                    {t('stock_resolution.cancel_and_edit_cart')}
                </button>
                <button className="btn btn-primary px-8 gap-2" onClick={handleConfirm}>
                    {t('stock_resolution.validate_and_cash')}
                </button>
            </div>
        </div>
      }
    >
      <div className="p-6">
        <div className="alert alert-warning shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-warning/10 border-warning/20">
            <div className="flex items-center gap-2 text-warning-content">
                <ShieldAlert className="h-5 w-5" />
                <span className="font-medium">{t('stock_resolution.message')}</span>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={() => handleBulkAction('reduce')}
                    className="btn btn-xs btn-outline btn-warning gap-1"
                >
                    <ArrowDown className="size-3" /> {t('stock_resolution.reduce_all')}
                </button>
                <button 
                    onClick={() => handleBulkAction('promis')}
                    className="btn btn-xs btn-warning gap-1"
                >
                    <History className="size-3" /> {t('stock_resolution.promis_all')}
                </button>
                <button 
                    onClick={() => handleBulkAction('force')}
                    className="btn btn-xs btn-error gap-1 shadow-sm"
                >
                    <Zap className="size-3" /> {t('stock_resolution.force_all')}
                </button>
            </div>
        </div>

        <div className="overflow-x-auto border border-base-200 rounded-2xl mb-6 bg-base-100">
          <table className="table w-full">
            <thead>
              <tr className="bg-base-200/50">
                <th className="text-[10px] font-black uppercase tracking-widest opacity-40">{t('common:product')}</th>
                <th className="text-center text-[10px] font-black uppercase tracking-widest opacity-40">{t('stock_resolution.demand')}</th>
                <th className="text-center text-[10px] font-black uppercase tracking-widest opacity-40">{t('stock_resolution.stock')}</th>
                <th className="text-center text-[10px] font-black uppercase tracking-widest opacity-40">{t('stock_resolution.missing')}</th>
                <th className="text-center text-[10px] font-black uppercase tracking-widest opacity-40 py-4">{t('stock_resolution.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-100">
              {conflicts.map((item) => {
                const stock = item.stock || 0
                const manquant = item.qty - stock
                const currentAction = resolutionActions[item.id] || 'promis'
                
                return (
                  <tr key={item.id} className="hover:bg-base-200/20 transition-colors">
                    <td>
                        <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-base-200 flex items-center justify-center">
                                <Package className="size-4 opacity-30" />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-sm">{item.nom}</span>
                                <span className="text-[10px] opacity-40 font-mono tracking-tighter">{item.cip}</span>
                            </div>
                        </div>
                    </td>
                    <td className="text-center font-mono font-bold">{item.qty}</td>
                    <td className="text-center font-mono opacity-60">{stock}</td>
                    <td className="text-center">
                        <span className="font-mono font-bold text-error bg-error/10 px-2 py-0.5 rounded text-xs">
                            -{manquant}
                        </span>
                    </td>
                    <td className="text-center">
                        <div className="inline-flex p-1 bg-base-200 rounded-xl gap-1">
                            <button 
                                onClick={() => handleSetAction(item.id, 'reduce')}
                                className={`btn btn-xs border-none h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all ${
                                    currentAction === 'reduce' ? 'bg-base-100 shadow-sm text-primary font-bold' : 'btn-ghost opacity-40'
                                }`}
                                title={t('stock_resolution.reduce')}
                            >
                                <ArrowDown className="size-3" /> {t('stock_resolution.reduce')}
                            </button>
                            <button 
                                onClick={() => handleSetAction(item.id, 'promis')}
                                className={`btn btn-xs border-none h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all ${
                                    currentAction === 'promis' ? 'bg-info text-info-content shadow-md font-bold' : 'btn-ghost opacity-40'
                                }`}
                            >
                                <History className="size-3" /> {t('stock_resolution.promised')}
                            </button>
                            <button 
                                onClick={() => handleSetAction(item.id, 'force')}
                                className={`btn btn-xs border-none h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all ${
                                    currentAction === 'force' ? 'bg-error text-error-content shadow-md font-bold' : 'btn-ghost opacity-40'
                                }`}
                            >
                                <Zap className="size-3" /> {t('stock_resolution.force')}
                            </button>
                        </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {hasPromis && (
            <div className="p-6 bg-info/5 rounded-2xl border border-info/10 shadow-inner space-y-4">
                <div className="flex items-center gap-2 text-info mb-1">
                    <History className="size-4" />
                    <h4 className="text-xs font-black uppercase tracking-widest">{t('promis:details')}</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="form-control w-full">
                        <label className="label py-1">
                            <span className="label-text-alt font-bold uppercase text-base-content/40">{t('stock_resolution.client_name')} <span className="lowercase font-normal opacity-50">({t('stock_resolution.optional')})</span></span>
                        </label>
                        <input 
                            type="text" 
                            className="input input-bordered focus:input-info rounded-xl bg-base-100" 
                            value={promisClientName}
                            onChange={(e) => setPromisClientName(e.target.value)}
                            placeholder={t('client.manual_placeholder')}
                        />
                    </div>
                    <div className="form-control w-full">
                        <label className="label py-1">
                            <span className="label-text-alt font-bold uppercase text-base-content/40">{t('stock_resolution.client_phone_for_promised_ticket')}</span>
                        </label>
                        <input 
                            type="text" 
                            className="input input-bordered focus:input-info rounded-xl bg-base-100" 
                            value={promisPhone}
                            onChange={(e) => setPromisPhone(e.target.value)}
                            placeholder={t('stock_resolution.phone_number_placeholder')}
                        />
                    </div>
                </div>
            </div>
        )}
      </div>
    </PremiumModal>
  )
}

