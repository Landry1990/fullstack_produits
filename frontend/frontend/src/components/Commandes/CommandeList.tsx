import { useTranslation } from 'react-i18next';
import { Eye, Trash2, Printer, GitMerge } from 'lucide-react';
import type { Commande, Fournisseur } from '../../types';
import { formatCurrency } from '../../utils/formatters';

import SelectionHeader from '../ui/SelectionHeader';

export type SortKey = 'numero' | 'date' | 'fournisseur' | 'status';

interface CommandeListProps {
  // Data
  sortedCommandes: Commande[];
  fournisseurs: Fournisseur[];
  loading: boolean;
  totalCount: number;
  
  // Pagination
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;

  // Sorting
  sortKey: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (key: SortKey) => void;

  // Filtering
  filterStatus: string;
  onFilterStatusChange: (status: string) => void;

  // Selection
  selectedOrderIds: Set<number>;
  onToggleOrderSelection: (orderId: number) => void;
  onToggleAllOrdersSelection: () => void;

  // Merge Actions
  canMerge: boolean;
  onOpenMergeModal: () => void;

  // Navigation / Actions
  onOpenCreateView: () => void;
  onOpenSuggestionModal: () => void;
  onViewDetails: (commande: Commande) => void;
  onBulkDelete: () => void;
}

