import { useTranslation } from 'react-i18next'
import PremiumModal from '../common/PremiumModal'

interface CouponGenerateModalProps {
  isOpen: boolean
  onClose: () => void
  montant: string
  onMontantChange: (value: string) => void
  notes: string
  onNotesChange: (value: string) => void
  onSubmit: () => void
  loading?: boolean
}

export function CouponGenerateModal({
  isOpen,
  onClose,
  montant,
  onMontantChange,
  notes,
  onNotesChange,
  onSubmit,
  loading = false
}: CouponGenerateModalProps) {
  const { t } = useTranslation('caisse')

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('coupons.generate_modal.title')}
      icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <button
            className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            onClick={onClose}
          >
            {t('table.cancel')}
          </button>
          <button
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-colors"
            onClick={onSubmit}
            disabled={loading || !montant}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {t('coupons.sudo_validate')}
          </button>
        </div>
      }
    >
      <div className="p-6">
        <div className="w-full mb-4">
          <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">{t('coupons.generate_modal.amount')} (F)</label>
          <input
            type="number"
            className="w-full h-12 rounded-lg border border-slate-200 bg-white px-3 text-2xl font-bold text-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            placeholder="Ex: 250"
            value={montant}
            onChange={(e) => onMontantChange(e.target.value)}
            autoFocus
          />
        </div>

        <div className="w-full mb-4">
          <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">{t('coupons.generate_modal.notes')}</label>
          <textarea
            className="w-full h-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
            placeholder={t('movement_modal.description_placeholder')}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
          ></textarea>
        </div>
      </div>
    </PremiumModal>
  )
}
