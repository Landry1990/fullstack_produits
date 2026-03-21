import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../utils/formatters'

interface TotalsSectionProps {
  totalHT: number
  remiseGlobale: string
  setRemiseGlobale: (v: string) => void
  remiseMode: 'montant' | 'taux'
  setRemiseMode: (v: 'montant' | 'taux') => void
  remiseMontant: number
  tvaAmount: number
  totalTTC: number
  // Tiers Payant Props
  tauxCouverture?: number
  partAssurance?: number
  partPatient?: number
  onOpenOrdonnanceModal?: () => void
  ordonnanceData?: any // Adjust type if known
}

export default function TotalsSection({
  totalHT,
  remiseGlobale,
  setRemiseGlobale,
  remiseMode,
  setRemiseMode,
  remiseMontant,
  tvaAmount,
  totalTTC,
  tauxCouverture = 0,
  partAssurance = 0,
  partPatient = 0
}: TotalsSectionProps) {
  const { t } = useTranslation(['facturation', 'common'])

  return (
    <div className="bg-base-100 border-t border-base-200 p-3 md:p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        {/* Ligne principale des totaux */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-6 md:gap-8 items-end justify-end text-sm">
          
          {/* Total HT */}
          <div className="flex flex-col items-end gap-0.5 sm:gap-1">
            <span className="text-base-content/50 text-[10px] sm:text-xs font-bold uppercase tracking-wider">{t('facturation:totals.subtotal')}</span>
            <span className="font-medium text-base sm:text-lg">{formatCurrency(Math.round(totalHT))}</span>
          </div>

          {/* Remise Globale */}
          <div className="flex flex-col items-end gap-0.5 sm:gap-1">
            <span className="text-base-content/50 text-[10px] sm:text-xs font-bold uppercase tracking-wider">{t('facturation:totals.discount')}</span>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <select
                value={remiseMode}
                onChange={(e) => setRemiseMode(e.target.value as 'montant' | 'taux')}
                className="select select-xs sm:select-sm select-bordered text-[10px] sm:text-xs h-7 sm:h-8"
              >
                <option value="montant">F</option>
                <option value="taux">%</option>
              </select>
              <input
                type="text"
                value={remiseGlobale}
                onChange={(e) => setRemiseGlobale(e.target.value)}
                className="input input-xs sm:input-sm input-bordered w-16 sm:w-20 text-right focus:bg-base-100 bg-base-50 transition-colors h-7 sm:h-8"
                placeholder={remiseMode === 'taux' ? '0%' : '0 F'}
              />
                <span className="text-error font-medium whitespace-nowrap text-xs sm:text-sm">-{formatCurrency(Math.round(remiseMontant))}</span>
            </div>
          </div>

          {/* TVA */}
          <div className="flex flex-col items-end gap-0.5 sm:gap-1 hidden xs:flex">
            <span className="text-base-content/50 text-[10px] sm:text-xs font-bold uppercase tracking-wider">{t('facturation:totals.tva')}</span>
            <span className={`font-medium text-base sm:text-lg ${tvaAmount > 0 ? 'text-base-content' : 'text-base-content/30'}`}>
              {formatCurrency(Math.round(tvaAmount))}
            </span>
          </div>

          {/* Tiers Payant Detail */}
          {tauxCouverture > 0 && (
             <div className="flex flex-col items-end gap-0.5 sm:gap-1 px-3 sm:px-4 border-l border-r border-base-200 bg-base-50/50 rounded py-1">
                <div className="flex items-center gap-2">
                    <span className="badge badge-xs sm:badge-sm badge-info">{tauxCouverture}%</span>
                    <span className="text-[10px] uppercase font-bold text-base-content/50">{t('facturation:totals.assurance_label')}</span>
                </div>
                <span className="font-bold text-sm sm:text-base text-info">{formatCurrency(Math.round(partAssurance))}</span>
             </div>
          )}

          {/* Total TTC & Net à Payer */}
          <div className="flex flex-col items-end gap-0.5 sm:gap-1 pl-4 sm:pl-8 border-l border-base-200">
            <span className="text-base-content/50 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                {tauxCouverture > 0 ? t('facturation:totals.part_patient') : t('facturation:totals.total_ttc')}
            </span>
            <span className="font-bold text-2xl sm:text-3xl text-primary">
                {formatCurrency(Math.round(tauxCouverture > 0 ? partPatient : totalTTC))}
            </span>
            
                <span className="text-[10px] text-base-content/40 mt-1">
                    {t('facturation:totals.total_ttc')}: {formatCurrency(Math.round(totalTTC))}
                </span>
          </div>
        </div>
      </div>
    </div>
  )
}
