import { useTranslation } from 'react-i18next'

interface ActionButtonsProps {
  onPayment: () => void
  onProforma: () => void
  onSuspend: () => void
  onCancel: () => void
  onViewPending?: () => void
  pendingCount?: number
  isValid: boolean
  isRetrocession?: boolean
  setIsRetrocession?: (v: boolean) => void
  loading?: boolean
}

export default function ActionButtons({
  onPayment,
  onProforma,
  onSuspend,
  onCancel,
  onViewPending,
  pendingCount = 0,
  isValid,
  isRetrocession = false,
  setIsRetrocession,
  loading = false
}: ActionButtonsProps) {
  const { t } = useTranslation()

  return (
    <div className="bg-white border-t border-base-200 p-1.5 sm:p-4 shadow-sm shrink-0">
      <div className="flex flex-col md:flex-row gap-1.5 sm:gap-3 justify-between items-stretch sm:items-center">
          <button
            onClick={onCancel}
            className="btn btn-xs sm:btn-md btn-outline btn-error w-full md:w-auto gap-1.5 order-last md:order-first"
            title={t('facturation.actions.reset_tooltip')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            <span className="text-[10px] sm:text-base">{t('facturation.actions.cancel')}</span>
          </button>

        <div className="grid grid-cols-2 md:flex md:flex-row gap-1.5 sm:gap-3 w-full md:w-auto">
          <label 
            className={`btn btn-xs sm:btn-md gap-1.5 sm:gap-2 col-span-2 sm:col-span-1 border-dashed ${isRetrocession ? 'btn-warning' : 'btn-outline btn-warning'}`}
            title={t('facturation.retrocession_mode')}
          >
            <input
              type="checkbox"
              checked={isRetrocession}
              onChange={(e) => setIsRetrocession?.(e.target.checked)}
              className={`checkbox checkbox-xs ${isRetrocession ? 'border-yellow-900' : 'checkbox-warning'}`}
            />
            <span className="text-[10px] sm:text-base font-bold uppercase tracking-wider whitespace-nowrap">
              {t('facturation.retrocession_mode')}
            </span>
          </label>

          <button
            onClick={onSuspend}
            disabled={!isValid || loading}
            className="btn btn-xs sm:btn-md btn-warning btn-outline gap-1 sm:gap-2"
            title={t('facturation.actions.suspend_tooltip')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="text-[10px] sm:text-base">{t('facturation.actions.suspend_short')}</span>
          </button>
          
          {pendingCount > 0 && onViewPending && (
            <button
              onClick={onViewPending}
              className="btn btn-xs sm:btn-md btn-accent btn-outline gap-1 sm:gap-2 relative"
              title={t('facturation.actions.view_pending_tooltip')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <span className="text-[10px] sm:text-base">{t('facturation.actions.pending')}</span>
              <span className="badge badge-warning badge-[8px] h-3.5 sm:badge-sm absolute -top-1 -right-1">{pendingCount}</span>
            </button>
          )}

          <button
            onClick={onProforma}
            disabled={!isValid || loading}
            className="btn btn-xs sm:btn-md btn-info btn-outline gap-1 sm:gap-2"
            title={t('facturation.actions.proforma_tooltip')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="text-[10px] sm:text-base">{t('facturation.actions.proforma')}</span>
          </button>

          <button
            onClick={onPayment}
            disabled={!isValid || loading}
            className="btn btn-xs sm:btn-md btn-primary gap-1 sm:gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow col-span-2 sm:col-span-1"
            title={t('facturation.actions.pay_tooltip')}
          >
            {loading ? <span className="loading loading-spinner w-3.5 h-3.5 sm:w-5 sm:h-5"></span> : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
            )}
            <span className="font-bold text-xs sm:text-base">{t('facturation.actions.pay')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
