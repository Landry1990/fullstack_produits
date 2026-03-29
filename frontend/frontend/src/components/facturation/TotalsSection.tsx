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
        <div className="flex flex-row flex-wrap gap-4 sm:gap-8 justify-end items-start text-sm">
          
          {/* Total HT */}
          <div className="flex flex-col items-center sm:items-end gap-1">
            <span className="text-base-content/50 text-[10px] sm:text-xs font-bold uppercase tracking-widest leading-none">{t('facturation:totals.subtotal')}</span>
            <span className="font-bold text-lg sm:text-2xl text-base-content/80 whitespace-nowrap">
                {formatCurrency(Math.round(totalHT))} <span className="text-xs font-normal opacity-50">F</span>
            </span>
          </div>

          {/* Remise Globale */}
          <div className="flex flex-col items-center sm:items-end gap-1">
            <span className="text-base-content/50 text-[10px] sm:text-xs font-bold uppercase tracking-widest leading-none">{t('facturation:totals.discount')}</span>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="join shadow-sm border border-base-300 rounded-lg overflow-hidden h-8 sm:h-10">
                <select
                    value={remiseMode}
                    onChange={(e) => setRemiseMode(e.target.value as 'montant' | 'taux')}
                    className="select select-ghost select-xs sm:select-sm join-item bg-base-200/50 border-r border-base-300 focus:bg-base-200 px-1 sm:px-2"
                >
                    <option value="montant">F</option>
                    <option value="taux">%</option>
                </select>
                <input
                    type="text"
                    value={remiseGlobale}
                    onChange={(e) => setRemiseGlobale(e.target.value)}
                    className="input input-ghost input-xs sm:input-sm join-item w-16 sm:w-24 text-right focus:bg-base-100 bg-transparent font-bold"
                    placeholder="0"
                />
              </div>
              <span className="text-error font-bold whitespace-nowrap text-sm sm:text-lg ml-1">
                -{formatCurrency(Math.round(remiseMontant))}
              </span>
            </div>
          </div>

          {/* TVA */}
          {tvaAmount > 0 ? (
            <div className="flex flex-col items-center sm:items-end gap-1">
                <span className="text-base-content/50 text-[10px] sm:text-xs font-bold uppercase tracking-widest leading-none">{t('facturation:totals.tva')}</span>
                <span className="font-medium text-lg sm:text-2xl text-base-content/60 italic">
                    {formatCurrency(Math.round(tvaAmount))}
                </span>
            </div>
          ) : <div className="hidden sm:block w-px h-10 bg-base-200 ml-2"></div>}

          {/* Tiers Payant Detail */}
          {tauxCouverture > 0 && (
             <div className="flex flex-col items-center sm:items-end gap-1 px-4 border-l border-base-200 py-0.5">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-black text-info tracking-tighter">{t('facturation:totals.assurance_label')}</span>
                    <span className="badge badge-info badge-sm font-bold">{tauxCouverture}%</span>
                </div>
                <span className="font-black text-lg sm:text-2xl text-info">
                    {formatCurrency(Math.round(partAssurance))}
                </span>
             </div>
          )}

          {/* Total TTC & Net à Payer */}
          <div className="flex flex-col items-center sm:items-end gap-1 pl-4 sm:pl-8 border-l-2 border-primary/20">
            <span className="text-primary/60 text-[10px] sm:text-xs font-black uppercase tracking-widest leading-none">
                {tauxCouverture > 0 ? t('facturation:totals.part_patient') : t('facturation:totals.total_ttc')}
            </span>
            <div className="flex items-baseline gap-1">
                <span className="font-black text-3xl sm:text-5xl text-primary tracking-tighter">
                    {formatCurrency(Math.round(tauxCouverture > 0 ? partPatient : totalTTC))}
                </span>
                <span className="text-lg sm:text-2xl font-bold text-primary/70 uppercase">F</span>
            </div>
            
            {tauxCouverture > 0 && (
                <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-tighter">
                    {t('facturation:totals.total_ttc')}: {formatCurrency(Math.round(totalTTC))} F
                </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
