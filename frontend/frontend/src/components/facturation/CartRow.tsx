import React from 'react'
import type { LigneFacture, ProduitModel, LotAllocation } from '../../types'
import SidebarCartRow from './SidebarCartRow'
import TableCartRow from './TableCartRow'

export interface CartRowProps {
  ligne: LigneFacture
  index: number
  selectedIndex: number
  onSelectLine?: (index: number) => void
  updateQuantite: (lineId: string, quantite: number) => void
  updatePrix: (lineId: string, prix: string) => void
  updateRemiseProduit: (lineId: string, remise: string) => void
  updateTreatmentDuration?: (lineId: string, duration: number) => void
  removeLigne: (lineId: string) => void
  onOpenLotModal: (product: ProduitModel, currentLotId: string | null, quantity: number, currentAllocations: LotAllocation[] | null, lineId?: string | null) => void
  quantityInputsRef: React.MutableRefObject<Map<number, HTMLInputElement>>
  onReturnFocus: () => void
  canModifyPrice: boolean
  maxDiscount: number
  t: (key: string, options?: unknown) => string
  refreshTrigger?: number
  isSidebarStyle?: boolean
  flashId?: string | null
}

const CartRow = React.memo(({
  isSidebarStyle,
  ...props
}: CartRowProps) => {
  if (isSidebarStyle) {
    const { updateTreatmentDuration: _, ...sidebarProps } = props
    void _
    return <SidebarCartRow {...sidebarProps} />
  }
  return <TableCartRow {...props} />
})

export default CartRow
