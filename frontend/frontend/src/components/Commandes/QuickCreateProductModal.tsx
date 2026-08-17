import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { Zap, Pencil, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useTVA } from '../../hooks/useTVA';
import { normalizeNumberInput } from '../../utils/formatters';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import { Select } from '../shadcn/select';
import type { ProduitModel, Rayon } from '../../types';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '../shadcn/dialog';

interface QuickCreateProductModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (produit: ProduitModel) => void;
  rayons?: Rayon[];
  editProduct?: ProduitModel | null;
}

export default function QuickCreateProductModal({
  open,
  onClose,
  onCreated,
  rayons: rayonsProp,
  editProduct,
}: QuickCreateProductModalProps) {
  const { t } = useTranslation(['orders', 'products', 'common']);
  const { tvaList } = useTVA();
  const isEditMode = !!editProduct;

  const [localRayons, setLocalRayons] = useState<Rayon[]>([]);

  useEffect(() => {
    if (open && !rayonsProp?.length) {
      api.get('rayons/').then(res => setLocalRayons(res.data?.results || res.data || [])).catch(() => {});
    }
  }, [open, rayonsProp?.length]);

  const rayons = rayonsProp?.length ? rayonsProp : localRayons;

  const [name, setName] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [tva, setTva] = useState('19.25');
  const [rayon, setRayon] = useState('');
  const [cip1, setCip1] = useState('');
  const [cip2, setCip2] = useState('');
  const [cip3, setCip3] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editProduct) {
        setName(editProduct.name || '');
        setCostPrice(editProduct.cost_price || '');
        setSellingPrice(editProduct.selling_price || '');
        setTva(String(editProduct.tva ?? '19.25'));
        setRayon(editProduct.rayon ? String(editProduct.rayon) : '');
        setCip1(editProduct.cip1 || '');
        setCip2(editProduct.cip2 || '');
        setCip3(editProduct.cip3 || '');
      } else {
        setName('');
        setCostPrice('');
        setSellingPrice('');
        setTva(tvaList.find(t => t.taux === '19.25')?.taux || '19.25');
        setRayon('');
        setCip1('');
        setCip2('');
        setCip3('');
      }
      setError(null);
      setLoading(false);
    }
  }, [open, editProduct, tvaList]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim().toUpperCase();
    if (trimmedName.length < 2) {
      setError(t('products:form.validation.name_min'));
      return;
    }

    const cost = normalizeNumberInput(costPrice);
    const sell = normalizeNumberInput(sellingPrice);

    if (cost < 0) {
      setError(t('products:form.validation.cost_price_negative'));
      return;
    }
    if (sell <= 0) {
      setError(t('products:form.validation.selling_price_positive'));
      return;
    }
    if (sell < cost) {
      setError(t('products:form.validation.selling_below_cost'));
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: trimmedName,
        cost_price: costPrice.trim(),
        selling_price: sellingPrice.trim(),
        tva: tva || '19.25',
        rayon: rayon ? parseInt(rayon, 10) : null,
        cip1: cip1.trim() || null,
        cip2: cip2.trim() || null,
        cip3: cip3.trim() || null,
      };

      let data: ProduitModel;
      if (isEditMode && editProduct) {
        const res = await api.patch<ProduitModel>(`produits/${editProduct.id}/`, payload);
        data = res.data;
        toast.success(t('orders:messages.quick_product_updated', { name: data.name }));
      } else {
        payload.stock = 0;
        payload.stock_alert = 0;
        payload.stock_minimum = 0;
        payload.stock_maximum = 0;
        payload.use_lot_management = true;
        const res = await api.post<ProduitModel>('produits/', payload);
        data = res.data;
        toast.success(t('orders:messages.quick_product_created', { name: data.name }));
      }
      onCreated(data);
      onClose();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: unknown } };
      if (anyErr.response?.data) {
        const detail = anyErr.response.data;
        if (typeof detail === 'string') {
          setError(detail);
        } else if (typeof detail === 'object') {
          const entries = Object.entries(detail as Record<string, unknown>);
          setError(entries.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | '));
        }
      } else {
        setError(t('products:form.validation.unknown_error'));
      }
    } finally {
      setLoading(false);
    }
  }

  const Icon = isEditMode ? Pencil : Zap;
  const title = isEditMode
    ? t('orders:quick_create.edit_title')
    : t('orders:quick_create.title');
  const submitLabel = isEditMode
    ? t('common:save')
    : t('orders:quick_create.submit');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${isEditMode ? 'bg-blue-50' : 'bg-emerald-50'}`}>
            <Icon className={`size-5 ${isEditMode ? 'text-blue-600' : 'text-emerald-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <DialogHeader className="text-left space-y-0 p-0">
              <DialogTitle className="text-base font-bold text-slate-800">{title}</DialogTitle>
            </DialogHeader>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          <DialogDescription className="sr-only">
            {isEditMode ? t('orders:quick_create.edit_title') : t('orders:quick_create.title')}
          </DialogDescription>

          <div>
            <label htmlFor="quick-product-name" className="block text-xs font-semibold text-slate-600 mb-1.5">
              {t('products:form.name')} <span className="text-red-500">*</span>
            </label>
            <Input
              id="quick-product-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('orders:quick_create.name_placeholder')}
              className="h-11 text-sm"
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="quick-product-cost" className="block text-xs font-semibold text-slate-600 mb-1.5">
                {t('products:form.cost_price')} <span className="text-red-500">*</span>
              </label>
              <Input
                id="quick-product-cost"
                type="number"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0"
                className="h-11 text-sm"
                min={0}
                step="any"
                required
              />
            </div>
            <div>
              <label htmlFor="quick-product-sell" className="block text-xs font-semibold text-slate-600 mb-1.5">
                {t('products:form.selling_price')} <span className="text-red-500">*</span>
              </label>
              <Input
                id="quick-product-sell"
                type="number"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0"
                className="h-11 text-sm"
                min={0}
                step="any"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="quick-product-tva" className="block text-xs font-semibold text-slate-600 mb-1.5">
                {t('products:form.tva')}
              </label>
              <Select
                id="quick-product-tva"
                value={tva}
                onChange={(e) => setTva(e.target.value)}
                className="h-11 text-sm"
              >
                {tvaList.map(t => (
                  <option key={t.id} value={t.taux}>{t.taux}%</option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="quick-product-rayon" className="block text-xs font-semibold text-slate-600 mb-1.5">
                {t('products:form.rayon')}
              </label>
              <Select
                id="quick-product-rayon"
                value={rayon}
                onChange={(e) => setRayon(e.target.value)}
                className="h-11 text-sm"
              >
                <option value="">{t('products:form.select_rayon')}</option>
                {rayons.flatMap(parent => {
                  if (parent.parent) return [];
                  const children = rayons.filter(child => child.parent === parent.id);
                  return [(
                    <optgroup key={parent.id} label={parent.name}>
                      {children.length > 0 ? children.map(child => (
                        <option key={child.id} value={child.id}>{child.name}</option>
                      )) : <option value={parent.id}>{parent.name}</option>}
                    </optgroup>
                  )];
                })}
              </Select>
            </div>
          </div>

          <div>
            <label htmlFor="quick-product-cip1" className="block text-xs font-semibold text-slate-600 mb-1.5">
              {t('products:form.cip1')}
            </label>
            <Input
              id="quick-product-cip1"
              type="text"
              value={cip1}
              onChange={(e) => setCip1(e.target.value)}
              placeholder="Code CIP 1"
              className="h-11 text-sm font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="quick-product-cip2" className="block text-xs font-semibold text-slate-600 mb-1.5">
                {t('products:form.cip2')}
              </label>
              <Input
                id="quick-product-cip2"
                type="text"
                value={cip2}
                onChange={(e) => setCip2(e.target.value)}
                placeholder="CIP 2"
                className="h-11 text-sm font-mono"
              />
            </div>
            <div>
              <label htmlFor="quick-product-cip3" className="block text-xs font-semibold text-slate-600 mb-1.5">
                {t('products:form.cip3')}
              </label>
              <Input
                id="quick-product-cip3"
                type="text"
                value={cip3}
                onChange={(e) => setCip3(e.target.value)}
                placeholder="CIP 3"
                className="h-11 text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="h-10 px-4">
              {t('common:cancel')}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className={`h-10 px-6 text-white ${isEditMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            >
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Icon className="size-4 mr-2" />}
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
