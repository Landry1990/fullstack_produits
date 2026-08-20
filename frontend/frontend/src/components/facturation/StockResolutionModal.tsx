import { useMemo, useCallback, type Dispatch, type SetStateAction } from 'react'
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
      icon={<ShieldAlert className="h-6 w-6 text-amber-500" />}
      maxWidth="max-w-5xl"
      footer={
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 w-full">
            <div className="text-xs px-4">
                {hasForce && (
                    <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold bg-amber-50 border border-amber-100 px-2.5 py-1.5 rounded-lg">
                        <ShieldAlert className="size-3.5" />
                        {t('stock_resolution.force_warning')}
                    </span>
                )}
            </div>
            <div className="flex gap-3 justify-end">
                <button className="inline-flex items-center justify-center whitespace-nowrap h-9 px-4 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors" onClick={onClose}>
                    {t('stock_resolution.cancel_and_edit_cart')}
                </button>
                <button className="inline-flex items-center justify-center whitespace-nowrap h-9 px-6 rounded-lg text-sm font-semibold bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-colors gap-2" onClick={handleConfirm} autoFocus>
                    {t('stock_resolution.validate_and_cash')}
                </button>
            </div>
        </div>
      }
    >
      <div className="p-6">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                <span className="text-sm font-medium">{t('stock_resolution.message')}</span>
            </div>
            <div className="flex items-center gap-2 w-full lg:w-auto">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1 hidden lg:inline">{t('common:actions')}</span>
                <button
                    onClick={() => handleBulkAction('reduce')}
                    className="inline-flex flex-1 lg:flex-none items-center justify-center whitespace-nowrap h-7 px-2.5 rounded-lg text-[11px] font-medium border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:border-emerald-200 hover:text-emerald-600 transition-colors gap-1.5"
                    title={t('stock_resolution.reduce_all')}
                >
                    <ArrowDown className="size-3.5 text-emerald-500" /> <span className="hidden sm:inline">{t('stock_resolution.reduce')}</span>
                </button>
                <button
                    onClick={() => handleBulkAction('promis')}
                    className="inline-flex flex-1 lg:flex-none items-center justify-center whitespace-nowrap h-7 px-2.5 rounded-lg text-[11px] font-medium border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:border-blue-200 hover:text-blue-600 transition-colors gap-1.5"
                    title={t('stock_resolution.promis_all')}
                >
                    <History className="size-3.5 text-blue-500" /> <span className="hidden sm:inline">{t('stock_resolution.promised')}</span>
                </button>
                <button
                    onClick={() => handleBulkAction('force')}
                    className="inline-flex flex-1 lg:flex-none items-center justify-center whitespace-nowrap h-7 px-2.5 rounded-lg text-[11px] font-medium border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:border-red-200 hover:text-red-600 transition-colors gap-1.5"
                    title={t('stock_resolution.force_all')}
                >
                    <Zap className="size-3.5 text-red-500" /> <span className="hidden sm:inline">{t('stock_resolution.force')}</span>
                </button>
            </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl mb-6 bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/50">
                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">{t('common:product')}</th>
                <th className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">{t('stock_resolution.demand')}</th>
                <th className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">{t('stock_resolution.stock')}</th>
                <th className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">{t('stock_resolution.missing')}</th>
                <th className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">{t('stock_resolution.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {conflicts.map((item) => {
                const stock = item.stock || 0
                const manquant = item.qty - stock
                const currentAction = resolutionActions[item.id] || 'promis'

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                <Package className="size-4 text-slate-400" />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-sm text-slate-800">{item.nom}</span>
                                <span className="text-[10px] text-slate-400 font-mono tracking-tighter">{item.cip}</span>
                            </div>
                        </div>
                    </td>
                    <td className="text-center font-mono font-bold text-slate-700 px-4 py-3">{item.qty}</td>
                    <td className="text-center font-mono text-slate-500 px-4 py-3">{stock}</td>
                    <td className="text-center px-4 py-3">
                        <span className="font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded text-xs">
                            -{manquant}
                        </span>
                    </td>
                    <td className="text-center px-4 py-3">
                        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg gap-0.5">
                            <button
                                onClick={() => handleSetAction(item.id, 'reduce')}
                                className={`inline-flex items-center justify-center whitespace-nowrap h-7 px-2 rounded-md text-[10px] font-semibold transition-all gap-1 border-none ${
                                    currentAction === 'reduce'
                                        ? 'bg-white shadow-sm text-emerald-600 ring-1 ring-emerald-100'
                                        : 'text-slate-500 hover:bg-white/70 hover:text-emerald-600'
                                }`}
                                title={t('stock_resolution.reduce')}
                            >
                                <ArrowDown className="size-3" /> {t('stock_resolution.reduce')}
                            </button>
                            <button
                                onClick={() => handleSetAction(item.id, 'promis')}
                                className={`inline-flex items-center justify-center whitespace-nowrap h-7 px-2 rounded-md text-[10px] font-semibold transition-all gap-1 border-none ${
                                    currentAction === 'promis'
                                        ? 'bg-white shadow-sm text-blue-600 ring-1 ring-blue-100'
                                        : 'text-slate-500 hover:bg-white/70 hover:text-blue-600'
                                }`}
                                title={t('stock_resolution.promised')}
                            >
                                <History className="size-3" /> {t('stock_resolution.promised')}
                            </button>
                            <button
                                onClick={() => handleSetAction(item.id, 'force')}
                                className={`inline-flex items-center justify-center whitespace-nowrap h-7 px-2 rounded-md text-[10px] font-semibold transition-all gap-1 border-none ${
                                    currentAction === 'force'
                                        ? 'bg-white shadow-sm text-red-600 ring-1 ring-red-100'
                                        : 'text-slate-500 hover:bg-white/70 hover:text-red-600'
                                }`}
                                title={t('stock_resolution.force')}
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
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 text-slate-700 mb-1">
                    <History className="size-4 text-blue-500" />
                    <h4 className="text-xs font-black uppercase tracking-widest">{t('facturation:stock_resolution.promised')}</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="w-full">
                        <label className="block pb-1.5 text-[11px] font-bold uppercase text-slate-500 tracking-wide">
                            {t('stock_resolution.client_name')} <span className="lowercase font-normal text-slate-400">({t('stock_resolution.optional')})</span>
                        </label>
                        <input
                            type="text"
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                            value={promisClientName}
                            onChange={(e) => setPromisClientName(e.target.value)}
                            placeholder={t('client.manual_placeholder')}
                        />
                    </div>
                    <div className="w-full">
                        <label className="block pb-1.5 text-[11px] font-bold uppercase text-slate-500 tracking-wide">
                            {t('stock_resolution.client_phone_for_promised_ticket')}
                        </label>
                        <input
                            type="text"
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
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

