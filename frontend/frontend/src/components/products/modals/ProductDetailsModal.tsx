import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ProduitModel, StockLot } from '../../../types';
import PremiumModal from '../../common/PremiumModal';
import { ProductTabsContent } from '../ProductTabsContent';

interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProduit: ProduitModel | null;
  activeTab: any;
  setActiveTab: (tab: any) => void;
  lots: StockLot[];
  monthlyStats: any[];
  achats: any[];
  stockHistory: any[];
  loadingHistory: boolean;
  onMovementClick: (item: any) => void;
  onOpenAdjustment: () => void;
  onOpenEdit: (produit: ProduitModel) => void;
  onDelete: (produit: ProduitModel) => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  isOpen,
  onClose,
  selectedProduit,
  activeTab,
  setActiveTab,
  lots,
  monthlyStats,
  achats,
  stockHistory,
  loadingHistory,
  onMovementClick,
  onOpenAdjustment,
  onOpenEdit,
  onDelete
}) => {
  const { t } = useTranslation(['products', 'common']);

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('products:detail.title')}
      subtitle={selectedProduit?.name}
      maxWidth="max-w-4xl"
      icon={<span>📦</span>}
      gradientFrom="primary/10"
      gradientTo="secondary/10"
    >
      <div className="p-6">
        {selectedProduit && (
          <div className="space-y-6">
            {/* Info Card - Improved design */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-base-200/50 p-4 rounded-2xl border border-base-300 shadow-sm">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-base-content/50">CIP1</span>
                <span className="font-mono font-bold text-primary">{selectedProduit.cip1 || '-'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-base-content/50">{t('products:detail.total_stock')}</span>
                <span className={`text-xl font-bold ${
                  (selectedProduit.stock ?? 0) <= 0 ? 'text-error' :
                  (selectedProduit.stock ?? 0) <= (selectedProduit.stock_alert ?? 0) ? 'text-warning' :
                  'text-success'
                }`}>{selectedProduit.stock ?? 0}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-base-content/50">{t('products:detail.rayon_label')}</span>
                <span className="font-bold truncate" title={selectedProduit.rayon_name ?? undefined}>{selectedProduit.rayon_name || '-'}</span>
              </div>
            </div>

            <ProductTabsContent
              selectedProduit={selectedProduit}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              lots={lots}
              monthlyStats={monthlyStats}
              achats={achats}
              stockHistory={stockHistory}
              loadingHistory={loadingHistory}
              onMovementClick={onMovementClick}
            />

            {/* Action Buttons Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-base-200">
              <div className="flex gap-2">
                <button
                  className="btn btn-warning btn-sm shadow-sm"
                  onClick={onOpenAdjustment}
                >
                  📊 {t('products:actions.adjust_stock')}
                </button>
                <button
                  className="btn btn-primary btn-sm shadow-sm"
                  onClick={() => onOpenEdit(selectedProduit)}
                >
                  ✏️ {t('products:actions.edit')}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-ghost btn-sm text-error"
                  onClick={() => onDelete(selectedProduit)}
                >
                  🗑️ {t('products:actions.delete')}
                </button>
                <button className="btn btn-neutral btn-sm px-8" onClick={onClose}>{t('common:actions.close')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PremiumModal>
  );
};
