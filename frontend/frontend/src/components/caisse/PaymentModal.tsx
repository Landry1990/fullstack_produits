import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import type { Facture, CouponMonnaie } from '../../types'
import PremiumModal from '../common/PremiumModal'

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
  const [modePaiement, setModePaiement] = useState('especes')
  const [paiements, setPaiements] = useState<{ mode: string; montant: number }[]>([])
  const montantInputRef = useRef<HTMLInputElement>(null)
  const modeBtnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const validateBtnRef = useRef<HTMLButtonElement>(null)

  // Computed values
  const hasTiersPayant = facture.part_client !== null 
    && Number(facture.part_client) >= 0 
    && Number(facture.part_client) < Number(facture.total_ttc)

  const montantDu = Math.round(
    (hasTiersPayant ? Number(facture.part_client) : Number(facture.total_ttc))
    - (coupon ? Number(coupon.montant) : 0)
  )

  const totalVerse = paiements.reduce((acc, p) => acc + p.montant, 0)
  const resteAPayer = montantDu - totalVerse
  const peutValider = totalVerse >= montantDu && paiements.length > 0

  const soldeDepot = parseFloat(facture.client_solde_depot || '0')
  const isIndividual = facture.client_type === 'PARTICULIER'
  const isDepositEnabled = facture.client_is_deposit_enabled ?? false

  const paymentModes = [
    { value: 'especes', label: t('payment.modes.especes') },
    { value: 'carte', label: t('payment.modes.carte') },
    { value: 'om', label: t('payment.modes.om') },
    { value: 'momo', label: t('payment.modes.momo') },
    { value: 'cheque', label: t('payment.modes.cheque') },
    { value: 'virement', label: t('payment.modes.virement') },
    ...(soldeDepot > 0 && isIndividual && isDepositEnabled ? [{ value: 'depot', label: `${t('payment.modes.depot')} (${soldeDepot})` }] : [])
  ]

  const getModeLabel = (value: string) => paymentModes.find(m => m.value === value)?.label || value

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setMontantPaye(montantDu.toString())
      setPaiements([])
      setModePaiement('especes')
      const timer = setTimeout(() => {
        montantInputRef.current?.focus()
        montantInputRef.current?.select()
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Escape to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleAddPayment = () => {
    const montant = Number(montantPaye)
    if (!montant || montant === 0) return

    if (modePaiement === 'depot') {
      const alreadyPaidWithDepot = paiements
        .filter(p => p.mode === 'depot')
        .reduce((acc, p) => acc + p.montant, 0)
      
      if (montant + alreadyPaidWithDepot > soldeDepot) {
        toast.error(t('messages.insufficient_deposit'))
        return
      }
    }
    
    const newPaiements = [...paiements, { mode: modePaiement, montant }]
    setPaiements(newPaiements)
    
    const newTotal = newPaiements.reduce((acc, p) => acc + p.montant, 0)
    const newReste = Math.max(0, montantDu - newTotal)
    
    if (newReste > 0) {
      setMontantPaye(newReste.toString())
      setTimeout(() => {
        montantInputRef.current?.focus()
        montantInputRef.current?.select()
      }, 50)
    } else {
      setMontantPaye('')
      setTimeout(() => validateBtnRef.current?.focus(), 50)
    }
  }

  const focusFirstModeBtn = () => {
    modeBtnRefs.current[0]?.focus()
  }

  const handleModeKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setModePaiement(paymentModes[index].value)
      handleAddPayment()
      return
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const nextIndex = (index + 1) % paymentModes.length
      modeBtnRefs.current[nextIndex]?.focus()
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prevIndex = (index - 1 + paymentModes.length) % paymentModes.length
      modeBtnRefs.current[prevIndex]?.focus()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      montantInputRef.current?.focus()
      montantInputRef.current?.select()
    }
  }

  const handleRemovePayment = (idx: number) => {
    const newPaiements = paiements.filter((_, i) => i !== idx)
    setPaiements(newPaiements)
    const newTotal = newPaiements.reduce((acc, p) => acc + p.montant, 0)
    const newReste = Math.max(0, montantDu - newTotal)
    setMontantPaye(newReste.toString())
  }

  const handleConfirm = () => {
    if (peutValider && !loading) {
      onConfirm(paiements)
    }
  }

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('payment.title_with_num', { num: facture.numero_facture })}
      icon={<span className="text-primary text-xl">💰</span>}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            disabled={loading}
          >
            {t('payment.cancel')}
          </button>
          <button
            ref={validateBtnRef}
            onClick={handleConfirm}
            className={`btn btn-sm ${peutValider ? 'btn-success text-white' : 'btn-disabled'}`}
            disabled={loading || !peutValider}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && peutValider && !loading) {
                e.preventDefault()
                handleConfirm()
              }
            }}
          >
            {loading 
              ? <span className="loading loading-spinner loading-sm"></span>
              : peutValider 
                ? `✓ ${t('payment.validate')}` 
                : t('payment.remaining', { amount: resteAPayer })
            }
          </button>
        </div>
      }
    >
        <div className="p-5 space-y-4">
          {/* Montant dû */}
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-base-content/50 mb-1">
              {hasTiersPayant ? t('payment.part_patient') : t('payment.amount_to_pay')}
            </div>
            <div className="text-4xl font-light text-primary">{montantDu} {t('common:currency_symbol', 'F')}</div>
            {coupon && (
              <div className="text-xs text-success mt-1">
                {t('payment.coupon_discount', { num: coupon.numero, amount: Number(coupon.montant) })}
              </div>
            )}
            {hasTiersPayant && (
              <div className="text-xs text-info mt-1">
                {t('payment.part_assurance', { amount: Math.round(Number(facture.total_ttc) - Number(facture.part_client!)) })}
              </div>
            )}
            {/* Reminder for Cashier about existing deposit */}
            {soldeDepot > 0 && (
              <div className="mt-2 text-center">
                <span className="badge badge-success badge-sm gap-1 py-2 h-auto text-[10px] font-bold uppercase tracking-wider">
                  💡 {t('payment.deposit_available', { amount: soldeDepot })}
                </span>
              </div>
            )}
          </div>

          {/* Ligne de saisie : Montant + boutons Mode + Ajouter */}
          <div className="flex gap-2 items-end">
            <div className="form-control flex-1">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold">{t('payment.amount')}</span>
              </label>
              <input
                ref={montantInputRef}
                type="number"
                className="input input-bordered input-sm w-full text-right font-mono"
                value={montantPaye}
                onChange={(e) => setMontantPaye(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    focusFirstModeBtn()
                  }
                }}
                placeholder="0"
              />
            </div>
            <button
              type="button"
              className="btn btn-sm btn-primary mb-0"
              onClick={handleAddPayment}
              disabled={!montantPaye || Number(montantPaye) === 0}
              title="Entrée dans le montant ou clic"
            >
              +
            </button>
          </div>

          {/* Modes de paiement en boutons */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs font-semibold">{t('payment.mode')}</span>
            </label>
            <div className="flex flex-wrap gap-1">
              {paymentModes.map((m, idx) => (
                <button
                  key={m.value}
                  ref={(el) => { modeBtnRefs.current[idx] = el }}
                  type="button"
                  className={`px-2 py-1 text-xs font-medium rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
                    modePaiement === m.value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-base-100 text-base-content border-base-300 hover:bg-base-200'
                  }`}
                  onClick={() => {
                    setModePaiement(m.value)
                    handleAddPayment()
                  }}
                  onKeyDown={(e) => handleModeKeyDown(e, idx)}
                  title={`${m.label} — ←→ pour naviguer, Entrée pour valider, Échap pour retour`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Liste des paiements enregistrés */}
          {paiements.length > 0 && (
            <div className="bg-base-100 rounded-lg border border-base-200 overflow-hidden">
              <div className="px-3 py-2 bg-base-200/50 text-xs font-bold uppercase tracking-wider text-base-content/50">
                {t('payment.payments_list')}
              </div>
              {paiements.map((p, idx) => (
                <div key={idx} className="flex justify-between items-center px-3 py-2 border-t border-base-200">
                  <span className="text-sm">{getModeLabel(p.mode)}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">{p.montant} {t('common:currency_symbol', 'F')}</span>
                    <button
                      onClick={() => handleRemovePayment(idx)}
                      className="btn btn-ghost btn-xs text-error h-5 w-5 min-h-0 p-0"
                    >✕</button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center px-3 py-2 border-t border-base-300 bg-base-200/30">
                <span className="text-sm font-bold">{t('payment.total_paid')}</span>
                <span className="font-mono font-bold text-primary">{totalVerse} {t('common:currency_symbol', 'F')}</span>
              </div>
            </div>
          )}

          {/* Reste à payer / Rendu monnaie */}
          {paiements.length > 0 && (
            <div className="space-y-2">
              {resteAPayer > 0 && (
                <div className="flex justify-between items-center px-3 py-2 bg-warning/10 border border-warning/30 rounded-lg">
                  <span className="text-sm font-semibold text-warning">{t('payment.remaining', { amount: '' }).replace(' F', '')}</span>
                  <span className="font-mono font-bold text-warning text-lg">{resteAPayer} {t('common:currency_symbol', 'F')}</span>
                </div>
              )}
              {resteAPayer < 0 && (
                <div className="flex justify-between items-center px-3 py-3 bg-success/10 border border-success/30 rounded-lg">
                  <span className="text-sm font-semibold text-success">💰 {t('payment.change_back')}</span>
                  <span className="font-mono font-bold text-success text-2xl">{Math.abs(resteAPayer)} {t('common:currency_symbol', 'F')}</span>
                </div>
              )}
            </div>
          )}
        </div>
    </PremiumModal>
  )
}
