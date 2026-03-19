import { useTranslation } from 'react-i18next'
import type { Facture } from '../../types'

interface FacturationNotificationsProps {
  error: string | null;
  setError: (val: string | null) => void;
  successInfo: Facture | null;
  setSuccessInfo: (val: Facture | null) => void;
  onOpenPaymentModal: (facture: Facture) => void;
  onShowTicket: () => void;
  onPrintA4: (facture: Facture) => void;
  ticketCaisse: any;
}

/**
 * Composant gérant les notifications (toasts) de succès ou d'erreur lors de la facturation.
 */
export default function FacturationNotifications({
  error,
  setError,
  successInfo,
  setSuccessInfo,
  onOpenPaymentModal,
  onShowTicket,
  onPrintA4,
  ticketCaisse
}: FacturationNotificationsProps) {
  const { t } = useTranslation(['facturation', 'common'])

  if (!error && !successInfo) return null

  return (
    <div className="toast toast-top toast-end z-[100] mt-16 mr-4">
      {/* Notification d'Erreur */}
      {error && (
        <div role="alert" className="alert alert-error shadow-lg max-w-md animate-in fade-in slide-in-from-right-5 duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div>
            <h3 className="font-bold">{t('common.error')}</h3>
            <div className="text-xs">{error}</div>
          </div>
          <button className="btn btn-sm btn-ghost btn-circle" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Notification de Succès */}
      {successInfo && (
        <div role="alert" className="alert alert-success shadow-lg max-w-lg flex-col items-start gap-2 animate-in fade-in slide-in-from-right-5 duration-300">
          <div className="flex items-center gap-2 w-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div className="flex-1">
              <h3 className="font-bold">{t('sale_recorded')} !</h3>
              <div className="text-xs">{t('invoice')} <span className="font-mono font-bold">{successInfo.numero_facture}</span> • {Math.round(Number(successInfo.total_ttc))} F</div>
            </div>
            <button className="btn btn-sm btn-ghost btn-circle self-start" onClick={() => setSuccessInfo(null)}>✕</button>
          </div>

          <div className="flex flex-wrap gap-2 w-full justify-end mt-1">
            {/* Bouton Paiement (si pas encore payée) */}
            {successInfo.status !== 'PAY' && (
              <button className="btn btn-sm btn-primary" onClick={() => onOpenPaymentModal(successInfo)}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
                {t('common.pay')}
              </button>
            )}
            
            {/* Bouton Ticket */}
            {successInfo.status === 'PAY' && ticketCaisse && (
              <button className="btn btn-sm btn-info text-white" onClick={() => onShowTicket()}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v4.072c.421.424.688 1.006.688 1.653 0 .647-.267 1.23-.688 1.653v4.072c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-4.072c-.421-.424-.688-1.006-.688-1.653 0-.647.267-1.23.688-1.653V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
                </svg>
                {t('common.ticket')}
              </button>
            )}
            
            {/* Bouton Impression A4 */}
            <button className="btn btn-sm btn-outline" onClick={() => onPrintA4(successInfo)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
              </svg>
              A4
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
