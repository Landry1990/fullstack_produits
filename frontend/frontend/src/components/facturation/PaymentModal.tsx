import { useEffect, useState } from 'react'
import axios from 'axios'
import type { Facture } from '../../types'
import { useTranslation } from 'react-i18next'

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
    onCompleteSale: (validatedBy?: number, password?: string) => void
    onRegisterPayment: () => void
    selectedClient: number | null
    useManualClient: boolean
    paymentInputRef: React.RefObject<HTMLInputElement | null>
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
    paymentInputRef
}: PaymentModalProps) {
    const { t } = useTranslation()

    // Sudo Mode State
    const [selectedValidator, setSelectedValidator] = useState<number | null>(null);
    const [sudoPassword, setSudoPassword] = useState('');
    const [users, setUsers] = useState<any[]>([]);

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

    useEffect(() => {
        if (isOpen) {
            // Fetch users for Sudo selection
            const fetchUsers = async () => {
                try {
                    const response = await axios.get(`${String(apiBaseUrl).replace(/\/$/, '')}/api/users/`);
                    const data = response.data.results || response.data;
                    setUsers(Array.isArray(data) ? data : []);
                } catch (err) {
                    console.error("Erreur chargement utilisateurs", err);
                }
            };
            fetchUsers();
            
             // Focus sur le montant après un court délai pour laisser la modale s'ouvrir
             setTimeout(() => {
                paymentInputRef.current?.focus()
                paymentInputRef.current?.select()
            }, 100)
        } else {
            // Reset Sudo state on close
            setSelectedValidator(null);
            setSudoPassword('');
        }
    }, [isOpen, paymentInputRef, apiBaseUrl])

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
                // Pass Sudo params if set
                onCompleteSale(selectedValidator || undefined, sudoPassword || undefined);
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
                                            <span>{p.mode === 'especes' ? t('facturation.payment.modes.especes') : p.mode === 'carte' ? t('facturation.payment.modes.carte') : p.mode === 'om' ? t('facturation.payment.modes.mobile') : p.mode === 'momo' ? t('facturation.payment.modes.momo') : p.mode === 'cheque' ? t('facturation.payment.modes.cheque') : t('facturation.payment.modes.other')}</span>
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

              {/* Sudo Mode Section */}
              <div className="bg-base-50 p-3 rounded-lg border border-base-200 mt-4 mb-2">
                  <div className="form-control w-full">
                      <label className="label py-1">
                          <span className="label-text text-xs uppercase font-bold text-base-content/50">{t('facturation.payment.sudo_mode.validate_by') || 'Validé par'}</span>
                      </label>
                      <select 
                          className="select select-bordered select-sm w-full"
                          value={selectedValidator || ''}
                          onChange={(e) => setSelectedValidator(e.target.value ? Number(e.target.value) : null)}
                      >
                          <option value="">(Moi-même)</option>
                          {Array.isArray(users) && users.map(u => (
                              <option key={u.id} value={u.id}>
                                  {u.first_name} {u.last_name} ({u.username})
                              </option>
                          ))}
                      </select>
                  </div>
                  
                  {selectedValidator && (
                      <div className="form-control w-full mt-2">
                          <label className="label py-1">
                              <span className="label-text text-xs uppercase font-bold text-base-content/50">{t('facturation.payment.sudo_mode.password') || 'Mot de passe (Sudo)'}</span>
                          </label>
                          <input 
                              type="password" 
                              className="input input-bordered input-sm w-full"
                              placeholder="Mot de passe du validateur..."
                              value={sudoPassword}
                              onChange={(e) => setSudoPassword(e.target.value)}
                          />
                      </div>
                  )}
              </div>

              {(() => {
                const totalAPayer = isNewSale 
                    ? (totals.tauxCouverture > 0 
                        ? totals.partPatient 
                        : Math.max(0, (totals.totalTtc || 0) - (totals.couponMontant || 0) - (totals.loyaltyDeduction || 0)))
                    : (facturePourPaiement?.total_ttc ? Number(facturePourPaiement.total_ttc) : 0)
                
                const totalVerse = paiements.reduce((acc, p) => acc + p.montant, 0) + (paiements.length === 0 && Number(montantPaye) > 0 ? Number(montantPaye) : 0)
                const rendu = totalVerse - totalAPayer
                
                // Allow validation if fully paid OR if user wants to validate partial/credit (though typically we require full payment unless credit allowed)
                // For now, enable if fully paid OR if authorized (which logic is outside).
                // But button is disabled if `rendu < 0` usually.
                // Actually, logic below handles it.
                
                return (
                  <div className="pt-4 border-t border-base-200 mt-2">
                    <div className="flex justify-between items-center mb-4">
                        <div className="text-sm">
                            {rendu >= 0 
                                ? <span className="text-success font-bold">Rendu monnaie: {Math.round(rendu)} F</span>
                                : <span className="text-error font-bold">Reste à payer: {Math.round(Math.abs(rendu))} F</span>
                            }
                        </div>
                        <div className="text-xl font-bold">
                            Total: {Math.round(totalVerse)} / {Math.round(totalAPayer)} F
                        </div>
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={loading || (isNewSale && rendu < -1 && !selectedClient) || (selectedValidator !== null && !sudoPassword)}
                        className={`btn btn-primary w-full gap-2 ${loading ? 'loading' : ''}`}
                    >
                        {loading ? 'Traitement...' : isNewSale ? t('facturation.payment.validate_sale') : t('facturation.payment.register_payment')}
                    </button>
                  </div>
                )
              })()}
            </form>
          )}

          {!facturePourPaiement && !isNewSale && (
            <div className="p-8 text-center text-base-content/50">
                Aucune facture sélectionnée.
            </div>
          )}
        </div>
        </dialog>
    )
}

