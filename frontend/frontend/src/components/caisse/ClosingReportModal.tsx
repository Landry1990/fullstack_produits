import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { Ticket, Printer, Banknote } from 'lucide-react'
import { gooeyToast } from 'goey-toast'
import { Button } from '../shadcn/button'
import { CashBreakdownModal, type CashBreakdown } from './CashBreakdownModal'
import { escHtml, printHtmlInIframe } from '../../utils/print/printHelpers'
import PremiumModal from '../common/PremiumModal'
import { formatCurrency } from '../../utils/formatters'
import { getPaymentModeWithIcon } from '../../config/paymentModes'

interface ClosingReport {
  poste?: { nom?: string }
  session?: {
    date_fermeture?: string
    fond_de_caisse?: number
    montant_encaisse?: number
    montant_theorique?: number
  }
  hide_amounts?: boolean
  details_par_mode?: Record<string, number>
  transactions?: { total?: number }
  detail?: string
}

interface ClosingReportModalProps {
  isOpen: boolean
  onClose: () => void
  report: unknown
}

export function ClosingReportModal({
  isOpen,
  onClose,
  report
}: ClosingReportModalProps) {
  const { t } = useTranslation('caisse')
  const r = report as ClosingReport
  const contentRef = useRef<HTMLDivElement>(null)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [breakdown, setBreakdown] = useState<CashBreakdown | null>(null)

  useEffect(() => {
    setBreakdown(null)
    setBreakdownOpen(false)
  }, [isOpen, report])

  const theoretical = r?.session?.montant_theorique
  const gap = breakdown && !r?.hide_amounts && theoretical != null && Number.isFinite(Number(theoretical))
    ? breakdown.total - Number(theoretical)
    : null

  const handlePrint = () => {
    if (!contentRef.current) return
    // Imprimer exactement les données visibles, sans reconstituer les montants masqués.
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(node => node.outerHTML).join('\n')
    const title = escHtml(t('cash_session.closing_report'))
    printHtmlInIframe(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${styles}
      <style>@page { size: A4; margin: 15mm; } body { background: white; color: black; }
      main { max-width: 700px; margin: auto; } h1 { font-size: 20px; text-align: center; }</style>
      </head><body><main><h1>${title}</h1>${contentRef.current.outerHTML}</main></body></html>`,
      () => gooeyToast.error(t('ticket.print_error')))
  }

  return (
    <>
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('cash_session.closing_report', { defaultValue: 'Rapport de Clôture' })}
      icon={<Ticket className="text-emerald-600 size-5" />}
      footer={
        <div className="flex flex-wrap justify-end gap-2 w-full">
          <Button variant="outline" size="sm" onClick={() => setBreakdownOpen(true)} disabled={!report}>
            <Banknote className="size-4 mr-1" />{t('cash_session.breakdown')}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={!report}>
            <Printer className="size-4 mr-1" />{t('common:print')}
          </Button>
          <button
            className="inline-flex items-center justify-center h-8 px-4 rounded-lg text-xs font-semibold bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-colors"
            onClick={onClose}
          >
            {t('common:actions.close', { defaultValue: 'Fermer' })}
          </button>
        </div>
      }
    >
      {!!report && (
        <div ref={contentRef} className="p-5 space-y-4">
          {/* En-tête */}
          <div className="text-center border-b border-slate-200 pb-4">
            <h3 className="font-bold text-lg text-slate-800">{r.poste?.nom}</h3>
            <p className="text-sm text-slate-500">
              {r.session?.date_fermeture ? new Date(r.session.date_fermeture).toLocaleString('fr-FR') : ''}
            </p>
          </div>

          {/* Stats - masquées si sécurité activée */}
          {!r.hide_amounts ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <p className="text-caption uppercase text-slate-500">{t('cash_session.fond_initial', { defaultValue: 'Fond Initial' })}</p>
                  <p className="font-mono font-bold text-lg text-slate-800">
                    {r.session?.fond_de_caisse?.toLocaleString('fr-FR')} F
                  </p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <p className="text-caption uppercase text-emerald-600">{t('cash_session.encaisse', { defaultValue: 'Encaissé' })}</p>
                  <p className="font-mono font-bold text-lg text-emerald-600">
                    {r.session?.montant_encaisse?.toLocaleString('fr-FR')} F
                  </p>
                </div>
              </div>

              {/* Total théorique */}
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                <p className="text-caption uppercase text-emerald-600 font-semibold mb-1">
                  {t('cash_session.total_theorique', { defaultValue: 'Total Théorique en Caisse' })}
                </p>
                <p className="font-mono font-bold text-2xl text-emerald-600">
                  {r.session?.montant_theorique?.toLocaleString('fr-FR')} F
                </p>
              </div>

              {/* Détails par mode de règlement */}
              {r.details_par_mode && Object.keys(r.details_par_mode).length > 0 && (
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                  <p className="text-caption uppercase text-slate-500 font-semibold mb-2">
                    {t('cash_session.details_by_mode', { defaultValue: 'Détails par mode de règlement' })}
                  </p>
                  <div className="space-y-1.5">
                    {Object.entries(r.details_par_mode)
                      .filter(([, v]) => Number(v) > 0)
                      .sort(([, a], [, b]) => Number(b) - Number(a))
                      .map(([mode, montant]) => (
                        <div key={mode} className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">{getPaymentModeWithIcon(mode, t)}</span>
                          <span className="font-mono font-bold text-slate-800">{formatCurrency(Math.round(Number(montant)))}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
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

          <section className="rounded-lg border border-slate-200 p-3 space-y-2 text-sm">
            <p className="text-xs text-slate-500">{t('cash_session.breakdown_hint')}</p>
            {breakdown && (
              <>
                <div className="flex justify-between gap-2">
                  <span>{t('cash_session.counted_total')}</span>
                  <strong>{formatCurrency(breakdown.total)}</strong>
                </div>
                {gap !== null && (
                  <div className="flex justify-between gap-2">
                    <span>{t('cash_session.counted_gap')}</span>
                    <strong>{gap > 0 ? '+' : ''}{formatCurrency(gap)}</strong>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Transactions */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">{t('cash_session.transactions', { defaultValue: 'Transactions' })}</span>
            <span className="font-bold text-slate-800">{r.transactions?.total || 0}</span>
          </div>

          {/* Message de confirmation */}
          <div className="text-center pt-2">
            <p className="text-sm text-emerald-600 font-medium">
              ✓ {r.hide_amounts && typeof r.detail === 'string' ? r.detail.replace(/\d[\d\s,.]*(?:\s*F)?/g, '***') : r.detail}
            </p>
          </div>
        </div>
      )}
    </PremiumModal>
    <CashBreakdownModal
      isOpen={isOpen && breakdownOpen}
      onClose={() => setBreakdownOpen(false)}
      onConfirm={setBreakdown}
      formatCurrency={formatCurrency}
    />
    </>
  )
}
