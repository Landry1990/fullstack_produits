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
    setPaiements: (items: PaymentItem[] | ((prev: PaymentItem[]) => PaymentItem[])) => void
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
    setModePaiement: _setModePaiement, // Keeping it if parent requires it but it's not used here
    paiements,
    setPaiements,
    onCompleteSale,
    onRegisterPayment,
    selectedClient,
    useManualClient: _useManualClient, // Keeping it if parent requires it but it's not used here
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

    // Focus on submit button when modal opens
    useEffect(() => {
        if (isOpen) {
            const timeoutId = setTimeout(() => {
                submitBtnRef.current?.focus();
            }, 150);
            return () => clearTimeout(timeoutId);
        }
    }, [isOpen]);

    return (
        <PremiumModal
          isOpen={isOpen}
          onClose={onClose}
          title={t('facturation:payment.modal_title')}
          icon={<span className="text-emerald-600 text-xl">💰</span>}
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
                <div className="text-sm text-slate-500 uppercase tracking-wide mb-1">
                    {isNewSale && totals.tauxCouverture > 0 ? t('facturation:totals.part_patient') : t('facturation:payment.amount_due')}
                </div>
                <div className="text-4xl font-light text-emerald-600">
                    {formatCurrency(Math.round(isNewSale
                        ? (totals.tauxCouverture > 0
                            ? totals.partPatient
                            : (totals.totalTtc - (totals.couponMontant || 0) - (totals.loyaltyDeduction || 0)))
                        : Number(facturePourPaiement?.total_ttc)))}
                </div>
                {(totals.couponMontant && totals.couponMontant > 0) && (
                    <div className="text-sm text-emerald-600 font-medium mt-1">
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
                                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-600 text-[10px] font-bold uppercase animate-pulse text-center">
                                    ⚠️ {t('facturation:client.insufficient_deposit_warning', { solde: soldeVal })}
                                </div>
                             )
                        }
                    }
                    return null;
                })()}

                {/* Sélection de poste : affiché dès qu'il y a 2+ caisses ouvertes, quel que soit le mode */}
                {isNewSale && postesCaissesActive && postesCaissesActive.length > 1 && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mt-2 mb-4">
                        <div className="mb-2">
                            <span className="uppercase font-bold text-emerald-600 flex items-center gap-1 text-xs">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                {t('facturation:payment.send_to_cash_register')}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {postesCaissesActive.map((poste) => {
                                // Récupérer le nom du caissier qui a ouvert la session
                                const caissierName = poste.session_active?.ouvert_par_name
                                    || poste.ouvert_par_name
                                    || poste.ouvert_par?.username
                                    || t('facturation:payment.unknown_cashier');

                                return (
                                    <button
                                        key={poste.id}
                                        type="button"
                                        onClick={() => setSelectedPosteCaisseId?.(poste.id)}
                                        className={`inline-flex items-center justify-start h-9 px-3 rounded-lg text-xs font-semibold transition-all duration-200 border-2 ${selectedPosteCaisseId === poste.id ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm scale-[1.02]' : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300'}`}
                                    >
                                        <div className="flex flex-col items-start">
                                            <span className="font-bold text-xs uppercase">{poste.nom}</span>
                                            <span className="text-[10px] opacity-70 flex items-center gap-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                </svg>
                                                {caissierName}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {!selectedPosteCaisseId && (
                            <p className="text-[10px] text-red-600 font-medium mt-2 italic flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                {t('facturation:payment.select_active_cash_register')}
                            </p>
                        )}
                    </div>
                )}
              </div>

              {/* Tiers Payant Display - Show breakdown if applicable */}
              {isNewSale && totals.tauxCouverture > 0 && totals.partAssurance > 0 ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="shrink-0 size-5 text-blue-600"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span className="text-sm text-blue-700">{t('facturation:payment.tiers_payant_active', { rate: totals.tauxCouverture })}</span>
                  </div>
                  
                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <h4 className="text-xs uppercase font-bold text-slate-500 mb-3">{t('facturation:payment.detail_title')}</h4>

                    {/* Part Patient */}
                    <div className="bg-white rounded-lg p-3 border border-emerald-100">
                      <div className="grid grid-cols-[1fr,auto] items-center mb-2">
                        <span className="text-sm font-medium text-emerald-600">{t('facturation:totals.part_patient')} ({100 - totals.tauxCouverture}%)</span>
                        <span className="text-lg font-bold text-emerald-600">{formatCurrency(Math.round(totals.partPatient))}</span>
                      </div>
                      <div className="w-full space-y-2">
                            {/* Liste des paiements déjà ajoutés pour la part patient */}
                            {paiements.length > 0 && (
                                <div className="bg-slate-50 rounded p-2 space-y-1 mb-2">
                                    {paiements.map((p, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs p-1 px-2 bg-white rounded border border-slate-200">
                                            <span>{p.mode === 'especes' ? t('facturation:payment.modes.especes') : p.mode === 'carte' ? t('facturation:payment.modes.carte') : p.mode === 'om' ? t('facturation:payment.modes.mobile') : p.mode === 'momo' ? t('facturation:payment.modes.momo') : p.mode === 'cheque' ? t('facturation:payment.modes.cheque') : t('facturation:payment.modes.other')}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold">{formatCurrency(p.montant)}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setPaiements(paiements.filter((_, i) => i !== idx))}
                                                    className="inline-flex items-center justify-center h-5 w-5 rounded text-red-600 hover:bg-red-50 transition-colors text-xs"
                                                >✕</button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="text-right text-xs text-slate-500 pt-1 border-t border-slate-200">
                                        {t('facturation:payment.remaining_to_allocate')} <span className="font-bold text-red-600">{formatCurrency(totals.partPatient - paiements.reduce((acc, p) => acc + p.montant, 0) - (Number(montantPaye) || 0))}</span>
                                    </div>
                                </div>
                            )}

                        <div className="w-full">
                            <label className="block py-1 text-xs uppercase font-bold text-slate-500">{t('facturation:payment.amount_label')}</label>
                            <input
                                type="number"
                                className="w-full h-12 px-3 rounded-lg border border-slate-200 bg-white font-light text-2xl text-center text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                value={montantPaye}
                                onChange={(e) => setMontantPaye(e.target.value)}
                            />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 border border-blue-100">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-blue-600">{t('facturation:totals.part_assurance')} ({totals.tauxCouverture}%)</span>
                        <span className="text-lg font-bold text-blue-600">{formatCurrency(Math.round(totals.partAssurance))}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        <span className="inline-flex items-center px-2 h-5 text-[10px] rounded bg-slate-100 text-slate-600 font-medium">{t('facturation:payment.en_compte_auto')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-full">
                    <label className="block py-1 text-xs uppercase font-bold text-slate-500">{t('facturation:payment.payment_mode_label')}</label>
                    {(() => {
                          const selectedPoste = postesCaissesActive?.find(p => p.id === selectedPosteCaisseId)
                            ?? postesCaissesActive?.[0]
                          const caissierName = selectedPoste?.session_active?.ouvert_par_name
                            || selectedPoste?.ouvert_par_name
                            || selectedPoste?.ouvert_par?.username
                            || null
                          const posteName = selectedPoste?.nom || t('facturation:payment.caisse_centrale')
                          return (
                            <div className="p-3 bg-white border border-slate-200 rounded-lg text-sm font-medium flex items-center gap-2">
                              <span className="inline-flex items-center px-2 h-5 text-[10px] rounded bg-emerald-100 text-emerald-700 font-medium"></span>
                              <span>{posteName}</span>
                              {caissierName && (
                                <span className="text-[10px] text-slate-400 ml-auto font-normal flex items-center gap-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                  </svg>
                                  {caissierName}
                                </span>
                              )}
                            </div>
                          )
                        })()}
                    {/* Hidden input to maintain logic if needed, but we just use state 'especes' */}
                  </div>

                  {/* Liste des paiements multiples */}
                  {paiements.length > 0 && (
                    <div className="bg-slate-50 rounded-lg p-2 space-y-1">
                        {paiements.map((p, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm p-1 px-2 bg-white rounded border border-slate-200">
                                <span>{t('facturation:payment.caisse_centrale')}</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono">{formatCurrency(p.montant)}</span>
                                    <button
                                        type="button"
                                        onClick={() => setPaiements(paiements.filter((_, i) => i !== idx))}
                                        className="inline-flex items-center justify-center h-6 w-6 rounded text-red-600 hover:bg-red-50 transition-colors text-xs"
                                    >✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                  )}

                  <div className="w-full">
                    <label className="block py-1 text-xs uppercase font-bold text-slate-500">{t('facturation:payment.amount_label')}</label>
                    <input
                      ref={paymentInputRef}
                      type="number"
                      step="0.01"
                      value={montantPaye}
                      onChange={(e) => setMontantPaye(e.target.value)}
                      className="w-full h-12 px-3 rounded-lg border border-slate-200 bg-white font-light text-2xl text-center text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      placeholder={t('facturation:payment.amount_label')}
                    />
                  </div>
                </>
              )}

              <div className="pt-4 border-t border-slate-200 mt-2">
                <button
                    ref={submitBtnRef}
                    type="submit"
                    disabled={loading || (isNewSale && !montantPaye) || (isMultiCaisse && !centralizedCashRegister && isNewSale && !selectedPosteCaisseId)}
                    className="inline-flex items-center justify-center w-full h-10 rounded-lg text-sm font-semibold bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full size-4 border-b-2 border-white"></div>
                        {t('facturation:payment.status.processing')}
                      </div>
                    ) : isNewSale ? t('facturation:payment.validate_sale') : t('facturation:payment.register_payment')}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-8 text-center text-slate-400">
                {t('facturation:payment.no_invoice')}
            </div>
          )}
        </PremiumModal>
    )
}
