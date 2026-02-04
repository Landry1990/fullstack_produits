import React from 'react'
import type { Facture, CouponMonnaie } from '../../types'

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
  couponsParFacture,
  user
}) => {
  if (loading && sortedFactures.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  if (sortedFactures.length === 0) {
    return (
      <div className="text-center py-10 bg-base-100 rounded-lg shadow">
        <div className="text-4xl mb-4">📭</div>
        <h3 className="font-bold text-lg">Aucune facture en attente</h3>
        <p className="text-base-content/60">Les nouvelles factures apparaîtront ici automatiquement.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-sm w-full">
        <thead className="bg-base-200 sticky top-0 z-10">
          <tr>
            <th>#Ticket</th>
            <th>Facture</th>
            <th>Client</th>
            <th>Date</th>
            <th>Produits</th>
            <th className="text-right">Montant</th>
            <th className="text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedFactures.map((facture, index) => {
            // Récupérer le coupon appliqué à CETTE facture spécifique
            const couponPourCetteFacture = couponsParFacture[facture.id]
            const montantAPayer = Math.round(
              Math.max(0,
                ((facture.part_client !== null && Number(facture.part_client) >= 0)
                  ? Number(facture.part_client)
                  : Number(facture.total_ttc))
                - (couponPourCetteFacture ? Number(couponPourCetteFacture.montant) : 0)
              )
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
                    <div className="badge badge-xs badge-info mt-1">Tiers Payant</div>
                  )}
                  {couponPourCetteFacture && (
                    <div className="badge badge-xs badge-success mt-1">Coupon appliqué</div>
                  )}
                </td>
                <td>
                  <div className="font-bold">{facture.client_name || 'Client de passage'}</div>
                </td>
                <td className="text-xs">
                  {new Date(facture.date).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </td>
                <td className="text-xs max-w-xs truncate">
                  {facture.produits?.map(p => typeof p.produit === 'object' ? p.produit.name : `Produit #${p.produit}`).join(', ')}
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
                        className="btn btn-xs btn-circle btn-ghost text-error h-4 w-4 min-h-0"
                        title="Retirer le coupon"
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
                      className="btn btn-xs btn-outline btn-warning"
                      title="Modifier"
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
                      className="btn btn-xs btn-outline btn-error"
                      title="Annuler"
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
                        className="btn btn-xs btn-outline btn-secondary"
                        title="Appliquer un coupon"
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
                      disabled={!(user as any)?.can_cash_out && !(user?.is_superuser)}
                      className="btn btn-xs btn-success text-white gap-1"
                      title={!(user as any)?.can_cash_out && !(user?.is_superuser) ? "Non autorisé" : "Encaisser"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Encaisser
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
