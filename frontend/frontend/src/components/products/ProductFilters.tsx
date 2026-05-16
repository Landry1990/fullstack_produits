import React from 'react';
import { useTranslation } from 'react-i18next';

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
    <div className="p-4 bg-white border-b border-gray-100">
      <div className="form-control w-full">
        <div className="relative w-full">
          <input
            type="text"
            placeholder={t('products:filters.search_placeholder')}
            className="input input-bordered w-full input-md bg-gray-50 border-gray-200 focus:border-indigo-500 rounded-lg text-sm pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex items-center gap-4 mt-3 px-1">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              className="checkbox checkbox-primary checkbox-sm rounded border-gray-300"
              checked={showInStockOnly}
              onChange={(e) => setShowInStockOnly(e.target.checked)}
            />
            <span className="text-xs font-medium text-gray-600 group-hover:text-indigo-600 transition-colors">
              {t('products:filters.in_stock_only', { defaultValue: 'En stock uniquement' })}
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group ml-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm rounded border-gray-300"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <span className="text-xs font-medium text-gray-600 group-hover:text-gray-800 transition-colors">
              {t('products:filters.show_inactive', { defaultValue: 'Afficher inactifs' })}
            </span>
          </label>
        </div>
        {(filterRayon || filterFournisseur || filterExclusive || showInactive || showInStockOnly) && (
          <div className="mt-2 flex items-center gap-2">
            <button className="text-xs text-red-600 hover:text-red-700 font-medium" onClick={resetFilters}>
              {t('products:filters.reset')}
            </button>
            <div className="flex gap-1 flex-wrap">
              {filterRayon && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">{t('products:filters.rayon_active')}</span>}
              {filterFournisseur && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100">{t('products:filters.provider_active')}</span>}
              {filterExclusive && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">{t('products:filters.exclusive_only')}</span>}
              {showInactive && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">{t('products:filters.inactive_only')}</span>}
              {showInStockOnly && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">{t('products:filters.in_stock_only', { defaultValue: 'En stock' })}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
