import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import type { ProduitForm, ProduitModel, Rayon, Fournisseur, Forme, Groupe } from '../types';
import { useTVA } from '../hooks/useTVA';
import PremiumModal from './common/PremiumModal';

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
  title = "Créer un nouveau produit",
  rayons = [],
  fournisseurs = [],
  formes = [],
  groupes = [],
}: ProduitFormModalProps) {
  const { tvaList, loading: loadingTVA } = useTVA();
  
  const [form, setForm] = useState<ProduitForm & { groupe?: string; use_lot_management: boolean }>({
    name: '',
    description: '',
    stock: '',
    cost_price: '',
    selling_price: '',
    cip1: '',
    cip2: '',
    cip3: '',
    expire_date: '',
    stock_alert: '',
    stock_minimum: '',
    stock_maximum: '',
    rayon: '',
    fournisseur: '',
    forme: '',
    groupe: '',
    tva: '19.25',
    is_supplier_exclusive: false,
    requires_prescription: false,
    use_lot_management: true,
    is_chronic: false,
    default_treatment_days: '30',
    has_reserve_storage: false,
    capacite_rayon: '0',
    min_rayon: '0',
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
  const costPrice = parseFloat(form.cost_price) || 0;
  const sellingPrice = parseFloat(form.selling_price) || 0;
  
  let tauxMarge = 0;
  let pourcMarge = 0;

  if (costPrice > 0) {
    tauxMarge = sellingPrice / costPrice;
  }
  
  if (sellingPrice > 0) {
    pourcMarge = ((sellingPrice - costPrice) / sellingPrice) * 100;
  }


  function formatBackendErrors(data: unknown): string {
    if (data == null) return 'Erreur inconnue du serveur';
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
        default_treatment_days: form.default_treatment_days ? parseInt(form.default_treatment_days, 10) : 30,
        has_reserve_storage: form.has_reserve_storage || false,
        capacite_rayon: form.capacite_rayon ? parseInt(form.capacite_rayon, 10) : 0,
        min_rayon: form.min_rayon ? parseInt(form.min_rayon, 10) : 0,
      };

      if (!payload.name || !payload.selling_price || !payload.cost_price || payload.stock == null) {
        setError('Les champs Nom, Stock, Prix de revient et Prix de vente sont obligatoires');
        setLoading(false);
        return;
      }

      const { data } = await axios.post<ProduitModel>(produitsEndpoint, payload);
      onCreated(data); // Callback to parent
      onClose(); // Close modal on success
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data ?? err.message;
        setError(typeof detail === 'string' ? detail : formatBackendErrors(detail));
      } else {
        setError("Erreur inconnue lors de l'ajout du produit");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <PremiumModal
      isOpen={open}
      onClose={onClose}
      title={title}
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
            <h4 className="text-sm font-bold uppercase tracking-wider text-base-content/50 border-b pb-2">Informations Générales</h4>
            <label className="form-control w-full">
              <div className="label"><span className="label-text font-semibold">Nom du produit *</span></div>
              <input
                type="text"
                className="input input-bordered w-full focus:input-primary"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
                autoFocus
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="form-control w-full">
                <div className="label"><span className="label-text font-semibold">Stock Initial *</span></div>
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
                <div className="label"><span className="label-text font-semibold text-xs">Rayon</span></div>
                <select 
                  className="select select-bordered w-full" 
                  value={form.rayon}
                  onChange={(e) => setForm((f) => ({ ...f, rayon: e.target.value }))}
                >
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

            <div className="grid grid-cols-2 gap-4">
              <label className="form-control w-full">
                <div className="label"><span className="label-text font-semibold">CIP1</span></div>
                <input 
                  className="input input-bordered w-full font-mono" 
                  value={form.cip1}
                  onChange={(e) => setForm((p) => ({ ...p, cip1: e.target.value }))} 
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="form-control w-full">
                  <div className="label"><span className="label-text text-xs font-semibold">CIP2</span></div>
                  <input className="input input-bordered input-sm w-full font-mono" value={form.cip2}
                    onChange={(e) => setForm((p) => ({ ...p, cip2: e.target.value }))} />
                </label>
                <label className="form-control w-full">
                  <div className="label"><span className="label-text text-xs font-semibold">CIP3</span></div>
                  <input className="input input-bordered input-sm w-full font-mono" value={form.cip3}
                    onChange={(e) => setForm((p) => ({ ...p, cip3: e.target.value }))} />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="form-control w-full">
                <div className="label"><span className="label-text font-semibold">Fournisseur</span></div>
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

            <div className="grid grid-cols-3 gap-2">
              <label className="form-control w-full">
                <div className="label"><span className="label-text text-xs font-semibold">Alerte</span></div>
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
                <div className="label"><span className="label-text text-xs">Min</span></div>
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
                <div className="label"><span className="label-text text-xs">Max</span></div>
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

            <div className="grid grid-cols-2 gap-4">
              <label className="form-control w-full">
                <div className="label"><span className="label-text font-semibold text-xs">Forme</span></div>
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
                <div className="label"><span className="label-text font-semibold text-xs">Groupe</span></div>
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
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-base-content/50 border-b pb-2">Prix et Marge (HT)</h4>
            <div className="grid grid-cols-2 gap-4">
              <label className="form-control w-full">
                <div className="label"><span className="label-text font-semibold">Prix revient *</span></div>
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
                <div className="label"><span className="label-text font-semibold text-primary">Prix vente *</span></div>
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

            <div className="grid grid-cols-3 gap-2">
              <label className="form-control w-full">
                <div className="label"><span className="label-text text-xs font-semibold text-primary">TVA (%)</span></div>
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
                 <div className="label"><span className="label-text text-xs">Coef.</span></div>
                 <div className={`input input-bordered input-sm w-full flex items-center justify-center font-bold ${tauxMarge < 1 ? 'text-error' : 'text-success'}`}>
                   {tauxMarge.toFixed(2)}
                 </div>
              </div>
              <div className="form-control w-full">
                 <div className="label"><span className="label-text text-xs">% Marge</span></div>
                 <div className={`input input-bordered input-sm w-full flex items-center justify-center font-bold ${pourcMarge < 0 ? 'text-error' : 'text-success'}`}>
                    {pourcMarge.toFixed(1)}%
                 </div>
              </div>
            </div>

            <label className="form-control w-full">
              <div className="label"><span className="label-text font-semibold">Date expiration</span></div>
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
                  <span className="label-text font-bold">Gestion par lots FIFO</span>
                  <p className="text-[10px] opacity-60">Recommandé pour médicaments et produits périssables</p>
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
                  <span className="label-text font-bold">Prescription Requise</span>
                  <p className="text-xs text-base-content/60">Nécessite une ordonnance valide</p>
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
                  <span className="label-text font-bold">Exclusivité Fournisseur</span>
                  <p className="text-xs text-base-content/60">
                    Uniquement commandable chez {form.fournisseur ? fournisseurs.find(f => String(f.id) === form.fournisseur)?.name : 'le fournisseur'}
                  </p>
                </div>
              </label>
           </div>
        </div>

        {/* Section Réserve et Réapprovisionnement */}
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
                    <span className="label-text font-semibold">Capacité Rayon</span>
                  </div>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    placeholder="Ex: 50"
                    value={form.capacite_rayon}
                    onChange={(e) => setForm(p => ({ ...p, capacite_rayon: e.target.value }))}
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
                    onChange={(e) => setForm(p => ({ ...p, min_rayon: e.target.value }))}
                  />
                  <div className="label">
                    <span className="label-text-alt text-xs opacity-60">Avertir si stock rayon ≤ seuil</span>
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
                <span className="label-text font-bold">Produit pour Pathologie Chronique</span>
                <p className="text-xs text-base-content/60">Active les rappels automatique d'achat pour les patients</p>
              </div>
            </label>
            
            {form.is_chronic && (
              <label className="form-control w-full md:w-48">
                <div className="label"><span className="label-text text-xs font-semibold">Durée traitement (jours)</span></div>
                <div className="join">
                  <input
                    type="number"
                    className="input input-bordered input-sm join-item w-full"
                    value={form.default_treatment_days}
                    onChange={(e) => setForm((p) => ({ ...p, default_treatment_days: e.target.value }))}
                    min={1}
                  />
                  <span className="join-item btn btn-sm btn-disabled bg-base-200">Jours</span>
                </div>
              </label>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-base-200">
          <button type="button" className="btn btn-ghost px-8" onClick={onClose} disabled={loading}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary px-10 shadow-lg shadow-primary/20" disabled={loading}>
            {loading ? <span className="loading loading-spinner"></span> : '💾 Créer le produit'}
          </button>
        </div>
      </form>
    </PremiumModal>
  );
}
