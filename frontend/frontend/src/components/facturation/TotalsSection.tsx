import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../utils/formatters'
import { cn } from '../../lib/utils'
import { Badge } from '../shadcn/badge'

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
        <div className="flex justify-between items-end border-b border-slate-200 pb-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{t('facturation:totals.subtotal')}</span>
            <span className="text-sm font-bold text-slate-600">{formatCurrency(Math.round(totalHT))}</span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{t('facturation:totals.discount')}</span>
            <div className="flex items-center gap-2">
               <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  <select
                    value={remiseMode}
                    onChange={(e) => setRemiseMode(e.target.value as 'montant' | 'taux')}
                    className="bg-transparent text-[10px] text-slate-500 border-r border-slate-200 px-2 py-1 outline-none"
                  >
                    <option value="montant">F</option>
                    <option value="taux">%</option>
                  </select>
                  <input
                    type="text"
                    value={remiseGlobale}
                    onChange={(e) => setRemiseGlobale(e.target.value)}
                    className="w-14 bg-transparent text-xs text-right font-semibold text-slate-700 outline-none px-2 py-1"
                  />
               </div>
               <span className="text-xs font-bold text-red-500">-{formatCurrency(Math.round(remiseMontant))}</span>
            </div>
          </div>
        </div>

        {/* Tiers Payant / Insurance Info */}
        {tauxCouverture > 0 && (
          <div className="flex justify-between items-center py-2.5 px-3 bg-blue-50 border border-blue-200 rounded-xl">
             <div className="flex flex-col">
                <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wide">Part Assurance ({tauxCouverture}%)</span>
                <span className="text-sm font-bold text-blue-700">{formatCurrency(Math.round(partAssurance))}</span>
             </div>
             <div className="text-right">
                <span className="text-[9px] text-slate-400 uppercase font-semibold">Total TTC</span>
                <div className="text-[10px] text-slate-500">{formatCurrency(Math.round(totalTTC))}</div>
             </div>
          </div>
        )}

        {/* Main Grand Total */}
        <div className="relative overflow-hidden group">
          <div className="flex flex-col items-end p-4 rounded-xl bg-emerald-50 border border-emerald-200 shadow-sm">
             <span className="text-[11px] text-emerald-600 font-bold uppercase tracking-wider mb-1">
                {tauxCouverture > 0 ? t('facturation:totals.part_patient') : t('facturation:totals.total_ttc')}
             </span>
             <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-emerald-700 tracking-tight">
                   {formatCurrency(Math.round(mainTotal))}
                </span>
             </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border-t border-slate-200 p-4 md:p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        {/* Ligne principale des totaux */}
        <div className="flex flex-row flex-wrap gap-4 sm:gap-8 justify-end items-start text-sm">
          
          {/* Total HT */}
          <div className="flex flex-col items-center sm:items-end gap-1">
            <span className="text-slate-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider leading-none">{t('facturation:totals.subtotal')}</span>
            <span className="font-bold text-lg sm:text-2xl text-slate-700 whitespace-nowrap">
                {formatCurrency(Math.round(totalHT))}
            </span>
          </div>

          {/* Remise Globale */}
          <div className="flex flex-col items-center sm:items-end gap-1">
            <span className="text-slate-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider leading-none">{t('facturation:totals.discount')}</span>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="flex shadow-sm border border-slate-200 rounded-lg overflow-hidden h-9 sm:h-10">
                <select
                    value={remiseMode}
                    onChange={(e) => setRemiseMode(e.target.value as 'montant' | 'taux')}
                    className="bg-slate-100 border-r border-slate-200 text-[10px] sm:text-xs text-slate-600 focus:bg-slate-50 px-2 outline-none"
                >
                    <option value="montant">F</option>
                    <option value="taux">%</option>
                </select>
                <input
                    type="text"
                    value={remiseGlobale}
                    onChange={(e) => setRemiseGlobale(e.target.value)}
                    className="w-16 sm:w-24 text-right focus:bg-white bg-transparent font-semibold text-sm sm:text-base outline-none px-2"
                    placeholder="0"
                />
              </div>
              <span className="text-red-500 font-bold whitespace-nowrap text-sm sm:text-lg ml-1">
                -{formatCurrency(Math.round(remiseMontant))}
              </span>
            </div>
          </div>

          {/* TVA */}
          {tvaAmount > 0 ? (
            <div className="flex flex-col items-center sm:items-end gap-1">
                <span className="text-slate-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider leading-none">{t('facturation:totals.tva')}</span>
                <span className="font-medium text-lg sm:text-2xl text-slate-500 italic">
                    {formatCurrency(Math.round(tvaAmount))}
                </span>
            </div>
          ) : <div className="hidden sm:block w-px h-10 bg-slate-200 ml-2"></div>}

          {/* Tiers Payant Detail */}
          {tauxCouverture > 0 && (
             <div className="flex flex-col items-center sm:items-end gap-1 px-4 border-l border-slate-200 py-0.5">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wide">{t('facturation:totals.assurance_label')}</span>
                    <Badge variant="secondary" className="text-[10px] h-5 bg-blue-100 text-blue-700">{tauxCouverture}%</Badge>
                </div>
                <span className="font-bold text-lg sm:text-2xl text-blue-600">
                    {formatCurrency(Math.round(partAssurance))}
                </span>
             </div>
          )}

          {/* Total TTC & Net à Payer */}
          <div className="flex flex-col items-center sm:items-end gap-1 pl-4 sm:pl-8 border-l-2 border-emerald-200">
            <span className="text-emerald-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider leading-none">
                {tauxCouverture > 0 ? t('facturation:totals.part_patient') : t('facturation:totals.total_ttc')}
            </span>
            <div className="flex items-baseline gap-1">
                <span className="font-black text-3xl sm:text-5xl text-emerald-600 tracking-tight">
                    {formatCurrency(Math.round(tauxCouverture > 0 ? partPatient : totalTTC))}
                </span>
            </div>

            {tauxCouverture > 0 && (
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                    {t('facturation:totals.total_ttc')}: {formatCurrency(Math.round(totalTTC))}
                </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
