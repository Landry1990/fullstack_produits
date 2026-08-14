import { useMemo } from 'react'
import { formatCurrency } from '../utils/formatters'
import { getFEFOPreview } from '../utils/fefo'
import type { LigneFacture } from '../types'

interface UseLotDisplayParams {
  ligne: LigneFacture
  t: (key: string, options?: unknown) => string
}

export function useLotDisplay({ ligne, t }: UseLotDisplayParams) {
  const fefoPreview = useMemo(() => {
    if (ligne.lotId) return []
    return getFEFOPreview(ligne.produit.stock_lots, Math.abs(ligne.quantite))
  }, [ligne.lotId, ligne.produit.stock_lots, ligne.quantite])

  const lotDisplayText = useMemo(() => {
    const manualAllocs = ligne.lotAllocations?.filter(a => a.quantity > 0)
    if (manualAllocs && manualAllocs.length > 0) {
      if (manualAllocs.length === 1) {
        const a = manualAllocs[0]
        const parts = [a.lotText || `Lot ${a.lotId}`]
        if (a.lotExpiration) {
          const d = new Date(a.lotExpiration)
          parts.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`)
        }
        return parts.join(' • ')
      }
      return `${manualAllocs.length} lots • ${manualAllocs.map(a => `${a.lotText || a.lotId}×${a.quantity}`).join(', ')}`
    }
    if (!ligne.lotId) {
      if (fefoPreview.length === 0) return t('facturation:cart_extra.auto_fefo')
      if (fefoPreview.length === 1) {
        const p = fefoPreview[0]
        const parts = [p.lot]
        if (p.expiration) {
          const d = new Date(p.expiration)
          parts.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`)
        }
        return `${t('facturation:cart_extra.auto_prefix')} • ${parts.join(' • ')}`
      }
      const totalLots = fefoPreview.length
      const firstLot = fefoPreview[0]
      return `${t('facturation:cart_extra.auto_prefix')} • ${firstLot.lot} +${totalLots - 1}`
    }
    const parts = [ligne.lotText || `Lot ${ligne.lotId}`]
    if (ligne.lotExpiration) {
      const d = new Date(ligne.lotExpiration)
      parts.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`)
    }
    if (ligne.lotSellingPrice) {
      parts.push(`${formatCurrency(Number(ligne.lotSellingPrice))}`)
    }
    return parts.join(' • ')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ligne.lotId, ligne.lotText, ligne.lotExpiration, ligne.lotSellingPrice, ligne.lotAllocations, fefoPreview])

  const lotTooltip = useMemo(() => {
    const manualAllocs = ligne.lotAllocations?.filter(a => a.quantity > 0)
    if (manualAllocs && manualAllocs.length > 0) {
      return [
        t('facturation:cart_extra.manual_allocation'),
        ...manualAllocs.map(a => {
          const exp = a.lotExpiration ? new Date(a.lotExpiration).toLocaleDateString('fr-FR') : 'sans date'
          return `${a.lotText || a.lotId} × ${a.quantity} (exp ${exp})`
        })
      ].join('\n')
    }
    if (!ligne.lotId) {
      if (fefoPreview.length === 0) return t('facturation:cart.product_status.auto_lot')
      return [
        t('facturation:cart_extra.fefo_automatic'),
        ...fefoPreview.map(p => {
          const exp = p.expiration ? new Date(p.expiration).toLocaleDateString('fr-FR') : 'sans date'
          return `${p.lot} × ${p.qty} (exp ${exp})`
        })
      ].join('\n')
    }
    return [
      ligne.lotText ? `${t('facturation:cart.headers.lot')}: ${ligne.lotText}` : '',
      ligne.lotExpiration ? `${t('facturation:cart_extra.peremption')} ${new Date(ligne.lotExpiration).toLocaleDateString('fr-FR')}` : '',
      ligne.lotSellingPrice ? `${t('facturation:cart_extra.prix_lot')} ${formatCurrency(Number(ligne.lotSellingPrice))}` : ''
    ].filter(Boolean).join(' | ')
  }, [ligne, t, fefoPreview])

  return { fefoPreview, lotDisplayText, lotTooltip }
}
