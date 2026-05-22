import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import api from '../services/api';
import type { ProduitForm, ProduitModel, Rayon, Fournisseur, Forme, Groupe } from '../types';
import { useTVA } from '../hooks/useTVA';
import { X } from 'lucide-react';
import { normalizeNumberInput } from '../utils/formatters';
import { getLocale } from '../utils/dateUtils';
import { productSchema } from '../schemas/productSchema';

const EMPTY_ARRAY: any[] = [];

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
  groupes?: Groupe[];
}

export default function ProduitFormModal({
  open,
  onClose,
  onCreated,
  produitsEndpoint,
  initialData,
  title,
  rayons = EMPTY_ARRAY,
  fournisseurs = EMPTY_ARRAY,
  formes = EMPTY_ARRAY,
  groupes = EMPTY_ARRAY,
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

  useEffect(() => {
    if (!initialData?.tva && tvaList.length > 0) {
       const defaultTva = tvaList.find(t => t.taux === '19.25') || tvaList.find(t => t.is_active);
       if (defaultTva) {
         setForm(prev => ({ ...prev, tva: defaultTva.taux }));
       }
    }
  }, [tvaList, initialData?.tva]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const errorMsg = validation.error.issues
          .map(err => `${err.path.join('.')}: ${err.message}`)
          .join(' | ');
        setError(errorMsg);
        setLoading(false);
        return;
      }

      const cleanPayload = validation.data;

      const { data } = await api.post<ProduitModel>(produitsEndpoint, cleanPayload);
      onCreated(data);
      onClose();
    } catch (err: unknown) {
      const anyErr = err as any;
      if (anyErr.response) {
        const detail = anyErr.response?.data ?? anyErr.message;
        setError(typeof detail === 'string' ? detail : formatBackendErrors(detail));
      } else {
        setError(t('products:form.validation.unknown_error'));
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const inputBase = "w-full rounded-lg border border-base-300 bg-base-100 text-base-content focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none h-10 px-3 text-sm transition-all";
  const inputSm = "w-full rounded-lg border border-base-300 bg-base-100 text-base-content focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none h-9 px-3 text-xs transition-all";
  const selectBase = "w-full rounded-lg border border-base-300 bg-base-100 text-base-content focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none h-10 px-3 text-sm transition-all appearance-none";
  const selectSm = "w-full rounded-lg border border-base-300 bg-base-100 text-base-content focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none h-9 px-3 text-xs transition-all appearance-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-base-100 rounded-xl shadow-2xl border border-base-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-base-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <span className="text-lg">➕</span>
            </div>
            <h3 className="text-base font-bold text-base-content">{titleText}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-base-content/50 hover:bg-base-200 rounded-lg transition-colors">
            <X className="size-5" />
          </button>
        </div>

        <form className="p-6 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-error/10 border border-red-100 rounded-lg p-3 flex items-center gap-2 text-error text-sm">
              <span className="shrink-0 text-lg">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-base-content/50 border-b border-base-200 pb-2">{t('products:form.general_info')}</h4>

              <div>
                <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.name')}</label>
                <input type="text" className={inputBase} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required autoFocus />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.initial_stock')}</label>
                  <input type="number" className={inputBase} value={form.stock} onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))} min={0} step={1} required />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.rayon')}</label>
                  <select className={selectBase} value={form.rayon} onChange={(e) => setForm((f) => ({ ...f, rayon: e.target.value }))}>
                    <option value="">{t('products:form.select_rayon')}</option>
                    {rayons.filter(r => !r.parent).map(parent => (
                      <optgroup key={parent.id} label={parent.name}>
                        <option value={parent.id}>{parent.name}</option>
                        {rayons.filter(child => child.parent === parent.id).map(child => (
                          <option key={child.id} value={child.id}>↳ {child.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.cip1')}</label>
                  <input className={`${inputBase} font-mono`} value={form.cip1} onChange={(e) => setForm((p) => ({ ...p, cip1: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.cip2')}</label>
                    <input className={`${inputSm} font-mono`} value={form.cip2} onChange={(e) => setForm((p) => ({ ...p, cip2: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.cip3')}</label>
                    <input className={`${inputSm} font-mono`} value={form.cip3} onChange={(e) => setForm((p) => ({ ...p, cip3: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.provider')}</label>
                  <select className={selectBase} value={form.fournisseur} onChange={(e) => {
                    const val = e.target.value;
                    setForm((p) => ({ ...p, fournisseur: val, is_supplier_exclusive: val ? p.is_supplier_exclusive : false }));
                  }}>
                    <option value="">-</option>
                    {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.alert')}</label>
                  <input type="number" className={inputSm} value={form.stock_alert} onChange={(e) => setForm((p) => ({ ...p, stock_alert: e.target.value }))} min={0} step={1} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.min')}</label>
                  <input type="number" className={inputSm} value={form.stock_minimum} onChange={(e) => setForm((p) => ({ ...p, stock_minimum: e.target.value }))} min={0} step={1} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.max')}</label>
                  <input type="number" className={inputSm} value={form.stock_maximum} onChange={(e) => setForm((p) => ({ ...p, stock_maximum: e.target.value }))} min={0} step={1} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.forme')}</label>
                  <select className={selectSm} value={form.forme} onChange={(e) => setForm((p) => ({ ...p, forme: e.target.value }))}>
                    <option value="">-</option>
                    {formes.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.groupe')}</label>
                  <select className={selectSm} value={form.groupe} onChange={(e) => setForm((p) => ({ ...p, groupe: e.target.value }))}>
                    <option value="">-</option>
                    {groupes.map(g => <option key={g.id} value={g.id}>{g.nom}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-red-100">
                <div>
                  <label className="block text-[10px] font-semibold text-error uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    ⚠️ Message d&apos;alerte comptoir (Optionnel)
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-base-300 bg-error/10/30 hover:border-base-300 focus:border-red-400 focus:ring-2 focus:ring-red-50 transition-all min-h-[80px] text-sm p-3 outline-none"
                    placeholder="Ex: Changement de conditionnement, vérifier le code barre..."
                    value={form.message_alerte || ''}
                    onChange={(e) => setForm((p) => ({ ...p, message_alerte: e.target.value }))}
                  />
                  <p className="text-[10px] text-red-500 mt-1">Ce message s&apos;affichera en plein écran lors du passage de ce produit en caisse.</p>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-base-content/50 border-b border-base-200 pb-2">{t('products:form.price_margin')}</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.cost_price')}</label>
                  <div className="flex">
                    <input type="number" className={`${inputBase} rounded-r-none border-r-0`} value={form.cost_price} onChange={(e) => setForm((p) => ({ ...p, cost_price: e.target.value }))} step="0.01" required />
                    <span className="px-3 flex items-center bg-base-200 border border-base-300 border-l-0 rounded-r-lg text-base-content/60 text-sm font-medium">F</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.selling_price')}</label>
                  <div className="flex">
                    <input type="number" className={`${inputBase} rounded-r-none border-r-0 font-semibold text-primary`} value={form.selling_price} onChange={(e) => setForm((p) => ({ ...p, selling_price: e.target.value }))} step="0.01" required />
                    <span className="px-3 flex items-center bg-base-200 border border-base-300 border-l-0 rounded-r-lg text-base-content/60 text-sm font-medium">F</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.tva')}</label>
                  <select className={selectSm} value={form.tva} onChange={(e) => setForm((p) => ({ ...p, tva: e.target.value }))} disabled={loadingTVA}>
                    {tvaList.map((t) => (
                      <option key={t.id} value={t.taux}>{t.taux}% {t.libelle ? `(${t.libelle})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.margin_coeff')}</label>
                  <div className={`${inputSm} flex items-center justify-center font-bold ${tauxMarge < 1 ? 'text-error' : 'text-success'}`}>{tauxMarge.toFixed(0)}</div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.margin_percent')}</label>
                  <div className={`${inputSm} flex items-center justify-center font-bold ${pourcMarge < 0 ? 'text-error' : 'text-success'}`}>{pourcMarge.toFixed(1)}%</div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.expiration_date')}</label>
                <input type="date" lang={getLocale()} className={inputBase} value={form.expire_date} onChange={(e) => setForm((p) => ({ ...p, expire_date: e.target.value }))} />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border bg-base-200 border-base-300 hover:bg-base-200 transition-colors cursor-pointer" onClick={() => setForm((p) => ({ ...p, use_lot_management: !p.use_lot_management }))}>
                <input type="checkbox" className="size-4 rounded border-base-300 text-primary focus:ring-primary" checked={form.use_lot_management} onChange={(e) => setForm((p) => ({ ...p, use_lot_management: e.target.checked }))} />
                <div>
                  <span className="text-sm font-medium text-base-content">{t('products:form.lot_management')}</span>
                  <p className="text-[10px] text-base-content/50">{t('products:form.lot_management_desc')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg border bg-info/10/50 border-blue-100 hover:bg-info/10 transition-colors cursor-pointer" onClick={() => setForm(p => ({ ...p, requires_prescription: !p.requires_prescription }))}>
              <div className="flex items-center gap-3">
                <input type="checkbox" className="size-4 rounded border-base-300 text-primary focus:ring-primary" checked={form.requires_prescription} onChange={(e) => setForm(p => ({ ...p, requires_prescription: e.target.checked }))} />
                <div>
                  <span className="text-sm font-medium text-base-content">{t('products:form.requires_prescription')}</span>
                  <p className="text-xs text-base-content/60">{t('products:form.prescription_desc')}</p>
                </div>
              </div>
            </div>

            <div className={`p-3 rounded-lg border transition-all cursor-pointer ${form.fournisseur ? 'bg-warning/10/50 border-amber-100 hover:bg-warning/10' : 'bg-base-200 text-base-content/50'}`} onClick={() => form.fournisseur && setForm((p) => ({ ...p, is_supplier_exclusive: !p.is_supplier_exclusive }))}>
              <div className="flex items-center gap-3">
                <input type="checkbox" className="size-4 rounded border-base-300 text-primary focus:ring-primary" checked={form.is_supplier_exclusive} onChange={(e) => setForm((p) => ({ ...p, is_supplier_exclusive: e.target.checked }))} disabled={!form.fournisseur} />
                <div>
                  <span className="text-sm font-medium text-base-content">{t('products:form.supplier_exclusive')}</span>
                  <p className="text-xs text-base-content/60">
                    {t('products:form.exclusive_desc', { provider: form.fournisseur ? fournisseurs.find(f => String(f.id) === form.fournisseur)?.name : t('products:form.provider_placeholder_short') })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section Réserve */}
          <div className="p-5 rounded-xl border border-indigo-100 bg-primary/10/30">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-semibold text-primary">{t('products:form.reserve_title')}</h4>
                <p className="text-[10px] text-indigo-400 font-medium">{t('products:form.reserve_desc')}</p>
              </div>
              <input type="checkbox" className="toggle toggle-primary toggle-md" checked={form.has_reserve_storage} onChange={(e) => {
                const checked = e.target.checked;
                setForm(p => ({ ...p, has_reserve_storage: checked, capacite_rayon: (checked && (p.capacite_rayon === '0' || !p.capacite_rayon)) ? '50' : p.capacite_rayon, min_rayon: (checked && (p.min_rayon === '0' || !p.min_rayon)) ? '10' : p.min_rayon }));
              }} />
            </div>

            {form.has_reserve_storage && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.rayon_capacity')}</label>
                  <input type="number" className={inputBase} placeholder={t('products:form.placeholder_capacity')} value={form.capacite_rayon} onChange={(e) => setForm(p => ({ ...p, capacite_rayon: e.target.value }))} />
                  <p className="text-xs text-base-content/50 mt-1">{t('products:form.capacity_desc')}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.rayon_reorder_threshold')}</label>
                  <input type="number" className={inputBase} placeholder={t('products:form.placeholder_reorder')} value={form.min_rayon} onChange={(e) => setForm(p => ({ ...p, min_rayon: e.target.value }))} />
                  <p className="text-xs text-base-content/50 mt-1">{t('products:form.reorder_desc')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Pathologie Chronique */}
          <div className={`p-3 rounded-lg border transition-all cursor-pointer ${form.is_chronic ? 'bg-success/10/50 border-emerald-100' : 'bg-base-100 border-base-200 hover:bg-base-200'}`} onClick={() => setForm((p) => ({ ...p, is_chronic: !p.is_chronic }))}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <input type="checkbox" className="size-4 rounded border-base-300 text-primary focus:ring-primary" checked={form.is_chronic} onChange={(e) => setForm((p) => ({ ...p, is_chronic: e.target.checked }))} />
                <div>
                  <span className="text-sm font-medium text-base-content">{t('products:form.chronic_pathology')}</span>
                  <p className="text-xs text-base-content/60">{t('products:form.chronic_desc')}</p>
                </div>
              </div>

              {form.is_chronic && (
                <div className="w-full md:w-48">
                  <label className="block text-[10px] font-semibold text-base-content/60 uppercase tracking-wider mb-1.5">{t('products:form.treatment_duration')}</label>
                  <div className="flex">
                    <input type="number" className={`${inputSm} rounded-r-none border-r-0`} value={form.default_treatment_days} onChange={(e) => setForm((p) => ({ ...p, default_treatment_days: e.target.value }))} min={1} />
                    <span className="px-3 flex items-center bg-base-200 border border-base-300 border-l-0 rounded-r-lg text-base-content/60 text-xs font-medium">{t('common:days')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-base-200">
            <button type="button" className="px-6 py-2 text-sm font-medium text-base-content bg-base-100 border border-base-300 rounded-lg hover:bg-base-200 transition-colors" onClick={onClose} disabled={loading}>
              {t('common:cancel')}
            </button>
            <button type="submit" className="px-8 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-focus transition-colors shadow-sm disabled:text-base-content/50" disabled={loading}>
              {loading ? <span className="inline-block size-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : `💾 ${t('products:actions.create')}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}