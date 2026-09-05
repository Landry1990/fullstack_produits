import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ProduitModel, type StockLot, STOCK_ADJUSTMENT_REASONS } from '../../../types';
import { BarChart3, Package } from 'lucide-react';
import api from '../../../services/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '../../ui/Dialog';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { LocalizedDateInput } from '../../LocalizedDateInput';
import { Select } from '../../ui/Select';
import { logger } from '../../../utils/logger'

interface AdjustFormType {
  new_quantity: string;
  new_reserve_quantity: string;
  reason_type: string;
  stock_lot_id: string;
  new_lot_number: string;
  new_lot_expiration: string;
}

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  selectedProduit: ProduitModel | null;
  form: AdjustFormType;
  setForm: (form: (prev: AdjustFormType) => AdjustFormType) => void;
  isSubmitting?: boolean;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  selectedProduit,
  form,
  setForm,
  isSubmitting = false
}) => {
  const { t } = useTranslation(['products', 'common']);
  const [dynamicReasons, setDynamicReasons] = useState<{ value: string; label: string }[]>([]);
  const [lots, setLots] = useState<StockLot[]>([]);
  const [_loadingLots, setLoadingLots] = useState(false);

  useEffect(() => {
    const fetchReasons = async () => {
      try {
        const res = await api.get('configuration-options/?type=STOCK_ADJ&is_active=true');
        const data = res.data.results || res.data;
        if (Array.isArray(data)) {
          const custom = data.map((opt: { code: string; label: string }) => ({
            value: opt.code,
            label: opt.label
          }));
          setDynamicReasons(custom);
        }
      } catch (err) {
        logger.error("Error fetching adjustment reasons:", err);
      }
    };
    if (isOpen) fetchReasons();
  }, [isOpen]);

  useEffect(() => {
    const fetchLots = async () => {
      if (!selectedProduit?.id) { setLots([]); return; }
      setLoadingLots(true);
      try {
        const res = await api.get(`produits/${selectedProduit.id}/`, { params: { include_lots: true } });
        const productData = res.data;
        const rawLots = productData.stock_lots || [];
        const activeLots = rawLots.filter((lot: StockLot) =>
          (lot.quantity_remaining > 0) || (lot.quantity_reserved ?? 0) > 0
        );
        setLots(activeLots);
      } catch {
        setLots([]);
      } finally {
        setLoadingLots(false);
      }
    };
    if (isOpen && selectedProduit) fetchLots();
    else setLots([]);
  }, [isOpen, selectedProduit]);

  const allReasons = [...STOCK_ADJUSTMENT_REASONS, ...dynamicReasons];

  const selectedLot = lots.find(l => String(l.id) === form.stock_lot_id);
  const lotRayonQty = selectedLot?.quantity_remaining ?? 0;
  const lotReserveQty = selectedLot?.quantity_reserved ?? 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md" aria-labelledby="stock-adjust-title">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <BarChart3 className="size-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle id="stock-adjust-title">{t('products:adjustment.title')}</DialogTitle>
              <DialogDescription>{selectedProduit?.name}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          {/* Current stock display */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-center">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {selectedProduit?.has_reserve_storage ? 'Rayon' : 'Stock actuel'}
              </span>
              <div className="text-2xl font-bold text-slate-800">{selectedProduit?.stock ?? 0}</div>
            </div>
            {selectedProduit?.has_reserve_storage && (
              <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-3 text-center">
                <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Réserve</span>
                <div className="text-2xl font-bold text-indigo-700">{selectedProduit?.stock_reserve ?? 0}</div>
              </div>
            )}
          </div>

          {/* Lot selector or creation */}
          {selectedProduit?.use_lot_management && (
            <div className="space-y-3">
              {/* Toggle between existing and new lot */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, new_lot_number: '', new_lot_expiration: '', stock_lot_id: '' }))}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    !form.new_lot_number ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Lot existant
                </button>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, new_lot_number: ' ', stock_lot_id: '' }))}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    form.new_lot_number ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  + Créer un nouveau lot
                </button>
              </div>

              {/* Existing lot selector */}
              {!form.new_lot_number && lots.length > 0 && (
                <Select
                  label={t('products:adjustment.lot_concerned')}
                  value={form.stock_lot_id || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, stock_lot_id: e.target.value }))}
                >
                  <option value="">Tous les lots (global)</option>
                  {lots.map(lot => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lot || `Lot #${lot.id}`} — R: {lot.quantity_remaining} / Rés: {lot.quantity_reserved ?? 0}
                      {lot.date_expiration ? ` · Exp: ${lot.date_expiration}` : ''}
                    </option>
                  ))}
                </Select>
              )}

              {/* New lot fields */}
              {form.new_lot_number && (
                <div className="space-y-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                  <Input
                    type="text"
                    label={t('products:adjustment.lot_number')}
                    value={form.new_lot_number?.trim() === '' ? '' : form.new_lot_number}
                    onChange={(e) => setForm((prev) => ({ ...prev, new_lot_number: e.target.value }))}
                    placeholder={t('products:adjustment.lot_placeholder')}
                    required
                    size="md"
                  />
                  <LocalizedDateInput
                    label={t('products:adjustment.expiry_date')}
                    value={form.new_lot_expiration || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, new_lot_expiration: e.target.value }))}
                    size="md"
                  />
                </div>
              )}
            </div>
          )}

          {/* Lot info badge */}
          {selectedLot && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
              <Package className="size-4 shrink-0" />
              <span>
                Lot <strong>{selectedLot.lot || `#${selectedLot.id}`}</strong> —
                Rayon: {lotRayonQty} / Réserve: {lotReserveQty}
              </span>
            </div>
          )}

          {/* New shelf quantity */}
          <Input
            type="number"
            label={selectedProduit?.has_reserve_storage ? t('products:adjustment.new_shelf_stock') : t('products:adjustment.new_quantity')}
            value={form.new_quantity}
            onChange={(e) => setForm((prev) => ({ ...prev, new_quantity: e.target.value }))}
            required
            min={0}
            size="lg"
            className="text-center text-xl font-bold"
          />
          {form.new_quantity && selectedProduit && (
            <div className="text-center -mt-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                parseInt(form.new_quantity) > (selectedProduit.stock || 0) ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                parseInt(form.new_quantity) < (selectedProduit.stock || 0) ? 'bg-red-50 text-red-700 border border-red-100' :
                'bg-slate-100 text-slate-500 border border-slate-200'
              }`}>
                {t('products:adjustment.difference')} {parseInt(form.new_quantity) - (selectedProduit.stock || 0) > 0 ? '+' : ''}
                {parseInt(form.new_quantity) - (selectedProduit.stock || 0)}
              </span>
            </div>
          )}

          {/* New reserve quantity */}
          {selectedProduit?.has_reserve_storage && (
            <>
              <Input
                type="number"
                label={t('products:adjustment.new_reserve_stock')}
                value={form.new_reserve_quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, new_reserve_quantity: e.target.value }))}
                required
                min={0}
                size="lg"
                className="text-center text-xl font-bold"
              />
              {form.new_reserve_quantity && (
                <div className="text-center -mt-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                    parseInt(form.new_reserve_quantity) > (selectedProduit.stock_reserve || 0) ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    parseInt(form.new_reserve_quantity) < (selectedProduit.stock_reserve || 0) ? 'bg-red-50 text-red-700 border border-red-100' :
                    'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    {t('products:adjustment.difference')} {parseInt(form.new_reserve_quantity) - (selectedProduit.stock_reserve || 0) > 0 ? '+' : ''}
                    {parseInt(form.new_reserve_quantity) - (selectedProduit.stock_reserve || 0)}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Reason selector */}
          <Select
            label={t('products:adjustment.reason_type')}
            value={form.reason_type}
            onChange={(e) => setForm((prev) => ({ ...prev, reason_type: e.target.value }))}
            required
          >
            {allReasons.map(reason => (
              <option key={reason.value} value={reason.value}>
                {t(`products:adjustment.reasons.${reason.value}`) || reason.label}
              </option>
            ))}
          </Select>

          <DialogFooter className="pt-4 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={!form.new_quantity || isSubmitting}>
              {isSubmitting ? t('common:actions.processing', { defaultValue: 'Traitement…' }) : t('common:actions.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
