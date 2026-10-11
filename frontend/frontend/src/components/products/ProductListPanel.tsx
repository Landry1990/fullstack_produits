import React from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ProduitModel } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Checkbox } from '../ui/Checkbox';
import SkeletonTable from '../ui/SkeletonTable';
import { EmptyState } from '../ui/EmptyState';
import PaginationControls from '../ui/PaginationControls';

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function stockClass(stock: number): string {
  if (stock < 0) return 'text-red-600 font-bold'
  if (stock === 0) return 'text-slate-400 font-medium'
  return 'text-slate-800 font-bold'
}

interface ProductListPanelProps {
  produits: ProduitModel[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  showInStockOnly: boolean;
  onShowInStockOnlyChange: (v: boolean) => void;
  showInactive: boolean;
  onShowInactiveChange: (v: boolean) => void;
  hasActiveFilters: boolean;
  hasFilterRayon: boolean;
  hasFilterFournisseur: boolean;
  onResetFilters: () => void;
  selectedProduit: ProduitModel | null;
  onSelectProduit: (p: ProduitModel) => void;
  selectedIds: number[];
  setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>;
  isAllSelected: boolean;
  isPartial: boolean;
  totalCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onNewProduct: () => void;
}

export const ProductListPanel: React.FC<ProductListPanelProps> = ({
  produits, isLoading,
  searchQuery, onSearchChange,
  showInStockOnly, onShowInStockOnlyChange,
  showInactive, onShowInactiveChange,
  hasActiveFilters, hasFilterRayon, hasFilterFournisseur, onResetFilters,
  selectedProduit, onSelectProduit,
  selectedIds, setSelectedIds,
  isAllSelected, isPartial,
  totalCount, lowStockCount, outOfStockCount,
  page, totalPages, onPageChange,
  onNewProduct,
}) => {
  const { t } = useTranslation(['products', 'common']);
  const selectedSet = new Set(selectedIds);

  return (
    <>
      {/* Search & Filters */}
      <Card variant="default" padding="md" className="shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder={t('products:filters.search_placeholder')}
            aria-label={t('products:filters.search_placeholder')}
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
            <Checkbox size="sm" checked={showInStockOnly} onChange={v => onShowInStockOnlyChange(v)} aria-label={t('products:filters.in_stock_only', { defaultValue: 'En stock uniquement' })} />
            {t('products:filters.in_stock_only', { defaultValue: 'En stock uniquement' })}
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
            <Checkbox size="sm" checked={showInactive} onChange={v => onShowInactiveChange(v)} aria-label={t('products:filters.show_inactive', { defaultValue: 'Afficher inactifs' })} />
            {t('products:filters.show_inactive', { defaultValue: 'Afficher inactifs' })}
          </label>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onResetFilters} leftIcon={<X className="size-3" />}>
              {t('products:filters.reset', { defaultValue: 'Réinitialiser' })}
            </Button>
          )}
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {hasFilterRayon && <Badge variant="secondary" size="sm">{t('products:filters.rayon_active')}</Badge>}
            {hasFilterFournisseur && <Badge variant="warning" size="sm">{t('products:filters.provider_active')}</Badge>}
            {showInactive && <Badge variant="ghost" size="sm">{t('products:filters.inactive_only')}</Badge>}
            {showInStockOnly && <Badge variant="success" size="sm">{t('products:filters.in_stock_only', { defaultValue: 'En stock' })}</Badge>}
          </div>
        )}
      </Card>

      {/* Table */}
      <Card variant="default" padding="none" className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Table Header */}
        <div className="shrink-0 px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Checkbox size="sm" checked={isAllSelected} indeterminate={isPartial} onChange={() => setSelectedIds(prev => prev.length === produits.length ? [] : produits.map(p => p.id))} aria-label={t('products:table.select_all')} />
            <span>{t('products:table.cip')}</span>
            <span className="ml-6">{t('products:table.product', { defaultValue: 'Produit' })}</span>
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto overflow-x-auto">
          {isLoading ? (
            <SkeletonTable />
          ) : produits.length === 0 ? (
            <EmptyState
              className="py-16"
              icon={<Package className="size-8" />}
              title={t('products:table.empty_title', { defaultValue: 'Aucun produit' })}
              description={t('products:table.empty_subtitle', { defaultValue: 'Créez votre premier produit ou service pour commencer.' })}
              action={
                <Button variant="primary" size="sm" onClick={onNewProduct}>
                  + {t('products:actions.create', { defaultValue: 'Créer un produit' })}
                </Button>
              }
            />
          ) : (
            <table className="w-full">
              <tbody className="divide-y divide-slate-100">
                {produits.map(produit => {
                  const stock = produit.stock ?? 0
                  const isSelected = selectedProduit?.id === produit.id
                  const isChecked = selectedSet.has(produit.id)
                  return (
                    <tr
                      key={produit.id}
                      data-product-id={produit.id}
                      onClick={() => onSelectProduit(produit)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectProduit(produit);
                        }
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-emerald-50 border-l-2 border-l-emerald-500' :
                        isChecked ? 'bg-emerald-50/50' :
                        'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2 px-4 w-10" onClick={e => e.stopPropagation()}>
                        <Checkbox size="sm" checked={isChecked} aria-label={produit.name} onChange={() => setSelectedIds(prev => { const s = new Set(prev); return s.has(produit.id) ? prev.filter(id => id !== produit.id) : [...prev, produit.id]; })} />
                      </td>
                      <td className="py-2 px-2 w-36">
                        <div className="font-mono text-xs text-slate-500">
                          {[produit.cip1, produit.cip2, produit.cip3, produit.cip4].filter(Boolean).join(' • ') || '-'}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={cn("min-w-0 text-sm uppercase truncate", produit.is_service ? 'text-slate-800 font-medium' : stockClass(stock))} title={produit.name}>
                            {produit.name}
                          </span>
                          {produit.is_service && (
                            <Badge variant="secondary" size="sm">{t('products:form.service_badge')}</Badge>
                          )}
                          {produit.is_supplier_exclusive && (
                            <Badge variant="success" size="sm">{t('products:table.exclusive_badge')}</Badge>
                          )}
                          {produit.is_active === false && (
                            <Badge variant="ghost" size="sm">{t('products:table.inactive_badge')}</Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer stats */}
        <div className="shrink-0 px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('products:footer.global')}</span>
            <Badge variant="primary" size="sm">{totalCount}</Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5" title={t('products:footer.low_stock_title')}>
              <div className="size-2 rounded-full bg-amber-400" />
              <span className="text-amber-600 font-semibold text-sm">{lowStockCount}</span>
            </div>
            <div className="flex items-center gap-1.5" title={t('products:footer.out_of_stock_title')}>
              <div className="size-2 rounded-full bg-red-500" />
              <span className="text-red-600 font-semibold text-sm">{outOfStockCount}</span>
            </div>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="shrink-0 px-4 py-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">{t('common:pagination.page_info', { page, total: totalPages })}</span>
            <div className="flex items-center gap-2">
              <PaginationControls
                page={page}
                totalPages={totalPages}
                onPageChange={onPageChange}
                isLoading={isLoading}
              />
            </div>
          </div>
        )}
      </Card>
    </>
  );
};
