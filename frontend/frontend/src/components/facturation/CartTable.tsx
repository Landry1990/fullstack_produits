import React from 'react'
import { useTranslation } from 'react-i18next'
import { normalizeNumberInput } from '../../utils/formatters'
import type { LigneFacture, ProduitModel, LotAllocation } from '../../types'
import { useAuth } from '../../context/AuthContext'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/Table'
import { ShoppingCart } from 'lucide-react'
import CartRow from './CartRow'

interface CartTableProps {
  lignesFacture: LigneFacture[]
  updateQuantite: (lineId: string, quantite: number) => void
  updatePrix: (lineId: string, prix: string) => void
  updateRemiseProduit: (lineId: string, remise: string) => void
  updateTreatmentDuration?: (lineId: string, duration: number) => void
  removeLigne: (lineId: string) => void
  onOpenLotModal: (product: ProduitModel, currentLotId: string | null, quantity: number, currentAllocations: LotAllocation[] | null, lineId?: string | null) => void
  quantityInputsRef: React.MutableRefObject<Map<number, HTMLInputElement>>
  onReturnFocus: () => void
  selectedIndex?: number
  onSelectLine?: (index: number) => void
  refreshTrigger?: number
  isSidebarStyle?: boolean
}

const CartTable = React.memo(({
  lignesFacture,
  updateQuantite,
  updatePrix,
  updateRemiseProduit,
  updateTreatmentDuration,
  removeLigne,
  onOpenLotModal,
  quantityInputsRef,
  onReturnFocus,
  selectedIndex = -1,
  onSelectLine,
  refreshTrigger,
  isSidebarStyle
}: CartTableProps) => {
  const { user } = useAuth()
  const { t } = useTranslation(['facturation', 'common'])
  const [flashId, setFlashId] = React.useState<string | null>(null)
  const prevLenRef = React.useRef(lignesFacture.length)

  React.useEffect(() => {
    if (lignesFacture.length > prevLenRef.current) {
      const last = lignesFacture[lignesFacture.length - 1]
      if (last) {
        setFlashId(last.lineId)
        const id = setTimeout(() => setFlashId(null), 600)
        return () => clearTimeout(id)
      }
    }
    prevLenRef.current = lignesFacture.length
  }, [lignesFacture])

  const canModifyPrice = user?.is_superuser || user?.profile?.can_modify_price
  const maxDiscount = user?.is_superuser ? 100 : (normalizeNumberInput(user?.profile?.max_discount_rate || 0))

  if (lignesFacture.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 min-h-[200px] text-slate-300">
        <ShoppingCart className="size-16" />
        <p className="font-light text-slate-400">{t('facturation:cart.empty')}</p>
      </div>
    )
  }

  if (isSidebarStyle) {
    return (
      <div className="flex flex-col">
        {lignesFacture.map((ligne, index) => (
          <CartRow
            key={ligne.lineId}
            ligne={ligne}
            index={index}
            selectedIndex={selectedIndex}
            onSelectLine={onSelectLine}
            updateQuantite={updateQuantite}
            updatePrix={updatePrix}
            updateRemiseProduit={updateRemiseProduit}
            updateTreatmentDuration={updateTreatmentDuration}
            removeLigne={removeLigne}
            onOpenLotModal={onOpenLotModal}
            quantityInputsRef={quantityInputsRef}
            onReturnFocus={onReturnFocus}
            canModifyPrice={!!canModifyPrice}
            maxDiscount={maxDiscount}
            t={t}
            refreshTrigger={refreshTrigger}
            isSidebarStyle={true}
            flashId={flashId}
          />
        ))}
      </div>
    )
  }

  return (
    <Table className="w-full">
      <TableHeader className="sticky top-0 z-30 bg-slate-100">
        <TableRow className="bg-slate-100 uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200 text-xs hover:bg-slate-100">
          <TableHead className="bg-slate-100 pl-2 md:pl-4 min-w-[120px] py-2">{t('facturation:cart.headers.product')}</TableHead>
          <TableHead className="bg-slate-100 text-right w-12 sm:w-20 py-2">{t('facturation:cart.headers.qty')}</TableHead>
          <TableHead className="bg-slate-100 text-right w-16 sm:w-24 py-2">{t('facturation:cart.headers.price')}</TableHead>
          <TableHead className="bg-slate-100 text-right w-14 md:w-16 hidden lg:table-cell py-2">{t('facturation:cart.headers.discount')}</TableHead>
          <TableHead className="bg-slate-100 text-center w-24 hidden md:table-cell py-2">{t('facturation:cart.headers.stock')}</TableHead>
          <TableHead className="bg-slate-100 text-center w-36 sm:w-64 hidden md:table-cell py-2">{t('facturation:cart.headers.lot')}</TableHead>
          <TableHead className="bg-slate-100 text-right w-18 sm:w-28 pr-2 md:pr-4 py-2">{t('facturation:cart.headers.total')}</TableHead>
          <TableHead className="bg-slate-100 w-8 py-2"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignesFacture.map((ligne, index) => (
          <CartRow
            key={ligne.lineId}
            ligne={ligne}
            index={index}
            selectedIndex={selectedIndex}
            onSelectLine={onSelectLine}
            updateQuantite={updateQuantite}
            updatePrix={updatePrix}
            updateRemiseProduit={updateRemiseProduit}
            updateTreatmentDuration={updateTreatmentDuration}
            removeLigne={removeLigne}
            onOpenLotModal={onOpenLotModal}
            quantityInputsRef={quantityInputsRef}
            onReturnFocus={onReturnFocus}
            canModifyPrice={!!canModifyPrice}
            maxDiscount={maxDiscount}
            t={t}
            refreshTrigger={refreshTrigger}
            flashId={flashId}
          />
        ))}
      </TableBody>
    </Table>
  )
})

export default CartTable
