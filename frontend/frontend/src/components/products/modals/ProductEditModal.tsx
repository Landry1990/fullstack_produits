import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Rayon, Fournisseur } from '../../../types';
import PremiumModal from '../../common/PremiumModal';
import { Checkbox } from '../../ui/Checkbox';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { 
  Package, 
  Hash, 
  AlertTriangle, 
  Truck, 
  Layers, 
  DollarSign, 
  Percent, 
  Calendar,
  MessageSquare
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

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={form.id ? `✏️ ${t('products:edit_title')}` : `➕ ${t('products:create_title')}`}
      subtitle={form.name}
      maxWidth="max-w-4xl"
      icon={<Package className="text-primary" />}
      gradientFrom={form.id ? "warning/20" : "success/20"}
      gradientTo="primary/20"
    >
      <form className="p-6 space-y-6" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-base-content/30 border-b border-base-200 pb-2">{t('products:form.general_info')}</h4>
            
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
                  icon={<AlertTriangle size={16} className="text-warning" />}
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

            <div className="pt-4 border-t border-error/10">
               <div className="form-control w-full">
                  <div className="label pt-0 px-1">
                    <span className="label-text font-black text-error uppercase text-[10px] tracking-widest flex items-center gap-2">
                      <AlertTriangle size={12} /> Message d'alerte comptoir
                    </span>
                  </div>
                  <textarea 
                    className="textarea textarea-bordered w-full textarea-error bg-error/5 focus:bg-base-100 transition-all rounded-xl min-h-[80px] text-sm font-medium focus:shadow-[0_0_0_4px_rgba(239,68,68,0.1)]"
                    placeholder="Ex: Changement de conditionnement, vérifier le code barre..."
                    value={form.message_alerte || ''}
                    onChange={(e) => setForm({ ...form, message_alerte: e.target.value })}
                  />
                  <div className="label">
                    <span className="label-text-alt text-[10px] opacity-40 italic">Ce message s'affichera en plein écran lors du passage de ce produit en caisse.</span>
                  </div>
               </div>
            </div>
          </div>

          <div className="space-y-4">
             <h4 className="text-xs font-black uppercase tracking-widest text-base-content/30 border-b border-base-200 pb-2">{t('products:form.price_margin')}</h4>
             
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
                  icon={<DollarSign size={16} className="text-primary" />}
                  className="font-black text-primary"
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
                  className="p-4 rounded-xl border bg-base-200/50 border-base-300 w-full hover:bg-base-200 transition-colors"
                />
                <p className="text-[10px] opacity-40 ml-10 mt-1">{t('products:form.lot_management_desc')}</p>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Checkbox 
                checked={form.requires_prescription || false}
                onChange={checked => setForm({ ...form, requires_prescription: checked })}
                label={t('products:form.requires_prescription')}
                className="p-4 rounded-xl border bg-info/5 border-info/20 hover:bg-info/10 transition-colors"
              />
              <Checkbox 
                color="warning"
                checked={form.is_supplier_exclusive} 
                disabled={!form.fournisseur}
                onChange={checked => setForm({ ...form, is_supplier_exclusive: checked })}
                label={t('products:form.supplier_exclusive')}
                className={`p-4 rounded-xl border transition-all ${form.fournisseur ? 'bg-warning/5 border-warning/20 hover:bg-warning/10' : 'bg-base-200 opacity-50 cursor-not-allowed'}`}
              />
        </div>

        <div className="mt-6 p-6 rounded-2xl border border-primary/20 bg-primary/5 shadow-inner">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Layers className="text-primary size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-primary leading-none mb-1">{t('products:form.reserve_title')}</h4>
                  <p className="text-[10px] opacity-50 font-medium">{t('products:form.reserve_desc')}</p>
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
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                <Input
                  label={t('products:form.rayon_capacity')}
                  type="number"
                  placeholder={t('products:form.placeholder_capacity')}
                  value={form.capacite_rayon}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, capacite_rayon: e.target.value }))}
                  className="bg-base-100"
                />

                <Input
                  label={t('products:form.rayon_reorder_threshold')}
                  type="number"
                  placeholder={t('products:form.placeholder_reorder')}
                  value={form.min_rayon}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, min_rayon: e.target.value }))}
                  className="bg-base-100"
                />
             </div>
           )}
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-base-200">
          <button type="button" className="btn btn-ghost px-8" onClick={onClose}>{t('common:cancel')}</button>
          <button type="submit" className="btn btn-primary px-10 shadow-lg shadow-primary/20">💾 {form.id ? t('common:save') : t('common:confirm')}</button>
        </div>
      </form>
    </PremiumModal>
  );
};
