import { useEffect, useRef } from 'react'
import type { Facture } from '../../types'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../utils/formatters'
import PremiumModal from '../common/PremiumModal'

type PaymentItem = {
    mode: string
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
    setPaiements: (items: any[]) => void
    onCompleteSale: (sudoCredentials?: { validatorId: number, password: string }) => void
    onRegisterPayment: () => void
    selectedClient: number | null
    useManualClient: boolean
    paymentInputRef: React.RefObject<HTMLInputElement | null>
    clientSoldeDepot?: string | number
    isMultiCaisse?: boolean
    centralizedCashRegister?: boolean
    postesCaissesActive?: any[]
    selectedPosteCaisseId?: number | null
    setSelectedPosteCaisseId?: (id: number | null) => void
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
    selectedClient,
    useManualClient: _useManualClient,
    paymentInputRef,
    clientSoldeDepot,
    isMultiCaisse,
    centralizedCashRegister,
    postesCaissesActive,
    selectedPosteCaisseId,
    setSelectedPosteCaisseId
}: PaymentModalProps) {
    const { t } = useTranslation(['facturation', 'common'])

    // Refs for keyboard-driven flow
    const submitBtnRef = useRef<HTMLButtonElement>(null);

    // Cleanup unused effect for validator selection
    useEffect(() => {
        if (isOpen) {
            // Focus on input after modal renders
            const timeoutId = setTimeout(() => {
                paymentInputRef.current?.focus();
            }, 150);
            return () => clearTimeout(timeoutId);
        }
    }, [isOpen]);

    return (
        <PremiumModal
          isOpen={isOpen}
          onClose={onClose}
          title={t('facturation:payment.modal_title')}
          icon={<span className="text-primary text-xl">💰</span>}
          maxWidth="max-w-md"
        >
          {(facturePourPaiement || isNewSale) ? (
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
                    {isNewSale && totals.tauxCouverture > 0 ? t('facturation:totals.part_patient') : t('facturation:payment.amount_due')}
                </div>
                <div className="text-4xl font-light text-primary">
                    {formatCurrency(Math.round(isNewSale 
                        ? (totals.tauxCouverture > 0 
                            ? totals.partPatient 
                            : (totals.totalTtc - (totals.couponMontant || 0) - (totals.loyaltyDeduction || 0)))
                        : Number(facturePourPaiement?.total_ttc)))}
                </div>
                {(totals.couponMontant && totals.couponMontant > 0) && (
                    <div className="text-sm text-success font-medium mt-1">
                        {t('common:coupon')} : -{formatCurrency(Math.round(totals.couponMontant))}
                    </div>
                )}
                {(() => {
                    const amountToPay = Math.round(isNewSale 
                        ? (totals.tauxCouverture > 0 
                            ? totals.partPatient 
                            : (totals.totalTtc - (totals.couponMontant || 0) - (totals.loyaltyDeduction || 0)))
                        : Number(facturePourPaiement?.total_ttc));
                    
                    if (facturePourPaiement?.client_solde_depot || clientSoldeDepot) {
                        const soldeVal = parseFloat(String(facturePourPaiement?.client_solde_depot || clientSoldeDepot || '0'));
                        
                        if (soldeVal > 0 && amountToPay > soldeVal) {
                             return (
                                <div className="mt-2 p-2 bg-warning/10 border border-warning/20 rounded text-warning text-[10px] font-bold uppercase animate-pulse text-center">
                                    ⚠️ {t('facturation:client.insufficient_deposit_warning', { solde: soldeVal })}
                                </div>
                             )
                        }
                    }
                    return null;
                })()}

                {/* Multi-Caisse Selection */}
                {isMultiCaisse && !centralizedCashRegister && isNewSale && postesCaissesActive && postesCaissesActive.length > 0 && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-2 mb-4">
                        <label className="label py-0 mb-2">
                            <span className="label-text-alt uppercase font-bold text-primary flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Envoyer Vers (Poste de Caisse)
                            </span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {postesCaissesActive.map((poste) => (
                                <button
                                    key={poste.id}
                                    type="button"
                                    onClick={() => setSelectedPosteCaisseId?.(poste.id)}
                                    className={`btn btn-sm text-[10px] font-bold uppercase transition-all duration-200 border-2 ${selectedPosteCaisseId === poste.id ? 'btn-primary border-primary shadow-lg shadow-primary/20 scale-105' : 'btn-ghost border-base-300'}`}
                                >
                                    {poste.nom}
                                </button>
                            ))}
                        </div>
                        {!selectedPosteCaisseId && (
                            <p className="text-[10px] text-error font-medium mt-2 italic flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                Veuillez sélectionner un poste de caisse actif
                            </p>
                        )}
                    </div>
                )}
              </div>

              {/* Tiers Payant Display - Show breakdown if applicable */}
              {isNewSale && totals.tauxCouverture > 0 && totals.partAssurance > 0 ? (
                <div className="space-y-4">
                  <div className="alert alert-info py-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span className="text-sm">{t('facturation:payment.tiers_payant_active', { rate: totals.tauxCouverture })}</span>
                  </div>
                  
                  <div className="bg-base-50 rounded-lg p-4 space-y-3">
                    <h4 className="text-xs uppercase font-bold text-base-content/50 mb-3">{t('facturation:payment.detail_title')}</h4>
                    
                    {/* Part Patient */}
                    <div className="bg-base-100 rounded-lg p-3 border border-success/20">
                      <div className="grid grid-cols-[1fr,auto] items-center mb-2">
                        <span className="text-sm font-medium text-success">{t('facturation:totals.part_patient')} ({100 - totals.tauxCouverture}%)</span>
                        <span className="text-lg font-bold text-success">{formatCurrency(Math.round(totals.partPatient))}</span>
                      </div>
                      <div className="form-control w-full space-y-2">
                            {/* Liste des paiements déjà ajoutés pour la part patient */}
                            {paiements.length > 0 && (
                                <div className="bg-base-50 rounded p-2 space-y-1 mb-2">
                                    {paiements.map((p, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs p-1 px-2 bg-base-100 rounded border border-base-200">
                                            <span>{p.mode === 'especes' ? t('facturation:payment.modes.especes') : p.mode === 'carte' ? t('facturation:payment.modes.carte') : p.mode === 'om' ? t('facturation:payment.modes.mobile') : p.mode === 'momo' ? t('facturation:payment.modes.momo') : p.mode === 'cheque' ? t('facturation:payment.modes.cheque') : t('facturation:payment.modes.other')}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold">{formatCurrency(p.montant)}</span>
                                                <button 
                                                    type="button"
                                                    onClick={() => setPaiements(paiements.filter((_, i) => i !== idx))}
                                                    className="btn btn-ghost btn-xs text-error btn-square h-5 w-5 min-h-0"
                                                >✕</button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="text-right text-xs text-base-content/60 pt-1 border-t border-base-200">
                                        {t('facturation:payment.remaining_to_allocate')} <span className="font-bold text-error">{formatCurrency(totals.partPatient - paiements.reduce((acc, p) => acc + p.montant, 0) - (Number(montantPaye) || 0))}</span>
                                    </div>
                                </div>
                            )}

                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="label py-0"> <span className="label-text text-xs">{t('facturation:payment.mode_label')}</span> </label>
                                <div className="text-sm font-medium py-1.5 px-2 bg-base-100 border border-base-200 rounded text-base-content/70">
                                    {t('facturation:payment.caisse_centrale')}
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="label py-0"> <span className="label-text text-xs">{t('facturation:payment.amount_label')}</span> </label>
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
                                            if (montantPaye && Number(montantPaye) !== 0) {
                                                setPaiements([...paiements, { mode: modePaiement as any, montant: Number(montantPaye) }])
                                                // Calc rest
                                                const dejaAlloue = paiements.reduce((acc, p) => acc + p.montant, 0) + Number(montantPaye)
                                                const reste = totals.partPatient - dejaAlloue
                                                setMontantPaye(reste !== 0 ? reste.toString() : '')
                                            }
                                        }
                                    }}
                                />
                            </div>
                            <button 
                                type="button"
                                className="btn btn-sm btn-square btn-ghost border border-base-300"
                                onClick={() => {
                                    if (montantPaye && Number(montantPaye) !== 0) {
                                        setPaiements([...paiements, { mode: modePaiement as any, montant: Number(montantPaye) }])
                                        const dejaAlloue = paiements.reduce((acc, p) => acc + p.montant, 0) + Number(montantPaye)
                                        const reste = totals.partPatient - dejaAlloue
                                        setMontantPaye(reste !== 0 ? reste.toString() : '')
                                    }
                                }}
                                title={t('facturation:payment.add_btn')}
                            >
                                ＋
                            </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-base-100 rounded-lg p-3 border border-info/20">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-info">{t('facturation:totals.part_assurance')} ({totals.tauxCouverture}%)</span>
                        <span className="text-lg font-bold text-info">{formatCurrency(Math.round(totals.partAssurance))}</span>
                      </div>
                      <div className="text-xs text-base-content/60 mt-1">
                        <span className="badge badge-ghost badge-xs">{t('facturation:payment.en_compte_auto')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-control w-full">
                    <label className="label py-1"><span className="label-text text-xs uppercase font-bold text-base-content/50">{t('facturation:payment.payment_mode_label')}</span></label>
                    <div className="p-3 bg-base-100 border border-base-300 rounded-lg text-sm font-medium flex items-center gap-2">
                        <span className="badge badge-primary badge-xs"></span>
                        {t('facturation:payment.caisse_centrale')}
                    </div>
                    {/* Hidden input to maintain logic if needed, but we just use state 'especes' */}
                  </div>

                  {/* Liste des paiements multiples */}
                  {paiements.length > 0 && (
                    <div className="bg-base-50 rounded-lg p-2 space-y-1">
                        {paiements.map((p, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm p-1 px-2 bg-base-100 rounded border border-base-200">
                                <span>{t('facturation:payment.caisse_centrale')}</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono">{formatCurrency(p.montant)}</span>
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
                        <label className="label py-1"><span className="label-text text-xs uppercase font-bold text-base-content/50">{t('facturation:payment.amount_label')}</span></label>
                        <input
                          ref={paymentInputRef}
                          type="number"
                          step="0.01"
                          value={montantPaye}
                          onChange={(e) => setMontantPaye(e.target.value)}
                          onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                  e.preventDefault()
                                  if (montantPaye && Number(montantPaye) !== 0) {
                                      setPaiements([...paiements, { mode: modePaiement as any, montant: Number(montantPaye) }])
                                      // Calculer le reste à payer pour la prochaine entrée
                                      const totalAPayer = isNewSale 
                                        ? (totals.tauxCouverture > 0 
                                            ? totals.partPatient 
                                            : (totals.totalTtc - (totals.couponMontant || 0) - (totals.loyaltyDeduction || 0)))
                                        : (facturePourPaiement?.total_ttc ? Number(facturePourPaiement.total_ttc) : 0)
                                      
                                      const dejaVerse = paiements.reduce((acc, p) => acc + p.montant, 0) + Number(montantPaye)
                                      const reste = totalAPayer - dejaVerse
                                      setMontantPaye(reste !== 0 ? reste.toString() : '')
                                  }
                              }
                          }}
                          className="input input-bordered w-full font-light text-2xl text-center focus:border-primary focus:ring-2 focus:ring-primary/20"
                          placeholder={t('facturation:payment.amount_label')}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary h-[3rem]" // Match input height roughly
                        disabled={!montantPaye || Number(montantPaye) === 0}
                        onClick={() => {
                            if (montantPaye && Number(montantPaye) !== 0) {
                                setPaiements([...paiements, { mode: modePaiement as any, montant: Number(montantPaye) }])
                                const totalAPayer = isNewSale 
                                    ? (totals.tauxCouverture > 0 
                                        ? totals.partPatient 
                                        : (totals.totalTtc - (totals.couponMontant || 0) - (totals.loyaltyDeduction || 0)))
                                    : (facturePourPaiement?.total_ttc ? Number(facturePourPaiement.total_ttc) : 0)
                                
                                const dejaVerse = paiements.reduce((acc, p) => acc + p.montant, 0) + Number(montantPaye)
                                const reste = totalAPayer - dejaVerse
                                setMontantPaye(reste !== 0 ? reste.toString() : '')
                            }
                        }}
                      >
                        {t('facturation:payment.add_btn')}
                      </button>
                  </div>
                </>
              )}

              {(() => {
                const totalAPayer = isNewSale 
                    ? (totals.tauxCouverture > 0 
                        ? totals.partPatient 
                        : ((totals.totalTtc || 0) - (totals.couponMontant || 0) - (totals.loyaltyDeduction || 0)))
                    : (facturePourPaiement?.total_ttc ? Number(facturePourPaiement.total_ttc) : 0)
                
                const totalVerse = paiements.reduce((acc, p) => acc + p.montant, 0) + (paiements.length === 0 && Number(montantPaye) > 0 ? Number(montantPaye) : 0)
                const rendu = totalVerse - totalAPayer
                
                return (
                  <div className="pt-4 border-t border-base-200 mt-2">
                    <div className="flex justify-between items-center mb-4">
                        <div className="text-sm">
                            {rendu >= 0 
                                ? <span className="text-success font-bold">{t('facturation:payment.change_due_label')} {formatCurrency(Math.round(rendu))}</span>
                                : <span className="text-error font-bold">{t('facturation:payment.remaining_due_label')} {formatCurrency(Math.round(Math.abs(rendu)))}</span>
                            }
                        </div>
                        <div className="text-xl font-bold">
                            {t('facturation:payment.total_label')} {formatCurrency(Math.round(totalVerse))} / {formatCurrency(Math.round(totalAPayer))}
                        </div>
                    </div>
                    
                    <button 
                        ref={submitBtnRef}
                        type="submit" 
                        disabled={loading || (isNewSale && rendu < -1 && !selectedClient) || (isMultiCaisse && !centralizedCashRegister && isNewSale && !selectedPosteCaisseId)}
                        className={`btn btn-primary w-full gap-2 ${loading ? 'loading' : ''}`}
                    >
                        {loading ? t('facturation:payment.status.processing') : isNewSale ? t('facturation:payment.validate_sale') : t('facturation:payment.register_payment')}
                    </button>
                  </div>
                )
              })()}
            </form>
          ) : (
            <div className="p-8 text-center text-base-content/50">
                {t('facturation:payment.no_invoice')}
            </div>
          )}
        </PremiumModal>
    )
}
