import { useTranslation } from 'react-i18next';
import { Eye, Trash2, Printer, GitMerge } from 'lucide-react';
import type { Commande, Fournisseur } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dateUtils';

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
  onOpenScheduledList: () => void;
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
  onOpenScheduledList,
  onViewDetails,
  onBulkDelete
}: CommandeListProps) {
  const { t } = useTranslation(['orders', 'common']);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PREP': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'ATT': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'CLOT': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      default: return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };


  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
        <h1 className="text-base font-semibold text-gray-900">{t('orders:list.title')}</h1>
        <div className="flex gap-2 w-full md:w-auto">
            <button
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => {
                    console.log('Suggestions button clicked, onOpenSuggestionModal:', onOpenSuggestionModal);
                    onOpenSuggestionModal();
                }}
                disabled={loading}
            >
                {loading ? <span className="inline-block size-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> : <span>✨</span>}
                {t('orders:list.suggestions_btn')}
            </button>
            <button
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={onOpenScheduledList}
                disabled={loading}
                title="Planification automatique"
            >
                {loading ? <span className="inline-block size-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> : <span>⏰</span>}
                <span className="hidden sm:inline">{t('orders:list.scheduling_btn', 'Planification')}</span>
            </button>
            <button
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
                onClick={onOpenCreateView}
                disabled={loading}
            >
                {loading ? <span className="inline-block size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>+</span>}
                {t('orders:list.create_btn')}
            </button>
        </div>
      </div>

      {/* Unified Filter/Sort Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 shadow-sm shrink-0">
        <div className="flex items-center gap-2 mr-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t('orders:list.sort_by')}:</span>
            <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-200">
                <button
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${sortKey === 'date' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => onSortChange('date')}
                >
                {t('orders:list.table.date')} {sortKey === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${sortKey === 'numero' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => onSortChange('numero')}
                >
                {t('orders:list.table.id')} {sortKey === 'numero' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${sortKey === 'status' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => onSortChange('status')}
                >
                {t('orders:list.table.status')} {sortKey === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
            </div>
        </div>

        <div className="h-6 w-px bg-gray-200 mx-1"></div>

        <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t('orders:list.filter_by')}:</span>
            <div className="flex gap-1">
                <button
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filterStatus === 'ALL' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                onClick={() => onFilterStatusChange('ALL')}
                >
                {t('orders:list.filters.all')}
                </button>
                <button
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${filterStatus === 'PREP' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}
                onClick={() => onFilterStatusChange('PREP')}
                >
                {t('orders:list.filters.prep')}
                </button>
                <button
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${filterStatus === 'ATT' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}
                onClick={() => onFilterStatusChange('ATT')}
                >
                {t('orders:list.filters.pending')}
                </button>
                <button
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${filterStatus === 'CLOT' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}
                onClick={() => onFilterStatusChange('CLOT')}
                >
                {t('orders:list.filters.closed')}
                </button>
            </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 min-h-0 overflow-auto bg-white rounded-xl shadow-sm border border-gray-100">
        <table className="table table-zebra table-pin-rows w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 border-b border-gray-100">
              <th className="w-12 text-center sticky top-0 z-30 bg-gray-50">
                <label className="cursor-pointer label p-0 justify-center">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm border-gray-300"
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
                          <li className="menu-title px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                            {t('common:single_selection', { defaultValue: 'Sélection' })}
                          </li>
                          {(() => {
                            const id = Array.from(selectedOrderIds)[0];
                            const commande = sortedCommandes.find(x => x.id === id);
                            if (!commande) return null;
                            return (
                              <>
                                <li>
                                  <a onClick={() => onViewDetails(commande)} className="flex items-center gap-2 py-2 hover:bg-blue-50 text-blue-600 font-medium text-sm">
                                    <Eye className="size-4" /> {t('orders:list.table.view_details')}
                                  </a>
                                </li>
                                {commande.status === 'ATT' && (
                                    <li>
                                        <a onClick={() => {/* Handle print if available */}} className="flex items-center gap-2 py-2 hover:bg-gray-50 text-gray-600 font-medium text-sm">
                                            <Printer className="size-4" /> {t('common:print', 'Imprimer')}
                                        </a>
                                    </li>
                                )}
                                {commande.status === 'PREP' && (
                                     <li>
                                        <a onClick={onBulkDelete} className="flex items-center gap-2 py-2 hover:bg-red-50 text-red-600 font-medium text-sm">
                                            <Trash2 className="size-4" /> {t('common:actions.delete')}
                                        </a>
                                     </li>
                                )}
                              </>
                            );
                          })()}
                        </>
                      ) : (
                        <>
                          <li className="menu-title px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                            {t('common:bulk_actions', { defaultValue: 'Actions Groupées' })}
                          </li>
                          {canMerge && (
                            <li>
                                <a onClick={onOpenMergeModal} className="flex items-center gap-2 py-2 hover:bg-blue-50 text-blue-600 font-medium text-sm">
                                    <GitMerge className="size-4" /> {t('orders:list.selection.merge')}
                                </a>
                            </li>
                          )}
                          <li>
                            <a onClick={onBulkDelete} className="flex items-center gap-2 py-2 hover:bg-red-50 text-red-600 font-medium text-sm">
                              <Trash2 className="size-4" /> {t('orders:bulk_delete_btn')}
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
                    <th className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 py-3 px-4 cursor-pointer hover:text-indigo-600 transition-colors sticky top-0 z-30 bg-gray-50" onClick={() => onSortChange('numero')}>
                      <div className="flex items-center gap-2">
                        {t('orders:list.table.id')} {sortKey === 'numero' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 py-3 px-4 sticky top-0 z-30 bg-gray-50">
                      {t('orders:list.table.invoice_number')}
                    </th>
                    <th className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 py-3 px-4 cursor-pointer hover:text-indigo-600 transition-colors sticky top-0 z-30 bg-gray-50" onClick={() => onSortChange('date')}>
                      <div className="flex items-center gap-2">
                        {t('common:date')} {sortKey === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 py-3 px-4 cursor-pointer hover:text-indigo-600 transition-colors sticky top-0 z-30 bg-gray-50" onClick={() => onSortChange('fournisseur')}>
                      <div className="flex items-center gap-2">
                        {t('common:supplier')} {sortKey === 'fournisseur' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 py-3 px-4 text-center sticky top-0 z-30 bg-gray-50">
                      {t('orders:list.table.items')}
                    </th>
                    <th className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 py-3 px-4 text-right sticky top-0 z-30 bg-gray-50">
                      {t('common:total')}
                    </th>
                    <th className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 py-3 px-4 cursor-pointer hover:text-indigo-600 transition-colors sticky top-0 z-30 bg-gray-50" onClick={() => onSortChange('status')}>
                      <div className="flex items-center gap-2 justify-center">
                        {t('common:status_title')} {sortKey === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 py-3 px-4 text-right pr-4 sticky top-0 z-30 bg-gray-50">
                      {t('common:actions_title')}
                    </th>
                  </>
                )}
            </tr>
          </thead>
          <tbody className="text-gray-700 font-medium">
            {sortedCommandes.map(commande => (
              <tr
                key={commande.id}
                className={`hover:bg-gray-50 transition-colors group cursor-pointer ${selectedOrderIds.has(commande.id) ? 'bg-indigo-50/50' : ''}`}
                onClick={() => selectedOrderIds.size === 0 && onViewDetails(commande)}
              >
                <td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <label className="cursor-pointer label p-0 justify-center">
                        <input
                        type="checkbox"
                        className="checkbox checkbox-sm border-gray-300"
                        checked={selectedOrderIds.has(commande.id)}
                        onChange={() => onToggleOrderSelection(commande.id)}
                        />
                    </label>
                </td>
                <td>
                    <span className="font-mono font-semibold text-sm text-gray-700">#{commande.id}</span>
                </td>
                <td>
                    <span className="font-mono text-xs text-gray-500">{commande.numero_facture || '-'}</span>
                </td>
                <td>
                    <span className="text-sm font-medium text-gray-600">
                        {formatDate(commande.date)}
                    </span>
                </td>
                <td>
                    {(() => {
                        const fournisseur = fournisseurs.find(f => f.id === commande.fournisseur);
                        const isDeleted = !fournisseur && !!commande.fournisseur_nom;
                        const nom = fournisseur?.name ?? (commande.fournisseur_nom || `${t('common:id', { defaultValue: 'ID' })}: ${commande.fournisseur}`);

                        return (
                            <div className="flex flex-col">
                                <span className={`font-semibold text-sm ${isDeleted ? 'italic text-gray-400' : 'text-gray-900'}`}>
                                    {nom}
                                </span>
                            </div>
                        );
                    })()}
                </td>
                <td className="text-center">
                    <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded-md text-gray-600">
                        {commande.items_count || 0}
                    </span>
                </td>
                <td className="font-semibold text-right text-indigo-600">
                    {formatCurrency(Number(commande.total))}
                </td>
                <td className="text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border uppercase tracking-wider ${getStatusStyle(commande.status)}`}>
                        {commande.status === 'PREP' ? t('orders:status.prep') :
                         commande.status === 'ATT' ? t('orders:status.pending') :
                         t('orders:status.closed')}
                    </span>
                </td>
                <td className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            onClick={(e) => { e.stopPropagation(); onViewDetails(commande); }}
                            title={t('orders:list.table.view_details')}
                        >
                            <Eye className="size-4" />
                        </button>
                    </div>
                </td>
              </tr>
            ))}
            {sortedCommandes.length === 0 && (
                <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-400">
                        <div className="flex flex-col items-center gap-2">
                            <div className="size-12 rounded-full bg-gray-100 flex items-center justify-center">📦</div>
                            {t('orders:list.table.empty')}
                        </div>
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-gray-100 shadow-sm shrink-0">
          <div className="text-xs font-medium text-gray-400">
            {t('orders:list.pagination.showing', { count: sortedCommandes.length, total: totalCount })}
          </div>

          <div className="flex gap-1">
            <button
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                disabled={page === 1}
                onClick={() => onPageChange(page - 1)}
            >
                «
            </button>
            <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md bg-gray-100 text-gray-700">
                {page} / {totalPages}
            </span>
            <button
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
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
