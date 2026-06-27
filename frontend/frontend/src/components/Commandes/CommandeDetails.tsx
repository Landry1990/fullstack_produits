import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Pencil, Pause, Play, Check, Printer, Trash2, Tag, RotateCcw, Package } from 'lucide-react';
import type { Commande, Fournisseur, ProduitModel } from '../../types';
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters';
import { formatDate } from '../../utils/dateUtils';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { cn } from '../../lib/utils';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';



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

      totalBuyTTC: number;

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

  const queryClient = useQueryClient();
  const [editingLotId, setEditingLotId] = useState<number | null>(null);
  const [editLotValues, setEditLotValues] = useState<{ lot: string; date_expiration: string; produitId?: number }>({ lot: '', date_expiration: '' });
  const [savingLot, setSavingLot] = useState(false);
  const [localProduits, setLocalProduits] = useState<typeof selectedCommande.produits>(selectedCommande.produits);

  const startLotEdit = useCallback((p: any) => {
    setEditingLotId(p.id);
    const produitId = typeof p.produit === 'object' ? p.produit?.id : p.produit;
    setEditLotValues({
      lot: p.lot || '',
      date_expiration: p.date_expiration ? String(p.date_expiration).slice(0, 10) : '',
      produitId,
    });
  }, []);

  const cancelLotEdit = useCallback(() => setEditingLotId(null), []);

  const saveLotEdit = useCallback(async (lineId: number) => {
    setSavingLot(true);
    try {
      const payload: Record<string, string | null> = { lot: editLotValues.lot };
      payload.date_expiration = editLotValues.date_expiration || null;
      await api.patch(`commande-produits/${lineId}/correct_lot/`, payload);
      setLocalProduits(prev => (prev || []).map(p =>
        p.id === lineId ? { ...p, lot: editLotValues.lot, date_expiration: editLotValues.date_expiration || undefined } : p
      ));
      setEditingLotId(null);
      if (editLotValues.produitId) {
        queryClient.invalidateQueries({ queryKey: ['produit-lots', editLotValues.produitId] });
      }
      toast.success('Lot / date mis à jour');
    } catch {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSavingLot(false);
    }
  }, [editLotValues, queryClient]);



  // Fonction pour obtenir la classe CSS du badge de status
  function getStatusBadgeClass(us: string): string {
    switch (us) {
      case 'PREP': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'ATT': return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'CLOT': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  }

  function getStatusLabel(us: string): string {
    switch (us) {
      case 'PREP': return t('orders:status.prep', 'Préparation');
      case 'ATT': return t('orders:status.att', 'En attente');
      case 'CLOT': return t('orders:status.clot', 'Clôturé');
      default: return us;
    }
  }



  return (

    <div className="flex-1 min-h-0 flex flex-col p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="size-9 text-slate-400 hover:text-slate-600">
          <ArrowLeft className="size-5" />
        </Button>

        <h2 className="text-lg font-bold text-slate-800">{t('orders:details.title', { id: selectedCommande.numero_facture || selectedCommande.id })}</h2>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => onEdit(selectedCommande)}
            disabled={selectedCommande.status === 'CLOT' || executingAction}
          >
            <Pencil className="size-4" /> {t('orders:details.edit')}
          </Button>

          <Button
            variant={selectedCommande.status === 'ATT' ? 'default' : 'outline'}
            size="sm"
            className={cn(
              "gap-1",
              selectedCommande.status === 'ATT' ? 'bg-blue-600 hover:bg-blue-700' : 'border-amber-300 text-amber-700 hover:bg-amber-50'
            )}
            onClick={onMettreEnAttente}
            disabled={selectedCommande.status === 'CLOT' || executingAction}
          >
            {executingAction ? <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (selectedCommande.status === 'ATT' ? <><Play className="size-4" /> {t('orders:details.resume')}</> : <><Pause className="size-4" /> {t('orders:details.suspend')}</>)}
          </Button>

          <Button
            size="sm"
            className="gap-1 bg-emerald-600 hover:bg-emerald-700"
            onClick={onCloture}
            disabled={selectedCommande.status === 'CLOT' || executingAction}
          >
            {executingAction ? <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check className="size-4" /> {t('orders:details.close')}</>}
          </Button>

          <Button
            size="sm"
            variant="default"
            className="gap-1 bg-violet-600 hover:bg-violet-700"
            onClick={onOpenLabelsModal}
            disabled={selectedCommande.status !== 'CLOT' || executingAction}
            title={selectedCommande.status !== 'CLOT' ? t('orders:details.labels_clot_only', { defaultValue: 'Uniquement pour les commandes clôturées' }) : ''}
          >
            <Tag className="size-4" /> {t('orders:details.labels')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1 border-red-200 text-red-600 hover:bg-red-50"
            onClick={onDelete}
            disabled={selectedCommande.status === 'CLOT' || executingAction}
          >
            {executingAction ? <span className="size-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> : <><Trash2 className="size-4" /> {t('orders:details.delete')}</>}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => {
              const fName = fournisseurs.find(f => f.id === selectedCommande.fournisseur)?.name ?? `ID: ${selectedCommande.fournisseur}`;
              onImprimer(fName);
            }}
            disabled={selectedCommande.status !== 'CLOT' || executingAction}
          >
            {executingAction ? <span className="size-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> : <><Printer className="size-4" /> {t('orders:details.print_receipt')}</>}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1 border-amber-200 text-amber-600 hover:bg-amber-50"
            onClick={onAnnulerReception}
            disabled={selectedCommande.status !== 'CLOT' || executingAction}
            title={selectedCommande.status !== 'CLOT' ? t('orders:details.labels_clot_only', { defaultValue: 'Uniquement pour les commandes clôturées' }) : t('orders:details.cancel_reception')}
          >
            {executingAction ? <span className="size-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> : <><RotateCcw className="size-4" /> {t('orders:details.cancel_reception')}</>}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 border-amber-200 text-amber-600 hover:bg-amber-50"
            onClick={onCreateAvoir}
            disabled={selectedCommande.status !== 'CLOT' || executingAction}
            title={selectedCommande.status !== 'CLOT' ? t('orders:details.labels_clot_only', { defaultValue: 'Uniquement pour les commandes clôturées' }) : t('orders:details.return')}
          >
            <RotateCcw className="size-4" />
            {selectedRows.size > 0 ? `${t('orders:details.return')} (${selectedRows.size})` : t('orders:details.return')}
          </Button>
        </div>
      </div>



      {/* Grid Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm shrink-0">
        <div>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{t('orders:details.id')}</div>
          <div className="text-sm font-semibold text-slate-800">{selectedCommande.id}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{t('orders:details.invoice')}</div>
          <div className="text-sm font-semibold text-slate-800">{selectedCommande.numero_facture || 'N/A'}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{t('orders:details.provider')}</div>
          <div className="text-sm font-semibold text-slate-800">{fournisseurs.find(f => f.id === selectedCommande.fournisseur)?.name ?? `ID: ${selectedCommande.fournisseur}`}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{t('orders:details.date')}</div>
          <div className="text-sm font-semibold text-slate-800">{formatDate(selectedCommande.date)}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{t('orders:details.status')}</div>
          <div>
            <Badge variant="outline" className={cn("text-[11px] font-semibold uppercase tracking-wider", getStatusBadgeClass(selectedCommande.status))}>
              {getStatusLabel(selectedCommande.status)}
            </Badge>
          </div>
        </div>
        {selectedCommande.status === 'CLOT' && selectedCommande.closed_by_name && (
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{t('orders:details.closed_by')}</div>
            <div className="text-sm font-semibold text-slate-800">{selectedCommande.closed_by_name}</div>
          </div>
        )}
      </div>



      {/* Barre de synthèse horizontale */}
      <div className="mt-2 flex flex-wrap justify-between items-end gap-4 shrink-0 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          {/* PRIX A HT */}
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase font-bold text-slate-400 -mb-1">PRIX A HT</span>
            <span className="text-sm font-bold text-slate-700">{formatCurrency(orderTotals?.totalBuyHT || 0)}</span>
          </div>
          {/* TVA A */}
          <div className="flex flex-col items-end border-l pl-3 border-slate-200">
            <span className="text-[9px] uppercase font-bold text-slate-400 -mb-1">TVA A</span>
            <span className="text-sm font-bold text-slate-500">{formatCurrency((orderTotals?.totalBuyTTC || 0) - (orderTotals?.totalBuyHT || 0))}</span>
          </div>
          {/* PRIX A TTC */}
          <div className="flex flex-col items-end border-l pl-3 border-slate-200">
            <span className="text-[9px] uppercase font-bold text-slate-400 -mb-1">PRIX A TTC</span>
            <span className="text-lg font-black leading-none text-slate-800">{formatCurrency(orderTotals?.totalBuyTTC || 0)}</span>
          </div>
          {/* PRIX V TTC */}
          <div className="flex flex-col items-end border-l pl-3 border-slate-200">
            <span className="text-[9px] uppercase font-bold text-emerald-600 -mb-1">PRIX V TTC</span>
            <span className={cn("text-lg font-black leading-none", Number(orderTotals?.globalMargin || 0) >= 1.34 ? 'text-emerald-600' : 'text-amber-600')}>{formatCurrency(orderTotals?.totalTTC || 0)}</span>
          </div>
          {/* MARGE */}
          <div className="flex flex-col items-end border-l pl-3 border-slate-200">
            <span className="text-[9px] uppercase font-bold text-slate-400 -mb-1">MARGE</span>
            <span className={cn("text-sm font-bold", Number(orderTotals?.globalMargin || 0) >= 1.34 ? 'text-emerald-600' : 'text-amber-600')}>{formatCurrency(orderTotals?.totalMarginValue || 0)}</span>
          </div>
          {/* COEFF */}
          <div className="flex flex-col items-end border-l pl-3 border-slate-200">
            <span className="text-[9px] uppercase font-bold text-slate-400 -mb-1">COEFF</span>
            <div className="flex items-baseline gap-1">
              <span className={cn("text-sm font-bold", Number(orderTotals?.globalMargin || 0) >= 1.34 ? 'text-emerald-600' : 'text-amber-600')}>x{orderTotals?.globalMargin || '1.00'}</span>
              <span className={cn("text-[10px] font-semibold", Number(orderTotals?.globalMargin || 0) >= 1.34 ? 'text-emerald-500' : 'text-amber-500')}>({orderTotals?.globalMarginPercent || '0.00'}%)</span>
            </div>
          </div>
        </div>
      </div>



      {/* Récapitulatif UG */}
      {(() => {
        const totalUG = (selectedCommande.produits || []).reduce((sum, p) => sum + normalizeNumberInput(p.unites_gratuites || 0), 0);
        if (totalUG > 0) {
          return (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <span className="text-emerald-700 font-bold text-sm">UG</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-emerald-700 text-sm">{t('orders:details.ug_title')}</h4>
                  <p className="text-xs text-slate-600">
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
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="p-3 border-b border-slate-200 flex justify-between items-center gap-4 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <Package className="size-4 text-slate-500" />
            <h3 className="font-semibold text-sm text-slate-700">{t('orders:details.products_list', 'Produits de la commande')}</h3>
            <Badge variant="secondary" className="text-xs">{selectedCommande.produits?.length || 0}</Badge>
          </div>
          {selectedCommande.produits && selectedCommande.produits.length > 0 && (
            <div className="relative">
              <input
                type="text"
                placeholder={t('orders:product_table.search_placeholder', 'Rechercher un produit...')}
                className="w-full sm:w-64 pl-8 h-9 rounded-lg bg-white border border-slate-200 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 text-sm px-3 outline-none transition-all"
                value={searchDetailQuery}
                onChange={(e) => setSearchDetailQuery(e.target.value)}
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchDetailQuery && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setSearchDetailQuery('')}>✕</button>
              )}
            </div>
          )}
        </div>

        <div className="overflow-auto flex-1 bg-white">
          {(!selectedCommande.produits || selectedCommande.produits.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Package className="size-12 mb-3 opacity-20" />
              <p className="text-sm">{t('orders:details.empty_products')}</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
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
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => { if (detailSortKey === 'name') { setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc'); } else { setDetailSortKey('name'); setDetailSortOrder('asc'); } }}>
                    {t('orders:product_table.headers.product')} {detailSortKey === 'name' && (detailSortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">{t('orders:product_table.headers.cip')}</th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase">{t('products:table.stock')}</th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase">{t('orders:product_table.headers.rotation', 'Rot.')}</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => { if (detailSortKey === 'quantity') { setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc'); } else { setDetailSortKey('quantity'); setDetailSortOrder('desc'); } }}>
                    {t('orders:product_table.headers.qty')} {detailSortKey === 'quantity' && (detailSortOrder === 'asc' ? '↑' : '↓')}

                  </th>

                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase bg-emerald-50">{t('orders:product_table.headers.ug')}</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => { if (detailSortKey === 'price') { setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc'); } else { setDetailSortKey('price'); setDetailSortOrder('desc'); } }}>
                    {t('orders:details.price_unit')} {detailSortKey === 'price' && (detailSortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">{t('orders:product_table.headers.lot')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">{t('orders:product_table.headers.exp_date')}</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase">{t('orders:product_table.total_ht')}</th>
                  {selectedCommande.status === 'CLOT' && <th className="w-8"></th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">

                {[...(localProduits || [])]

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
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100" onClick={() => toggleRowSelection(p.originalIndex)}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            checked={selectedRows.has(p.originalIndex)}
                            onChange={() => toggleRowSelection(p.originalIndex)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className={cn("px-3 py-2 text-sm font-medium", isDeleted ? 'italic text-slate-400' : 'text-slate-800')}>
                          {p.produitName}
                          {isDeleted && <span className="text-xs ml-2 text-slate-400">({t('products:us.deleted', 'Supprimé')})</span>}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{p.cip}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn("font-mono text-sm", stockNum === 0 ? 'text-red-500 font-semibold' : stockNum < 0 ? 'text-red-500' : 'text-emerald-600')}>{stock}</span>
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-sm text-slate-400">{rotationDisplay}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800">{p.quantity}</td>
                        <td className="px-3 py-2 text-center bg-emerald-50">
                          <span className={cn("font-semibold text-sm", (p.unites_gratuites || 0) > 0 ? 'text-emerald-600' : 'text-slate-400')}>{p.unites_gratuites || 0}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-sm text-slate-600">{formatCurrency(normalizeNumberInput(p.price))}</td>
                        <td className="px-3 py-2 text-xs font-mono text-slate-500" onClick={e => e.stopPropagation()}>
                          {editingLotId === p.id ? (
                            <input
                              type="text"
                              className="border border-slate-300 rounded px-1 py-0.5 text-xs w-24 font-mono"
                              value={editLotValues.lot}
                              onChange={e => setEditLotValues(v => ({ ...v, lot: e.target.value }))}
                              autoFocus
                            />
                          ) : p.lot || '-'}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-400" onClick={e => e.stopPropagation()}>
                          {editingLotId === p.id ? (
                            <input
                              type="date"
                              className="border border-slate-300 rounded px-1 py-0.5 text-xs w-32"
                              value={editLotValues.date_expiration}
                              onChange={e => setEditLotValues(v => ({ ...v, date_expiration: e.target.value }))}
                            />
                          ) : (p.date_expiration ? (() => { const d = new Date(p.date_expiration); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`; })() : '')}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-600">{formatCurrency(normalizeNumberInput(p.quantity) * normalizeNumberInput(p.price))}</td>
                        {selectedCommande.status === 'CLOT' && (
                          <td className="px-2 py-2 text-center" onClick={e => e.stopPropagation()}>
                            {editingLotId === p.id ? (
                              <div className="flex items-center gap-1">
                                <button className="text-emerald-600 hover:text-emerald-800 font-bold text-sm" onClick={() => saveLotEdit(p.id)} disabled={savingLot} title="Enregistrer">✓</button>
                                <button className="text-slate-400 hover:text-slate-600 text-sm" onClick={cancelLotEdit} disabled={savingLot} title="Annuler">✕</button>
                              </div>
                            ) : (
                              <button className="text-slate-300 hover:text-blue-500 transition-colors" onClick={() => startLotEdit(p)} title="Corriger lot / date péremption">✏️</button>
                            )}
                          </td>
                        )}
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

