import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Facture, CouponMonnaie } from '../../types'
import PremiumModal from '../common/PremiumModal'

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
  user: any // Replace with proper User type if available
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
  user
}) => {
  const { t } = useTranslation('caisse')
  const [previewFacture, setPreviewFacture] = useState<Facture | null>(null)

  const canModify = user?.is_superuser || (user as any)?.can_modify_invoice || user?.profile?.can_modify_invoice
  const canCancel = user?.is_superuser || (user as any)?.can_cancel_invoice || user?.profile?.can_cancel_invoice
  const canCashOut = user?.is_superuser || (user as any)?.can_cash_out || user?.profile?.can_cash_out

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
  }, [sortedFactures, previewFacture?.id])

  if (loading && sortedFactures.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  if (sortedFactures.length === 0) {
    return (
      <div className="text-center py-16 bg-base-100">
        <div className="text-5xl mb-4">📭</div>
        <h3 className="font-bold text-lg text-base-content">{t('no_pending')}</h3>
        <p className="text-base-content/50 text-sm mt-1">{t('no_pending_desc')}</p>
      </div>
    )
  }

  // Helper to get product display name
  const getProductName = (p: any): string => {
    if (typeof p.produit === 'object' && p.produit !== null) {
      return p.produit.name || `#${p.produit.id}`
    }
    if (p.produit_name) return p.produit_name
    if (p.produit_nom) return p.produit_nom
    return `Produit #${p.produit}`
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
      <div className="overflow-x-auto">
        <table className="table table-sm w-full">
          <thead className="bg-base-200 opacity-100 sticky top-0 z-10">
            <tr className="text-xs uppercase tracking-wider text-base-content/60">
              <th>{t('table.ticket')}</th>
              <th>{t('table.invoice')}</th>
              <th>{t('table.client')}</th>
              <th className="hidden lg:table-cell">{t('table.date')}</th>
              <th className="hidden xl:table-cell">{t('table.products')}</th>
              <th className="text-right">{t('table.amount')}</th>
              <th className="text-center">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedFactures.map((facture, index) => {
              // Récupérer le coupon appliqué à CETTE facture spécifique
              const couponPourCetteFacture = couponsParFacture[facture.id]
              const montantAPayer = Math.round(
                (facture.part_client !== null
                  ? Number(facture.part_client)
                  : Number(facture.total_ttc))
                - (couponPourCetteFacture ? Number(couponPourCetteFacture.montant) : 0)
              )
              const hasTiersPayant = facture.part_client !== null && Number(facture.part_client) >= 0
              const isSelected = index === selectedRowIndex
              
              return (
                <tr 
                  key={facture.id} 
                  className={`cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-primary/10 border-l-4 border-primary font-medium' 
                      : 'hover:bg-base-100'
                  }`}
                  onClick={() => onSelectRow(index)}
                  onDoubleClick={() => {
                    if ((user as any)?.can_cash_out || user?.is_superuser) {
                      onEncaisser(facture)
                    }
                  }}
                >
                  <td>
                    <span className="badge badge-neutral font-bold">
                      {facture.session_ticket_number || '?'}
                    </span>
                  </td>
                  <td>
                    <div className="font-bold text-primary">#{facture.numero_facture}</div>
                    {hasTiersPayant && (
                      <div className="badge badge-xs badge-info mt-1">{t('table.tiers_payant')}</div>
                    )}
                    {couponPourCetteFacture && (
                      <div className="badge badge-xs badge-success mt-1">{t('table.coupon_applied')}</div>
                    )}
                  </td>
                  <td>
                    <div className="font-bold">{facture.client_name || 'Client de passage'}</div>
                  </td>
                  <td className="text-xs hidden lg:table-cell">
                    <div>{new Date(facture.date).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit'
                    })}</div>
                    <div className="text-base-content/50">{new Date(facture.date).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</div>
                  </td>
                  <td className="text-xs max-w-xs hidden xl:table-cell">
                    <button
                      type="button"
                      className="link link-primary text-left truncate block max-w-[150px]"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPreviewFacture(facture)
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      title="Voir les produits"
                    >
                      {getProductsSummary(facture)}
                    </button>
                  </td>
                  <td className="text-right font-mono font-bold text-lg">
                    {montantAPayer} F
                    {couponPourCetteFacture && (
                      <div className="text-xs font-normal text-success line-through opacity-70 flex items-center justify-end gap-1">
                        {hasTiersPayant ? Number(facture.part_client) : Number(facture.total_ttc)} F
                         <button 
                          onClick={(e) => { 
                            e.stopPropagation()
                            onRemoveCoupon(facture.id) 
                          }}
                          onDoubleClick={(e) => e.stopPropagation()}
                          className="btn btn-xs btn-circle btn-ghost text-error h-4 w-4 min-h-0"
                          title={t('table.remove_coupon')}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="text-center">
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={(e) => {
                           e.stopPropagation()
                           onModify(facture)
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="btn btn-xs btn-outline btn-warning"
                        title={canModify ? t('table.modify') : t('table.not_authorized')}
                        disabled={!canModify}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                           e.stopPropagation()
                           onCancel(facture)
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="btn btn-xs btn-outline btn-error"
                        title={canCancel ? t('table.cancel') : t('table.not_authorized')}
                        disabled={!canCancel}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      {!couponPourCetteFacture && (
                        <button
                          onClick={(e) => {
                             e.stopPropagation()
                             onApplyCoupon(facture)
                          }}
                          onDoubleClick={(e) => e.stopPropagation()}
                          className="btn btn-xs btn-outline btn-secondary"
                          title={t('table.apply_coupon')}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onEncaisser(facture)
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                        disabled={!canCashOut}
                        className="btn btn-xs btn-success text-white gap-1"
                        title={!canCashOut ? t('table.not_authorized') : t('table.cash_in')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {t('table.cash_in')}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Products Preview Popup */}
      <PremiumModal
        isOpen={!!previewFacture}
        onClose={() => setPreviewFacture(null)}
        title={`📦 Produits — #${previewFacture?.numero_facture}`}
        footer={
          <div className="flex justify-end w-full">
            <button className="btn btn-sm" onClick={() => setPreviewFacture(null)}>Fermer</button>
          </div>
        }
      >
        <div className="p-4">
          {previewFacture?.produits && previewFacture.produits.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table table-sm table-zebra w-full">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th className="text-center">Qté</th>
                    <th className="text-right">P.U</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {previewFacture.produits.map((p: any, idx: number) => {
                    const name = getProductName(p)
                    const qty = p.quantity || p.quantite || 1
                    const price = Number(p.selling_price || p.prix_vente || 0)
                    const canModify = user?.is_superuser || user?.profile?.can_modify_invoice || (user as any)?.can_modify_invoice
                    
                    return (
                      <tr key={idx} className="hover:bg-base-100">
                        <td className="font-medium">
                          <div className="flex flex-col">
                            <span>{name}</span>
                            {p.lot && <span className="text-[10px] opacity-60">Lot: {p.lot}</span>}
                          </div>
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {canModify ? (
                              <>
                                <button 
                                  className="btn btn-xs btn-circle btn-ghost text-error"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (qty > 1) {
                                      onUpdateProductQuantity(previewFacture.id, p.produit, qty - 1);
                                    } else if (window.confirm(t('confirm_delete_product', { name }))) {
                                      onRemoveProduct(previewFacture.id, p.produit);
                                    }
                                  }}
                                >
                                  -
                                </button>
                                <span className="font-bold min-w-[1.5rem]">{qty}</span>
                                <button 
                                  className="btn btn-xs btn-circle btn-ghost text-success"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdateProductQuantity(previewFacture.id, p.produit, qty + 1);
                                  }}
                                >
                                  +
                                </button>
                              </>
                            ) : (
                              <span className="font-bold min-w-[1.5rem]">{qty}</span>
                            )}
                          </div>
                        </td>
                        <td className="text-right font-mono">{Math.round(price)} F</td>
                        <td className="text-right font-mono font-bold">{Math.round(qty * price)} F</td>
                        <td className="text-right">
                          {canModify && (
                            <button 
                              className="btn btn-xs btn-ghost text-error btn-square"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(t('confirm_delete_product', { name }))) {
                                  onRemoveProduct(previewFacture.id, p.produit);
                                }
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="text-right font-bold">Total TTC</td>
                    <td className="text-right font-mono font-bold text-primary">
                      {Math.round(Number(previewFacture.total_ttc))} F
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-center text-base-content/50 py-4">Aucun produit</p>
          )}
        </div>
      </PremiumModal>
    </>
  )
}
