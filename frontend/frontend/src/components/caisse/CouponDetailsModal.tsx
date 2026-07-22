import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../utils/formatters'
import { escHtml } from '../../utils/print/printHelpers'
import PremiumModal from '../common/PremiumModal'
import type { CouponMonnaie, Facture } from '../../types'

interface CouponDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  coupon: CouponMonnaie | null
  factureForCoupon: Facture | null
  onAppliquer: (coupon: CouponMonnaie, facture: Facture) => void
  settings: unknown
}

export function CouponDetailsModal({
  isOpen,
  onClose,
  coupon,
  factureForCoupon,
  onAppliquer,
  settings
}: CouponDetailsModalProps) {
  const { t } = useTranslation('caisse')

  const handlePrintCoupon = () => {
    if (!coupon) return
    const win = window.open('about:blank', '', 'height=600,width=400')
    if (win) {
      const dateStr = new Date(coupon.date_creation).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })

      win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Coupon de Monnaie</title>
  <style>
    @media print {
      @page {
        size: 80mm auto;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 10mm 5mm;
      }
    }
    body {
      font-family: 'Courier New', monospace;
      width: 80mm;
      margin: 0 auto;
      padding: 10mm 5mm;
      font-size: 11px;
      line-height: 1.4;
      color: #000;
      background: #fff;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .pharmacy-name {
      font-size: 16px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .pharmacy-info {
      font-size: 10px;
      line-height: 1.3;
    }
    .coupon-box {
      border: 2px dashed #000;
      padding: 15px;
      margin: 15px 0;
      text-align: center;
    }
    .coupon-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 5px;
      font-weight: bold;
    }
    .coupon-number {
      font-size: 24px;
      font-weight: bold;
      margin: 8px 0;
      font-family: 'Courier New', monospace;
    }
    .coupon-amount {
      font-size: 32px;
      font-weight: bold;
      margin: 10px 0;
      color: #000;
    }
    .info-section {
      margin-top: 15px;
      font-size: 10px;
      text-align: left;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .info-label {
      font-weight: bold;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border: 1px solid #000;
      font-size: 9px;
      margin-left: 5px;
    }
    .notes {
      margin-top: 12px;
      padding: 8px;
      background: #f5f5f5;
      border: 1px solid #ddd;
      font-size: 9px;
      font-style: italic;
      text-align: left;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #000;
      font-size: 9px;
    }
    .warning {
      font-size: 9px;
      color: #666;
      margin-top: 10px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="pharmacy-name">${escHtml(settings.pharmacy_name || 'PHARMACIE')}</div>
    <div class="pharmacy-info">
      ${settings.city ? `${escHtml(settings.city)}` : ''}${settings.country ? `, ${escHtml(settings.country)}` : ''}<br>
      ${settings.phone ? `Tel: ${escHtml(settings.phone)}` : ''}<br>
      ${settings.niu ? `NIU: ${escHtml(settings.niu)}` : ''}<br>
      ${settings.registre_commerce ? `RC: ${escHtml(settings.registre_commerce)}` : ''}
    </div>
  </div>
  
  <div class="coupon-box">
    <div class="coupon-label">Coupon de Monnaie</div>
    <div class="coupon-number">#${escHtml(coupon.numero)}</div>
    <div class="coupon-amount">${formatCurrency(Math.round(Number(coupon.montant)))}</div>
  </div>
  
  <div class="info-section">
    <div class="info-row">
      <span class="info-label">Statut:</span>
      <span>${escHtml(coupon.status_display || coupon.status)}<span class="status-badge">${escHtml(coupon.status)}</span></span>
    </div>
    <div class="info-row">
      <span class="info-label">Généré par:</span>
      <span>${escHtml(coupon.cree_par_nom || 'Système')}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Date:</span>
      <span>${dateStr}</span>
    </div>
    ${coupon.facture_origine ? `
    <div class="info-row">
      <span class="info-label">Facture origine:</span>
      <span>#${coupon.facture_origine}</span>
    </div>
    ` : ''}
  </div>
  
  ${coupon.notes ? `
  <div class="notes">
    <strong>Notes:</strong><br>
    ${escHtml(coupon.notes)}
  </div>
  ` : ''}
  
  <div class="warning">
    Ce coupon est valable uniquement dans cette pharmacie
  </div>
  
  <div class="footer">
    ${escHtml(settings.ticket_footer_message || 'Merci de votre visite !')}
  </div>
</body>
</html>`)
      win.document.close()
      win.onload = () => {
        setTimeout(() => {
          win.print()
        }, 250)
      }
    }
  }

  return (
    <PremiumModal
      isOpen={isOpen && !!coupon}
      onClose={onClose}
      title={t('coupons.details_modal.title')}
      icon={<span className="text-emerald-600 text-xl">🎫</span>}
      footer={
        <div className="flex justify-between gap-2 w-full">
          <button
            className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-semibold border-2 border-slate-200 text-slate-600 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
            onClick={handlePrintCoupon}
          >
            {t('coupons.details_modal.print')}
          </button>
          <div className="flex gap-2">
            <button
              className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              onClick={onClose}
            >
              {t('coupons.details_modal.close') || 'Fermer'}
            </button>
            {coupon && coupon.status === 'ACTIF' && factureForCoupon && (
              <button
                className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-colors"
                onClick={() => onAppliquer(coupon, factureForCoupon)}
              >
                {t('table.apply_coupon')} #{factureForCoupon.session_ticket_number}
              </button>
            )}
            {coupon && coupon.status === 'ACTIF' && !factureForCoupon && (
              <div className="text-xs text-amber-600">{t('coupons.select_sale_first')}</div>
            )}
          </div>
        </div>
      }
    >
      <div className="p-6">
        {coupon && (
          <div className="text-center p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t('coupons.coupon_label')}</div>
            <div className="text-4xl font-black text-emerald-600 font-mono mb-2">#{coupon.numero}</div>
            <div className="text-3xl font-bold text-slate-800 mb-4">{Math.round(Number(coupon.montant))} F</div>
            <div className="border-t border-slate-200 my-2"></div>
            <div className="text-left space-y-2 text-xs text-slate-700">
              <div className="flex justify-between">
                <span>{t('coupons.headers.status')}:</span>
                <span className={`inline-flex items-center px-2 h-5 text-[10px] rounded font-semibold ${
                  coupon.status === 'ACTIF' ? 'bg-emerald-100 text-emerald-700' :
                  coupon.status === 'UTILISE' ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-500'
                }`}>
                  {coupon.status_display || coupon.status}
                </span>
              </div>

              <div className="border-t border-slate-200 my-1"></div>

              <div className="bg-white p-2 rounded border border-slate-200 space-y-1">
                <div className="font-bold text-[10px] uppercase text-slate-500 mb-1">{t('coupons.creation')}</div>
                <div className="flex justify-between">
                  <span>{t('coupons.generated_by')}</span>
                  <span className="font-medium">{coupon.cree_par_nom || t('coupons.system')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('table.date_time')}</span>
                  <span className="font-medium">{new Date(coupon.date_creation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                </div>
              </div>

              {coupon.status === 'UTILISE' && (
                <div className="bg-emerald-50 p-2 rounded border border-emerald-100 space-y-1">
                  <div className="font-bold text-[10px] uppercase text-emerald-600 text-slate-500 mb-1">{t('coupons.headers.usage')}</div>
                  <div className="flex justify-between">
                    <span>{t('coupons.used_by')}</span>
                    <span className="font-medium">{coupon.utilise_par_nom || t('coupons.na')}</span>
                  </div>
                  {coupon.date_utilisation && (
                    <div className="flex justify-between">
                      <span>{t('table.date_time')}</span>
                      <span>{new Date(coupon.date_utilisation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                    </div>
                  )}
                </div>
              )}

              {coupon.notes && (
                <div className="mt-2 p-2 bg-white rounded italic border border-slate-200 text-slate-600">
                  <span className="font-bold not-italic text-slate-500 block text-[10px] mb-1">{t('coupons.notes_label')}:</span>
                  "{coupon.notes}"
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PremiumModal>
  )
}
