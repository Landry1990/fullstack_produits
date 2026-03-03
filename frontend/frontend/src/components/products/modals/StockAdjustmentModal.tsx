import React from 'react';
// import { useTranslation } from 'react-i18next';
import { type ProduitModel, STOCK_ADJUSTMENT_REASONS } from '../../../types';
import PremiumModal from '../../common/PremiumModal';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  selectedProduit: ProduitModel | null;
  form: { new_quantity: string; reason_type: string };
  setForm: (form: any) => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  selectedProduit,
  form,
  setForm
}) => {

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title="Ajuster le stock"
      subtitle={selectedProduit?.name}
      maxWidth="max-w-md"
      icon={<span>📊</span>}
      gradientFrom="info/20"
      gradientTo="primary/20"
    >
      <form className="p-6 space-y-6" onSubmit={onSubmit}>
        <div className="bg-info/10 p-4 rounded-xl border border-info/20 text-center">
          <span className="text-sm opacity-70">Stock actuel :</span>
          <div className="text-2xl font-black text-info">{selectedProduit?.stock ?? 0}</div>
        </div>
        
        <div className="space-y-4">
          <label className="form-control w-full">
            <div className="label"><span className="label-text font-bold">Nouvelle quantité *</span></div>
            <input
              type="number"
              className="input input-bordered w-full text-center text-xl font-bold focus:input-primary"
              value={form.new_quantity}
              onChange={(e) => setForm((prev: any) => ({ ...prev, new_quantity: e.target.value }))}
              required
              min={0}
            />
            {form.new_quantity && selectedProduit && (
              <div className="mt-2 text-center">
                <span className={`badge badge-sm font-bold ${
                  parseInt(form.new_quantity) > selectedProduit.stock ? 'badge-success' : 
                  parseInt(form.new_quantity) < selectedProduit.stock ? 'badge-error' : 'badge-ghost'
                }`}>
                  Différence : {parseInt(form.new_quantity) - (selectedProduit.stock || 0) > 0 ? '+' : ''}
                  {parseInt(form.new_quantity) - (selectedProduit.stock || 0)}
                </span>
              </div>
            )}
          </label>
          
          <label className="form-control w-full">
            <div className="label"><span className="label-text font-bold">Type de motif *</span></div>
            <select
              className="select select-bordered w-full"
              value={form.reason_type}
              onChange={(e) => setForm((prev: any) => ({ ...prev, reason_type: e.target.value }))}
              required
            >
              {STOCK_ADJUSTMENT_REASONS.map(reason => (
                <option key={reason.value} value={reason.value}>{reason.label}</option>
              ))}
            </select>
          </label>
        </div>
        
        <div className="flex justify-end gap-3 pt-6 border-t border-base-200">
          <button type="button" className="btn btn-ghost px-8" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-warning px-10 shadow-lg shadow-warning/20 font-bold" disabled={!form.new_quantity}>
            ✓ Confirmer
          </button>
        </div>
      </form>
    </PremiumModal>
  );
};
