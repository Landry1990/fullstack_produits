import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Package, Minus, Plus, Trash2, Pencil, XCircle, Ticket, Banknote, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import type { Facture, FactureProduit, CouponMonnaie } from '../../types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../shadcn/dialog'
import { Button } from '../shadcn/button'
import { Badge } from '../shadcn/badge'
import { Checkbox } from '../shadcn/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/Table'

interface FacturesTableProps {
  sortedFactures: Facture[]
  loading: boolean
  selectedRowIndex: number
  onSelectRow: (index: number) => void
  onEncaisser: (facture: Facture) => void
  onRemoveCoupon: (factureId: number) => void
  onModify: (facture: Facture) => void
  onCancel: (facture: Facture) => void
  onApplyCoupon: (facture: Facture) => void
  onUpdateProductQuantity: (factureId: number, produitId: number, newQty: number) => void
  onRemoveProduct: (factureId: number, produitId: number) => void
  couponsParFacture: Record<number, CouponMonnaie>
  user: FacturesTableUser | null // Replace with proper User type if available
  myActivePoste?: unknown | null // Poste de caisse actif de l'utilisateur courant
  selectedIds?: Set<number>
  onToggleSelect?: (id: number) => void
  onSelectAll?: () => void
  /** Controlled: when set, opens the product preview for this facture */
  forcePreviewFactureId?: number | null
  onPreviewClosed?: () => void
}

interface FacturesTableUser {
  is_superuser?: boolean
  can_modify_invoice?: boolean
  can_cancel_invoice?: boolean
  can_cash_out?: boolean
  profile?: {
    can_modify_invoice?: boolean
    can_cancel_invoice?: boolean
    can_cash_out?: boolean
  }
}

interface FactureProduitRow extends FactureProduit {
  produit_name?: string
  quantite?: number
  prix_vente?: string | number
  produit_id?: number
}

