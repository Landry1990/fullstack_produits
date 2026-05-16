import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ProduitModel, STOCK_ADJUSTMENT_REASONS } from '../../../types';
import { BarChart3, X } from 'lucide-react';
import api from '../../../services/api';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  selectedProduit: ProduitModel | null;
  form: { new_quantity: string; new_reserve_quantity: string; reason_type: string };
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
  const { t } = useTranslation(['products', 'common']);
  const [dynamicReasons, setDynamicReasons] = useState<{value: string, label: string}[]>([]);

  useEffect(() => {
    const fetchReasons = async () => {
      try {
        const res = await api.get('configuration-options/?type=STOCK_ADJ&is_active=true');
        const data = res.data.results || res.data;
        if (Array.isArray(data)) {
          const custom = data.map((opt: any) => ({
            value: opt.code,
            label: opt.label
          }));
          setDynamicReasons(custom);
        }
      } catch (err) {
        console.error("Error fetching adjustment reasons:", err);
      }
    };
    if (isOpen) fetchReasons();
  }, [isOpen]);

  const allReasons = [...STOCK_ADJUSTMENT_REASONS, ...dynamicReasons];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-gray-100 w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <BarChart3 className="size-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">{t('products:adjustment.title')}</h3>
              {selectedProduit?.name && <p className="text-xs text-gray-400">{selectedProduit.name}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="size-5" />
          </button>
        </div>

        <form className="p-6 space-y-5" onSubmit={onSubmit}>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
            <span className="text-sm text-blue-600/70 font-medium">{t('products:adjustment.current_stock')}</span>
            <div className="text-2xl font-bold text-blue-600">{selectedProduit?.stock ?? 0}</div>
          </div>

          <div className="space-y-4">
            <div className="w-full">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                {selectedProduit?.has_reserve_storage ? "Nouveau Stock Rayon" : t('products:adjustment.new_quantity')}
              </label>
              <input
                type="number"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 text-center text-xl font-bold text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 outline-none h-12 transition-all"
                value={form.new_quantity}
                onChange={(e) => setForm((prev: any) => ({ ...prev, new_quantity: e.target.value }))}
                required
                min={0}
              />
              {form.new_quantity && selectedProduit && (
                <div className="mt-2 text-center">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                    parseInt(form.new_quantity) > selectedProduit.stock ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    parseInt(form.new_quantity) < selectedProduit.stock ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-gray-100 text-gray-500 border border-gray-200'
                  }`}>
                    {t('products:adjustment.difference')} {parseInt(form.new_quantity) - (selectedProduit.stock || 0) > 0 ? '+' : ''}
                    {parseInt(form.new_quantity) - (selectedProduit.stock || 0)}
                  </span>
                </div>
              )}
            </div>

            {selectedProduit?.has_reserve_storage && (
              <div className="w-full">
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nouveau Stock Réserve</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 text-center text-xl font-bold text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 outline-none h-12 transition-all"
                  value={form.new_reserve_quantity}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, new_reserve_quantity: e.target.value }))}
                  required
                  min={0}
                />
                {form.new_reserve_quantity && (
                  <div className="mt-2 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                      parseInt(form.new_reserve_quantity) > (selectedProduit.stock_reserve || 0) ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      parseInt(form.new_reserve_quantity) < (selectedProduit.stock_reserve || 0) ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}>
                      {t('products:adjustment.difference')} {parseInt(form.new_reserve_quantity) - (selectedProduit.stock_reserve || 0) > 0 ? '+' : ''}
                      {parseInt(form.new_reserve_quantity) - (selectedProduit.stock_reserve || 0)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="w-full">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t('products:adjustment.reason_type')}</label>
              <select
                className="w-full rounded-lg border border-gray-200 bg-white text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 outline-none h-10 px-3 text-sm transition-all appearance-none"
                value={form.reason_type}
                onChange={(e) => setForm((prev: any) => ({ ...prev, reason_type: e.target.value }))}
                required
              >
                {allReasons.map(reason => (
                  <option key={reason.value} value={reason.value}>
                    {t(`products:adjustment.reasons.${reason.value}`) || reason.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-5 border-t border-gray-100">
            <button type="button" className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" onClick={onClose}>{t('common:actions.cancel')}</button>
            <button type="submit" className="px-8 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors shadow-sm" disabled={!form.new_quantity}>
              ✓ {t('common:actions.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
