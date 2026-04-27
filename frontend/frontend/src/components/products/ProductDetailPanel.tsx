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
        {/* Header produit - Bold & Spacious with vertical stacking for top elements */}
        <div className="p-6 border-b bg-base-200/50 shrink-0">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-info badge-lg font-black uppercase tracking-tight py-4 px-4">#{selectedProduit.id}</span>
                <span className={`badge badge-lg font-black h-10 px-4 ${
                  (selectedProduit.stock ?? 0) <= 0 ? 'badge-error text-white' :
                  (selectedProduit.stock ?? 0) <= (selectedProduit.stock_alert ?? 0) ? 'badge-warning text-warning-content' :
                  'badge-success text-white'
                }`}>
                  {t('products:detail.rayon_label')}: {selectedProduit.stock ?? 0}
                  {selectedProduit.has_reserve_storage && (
                    <> / {t('products:detail.reserve_label')}: {selectedProduit.stock_reserve ?? 0}</>
                  )}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2 shrink-0">
                <button 
                  className="btn btn-md btn-ghost text-xl hover:bg-amber-100 hover:text-warning transition-colors" 
                  onClick={props.onOpenAdjustment}
                  title={t('products:actions.adjust_stock')}
                >
                  📊
                </button>
                {selectedProduit.has_reserve_storage && (selectedProduit.stock_reserve ?? 0) > 0 && (
                  <button 
                    className={`btn btn-md btn-ghost text-xl text-primary hover:bg-primary/10 ${transferLoading ? 'loading' : ''}`}
                    onClick={() => props.onTransferToRayon(selectedProduit)}
                    title={t('products:actions.refill_rayon')}
                  >
                    📦
                  </button>
                )}
                <button 
                  className="btn btn-md btn-ghost text-xl hover:bg-blue-100 hover:text-primary transition-colors" 
                  onClick={() => props.onOpenEdit(selectedProduit)}
                  title={t('products:actions.edit')}
                >
                  ✏️
                </button>
                <button 
                  className="btn btn-md btn-ghost text-xl hover:bg-red-100 hover:text-error transition-colors" 
                  onClick={() => props.onDelete(selectedProduit)}
                  title={t('products:actions.delete')}
                >
                  🗑️
                </button>
                <button 
                  className="btn btn-md btn-ghost text-xl hover:bg-secondary/10 hover:text-secondary transition-colors" 
                  onClick={() => props.onGenerateLabels(selectedProduit)}
                  title={t('products:actions.labels')}
                >
                  🏷️
                </button>
                <button 
                  className={`btn btn-md btn-ghost text-xl ${selectedProduit.is_active === false ? 'text-warning bg-warning/10' : 'text-base-content/40 hover:bg-warning/10 hover:text-warning'} transition-colors`}
                  onClick={() => props.onToggleActive(selectedProduit)}
                  title={selectedProduit.is_active === false ? t('products:actions.reactivate') : t('products:actions.deactivate')}
                >
                  {selectedProduit.is_active === false ? '👁️' : '🙈'}
                </button>
              </div>
            </div>

            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl xl:text-3xl font-black text-base-content uppercase tracking-tighter leading-none break-words mb-3">
                {selectedProduit.name}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <p className="text-base text-base-content/60 font-mono font-bold tracking-tight">
                  CIP: <span className="text-base-content">{selectedProduit.cip1 || '-'}</span>
                </p>
                {selectedProduit.cip2 && (
                  <p className="text-base text-base-content/60 font-mono font-bold tracking-tight">
                    • <span className="text-base-content">{selectedProduit.cip2}</span>
                  </p>
                )}
                {selectedProduit.cip3 && (
                  <p className="text-base text-base-content/60 font-mono font-bold tracking-tight">
                    • <span className="text-base-content">{selectedProduit.cip3}</span>
                  </p>
                )}
              </div>
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
