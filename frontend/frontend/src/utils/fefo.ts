import type { StockLot } from '../types'

export interface FEFOPreviewItem {
  lot: string
  qty: number
  expiration?: string
}

export function getFEFOPreview(lots: StockLot[] | undefined, quantity: number): FEFOPreviewItem[] {
  if (!lots || lots.length === 0 || quantity <= 0) return []
  const sorted = [...lots]
    .filter(l => (l.quantity_remaining || 0) > 0)
    .sort((a, b) => {
      const expA = a.date_expiration ? new Date(a.date_expiration).getTime() : Infinity
      const expB = b.date_expiration ? new Date(b.date_expiration).getTime() : Infinity
      if (expA !== expB) return expA - expB
      const recA = a.date_reception ? new Date(a.date_reception).getTime() : 0
      const recB = b.date_reception ? new Date(b.date_reception).getTime() : 0
      return recA - recB
    })
  let remaining = quantity
  const preview: FEFOPreviewItem[] = []
  for (const lot of sorted) {
    if (remaining <= 0) break
    const available = lot.quantity_remaining || 0
    const take = Math.min(available, remaining)
    if (take > 0) {
      preview.push({
        lot: lot.lot || `Lot ${lot.id}`,
        qty: take,
        expiration: lot.date_expiration || undefined
      })
      remaining -= take
    }
  }
  return preview
}
