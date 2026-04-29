import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import api from '../services/api';
import type { ProduitForm, ProduitModel, Rayon, Fournisseur, Forme, Groupe } from '../types';
import { useTVA } from '../hooks/useTVA';
import PremiumModal from './common/PremiumModal';
import { normalizeNumberInput } from '../utils/formatters';
import { productSchema } from '../schemas/productSchema';

interface ProduitFormModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (produit: ProduitModel) => void;
  produitsEndpoint: string;
  initialData?: Partial<ProduitForm>;
  title?: string;
  rayons: Rayon[];
  fournisseurs: Fournisseur[];
  formes: Forme[];
  groupes?: Groupe[]; // Optional to avoid breaking
}

export default function ProduitFormModal({
  open,
  onClose,
  onCreated,
  produitsEndpoint,
  initialData,
  title,
  rayons = [],
  fournisseurs = [],
  formes = [],
  groupes = [],
}: ProduitFormModalProps) {
  const { t } = useTranslation(['products', 'common']);
  const titleText = title || t('products:create_title');
  const { tvaList, loading: loadingTVA } = useTVA();
  
  const [form, setForm] = useState<ProduitForm>({
    name: '', stock: '', cost_price: '', selling_price: '', cip1: '', cip2: '', cip3: '',
    expire_date: '', stock_alert: '', stock_minimum: '', stock_maximum: '', tva: '19.25',
    rayon: '', fournisseur: '', description: '', unite_mesure: '', is_perissable: false,
    forme: '', groupe: '',
    use_lot_management: true, requires_prescription: false,
    surveillance_category: 'NONE', is_supplier_exclusive: false, has_reserve_storage: false,
    capacite_rayon: '0', min_rayon: '0',
    is_chronic: false,
    default_treatment_days: '30',
    message_alerte: '',
    ...initialData,
  });

  // Effect to set default TVA from API if not set in initialData
  useEffect(() => {
    if (!initialData?.tva && tvaList.length > 0) {
       // Prefer 19.25 if exists, else first active one
       const defaultTva = tvaList.find(t => t.taux === '19.25') || tvaList.find(t => t.is_active);
       if (defaultTva) {
         setForm(prev => ({ ...prev, tva: defaultTva.taux }));
       }
    }
  }, [tvaList, initialData?.tva]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calcul des marges en temps réel
  const costPrice = normalizeNumberInput(form.cost_price);
  const sellingPrice = normalizeNumberInput(form.selling_price);
  
  let tauxMarge = 0;
  let pourcMarge = 0;

  if (costPrice > 0) {
    tauxMarge = sellingPrice / costPrice;
  }
  
  if (sellingPrice > 0) {
    pourcMarge = ((sellingPrice - costPrice) / sellingPrice) * 100;
  }


  function formatBackendErrors(data: unknown): string {
    if (data == null) return t('common:messages.server_error');
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
      try {
        const entries = Object.entries(data as Record<string, unknown>);
        const parts = entries.map(([field, messages]) => {
          if (Array.isArray(messages)) return `${field}: ${messages.join(', ')}`;
          if (typeof messages === 'string') return `${field}: ${messages}`;
          return `${field}: ${JSON.stringify(messages)}`;
        });
        return parts.join(' | ');
      } catch {
        return JSON.stringify(data);
      }
    }
    return String(data);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const stockValue = parseInt(form.stock, 10);
      const payload = {
        name: form.name.trim().toUpperCase(),
        description: '',
        stock: Number.isFinite(stockValue) ? stockValue : undefined,
        cost_price: form.cost_price.trim(),
        selling_price: form.selling_price.trim(),
        cip1: form.cip1.trim() || null,
        cip2: form.cip2.trim() || null,
        cip3: form.cip3.trim() || null,
        expire_date: form.expire_date.trim() || null,
        stock_alert: form.stock_alert ? parseInt(form.stock_alert, 10) : 0,
        stock_minimum: form.stock_minimum ? parseInt(form.stock_minimum, 10) : 0,
        stock_maximum: form.stock_maximum ? parseInt(form.stock_maximum, 10) : 0,
        rayon: form.rayon ? parseInt(form.rayon, 10) : null,
        fournisseur: form.fournisseur ? parseInt(form.fournisseur, 10) : null,
        forme: form.forme ? parseInt(form.forme, 10) : null,
        groupe: form.groupe ? parseInt(form.groupe, 10) : null,
        tva: form.tva || '19.25',
        requires_prescription: form.requires_prescription || false,
        surveillance_category: form.surveillance_category || 'NONE',
        is_supplier_exclusive: form.is_supplier_exclusive || false,
        use_lot_management: form.use_lot_management,
        is_chronic: form.is_chronic || false,
        default_treatment_days: normalizeNumberInput(form.default_treatment_days || '', { min: 1 }),
        has_reserve_storage: form.has_reserve_storage || false,
        capacite_rayon: normalizeNumberInput(form.capacite_rayon || '', { min: 0 }),
        min_rayon: normalizeNumberInput(form.min_rayon || '', { min: 0 }),
        message_alerte: form.message_alerte?.trim() || null,
      };

      const validation = productSchema.safeParse(payload);
      
      if (!validation.success) {
        const errorMsg = validation.error.errors
          .map(err => `${err.path.join('.')}: ${err.message}`)
          .join(' | ');
        setError(errorMsg);
        setLoading(false);
        return;
      }

      // Use the validated and coerced data
      const cleanPayload = validation.data;

      const { data } = await api.post<ProduitModel>(produitsEndpoint, cleanPayload);
      onCreated(data); // Callback to parent
      onClose(); // Close modal on success
    } catch (err: unknown) {
      if ((err as any).response) {
        const detail = err.response?.data ?? err.message;
        setError(typeof detail === 'string' ? detail : formatBackendErrors(detail));
      } else {
        setError(t('products:form.validation.unknown_error'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <PremiumModal
      isOpen={open}
      onClose={onClose}
      title={titleText}
      maxWidth="max-w-4xl"
      icon={<span>➕</span>}
      gradientFrom="primary/20"
      gradientTo="secondary/20"
    >
      <form className="p-6 space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div role="alert" className="alert alert-error shadow-sm mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-base-content/50 border-b pb-2">{t('products:form.general_info')}</h4>
            <label className="form-control w-full">
              <div className="label"><span className="label-text font-semibold">{t('products:form.name')}</span></div>
              <input
                type="text"
                className="input input-bordered w-full focus:input-primary"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
                autoFocus
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="form-control w-full">
                <div className="label"><span className="label-text font-semibold">{t('products:form.initial_stock')}</span></div>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  value={form.stock}
                  onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))}
                  min={0}
                  step={1}
                  required
                />
              </label>
              <label className="form-control w-full">
                <div className="label"><span className="label-text font-semibold text-xs">{t('products:form.rayon')}</span></div>
                <select 
                  className="select select-bordered w-full" 
                  value={form.rayon}
                  onChange={(e) => setForm((f) => ({ ...f, rayon: e.target.value }))}
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
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="form-control w-full">
                <div className="label"><span className="label-text font-semibold">{t('products:form.cip1')}</span></div>
                <input 
                  className="input input-bordered w-full font-mono" 
                  value={form.cip1}
                  onChange={(e) => setForm((p) => ({ ...p, cip1: e.target.value }))} 
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="form-control w-full">
                  <div className="label"><span className="label-text text-xs font-semibold">{t('products:form.cip2')}</span></div>
                  <input className="input input-bordered input-sm w-full font-mono" value={form.cip2}
                    onChange={(e) => setForm((p) => ({ ...p, cip2: e.target.value }))} />
                </label>
                <label className="form-control w-full">
                  <div className="label"><span className="label-text text-xs font-semibold">{t('products:form.cip3')}</span></div>
                  <input className="input input-bordered input-sm w-full font-mono" value={form.cip3}
                    onChange={(e) => setForm((p) => ({ ...p, cip3: e.target.value }))} />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="form-control w-full">
                <div className="label"><span className="label-text font-semibold">{t('products:form.provider')}</span></div>
                <select 
                  className="select select-bordered w-full" 
                  value={form.fournisseur}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((p) => ({ 
                      ...p, 
                      fournisseur: val, 
                      is_supplier_exclusive: val ? p.is_supplier_exclusive : false 
                    }));
                  }}
                >
                  <option value="">—</option>
                  {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="form-control w-full">
                <div className="label"><span className="label-text text-xs font-semibold">{t('products:form.alert')}</span></div>
                <input 
                  type="number" 
                  className="input input-bordered input-sm w-full" 
                  value={form.stock_alert}
                  onChange={(e) => setForm((p) => ({ ...p, stock_alert: e.target.value }))} 
                  min={0} 
                  step={1} 
                />
              </label>
              <label className="form-control w-full">
                <div className="label"><span className="label-text text-xs">{t('products:form.min')}</span></div>
                <input 
                  type="number" 
                  className="input input-bordered input-sm w-full" 
                  value={form.stock_minimum}
                  onChange={(e) => setForm((p) => ({ ...p, stock_minimum: e.target.value }))} 
                  min={0} 
                  step={1} 
                />
              </label>
              <label className="form-control w-full">
                <div className="label"><span className="label-text text-xs">{t('products:form.max')}</span></div>
                <input 
                  type="number" 
                  className="input input-bordered input-sm w-full" 
                  value={form.stock_maximum}
                  onChange={(e) => setForm((p) => ({ ...p, stock_maximum: e.target.value }))} 
                  min={0} 
                  step={1} 
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="form-control w-full">
                <div className="label"><span className="label-text font-semibold text-xs">{t('products:form.forme')}</span></div>
                <select 
                  className="select select-bordered select-sm w-full" 
                  value={form.forme}
                  onChange={(e) => setForm((p) => ({ ...p, forme: e.target.value }))}
                >
                  <option value="">—</option>
                  {formes.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                </select>
              </label>
              <label className="form-control w-full">
                <div className="label"><span className="label-text font-semibold text-xs">{t('products:form.groupe')}</span></div>
                <select 
                  className="select select-bordered select-sm w-full" 
                  value={form.groupe}
                  onChange={(e) => setForm((p) => ({ ...p, groupe: e.target.value }))}
                >
                  <option value="">—</option>
                  {groupes.map(g => <option key={g.id} value={g.id}>{g.nom}</option>)}
                </select>
              </label>
            </div>

            <div className="pt-4 border-t border-error/10">
               <label className="form-control w-full">
                  <div className="label"><span className="label-text font-bold text-error flex items-center gap-2">⚠️ Message d'alerte comptoir (Optionnel)</span></div>
                  <textarea 
                    className="textarea textarea-bordered w-full textarea-error bg-error/5 focus:bg-base-100 transition-colors"
                    placeholder="Ex: Changement de conditionnement, vérifier le code barre..."
                    value={form.message_alerte || ''}
                    onChange={(e) => setForm((p) => ({ ...p, message_alerte: e.target.value }))}
                  />
                  <div className="label">
                    <span className="label-text-alt text-error/70">Ce message s'affichera en plein écran lors du passage de ce produit en caisse.</span>
                  </div>
               </label>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-base-content/50 border-b pb-2">{t('products:form.price_margin')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="form-control w-full">
                <div className="label"><span className="label-text font-semibold">{t('products:form.cost_price')}</span></div>
                <div className="join w-full">
                  <input
                    type="number"
                    className="input input-bordered join-item w-full"
                    value={form.cost_price}
                    onChange={(e) => setForm((p) => ({ ...p, cost_price: e.target.value }))}
                    step="0.01"
                    required
                  />
                  <span className="join-item btn btn-disabled bg-base-200">F</span>
                </div>
              </label>
              <label className="form-control w-full">
                <div className="label"><span className="label-text font-semibold text-primary">{t('products:form.selling_price')}</span></div>
                <div className="join w-full">
                  <input
                    type="number"
                    className="input input-bordered join-item w-full font-bold text-primary"
                    value={form.selling_price}
                    onChange={(e) => setForm((p) => ({ ...p, selling_price: e.target.value }))}
                    step="0.01"
                    required
                  />
                  <span className="join-item btn btn-disabled bg-base-200">F</span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="form-control w-full">
                <div className="label"><span className="label-text text-xs font-semibold text-primary">{t('products:form.tva')}</span></div>
                <select
                  className="select select-bordered select-sm w-full"
                  value={form.tva}
                  onChange={(e) => setForm((p) => ({ ...p, tva: e.target.value }))}
                  disabled={loadingTVA}
                >
                  {tvaList.map((t) => (
                    <option key={t.id} value={t.taux}>
                      {t.taux}% {t.libelle ? `(${t.libelle})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-control w-full">
                 <div className="label"><span className="label-text text-xs">{t('products:form.margin_coeff')}</span></div>
                 <div className={`input input-bordered input-sm w-full flex items-center justify-center font-bold ${tauxMarge < 1 ? 'text-error' : 'text-success'}`}>
                   {tauxMarge.toFixed(0)}
                 </div>
              </div>
              <div className="form-control w-full">
                 <div className="label"><span className="label-text text-xs">{t('products:form.margin_percent')}</span></div>
                 <div className={`input input-bordered input-sm w-full flex items-center justify-center font-bold ${pourcMarge < 0 ? 'text-error' : 'text-success'}`}>
                    {pourcMarge.toFixed(1)}%
                 </div>
              </div>
            </div>

            <label className="form-control w-full">
              <div className="label"><span className="label-text font-semibold">{t('products:form.expiration_date')}</span></div>
              <input 
                type="date" 
                className="input input-bordered w-full" 
                value={form.expire_date}
                onChange={(e) => setForm((p) => ({ ...p, expire_date: e.target.value }))} 
              />
            </label>

            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-4 p-4 rounded-xl border bg-base-100">
                <input 
                  type="checkbox" 
                  className="checkbox checkbox-primary" 
                  checked={form.use_lot_management}
                  onChange={(e) => setForm((p) => ({ ...p, use_lot_management: e.target.checked }))} 
                />
                <div>
                  <span className="label-text font-bold">{t('products:form.lot_management')}</span>
                  <p className="text-[10px] opacity-60">{t('products:form.lot_management_desc')}</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {/* Ordonnance */}
           <div className="p-4 rounded-xl border bg-info/5 border-info/20">
              <label className="label cursor-pointer justify-start gap-4">
                <input 
                  type="checkbox" 
                  className="checkbox checkbox-info" 
                  checked={form.requires_prescription}
                  onChange={(e) => setForm(p => ({ ...p, requires_prescription: e.target.checked }))}
                />
                <div>
                  <span className="label-text font-bold">{t('products:form.requires_prescription')}</span>
                  <p className="text-xs text-base-content/60">{t('products:form.prescription_desc')}</p>
                </div>
              </label>
           </div>

           {/* Supplier Exclusivity */}
           <div className={`p-4 rounded-xl border transition-all ${form.fournisseur ? 'bg-warning/5 border-warning/20' : 'bg-base-200 opacity-50'}`}>
              <label className="label cursor-pointer justify-start gap-4">
                <input
                  type="checkbox"
                  className="checkbox checkbox-warning"
                  checked={form.is_supplier_exclusive}
                  onChange={(e) => setForm((p) => ({ ...p, is_supplier_exclusive: e.target.checked }))}
                  disabled={!form.fournisseur}
                />
                <div>
                  <span className="label-text font-bold">{t('products:form.supplier_exclusive')}</span>
                  <p className="text-xs text-base-content/60">
                    {t('products:form.exclusive_desc', { 
                      provider: form.fournisseur ? fournisseurs.find(f => String(f.id) === form.fournisseur)?.name : t('products:form.provider_placeholder_short') 
                    })}
                  </p>
                </div>
              </label>
           </div>
        </div>

        {/* Section Réserve et Réapprovisionnement */}
        <div className="mt-6 p-4 rounded-xl border-2 border-primary/20 bg-primary/5">
           <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-primary">{t('products:form.reserve_title')}</h4>
                <p className="text-xs opacity-60">{t('products:form.reserve_desc')}</p>
              </div>
              <input 
                type="checkbox" 
                className="toggle toggle-primary"
                checked={form.has_reserve_storage}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setForm(p => ({ 
                    ...p, 
                    has_reserve_storage: checked,
                    // Valeurs par défaut si activé et vide/0
                    capacite_rayon: (checked && (p.capacite_rayon === '0' || !p.capacite_rayon)) ? '50' : p.capacite_rayon,
                    min_rayon: (checked && (p.min_rayon === '0' || !p.min_rayon)) ? '10' : p.min_rayon
                  }));
                }}
              />
           </div>

           {form.has_reserve_storage && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-semibold">{t('products:form.rayon_capacity')}</span>
                  </div>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    placeholder={t('products:form.placeholder_capacity')}
                    value={form.capacite_rayon}
                    onChange={(e) => setForm(p => ({ ...p, capacite_rayon: e.target.value }))}
                  />
                  <div className="label">
                    <span className="label-text-alt text-xs opacity-60">{t('products:form.capacity_desc')}</span>
                  </div>
                </label>

                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-semibold">{t('products:form.rayon_reorder_threshold')}</span>
                  </div>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    placeholder={t('products:form.placeholder_reorder')}
                    value={form.min_rayon}
                    onChange={(e) => setForm(p => ({ ...p, min_rayon: e.target.value }))}
                  />
                  <div className="label">
                    <span className="label-text-alt text-xs opacity-60">{t('products:form.reorder_desc')}</span>
                  </div>
                </label>
             </div>
           )}
        </div>

        {/* Pathologie Chronique */}
        <div className={`p-4 rounded-xl border transition-all ${form.is_chronic ? 'bg-success/5 border-success/20' : 'bg-base-100'}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <label className="label cursor-pointer justify-start gap-4">
              <input
                type="checkbox"
                className="checkbox checkbox-success"
                checked={form.is_chronic}
                onChange={(e) => setForm((p) => ({ ...p, is_chronic: e.target.checked }))}
              />
              <div>
                <span className="label-text font-bold">{t('products:form.chronic_pathology')}</span>
                <p className="text-xs text-base-content/60">{t('products:form.chronic_desc')}</p>
              </div>
            </label>
            
            {form.is_chronic && (
              <label className="form-control w-full md:w-48">
                <div className="label"><span className="label-text text-xs font-semibold">{t('products:form.treatment_duration')}</span></div>
                <div className="join">
                  <input
                    type="number"
                    className="input input-bordered input-sm join-item w-full"
                    value={form.default_treatment_days}
                    onChange={(e) => setForm((p) => ({ ...p, default_treatment_days: e.target.value }))}
                    min={1}
                  />
                  <span className="join-item btn btn-sm btn-disabled bg-base-200">{t('common:days')}</span>
                </div>
              </label>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-base-200">
          <button type="button" className="btn btn-ghost px-8" onClick={onClose} disabled={loading}>
            {t('common:cancel')}
          </button>
          <button type="submit" className="btn btn-primary px-10 shadow-lg shadow-primary/20" disabled={loading}>
            {loading ? <span className="loading loading-spinner"></span> : `💾 ${t('products:actions.create')}`}
          </button>
        </div>
      </form>
    </PremiumModal>
  );
}
