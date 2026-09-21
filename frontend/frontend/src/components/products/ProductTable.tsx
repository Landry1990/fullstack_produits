import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProduitModel } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Package, Plus } from 'lucide-react';
import { Checkbox } from '../ui/Checkbox';
import { EmptyState } from '../ui/EmptyState';
import SkeletonTable from '../ui/SkeletonTable';

interface ProductTableProps {
  products: ProduitModel[];
  selectedProduit: ProduitModel | null;
  onViewDetails: (produit: ProduitModel) => void;
  selectedProductIds: number[];
  onSelectProduct: (id: number) => void;
  onSelectAll: () => void;
  onZoom: () => void;
  loading: boolean;
}

export const ProductTable: React.FC<ProductTableProps> = (props) => {
  const {
    products,
    selectedProduit,
    onViewDetails,
    selectedProductIds,
    onSelectProduct,
    onSelectAll,
    onZoom,
    loading
  } = props;
  const { t } = useTranslation(['products', 'common']);

  const isAllSelected = selectedProductIds.length === products.length && products.length > 0;
  const isPartiallySelected = selectedProductIds.length > 0 && selectedProductIds.length < products.length;
  const selectedSet = useMemo(() => new Set(selectedProductIds), [selectedProductIds]);

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto">
      {loading ? (
        <div className="p-4 h-full">
          <SkeletonTable rows={8} columns={3} />
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          variant="base"
          className="h-full py-16"
          icon={<Package className="size-8" />}
          title={t('products:table.empty_title', { defaultValue: 'Aucun produit' })}
          description={t('products:table.empty_subtitle', { defaultValue: 'Créez votre premier produit ou service pour commencer.' })}
          action={
            <button
              className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary-focus transition-colors"
              onClick={() => {
                const parentBtn = document.querySelector('button.bg-primary');
                if (parentBtn) (parentBtn as HTMLButtonElement).click();
              }}
            >
              <Plus className="size-4" />
              {t('products:actions.create')}
            </button>
          }
        />
      ) : (
        <>
          {/* DESKTOP VIEW (Table) */}
          <div className="hidden md:block overflow-x-auto w-full">
            <table className="min-w-full divide-y divide-base-200">
              <thead className="bg-base-200 text-base-content/60 border-b border-base-200">
                <tr>
                  <th scope="col" className="py-2.5 px-4 w-10">
                    <Checkbox
                      checked={isAllSelected}
                      indeterminate={isPartiallySelected}
                      onChange={onSelectAll}
                      size="sm"
                      aria-label={t('common:maintenance.select_all', { defaultValue: 'Tout sélectionner' })}
                    />
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-left text-caption font-semibold uppercase tracking-wider w-32">{t('products:table.cip')}</th>
                  <th scope="col" className="py-2.5 px-3 text-left text-caption font-semibold uppercase tracking-wider">{t('products:table.product', { defaultValue: 'Produit' })}</th>
                </tr>
              </thead>
              <tbody className="bg-base-100 divide-y divide-base-200">
                {products.map((produit) => {
                  const stock = produit.stock ?? 0;
                  const isSelected = selectedProduit?.id === produit.id;
                  const isChecked = selectedSet.has(produit.id);

                  return (
                    <tr
                      key={produit.id}
                      data-product-id={produit.id}
                      className={`hover:bg-base-200 cursor-pointer transition-colors ${
                        isSelected
                        ? 'bg-primary/10 border-l-2 border-l-indigo-500'
                        : isChecked
                          ? 'bg-success/10 border-l-2 border-l-emerald-500'
                          : 'text-base-content'
                      } ${stock < 0 ? 'text-error' : stock === 0 ? 'opacity-60 text-base-content/50' : ''}`}
                      onClick={() => onViewDetails(produit)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onZoom();
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onViewDetails(produit);
                        }
                      }}
                    >
                      <td className="py-3 px-4 w-10" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isChecked}
                          onChange={() => onSelectProduct(produit.id)}
                          size="md"
                          aria-label={produit.name}
                        />
                      </td>
                      <td className="py-3 px-3 w-32">
                        <span className="font-mono text-xs text-base-content/50">{produit.cip1 || '-'}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div
                          className={`text-sm flex items-center flex-wrap gap-2 ${
                            stock < 0 ? 'text-error font-semibold' :
                            stock === 0 ? 'text-base-content/50 font-medium' :
                            'text-base-content font-semibold'
                          }`}
                          title={produit.name}
                        >
                          <span className="truncate">{produit.name}</span>
                          {produit.is_supplier_exclusive && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-caption font-medium bg-success/10 text-success border border-emerald-100 shrink-0"
                              title={`${t('products:table.exclusivity', { defaultValue: 'Exclusivité' })}: ${produit.fournisseur_name || t('products:form.provider_placeholder')}`}
                            >
                              {t('products:table.exclusive_badge')}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE POP-UP LIST (Cards) */}
          <div className="md:hidden flex flex-col w-full px-2 py-2 gap-2 bg-base-200">
            {products.map(produit => {
              const stock = produit.stock ?? 0;
              const isSelected = selectedProduit?.id === produit.id;
              const isChecked = selectedSet.has(produit.id);

              return (
                <div
                  key={produit.id}
                  data-product-id={produit.id}
                  className={`flex flex-col p-3 rounded-lg border bg-base-100 shadow-sm transition-all relative overflow-hidden ${
                    isSelected ? 'border-indigo-300 shadow-sm' : isChecked ? 'border-emerald-300' : 'border-base-200 hover:border-base-300'
                  }`}
                  onClick={() => onViewDetails(produit)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onViewDetails(produit);
                    }
                  }}
                >
                  {(isSelected || isChecked) && (
                    <div className={`absolute top-0 bottom-0 left-0 w-1 ${isSelected ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                  )}

                  <div className="flex justify-between items-start w-full gap-3 pl-1">
                    <div className="pt-0.5" onClick={e => e.stopPropagation()}>
                       <Checkbox
                          checked={isChecked}
                          onChange={() => onSelectProduct(produit.id)}
                          size="sm"
                          aria-label={produit.name}
                        />
                    </div>

                    <div className="flex-1 min-w-0 pr-1 py-0.5">
                       <div className="flex items-center justify-between w-full mb-0.5">
                          <div className={`text-sm font-semibold truncate tracking-tight ${stock < 0 ? 'text-error' : stock === 0 ? 'text-base-content/50' : 'text-base-content'}`}>
                             {produit.name}
                          </div>
                       </div>

                       <div className="flex items-center gap-2 mb-2">
                           {produit.is_supplier_exclusive && (
                               <span className="inline-flex items-center px-1.5 py-0.5 rounded text-caption font-medium bg-success/10 text-success border border-emerald-100">{t('products:table.exclusive_badge')}</span>
                           )}
                           <span className="text-xs text-base-content/50 font-mono font-medium tracking-tight">
                              {produit.cip1 || '-'}
                           </span>
                       </div>

                        <div className="flex items-center justify-between w-full pt-1.5 border-t border-base-200">
                          <div className="flex items-center gap-1">
                             <span className="text-caption text-base-content/50 font-medium uppercase">{t('products:table.stock')}</span>
                             <span className={`text-xs font-semibold ${stock < 0 ? 'text-red-500' : stock === 0 ? 'text-base-content/50' : 'text-base-content'}`}>
                                {stock}
                             </span>
                          </div>

                          <div className="text-right">
                              <span className="text-sm font-semibold text-primary tracking-tight">
                                  {formatCurrency(Math.round(Number(produit.selling_price || 0)))}
                              </span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
