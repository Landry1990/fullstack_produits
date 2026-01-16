interface TotalsSectionProps {
  totalHT: number
  remiseGlobale: string
  setRemiseGlobale: (v: string) => void
  remiseMode: 'montant' | 'taux'
  setRemiseMode: (v: 'montant' | 'taux') => void
  remiseMontant: number
  tvaAmount: number
  totalTTC: number
}

export default function TotalsSection({
  totalHT,
  remiseGlobale,
  setRemiseGlobale,
  remiseMode,
  setRemiseMode,
  remiseMontant,
  tvaAmount,
  totalTTC
}: TotalsSectionProps) {
  return (
    <div className="bg-white border-t border-base-200 p-3 md:p-4 shadow-sm">
      <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-end justify-end text-sm">
        
        {/* Total HT */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-base-content/50 text-xs font-bold uppercase tracking-wider">Total HT</span>
          <span className="font-medium text-lg">{Math.round(totalHT).toLocaleString()} F</span>
        </div>

        {/* Remise Globale */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-base-content/50 text-xs font-bold uppercase tracking-wider">Remise Globale</span>
          <div className="flex items-center gap-2">
            <select
              value={remiseMode}
              onChange={(e) => setRemiseMode(e.target.value as 'montant' | 'taux')}
              className="select select-sm select-bordered text-xs"
            >
              <option value="montant">F (Montant)</option>
              <option value="taux">% (Pourcentage)</option>
            </select>
            <input
              type="text"
              value={remiseGlobale}
              onChange={(e) => setRemiseGlobale(e.target.value)}
              className="input input-sm input-bordered w-20 text-right focus:bg-white bg-base-50 transition-colors"
              placeholder={remiseMode === 'taux' ? '0%' : '0 F'}
            />
            {remiseMontant > 0 && (
              <span className="text-error font-medium whitespace-nowrap">-{Math.round(remiseMontant).toLocaleString()} F</span>
            )}
          </div>
        </div>

        {/* TVA (per-line sum, display only) */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-base-content/50 text-xs font-bold uppercase tracking-wider">TVA</span>
          <span className={`font-medium text-lg ${tvaAmount > 0 ? 'text-base-content' : 'text-base-content/30'}`}>
            {Math.round(tvaAmount).toLocaleString()} F
          </span>
        </div>

        {/* Total TTC */}
        <div className="flex flex-col items-end gap-1 pl-4 md:pl-8 border-l border-base-200">
          <span className="text-base-content/50 text-xs font-bold uppercase tracking-wider">Total TTC</span>
          <span className="font-bold text-3xl text-primary">{Math.round(totalTTC).toLocaleString()} F</span>
        </div>
      </div>
    </div>
  )
}