export default function CommandeList({
  sortedCommandes,
  fournisseurs,
  loading,
  totalCount,
  page,
  totalPages,
  onPageChange,
  sortKey,
  sortOrder,
  onSortChange,
  filterStatus,
  onFilterStatusChange,
  selectedOrderIds,
  onToggleOrderSelection,
  onToggleAllOrdersSelection,
  canMerge,
  onOpenMergeModal,
  onOpenCreateView,
  onOpenSuggestionModal,
  onViewDetails,
  onBulkDelete
}: CommandeListProps) {
  const { t } = useTranslation();

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PREP': return 'bg-info/10 text-info border-info/20';
      case 'ATT': return 'bg-warning/10 text-warning border-warning/20';
      case 'CLOT': return 'bg-success/10 text-success border-success/20';
      default: return 'bg-base-200 text-base-content/60 border-base-300';
    }
  };


  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
        <h1 className="text-xl font-bold text-base-content">{t('orders.list.title')}</h1>
        <div className="flex gap-2 w-full md:w-auto">
            <button 
                className="btn btn-secondary btn-sm gap-2" 
                onClick={onOpenSuggestionModal}
                disabled={loading}
            >
                {loading ? <span className="loading loading-spinner loading-xs" /> : <span>✨</span>} 
                {t('orders.list.suggestions_btn')}
            </button>
            <button 
                className="btn btn-primary btn-sm gap-2 text-white" 
                onClick={onOpenCreateView}
                disabled={loading}
            >
                {loading ? <span className="loading loading-spinner loading-xs" /> : <span>+</span>} 
                {t('orders.list.create_btn')}
            </button>
        </div>
      </div>
        
      {/* Unified Filter/Sort Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-base-100 rounded-xl border border-base-200 shadow-sm shrink-0">
        <div className="flex items-center gap-2 mr-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('orders.list.sort_by')}:</span>
            <div className="flex bg-base-200 p-1 rounded-lg">
                <button 
                className={`btn btn-xs px-3 border-none ${sortKey === 'date' ? 'bg-white text-primary shadow-sm' : 'btn-ghost text-base-content/60'}`}
                onClick={() => onSortChange('date')}
                >
                {t('orders.list.table.date')} {sortKey === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button 
                className={`btn btn-xs px-3 border-none ${sortKey === 'numero' ? 'bg-white text-primary shadow-sm' : 'btn-ghost text-base-content/60'}`}
                onClick={() => onSortChange('numero')}
                >
                {t('orders.list.table.id')} {sortKey === 'numero' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button 
                className={`btn btn-xs px-3 border-none ${sortKey === 'status' ? 'bg-white text-primary shadow-sm' : 'btn-ghost text-base-content/60'}`}
                onClick={() => onSortChange('status')}
                >
                {t('orders.list.table.status')} {sortKey === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
            </div>
        </div>
        
        <div className="h-6 w-px bg-base-200 mx-1"></div>
        
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('orders.list.filter_by')}:</span>
            <div className="flex gap-1">
                <button 
                className={`btn btn-xs rounded-full px-4 ${filterStatus === 'ALL' ? 'btn-neutral' : 'btn-ghost text-base-content/60'}`}
                onClick={() => onFilterStatusChange('ALL')}
                >
                {t('orders.list.filters.all')}
                </button>
                <button 
                className={`btn btn-xs rounded-full px-4 border ${filterStatus === 'PREP' ? 'bg-info/20 border-info/30 text-info' : 'btn-ghost border-transparent text-base-content/60'}`}
                onClick={() => onFilterStatusChange('PREP')}
                >
                {t('orders.list.filters.prep')}
                </button>
                <button 
                className={`btn btn-xs rounded-full px-4 border ${filterStatus === 'ATT' ? 'bg-warning/20 border-warning/30 text-warning' : 'btn-ghost border-transparent text-base-content/60'}`}
                onClick={() => onFilterStatusChange('ATT')}
                >
                {t('orders.list.filters.pending')}
                </button>
                <button 
                className={`btn btn-xs rounded-full px-4 border ${filterStatus === 'CLOT' ? 'bg-success/20 border-success/30 text-success' : 'btn-ghost border-transparent text-base-content/60'}`}
                onClick={() => onFilterStatusChange('CLOT')}
                >
                {t('orders.list.filters.closed')}
                </button>
            </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 min-h-0 overflow-auto bg-base-100 rounded-2xl shadow-sm border border-base-200">
        <table className="table table-zebra table-pin-rows w-full text-sm">
          <thead>
            <tr className="bg-base-200 text-base-content/70 border-b border-base-300">
              <th className="w-12 text-center rounded-tl-xl sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300">
                <label className="cursor-pointer label p-0 justify-center">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm checkbox-primary"
                    checked={selectedOrderIds.size === sortedCommandes.length && sortedCommandes.length > 0}
                    onChange={onToggleAllOrdersSelection}
                  />
                </label>
              </th>
                {selectedOrderIds.size > 0 ? (
                  <SelectionHeader
                    selectedCount={selectedOrderIds.size}
                    onClear={() => onToggleAllOrdersSelection()}
                    colSpan={8}
                    actions={
                      selectedOrderIds.size === 1 ? (
                        <>
                          <li className="menu-title px-4 py-2 text-xs font-bold uppercase tracking-widest text-base-content/40">
                            {t('common.single_selection', { defaultValue: 'Sélection' })}
                          </li>
                          {(() => {
                            const id = Array.from(selectedOrderIds)[0];
                            const commande = sortedCommandes.find(x => x.id === id);
                            if (!commande) return null;
                            return (
                              <>
                                <li>
                                  <a onClick={() => onViewDetails(commande)} className="flex items-center gap-3 py-3 hover:bg-info/10 text-info font-medium">
                                    <Eye className="w-4 h-4" /> {t('orders.list.table.view_details')}
                                  </a>
                                </li>
                                {commande.status === 'ATT' && (
                                    <li>
                                        <a onClick={() => {/* Handle print if available */}} className="flex items-center gap-3 py-3 hover:bg-neutral/10 text-neutral font-medium">
                                            <Printer className="w-4 h-4" /> {t('common.print', 'Imprimer')}
                                        </a>
                                    </li>
                                )}
                                {commande.status === 'PREP' && (
                                     <li>
                                        <a onClick={onBulkDelete} className="flex items-center gap-3 py-3 hover:bg-error/10 text-error font-medium">
                                            <Trash2 className="w-4 h-4" /> {t('common.actions.delete')}
                                        </a>
                                     </li>
                                )}
                              </>
                            );
                          })()}
                        </>
                      ) : (
                        <>
                          <li className="menu-title px-4 py-2 text-xs font-bold uppercase tracking-widest text-base-content/40">
                            {t('common.bulk_actions', { defaultValue: 'Actions Groupées' })}
                          </li>
                          {canMerge && (
                            <li>
                                <a onClick={onOpenMergeModal} className="flex items-center gap-3 py-3 hover:bg-info/10 text-info font-medium">
                                    <GitMerge className="w-4 h-4" /> {t('orders.list.selection.merge')}
                                </a>
                            </li>
                          )}
                          <li>
                            <a onClick={onBulkDelete} className="flex items-center gap-3 py-3 hover:bg-error/10 text-error font-medium">
                              <Trash2 className="w-4 h-4" /> {t('orders.bulk_delete_btn')}
                            </a>
                          </li>
                        </>
                      )
                    }
                  >
                    <div />
                  </SelectionHeader>
                ) : (
                  <>
                    <th className="text-[10px] uppercase font-black tracking-widest text-base-content/40 py-3 px-4 cursor-pointer hover:text-primary transition-colors sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300" onClick={() => onSortChange('numero')}>
                      <div className="flex items-center gap-2">
                        {t('orders.list.table.id')} {sortKey === 'numero' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="text-[10px] uppercase font-black tracking-widest text-base-content/40 py-3 px-4 sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300">
                      {t('orders.list.table.invoice_number')}
                    </th>
                    <th className="text-[10px] uppercase font-black tracking-widest text-base-content/40 py-3 px-4 cursor-pointer hover:text-primary transition-colors sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300" onClick={() => onSortChange('date')}>
                      <div className="flex items-center gap-2">
                        {t('common.date')} {sortKey === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="text-[10px] uppercase font-black tracking-widest text-base-content/40 py-3 px-4 cursor-pointer hover:text-primary transition-colors sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300" onClick={() => onSortChange('fournisseur')}>
                      <div className="flex items-center gap-2">
                        {t('common.supplier')} {sortKey === 'fournisseur' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="text-[10px] uppercase font-black tracking-widest text-base-content/40 py-3 px-4 text-center sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300">
                      {t('orders.list.table.items')}
                    </th>
                    <th className="text-[10px] uppercase font-black tracking-widest text-base-content/40 py-3 px-4 text-right sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300">
                      {t('common.total')}
                    </th>
                    <th className="text-[10px] uppercase font-black tracking-widest text-base-content/40 py-3 px-4 cursor-pointer hover:text-primary transition-colors sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300" onClick={() => onSortChange('status')}>
                      <div className="flex items-center gap-2 justify-center">
                        {t('common.status_title')} {sortKey === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="text-[10px] uppercase font-black tracking-widest text-base-content/40 py-3 px-4 text-right pr-4 sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300">
                      {t('common.actions_title')}
                    </th>
                  </>
                )}
            </tr>
          </thead>
          <tbody className="text-base-content font-medium">
            {sortedCommandes.map(commande => (
              <tr 
                key={commande.id} 
                className={`hover:bg-base-200/50 transition-colors group cursor-pointer ${selectedOrderIds.has(commande.id) ? 'bg-primary/5' : ''}`}
                onClick={() => selectedOrderIds.size === 0 && onViewDetails(commande)}
              >
                <td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <label className="cursor-pointer label p-0 justify-center">
                        <input
                        type="checkbox"
                        className="checkbox checkbox-sm checkbox-primary"
                        checked={selectedOrderIds.has(commande.id)}
                        onChange={() => onToggleOrderSelection(commande.id)}
                        />
                    </label>
                </td>
                <td>
                    <span className="font-mono font-bold text-sm text-base-content/90">#{commande.id}</span>
                </td>
                <td>
                    <span className="font-mono font-medium text-xs text-base-content/80">{commande.numero_facture || '-'}</span>
                </td>
                <td>
                    <span className="text-sm font-semibold text-base-content/80">
                        {new Date(commande.date).toLocaleDateString(t('common.locale', 'fr-FR'))}
                    </span>
                </td>
                <td>
                    {(() => {
                        const fournisseur = fournisseurs.find(f => f.id === commande.fournisseur);
                        const isDeleted = !fournisseur && !!commande.fournisseur_nom;
                        const nom = fournisseur?.name ?? (commande.fournisseur_nom || `${t('common.id', { defaultValue: 'ID' })}: ${commande.fournisseur}`);
                        
                        return (
                            <div className="flex flex-col">
                                <span className={`font-bold text-sm ${isDeleted ? 'italic text-base-content/60' : 'text-base-content'}`}>
                                    {nom}
                                </span>
                            </div>
                        );
                    })()}
                </td>
                <td className="text-center">
                    <span className="text-xs font-mono bg-base-200 px-2 py-0.5 rounded-md">
                        {commande.items_count || 0}
                    </span>
                </td>
                <td className="font-bold text-right text-primary">
                    {formatCurrency(Number(commande.total))} F
                </td>
                <td className="text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${getStatusStyle(commande.status)}`}>
                        {commande.status === 'PREP' ? t('orders.status.prep') : 
                         commande.status === 'ATT' ? t('orders.status.pending') : 
                         t('orders.status.closed')}
                    </span>
                </td>
                <td className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            className="btn btn-ghost btn-sm btn-square hover:bg-info/10 hover:text-info transition-colors"
                            onClick={(e) => { e.stopPropagation(); onViewDetails(commande); }}
                            title={t('orders.list.table.view_details')}
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                    </div>
                </td>
              </tr>
            ))}
            {sortedCommandes.length === 0 && (
                <tr>
                    <td colSpan={9} className="text-center py-12 text-base-content/40 italic">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center not-italic">📦</div>
                            {t('orders.list.table.empty')}
                        </div>
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-base-100 rounded-2xl border border-base-200 shadow-sm shrink-0">
          <div className="text-xs font-medium text-base-content/50">
            {t('orders.list.pagination.showing', { count: sortedCommandes.length, total: totalCount })}
          </div>
          
          <div className="join">
            <button 
                className="join-item btn btn-xs btn-ghost" 
                disabled={page === 1} 
                onClick={() => onPageChange(page - 1)}
            >
                «
            </button>
            <button className="join-item btn btn-xs btn-ghost no-animation bg-base-200 font-bold">
                {page} / {totalPages}
            </button>
            <button 
                className="join-item btn btn-xs btn-ghost" 
                disabled={page >= totalPages} 
                onClick={() => onPageChange(page + 1)}
            >
                »
            </button>
          </div>
      </div>
    </div>
  );
}
