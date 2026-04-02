import { useTranslation } from 'react-i18next'

interface ActionButtonsProps {
  onPayment: () => void
  onProforma: () => void
  onBonDeLivraison: () => void
  onSuspend: () => void
  onCancel: () => void
  isValid: boolean
  isRetrocession?: boolean
  setIsRetrocession?: (v: boolean) => void
  isFactureA4?: boolean
  setIsFactureA4?: (v: boolean) => void
  loading?: boolean
}

export default function ActionButtons({
  onPayment,
  onProforma,
  onBonDeLivraison,
  onSuspend,
  onCancel,
  isValid,
  isRetrocession = false,
  setIsRetrocession,
  isFactureA4 = false,
  setIsFactureA4,
  loading = false
}: ActionButtonsProps) {
  const { t } = useTranslation(['facturation', 'common'])

  return (
    <div className="bg-base-100 border-t border-base-200 p-2 sm:p-4 shadow-sm shrink-0">
      <div className="flex flex-row gap-2 justify-between items-center">
        
        {/* ACTION DROPDOWN FOR SECONDARY ACTIONS */}
        <div className="dropdown dropdown-top dropdown-start">
          <label tabIndex={0} className="btn btn-sm sm:btn-md btn-outline gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
            <span className="hidden sm:inline uppercase text-xs font-bold tracking-wider">{t('common:actions_title')}</span>
          </label>
          <ul tabIndex={0} className="dropdown-content z-[100] menu p-2 shadow-2xl bg-base-100 border border-base-200 rounded-box w-64 mb-2">
            {/* MODES SECTION */}
            <li className="menu-title text-[10px] uppercase opacity-50 px-2 mt-1">Modes</li>
            <li>
                <label className="flex items-center justify-between cursor-pointer py-2 active:bg-base-200">
                    <span className="text-xs font-medium uppercase">{t('facturation:actions.retrocession_mode')}</span>
                    <input
                        type="checkbox"
                        checked={isRetrocession}
                        onChange={(e) => setIsRetrocession?.(e.target.checked)}
                        className="checkbox checkbox-xs checkbox-warning"
                    />
                </label>
            </li>
            <li>
                <label className="flex items-center justify-between cursor-pointer py-2 active:bg-base-200">
                    <span className="text-xs font-medium uppercase">{t('facturation:actions.facture_a4')}</span>
                    <input
                        type="checkbox"
                        checked={isFactureA4}
                        onChange={(e) => setIsFactureA4?.(e.target.checked)}
                        className="checkbox checkbox-xs checkbox-info"
                    />
                </label>
            </li>

            <div className="divider my-1 opacity-50"></div>

            {/* DOCUMENTS SECTION */}
            <li className="menu-title text-[10px] uppercase opacity-50 px-2">Documents</li>
            <li>
              <button onClick={onProforma} disabled={!isValid || loading} className="py-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="text-xs uppercase font-bold">{t('facturation:actions.proforma')}</span>
              </button>
            </li>
            <li>
              <button onClick={onBonDeLivraison} disabled={!isValid || loading} className="py-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1" /></svg>
                <span className="text-xs uppercase font-bold">{t('facturation:actions.delivery_note')}</span>
              </button>
            </li>

            <div className="divider my-1 opacity-50"></div>

            {/* SALES MANAGEMENT */}
            <li className="menu-title text-[10px] uppercase opacity-50 px-2">Gestion Vente</li>
            <li>
              <button 
                onClick={onSuspend} 
                disabled={!isValid || loading}
                className="py-2.5"
                title={t('facturation:actions.suspend_tooltip')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-xs uppercase font-bold text-warning">{t('facturation:actions.suspend_short')}</span>
                <div className="ml-auto flex gap-1">
                    <kbd className="kbd kbd-xs tracking-tighter">F7</kbd>
                    <kbd className="kbd kbd-xs tracking-tighter">Ctrl+S</kbd>
                </div>
              </button>
            </li>
            <li>
              <button 
                onClick={onCancel} 
                className="py-2.5 text-error hover:bg-error/10"
                title={t('facturation:actions.reset_tooltip')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                <span className="text-xs uppercase font-bold">{t('facturation:actions.cancel')}</span>
                <kbd className="kbd kbd-xs ml-auto">Esc</kbd>
              </button>
            </li>
          </ul>
        </div>

        {/* PRIMARY ACTION: PAYMENT */}
        <button
          onClick={onPayment}
          disabled={!isValid || loading}
          className="btn btn-sm sm:btn-md btn-primary flex-1 max-w-md gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95"
          title={t('facturation:actions.pay_tooltip')}
        >
          {loading ? <span className="loading loading-spinner w-4 h-4 sm:w-5 sm:h-5"></span> : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
          )}
          <span className="font-bold text-xs sm:text-lg uppercase tracking-wider">{t('facturation:actions.pay')}</span>
          <kbd className="kbd kbd-sm bg-primary-focus border-none text-white hidden sm:flex">F9</kbd>
        </button>
      </div>
    </div>
  )
}
