import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Commande, Fournisseur, ProduitModel } from '../../types';
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters';

interface CommandeDetailsProps {
  commande: Commande;
  fournisseurs: Fournisseur[];
  produitsList: ProduitModel[];
  executingAction: boolean;
  onBack: () => void;
  onEdit: (commande: Commande) => void;
  onMettreEnAttente: () => void;
  onCloture: () => void;
  onDelete: () => void;
  onImprimer: () => void;
  onAnnulerReception: () => void;
  onCreateAvoir: () => void;
  onOpenLabelsModal: () => void;
  selectedRows: Set<number>;
  toggleRowSelection: (index: number) => void;
  setSelectedRows: (rows: Set<number>) => void;
}

const CommandeDetails: React.FC<CommandeDetailsProps> = ({
  commande: selectedCommande,
  fournisseurs,
  produitsList,
  executingAction,
  onBack,
  onEdit,
  onMettreEnAttente,
  onCloture,
  onDelete,
  onImprimer,
  onAnnulerReception,
  onCreateAvoir,
  onOpenLabelsModal,
  selectedRows,
  toggleRowSelection,
  setSelectedRows,
}) => {
  const { t } = useTranslation();
  const [searchDetailQuery, setSearchDetailQuery] = useState('');
  const [detailSortKey, setDetailSortKey] = useState<'name' | 'quantity' | 'price' | null>(null);
  const [detailSortOrder, setDetailSortOrder] = useState<'asc' | 'desc'>('asc');

  // Fonction pour obtenir la classe CSS du badge de statut
  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PREP': return 'badge badge-info';
      case 'ATT': return 'badge badge-warning';
      case 'CLOT': return 'badge badge-success';
      default: return 'badge badge-ghost';
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0">
        <button onClick={onBack} className="btn btn-circle btn-sm btn-ghost">←</button>
        <h2 className="text-lg md:text-xl font-bold">Commande #{selectedCommande.numero_facture || selectedCommande.id}</h2>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onEdit(selectedCommande)}
            disabled={selectedCommande.status === 'CLOT' || executingAction}
          >
            {t('orders.details.edit')}
          </button>
          <button
            className={`btn btn-sm ${selectedCommande.status === 'ATT' ? 'btn-info' : 'btn-warning'}`}
            onClick={onMettreEnAttente}
            disabled={selectedCommande.status === 'CLOT' || executingAction}
          >
            {executingAction ? <span className="loading loading-spinner loading-xs"></span> : (selectedCommande.status === 'ATT' ? t('orders.details.resume') : t('orders.details.suspend'))}
          </button>
          <button
            className="btn btn-success btn-sm text-white"
            onClick={onCloture}
            disabled={selectedCommande.status === 'CLOT' || executingAction}
          >
            {executingAction ? <span className="loading loading-spinner loading-xs"></span> : t('orders.details.close')}
          </button>
          <button
            onClick={onOpenLabelsModal}
            className="btn btn-primary btn-sm"
            disabled={executingAction}
          >
            {t('orders.details.labels')}
          </button>

          <button
            className="btn btn-error btn-outline btn-sm"
            onClick={onDelete}
            disabled={executingAction}
          >
            {executingAction ? <span className="loading loading-spinner loading-xs"></span> : t('orders.details.delete')}
          </button>
          <button
            className="btn btn-primary btn-outline btn-sm"
            onClick={onImprimer}
            disabled={selectedCommande.status !== 'CLOT' || executingAction}
          >
            {executingAction ? <span className="loading loading-spinner loading-xs"></span> : t('orders.details.print_receipt')}
          </button>
          {selectedCommande.status === 'CLOT' && (
            <button
              className="btn btn-warning btn-outline btn-sm gap-1"
              onClick={onAnnulerReception}
              disabled={executingAction}
              title={t('orders.details.cancel_reception')}
            >
              {executingAction ? <span className="loading loading-spinner loading-xs"></span> : `↩️ ${t('orders.details.cancel_reception')}`}
            </button>
          )}
          {selectedCommande.status === 'CLOT' && (
            <button
              type="button"
              className="btn btn-warning btn-sm btn-outline gap-1"
              onClick={onCreateAvoir}
              title={t('orders.details.return')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              {selectedRows.size > 0 ? `${t('orders.details.return')} (${selectedRows.size})` : t('orders.details.return')}
            </button>
          )}
        </div>
      </div>

      {/* Grid Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded-lg shadow-sm shrink-0">
        <div>
          <div className="text-xs text-gray-500 uppercase">{t('orders.details.id')}</div>
          <div className="font-bold">{selectedCommande.id}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">{t('orders.details.invoice')}</div>
          <div className="font-bold">{selectedCommande.numero_facture || 'N/A'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">{t('orders.details.provider')}</div>
          <div className="font-bold">{fournisseurs.find(f => f.id === selectedCommande.fournisseur)?.name ?? `ID: ${selectedCommande.fournisseur}`}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">{t('orders.details.date')}</div>
          <div className="font-bold">{new Date(selectedCommande.date).toLocaleDateString('fr-FR')}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">{t('orders.details.status')}</div>
          <div><span className={getStatusBadgeClass(selectedCommande.status)}>{selectedCommande.status_display}</span></div>
        </div>
        {selectedCommande.status === 'CLOT' && selectedCommande.closed_by_name && (
          <div>
            <div className="text-xs text-gray-500 uppercase">{t('orders.details.closed_by')}</div>
            <div className="font-bold">{selectedCommande.closed_by_name}</div>
          </div>
        )}
        <div className="col-span-2 md:col-span-1 border-l pl-4 border-base-200">
          <div className="text-xs text-gray-500 uppercase mb-1">{t('orders.details.financial_summary')}</div>
          {(() => {
            const stats = (selectedCommande.produits || []).reduce((acc, p) => {
              const qty = normalizeNumberInput(p.quantity || 0);
              const price = normalizeNumberInput(p.price || 0);
              const tvaRate = normalizeNumberInput(p.tva || 0);
              const lineHT = qty * price;
              const lineTVA = lineHT * (tvaRate / 100);
              return { ht: acc.ht + lineHT, tva: acc.tva + lineTVA };
            }, { ht: 0, tva: 0 });
            const totalTTC = stats.ht + stats.tva;
            return (
              <div className="flex flex-col gap-0.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-base-content/60">HT:</span>
                  <span className="font-semibold">{formatCurrency(stats.ht)} F</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">TVA:</span>
                  <span className="font-semibold">{formatCurrency(stats.tva)} F</span>
                </div>
                <div className="flex justify-between border-t border-base-200 pt-0.5 mt-0.5">
                  <span className="font-bold text-primary">TTC:</span>
                  <span className="font-bold text-primary text-sm">{formatCurrency(totalTTC)} F</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Récapitulatif UG */}
      {(() => {
        const totalUG = (selectedCommande.produits || []).reduce((sum, p) => sum + normalizeNumberInput(p.unites_gratuites || 0), 0);
        if (totalUG > 0) {
          return (
            <div className="p-4 bg-success/10 border border-success/20 rounded-lg mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                  <span className="text-success font-bold">UG</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-success text-sm">{t('orders.details.ug_title')}</h4>
                  <p className="text-xs text-base-content/70">
                    {t('orders.details.ug_message', { count: totalUG })}
                  </p>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Liste des produits (Read Only) */}
      <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="p-3 border-b border-base-200 flex justify-between items-center gap-4 bg-base-50 shrink-0">
          <h3 className="font-bold text-sm text-base-content/80">{t('orders.details.products_list', 'Produits de la commande')}</h3>
          {selectedCommande.produits && selectedCommande.produits.length > 0 && (
            <div className="relative">
              <input
                type="text"
                placeholder={t('orders.product_table.search_placeholder', 'Rechercher un produit...')}
                className="input input-sm input-bordered w-full sm:w-64 pl-8"
                value={searchDetailQuery}
                onChange={(e) => setSearchDetailQuery(e.target.value)}
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-2.5 top-2.5 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchDetailQuery && (
                <button className="btn btn-ghost btn-xs btn-circle absolute right-1 top-1.5" onClick={() => setSearchDetailQuery('')}>✕</button>
              )}
            </div>
          )}
        </div>

        <div className="overflow-auto flex-1 bg-base-100">
          {(!selectedCommande.produits || selectedCommande.produits.length === 0) ? (
            <p className="text-base-content/70 text-center py-8 text-sm">{t('orders.details.empty_products')}</p>
          ) : (
            <table className="table table-zebra table-pin-rows w-full">
              <thead className="bg-base-200">
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
                      checked={selectedRows.size === selectedCommande.produits.length && selectedCommande.produits.length > 0}
                      onChange={() => {
                        if (selectedRows.size === selectedCommande.produits.length) {
                          setSelectedRows(new Set());
                        } else {
                          setSelectedRows(new Set(selectedCommande.produits.map((_, i) => i)));
                        }
                      }}
                    />
                  </th>
                  <th className="cursor-pointer" onClick={() => { if (detailSortKey === 'name') { setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc'); } else { setDetailSortKey('name'); setDetailSortOrder('asc'); } }}>
                    {t('orders.product_table.headers.product')} {detailSortKey === 'name' && (detailSortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>{t('orders.product_table.headers.cip')}</th>
                  <th className="text-center">{t('products.table.stock')}</th>
                  <th className="text-center">Rot.</th>
                  <th className="text-right cursor-pointer" onClick={() => { if (detailSortKey === 'quantity') { setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc'); } else { setDetailSortKey('quantity'); setDetailSortOrder('desc'); } }}>
                    {t('orders.product_table.headers.qty')} {detailSortKey === 'quantity' && (detailSortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="text-center bg-success/5">{t('orders.product_table.headers.ug')}</th>
                  <th className="text-right cursor-pointer" onClick={() => { if (detailSortKey === 'price') { setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc'); } else { setDetailSortKey('price'); setDetailSortOrder('desc'); } }}>
                    {t('orders.details.price_unit')} {detailSortKey === 'price' && (detailSortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>{t('orders.product_table.headers.lot')}</th>
                  <th>{t('orders.product_table.headers.exp_date')}</th>
                  <th className="text-right">{t('orders.product_table.total_ht')}</th>
                </tr>
              </thead>
              <tbody>
                {[...(selectedCommande.produits || [])]
                  .map((p, originalIndex) => {
                    const produitData = (typeof p.produit === 'object') ? p.produit : produitsList.find(prod => prod.id === p.produit);
                    const produitName = (p as any).produit_nom || (produitData?.name || `Produit #${p.produit}`);
                    const cip = (p as any).produit_cip || produitData?.cip1 || '-';
                    return { ...p, produitName, cip, originalIndex };
                  })
                  .filter(p => {
                    if (!searchDetailQuery) return true;
                    const q = searchDetailQuery.toLowerCase();
                    return p.produitName.toLowerCase().includes(q) || p.cip.toLowerCase().includes(q);
                  })
                  .sort((a, b) => {
                    let comparison = 0;
                    if (detailSortKey === 'name') comparison = a.produitName.localeCompare(b.produitName);
                    else if (detailSortKey === 'quantity') comparison = normalizeNumberInput(a.quantity) - normalizeNumberInput(b.quantity);
                    else if (detailSortKey === 'price') comparison = normalizeNumberInput(a.price) - normalizeNumberInput(b.price);
                    return detailSortOrder === 'asc' ? comparison : -comparison;
                  })
                  .map((p) => {
                    const produitData = (typeof p.produit === 'object') ? p.produit : produitsList.find(prod => prod.id === p.produit);
                    const stock = produitData?.stock ?? ((p as any).produit_stock ?? '-');
                    const stockNum = typeof stock === 'number' ? stock : 0;
                    const rotation = produitData?.rotation_moyenne ?? (p as any).produit_rotation_moyenne;
                    const rotationDisplay = rotation ? normalizeNumberInput(String(rotation)).toFixed(1) : '-';
                    const isDeleted = p.produit === null;
                    return (
                      <tr key={p.id} className="hover" onClick={() => toggleRowSelection(p.originalIndex)}>
                        <td>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs"
                            checked={selectedRows.has(p.originalIndex)}
                            onChange={() => toggleRowSelection(p.originalIndex)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className={`font-bold ${isDeleted ? 'italic' : ''}`}>
                          {p.produitName}
                          {isDeleted && <span className="text-xs ml-2 opacity-75">(Supprimé)</span>}
                        </td>
                        <td className="font-mono text-xs">{p.cip}</td>
                        <td className="text-center">
                          <span className={`font-mono ${stockNum === 0 ? 'text-error font-bold' : stockNum < 0 ? 'text-error' : 'text-success'}`}>{stock}</span>
                        </td>
                        <td className="text-center font-mono opacity-70">{rotationDisplay}</td>
                        <td className="text-right font-bold">{p.quantity}</td>
                        <td className="text-center bg-success/5">
                          <span className={`font-bold ${(p.unites_gratuites || 0) > 0 ? 'text-success' : 'text-base-content/20'}`}>{p.unites_gratuites || 0}</span>
                        </td>
                        <td className="text-right font-mono">{formatCurrency(normalizeNumberInput(p.price))} F</td>
                        <td className="text-xs font-mono">{p.lot || '-'}</td>
                        <td className="text-xs text-gray-400">{p.date_expiration ? (() => { const d = new Date(p.date_expiration); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`; })() : ''}</td>
                        <td className="text-right font-bold text-primary">{formatCurrency(normalizeNumberInput(p.quantity) * normalizeNumberInput(p.price))} F</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandeDetails;
