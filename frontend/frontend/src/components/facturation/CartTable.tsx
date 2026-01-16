import React from 'react'
import type { LigneFacture, ProduitModel } from '../../types'

interface CartTableProps {
  lignesFacture: LigneFacture[]
  updateQuantite: (produitId: number, quantite: number) => void
  updatePrix: (produitId: number, prix: string) => void
  updateRemiseProduit: (produitId: number, remise: string) => void
  removeLigne: (produitId: number) => void
  onOpenLotModal: (product: ProduitModel, currentLotId: string | null) => void
  quantityInputsRef: React.MutableRefObject<Map<number, HTMLInputElement>>
  onReturnFocus: () => void
}

export default function CartTable({
  lignesFacture,
  updateQuantite,
  updatePrix,
  updateRemiseProduit,
  removeLigne,
  onOpenLotModal,
  quantityInputsRef,
  onReturnFocus
}: CartTableProps) {
  
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`
    } catch {
      return '-'
    }
  }

  if (lignesFacture.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-base-content/30 gap-4 min-h-[200px]">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p className="font-light">Commencez par ajouter des produits (F2)</p>
      </div>
    )
  }

  return (
    <table className="table table-pin-rows table-sm w-full">
      <thead>
        <tr className="bg-base-50 uppercase tracking-wider text-base-content/60 font-semibold border-b border-base-200">
          <th className="bg-base-50 pl-2 md:pl-4">Produit</th>
          <th className="bg-base-50 text-right w-16 md:w-20">Qté</th>
          <th className="bg-base-50 text-right w-20 md:w-24">Prix</th>
          <th className="bg-base-50 text-right w-14 md:w-16 hidden sm:table-cell">Remise</th>
          <th className="bg-base-50 text-center w-24 hidden md:table-cell">Péremption</th>
          <th className="bg-base-50 text-right w-20 md:w-28 pr-2 md:pr-4">Total</th>
          <th className="bg-base-50 w-8"></th>
        </tr>
      </thead>
      <tbody>
        {lignesFacture.map((ligne) => (
          <tr key={ligne.produit.id} className="hover:bg-base-50/50 group border-b border-base-100 last:border-0">
            <td className="pl-2 md:pl-4 py-1">
              <div className={`font-medium ${ligne.produit.is_deleted ? 'italic' : ''}`}>
                {ligne.produit.name}
                {ligne.produit.is_deleted && <span className="text-xs ml-2 opacity-75">(Supprimé)</span>}
              </div>
            </td>
            <td className="text-right py-1">
              <input
                ref={(el) => {
                  if (el) quantityInputsRef.current.set(ligne.produit.id, el)
                  else quantityInputsRef.current.delete(ligne.produit.id)
                }}
                type="text"
                value={ligne.quantite}
                onChange={(e) => updateQuantite(ligne.produit.id, parseInt(e.target.value) || 0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onReturnFocus()
                  }
                }}
                className="input input-ghost input-xs w-full text-right font-medium focus:bg-base-100 focus:text-primary"
              />
            </td>
            <td className="text-right py-1">
              <input
                type="text"
                value={ligne.prix_unitaire}
                onChange={(e) => updatePrix(ligne.produit.id, e.target.value)}
                className="input input-ghost input-xs w-full text-right focus:bg-base-100 focus:text-primary"
              />
            </td>
            <td className="text-right py-1 hidden sm:table-cell">
              <input
                type="text"
                value={ligne.remise_produit}
                onChange={(e) => updateRemiseProduit(ligne.produit.id, e.target.value)}
                className="input input-ghost input-xs w-full text-right focus:bg-base-100 focus:text-primary"
                placeholder="%"
              />
            </td>
            <td className="text-center py-1 hidden md:table-cell">
              <div className="text-xs text-base-content/60">
                {ligne.lotId && ligne.lotExpiration 
                  ? formatDate(ligne.lotExpiration)
                  : formatDate(ligne.produit.expire_date)
                }
              </div>
            </td>
            <td className="text-center py-1">
              <button 
                className={`btn btn-xs ${ligne.lotId ? 'btn-primary' : 'btn-ghost text-base-content/50'} w-full max-w-[80px] truncate`}
                onClick={() => onOpenLotModal(ligne.produit, ligne.lotId || null)}
                title={ligne.lotId ? `Lot: ${ligne.lotText}` : "Lot: Automatique (FEFO)"}
              >
                {ligne.lotId ? ligne.lotText : 'Auto'}
              </button>
            </td>
            <td className="text-right font-medium text-base-content pr-2 md:pr-4 py-1">
              {Math.round(ligne.total_ligne)}
            </td>
            <td className="text-center py-1">
              <button
                onClick={() => removeLigne(ligne.produit.id)}
                className="btn btn-ghost btn-xs text-error/50 hover:text-error btn-square opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
