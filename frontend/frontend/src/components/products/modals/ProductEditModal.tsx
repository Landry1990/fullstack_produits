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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-base-100 rounded-xl shadow-2xl border border-base-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-base-200 flex items-center justify-between">
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

        <form className="p-6 space-y-6" onSubmit={onSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-base-content/50 border-b border-base-200 pb-2">{t('products:form.general_info')}</h4>

              <Input
                label={t('products:form.name')}
                icon={<Package size={16} />}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Ex: PARACETAMOL 500MG"
              />

              <div className="grid grid-cols-2 gap-4">
                 <Input
                   label={t('products:form.cip1')}
                   icon={<Hash size={16} />}
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

              <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t('products:form.alert')}
                    type="number"
                    icon={<AlertTriangle size={16} className="text-amber-500" />}
                    value={form.stock_alert}
                    onChange={(e) => setForm({ ...form, stock_alert: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-2">
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

              <Select
                label={t('products:form.provider')}
                value={form.fournisseur}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm({
                    ...form,
                    fournisseur: val,
                    is_supplier_exclusive: val ? form.is_supplier_exclusive : false
                  });
                }}
              >
                <option value="">-</option>
                {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>

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
                          <option key={child.id} value={child.id}>
                            ↳ {child.name}
                          </option>
                        ))
                      }
                    </optgroup>
                  ))
                }
              </Select>

              <div className="pt-4 border-t border-red-100">
                 <div className="w-full">
                    <label className="block text-[10px] font-semibold text-error uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> Message d'alerte comptoir
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-base-300 bg-error/10/30 hover:border-base-300 focus:border-red-400 focus:ring-2 focus:ring-red-50 transition-all min-h-[80px] text-sm p-3 outline-none"
                      placeholder="Ex: Changement de conditionnement, vérifier le code barre..."
                      value={form.message_alerte || ''}
                      onChange={(e) => setForm({ ...form, message_alerte: e.target.value })}
                    />
                    <p className="text-[10px] text-base-content/50 mt-1 italic">Ce message s'affichera en plein écran lors du passage de ce produit en caisse.</p>
                 </div>
              </div>
            </div>

            <div className="space-y-4">
               <h4 className="text-xs font-semibold uppercase tracking-wider text-base-content/50 border-b border-base-200 pb-2">{t('products:form.price_margin')}</h4>

               <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t('products:form.cost_price')}
                    type="number"
                    icon={<DollarSign size={16} />}
                    value={form.cost_price}
                    onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                  />
                  <Input
                    label={t('products:form.selling_price')}
                    type="number"
                    icon={<DollarSign size={16} className="text-indigo-500" />}
                    className="font-semibold text-primary"
                    value={form.selling_price}
                    onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                  />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <Select
                    label={t('products:form.tva')}
                    value={form.tva}
                    onChange={(e) => setForm({ ...form, tva: e.target.value })}
                  >
                    {tvaList.map(t => <option key={t.id} value={t.taux}>{t.taux}% {t.libelle ? `(${t.libelle})` : ''}</option>)}
                    {!tvaList.find(t => t.taux === form.tva) && (
                      <option value={form.tva}>{form.tva}%</option>
                    )}
                  </Select>
                  <Input
                    label={t('products:form.expiration_date')}
                    type="date"
                    icon={<Calendar size={16} />}
                    value={form.expire_date}
                    onChange={(e) => setForm({ ...form, expire_date: e.target.value })}
                  />
               </div>

               <div className="pt-2">
                  <Checkbox
                    checked={form.use_lot_management}
                    onChange={checked => setForm({...form, use_lot_management: checked})}
                    label={t('products:form.lot_management')}
                    className="p-3 rounded-lg border bg-base-200 border-base-300 w-full hover:bg-base-200 transition-colors"
                  />
                  <p className="text-[10px] text-base-content/50 ml-8 mt-1">{t('products:form.lot_management_desc')}</p>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Checkbox
                  checked={form.requires_prescription || false}
                  onChange={checked => setForm({ ...form, requires_prescription: checked })}
                  label={t('products:form.requires_prescription')}
                  className="p-3 rounded-lg border bg-info/10/50 border-blue-100 hover:bg-info/10 transition-colors"
                />
                <Checkbox
                  color="warning"
                  checked={form.is_supplier_exclusive}
                  disabled={!form.fournisseur}
                  onChange={checked => setForm({ ...form, is_supplier_exclusive: checked })}
                  label={t('products:form.supplier_exclusive')}
                  className={`p-3 rounded-lg border transition-all ${form.fournisseur ? 'bg-warning/10/50 border-amber-100 hover:bg-warning/10' : 'bg-base-200 text-base-content/50 cursor-not-allowed'}`}
                />
          </div>

          <div className="p-5 rounded-xl border border-indigo-100 bg-primary/10/30">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Layers className="text-primary size-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-primary">{t('products:form.reserve_title')}</h4>
                    <p className="text-[10px] text-indigo-400 font-medium">{t('products:form.reserve_desc')}</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-md"
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
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="flex justify-end gap-3 pt-6 border-t border-base-200">
            <button type="button" className="px-6 py-2 text-sm font-medium text-base-content bg-base-100 border border-base-300 rounded-lg hover:bg-base-200 transition-colors" onClick={onClose}>{t('common:cancel')}</button>
            <button type="submit" className="px-8 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-focus transition-colors shadow-sm">💾 {form.id ? t('common:save') : t('common:confirm')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
