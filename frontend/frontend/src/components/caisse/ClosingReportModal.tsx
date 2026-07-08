import { useTranslation } from 'react-i18next'
import { Ticket } from 'lucide-react'
import PremiumModal from '../common/PremiumModal'

interface ClosingReportModalProps {
  isOpen: boolean
  onClose: () => void
  report: any
}

export function ClosingReportModal({
  isOpen,
  onClose,
  report
}: ClosingReportModalProps) {
  const { t } = useTranslation('caisse')

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('cash_session.closing_report', { defaultValue: 'Rapport de Clôture' })}
      icon={<Ticket className="text-emerald-600 size-5" />}
      footer={
        <div className="flex justify-end w-full">
          <button
            className="inline-flex items-center justify-center h-8 px-4 rounded-lg text-xs font-semibold bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-colors"
            onClick={onClose}
          >
            {t('common:actions.close', { defaultValue: 'Fermer' })}
          </button>
        </div>
      }
    >
      {report && (
        <div className="p-5 space-y-4">
          {/* En-tête */}
          <div className="text-center border-b border-slate-200 pb-4">
            <h3 className="font-bold text-lg text-slate-800">{report.poste?.nom}</h3>
            <p className="text-sm text-slate-500">
              {new Date(report.session?.date_fermeture).toLocaleString('fr-FR')}
            </p>
          </div>

          {/* Stats - masquées si sécurité activée */}
          {!report.hide_amounts ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <p className="text-[10px] uppercase text-slate-500">{t('cash_session.fond_initial', { defaultValue: 'Fond Initial' })}</p>
                  <p className="font-mono font-bold text-lg text-slate-800">
                    {report.session?.fond_de_caisse?.toLocaleString('fr-FR')} F
                  </p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <p className="text-[10px] uppercase text-emerald-600">{t('cash_session.encaisse', { defaultValue: 'Encaissé' })}</p>
                  <p className="font-mono font-bold text-lg text-emerald-600">
                    {report.session?.montant_encaisse?.toLocaleString('fr-FR')} F
                  </p>
                </div>
              </div>

              {/* Total théorique */}
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                <p className="text-[10px] uppercase text-emerald-600 font-semibold mb-1">
                  {t('cash_session.total_theorique', { defaultValue: 'Total Théorique en Caisse' })}
                </p>
                <p className="font-mono font-bold text-2xl text-emerald-600">
                  {report.session?.montant_theorique?.toLocaleString('fr-FR')} F
                </p>
              </div>
            </>
          ) : (
            /* Mode sécurité - montants masqués */
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-center">
              <p className="text-amber-600 text-sm font-medium mb-2">{t('cash_session.security_mode_title')}</p>
              <p className="text-slate-500 text-xs">
                {t('cash_session.amounts_hidden')}
              </p>
              <div className="mt-3 space-y-2">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-2xl font-mono text-slate-800">*** *** F</span>
                </div>
              </div>
            </div>
          )}

          {/* Transactions */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">{t('cash_session.transactions', { defaultValue: 'Transactions' })}</span>
            <span className="font-bold text-slate-800">{report.transactions?.total || 0}</span>
          </div>

          {/* Message de confirmation */}
          <div className="text-center pt-2">
            <p className="text-sm text-emerald-600 font-medium">✓ {report.detail}</p>
          </div>
        </div>
      )}
    </PremiumModal>
  )
}
