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
  ordonnanceData?: any 
  isSidebarStyle?: boolean
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
  partPatient = 0,
  isSidebarStyle
}: TotalsSectionProps) {
  const { t } = useTranslation(['facturation', 'common'])

  if (isSidebarStyle) {
    const mainTotal = tauxCouverture > 0 ? partPatient : totalTTC

    return (
      <div className="flex flex-col gap-3">
        {/* Subtotal & Discount row */}
        <div className="flex justify-between items-end border-b border-white/5 pb-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{t('facturation:totals.subtotal')}</span>
            <span className="text-sm font-bold text-white/70">{formatCurrency(Math.round(totalHT))}</span>
          </div>
          
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{t('facturation:totals.discount')}</span>
            <div className="flex items-center gap-2">
               <div className="flex items-center bg-white/5 border border-white/10 rounded overflow-hidden">
                  <select 
                    value={remiseMode} 
                    onChange={(e) => setRemiseMode(e.target.value as any)}
                    className="bg-transparent text-[10px] text-white/50 border-r border-white/10 px-1 outline-none"
                  >
                    <option value="montant">F</option>
                    <option value="taux">%</option>
                  </select>
                  <input 
                    type="text" 
                    value={remiseGlobale}
                    onChange={(e) => setRemiseGlobale(e.target.value)}
                    className="w-12 bg-transparent text-xs text-right font-bold text-white outline-none px-1"
                  />
               </div>
               <span className="text-xs font-bold text-red-500/80">-{formatCurrency(Math.round(remiseMontant))}</span>
            </div>
          </div>
        </div>

        {/* Tiers Payant / Insurance Info */}
        {tauxCouverture > 0 && (
          <div className="flex justify-between items-center py-2 px-3 bg-secondary/10 border border-secondary/20 rounded-lg">
             <div className="flex flex-col">
                <span className="text-[9px] text-secondary font-black uppercase tracking-tighter">Part Assurance ({tauxCouverture}%)</span>
                <span className="text-sm font-bold text-secondary">{formatCurrency(Math.round(partAssurance))}</span>
             </div>
             <div className="text-right">
                <span className="text-[9px] text-white/20 uppercase font-bold">Total TTC</span>
                <div className="text-[10px] text-white/40">{formatCurrency(Math.round(totalTTC))}</div>
             </div>
          </div>
        )}

        {/* Main Grand Total */}
        <div className="relative overflow-hidden group">
          <div className="flex flex-col items-end p-4 rounded-xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 shadow-2xl">
             <span className="text-[11px] text-primary/60 font-black uppercase tracking-[0.2em] mb-1">
                {tauxCouverture > 0 ? t('facturation:totals.part_patient') : t('facturation:totals.total_ttc')}
             </span>
             <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-white tracking-tighter">
                   {formatCurrency(Math.round(mainTotal))}
                </span>
             </div>
          </div>
          {/* Decorative shine effect */}
          <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white/5 to-transparent group-hover:animate-shine" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-base-100 border-t border-base-200 p-3 md:p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        {/* Ligne principale des totaux */}
        <div className="flex flex-row flex-wrap gap-4 sm:gap-8 justify-end items-start text-sm">
          
          {/* Total HT */}
          <div className="flex flex-col items-center sm:items-end gap-1">
            <span className="text-base-content/50 text-[10px] sm:text-xs font-bold uppercase tracking-widest leading-none">{t('facturation:totals.subtotal')}</span>
            <span className="font-bold text-lg sm:text-2xl text-base-content/80 whitespace-nowrap">
                {formatCurrency(Math.round(totalHT))}
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
            </div>
            
            {tauxCouverture > 0 && (
                <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-tighter">
                    {t('facturation:totals.total_ttc')}: {formatCurrency(Math.round(totalTTC))}
                </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
