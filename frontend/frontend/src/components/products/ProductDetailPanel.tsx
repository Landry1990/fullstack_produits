import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ProduitModel, StockLot } from '../../types';
import { ProductTabsContent } from './ProductTabsContent';

interface ProductDetailPanelProps {
  selectedProduit: ProduitModel | null;
  detailsLoading: boolean;
  activeTab: any;
  setActiveTab: (tab: any) => void;
  lots: StockLot[];
  monthlyStats: any[];
  achats: any[];
  stockHistory: any[];
  loadingHistory: boolean;
  loadingAchats: boolean;
  transferLoading: boolean;
  onMovementClick: (item: any) => void;
  onOpenAdjustment: () => void;
  onOpenEdit: (produit: ProduitModel) => void;
  onGenerateLabels: (produit: ProduitModel) => void;
  onDelete: (produit: ProduitModel) => void;
  onToggleActive: (produit: ProduitModel) => void;
  onTransferToRayon: (produit: ProduitModel) => void;
}

export const ProductDetailPanel: React.FC<ProductDetailPanelProps> = (props) => {
  const { t } = useTranslation(['products', 'common']);
  const { selectedProduit, detailsLoading, transferLoading } = props;

  if (detailsLoading) {
    return (
      <div className="md:col-span-2 bg-base-100 rounded-lg shadow flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!selectedProduit) {
    return (
      <div className="md:col-span-2 bg-base-100 rounded-lg shadow flex flex-col items-center justify-center text-base-content/30 p-10 text-center">
        <div className="w-20 h-20 rounded-full bg-base-200/50 flex items-center justify-center mb-4">
          <span className="text-3xl">📦</span>
        </div>
        <p className="font-bold text-base-content/40">{t('products:detail.none_selected')}</p>
        <p className="text-sm text-base-content/30 mt-1 max-w-[200px]">{t('products:detail.select_hint')}</p>
      </div>
    );
  }

  return (
    <div className="md:col-span-2 bg-base-100 rounded-lg shadow flex flex-col overflow-hidden">
      <div className="flex flex-col h-full">
        {/* Header produit */}
        <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-white shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold uppercase">#{selectedProduit.id}</span>
                <span className={`badge badge-md ${
                  (selectedProduit.stock ?? 0) <= 0 ? 'badge-error' :
                  (selectedProduit.stock ?? 0) <= (selectedProduit.stock_alert ?? 0) ? 'badge-warning' :
                  'badge-success'
                }`}>
                  {t('products:detail.rayon_label')}: {selectedProduit.stock ?? 0}
                  {selectedProduit.has_reserve_storage && (
                    <> / {t('products:detail.reserve_label')}: {selectedProduit.stock_reserve ?? 0}</>
                  )}
                </span>
              </div>
              <h2 className="text-2xl font-black text-base-content uppercase">{selectedProduit.name}</h2>
              <p className="text-sm text-base-content/60 font-mono mt-1">
                {t('products:detail.cip')}: {selectedProduit.cip1 || '-'} / {selectedProduit.cip2 || '-'} / {selectedProduit.cip3 || '-'}
              </p>
            </div>
            <div className="flex gap-1">
              <button 
                className="btn btn-sm btn-ghost text-base-content/40 hover:text-warning" 
                onClick={props.onOpenAdjustment}
                title={t('products:actions.adjust_stock')}
              >
                📊
              </button>
              {selectedProduit.has_reserve_storage && (selectedProduit.stock_reserve ?? 0) > 0 && (
                <button 
                  className={`btn btn-sm btn-ghost text-primary hover:bg-primary/10 ${transferLoading ? 'loading' : ''}`}
                  onClick={() => props.onTransferToRayon(selectedProduit)}
                  title={t('products:actions.refill_rayon')}
                >
                  📦 ⬇️
                </button>
              )}
              <button 
                className="btn btn-sm btn-ghost text-base-content/40 hover:text-primary" 
                onClick={() => props.onOpenEdit(selectedProduit)}
                title={t('products:actions.edit')}
              >
                ✏️
              </button>
              <button 
                className="btn btn-sm btn-ghost text-base-content/40 hover:text-secondary" 
                onClick={() => props.onGenerateLabels(selectedProduit)}
                title={t('products:actions.labels')}
              >
                🏷️
              </button>
              <button 
                className="btn btn-sm btn-ghost text-base-content/40 hover:text-error" 
                onClick={() => props.onDelete(selectedProduit)}
                title={t('products:actions.delete')}
              >
                🗑️
              </button>
              <button 
                className={`btn btn-sm btn-ghost ${selectedProduit.is_active === false ? 'text-warning' : 'text-base-content/40 hover:text-warning'}`}
                onClick={() => props.onToggleActive(selectedProduit)}
                title={selectedProduit.is_active === false ? t('products:actions.reactivate') : t('products:actions.deactivate')}
              >
                {selectedProduit.is_active === false ? '👁️' : '🙈'}
              </button>
            </div>
          </div>
        </div>

        <ProductTabsContent
          selectedProduit={selectedProduit}
          activeTab={props.activeTab}
          setActiveTab={props.setActiveTab}
          lots={props.lots}
          monthlyStats={props.monthlyStats}
          achats={props.achats}
          stockHistory={props.stockHistory}
          loadingHistory={props.loadingHistory}
          onMovementClick={props.onMovementClick}
        />
      </div>
    </div>
  );
};
