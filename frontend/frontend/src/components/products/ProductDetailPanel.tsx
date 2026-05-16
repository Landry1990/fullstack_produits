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
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full size-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!selectedProduit) {
    return (
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-gray-300 p-10 text-center">
        <div className="size-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <span className="text-2xl text-gray-300">📦</span>
        </div>
        <p className="font-semibold text-gray-500">{t('products:detail.none_selected')}</p>
        <p className="text-sm text-gray-400 mt-1 max-w-[200px]">{t('products:detail.select_hint')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
      <div className="flex flex-col h-full">
        {/* Header produit */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold uppercase">#{selectedProduit.id}</span>
                <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  (selectedProduit.stock ?? 0) <= 0 ? 'bg-red-50 text-red-700' :
                  (selectedProduit.stock ?? 0) <= (selectedProduit.stock_alert ?? 0) ? 'bg-amber-50 text-amber-700' :
                  'bg-emerald-50 text-emerald-700'
                }`}>
                  {t('products:detail.rayon_label')}: {selectedProduit.stock ?? 0}
                  {selectedProduit.has_reserve_storage && (
                    <> / {t('products:detail.reserve_label')}: {selectedProduit.stock_reserve ?? 0}</>
                  )}
                </span>
              </div>

              <div className="flex flex-wrap gap-1 shrink-0">
                <button
                  className="p-2 text-gray-400 hover:bg-amber-50 hover:text-amber-600 rounded-lg transition-colors"
                  onClick={props.onOpenAdjustment}
                  title={t('products:actions.adjust_stock')}
                >
                  📊
                </button>
                {selectedProduit.has_reserve_storage && (selectedProduit.stock_reserve ?? 0) > 0 && (
                  <button
                    className={`p-2 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors ${transferLoading ? 'opacity-50' : ''}`}
                    onClick={() => props.onTransferToRayon(selectedProduit)}
                    title={t('products:actions.refill_rayon')}
                  >
                    📦
                  </button>
                )}
                <button
                  className="p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                  onClick={() => props.onOpenEdit(selectedProduit)}
                  title={t('products:actions.edit')}
                >
                  ✏️
                </button>
                <button
                  className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                  onClick={() => props.onDelete(selectedProduit)}
                  title={t('products:actions.delete')}
                >
                  🗑️
                </button>
                <button
                  className="p-2 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                  onClick={() => props.onGenerateLabels(selectedProduit)}
                  title={t('products:actions.labels')}
                >
                  🏷️
                </button>
                <button
                  className={`p-2 rounded-lg transition-colors ${selectedProduit.is_active === false ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:bg-gray-100'}`}
                  onClick={() => props.onToggleActive(selectedProduit)}
                  title={selectedProduit.is_active === false ? t('products:actions.reactivate') : t('products:actions.deactivate')}
                >
                  {selectedProduit.is_active === false ? '👁️' : '🙈'}
                </button>
              </div>
            </div>

            <div className="min-w-0">
              <h2 className="text-lg md:text-xl font-bold text-gray-900 uppercase tracking-tight leading-tight break-words mb-2">
                {selectedProduit.name}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <p className="text-sm text-gray-400 font-mono font-medium">
                  CIP: <span className="text-gray-700">{selectedProduit.cip1 || '-'}</span>
                </p>
                {selectedProduit.cip2 && (
                  <p className="text-sm text-gray-400 font-mono font-medium">
                    • <span className="text-gray-700">{selectedProduit.cip2}</span>
                  </p>
                )}
                {selectedProduit.cip3 && (
                  <p className="text-sm text-gray-400 font-mono font-medium">
                    • <span className="text-gray-700">{selectedProduit.cip3}</span>
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
