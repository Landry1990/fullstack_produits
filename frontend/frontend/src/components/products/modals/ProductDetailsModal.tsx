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
  stockHistory,
  loadingHistory,
  onMovementClick,
  onOpenAdjustment,
  onOpenEdit,
  onDelete
}) => {
  const { t } = useTranslation();

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('products.details.title') || "📦 Détails du Produit"}
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
                <span className="text-[10px] uppercase font-bold text-base-content/50">Stock Total</span>
                <span className={`text-xl font-bold ${
                  (selectedProduit.stock ?? 0) <= 0 ? 'text-error' :
                  (selectedProduit.stock ?? 0) <= (selectedProduit.stock_alert ?? 0) ? 'text-warning' :
                  'text-success'
                }`}>{selectedProduit.stock ?? 0}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-base-content/50">Rayon</span>
                <span className="font-bold truncate" title={selectedProduit.rayon_name}>{selectedProduit.rayon_name || '-'}</span>
              </div>
            </div>

            <ProductTabsContent
              selectedProduit={selectedProduit}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              lots={lots}
              monthlyStats={monthlyStats}
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
                  📊 Ajuster Stock
                </button>
                <button
                  className="btn btn-primary btn-sm shadow-sm"
                  onClick={() => onOpenEdit(selectedProduit)}
                >
                  ✏️ Modifier
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-ghost btn-sm text-error"
                  onClick={() => onDelete(selectedProduit)}
                >
                  🗑️ Supprimer
                </button>
                <button className="btn btn-neutral btn-sm px-8" onClick={onClose}>Fermer</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PremiumModal>
  );
};
