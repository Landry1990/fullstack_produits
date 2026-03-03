import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Rayon, Fournisseur } from '../../../types';
import PremiumModal from '../../common/PremiumModal';

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
  useTranslation();

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title="✏️ Modifier le Produit"
      subtitle={form.name}
      maxWidth="max-w-4xl"
      icon={<span>✏️</span>}
      gradientFrom="warning/20"
      gradientTo="primary/20"
    >
      <form className="p-6 space-y-6" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-base-content/50 border-b pb-2">Informations Générales</h4>
            <label className="form-control w-full">
              <div className="label"><span className="label-text font-semibold">Nom du produit *</span></div>
              <input
                type="text"
                className="input input-bordered w-full focus:input-primary"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
               <label className="form-control w-full">
                  <div className="label"><span className="label-text font-semibold">CIP1</span></div>
                  <input className="input input-bordered w-full font-mono" value={form.cip1}
                    onChange={(e) => setForm({ ...form, cip1: e.target.value })} />
               </label>
               <div className="grid grid-cols-2 gap-2">
                  <label className="form-control w-full">
                    <div className="label"><span className="label-text text-xs font-semibold">CIP2</span></div>
                    <input className="input input-bordered input-sm w-full font-mono" value={form.cip2}
                      onChange={(e) => setForm({ ...form, cip2: e.target.value })} />
                  </label>
                  <label className="form-control w-full">
                    <div className="label"><span className="label-text text-xs font-semibold">CIP3</span></div>
                    <input className="input input-bordered input-sm w-full font-mono" value={form.cip3}
                      onChange={(e) => setForm({ ...form, cip3: e.target.value })} />
                  </label>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <label className="form-control w-full">
                  <div className="label"><span className="label-text font-semibold">Alerte stock</span></div>
                  <input type="number" className="input input-bordered w-full" value={form.stock_alert}
                    onChange={(e) => setForm({ ...form, stock_alert: e.target.value })} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="form-control w-full">
                    <div className="label"><span className="label-text text-[10px] font-semibold">Min</span></div>
                    <input type="number" className="input input-bordered input-sm w-full" value={form.stock_minimum}
                      onChange={(e) => setForm({ ...form, stock_minimum: e.target.value })} />
                  </label>
                  <label className="form-control w-full">
                    <div className="label"><span className="label-text text-[10px] font-semibold">Max</span></div>
                    <input type="number" className="input input-bordered input-sm w-full" value={form.stock_maximum}
                      onChange={(e) => setForm({ ...form, stock_maximum: e.target.value })} />
                  </label>
                </div>
            </div>

               <label className="form-control w-full">
                  <div className="label"><span className="label-text font-semibold">Fournisseur</span></div>
                  <select className="select select-bordered w-full" value={form.fournisseur}
                     onChange={(e) => {
                       const val = e.target.value;
                       setForm({ 
                         ...form, 
                         fournisseur: val,
                         is_supplier_exclusive: val ? form.is_supplier_exclusive : false
                       });
                     }}>
                     <option value="">—</option>
                     {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
               </label>
               <label className="form-control w-full">
                  <div className="label"><span className="label-text font-semibold text-xs">Rayon</span></div>
                  <select className="select select-bordered w-full" value={form.rayon}
                     onChange={(e) => setForm({ ...form, rayon: e.target.value })}>
                     <option value="">Sélectionner un rayon</option>
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
                  </select>
               </label>
          </div>

          <div className="space-y-4">
             <h4 className="text-sm font-bold uppercase tracking-wider text-base-content/50 border-b pb-2">Prix et Marge</h4>
             <div className="grid grid-cols-2 gap-4">
                <label className="form-control w-full">
                  <div className="label"><span className="label-text font-semibold">Prix Revient</span></div>
                  <div className="join w-full">
                    <input type="number" className="input input-bordered join-item w-full" value={form.cost_price}
                      onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
                    <span className="join-item btn btn-disabled bg-base-200">F</span>
                  </div>
                </label>
                <label className="form-control w-full">
                  <div className="label"><span className="label-text font-semibold text-primary">Prix Vente</span></div>
                  <div className="join w-full">
                    <input type="number" className="input input-bordered join-item w-full font-bold text-primary" value={form.selling_price}
                      onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
                    <span className="join-item btn btn-disabled bg-base-200">F</span>
                  </div>
                </label>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <label className="form-control w-full">
                  <div className="label"><span className="label-text font-semibold">TVA (%)</span></div>
                  <select
                    className="select select-bordered w-full"
                    value={form.tva}
                    onChange={(e) => setForm({ ...form, tva: e.target.value })}
                  >
                    {tvaList.map(t => <option key={t.id} value={t.taux}>{t.taux}% {t.libelle ? `(${t.libelle})` : ''}</option>)}
                    {!tvaList.find(t => t.taux === form.tva) && (
                      <option value={form.tva}>{form.tva}%</option>
                    )}
                  </select>
                </label>
                <label className="form-control w-full">
                  <div className="label"><span className="label-text font-semibold">Expiration</span></div>
                  <input type="date" className="input input-bordered w-full" value={form.expire_date}
                    onChange={(e) => setForm({ ...form, expire_date: e.target.value })} />
                </label>
             </div>

             <div className="form-control">
                <label className="label cursor-pointer justify-start gap-4 p-4 rounded-xl border bg-base-100">
                  <input type="checkbox" className="checkbox checkbox-primary" checked={form.use_lot_management}
                    onChange={(e) => setForm({...form, use_lot_management: e.target.checked})} />
                  <div>
                    <span className="label-text font-bold">Gestion par lots FIFO</span>
                    <p className="text-[10px] opacity-60">Recommandé pour médicaments et produits périssables</p>
                  </div>
                </label>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border bg-info/5 border-info/20">
              <label className="label cursor-pointer justify-start gap-4">
                <input type="checkbox" className="checkbox checkbox-primary" checked={form.requires_prescription || false}
                  onChange={(e) => setForm({ ...form, requires_prescription: e.target.checked })} />
                <span className="label-text font-bold">Ordonnance Requise</span>
              </label>
            </div>
            <div className={`p-4 rounded-xl border transition-all ${form.fournisseur ? 'bg-warning/5 border-warning/20' : 'bg-base-200 opacity-50'}`}>
              <label className="label cursor-pointer justify-start gap-4">
                <input type="checkbox" className="checkbox checkbox-warning" checked={form.is_supplier_exclusive} 
                  disabled={!form.fournisseur}
                  onChange={(e) => setForm({ ...form, is_supplier_exclusive: e.target.checked })} />
                <span className="label-text font-bold">Exclusivité Fournisseur</span>
              </label>
            </div>
        </div>

        <div className="mt-6 p-4 rounded-xl border-2 border-primary/20 bg-primary/5">
           <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-primary">Réserve et Réapprovisionnement</h4>
                <p className="text-xs opacity-60">Gérer le stock tampon et les seuils de rayon</p>
              </div>
              <input 
                type="checkbox" 
                className="toggle toggle-primary"
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
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-semibold">Capacité Rayon</span>
                  </div>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    placeholder="Ex: 50"
                    value={form.capacite_rayon}
                    onChange={(e) => setForm((prev: any) => ({ ...prev, capacite_rayon: e.target.value }))}
                  />
                  <div className="label">
                    <span className="label-text-alt text-xs opacity-60">Quantité max. exposée</span>
                  </div>
                </label>

                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-semibold">Seuil Réappro Rayon (Min)</span>
                  </div>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    placeholder="Ex: 10"
                    value={form.min_rayon}
                    onChange={(e) => setForm((prev: any) => ({ ...prev, min_rayon: e.target.value }))}
                  />
                  <div className="label">
                    <span className="label-text-alt text-xs opacity-60">Avertir si stock rayon ≤ seuil</span>
                  </div>
                </label>
             </div>
           )}
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-base-200">
          <button type="button" className="btn btn-ghost px-8" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-primary px-10 shadow-lg shadow-primary/20">💾 Enregistrer</button>
        </div>
      </form>
    </PremiumModal>
  );
};
