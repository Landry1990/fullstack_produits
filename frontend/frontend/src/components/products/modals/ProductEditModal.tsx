import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Rayon, Fournisseur } from '../../../types';
import { Checkbox } from '../../ui/Checkbox';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import {
  Package,
  Hash,
  AlertTriangle,
  Layers,
  DollarSign,
  Calendar,
  X
} from 'lucide-react';

interface ProductEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  form: any;
  setForm: (form: any) => void;
  rayons: Rayon[];
  fournisseurs: Fournisseur[];
  tvaList: any[];
}

export const ProductEditModal: React.FC<ProductEditModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  form,
  setForm,
  rayons,
  fournisseurs,
  tvaList
}) => {
  const { t } = useTranslation(['products', 'common']);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-base-100 rounded-xl shadow-2xl border border-base-200 w-full max-w-6xl max-h-[96vh] overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-3 border-b border-base-200 flex items-center justify-between sticky top-0 bg-base-100 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-base-content">
                {form.id ? `✏️ ${t('products:edit_title')}` : `➕ ${t('products:create_title')}`}
              </h3>
              {form.name && <p className="text-xs text-base-content/50">{form.name}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-base-content/50 hover:bg-base-200 rounded-lg transition-colors">
            <X className="size-5" />
          </button>
        </div>

        <form className="p-4 space-y-4" onSubmit={onSubmit}>
          {/* Section: Identification */}
          <div className="bg-base-50 rounded-lg border border-base-200 p-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2 flex items-center gap-1.5">
              <Hash size={12} /> Identification
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <Input
                  label={t('products:form.name')}
                  icon={<Package size={14} />}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Ex: PARACETAMOL 500MG"
                />
              </div>
              <Input
                label={t('products:form.cip1')}
                icon={<Hash size={14} />}
                className="font-mono uppercase"
                value={form.cip1}
                onChange={(e) => setForm({ ...form, cip1: e.target.value })}
                placeholder="CIP1"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label={t('products:form.cip2')}
                  size="sm"
                  className="font-mono uppercase"
                  value={form.cip2}
                  onChange={(e) => setForm({ ...form, cip2: e.target.value })}
                />
                <Input
                  label={t('products:form.cip3')}
                  size="sm"
                  className="font-mono uppercase"
                  value={form.cip3}
                  onChange={(e) => setForm({ ...form, cip3: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Section: Stock & Localisation */}
          <div className="bg-base-50 rounded-lg border border-base-200 p-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2 flex items-center gap-1.5">
              <Layers size={12} /> Stock & Localisation
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {!form.id && (
                <Input
                  label={t('products:form.initial_stock')}
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  min={0}
                  step={1}
                />
              )}
              <Select
                label={t('products:form.rayon')}
                value={form.rayon}
                onChange={(e) => setForm({ ...form, rayon: e.target.value })}
              >
                <option value="">{t('products:form.select_rayon')}</option>
                {rayons
                  .filter(r => !r.parent)
                  .map(parent => (
                    <optgroup key={parent.id} label={parent.name}>
                      <option value={parent.id}>{parent.name}</option>
                      {rayons
                        .filter(child => child.parent === parent.id)
                        .map(child => (
                          <option key={child.id} value={child.id}>↳ {child.name}</option>
                        ))
                      }
                    </optgroup>
                  ))
                }
              </Select>
              <Select
                label={t('products:form.provider')}
                value={form.fournisseur}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm({ ...form, fournisseur: val, is_supplier_exclusive: val ? form.is_supplier_exclusive : false });
                }}
              >
                <option value="">-</option>
                {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  label={t('products:form.alert')}
                  type="number"
                  icon={<AlertTriangle size={14} className="text-amber-500" />}
                  value={form.stock_alert}
                  onChange={(e) => setForm({ ...form, stock_alert: e.target.value })}
                />
                <Input
                  label={t('products:form.min')}
                  type="number"
                  size="sm"
                  value={form.stock_minimum}
                  onChange={(e) => setForm({ ...form, stock_minimum: e.target.value })}
                />
                <Input
                  label={t('products:form.max')}
                  type="number"
                  size="sm"
                  value={form.stock_maximum}
                  onChange={(e) => setForm({ ...form, stock_maximum: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Section: Tarification */}
          <div className="bg-base-50 rounded-lg border border-base-200 p-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2 flex items-center gap-1.5">
              <DollarSign size={12} /> Tarification
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input
                label={t('products:form.cost_price')}
                type="number"
                icon={<DollarSign size={14} />}
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
              />
              <Input
                label={t('products:form.selling_price')}
                type="number"
                icon={<DollarSign size={14} className="text-indigo-500" />}
                className="font-semibold text-primary"
                value={form.selling_price}
                onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
              />
              <Select
                label={t('products:form.tva')}
                value={form.tva}
                onChange={(e) => setForm({ ...form, tva: e.target.value })}
              >
                {tvaList.map(t => <option key={t.id} value={t.taux}>{t.taux}% {t.libelle ? `(${t.libelle})` : ''}</option>)}
                {!tvaList.find(t => t.taux === form.tva) && <option value={form.tva}>{form.tva}%</option>}
              </Select>
              <Input
                label={t('products:form.expiration_date')}
                type="date"
                icon={<Calendar size={14} />}
                value={form.expire_date}
                onChange={(e) => setForm({ ...form, expire_date: e.target.value })}
              />
            </div>
          </div>

          {/* Section: Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Checkbox
              checked={form.use_lot_management}
              onChange={checked => setForm({...form, use_lot_management: checked})}
              label={t('products:form.lot_management')}
              className="p-2.5 rounded-lg border bg-base-100 border-base-200 hover:bg-base-200 transition-colors text-sm"
            />
            <Checkbox
              checked={form.requires_prescription || false}
              onChange={checked => setForm({ ...form, requires_prescription: checked })}
              label={t('products:form.requires_prescription')}
              className="p-2.5 rounded-lg border bg-info/5 border-blue-100 hover:bg-info/10 transition-colors text-sm"
            />
            <Checkbox
              color="warning"
              checked={form.is_supplier_exclusive}
              disabled={!form.fournisseur}
              onChange={checked => setForm({ ...form, is_supplier_exclusive: checked })}
              label={t('products:form.supplier_exclusive')}
              className={`p-2.5 rounded-lg border transition-all text-sm ${form.fournisseur ? 'bg-warning/5 border-amber-100 hover:bg-warning/10' : 'bg-base-200 text-base-content/50 cursor-not-allowed'}`}
            />
          </div>

          {/* Section: Alerte comptoir */}
          <div className="bg-error/5 rounded-lg border border-red-100 p-3">
            <label className="block text-[10px] font-semibold text-error uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <AlertTriangle size={12} /> Message d'alerte comptoir
            </label>
            <textarea
              className="w-full rounded-lg border border-base-300 bg-white hover:border-base-300 focus:border-red-400 focus:ring-1 focus:ring-red-100 transition-all min-h-[60px] text-sm p-2 outline-none"
              placeholder="Ex: Changement de conditionnement, vérifier le code barre..."
              value={form.message_alerte || ''}
              onChange={(e) => setForm({ ...form, message_alerte: e.target.value })}
            />
            <p className="text-[10px] text-base-content/50 mt-1">Ce message s'affichera en plein écran lors du passage de ce produit en caisse.</p>
          </div>

          {/* Section: Réserve */}
          <div className="bg-indigo-50/50 rounded-lg border border-indigo-100 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Layers className="text-primary size-4" />
                <div>
                  <h4 className="text-sm font-semibold text-primary">{t('products:form.reserve_title')}</h4>
                  <p className="text-[10px] text-indigo-400 font-medium">{t('products:form.reserve_desc')}</p>
                </div>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                checked={form.has_reserve_storage}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setForm((prev: any) => ({
                    ...prev,
                    has_reserve_storage: checked,
                    capacite_rayon: (checked && (prev.capacite_rayon === '0' || !prev.capacite_rayon)) ? '50' : prev.capacite_rayon,
                    min_rayon: (checked && (prev.min_rayon === '0' || !prev.min_rayon)) ? '10' : prev.min_rayon
                  }));
                }}
              />
            </div>
            {form.has_reserve_storage && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input
                  label={t('products:form.rayon_capacity')}
                  type="number"
                  placeholder={t('products:form.placeholder_capacity')}
                  value={form.capacite_rayon}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, capacite_rayon: e.target.value }))}
                />
                <Input
                  label={t('products:form.rayon_reorder_threshold')}
                  type="number"
                  placeholder={t('products:form.placeholder_reorder')}
                  value={form.min_rayon}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, min_rayon: e.target.value }))}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-base-200">
            <button type="button" className="px-5 py-1.5 text-sm font-medium text-base-content bg-base-100 border border-base-300 rounded-lg hover:bg-base-200 transition-colors" onClick={onClose}>{t('common:cancel')}</button>
            <button type="submit" className="px-6 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-focus transition-colors shadow-sm">💾 {form.id ? t('common:save') : t('common:confirm')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
