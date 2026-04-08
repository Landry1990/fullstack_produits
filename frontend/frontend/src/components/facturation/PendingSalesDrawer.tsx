import { useTranslation } from 'react-i18next'
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters'

interface PendingSalesDrawerProps {
  isOpen: boolean
  onClose: () => void
  ventesEnAttente: any[]
  onRestore: (id: number) => void
  onDelete: (id: number) => void
}

export default function PendingSalesDrawer({
  isOpen,
  onClose,
  ventesEnAttente,
  onRestore,
  onDelete
}: PendingSalesDrawerProps) {
  const { t } = useTranslation(['facturation', 'common'])

  if (!isOpen) return null

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">{t('pending_sales.title')}</h3>
          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">✕</button>
        </div>

        {ventesEnAttente.length === 0 ? (
          <div className="text-center py-8 text-base-content/40">
            {t('pending_sales.no_sales')}
          </div>
        ) : (
          <div className="space-y-3">
            {ventesEnAttente.map((vente, idx) => {
              const total = vente.lignes.reduce((sum: number, ligne: any) => sum + (normalizeNumberInput(ligne.total_ligne) || 0), 0)
              const remiseMontant = vente.remiseMode === 'montant'
                ? normalizeNumberInput(vente.remise)
                : total * (normalizeNumberInput(vente.remise) / 100)
              const totalNet = total - remiseMontant

              return (
                <div key={vente.id} className="group hover:bg-base-200/50 transition-all rounded-xl border border-base-200 p-2 sm:p-3 shadow-sm">
                  <div className="flex items-center gap-3 sm:gap-4 w-full">
                    {/* ID Badge */}
                    <div className="badge badge-info badge-sm shrink-0 font-black">#{idx + 1}</div>
                    
                    {/* Client Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate" title={vente.clientName || vente.manualClientName || t('pending_sales.unspecified_client')}>
                        {vente.clientName || vente.manualClientName || t('pending_sales.unspecified_client')}
                      </div>
                    </div>

                    {/* Stats & Time - Hidden/Stacked on mobile, row on desktop */}
                    <div className="flex items-center gap-3 md:gap-5 shrink-0">
                      <div className="hidden sm:flex flex-col items-end border-r border-base-200 pr-3 sm:pr-5">
                        <span className="text-[10px] uppercase font-bold text-base-content/40 tracking-wider">
                          {t('cart.items_count', { count: vente.lignes.length })}
                        </span>
                        <span className="text-xs font-medium tabular-nums opacity-60">
                           {vente.lignes.length} art.
                        </span>
                      </div>

                      <div className="flex flex-col items-end border-r border-base-200 pr-3 sm:pr-5">
                        <span className="text-[10px] uppercase font-bold text-base-content/40 tracking-wider font-sans">Total</span>
                        <span className="text-sm font-black text-primary tabular-nums">
                          {formatCurrency(totalNet)}
                        </span>
                      </div>

                      <div className="hidden md:flex flex-col items-center">
                        <span className="text-[10px] uppercase font-bold text-base-content/40 tracking-wider">Heure</span>
                        <span className="text-xs font-medium opacity-40 tabular-nums">
                          {new Date(vente.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <button
                        onClick={() => onRestore(vente.id)}
                        className="btn btn-primary btn-sm h-8 min-h-8 px-3 rounded-lg font-bold shadow-sm"
                        title={t('common:restore')}
                      >
                        {t('common:restore')}
                      </button>
                      <button
                        onClick={() => onDelete(vente.id)}
                        className="btn btn-ghost btn-sm h-8 min-h-8 w-8 p-0 rounded-lg text-error hover:bg-error/10 border-none transition-colors"
                        title={t('common:delete')}
                      >
                         ✕
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  )
}

