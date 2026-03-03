import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ProduitModel } from '../../types';

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
  console.log('[ProductTable] Rendering with', props.products?.length, 'products');
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
  const { t } = useTranslation();

  return (
    <div className="flex-1 overflow-auto">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4">
          <span className="text-xl">📭</span>
          <span className="text-xs mt-1">{t('products.table.empty')}</span>
        </div>
      ) : (
        <table className="table table-xs table-pin-rows w-full">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="py-1.5 px-1 w-6">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs checkbox-primary"
                  checked={selectedProductIds.length === products.length && products.length > 0}
                  onChange={onSelectAll}
                  title="Tout sélectionner"
                />
              </th>
              <th className="py-1.5 px-2 font-semibold uppercase text-[9px] tracking-wider w-20">CIP</th>
              <th className="py-1.5 px-2 font-semibold uppercase text-[9px] tracking-wider">Produit</th>
            </tr>
          </thead>
          <tbody>
            {products.map((produit) => {
              const stock = produit.stock ?? 0;
              const isSelected = selectedProduit?.id === produit.id;
              const isChecked = selectedProductIds.includes(produit.id);
              
              return (
                <tr
                  key={produit.id}
                  data-product-id={produit.id}
                  className={`hover cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-primary/20 border-l-4 border-l-primary font-semibold' 
                      : isChecked 
                        ? 'bg-success/10 border-l-4 border-l-success' 
                        : 'border-b border-slate-50 text-slate-600'
                  } ${stock < 0 ? 'text-error' : stock === 0 ? 'opacity-60' : ''}`}
                  onClick={() => onViewDetails(produit)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onZoom();
                  }}
                >
                  <td className="py-1 px-1 w-6" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs checkbox-primary"
                      checked={isChecked}
                      onChange={() => onSelectProduct(produit.id)}
                    />
                  </td>
                  <td className="py-1 px-2 w-20">
                    <span className="font-mono text-xs text-slate-600 font-semibold">{produit.cip1 || '-'}</span>
                  </td>
                  <td className="py-1 px-2">
                    <div 
                      className={`text-xs uppercase flex items-center flex-wrap gap-1 ${
                        stock < 0 ? 'text-error font-bold' : 
                        stock === 0 ? 'text-slate-400 font-normal' : 
                        'text-slate-800 font-bold'
                      }`} 
                      title={produit.name}
                    >
                      <span>{produit.name}</span>
                      {produit.is_supplier_exclusive && (
                        <div 
                          className="tooltip tooltip-right z-50 inline-flex shrink-0" 
                          data-tip={`Exclusivité: ${produit.fournisseur_name || 'Fournisseur Spécifique'}`}
                        >
                          <span className="badge badge-success badge-sm font-bold text-white w-5 h-5 p-0 flex items-center justify-center text-[10px]">
                            E
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};
