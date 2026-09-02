import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Banknote, Coins, Smartphone, RotateCcw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../shadcn/dialog'
import { Button } from '../shadcn/button'

/** Détail du billetage renvoyé par le modal */
export interface CashBreakdown {
  billets: Record<number, number>  // { 10000: 5, 5000: 2, ... }
  pieces: Record<number, number>   // { 500: 3, 200: 0, ... }
  orange_money: number
  mtn_momo: number
  total: number
}

interface CashBreakdownModalProps {
  isOpen: boolean
  onClose: () => void
  /** Appelé avec le détail complet du billetage */
  onConfirm: (breakdown: CashBreakdown) => void
  /** Fonction de formatage monétaire locale (FCFA) */
  formatCurrency?: (n: number) => string
}

/** Coupures gérées (FCFA — Cameroun) */
const BILLETS = [10000, 5000, 2000, 1000, 500]
const PIECES = [500, 200, 100, 50, 25]

// Clés composées pour éviter l'overlap 500 entre billets et pièces
type CountKey = `billet_${number}` | `piece_${number}`
type Counts = Record<CountKey, string>

const billetKey = (v: number): CountKey => `billet_${v}`
const pieceKey = (v: number): CountKey => `piece_${v}`

const emptyCounts = (): Counts => {
  const c: Counts = {}
  BILLETS.forEach((v) => (c[billetKey(v)] = ''))
  PIECES.forEach((v) => (c[pieceKey(v)] = ''))
  return c
}

