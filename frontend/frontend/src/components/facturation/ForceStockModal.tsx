import { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../shadcn/button'
import type { ProduitModel } from '../../types'

interface ForceStockModalProps {
  product: ProduitModel | null
  onClose: () => void
  onSubstitute: (product: ProduitModel) => void
  onForceStock: (product: ProduitModel) => void
}

export default function ForceStockModal({ product, onClose, onSubstitute, onForceStock }: ForceStockModalProps) {
  const { t } = useTranslation()
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (product && modalRef.current) {
      const primaryBtn = modalRef.current.querySelector('[data-action="confirm"]') as HTMLButtonElement | null
      primaryBtn?.focus()
    }
  }, [product])

  if (!product) return null

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onKeyDown={(e) => {
        const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-action]')
        if (!buttons.length) return
        const current = Array.from(buttons).indexOf(document.activeElement as HTMLButtonElement)
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          const next = current >= 0 ? (current + 1) % buttons.length : 0
          buttons[next].focus()
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          const prev = current >= 0 ? (current - 1 + buttons.length) % buttons.length : buttons.length - 1
          buttons[prev].focus()
        } else if (e.key === 'Enter' && current >= 0) {
          e.preventDefault()
          buttons[current].click()
        }
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <h3 className="font-bold text-lg mb-2 text-slate-800">
          {t('common:force_stock.title', { produit: product.name, defaultValue: `Stock insuffisant — ${product.name}` })}
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          {t('common:force_stock.message', { stock: product.stock, defaultValue: `Ce produit a un stock de ${product.stock}. Souhaitez-vous forcer la vente malgré tout ?` })}
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" data-action="substitute" onClick={() => {
            onSubstitute(product)
            onClose()
          }}>
            {t('common:force_stock.substitute', { defaultValue: 'Voir les substituts' })}
          </Button>
          <Button variant="default" size="sm" data-action="confirm" onClick={() => {
            onForceStock(product)
            onClose()
          }}>
            {t('common:force_stock.force', { defaultValue: 'Forcer la vente' })}
          </Button>
          <Button variant="outline" size="sm" data-action="cancel" onClick={onClose}>
            {t('common:force_stock.cancel', { defaultValue: 'Annuler' })}
          </Button>
        </div>
      </div>
    </div>
  )
}
