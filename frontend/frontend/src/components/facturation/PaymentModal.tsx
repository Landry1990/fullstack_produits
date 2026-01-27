import { useEffect } from 'react'
import type { Facture } from '../../types'
import { useTranslation } from 'react-i18next'

type PaymentItem = {
    mode: string // Relaxed to match broader usage in Facturation.tsx
    montant: number
    part_patient?: number | null
    part_assurance?: number | null
}

type PaymentModalProps = {
    isOpen: boolean
    onClose: () => void
    loading: boolean
    facturePourPaiement: Facture | null
    isNewSale: boolean
    totals: {
        totalTtc: number
        tauxCouverture: number
        partPatient: number
        partAssurance: number
        couponMontant?: number
        loyaltyDeduction?: number
    }
    montantPaye: string
    setMontantPaye: (val: string) => void
    modePaiement: string
    setModePaiement: (val: any) => void
    paiements: PaymentItem[]
    setPaiements: (items: any[]) => void // Allow flexible array update
    onCompleteSale: () => void
    onRegisterPayment: () => void
    selectedClient: number | null
    useManualClient: boolean
    paymentInputRef: React.RefObject<HTMLInputElement | null> // Allow null in RefObject
}

export default function PaymentModal({
    isOpen,
    onClose,
    loading,
    facturePourPaiement,
    isNewSale,
    totals,
    montantPaye,
    setMontantPaye,
    modePaiement,
    setModePaiement: _setModePaiement,
    paiements,
    setPaiements,
    onCompleteSale,
    onRegisterPayment,
    selectedClient: _selectedClient,
    useManualClient: _useManualClient,
    paymentInputRef
}: PaymentModalProps) {
    const { t } = useTranslation()

    useEffect(() => {
        if (isOpen) {
             // Focus sur le montant après un court délai pour laisser la modale s'ouvrir
             setTimeout(() => {
                paymentInputRef.current?.focus()
                paymentInputRef.current?.select()
            }, 100)
        }
    }, [isOpen, paymentInputRef])

    return (
        <dialog className={`modal ${isOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-md mx-4 p-0 overflow-hidden bg-white">
          <div className="p-4 border-b border-base-200 flex justify-between items-center bg-base-50">
            <h3 className="font-bold text-lg">{t('facturation.payment.modal_title')}</h3>
            <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>✕</button>
          </div>

          {(facturePourPaiement || isNewSale) && (
            <form onSubmit={(e) => { 
              e.preventDefault(); 
              if (isNewSale) {
                onCompleteSale();
              } else {
                onRegisterPayment(); 
              }
            }} className="p-6 space-y-5">
              
              <div className="text-center mb-6">
                <div className="text-sm text-base-content/60 uppercase tracking-wide mb-1">
                    {isNewSale && totals.tauxCouverture > 0 ? t('facturation.totals.part_patient') : t('facturation.payment.amount_due')}
                </div>
                <div className="text-4xl font-light text-primary">
                    {isNewSale 
                        ? Math.round(totals.tauxCouverture > 0 
                            ? totals.partPatient 
                            : Math.max(0, totals.totalTtc - (totals.couponMontant || 0) - (totals.loyaltyDeduction || 0)))
                        : Math.round(Number(facturePourPaiement?.total_ttc))} F
                </div>
                {(totals.couponMontant && totals.couponMontant > 0) && (
                    <div className="text-sm text-success font-medium mt-1">
                        Dont coupon : -{Math.round(totals.couponMontant)} F
                    </div>
                )}
              </div>


              {/* Tiers Payant Display - Show breakdown if applicable */}
              {isNewSale && totals.tauxCouverture > 0 && totals.partAssurance > 0 ? (
                <div className="space-y-4">
                  <div className="alert alert-info">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span className="text-sm">Tiers Payant {totals.tauxCouverture}% actif - Paiement automatiquement réparti</span>
                  </div>
                  
                  <div className="bg-base-50 rounded-lg p-4 space-y-3">
                    <h4 className="text-xs uppercase font-bold text-base-content/50 mb-3">Détail du paiement</h4>
                    
                    {/* Part Patient */}
                    <div className="bg-white rounded-lg p-3 border border-success/20">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-success">{t('facturation.totals.part_patient')} ({100 - totals.tauxCouverture}%)</span>
                        <span className="text-lg font-bold text-success">{Math.round(totals.partPatient)} F</span>
                      </div>
                      <div className="form-control w-full space-y-2">
                            {/* Liste des paiements déjà ajoutés pour la part patient */}
                            {paiements.length > 0 && (
                                <div className="bg-base-50 rounded p-2 space-y-1 mb-2">
                                    {paiements.map((p, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs p-1 px-2 bg-white rounded border border-base-200">
                                            <span>{p.mode === 'especes' ? t('facturation.payment.modes.especes') : p.mode === 'carte' ? t('facturation.payment.modes.carte') : p.mode === 'om' ? t('facturation.payment.modes.mobile') : p.mode === 'momo' ? t('facturation.payment.modes.mobile') : p.mode === 'cheque' ? t('facturation.payment.modes.cheque') : 'Autre'}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold">{p.montant} F</span>
                                                <button 
                                                    type="button"
                                                    onClick={() => setPaiements(paiements.filter((_, i) => i !== idx))}
                                                    className="btn btn-ghost btn-xs text-error btn-square h-5 w-5 min-h-0"
                                                >✕</button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="text-right text-xs text-base-content/60 pt-1 border-t border-base-200">
                                        Reste à allouer: <span className="font-bold text-error">{Math.max(0, totals.partPatient - paiements.reduce((acc, p) => acc + p.montant, 0) - (Number(montantPaye) || 0))} F</span>
                                    </div>
                                </div>
                            )}

                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="label py-0"> <span className="label-text text-xs">Mode</span> </label>
                                <div className="text-sm font-medium py-1.5 px-2 bg-base-100 border border-base-200 rounded text-base-content/70">
                                    Caisse Centrale
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="label py-0"> <span className="label-text text-xs">Montant</span> </label>
                                <input 
                                    type="number" 
                                    className="input input-sm input-bordered w-full" 
                                    value={montantPaye}
                                    placeholder={paiements.length === 0 ? totals.partPatient.toString() : ''}
                                    onChange={(e) => setMontantPaye(e.target.value)}
                                    // Auto-add on enter
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            if (montantPaye && Number(montantPaye) > 0) {
                                                setPaiements([...paiements, { mode: modePaiement as any, montant: Number(montantPaye) }])
                                                // Calc rest
                                                const dejaAlloue = paiements.reduce((acc, p) => acc + p.montant, 0) + Number(montantPaye)
                                                const reste = Math.max(0, totals.partPatient - dejaAlloue)
                                                setMontantPaye(reste > 0 ? reste.toString() : '')
                                            }
                                        }
                                    }}
                                />
                            </div>
                            <button 
                                type="button"
                                className="btn btn-sm btn-square btn-ghost border border-base-300"
                                onClick={() => {
                                    if (montantPaye && Number(montantPaye) > 0) {
                                        setPaiements([...paiements, { mode: modePaiement as any, montant: Number(montantPaye) }])
                                        const dejaAlloue = paiements.reduce((acc, p) => acc + p.montant, 0) + Number(montantPaye)
                                        const reste = Math.max(0, totals.partPatient - dejaAlloue)
                                        setMontantPaye(reste > 0 ? reste.toString() : '')
                                    }
                                }}
                                title="Ajouter ce paiement"
                            >
                                ＋
                            </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border border-info/20">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-info">{t('facturation.totals.part_assurance')} ({totals.tauxCouverture}%)</span>
                        <span className="text-lg font-bold text-info">{Math.round(totals.partAssurance)} F</span>
                      </div>
                      <div className="text-xs text-base-content/60 mt-1">
                        <span className="badge badge-ghost badge-xs">En compte (automatique)</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-control w-full">
                    <label className="label py-1"><span className="label-text text-xs uppercase font-bold text-base-content/50">Mode de paiement</span></label>
                    <div className="p-3 bg-base-100 border border-base-300 rounded-lg text-sm font-medium flex items-center gap-2">
                        <span className="badge badge-primary badge-xs"></span>
                        Caisse Centrale
                    </div>
                    {/* Hidden input to maintain logic if needed, but we just use state 'especes' */}
                  </div>

                  {/* Liste des paiements multiples */}
                  {paiements.length > 0 && (
                    <div className="bg-base-50 rounded-lg p-2 space-y-1">
                        {paiements.map((p, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm p-1 px-2 bg-white rounded border border-base-200">
                                <span>Caisse Centrale</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono">{p.montant} F</span>
                                    <button 
                                        type="button"
                                        onClick={() => setPaiements(paiements.filter((_, i) => i !== idx))}
                                        className="btn btn-ghost btn-xs text-error btn-square"
                                    >✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                      <div className="form-control flex-1">
                        <label className="label py-1"><span className="label-text text-xs uppercase font-bold text-base-content/50">Montant</span></label>
                        <input
                          ref={paymentInputRef}
                          type="number"
                          step="0.01"
                          value={montantPaye}
                          onChange={(e) => setMontantPaye(e.target.value)}
                          onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                  e.preventDefault()
                                  if (montantPaye && Number(montantPaye) > 0) {
                                      setPaiements([...paiements, { mode: modePaiement as any, montant: Number(montantPaye) }])
                                      // Calculer le reste à payer pour la prochaine entrée
                                      const totalAPayer = isNewSale 
                                        ? (totals.tauxCouverture > 0 
                                            ? totals.partPatient 
                                            : Math.max(0, totals.totalTtc - (totals.couponMontant || 0) - (totals.loyaltyDeduction || 0)))
                                        : (facturePourPaiement?.total_ttc ? Number(facturePourPaiement.total_ttc) : 0)
                                      
                                      const dejaVerse = paiements.reduce((acc, p) => acc + p.montant, 0) + Number(montantPaye)
                                      const reste = Math.max(0, totalAPayer - dejaVerse)
                                      setMontantPaye(reste > 0 ? reste.toString() : '')
                                  }
                              }
                          }}
                          className="input input-bordered w-full font-light text-2xl text-center focus:border-primary focus:ring-2 focus:ring-primary/20"
                          placeholder="Saisir montant..."
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary h-[3rem]" // Match input height roughly
                        disabled={!montantPaye || Number(montantPaye) <= 0}
                        onClick={() => {
                            if (montantPaye && Number(montantPaye) > 0) {
                                setPaiements([...paiements, { mode: modePaiement as any, montant: Number(montantPaye) }])
                                const totalAPayer = isNewSale 
                                    ? (totals.tauxCouverture > 0 
                                        ? totals.partPatient 
                                        : Math.max(0, totals.totalTtc - (totals.couponMontant || 0) - (totals.loyaltyDeduction || 0)))
                                    : (facturePourPaiement?.total_ttc ? Number(facturePourPaiement.total_ttc) : 0)
                                
                                const dejaVerse = paiements.reduce((acc, p) => acc + p.montant, 0) + Number(montantPaye)
                                const reste = Math.max(0, totalAPayer - dejaVerse)
                                setMontantPaye(reste > 0 ? reste.toString() : '')
                            }
                        }}
                      >
                        Ajouter
                      </button>
                  </div>
                </>
              )}

              {(() => {
                const totalAPayer = isNewSale 
                    ? (totals.tauxCouverture > 0 
                        ? totals.partPatient 
                        : Math.max(0, totals.totalTtc - (totals.couponMontant || 0) - (totals.loyaltyDeduction || 0)))
                    : (facturePourPaiement?.total_ttc ? Number(facturePourPaiement.total_ttc) : 0)
                const totalVerse = paiements.reduce((acc, p) => acc + p.montant, 0) + (paiements.length === 0 ? Number(montantPaye) : 0)
                const rendu = totalVerse - totalAPayer
                return (
                  <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-sm">
                          <span>{t('facturation.payment.amount_paid')}:</span>
                          <span className="font-bold">{Math.round(totalVerse)} F</span>
                      </div>
                      {rendu > 0 && (
                        <div className="alert bg-success/10 text-success border-success/20 py-2 px-3 shadow-sm flex justify-between items-center">
                            <span className="text-sm font-medium">{t('facturation.payment.change_due')}</span>
                            <span className="text-xl font-bold">{rendu.toFixed(0)} F</span>
                        </div>
                      )}
                  </div>
                )
              })()}

              <div className="pt-4 flex gap-3">
                <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>{t('facturation.payment.cancel')} (Esc)</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                  {loading ? <span className="loading loading-spinner"></span> : t('facturation.payment.validate')}
                </button>
              </div>
            </form>
          )}
        </div>
        <form method="dialog" className="modal-backdrop" onClick={onClose}><button>close</button></form>
      </dialog>
    )
}
