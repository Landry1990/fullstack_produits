import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ProduitModel } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Checkbox } from '../ui/Checkbox';

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

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center p-12 h-full">
          <span className="loading loading-spinner loading-md text-blue-600"></span>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center h-full">
          <div className="w-20 h-20 rounded-full bg-base-200 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
            </svg>
          </div>
          <h3 className="text-xl font-bold text-base-content">{t('products:table.empty_title', { defaultValue: 'Aucun produit' })}</h3>
          <p className="text-base-content/60 text-sm mt-2 max-w-sm">{t('products:table.empty_subtitle', { defaultValue: 'Créez votre premier produit ou service pour commencer.' })}</p>
          <button 
            className="btn btn-primary bg-blue-600 hover:bg-blue-700 border-none text-white mt-8 rounded-xl shadow-sm px-8 font-medium normal-case"
            onClick={() => {
              // Hack to trigger the create modal from the parent if empty state is reached
              const parentBtn = document.querySelector('button.bg-blue-600');
              if (parentBtn) (parentBtn as HTMLButtonElement).click();
            }}
          >
             + {t('products:actions.create', { defaultValue: 'Créer un produit' })}
          </button>
        </div>
      ) : (
        <>
          {/* DESKTOP VIEW (Table) */}
          <div className="hidden md:block overflow-x-auto w-full">
            <table className="table table-xs table-pin-rows w-full">
              <thead className="bg-base-200/50 text-base-content/60 border-b border-base-200">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <Checkbox
                      checked={isAllSelected}
                      indeterminate={isPartiallySelected}
                      onChange={onSelectAll}
                      size="sm"
                    />
                  </th>
                  <th className="py-3 px-3 font-black uppercase text-xs tracking-wider w-32 border-none">CIP</th>
                  <th className="py-3 px-3 font-black uppercase text-xs tracking-wider border-none">{t('products:table.product', { defaultValue: 'Produit' })}</th>
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
                      className={`hover cursor-pointer transition-colors ${
                        isSelected 
                        ? 'bg-primary/10 border-l-4 border-l-primary font-medium' 
                        : isChecked 
                          ? 'bg-success/10 border-l-4 border-l-success' 
                          : 'border-b border-base-200 text-base-content/90'
                      } ${stock < 0 ? 'text-red-600' : stock === 0 ? 'opacity-60 text-base-content/60' : ''}`}
                      onClick={() => onViewDetails(produit)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onZoom();
                      }}
                    >
                      <td className="py-3.5 px-4 w-10 border-none" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isChecked}
                          onChange={() => onSelectProduct(produit.id)}
                          size="md"
                          color={isChecked ? 'success' : 'primary'}
                        />
                      </td>
                      <td className="py-3.5 px-3 w-32 border-none">
                        <span className="font-mono text-xs font-bold text-base-content/50">{produit.cip1 || '-'}</span>
                      </td>
                      <td className="py-3.5 px-3 border-none">
                        <div 
                          className={`text-sm uppercase flex items-center flex-wrap gap-2 ${
                            stock < 0 ? 'text-red-600 font-black' : 
                            stock === 0 ? 'text-base-content/60 font-bold' : 
                            'text-base-content font-black'
                          }`} 
                          title={produit.name}
                        >
                          <span className="truncate">{produit.name}</span>
                          {produit.is_supplier_exclusive && (
                            <div 
                              className="tooltip tooltip-right z-50 inline-flex shrink-0" 
                              data-tip={`${t('products:table.exclusivity', { defaultValue: 'Exclusivité' })}: ${produit.fournisseur_name || t('products:form.provider_placeholder')}`}
                            >
                              <span className="badge badge-success badge-outline font-black text-[10px] uppercase tracking-tighter px-1.5 py-0.5 h-auto min-h-0">
                                EXCLU
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
          </div>

          {/* MOBILE POP-UP LIST (Cards) */}
          <div className="md:hidden flex flex-col w-full px-2 py-2 gap-2 bg-base-200/50">
            {products.map(produit => {
              const stock = produit.stock ?? 0;
              const isSelected = selectedProduit?.id === produit.id;
              const isChecked = selectedProductIds.includes(produit.id);

              return (
                <div 
                  key={produit.id} 
                  data-product-id={produit.id}
                  className={`flex flex-col p-3 rounded-[14px] border border-base-200 bg-base-100 shadow-sm transition-all relative overflow-hidden ${
                    isSelected ? 'ring-2 ring-blue-500 border-transparent shadow-md' : isChecked ? 'ring-2 ring-green-500 border-transparent' : 'hover:border-blue-300'
                  }`}
                  onClick={() => onViewDetails(produit)}
                >
                  {/* Left-edge selection indicator */}
                  {(isSelected || isChecked) && (
                    <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${isSelected ? 'bg-blue-500' : 'bg-green-500'}`} />
                  )}

                  <div className="flex justify-between items-start w-full gap-3 pl-1">
                    <div className="pt-0.5" onClick={e => e.stopPropagation()}>
                       <Checkbox
                          checked={isChecked}
                          onChange={() => onSelectProduct(produit.id)}
                          size="sm"
                          color={isChecked ? 'success' : 'primary'}
                        />
                    </div>
                    
                    <div className="flex-1 min-w-0 pr-1 py-0.5">
                       <div className="flex items-center justify-between w-full mb-0.5">
                          <div className={`text-sm font-black truncate tracking-tight uppercase ${stock < 0 ? 'text-red-600' : stock === 0 ? 'text-base-content/40' : 'text-base-content'}`}>
                             {produit.name}
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-2 mb-2">
                           {produit.is_supplier_exclusive && (
                               <span className="badge badge-success badge-outline text-[10px] font-black tracking-tight uppercase px-1.5 h-auto min-h-0">EXCLUSIF</span>
                           )}
                           <span className="text-xs text-base-content/60 font-mono font-bold tracking-tight">
                              {produit.cip1 || 'AUCUN CIP'}
                           </span>
                       </div>

                        <div className="flex items-center justify-between w-full pt-1.5 border-t border-base-200">
                          <div className="flex items-center gap-1">
                             <span className="text-[10px] text-base-content/40 font-medium uppercase">Stock</span>
                             <span className={`text-xs font-black ${stock < 0 ? 'text-red-500' : stock === 0 ? 'text-base-content/40' : 'text-base-content/90'}`}>
                                {stock}
                             </span>
                          </div>
                          
                          <div className="text-right">
                              <span className="text-sm font-black text-blue-600 tracking-tight">
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
