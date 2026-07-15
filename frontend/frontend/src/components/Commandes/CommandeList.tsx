import { useTranslation } from 'react-i18next';
import { Eye, Trash2, Printer, GitMerge, Sparkles, Plus, ArrowUpDown, Search, X, Package } from 'lucide-react';
import type { Commande, Fournisseur } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dateUtils';
import SelectionHeader from '../ui/SelectionHeader';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { Checkbox } from '../shadcn/checkbox';
import { Input } from '../shadcn/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/Table';
import { cn } from '../../lib/utils';



export type SortKey = 'numero' | 'date' | 'fournisseur' | 'status';



interface CommandeListProps {

  // Data

  sortedCommandes: Commande[];

  fournisseurs: Fournisseur[];

  loading: boolean;

  totalCount: number;
  statusCounts: Record<string, number>;

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
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;


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

const getStatusStyle = (us: string) => {
  switch (us) {
    case 'PREP': return 'bg-blue-50 text-blue-600 border-blue-200';
    case 'ATT': return 'bg-amber-50 text-amber-600 border-amber-200';
    case 'CLOT': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    default: return 'bg-slate-100 text-slate-500 border-slate-200';
  }
};


export default function CommandeList({

  sortedCommandes,

  fournisseurs,

  loading,

  totalCount,
  statusCounts,

  page,

  totalPages,

  onPageChange,

  sortKey,

  sortOrder,

  onSortChange,

  filterStatus,

  onFilterStatusChange,
  searchQuery,
  onSearchQueryChange,

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

  const { t } = useTranslation(['orders', 'common']);



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
            className="gap-2 bg-white border-emerald-500 text-emerald-700 hover:bg-white hover:border-emerald-700 hover:text-emerald-800 transition-colors"
            onClick={() => onOpenSuggestionModal()}
            disabled={loading}
          >
            {loading ? <span className="size-4 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" /> : <Sparkles className="size-4" />}
            {t('orders:list.suggestions_btn')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-white border-emerald-500 text-emerald-700 hover:bg-white hover:border-emerald-700 hover:text-emerald-800 transition-colors"
            onClick={onOpenCreateView}
            disabled={loading}
          >
            {loading ? <span className="size-4 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" /> : <Plus className="size-4" />}
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
                sortKey === 'fournisseur' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
              onClick={() => onSortChange('fournisseur')}
            >
              {t('common:supplier')} {sortKey === 'fournisseur' && (sortOrder === 'asc' ? '↑' : '↓')}
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

        {/* Search input */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder={t('orders:list.search_placeholder', 'Rechercher (N° facture, ID)…')}
              className="w-full h-8 pl-8 pr-7 text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchQueryChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-1"></div>
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
              {t('orders:list.filters.all')} ({(statusCounts.PREP || 0) + (statusCounts.ATT || 0) + (statusCounts.CLOT || 0)})
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
              {t('orders:list.filters.prep')} ({statusCounts.PREP || 0})
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
              {t('orders:list.filters.pending')} ({statusCounts.ATT || 0})
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
              {t('orders:list.filters.closed')} ({statusCounts.CLOT || 0})
            </Button>
          </div>
        </div>

      {/* Table Section */}
      <div className="flex-1 min-h-0 overflow-auto bg-white rounded-xl shadow-sm border border-slate-200 max-h-[60vh]">
        <Table className="w-full text-sm">
          <TableHeader>
            <TableRow className="bg-slate-50 text-slate-500 border-b border-slate-200 hover:bg-slate-50">
              <TableHead className="w-12 text-center sticky top-0 z-30 bg-slate-50">
                <Checkbox
                  checked={selectedOrderIds.size === sortedCommandes.length && sortedCommandes.length > 0}
                  onCheckedChange={onToggleAllOrdersSelection}
                />
              </TableHead>

                {selectedOrderIds.size > 0 ? (

                  <SelectionHeader

                    selectedCount={selectedOrderIds.size}

                    onClear={() => onToggleAllOrdersSelection()}

                    colSpan={8}

                    actions={

                      selectedOrderIds.size === 1 ? (

                        <>

                          <li className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">

                            {t('common:single_selection', { defaultValue: 'Sélection' })}

                          </li>

                          {(() => {

                            const id = Array.from(selectedOrderIds)[0];

                            const commande = sortedCommandes.find(x => x.id === id);

                            if (!commande) return null;

                            return (

                              <>

                                <li>

                                  <a onClick={() => onViewDetails(commande)} className="flex items-center gap-2 py-2 hover:bg-sky-50 text-sky-600 font-medium text-sm">

                                    <Eye className="size-4" /> {t('orders:list.table.view_details')}

                                  </a>

                                </li>

                                {commande.status === 'ATT' && (

                                    <li>

                                        <a onClick={() => {/* Handle print if available */}} className="flex items-center gap-2 py-2 hover:bg-slate-100 text-slate-600 font-medium text-sm">

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

                          <li className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">

                            {t('common:bulk_actions', { defaultValue: 'Actions Groupées' })}

                          </li>

                          {canMerge && (

                            <li>

                                <a onClick={onOpenMergeModal} className="flex items-center gap-2 py-2 hover:bg-sky-50 text-sky-600 font-medium text-sm">

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
                    <TableHead className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 text-left cursor-pointer hover:text-emerald-600 transition-colors sticky top-0 z-30 bg-slate-50" onClick={() => onSortChange('numero')}>
                      <div className="flex items-center gap-2">
                        {t('orders:list.table.id')} {sortKey === 'numero' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </TableHead>
                    <TableHead className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 text-left sticky top-0 z-30 bg-slate-50">
                      {t('orders:list.table.invoice_number')}
                    </TableHead>
                    <TableHead className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 cursor-pointer hover:text-emerald-600 transition-colors sticky top-0 z-30 bg-slate-50" onClick={() => onSortChange('date')}>
                      <div className="flex items-center gap-2">
                        {t('common:date')} {sortKey === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </TableHead>
                    <TableHead className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 cursor-pointer hover:text-emerald-600 transition-colors sticky top-0 z-30 bg-slate-50" onClick={() => onSortChange('fournisseur')}>
                      <div className="flex items-center gap-2">
                        {t('common:supplier')} {sortKey === 'fournisseur' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </TableHead>
                    <TableHead className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 text-center sticky top-0 z-30 bg-slate-50">
                      {t('orders:list.table.items')}
                    </TableHead>

                    <TableHead className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 text-right sticky top-0 z-30 bg-slate-50">
                      HT
                    </TableHead>
                    <TableHead className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 text-right sticky top-0 z-30 bg-slate-50">
                      TVA
                    </TableHead>
                    <TableHead className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 text-right sticky top-0 z-30 bg-slate-50">
                      TTC
                    </TableHead>
                    <TableHead className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 py-3 px-4 cursor-pointer hover:text-emerald-600 transition-colors sticky top-0 z-30 bg-slate-50" onClick={() => onSortChange('status')}>
                      <div className="flex items-center gap-2 justify-center">
                        {t('common:us_title')} {sortKey === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </div>
                    </TableHead>

                  </>

                )}

            </TableRow>

          </TableHeader>

          <TableBody className="text-slate-700 font-medium">
            {sortedCommandes.map(commande => (
              <TableRow
                key={commande.id}
                className={cn(
                  "hover:bg-slate-50 transition-colors group cursor-pointer border-b border-slate-100 last:border-0",
                  selectedOrderIds.has(commande.id) ? 'bg-emerald-50/50' : ''
                )}
                onClick={() => selectedOrderIds.size === 0 && onViewDetails(commande)}
              >
                <TableCell className="text-center py-3" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedOrderIds.has(commande.id)}
                    onCheckedChange={() => onToggleOrderSelection(commande.id)}
                  />
                </TableCell>
                <TableCell className="text-left py-3 px-4">
                  <span className="font-mono font-semibold text-sm text-slate-500">#{commande.id}</span>
                </TableCell>
                <TableCell className="text-left py-3 px-4">
                  <span className="font-mono text-sm text-slate-400">{commande.numero_facture || '-'}</span>
                </TableCell>
                <TableCell className="py-3 px-4">
                  <span className="text-sm font-medium text-slate-500">
                    {formatDate(commande.date)}
                  </span>
                </TableCell>
                <TableCell className="py-3 px-4">
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
                </TableCell>
                <TableCell className="text-center py-3 px-4">
                  <Badge variant="secondary" className="text-xs font-mono">
                    {commande.items_count || 0}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-slate-500 text-xs py-3 px-4">
                  {formatCurrency(Number(commande.total_ht || commande.total))}
                </TableCell>
                <TableCell className="text-right text-slate-500 text-xs py-3 px-4">
                  {formatCurrency(Number(commande.total_tva || 0))}
                </TableCell>
                <TableCell className="font-semibold text-right text-emerald-600 py-3 px-4">
                  {formatCurrency(Number(commande.total_ttc || commande.total))}
                </TableCell>

                <TableCell className="text-center py-3 px-4">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wider",
                      getStatusStyle(commande.status)
                    )}
                  >
                    {getStatusLabel(commande.status)}
                  </Badge>
                </TableCell>

              </TableRow>

            ))}

            {sortedCommandes.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-slate-400">
                  <div className="flex flex-col items-center gap-3">
                    <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <Package className="size-6 text-slate-400" />
                    </div>
                    <p className="text-sm">{t('orders:list.table.empty')}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}

          </TableBody>

        </Table>

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

