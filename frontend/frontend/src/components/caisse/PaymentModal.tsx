import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Facture, CouponMonnaie } from '../../types'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  facture: Facture
  coupon?: CouponMonnaie
  onConfirm: (paiements: { mode: string; montant: number }[]) => void
  loading: boolean
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  facture,
  coupon,
  onConfirm,
  loading
}) => {
  const { t } = useTranslation('caisse')
  const [montantPaye, setMontantPaye] = useState('')
  const [paiements, setPaiements] = useState<{ mode: string; montant: number }[]>([])
  const [paymentStep, setPaymentStep] = useState<'amount' | 'mode'>('amount')
  const [selectedModeIndex, setSelectedModeIndex] = useState(0)
  const montantInputRef = useRef<HTMLInputElement>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      const amountToPay = (facture.part_client !== null && Number(facture.part_client) >= 0)
        ? Number(facture.part_client)
        : Number(facture.total_ttc)
      
      const montantApresCoupon = Math.max(0, amountToPay - (coupon ? Number(coupon.montant) : 0))
      
      setMontantPaye(Math.round(montantApresCoupon).toString())
      setPaiements([])
      setPaymentStep('amount')
      setSelectedModeIndex(0)
    }
  }, [isOpen, facture, coupon])

  // Focus automatique sur le champ montant quand le modal s'ouvre ou revient à l'étape montant
  useEffect(() => {
    if (isOpen && paymentStep === 'amount') {
      const timer = setTimeout(() => {
        montantInputRef.current?.focus()
        montantInputRef.current?.select()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, paymentStep])

  // Raccourcis clavier (mouse killing) - Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si une autre modale est ouverte
      if (isOpen) {
        if (e.key === 'Escape') {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const modalTitle = t('payment_modal.title', { numero: facture.numero_facture })
  
  const amountToPayInitial = (facture.part_client !== null && Number(facture.part_client) >= 0)
    ? Number(facture.part_client)
    : Number(facture.total_ttc)
    
  const montantAffiche = Math.round(Math.max(0, amountToPayInitial - (coupon ? Number(coupon.montant) : 0)))

  const totalVerse = paiements.reduce((acc, p) => acc + p.montant, 0)
  const resteAPayer = Math.max(0, montantAffiche - totalVerse)
  const montantSaisi = Number(montantPaye) || 0
  const montantCourant = paymentStep === 'amount' ? 0 : montantSaisi
  const totalAvecCourant = totalVerse + montantCourant
  const peutValider = totalAvecCourant >= montantAffiche || (paiements.length > 0 && resteAPayer === 0)

  // Payment modes data
  const paymentModes = [
    { value: 'especes', label: `💵 ${t('payment_modes.especes')}`, key: '1' },
    { value: 'carte', label: `💳 ${t('payment_modes.carte')}`, key: '2' },
    { value: 'cheque', label: `📝 ${t('payment_modes.cheque')}`, key: '3' },
    { value: 'virement', label: `🏦 ${t('payment_modes.virement')}`, key: '4' },
    { value: 'om', label: `🟠 ${t('payment_modes.om_short') || 'OM'}`, key: '5' },
    { value: 'momo', label: `🟡 ${t('payment_modes.momo_short') || 'MoMo'}`, key: '6' },
  ]

  const selectMode = (modeValue: string) => {
    // Ajouter le paiement
    const newPaiements = [...paiements, { mode: modeValue, montant: montantSaisi }]
    setPaiements(newPaiements)
    
    // Calculer le reste
    const nouveauTotalVerse = totalVerse + montantSaisi
    const nouveauReste = Math.max(0, montantAffiche - nouveauTotalVerse)
    
    // Si reste, remettre en mode saisie avec le reste
    if (nouveauReste > 0) {
      setMontantPaye(nouveauReste.toString())
      setPaymentStep('amount')
      setSelectedModeIndex(0)
    } else {
      // Paiement complet
      setMontantPaye('')
    }
  }

  const handleConfirm = () => {
    if (peutValider && !loading) {
      onConfirm(paiements)
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg mb-4">{modalTitle}</h3>

        <div className="text-center mb-6">
          <div className="text-sm text-base-content/60">{t('payment_modal.total')}</div>
          <div className="text-4xl font-bold text-primary">{montantAffiche} F</div>
          {coupon && (
            <div className="badge badge-success mt-2 gap-1">
              <span>{t('payment_modal.coupon_label', { numero: coupon.numero, montant: coupon.montant })}</span>
            </div>
          )}
          {(facture.part_client !== null && Number(facture.part_client) >= 0) && (
             <div className="badge badge-info mt-2">{t('payment_modal.part_patient')}</div>
          )}
        </div>

        {/* Liste des paiements ajoutés */}
        {paiements.length > 0 && (
          <div className="bg-base-200 rounded-lg p-3 mb-4">
            <div className="text-xs font-bold mb-2">{t('payment_modal.recorded_payments')}:</div>
            {paiements.map((p, idx) => (
              <div key={idx} className="flex justify-between items-center bg-white p-2 rounded mb-1">
                <span className="text-sm">
                  {paymentModes.find(m => m.value === p.mode)?.label.split(' ')[1] || p.mode.toUpperCase()}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{p.montant} F</span>
                  <button 
                    onClick={() => {
                      const newPaiements = paiements.filter((_, i) => i !== idx)
                      setPaiements(newPaiements)
                      // Recalculer reste
                      const newTotal = newPaiements.reduce((acc, p) => acc + p.montant, 0)
                      const newReste = Math.max(0, montantAffiche - newTotal)
                      setMontantPaye(newReste.toString())
                      setPaymentStep('amount')
                    }}
                    className="btn btn-ghost btn-xs text-error"
                  >✕</button>
                </div>
              </div>
            ))}
            <div className="text-right text-xs mt-2 pt-2 border-t">
              {t('payment_modal.total_paid')}: <span className="font-bold">{totalVerse} F</span>
            </div>
          </div>
        )}

        {/* Reste à payer */}
        {resteAPayer > 0 && (
          <div className="alert alert-warning mb-4 py-2">
            <span className="font-bold">{t('payment_modal.balance', { amount: resteAPayer })}</span>
          </div>
        )}

        {/* Étape 1: Saisie du montant */}
        {paymentStep === 'amount' && (
          <div className="form-control w-full mb-4">
            <label className="label">
              <span className="label-text font-bold">{t('payment_modal.step1')}</span>
            </label>
            <input
              ref={montantInputRef}
              type="number"
              value={montantPaye}
              onChange={(e) => setMontantPaye(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && montantPaye && Number(montantPaye) > 0) {
                  e.preventDefault()
                  setPaymentStep('mode')
                }
              }}
              className="input input-bordered input-lg w-full text-3xl text-center font-bold"
              placeholder={resteAPayer > 0 ? `${resteAPayer} F` : '0 F'}
              autoFocus
            />
            <label className="label">
              <span className="label-text-alt text-base-content/60">{t('payment_modal.enter_hint')}</span>
            </label>
          </div>
        )}

        {/* Étape 2: Sélection du mode de paiement */}
        {paymentStep === 'mode' && (
          <div className="mb-4">
            <div className="text-sm text-base-content/70 mb-2 text-center">
              {t('table.amount')}: <span className="font-bold text-lg text-primary">{montantSaisi} F</span>
            </div>
            <label className="label">
              <span className="label-text font-bold">{t('payment_modal.step2')}</span>
            </label>
            
            <div 
              className="grid grid-cols-2 gap-2"
              tabIndex={0}
              ref={(el) => el?.focus()}
              onKeyDown={(e) => {
                const cols = 2
                const rows = Math.ceil(paymentModes.length / cols)
                const currentRow = Math.floor(selectedModeIndex / cols)
                const currentCol = selectedModeIndex % cols
                
                if (e.key === 'ArrowRight') {
                  e.preventDefault()
                  setSelectedModeIndex(prev => Math.min(prev + 1, paymentModes.length - 1))
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault()
                  setSelectedModeIndex(prev => Math.max(prev - 1, 0))
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  const newRow = Math.min(currentRow + 1, rows - 1)
                  setSelectedModeIndex(Math.min(newRow * cols + currentCol, paymentModes.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  const newRow = Math.max(currentRow - 1, 0)
                  setSelectedModeIndex(newRow * cols + currentCol)
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  selectMode(paymentModes[selectedModeIndex].value)
                } else if (e.key >= '1' && e.key <= '6') {
                  e.preventDefault()
                  const idx = parseInt(e.key) - 1
                  if (idx < paymentModes.length) {
                    selectMode(paymentModes[idx].value)
                  }
                } else if (e.key === 'Escape' || e.key === 'Backspace') {
                  e.preventDefault()
                  setPaymentStep('amount')
                  setSelectedModeIndex(0)
                }
              }}
            >
              {paymentModes.map((mode, idx) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => selectMode(mode.value)}
                  className={`btn btn-lg h-auto py-4 flex-col transition-all ${
                    idx === selectedModeIndex 
                      ? 'btn-primary ring-2 ring-primary ring-offset-2' 
                      : 'btn-outline'
                  }`}
                >
                  <span className="text-xl">{mode.label.split(' ')[1]}</span>
                  <kbd className="kbd kbd-xs opacity-50">{mode.key}</kbd>
                </button>
              ))}
            </div>
            
            <button
              onClick={() => {
                setPaymentStep('amount')
                setSelectedModeIndex(0)
              }}
              className="btn btn-ghost btn-sm w-full mt-2"
            >
              ← {t('payment_modal.modify_amount')}
            </button>
          </div>
        )}

        {/* Monnaie à rendre */}
        {totalAvecCourant > montantAffiche && (
          <div className="alert alert-success mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="text-sm">{t('payment_modal.change')}</div>
              <div className="text-xl font-bold">{(totalAvecCourant - montantAffiche).toFixed(0)} F</div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="modal-action">
          <button
            onClick={() => {
              onClose()
              setPaymentStep('amount')
              setPaiements([])
            }}
            className="btn btn-ghost"
            disabled={loading}
          >
            {t('table.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            className={`btn ${peutValider ? 'btn-success' : 'btn-disabled'}`}
            disabled={loading || !peutValider}
            ref={(el) => { if (el && peutValider) el.focus() }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && peutValider && !loading) {
                e.preventDefault()
                handleConfirm()
              }
            }}
          >
            {loading ? <span className="loading loading-spinner"></span> : (
              peutValider ? t('payment_modal.validate_hint') : t('payment_modal.balance_short', { amount: resteAPayer })
            )}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  )
}
