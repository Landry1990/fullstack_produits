import { useTranslation } from 'react-i18next'
import { AlertTriangle, Trash2 } from 'lucide-react'
import PremiumModal from '../common/PremiumModal'
import type { Facture } from '../../types'

interface BulkCancelModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  facturesEnAttente: Facture[]
  selectedFactureIds: Set<number>
  loading: boolean
  progress: { processed: number; total: number } | null
}

export function BulkCancelModal({
  isOpen,
  onClose,
  onConfirm,
  facturesEnAttente,
  selectedFactureIds,
  loading,
  progress
}: BulkCancelModalProps) {
  const { t } = useTranslation('caisse')

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('bulk_cancel_title', { defaultValue: 'Vider la caisse' })}
      icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
      gradientFrom="red-50"
      gradientTo="amber-50"
      maxWidth="max-w-lg"
    >
      <div className="p-6 space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            <p className="font-bold mb-1">
              {selectedFactureIds.size > 0
                ? t('bulk_cancel_selected_count', { count: selectedFactureIds.size })
                : t('bulk_cancel_pending_count', { count: facturesEnAttente.length })}
            </p>
            <p>
              {t('bulk_cancel_warning', { defaultValue: 'Toutes les factures sélectionnées seront annulées. Le stock des factures déjà validées sera réintégré automatiquement. Cette action est irréversible.' })}
            </p>
          </div>
        </div>

        {selectedFactureIds.size > 0 && selectedFactureIds.size < facturesEnAttente.length && (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200">
            <table className="table table-xs w-full">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th>{t('table.invoice')}</th>
                  <th>{t('table.client')}</th>
                  <th className="text-right">{t('table.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {facturesEnAttente
                  .flatMap(f => selectedFactureIds.has(f.id) ? [(
                    <tr key={f.id}>
                      <td className="font-bold">#{f.numero_facture}</td>
                      <td>{f.client_name || t('table.passerby_client')}</td>
                      <td className="text-right font-mono">{Math.round(Number(f.total_ttc))} F</td>
                    </tr>
                  )] : [])}
              </tbody>
            </table>
          </div>
        )}

        {loading && progress && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium text-slate-600">
              <span>{t('bulk_cancel_batch_processing')}</span>
              <span>{progress.processed} / {progress.total}</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-600 transition-all duration-300"
                style={{ width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            className="inline-flex items-center justify-center h-9 px-6 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onClose}
            disabled={loading}
          >
            {t('common:cancel', { defaultValue: 'Annuler' })}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 h-9 px-6 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 transition-colors"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full size-4 border-b-2 border-white"></div>
            ) : (
              <Trash2 className="size-4" />
            )}
            {t('bulk_cancel_confirm', { defaultValue: 'Vider la caisse' })}
          </button>
        </div>
      </div>
    </PremiumModal>
  )
}
