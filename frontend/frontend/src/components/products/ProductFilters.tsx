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
}

export const ProductFilters: React.FC<ProductFiltersProps> = (props) => {
  console.log('[ProductFilters] Rendering with props:', props);
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
    setShowInactive
  } = props;

  const { t } = useTranslation();


  const resetFilters = () => {
    setSearchQuery('');
    setFilterRayon('');
    setFilterFournisseur('');
    setFilterExclusive(false);
    setShowInactive(false);
  };

  return (
    <div className="p-4 bg-base-100 border-b border-base-200">
      <div className="form-control w-full">
        <div className="join w-full shadow-sm">
          <input
            type="text"
            placeholder={t('products.filters.search_placeholder') || "Rechercher par Nom, CIP, ou mot-clé..."}
            className="input input-bordered join-item w-full input-md focus:input-primary transition-all text-base"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary join-item px-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
        {(filterRayon || filterFournisseur || filterExclusive || showInactive) && (
          <div className="mt-2 flex items-center gap-2">
            <button className="btn btn-ghost btn-xs text-error" onClick={resetFilters}>
              {t('products.filters.reset') || "❌ Effacer les filtres actifs"}
            </button>
            <div className="flex gap-1 flex-wrap">
              {filterRayon && <span className="badge badge-info badge-outline badge-xs px-2">Rayon actif</span>}
              {filterFournisseur && <span className="badge badge-warning badge-outline badge-xs px-2">Fournisseur actif</span>}
              {filterExclusive && <span className="badge badge-primary badge-outline badge-xs px-2">Exclusifs</span>}
              {showInactive && <span className="badge badge-secondary badge-outline badge-xs px-2">Inactifs</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
