import React, { useState } from 'react';

import { useTranslation } from 'react-i18next';

import type { Commande, Fournisseur, ProduitModel } from '../../types';

import { formatCurrency, normalizeNumberInput } from '../../utils/formatters';

import { formatDate } from '../../utils/dateUtils';



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

  onImprimer: (fournisseurName: string) => void;

  onAnnulerReception: () => void;

  onCreateAvoir: () => void;

  onOpenLabelsModal: () => void;

  selectedRows: Set<number>;

  toggleRowSelection: (index: number) => void;

  setSelectedRows: (rows: Set<number>) => void;

  orderTotals?: {

      totalTVA: number;

      totalTTC: number;

      totalBuyHT: number;

      totalMarginValue: number;

      globalMargin: string;

      globalMarginPercent: string;

  };

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

  orderTotals,

}) => {

  const { t } = useTranslation(['orders', 'products', 'common']);

  const [searchDetailQuery, setSearchDetailQuery] = useState('');

  const [detailSortKey, setDetailSortKey] = useState<'name' | 'quantity' | 'price' | null>(null);

  const [detailSortOrder, setDetailSortOrder] = useState<'asc' | 'desc'>('asc');



  // Fonction pour obtenir la classe CSS du badge de ut

  function getStatusBadgeClass(us: string): string {

    switch (us) {

      case 'PREP': return 'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-info/10 text-info';

      case 'ATT': return 'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-warning/10 text-warning';

      case 'CLOT': return 'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-success/10 text-success';

      default: return 'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-base-200 text-base-content/60';

    }

  }



  return (

    <div className="flex-1 min-h-0 flex flex-col p-4 space-y-4">

      {/* Header */}

      <div className="flex items-center gap-4 shrink-0">

        <button onClick={onBack} className="p-2 text-base-content/50 hover:bg-base-200 rounded-lg transition-colors">

          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>

        </button>

        <h2 className="text-lg font-bold text-base-content">{t('orders:details.title', { id: selectedCommande.numero_facture || selectedCommande.id })}</h2>

        <div className="ml-auto flex flex-wrap gap-2">

          <button

            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border border-base-300 bg-base-100 text-base-content hover:bg-base-200 transition-colors"

            onClick={() => onEdit(selectedCommande)}

            disabled={selectedCommande.status === 'CLOT' || executingAction}

          >

            {t('orders:details.edit')}

          </button>

          <button

            className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg text-white transition-colors ${selectedCommande.status === 'ATT' ? 'bg-info hover:bg-info-focus' : 'bg-warning hover:bg-warning-focus'}`}

            onClick={onMettreEnAttente}

            disabled={selectedCommande.status === 'CLOT' || executingAction}

          >

            {executingAction ? <span className="inline-block size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (selectedCommande.status === 'ATT' ? t('orders:details.resume') : t('orders:details.suspend'))}

          </button>

          <button

            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg text-white bg-success hover:bg-success-focus transition-colors"

            onClick={onCloture}

            disabled={selectedCommande.status === 'CLOT' || executingAction}

          >

            {executingAction ? <span className="inline-block size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t('orders:details.close')}

          </button>

          <button

            onClick={onOpenLabelsModal}

            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary-focus disabled:opacity-40 transition-colors"

            disabled={selectedCommande.status !== 'CLOT' || executingAction}

            title={selectedCommande.status !== 'CLOT' ? t('orders:details.labels_clot_only', { defaultValue: 'Uniquement pour les commandes clôturées' }) : ''}

          >

            {t('orders:details.labels')}

          </button>



          <button

            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border border-red-200 text-error hover:bg-error/10 transition-colors"

            onClick={onDelete}

            disabled={executingAction}

          >

            {executingAction ? <span className="inline-block size-4 border-2 border-base-300 border-t-gray-600 rounded-full animate-spin" /> : t('orders:details.delete')}

          </button>

          <button

            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border border-base-300 bg-base-100 text-base-content hover:bg-base-200 disabled:opacity-40 transition-colors"

            onClick={() => {

              const fName = fournisseurs.find(f => f.id === selectedCommande.fournisseur)?.name ?? `ID: ${selectedCommande.fournisseur}`;

              onImprimer(fName);

            }}

            disabled={selectedCommande.status !== 'CLOT' || executingAction}

          >

            {executingAction ? <span className="inline-block size-4 border-2 border-base-300 border-t-gray-600 rounded-full animate-spin" /> : t('orders:details.print_receipt')}

          </button>

          {selectedCommande.status === 'CLOT' && (

            <button

              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border border-amber-200 text-warning hover:bg-warning/10 transition-colors gap-1"

              onClick={onAnnulerReception}

              disabled={executingAction}

              title={t('orders:details.cancel_reception')}

            >

              {executingAction ? <span className="inline-block size-4 border-2 border-base-300 border-t-gray-600 rounded-full animate-spin" /> : `↩️ ${t('orders:details.cancel_reception')}`}

            </button>

          )}

          {selectedCommande.status === 'CLOT' && (

            <button

              type="button"

              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border border-amber-200 text-warning hover:bg-warning/10 transition-colors gap-1"

              onClick={onCreateAvoir}

              title={t('orders:details.return')}

            >

              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />

              </svg>

              {selectedRows.size > 0 ? `${t('orders:details.return')} (${selectedRows.size})` : t('orders:details.return')}

            </button>

          )}

        </div>

      </div>



      {/* Grid Info */}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-base-100 p-4 rounded-lg border border-base-200 shadow-sm shrink-0">

        <div>

          <div className="text-[10px] font-semibold text-base-content/50 uppercase tracking-wider">{t('orders:details.id')}</div>

          <div className="text-sm font-semibold text-base-content">{selectedCommande.id}</div>

        </div>

        <div>

          <div className="text-[10px] font-semibold text-base-content/50 uppercase tracking-wider">{t('orders:details.invoice')}</div>

          <div className="text-sm font-semibold text-base-content">{selectedCommande.numero_facture || 'N/A'}</div>

        </div>

        <div>

          <div className="text-[10px] font-semibold text-base-content/50 uppercase tracking-wider">{t('orders:details.provider')}</div>

          <div className="text-sm font-semibold text-base-content">{fournisseurs.find(f => f.id === selectedCommande.fournisseur)?.name ?? `ID: ${selectedCommande.fournisseur}`}</div>

        </div>

        <div>

          <div className="text-[10px] font-semibold text-base-content/50 uppercase tracking-wider">{t('orders:details.date')}</div>

          <div className="text-sm font-semibold text-base-content">{formatDate(selectedCommande.date)}</div>

        </div>

        <div>

          <div className="text-[10px] font-semibold text-base-content/50 uppercase tracking-wider">{t('orders:details.status')}</div>

          <div><span className={getStatusBadgeClass(selectedCommande.status)}>

            {selectedCommande.status === 'PREP' ? t('orders:us.prep') :

             selectedCommande.status === 'ATT' ? t('orders:us.pending') :

             t('orders:us.closed')}

          </span></div>

        </div>

        {selectedCommande.status === 'CLOT' && selectedCommande.closed_by_name && (

          <div>

            <div className="text-[10px] font-semibold text-base-content/50 uppercase tracking-wider">{t('orders:details.closed_by')}</div>

            <div className="text-sm font-semibold text-base-content">{selectedCommande.closed_by_name}</div>

          </div>

        )}

      </div>



      {/* Barre de synthèse horizontale */}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 bg-base-100 p-4 rounded-lg border border-base-200 shadow-sm shrink-0 text-sm">



        {/* HT (Achat) */}

        <div className="flex flex-col">

          <span className="text-[10px] font-semibold text-base-content/50 uppercase leading-none mb-1">{t('orders:product_table.total_ht', 'HT (Achat)')}</span>

          <span className="font-mono font-semibold text-base-content text-base whitespace-nowrap">

              {formatCurrency(orderTotals?.totalBuyHT || 0)}

          </span>

        </div>



        {/* TVA */}

        <div className="flex flex-col border-l pl-5 border-base-300">

          <span className="text-[10px] font-semibold text-base-content/50 uppercase leading-none mb-1">{t('orders:product_table.total_tva', 'TVA (Vente)')}</span>

          <span className="font-mono font-semibold text-base-content/60 whitespace-nowrap">

              {formatCurrency(orderTotals?.totalTVA || 0)}

          </span>

        </div>



        {/* TTC (Vente) */}

        <div className="flex flex-col border-l pl-5 border-base-300">

          <span className="text-[10px] font-semibold text-primary uppercase leading-none mb-1">{t('orders:product_table.total_ttc', 'TTC (Vente)')}</span>

          <span className="font-mono font-bold text-lg text-primary">

              {formatCurrency(orderTotals?.totalTTC || 0)}

          </span>

        </div>



        {/* Montant Marge */}

        <div className="flex flex-col border-l pl-4 border-base-300">

          <span className="text-[10px] font-semibold text-base-content/50 uppercase leading-none mb-1">💰 {t('orders:product_table.info_row.margin_value', 'Montant Marge')}</span>

          <span className={`font-mono font-semibold ${Number(orderTotals?.globalMargin || 0) >= 1.34 ? 'text-success' : 'text-warning'}`}>

              {formatCurrency(orderTotals?.totalMarginValue || 0)}

          </span>

        </div>



        {/* Ratio / % Marge */}

        <div className="flex flex-col border-l pl-4 border-base-300">

          <span className="text-[10px] font-semibold text-base-content/50 uppercase leading-none mb-1">📦 {t('orders:product_table.headers.margin', 'Coefficient / %')}</span>

          <div className={`flex items-baseline gap-1 font-mono font-bold ${Number(orderTotals?.globalMargin || 0) >= 1.34 ? 'text-success' : 'text-warning'}`}>

              <span className="text-lg">x{orderTotals?.globalMargin || '1.0000'}</span>

              <span className="text-[10px]">({orderTotals?.globalMarginPercent || '0'}%)</span>

          </div>

        </div>



      </div>



      {/* Récapitulatif UG */}

      {(() => {

        const totalUG = (selectedCommande.produits || []).reduce((sum, p) => sum + normalizeNumberInput(p.unites_gratuites || 0), 0);

        if (totalUG > 0) {

          return (

            <div className="p-4 bg-success/10 border border-emerald-100 rounded-lg shrink-0">

              <div className="flex items-center gap-3">

                <div className="size-10 rounded-full bg-success/20 flex items-center justify-center">

                  <span className="text-success font-bold text-sm">UG</span>

                </div>

                <div className="flex-1">

                  <h4 className="font-semibold text-success text-sm">{t('orders:details.ug_title')}</h4>

                  <p className="text-xs text-base-content/70">

                    {t('orders:details.ug_message', { count: totalUG })}

                  </p>

                </div>

              </div>

            </div>

          );

        }

        return null;

      })()}



      {/* Liste des produits (Read Only) */}

      <div className="bg-base-100 rounded-lg border border-base-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">

        <div className="p-3 border-b border-base-200 flex justify-between items-center gap-4 bg-base-200 shrink-0">

          <h3 className="font-semibold text-sm text-base-content">{t('orders:details.products_list', 'Produits de la commande')}</h3>

          {selectedCommande.produits && selectedCommande.produits.length > 0 && (

            <div className="relative">

              <input

                type="text"

                placeholder={t('orders:product_table.search_placeholder', 'Rechercher un produit...')}

                className="input-ref input-sm input-bordered w-full sm:w-64 pl-8 h-9 rounded-lg bg-base-100 border-base-300 focus:border-primary"

                value={searchDetailQuery}

                onChange={(e) => setSearchDetailQuery(e.target.value)}

              />

              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">

                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />

              </svg>

              {searchDetailQuery && (

                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content/70" onClick={() => setSearchDetailQuery('')}>✕</button>

              )}

            </div>

          )}

        </div>



        <div className="overflow-auto flex-1 bg-base-100">

          {(!selectedCommande.produits || selectedCommande.produits.length === 0) ? (

            <p className="text-base-content/60 text-center py-8 text-sm">{t('orders:details.empty_products')}</p>

          ) : (

            <table className="min-w-full divide-y divide-base-200">

              <thead className="bg-base-200">

                <tr>

                  <th className="w-10 px-3 py-2">

                    <input

                      type="checkbox"

                      className="checkbox checkbox-xs border-base-300"

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

                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-base-content/60 uppercase cursor-pointer" onClick={() => { if (detailSortKey === 'name') { setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc'); } else { setDetailSortKey('name'); setDetailSortOrder('asc'); } }}>

                    {t('orders:product_table.headers.product')} {detailSortKey === 'name' && (detailSortOrder === 'asc' ? '↑' : '↓')}

                  </th>

                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-base-content/60 uppercase">{t('orders:product_table.headers.cip')}</th>

                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-base-content/60 uppercase">{t('products:table.stock')}</th>

                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-base-content/60 uppercase">{t('orders:product_table.headers.rotation', 'Rot.')}</th>

                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-base-content/60 uppercase cursor-pointer" onClick={() => { if (detailSortKey === 'quantity') { setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc'); } else { setDetailSortKey('quantity'); setDetailSortOrder('desc'); } }}>

                    {t('orders:product_table.headers.qty')} {detailSortKey === 'quantity' && (detailSortOrder === 'asc' ? '↑' : '↓')}

                  </th>

                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-base-content/60 uppercase bg-success/10/30">{t('orders:product_table.headers.ug')}</th>

                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-base-content/60 uppercase cursor-pointer" onClick={() => { if (detailSortKey === 'price') { setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc'); } else { setDetailSortKey('price'); setDetailSortOrder('desc'); } }}>

                    {t('orders:details.price_unit')} {detailSortKey === 'price' && (detailSortOrder === 'asc' ? '↑' : '↓')}

                  </th>

                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-base-content/60 uppercase">{t('orders:product_table.headers.lot')}</th>

                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-base-content/60 uppercase">{t('orders:product_table.headers.exp_date')}</th>

                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-base-content/60 uppercase">{t('orders:product_table.total_ht')}</th>

                </tr>

              </thead>

              <tbody className="bg-base-100 divide-y divide-base-200">

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

                      <tr key={p.id} className="hover:bg-base-200 transition-colors" onClick={() => toggleRowSelection(p.originalIndex)}>

                        <td className="px-3 py-2">

                          <input

                            type="checkbox"

                            className="checkbox checkbox-xs border-base-300"

                            checked={selectedRows.has(p.originalIndex)}

                            onChange={() => toggleRowSelection(p.originalIndex)}

                            onClick={(e) => e.stopPropagation()}

                          />

                        </td>

                        <td className={`px-3 py-2 text-sm font-medium ${isDeleted ? 'italic text-base-content/50' : 'text-base-content'}`}>

                          {p.produitName}

                          {isDeleted && <span className="text-xs ml-2 text-base-content/50">({t('products:us.deleted', 'Supprimé')})</span>}

                        </td>

                        <td className="px-3 py-2 font-mono text-xs text-base-content/60">{p.cip}</td>

                        <td className="px-3 py-2 text-center">

                          <span className={`font-mono text-sm ${stockNum === 0 ? 'text-error font-semibold' : stockNum < 0 ? 'text-error' : 'text-success'}`}>{stock}</span>

                        </td>

                        <td className="px-3 py-2 text-center font-mono text-sm text-base-content/50">{rotationDisplay}</td>

                        <td className="px-3 py-2 text-right font-semibold text-base-content">{p.quantity}</td>

                        <td className="px-3 py-2 text-center bg-success/10/30">

                          <span className={`font-semibold text-sm ${(p.unites_gratuites || 0) > 0 ? 'text-success' : 'text-base-content/40'}`}>{p.unites_gratuites || 0}</span>

                        </td>

                        <td className="px-3 py-2 text-right font-mono text-sm text-base-content/70">{formatCurrency(normalizeNumberInput(p.price))}</td>

                        <td className="px-3 py-2 text-xs font-mono text-base-content/60">{p.lot || '-'}</td>

                        <td className="px-3 py-2 text-xs text-base-content/50">{p.date_expiration ? (() => { const d = new Date(p.date_expiration); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`; })() : ''}</td>

                        <td className="px-3 py-2 text-right font-semibold text-primary">{formatCurrency(normalizeNumberInput(p.quantity) * normalizeNumberInput(p.price))}</td>

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

