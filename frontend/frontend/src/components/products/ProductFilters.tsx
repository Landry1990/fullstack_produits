import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Checkbox } from '../shadcn/checkbox';

interface ProductFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterRayon: string;
  setFilterRayon: (rayon: string) => void;
  filterFournisseur: string;
  setFilterFournisseur: (fournisseur: string) => void;
  filterExclusive: boolean;
  setFilterExclusive: (exclusive: boolean) => void;
  showInactive: boolean;
  setShowInactive: (show: boolean) => void;
  showInStockOnly: boolean;
  setShowInStockOnly: (show: boolean) => void;
}

export const ProductFilters: React.FC<ProductFiltersProps> = (props) => {
  const {
    searchQuery,
    setSearchQuery,
    filterRayon,
    setFilterRayon,
    filterFournisseur,
    setFilterFournisseur,
    filterExclusive,
    setFilterExclusive,
    showInactive,
    setShowInactive,
    showInStockOnly,
    setShowInStockOnly
  } = props;

  const { t } = useTranslation(['products', 'common']);


  const resetFilters = () => {
    setSearchQuery('');
    setFilterRayon('');
    setFilterFournisseur('');
    setFilterExclusive(false);
    setShowInactive(false);
    setShowInStockOnly(false);
  };

  return (
    <div className="p-4 bg-base-100 border-b border-base-200">
      <div className="flex flex-col gap-1 w-full">
        <div className="relative w-full">
          <input
            type="text"
            placeholder={t('products:filters.search_placeholder')}
            className="w-full bg-base-200 border border-base-300 focus:border-primary rounded-lg text-sm pl-10 h-10 px-4 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-3 px-1">
          <label htmlFor="filter-in-stock" className="flex items-center gap-2 cursor-pointer group">
            <Checkbox
              id="filter-in-stock"
              checked={showInStockOnly}
              onCheckedChange={(checked) => setShowInStockOnly(Boolean(checked))}
            />
            <span className="text-xs font-medium text-base-content/70 group-hover:text-primary transition-colors">
              {t('products:filters.in_stock_only')}
            </span>
          </label>
          <label htmlFor="filter-inactive" className="flex items-center gap-2 cursor-pointer group ml-2">
            <Checkbox
              id="filter-inactive"
              checked={showInactive}
              onCheckedChange={(checked) => setShowInactive(Boolean(checked))}
            />
            <span className="text-xs font-medium text-base-content/70 group-hover:text-base-content transition-colors">
              {t('products:filters.show_inactive')}
            </span>
          </label>
        </div>
        {(filterRayon || filterFournisseur || filterExclusive || showInactive || showInStockOnly) && (
          <div className="mt-2 flex items-center gap-2">
            <button className="text-xs text-error hover:text-error font-medium" onClick={resetFilters}>
              {t('products:filters.reset')}
            </button>
            <div className="flex gap-1 flex-wrap">
              {filterRayon && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-info/10 text-info border border-blue-100">{t('products:filters.rayon_active')}</span>}
              {filterFournisseur && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-warning/10 text-warning border border-amber-100">{t('products:filters.provider_active')}</span>}
              {filterExclusive && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-indigo-100">{t('products:filters.exclusive_only')}</span>}
              {showInactive && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-base-200 text-base-content/70 border border-base-300">{t('products:filters.inactive_only')}</span>}
              {showInStockOnly && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-success/10 text-success border border-emerald-100">{t('products:filters.in_stock_only')}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
