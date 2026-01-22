import type { CouponMonnaie } from '../../types'

interface TotalsSectionProps {
  totalHT: number
  remiseGlobale: string
  setRemiseGlobale: (v: string) => void
  remiseMode: 'montant' | 'taux'
  setRemiseMode: (v: 'montant' | 'taux') => void
  remiseMontant: number
  tvaAmount: number
  totalTTC: number
  couponNumero: string
  setCouponNumero: (v: string) => void
  couponData: CouponMonnaie | null
  couponLoading: boolean
  couponError: string | null
  onRechercherCoupon: () => void
  onClearCoupon: () => void
  couponMontant: number
  // Tiers Payant Props
  tauxCouverture?: number
  partAssurance?: number
  partPatient?: number
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
  couponNumero,
  setCouponNumero,
  couponData,
  couponLoading,
  couponError,
  onRechercherCoupon,
  onClearCoupon,
  couponMontant,
  tauxCouverture = 0,
  partAssurance = 0,
  partPatient = 0
}: TotalsSectionProps) {
  return (
    <div className="bg-white border-t border-base-200 p-3 md:p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        {/* Ligne principale des totaux */}
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

          {/* Tiers Payant Detail (Only if coverage > 0) */}
          {tauxCouverture > 0 && (
             <div className="flex flex-col items-end gap-1 px-4 border-l border-r border-base-200 bg-base-50/50 rounded py-1">
                <div className="flex items-center gap-2">
                    <span className="badge badge-sm badge-info">{tauxCouverture}%</span>
                    <span className="text-xs uppercase font-bold text-base-content/50">Assurance</span>
                </div>
                <span className="font-bold text-info">{Math.round(partAssurance).toLocaleString()} F</span>
             </div>
          )}

          {/* Total TTC & Net à Payer */}
          <div className="flex flex-col items-end gap-1 pl-4 md:pl-8 border-l border-base-200">
            <span className="text-base-content/50 text-xs font-bold uppercase tracking-wider">
                {tauxCouverture > 0 ? "Part Patient" : "Total TTC"}
            </span>
            <span className={`font-bold ${couponMontant > 0 ? 'text-xl text-base-content/70 line-through decoration-error' : 'text-3xl text-primary'}`}>
                {Math.round(tauxCouverture > 0 ? partPatient : totalTTC).toLocaleString()} F
            </span>
            
            {couponMontant > 0 && (
                <div className="flex flex-col items-end animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <span className="text-success text-xs font-bold mt-1 mb-1">Dont Coupon: -{Math.round(couponMontant).toLocaleString()} F</span>
                    <span className="text-base-content/50 text-xs font-bold uppercase tracking-wider">NET À PAYER</span>
                    <span className="font-black text-3xl text-primary">
                        {Math.round(Math.max(0, (tauxCouverture > 0 ? partPatient : totalTTC) - couponMontant)).toLocaleString()} F
                    </span>
                </div>
            )}
            
            {tauxCouverture > 0 && (
                <span className="text-xs text-base-content/40 mt-1">
                    Total TTC: {Math.round(totalTTC).toLocaleString()} F
                </span>
            )}
          </div>
        </div>

        {/* Section Coupon de Monnaie */}
        <div className="flex flex-col md:flex-row gap-2 items-end justify-end border-t border-base-200 pt-3">
          <div className="flex flex-col gap-1 flex-1 max-w-xs">
            <span className="text-base-content/50 text-xs font-bold uppercase tracking-wider">Coupon de Monnaie</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={couponNumero}
                onChange={(e) => setCouponNumero(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && onRechercherCoupon()}
                placeholder="Numéro du coupon"
                className="input input-sm input-bordered flex-1 focus:bg-white bg-base-50 transition-colors"
                disabled={couponLoading}
              />
              {couponData ? (
                <button
                  onClick={onClearCoupon}
                  className="btn btn-sm btn-ghost btn-circle"
                  title="Retirer le coupon"
                >
                  ✕
                </button>
              ) : (
                <button
                  onClick={onRechercherCoupon}
                  className="btn btn-sm btn-primary"
                  disabled={couponLoading || !couponNumero.trim()}
                >
                  {couponLoading ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    'Rechercher'
                  )}
                </button>
              )}
            </div>
            {couponError && (
              <span className="text-error text-xs">{couponError}</span>
            )}
            {couponData && (
              <div className="flex items-center gap-2 text-xs">
                <span className="badge badge-success badge-sm">Coupon #{couponData.numero}</span>
                <span className="text-success font-medium">
                  -{Math.round(couponMontant).toLocaleString()} F
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
