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
                <div key={vente.id} className="card bg-base-100 border border-base-200 shadow-sm">
                  <div className="card-body p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="badge badge-info badge-sm">#{idx + 1}</div>
                          <span className="font-semibold">
                            {vente.clientName || vente.manualClientName || t('pending_sales.unspecified_client')}
                          </span>
                        </div>
                        <div className="text-sm text-base-content/60 space-y-1">
                          <div>{t('pending_sales.items_count', { count: vente.lignes.length })}</div>
                          <div className="font-medium text-primary">{formatCurrency(totalNet)} FCFA</div>
                          <div className="text-xs opacity-50">
                            {new Date(vente.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => onRestore(vente.id)}
                          className="btn btn-primary btn-sm"
                        >
                          {t('common.restore')}
                        </button>
                        <button
                          onClick={() => onDelete(vente.id)}
                          className="btn btn-error btn-outline btn-sm"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
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
