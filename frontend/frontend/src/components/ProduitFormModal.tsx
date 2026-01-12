import React, { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import type { ProduitForm, ProduitModel, Rayon, Fournisseur } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (produit: ProduitModel) => void;
  produitsEndpoint: string;
  rayonsEndpoint: string; // Ajout du endpoint des rayons
  fournisseursEndpoint: string; // Ajout du endpoint des fournisseurs
  initialData?: Partial<ProduitForm>;
  title?: string;
}

interface ProduitFormModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (produit: ProduitModel) => void;
  produitsEndpoint: string;
  rayonsEndpoint: string; // Ajout du endpoint des rayons
  fournisseursEndpoint: string; // Ajout du endpoint des fournisseurs
  initialData?: Partial<ProduitForm>;
  title?: string;
  rayons: Rayon[];
  fournisseurs: Fournisseur[];
}

export default function ProduitFormModal({
  open,
  onClose,
  onCreated,
  produitsEndpoint,
  rayonsEndpoint, // Récupération du endpoint des rayons
  fournisseursEndpoint, // Récupération du endpoint des fournisseurs
  initialData,
  title = "Créer un nouveau produit",
  rayons = [],
  fournisseurs = [],
}: ProduitFormModalProps) {
  const [form, setForm] = useState<ProduitForm>({
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
    tva: '19.25',
    ...initialData,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rayonsData, setRayons] = useState<Rayon[]>([]); // State pour les rayons
  const [fournisseursData, setFournisseurs] = useState<Fournisseur[]>([]); // State pour les fournisseurs

  useEffect(() => {
    // Reset form when modal opens with new initial data
    setForm({
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
      tva: '19.25',
      ...initialData,
    });
    setError(null); // Clear errors when modal is reopened
  }, [open, initialData]);

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

  useEffect(() => {
    if (open) {
      // Assurez-vous que les endpoints sont passés en props ou définis ici
      axios.get(rayonsEndpoint).then(res => {
        const data = res.data;
        setRayons(Array.isArray(data) ? data : (data.results || []));
      });
      axios.get(fournisseursEndpoint).then(res => {
         const data = res.data;
         setFournisseurs(Array.isArray(data) ? data : (data.results || []));
      });
    }
  }, [open, rayonsEndpoint, fournisseursEndpoint]);

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
        rayon: form.rayon ? parseInt(form.rayon, 10) : undefined,
        fournisseur: form.fournisseur ? parseInt(form.fournisseur, 10) : undefined,
        tva: form.tva || '19.25',
        requires_prescription: form.requires_prescription || false,
        surveillance_category: form.surveillance_category || 'NONE',
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
    <dialog className={`modal ${open ? 'modal-open' : ''}`}>
      <div className="modal-box max-w-4xl">
        <h3 className="font-bold text-lg mb-4">{title}</h3>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div role="alert" className="alert alert-error">
              <span>{error}</span>
            </div>
          )}
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Nom *</span></div>
            <input
              type="text"
              className="input input-bordered w-full"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="form-control w-full">
              <div className="label"><span className="label-text">Stock *</span></div>
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
              <div className="label"><span className="label-text">Prix de revient (F) *</span></div>
              <input
                type="number"
                className="input input-bordered w-full"
                value={form.cost_price}
                onChange={(e) => setForm((p) => ({ ...p, cost_price: e.target.value }))}
                step="0.01"
                required
              />
            </label>
            <label className="form-control w-full">
              <div className="label"><span className="label-text">Prix de vente (F) *</span></div>
              <input
                type="number"
                className="input input-bordered w-full"
                value={form.selling_price}
                onChange={(e) => setForm((p) => ({ ...p, selling_price: e.target.value }))}
                step="0.01"
                required
              />
            </label>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="form-control w-full">
              <div className="label"><span className="label-text">TVA (%)</span></div>
              <input
                type="number"
                className="input input-bordered w-full"
                value={form.tva}
                onChange={(e) => setForm((p) => ({ ...p, tva: e.target.value }))}
                step="0.01"
              />
            </label>
            <div className="form-control w-full">
               <div className="label"><span className="label-text">Coef. Marge</span></div>
               <div className="input input-bordered w-full flex items-center bg-base-200 text-base-content/70">
                 {tauxMarge.toFixed(2)}
               </div>
            </div>
            <div className="form-control w-full">
               <div className="label"><span className="label-text">% de Marge</span></div>
               <div className="input input-bordered w-full flex items-center bg-base-200 text-base-content/70">
                 {pourcMarge.toFixed(2)} %
               </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="form-control w-full"><div className="label"><span className="label-text">CIP1</span></div>
              <input className="input input-bordered w-full" value={form.cip1}
                onChange={(e) => setForm((p) => ({ ...p, cip1: e.target.value }))} />
            </label>
            <label className="form-control w-full"><div className="label"><span className="label-text">CIP2</span></div>
              <input className="input input-bordered w-full" value={form.cip2}
                onChange={(e) => setForm((p) => ({ ...p, cip2: e.target.value }))} />
            </label>
            <label className="form-control w-full"><div className="label"><span className="label-text">CIP3</span></div>
              <input className="input input-bordered w-full" value={form.cip3}
                onChange={(e) => setForm((p) => ({ ...p, cip3: e.target.value }))} />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <label className="form-control w-full"><div className="label"><span className="label-text">Expiration</span></div>
              <input type="date" className="input input-bordered w-full" value={form.expire_date}
                onChange={(e) => setForm((p) => ({ ...p, expire_date: e.target.value }))} />
            </label>
            <label className="form-control w-full"><div className="label"><span className="label-text">Alerte stock</span></div>
              <input type="number" className="input input-bordered w-full" value={form.stock_alert}
                onChange={(e) => setForm((p) => ({ ...p, stock_alert: e.target.value }))} min={0} step={1} />
            </label>
            <label className="form-control w-full"><div className="label"><span className="label-text">Stock minimum</span></div>
              <input type="number" className="input input-bordered w-full" value={form.stock_minimum}
                onChange={(e) => setForm((p) => ({ ...p, stock_minimum: e.target.value }))} min={0} step={1} />
            </label>
            <label className="form-control w-full"><div className="label"><span className="label-text">Stock maximum</span></div>
              <input type="number" className="input input-bordered w-full" value={form.stock_maximum}
                onChange={(e) => setForm((p) => ({ ...p, stock_maximum: e.target.value }))} min={0} step={1} />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="form-control w-full"><div className="label"><span className="label-text">Rayon</span></div>
              <select
                className="select select-bordered"
                value={form.rayon}
                onChange={(e) => setForm((f) => ({ ...f, rayon: e.target.value }))}
              >
                <option value="">Sélectionner un rayon</option>
                {/* Cette ligne ne plantera plus car rayons est au minimum un tableau vide */}
                {rayons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control w-full"><div className="label"><span className="label-text">Fournisseur</span></div>
              <select className="select select-bordered w-full" value={form.fournisseur}
                onChange={(e) => setForm((p) => ({ ...p, fournisseur: e.target.value }))}>
                <option value="">—</option>
                {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
          </div>
          
          <div className="divider text-sm font-semibold text-base-content/50 uppercase tracking-wider">Ordonnance & Surveillance</div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-base-100 p-4 rounded-lg border border-base-200">
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-4">
                <input 
                  type="checkbox" 
                  className="checkbox checkbox-primary" 
                  checked={form.requires_prescription || false}
                  onChange={(e) => setForm(p => ({ ...p, requires_prescription: e.target.checked }))}
                />
                <span className="label-text font-medium">Nécessite une ordonnance</span>
              </label>
            </div>
            
            <div className="form-control w-full">
               <label className="label py-0 mb-1"><span className="label-text">Niveau de surveillance</span></label>
               <select 
                  className="select select-bordered select-sm w-full"
                  value={form.surveillance_category || 'NONE'}
                  onChange={(e) => setForm(p => ({ ...p, surveillance_category: e.target.value as any }))}
               >
                  <option value="NONE">Aucune</option>
                  <option value="STANDARD">Surveillance Standard</option>
                  <option value="RENFORCEE">Surveillance Renforcée</option>
               </select>
            </div>
          </div>
          
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="loading loading-spinner"></span> : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop" onSubmit={onClose}>
        <button>close</button>
      </form>
    </dialog>
  );
}
