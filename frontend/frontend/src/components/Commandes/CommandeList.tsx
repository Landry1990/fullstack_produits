import { useTranslation } from 'react-i18next';
import { Eye, Trash2, Printer, GitMerge, Sparkles, Clock, Plus, ArrowUpDown } from 'lucide-react';
import type { Commande, Fournisseur } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dateUtils';
import SelectionHeader from '../ui/SelectionHeader';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { cn } from '../../lib/utils';



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

  onFilterStatusChange: (us: string) => void;



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



  const getStatusStyle = (us: string) => {
    switch (us) {
      case 'PREP': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'ATT': return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'CLOT': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const getStatusLabel = (us: string) => {
    switch (us) {
      case 'PREP': return t('orders:status.prep', 'Préparation');
      case 'ATT': return t('orders:status.att', 'En attente');
      case 'CLOT': return t('orders:status.clot', 'Clôturé');
      default: return us;
    }
  };





  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-800">{t('orders:list.title')}</h1>
          <Badge variant="secondary" className="text-xs">{totalCount}</Badge>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => onOpenSuggestionModal()}
            disabled={loading}
          >
            {loading ? <span className="size-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> : <Sparkles className="size-4 text-amber-500" />}
            {t('orders:list.suggestions_btn')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onOpenScheduledList}
            disabled={loading}
            title="Planification automatique"
          >
            {loading ? <span className="size-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> : <Clock className="size-4 text-blue-500" />}
            <span className="hidden sm:inline">{t('orders:list.scheduling_btn', 'Planification')}</span>
          </Button>

          <Button
            size="sm"
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            onClick={onOpenCreateView}
            disabled={loading}
          >
            {loading ? <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="size-4" />}
            {t('orders:list.create_btn')}
          </Button>
        </div>
      </div>



      {/* Unified Filter/Sort Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-2 mr-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t('orders:list.sort_by')}:</span>
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "px-3 py-1 h-7 rounded-md text-xs font-medium transition-all",
                sortKey === 'date' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
              onClick={() => onSortChange('date')}
            >
              {t('orders:list.table.date')} {sortKey === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "px-3 py-1 h-7 rounded-md text-xs font-medium transition-all",
                sortKey === 'numero' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
              onClick={() => onSortChange('numero')}
            >
              {t('orders:list.table.id')} {sortKey === 'numero' && (sortOrder === 'asc' ? '↑' : '↓')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "px-3 py-1 h-7 rounded-md text-xs font-medium transition-all",
                sortKey === 'status' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
              onClick={() => onSortChange('status')}
            >
              {t('orders:list.table.status')} {sortKey === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
            </Button>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-1"></div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t('orders:list.filter_by')}:</span>
          <div className="flex gap-1">
            <Button
              variant={filterStatus === 'ALL' ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                "px-3 py-1 h-7 rounded-full text-xs font-medium",
                filterStatus === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
              )}
              onClick={() => onFilterStatusChange('ALL')}
            >
              {t('orders:list.filters.all')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "px-3 py-1 h-7 rounded-full text-xs font-medium border transition-all",
                filterStatus === 'PREP' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-transparent text-slate-500 hover:bg-slate-100'
              )}
              onClick={() => onFilterStatusChange('PREP')}
            >
              {t('orders:list.filters.prep')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "px-3 py-1 h-7 rounded-full text-xs font-medium border transition-all",
                filterStatus === 'ATT' ? 'bg-amber-50 border-amber-200 text-amber-600' : 'border-transparent text-slate-500 hover:bg-slate-100'
              )}
              onClick={() => onFilterStatusChange('ATT')}
            >
              {t('orders:list.filters.pending')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "px-3 py-1 h-7 rounded-full text-xs font-medium border transition-all",
                filterStatus === 'CLOT' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'border-transparent text-slate-500 hover:bg-slate-100'
              )}
              onClick={() => onFilterStatusChange('CLOT')}
            >
              {t('orders:list.filters.closed')}
            </Button>
          </div>
        </div>
      </div>



      {/* Table Section */}
      <div className="flex-1 min-h-0 overflow-auto bg-white rounded-xl shadow-sm border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <th className="w-12 text-center sticky top-0 z-30 bg-slate-50">
                <label className="cursor-pointer flex items-center justify-center p-0">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
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

                          <li className="menu-title px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-content/50">

                            {t('common:single_selection', { defaultValue: 'Sélection' })}

                          </li>

                          {(() => {

                            const id = Array.from(selectedOrderIds)[0];

                            const commande = sortedCommandes.find(x => x.id === id);

                            if (!commande) return null;

                            return (

                              <>

                                <li>

                                  <a onClick={() => onViewDetails(commande)} className="flex items-center gap-2 py-2 hover:bg-info/10 text-info font-medium text-sm">

                                    <Eye className="size-4" /> {t('orders:list.table.view_details')}

                                  </a>

                                </li>

                                {commande.status === 'ATT' && (

                                    <li>

                                        <a onClick={() => {/* Handle print if available */}} className="flex items-center gap-2 py-2 hover:bg-base-200 text-base-content/70 font-medium text-sm">

                                            <Printer className="size-4" /> {t('common:print', 'Imprimer')}

                                        </a>

                                    </li>

                                )}

                                {commande.status === 'PREP' && (

                                     <li>

                                        <a onClick={onBulkDelete} className="flex items-center gap-2 py-2 hover:bg-error/10 text-error font-medium text-sm">

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

                          <li className="menu-title px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-base-content/50">

                            {t('common:bulk_actions', { defaultValue: 'Actions Groupées' })}

                          </li>

                          {canMerge && (

                            <li>

                                <a onClick={onOpenMergeModal} className="flex items-center gap-2 py-2 hover:bg-info/10 text-info font-medium text-sm">

                                    <GitMerge className="size-4" /> {t('orders:list.selection.merge')}

                                </a>

                            </li>

                          )}

                          <li>

                            <a onClick={onBulkDelete} className="flex items-center gap-2 py-2 hover:bg-error/10 text-error font-medium text-sm">

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
                    <th className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 text-left cursor-pointer hover:text-emerald-600 transition-colors sticky top-0 z-30 bg-slate-50" onClick={() => onSortChange('numero')}>
                      <div className="flex items-center gap-2">
                        {t('orders:list.table.id')} {sortKey === 'numero' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 text-left sticky top-0 z-30 bg-slate-50">
                      {t('orders:list.table.invoice_number')}
                    </th>
                    <th className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 cursor-pointer hover:text-emerald-600 transition-colors sticky top-0 z-30 bg-slate-50" onClick={() => onSortChange('date')}>
                      <div className="flex items-center gap-2">
                        {t('common:date')} {sortKey === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 cursor-pointer hover:text-emerald-600 transition-colors sticky top-0 z-30 bg-slate-50" onClick={() => onSortChange('fournisseur')}>
                      <div className="flex items-center gap-2">
                        {t('common:supplier')} {sortKey === 'fournisseur' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 text-center sticky top-0 z-30 bg-slate-50">
                      {t('orders:list.table.items')}
                    </th>

                    <th className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 text-right sticky top-0 z-30 bg-slate-50">
                      HT
                    </th>
                    <th className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 text-right sticky top-0 z-30 bg-slate-50">
                      TVA
                    </th>
                    <th className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 text-right sticky top-0 z-30 bg-slate-50">
                      TTC
                    </th>
                    <th className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 cursor-pointer hover:text-emerald-600 transition-colors sticky top-0 z-30 bg-slate-50" onClick={() => onSortChange('status')}>
                      <div className="flex items-center gap-2 justify-center">
                        {t('common:us_title')} {sortKey === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>

                  </>

                )}

            </tr>

          </thead>

          <tbody className="text-slate-700 font-medium">
            {sortedCommandes.map(commande => (
              <tr
                key={commande.id}
                className={cn(
                  "hover:bg-slate-50 transition-colors group cursor-pointer border-b border-slate-100 last:border-0",
                  selectedOrderIds.has(commande.id) ? 'bg-emerald-50/50' : ''
                )}
                onClick={() => selectedOrderIds.size === 0 && onViewDetails(commande)}
              >
                <td className="text-center py-3" onClick={(e) => e.stopPropagation()}>
                  <label className="cursor-pointer flex items-center justify-center p-0">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      checked={selectedOrderIds.has(commande.id)}
                      onChange={() => onToggleOrderSelection(commande.id)}
                    />
                  </label>
                </td>
                <td className="text-left py-3 px-4">
                  <span className="font-mono font-semibold text-sm text-slate-500">#{commande.id}</span>
                </td>
                <td className="text-left py-3 px-4">
                  <span className="font-mono text-sm text-slate-400">{commande.numero_facture || '-'}</span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm font-medium text-slate-500">
                    {formatDate(commande.date)}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {(() => {
                    const fournisseur = fournisseurs.find(f => f.id === commande.fournisseur);
                    const isDeleted = !fournisseur && !!commande.fournisseur_nom;
                    const nom = fournisseur?.name ?? (commande.fournisseur_nom || `${t('common:id', { defaultValue: 'ID' })}: ${commande.fournisseur}`);
                    return (
                      <div className="flex flex-col">
                        <span className={cn("font-semibold text-sm", isDeleted ? 'italic text-slate-400' : 'text-slate-700')}>
                          {nom}
                        </span>
                      </div>
                    );
                  })()}
                </td>
                <td className="text-center py-3 px-4">
                  <Badge variant="secondary" className="text-xs font-mono">
                    {commande.items_count || 0}
                  </Badge>
                </td>
                <td className="text-right text-slate-500 text-xs py-3 px-4">
                  {formatCurrency(Number(commande.total_ht || commande.total))}
                </td>
                <td className="text-right text-slate-500 text-xs py-3 px-4">
                  {formatCurrency(Number(commande.total_tva || 0))}
                </td>
                <td className="font-semibold text-right text-emerald-600 py-3 px-4">
                  {formatCurrency(Number(commande.total_ttc || commande.total))}
                </td>

                <td className="text-center py-3 px-4">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wider",
                      getStatusStyle(commande.status)
                    )}
                  >
                    {getStatusLabel(commande.status)}
                  </Badge>
                </td>

              </tr>

            ))}

            {sortedCommandes.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-12 text-slate-400">
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <p className="text-sm">{t('orders:list.table.empty')}</p>
                  </div>
                </td>
              </tr>
            )}

          </tbody>

        </table>

      </div>



      {/* Pagination Footer */}
      <div className="flex flex-col px-4 py-3 bg-white rounded-lg border border-slate-200 shadow-sm shrink-0 gap-2">
        {/* Ligne 1 : Info + Pagination */}
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-slate-400">
            {t('orders:list.pagination.showing', { count: sortedCommandes.length, total: totalCount })}
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
            >
              «
            </Button>
            <span className="inline-flex items-center px-3 h-7 text-xs font-semibold rounded-md bg-slate-100 text-slate-600">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              »
            </Button>
          </div>
        </div>

        {/* Ligne 2 : Totaux sélectionnés */}
        {selectedOrderIds.size > 0 && (() => {
          const selected = sortedCommandes.filter(c => selectedOrderIds.has(c.id));
          const totalHt = selected.reduce((sum, c) => sum + Number(c.total_ht || c.total), 0);
          const totalTva = selected.reduce((sum, c) => sum + Number(c.total_tva || 0), 0);
          const totalTtc = selected.reduce((sum, c) => sum + Number(c.total_ttc || c.total), 0);
          return (
            <div className="flex items-center justify-end gap-4 text-sm border-t border-slate-100 pt-2">
              <span className="font-semibold text-slate-500">{selectedOrderIds.size} sélectionnée{selectedOrderIds.size > 1 ? 's' : ''}</span>
              <span className="text-slate-400">HT <span className="font-semibold text-slate-700">{formatCurrency(Number(totalHt.toFixed(2)))}</span></span>
              <span className="text-slate-400">TVA <span className="font-semibold text-slate-700">{formatCurrency(Number(totalTva.toFixed(2)))}</span></span>
              <span className="text-emerald-600 font-bold">TTC <span className="font-bold">{formatCurrency(Number(totalTtc.toFixed(2)))}</span></span>
            </div>
          );
        })()}
      </div>

    </div>

  );

}

