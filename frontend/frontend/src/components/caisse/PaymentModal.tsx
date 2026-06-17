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

  const handleAddPayment = (forcedMode?: string) => {
    const mode = forcedMode || modePaiement
    const montant = Number(montantPaye)
    if (!montant || montant === 0) return

    if (mode === 'depot') {
      const alreadyPaidWithDepot = paiements
        .filter(p => p.mode === 'depot')
        .reduce((acc, p) => acc + p.montant, 0)
      
      if (montant + alreadyPaidWithDepot > soldeDepot) {
        toast.error(t('messages.insufficient_deposit'))
        return
      }
    }
    
    const newPaiements = [...paiements, { mode, montant }]
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
      handleAddPayment(paymentModes[index].value)
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
      icon={<span className="text-emerald-600 text-xl">💰</span>}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <button
            className="inline-flex items-center justify-center h-8 px-4 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            onClick={onClose}
            disabled={loading}
          >
            {t('payment.cancel')}
          </button>
          <button
            ref={validateBtnRef}
            onClick={handleConfirm}
            className={`inline-flex items-center justify-center h-8 px-4 rounded-lg text-sm font-semibold transition-colors ${peutValider ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
            disabled={loading || !peutValider}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && peutValider && !loading) {
                e.preventDefault()
                handleConfirm()
              }
            }}
          >
            {loading
              ? <div className="animate-spin rounded-full size-4 border-b-2 border-white"></div>
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
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">
              {hasTiersPayant ? t('payment.part_patient') : t('payment.amount_to_pay')}
            </div>
            <div className="text-4xl font-light text-emerald-600">{montantDu} {t('common:currency_symbol', 'F')}</div>
            {coupon && (
              <div className="text-xs text-emerald-600 mt-1">
                {t('payment.coupon_discount', { num: coupon.numero, amount: Number(coupon.montant) })}
              </div>
            )}
            {hasTiersPayant && (
              <div className="text-xs text-blue-600 mt-1">
                {t('payment.part_assurance', { amount: Math.round(Number(facture.total_ttc) - Number(facture.part_client!)) })}
              </div>
            )}
            {/* Reminder for Cashier about existing deposit */}
            {soldeDepot > 0 && (
              <div className="mt-2 text-center">
                <span className="inline-flex items-center gap-1 px-2.5 h-6 text-xs rounded-full bg-emerald-100 text-emerald-700 font-medium">
                  💡 {t('payment.deposit_available', { amount: soldeDepot })}
                </span>
              </div>
            )}
          </div>

          {/* Ligne de saisie : Montant + boutons Mode + Ajouter */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block py-1 text-xs font-semibold text-slate-700">
                {t('payment.amount')}
              </label>
              <input
                ref={montantInputRef}
                type="number"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-right font-mono text-sm text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
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
              className="inline-flex items-center justify-center h-9 px-3 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors mb-0.5"
              onClick={() => handleAddPayment()}
              disabled={!montantPaye || Number(montantPaye) === 0}
              title="Entrée dans le montant ou clic"
            >
              +
            </button>
          </div>

          {/* Modes de paiement en boutons */}
          <div className="w-full">
            <label className="block py-1 text-xs font-semibold text-slate-700">
              {t('payment.mode')}
            </label>
            <div className="flex flex-wrap gap-1">
              {paymentModes.map((m, idx) => (
                <button
                  key={m.value}
                  ref={(el) => { modeBtnRefs.current[idx] = el }}
                  type="button"
                  className={`px-2 py-1 text-xs font-medium rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
                    modePaiement === m.value
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    setModePaiement(m.value)
                    handleAddPayment(m.value)
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
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
                {t('payment.payments_list')}
              </div>
              {paiements.map((p, idx) => (
                <div key={idx} className="flex justify-between items-center px-3 py-2 border-t border-slate-100">
                  <span className="text-sm text-slate-700">{getModeLabel(p.mode)}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800">{p.montant} {t('common:currency_symbol', 'F')}</span>
                    <button
                      onClick={() => handleRemovePayment(idx)}
                      className="inline-flex items-center justify-center size-5 rounded text-red-500 hover:bg-red-50 transition-colors"
                    >✕</button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center px-3 py-2 border-t border-slate-200 bg-slate-50/50">
                <span className="text-sm font-bold text-slate-800">{t('payment.total_paid')}</span>
                <span className="font-mono font-bold text-emerald-600">{totalVerse} {t('common:currency_symbol', 'F')}</span>
              </div>
            </div>
          )}

          {/* Reste à payer / Rendu monnaie */}
          {paiements.length > 0 && (
            <div className="space-y-2">
              {resteAPayer > 0 && (
                <div className="flex justify-between items-center px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-sm font-semibold text-amber-700">{t('payment.remaining', { amount: '' }).replace(' F', '')}</span>
                  <span className="font-mono font-bold text-amber-700 text-lg">{resteAPayer} {t('common:currency_symbol', 'F')}</span>
                </div>
              )}
              {resteAPayer < 0 && (
                <div className="flex justify-between items-center px-3 py-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="text-sm font-semibold text-emerald-700">💰 {t('payment.change_back')}</span>
                  <span className="font-mono font-bold text-emerald-700 text-2xl">{Math.abs(resteAPayer)} {t('common:currency_symbol', 'F')}</span>
                </div>
              )}
            </div>
          )}
        </div>
    </PremiumModal>
  )
}