export const CashBreakdownModal: React.FC<CashBreakdownModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  formatCurrency,
}) => {
  const { t } = useTranslation('caisse')
  const [counts, setCounts] = useState<Counts>(emptyCounts)
  const [omAmount, setOmAmount] = useState('')
  const [momoAmount, setMomoAmount] = useState('')

  // On repart de zéro à chaque ouverture
  useEffect(() => {
    if (isOpen) {
      setCounts(emptyCounts())
      setOmAmount('')
      setMomoAmount('')
    }
  }, [isOpen])

  const computeLine = (valeur: number, qteStr: string): number => {
    const q = parseInt(qteStr, 10)
    return Number.isFinite(q) && q > 0 ? q * valeur : 0
  }

  const billetsTotal = useMemo(
    () => BILLETS.reduce((s, v) => s + computeLine(v, counts[billetKey(v)] ?? ''), 0),
    [counts],
  )
  const piecesTotal = useMemo(
    () => PIECES.reduce((s, v) => s + computeLine(v, counts[pieceKey(v)] ?? ''), 0),
    [counts],
  )
  const omTotal = useMemo(() => {
    const n = parseFloat(omAmount)
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [omAmount])
  const momoTotal = useMemo(() => {
    const n = parseFloat(momoAmount)
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [momoAmount])

  const cashTotal = billetsTotal + piecesTotal
  const grandTotal = cashTotal + omTotal + momoTotal

  const fmt = (n: number) =>
    formatCurrency
      ? formatCurrency(Math.round(n))
      : `${Math.round(n).toLocaleString('fr-FR')}`

  const handleCountChange = (key: CountKey, raw: string) => {
    // N'autoriser que des entiers positifs
    const cleaned = raw.replace(/[^0-9]/g, '')
    setCounts((prev) => ({ ...prev, [key]: cleaned }))
  }

  const handleReset = () => {
    setCounts(emptyCounts())
    setOmAmount('')
    setMomoAmount('')
  }

  // Référence au conteneur des inputs pour la navigation clavier
  const inputsContainerRef = useRef<HTMLDivElement>(null)

  /**
   * Sur Entrée : passe au champ suivant.
   * Sur le dernier champ : valide le billetage.
   */
  const handleEnterNext = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      const container = inputsContainerRef.current
      if (!container) return
      const inputs = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[data-billetage="1"]'),
      )
      const currentIdx = inputs.indexOf(e.currentTarget)
      if (currentIdx === -1) return
      if (currentIdx < inputs.length - 1) {
        const next = inputs[currentIdx + 1]
        next.focus()
        next.select()
      } else {
        // Dernier champ → valider
        handleConfirm()
      }
    },
    // handleConfirm dépend de counts/omAmount/momoAmount — on le recrée à chaque rendu
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [counts, omAmount, momoAmount],
  )

  const handleConfirm = () => {
    const billets: Record<number, number> = {}
    const pieces: Record<number, number> = {}
    BILLETS.forEach((v) => {
      const q = parseInt(counts[billetKey(v)] ?? '', 10)
      billets[v] = Number.isFinite(q) && q > 0 ? q : 0
    })
    PIECES.forEach((v) => {
      const q = parseInt(counts[pieceKey(v)] ?? '', 10)
      pieces[v] = Number.isFinite(q) && q > 0 ? q : 0
    })
    onConfirm({
      billets,
      pieces,
      orange_money: omTotal,
      mtn_momo: momoTotal,
      total: grandTotal,
    })
    onClose()
  }

  const renderBilletTile = (valeur: number) => {
    const key = billetKey(valeur)
    const qte = counts[key] ?? ''
    const lineTotal = computeLine(valeur, qte)
    return (
      <div
        key={key}
        className="flex flex-col items-center gap-1 p-2 rounded-lg border border-slate-200 bg-white"
      >
        <span className="text-xs font-black text-slate-700 tabular-nums leading-none">
          {fmt(valeur)}
        </span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="0"
          data-billetage="1"
          className="h-9 w-full px-1 rounded-md border border-slate-200 bg-slate-50 text-center text-sm font-mono font-bold text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
          value={qte}
          onChange={(e) => handleCountChange(key, e.target.value)}
          onKeyDown={handleEnterNext}
        />
        <span className="text-[10px] font-semibold text-slate-400 tabular-nums leading-none min-h-[12px]">
          {lineTotal > 0 ? fmt(lineTotal) : '—'}
        </span>
      </div>
    )
  }

  const renderPieceTile = (valeur: number) => {
    const key = pieceKey(valeur)
    const qte = counts[key] ?? ''
    const lineTotal = computeLine(valeur, qte)
    return (
      <div
        key={key}
        className="flex flex-col items-center gap-1 p-2 rounded-lg border border-slate-200 bg-white"
      >
        <span className="text-xs font-black text-slate-700 tabular-nums leading-none">
          {fmt(valeur)}
        </span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="0"
          data-billetage="1"
          className="h-9 w-full px-1 rounded-md border border-slate-200 bg-slate-50 text-center text-sm font-mono font-bold text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
          value={qte}
          onChange={(e) => handleCountChange(key, e.target.value)}
          onKeyDown={handleEnterNext}
        />
        <span className="text-[10px] font-semibold text-slate-400 tabular-nums leading-none min-h-[12px]">
          {lineTotal > 0 ? fmt(lineTotal) : '—'}
        </span>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 bg-emerald-600 text-white">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Banknote className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-white">
                {t('journal.closing.breakdown.title', {
                  defaultValue: 'Billetage de caisse',
                })}
              </DialogTitle>
              <DialogDescription className="text-emerald-50 text-xs mt-0.5">
                {t('journal.closing.breakdown.subtitle', {
                  defaultValue:
                    'Comptez vos coupures, le total reviendra dans le champ',
                })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div ref={inputsContainerRef} className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* === BILLETS === */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="size-4 text-emerald-600" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                {t('journal.closing.breakdown.bills', {
                  defaultValue: 'Billets',
                })}
              </h4>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {BILLETS.map(renderBilletTile)}
            </div>
          </section>

          {/* === PIÈCES === */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Coins className="size-4 text-amber-600" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                {t('journal.closing.breakdown.coins', {
                  defaultValue: 'Pièces',
                })}
              </h4>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {PIECES.map(renderPieceTile)}
            </div>
          </section>

          {/* === MOBILE MONEY === */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="size-4 text-orange-600" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                {t('journal.closing.breakdown.mobile_money', {
                  defaultValue: 'Mobile Money',
                })}
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col items-center gap-1 p-2 rounded-lg border border-orange-200 bg-orange-50/40">
                <span className="text-xs font-black text-orange-600 leading-none">
                  {t('journal.closing.breakdown.orange_money', {
                    defaultValue: 'Orange Money',
                  })}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  data-billetage="1"
                  className="h-9 w-full px-2 rounded-md border border-slate-200 bg-white text-right text-sm font-mono font-bold text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  value={omAmount}
                  onChange={(e) =>
                    setOmAmount(e.target.value.replace(/[^0-9.]/g, ''))
                  }
                  onKeyDown={handleEnterNext}
                />
              </div>
              <div className="flex flex-col items-center gap-1 p-2 rounded-lg border border-yellow-200 bg-yellow-50/40">
                <span className="text-xs font-black text-yellow-600 leading-none">
                  {t('journal.closing.breakdown.mtn_momo', {
                    defaultValue: 'MTN MoMo',
                  })}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  data-billetage="1"
                  className="h-9 w-full px-2 rounded-md border border-slate-200 bg-white text-right text-sm font-mono font-bold text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  value={momoAmount}
                  onChange={(e) =>
                    setMomoAmount(e.target.value.replace(/[^0-9.]/g, ''))
                  }
                  onKeyDown={handleEnterNext}
                />
              </div>
            </div>
          </section>

          {/* === SOUS-TOTAUX === */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
              <div className="text-[10px] font-bold uppercase text-slate-400">
                {t('journal.closing.breakdown.cash_subtotal', {
                  defaultValue: 'Espèces',
                })}
              </div>
              <div className="font-black text-slate-700 tabular-nums">
                {fmt(cashTotal)}
              </div>
            </div>
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-2.5">
              <div className="text-[10px] font-bold uppercase text-orange-400">
                {t('journal.closing.breakdown.mobile_subtotal', {
                  defaultValue: 'Mobile Money',
                })}
              </div>
              <div className="font-black text-orange-700 tabular-nums">
                {fmt(omTotal + momoTotal)}
              </div>
            </div>
          </div>
        </div>

        {/* === TOTAL + ACTIONS === */}
        <DialogFooter className="p-5 pt-3 border-t border-slate-100 flex-col sm:flex-col gap-3">
          <div className="w-full rounded-xl bg-emerald-600 text-white p-3 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-100">
              {t('journal.closing.breakdown.grand_total', {
                defaultValue: 'Total à reporter',
              })}
            </span>
            <span className="text-2xl font-black tabular-nums">
              {fmt(grandTotal)}
            </span>
          </div>
          <div className="flex gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl flex-1"
              onClick={handleReset}
            >
              <RotateCcw className="size-4 mr-1.5" />
              {t('journal.closing.breakdown.reset', {
                defaultValue: 'Réinitialiser',
              })}
            </Button>
            <Button
              type="button"
              className="rounded-xl flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirm}
            >
              {t('journal.closing.breakdown.confirm', {
                defaultValue: 'Reporter le total',
              })}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CashBreakdownModal
