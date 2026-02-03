import type { Commande, Fournisseur } from '../../types';
import { useTranslation } from 'react-i18next';

export type SortKey = 'numero' | 'date' | 'fournisseur' | 'status';

interface CommandeListProps {
  // Data
  commandes: Commande[];
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
  mergeReason?: string;
  onOpenMergeModal: () => void;

  // Navigation / Actions
  onOpenCreateView: () => void;
  onOpenSuggestionModal: () => void;
  onViewDetails: (commande: Commande) => void;
}

export default function CommandeList({
  commandes,
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
  mergeReason,
  onOpenMergeModal,
  onOpenCreateView,
  onOpenSuggestionModal,
  onViewDetails
}: CommandeListProps) {
  const { t } = useTranslation();

  // Fonction pour obtenir la classe CSS du badge de statut
  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PREP':
        return 'badge badge-info'; // Bleu - En préparation
      case 'ATT':
        return 'badge badge-warning'; // Orange - En attente
      case 'CLOT':
        return 'badge badge-success'; // Vert - Clôturée
      default:
        return 'badge badge-ghost';
    }
  }

  const handleSortClick = (key: SortKey) => {
    onSortChange(key);
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-lg md:text-xl font-bold">{t('orders.list.title')}</h1>
        <div className="flex gap-2 w-full md:w-auto">
            <button 
                className="btn btn-secondary btn-sm" 
                onClick={onOpenSuggestionModal}
            >
                ✨ {t('orders.list.suggestions_btn')}
            </button>
            <button className="btn btn-primary btn-sm" onClick={onOpenCreateView}>+ {t('orders.list.create_btn')}</button>
        </div>
      </div>
        
      {/* Tri et Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('orders.list.sort_by')}:</span>
        <button 
          className={`btn btn-xs ${sortKey === 'numero' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => handleSortClick('numero')}
        >
          {t('orders.list.table.id')} {sortKey === 'numero' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          className={`btn btn-xs ${sortKey === 'date' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => handleSortClick('date')}
        >
          {t('orders.list.table.date')} {sortKey === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          className={`btn btn-xs ${sortKey === 'fournisseur' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => handleSortClick('fournisseur')}
        >
          {t('orders.list.table.provider')} {sortKey === 'fournisseur' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          className={`btn btn-xs ${sortKey === 'status' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => handleSortClick('status')}
        >
          {t('orders.list.table.status')} {sortKey === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        
        <div className="divider divider-horizontal mx-2"></div>
        
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('orders.list.filter_by')}:</span>
        <button 
          className={`btn btn-xs ${filterStatus === 'ALL' ? 'btn-neutral' : 'btn-ghost'}`}
          onClick={() => onFilterStatusChange('ALL')}
        >
          {t('orders.list.filters.all')} ({commandes.length})
        </button>
        <button 
          className={`btn btn-xs gap-1 ${filterStatus === 'PREP' ? 'btn-info' : 'btn-ghost'}`}
          onClick={() => onFilterStatusChange('PREP')}
        >
          <span className="w-2 h-2 rounded-full bg-info"></span>
          {t('orders.list.filters.prep')} ({commandes.filter(c => c.status === 'PREP').length})
        </button>
        <button 
          className={`btn btn-xs gap-1 ${filterStatus === 'ATT' ? 'btn-warning' : 'btn-ghost'}`}
          onClick={() => onFilterStatusChange('ATT')}
        >
          <span className="w-2 h-2 rounded-full bg-warning"></span>
          {t('orders.list.filters.pending')} ({commandes.filter(c => c.status === 'ATT').length})
        </button>
        <button 
          className={`btn btn-xs gap-1 ${filterStatus === 'CLOT' ? 'btn-success' : 'btn-ghost'}`}
          onClick={() => onFilterStatusChange('CLOT')}
        >
          <span className="w-2 h-2 rounded-full bg-success"></span>
          {t('orders.list.filters.closed')} ({commandes.filter(c => c.status === 'CLOT').length})
        </button>
      </div>

      {/* Barre d'actions sélection multiple */}
      {selectedOrderIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <span className="font-semibold text-sm">{t('orders.list.selection.selected_count', { count: selectedOrderIds.size })}</span>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={onToggleAllOrdersSelection} // Using toggle all to potentially deselect if logic matches, or create dedicated deselect
          >
            {t('orders.list.selection.deselect')}
          </button>
          
          <button
            type="button"
            className="btn btn-sm btn-secondary gap-1"
            onClick={onOpenMergeModal}
            disabled={!canMerge}
            title={mergeReason || ''}
          >
            🔀 {t('orders.list.selection.merge')}
          </button>
        </div>
      )}

      {loading && <div className="flex justify-center p-8"><span className="loading loading-spinner"></span></div>}

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="table table-zebra w-full">
          <thead className="bg-base-200">
            <tr>
              <th className="w-12">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={selectedOrderIds.size === sortedCommandes.length && sortedCommandes.length > 0}
                  onChange={onToggleAllOrdersSelection}
                />
              </th>
              <th>{t('orders.list.table.id')}</th>
              <th>{t('orders.list.table.invoice_number')}</th>
              <th>{t('orders.list.table.date')}</th>
              <th>{t('orders.list.table.provider')}</th>
              <th>{t('orders.list.table.status')}</th>
              <th className="text-right">{t('orders.list.table.total')}</th>
              <th className="text-center">{t('orders.list.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedCommandes.map(commande => (
              <tr key={commande.id} className={`hover ${selectedOrderIds.has(commande.id) ? 'bg-primary/5' : ''}`}>
                <td>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={selectedOrderIds.has(commande.id)}
                    onChange={() => onToggleOrderSelection(commande.id)}
                  />
                </td>
                <td className="font-mono font-bold text-xs opacity-50">#{commande.id}</td>
                <td className="font-mono">{commande.numero_facture || '-'}</td>
                <td>{new Date(commande.date).toLocaleDateString('fr-FR')}</td>
                <td className="font-bold">
                    {(() => {
                        const fournisseur = fournisseurs.find(f => f.id === commande.fournisseur);
                        const isDeleted = !fournisseur && !!commande.fournisseur_nom;
                        const nom = fournisseur?.name ?? (commande.fournisseur_nom || `ID: ${commande.fournisseur}`);
                        
                        return (
                            <span className={isDeleted ? 'italic' : ''}>
                                {nom}
                                {isDeleted && <span className="text-xs ml-2 opacity-75">(Supprimé)</span>}
                            </span>
                        );
                    })()}
                </td>
                <td><span className={getStatusBadgeClass(commande.status)}>{commande.status_display}</span></td>
                <td className="font-bold text-right text-primary">{commande.total} F</td>
                <td className="text-center">
                  <button 
                    className="btn btn-ghost btn-xs"
                    onClick={() => onViewDetails(commande)}
                  >
                    {t('orders.list.table.view_details')}
                  </button>
                </td>
              </tr>
            ))}
            {sortedCommandes.length === 0 && (
                <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">{t('orders.list.table.empty')}</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Footer info */}
      <div className="p-2 bg-white border-t rounded-b-lg shadow text-xs text-center text-base-content/50 flex flex-col items-center gap-2 mt-[-8px] mb-4">
          <div>
            {t('orders.list.pagination.showing', { count: commandes.length, total: totalCount })}
          </div>
          
          {!loading && totalCount > 0 && (
              <div className="flex justify-center items-center gap-2">
              <button 
                className="btn btn-xs btn-outline" 
                disabled={page === 1} 
                onClick={() => onPageChange(page - 1)}
              >
                ← {t('orders.list.pagination.prev')}
              </button>
              <div className="px-2 py-1 bg-white rounded border border-base-200">
                <span className="font-semibold">{t('orders.list.pagination.page')} {page}</span>
                {totalPages > 1 && <span className="text-gray-500"> / {totalPages}</span>}
              </div>
              <button 
                className="btn btn-xs btn-outline" 
                disabled={page >= totalPages} 
                onClick={() => onPageChange(page + 1)}
              >
                {t('orders.list.pagination.next')} →
              </button>
            </div>
          )}
      </div>
    </div>
  );
}