export const FacturesTable: React.FC<FacturesTableProps> = ({
  sortedFactures,
  loading,
  selectedRowIndex,
  onSelectRow,
  onEncaisser,
  onRemoveCoupon,
  onModify,
  onCancel,
  onApplyCoupon,
  onUpdateProductQuantity,
  onRemoveProduct,
  couponsParFacture,
  user,
  myActivePoste,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  forcePreviewFactureId,
  onPreviewClosed
}) => {
  const { t, i18n } = useTranslation('caisse')
  const [previewFacture, setPreviewFacture] = useState<Facture | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const selectedRowRef = useRef<HTMLTableRowElement>(null)

  const dateLocale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR'

  // Open preview from keyboard shortcut (controlled prop)
  useEffect(() => {
    if (forcePreviewFactureId != null) {
      const facture = sortedFactures.find(f => f.id === forcePreviewFactureId)
      if (facture) setPreviewFacture(facture)
    }
  }, [forcePreviewFactureId, sortedFactures])

  // Garder la ligne sélectionnée focalisée pour le clavier
  useEffect(() => {
    selectedRowRef.current?.focus()
  }, [selectedRowIndex])

  const canModify = user?.is_superuser || user?.can_modify_invoice || user?.profile?.can_modify_invoice
  const canCancel = user?.is_superuser || user?.can_cancel_invoice || user?.profile?.can_cancel_invoice
  // Pour encaisser : il faut la permission ET avoir une caisse ouverte (sauf superuser)
  const hasCashOutPermission = user?.is_superuser || user?.can_cash_out || user?.profile?.can_cash_out
  const hasActiveCashSession = !!myActivePoste
  const canCashOut = hasCashOutPermission && (user?.is_superuser || hasActiveCashSession)

  // Reset page if list shrinks
  useEffect(() => {
    if (page > 1 && (page - 1) * pageSize >= sortedFactures.length) setPage(1)
  }, [sortedFactures.length, page, pageSize])

  // Sync preview modal if the invoice is updated in the list
  useEffect(() => {
    if (previewFacture) {
      const updated = sortedFactures.find(f => f.id === previewFacture.id)
      if (updated) {
        setPreviewFacture(updated)
      } else {
        // If it's no longer in the list (e.g. cancelled), close the modal
        setPreviewFacture(null)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedFactures, previewFacture?.id])

  if (loading && sortedFactures.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="size-8 animate-spin text-slate-400" />
      </div>
    )
  }

  const totalPages = Math.ceil(sortedFactures.length / pageSize)
  const pagedFactures = sortedFactures.slice((page - 1) * pageSize, page * pageSize)

  if (sortedFactures.length === 0) {
    return (
      <div className="text-center py-16 bg-white">
        <div className="text-5xl mb-4">📭</div>
        <h3 className="font-bold text-lg text-slate-800">{t('no_pending')}</h3>
        <p className="text-slate-500 text-sm mt-1">{t('no_pending_desc')}</p>
      </div>
    )
  }

  // Helper to get product display name
  const getProductName = (p: FactureProduitRow): string => {
    if (typeof p.produit === 'object' && p.produit !== null) {
      return p.produit.name || `#${p.produit.id}`
    }
    if (p.produit_name) return p.produit_name
    if (p.produit_nom) return p.produit_nom
    return t('table.product_placeholder', { id: p.produit })
  }

  // Get product summary text for table cell  
  const getProductsSummary = (facture: Facture): string => {
    if (!facture.produits || facture.produits.length === 0) return '-'
    const names = facture.produits.map(getProductName)
    if (names.length <= 2) return names.join(', ')
    return `${names[0]}, ${names[1]} +${names.length - 2}`
  }

  return (
    <>
      <div className="overflow-auto flex-1 min-h-0">
        <Table className="table-fixed">
          <TableHeader className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200">
            <TableRow className="hover:bg-slate-100">
              {onToggleSelect && (
                <TableHead className="w-12 px-3 py-2 text-center">
                  <Checkbox
                    checked={selectedIds ? selectedIds.size === pagedFactures.length && pagedFactures.length > 0 : false}
                    onCheckedChange={() => { if (onSelectAll) onSelectAll() }}
                    onClick={(e) => e.stopPropagation()}
                    className="border-amber-400 data-[state=checked]:bg-amber-500"
                  />
                </TableHead>
              )}
              <TableHead className="w-24 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('table.ticket')}</TableHead>
              <TableHead className="w-28 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('table.invoice')}</TableHead>
              <TableHead className="w-[25%] px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('table.client')}</TableHead>
              <TableHead className="hidden lg:table-cell w-28 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('table.date')}</TableHead>
              <TableHead className="hidden xl:table-cell w-16 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('table.products')}</TableHead>
              <TableHead className="hidden md:table-cell w-28 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('table.seller', 'Vendeur')}</TableHead>
              <TableHead className="w-28 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">{t('table.amount')}</TableHead>
              <TableHead className="w-24 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">{t('table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedFactures.map((facture, index) => {
              // Récupérer le coupon appliqué à CETTE facture spécifique
              const couponPourCetteFacture = couponsParFacture[facture.id]
              const montantAPayer = Math.round(
                (facture.part_client !== null
                  ? Number(facture.part_client)
                  : Number(facture.total_ttc))
                - (couponPourCetteFacture ? Number(couponPourCetteFacture.montant) : 0)
              )
              const hasTiersPayant = facture.part_client !== null && facture.part_client !== undefined && Number(facture.part_client) >= 0 && Number(facture.part_client) < Number(facture.total_ttc)
              const isSelected = index === selectedRowIndex
              
              const isChecked = selectedIds ? selectedIds.has(facture.id) : false

              return (
                <tr 
                  key={facture.id} 
                  ref={(el) => { if (isSelected) selectedRowRef.current = el }}
                  tabIndex={-1}
                  aria-selected={isSelected}
                  className={`cursor-pointer transition-all border-b border-slate-100 outline-none focus:ring-2 focus:ring-inset focus:ring-sky-200 ${
                    isChecked
                      ? 'bg-amber-50 border-l-4 border-amber-500'
                      : isSelected 
                        ? 'bg-sky-50 border-l-4 border-sky-500 font-medium' 
                        : 'hover:bg-slate-50'
                  }`}
                  onClick={() => onSelectRow(index)}
                  onDoubleClick={() => {
                    if (user?.can_cash_out || user?.is_superuser) {
                      onEncaisser(facture)
                    }
                  }}
                >
                  {onToggleSelect && (
                    <TableCell className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => { if (onToggleSelect) onToggleSelect(facture.id) }}
                        className="border-amber-400 data-[state=checked]:bg-amber-500"
                      />
                    </TableCell>
                  )}
                  <TableCell className="px-3 py-2">
                    <span className="inline-flex items-center justify-center min-w-[1.75rem] px-2 h-6 rounded-md bg-slate-800 text-white text-xs font-bold shadow-sm">
                      {facture.session_ticket_number || '?'}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <div className="font-bold text-sky-600">#{facture.numero_facture}</div>
                    {hasTiersPayant && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 mt-1 text-[10px]">{t('table.tiers_payant')}</Badge>
                    )}
                    {couponPourCetteFacture && (
                      <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 mt-1 text-[10px]">{t('table.coupon_applied')}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <div className="font-bold">{facture.client_name || t('table.passerby_client')}</div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs hidden lg:table-cell text-slate-600">
                    <div className="font-medium">{new Date(facture.date).toLocaleDateString(dateLocale, {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit'
                    })}</div>
                    <div className="text-slate-400">{new Date(facture.date).toLocaleTimeString(dateLocale, {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs max-w-xs hidden xl:table-cell">
                    <button
                      type="button"
                      className="text-sky-600 hover:text-sky-700 hover:underline text-left truncate block max-w-[150px] font-medium"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPreviewFacture(facture)
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      title={t('table.view_products')}
                    >
                      {getProductsSummary(facture)}
                    </button>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs hidden md:table-cell">
                    <div className="font-medium">{facture.created_by_name || '-'}</div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right font-mono font-bold text-lg text-slate-800">
                    {montantAPayer} {t('common:currency_symbol', 'F')}
                    {couponPourCetteFacture && (
                      <div className="text-xs font-normal text-emerald-600 line-through text-slate-500 flex items-center justify-end gap-1">
                        {hasTiersPayant ? Number(facture.part_client) : Number(facture.total_ttc)} {t('common:currency_symbol', 'F')}
                         <Button
                          variant="ghost"
                          size="icon"
                          className="size-4 text-red-500 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveCoupon(facture.id)
                          }}
                          onDoubleClick={(e) => e.stopPropagation()}
                          title={t('table.remove_coupon')}
                        >
                          <XCircle className="size-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center">
                    <div className="flex justify-center items-center gap-2">
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-300 h-8 w-8 p-0"
                          onClick={(e) => {
                             e.stopPropagation()
                             onModify(facture)
                          }}
                          onDoubleClick={(e) => e.stopPropagation()}
                          title={canModify ? t('table.modify') : t('table.not_authorized')}
                          disabled={!canModify}
                          aria-label={canModify ? t('table.modify') : t('table.not_authorized')}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:border-red-300 h-8 w-8 p-0"
                          onClick={(e) => {
                             e.stopPropagation()
                             onCancel(facture)
                          }}
                          onDoubleClick={(e) => e.stopPropagation()}
                          title={canCancel ? t('table.cancel') : t('table.not_authorized')}
                          disabled={!canCancel}
                          aria-label={canCancel ? t('table.cancel') : t('table.not_authorized')}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        {!couponPourCetteFacture && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-100 hover:border-fuchsia-300 h-8 w-8 p-0"
                            onClick={(e) => {
                               e.stopPropagation()
                               onApplyCoupon(facture)
                            }}
                            onDoubleClick={(e) => e.stopPropagation()}
                            title={t('table.apply_coupon')}
                            aria-label={t('table.apply_coupon')}
                          >
                            <Ticket className="size-4" />
                          </Button>
                        )}
                      </div>
                      <div className="h-5 w-px bg-slate-200" />
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-emerald-600 text-white hover:bg-emerald-700 gap-1 shadow-sm h-8 px-3"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEncaisser(facture)
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                        disabled={!canCashOut}
                        title={!canCashOut
                          ? (!hasActiveCashSession && !user?.is_superuser
                            ? t('table.open_cash_register_first', { defaultValue: 'Veuillez d\'abord ouvrir votre caisse' })
                            : t('table.not_authorized'))
                          : t('table.cash_in')}
                        aria-label={!canCashOut
                          ? (!hasActiveCashSession && !user?.is_superuser
                            ? t('table.open_cash_register_first', { defaultValue: 'Veuillez d\'abord ouvrir votre caisse' })
                            : t('table.not_authorized'))
                          : t('table.cash_in')}
                      >
                        <Banknote className="size-4" />
                        {t('table.cash_in')}
                      </Button>
                    </div>
                  </TableCell>
                </tr>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {sortedFactures.length > 0 && (
        <div className="shrink-0 bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="h-7 px-2 rounded-md border border-slate-200 bg-white text-xs text-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
              aria-label={t('rows_per_page')}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-slate-500">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sortedFactures.length)} {t('common.pagination.of', 'sur')} {sortedFactures.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="size-4" />
              {t('common.pagination.prev', 'Précédent')}
            </Button>
            <span className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-md">{page}/{totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              {t('common.pagination.next', 'Suivant')}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Products Preview Popup */}
      <Dialog open={!!previewFacture} onOpenChange={(open) => { if (!open) { setPreviewFacture(null); onPreviewClosed?.(); } }}>
        <DialogContent className="max-w-full sm:max-w-2xl p-0 gap-0 overflow-hidden" aria-labelledby="preview-title" aria-describedby="preview-desc">
          <DialogHeader className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-white to-sky-50">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-emerald-600">
                <Package className="size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle id="preview-title" className="text-lg font-bold text-slate-800 truncate">
                  {t('table.products_preview_title', { numero: previewFacture?.numero_facture })}
                </DialogTitle>
                <DialogDescription id="preview-desc" className="text-xs text-slate-500 truncate">
                  {t('table.seller', 'Vendeur')} : {previewFacture?.created_by_name || '?'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6">
            {previewFacture?.produits && previewFacture.produits.length > 0 ? (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('table.product')}</TableHead>
                      <TableHead className="w-32 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">{t('table.quantity')}</TableHead>
                      <TableHead className="w-28 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">{t('table.unit_price_short')}</TableHead>
                      <TableHead className="w-28 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">{t('table.total')}</TableHead>
                      <TableHead className="w-10 px-3 py-2 text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewFacture.produits.map((p: FactureProduitRow, _idx: number) => {
                      const name = getProductName(p)
                      const qty = p.quantity || p.quantite || 1
                      const price = Number(p.selling_price || p.prix_vente || 0)
                      const canModify = user?.is_superuser || user?.profile?.can_modify_invoice || user?.can_modify_invoice

                      return (
                        <TableRow key={p.id ?? p.produit_id ?? p.produit ?? `row-${name}-${p.lot}`} className="group">
                          <TableCell className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800">{name}</span>
                              {p.lot && <span className="text-[10px] text-slate-400">Lot: {p.lot}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {canModify ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-red-600 hover:bg-red-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (qty > 1) {
                                        onUpdateProductQuantity(previewFacture.id, p.produit as number, qty - 1);
                                      } else if (window.confirm(t('confirm_delete_product', { name }))) {
                                        onRemoveProduct(previewFacture.id, p.produit as number);
                                      }
                                    }}
                                  >
                                    <Minus className="size-3.5" />
                                  </Button>
                                  <span className="font-bold min-w-[1.5rem] text-sm">{qty}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-emerald-600 hover:bg-emerald-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUpdateProductQuantity(previewFacture.id, p.produit as number, qty + 1);
                                    }}
                                  >
                                    <Plus className="size-3.5" />
                                  </Button>
                                </>
                              ) : (
                                <span className="font-bold min-w-[1.5rem] text-sm">{qty}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right font-mono text-sm text-slate-600">{Math.round(price)} {t('common:currency_symbol', 'F')}</TableCell>
                          <TableCell className="px-3 py-2 text-right font-mono font-bold text-sm text-slate-800">{Math.round(qty * price)} {t('common:currency_symbol', 'F')}</TableCell>
                          <TableCell className="px-3 py-2 text-right">
                            {canModify && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(t('confirm_delete_product', { name }))) {
                                    onRemoveProduct(previewFacture.id, p.produit as number);
                                  }
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
                  <span className="text-sm font-semibold text-slate-600">{t('table.total_ttc')}</span>
                  <span className="text-lg font-bold font-mono text-emerald-600">
                    {Math.round(Number(previewFacture.total_ttc))} {t('common:currency_symbol', 'F')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Package className="size-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium">{t('table.no_products')}</p>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-200 bg-slate-50">
            <Button variant="outline" onClick={() => setPreviewFacture(null)}>
              {t('table.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
