import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import api from '../services/api';
import type { ProduitForm, ProduitModel, Rayon, Fournisseur, Forme, Groupe } from '../types';
import { useTVA } from '../hooks/useTVA';
import {
  X, Package, Hash, Layers, DollarSign, AlertTriangle, Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { normalizeNumberInput } from '../utils/formatters';
import { getLocale } from '../utils/dateUtils';
import { productSchema } from '../schemas/productSchema';
import { Button } from './ui/Button';
import { Input } from './shadcn/input';
import { Select } from './ui/Select';
import { Checkbox } from './shadcn/checkbox';

const EMPTY_ARRAY: unknown[] = [];

interface ProduitFormModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (produit: ProduitModel) => void;
  onSuccess?: (produit: ProduitModel) => void;
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
  onSuccess,
  produitsEndpoint,
  initialData,
  title,
  rayons = EMPTY_ARRAY,
  fournisseurs = EMPTY_ARRAY,
  formes = EMPTY_ARRAY,
  groupes = EMPTY_ARRAY,
}: ProduitFormModalProps) {
  const { t } = useTranslation(['products', 'common']);
  const productId = (initialData as unknown)?.id;
  const isEditMode = Boolean(productId);
  const titleText = title || (isEditMode ? t('products:edit_title') : t('products:create_title'));
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

  useEffect(() => {
    if (open) {
      setLoading(false);
      setError(null);
      setForm({
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
    }
  }, [open, initialData]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const costPrice = normalizeNumberInput(form.cost_price);
  const sellingPrice = normalizeNumberInput(form.selling_price);
  const tvaRate = parseFloat(form.tva) || 0;

  // Calcul des marges
  let margeHT = 0;
  let coefMultiplicateur = 0;
  let pourcMarge = 0;
  let prixVenteHT = 0;
  let prixVenteTTC = 0;

  if (costPrice > 0) {
    // Le prix de vente saisi est HT (comme le prix de revient)
    prixVenteHT = sellingPrice;
    prixVenteTTC = sellingPrice * (1 + tvaRate / 100);

    // Marge HT = PV HT - PR HT
    margeHT = prixVenteHT - costPrice;

    // Coefficient multiplicateur = PV HT / PR HT
    coefMultiplicateur = prixVenteHT / costPrice;

    // % Marge = (Marge HT / PV HT) × 100  — harmonisé avec MarginService backend
    pourcMarge = prixVenteHT > 0 ? (margeHT / prixVenteHT) * 100 : 0;
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

      if (isEditMode) {
        const { data } = await api.patch<ProduitModel>(`${produitsEndpoint}${productId}/`, cleanPayload);
        onCreated?.(data);
        onSuccess?.(data);
      } else {
        const { data } = await api.post<ProduitModel>(produitsEndpoint, cleanPayload);
        onCreated?.(data);
        onSuccess?.(data);
      }
      onClose();
    } catch (err: unknown) {
      const anyErr = err as unknown;
      if (anyErr.response) {
        const detail = anyErr.response?.data ?? anyErr.message;
        const errorText = typeof detail === 'string' ? detail : formatBackendErrors(detail);
        setError(errorText);
        toast.error(`❌ ${errorText}`);
      } else {
        setError(t('products:form.validation.unknown_error'));
        toast.error(`❌ ${t('products:form.validation.unknown_error')}`);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const inputBase = "w-full rounded-lg border border-slate-200 bg-white text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none h-10 px-3 text-sm transition-all";
  const inputSm = "w-full rounded-lg border border-slate-200 bg-white text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none h-9 px-3 text-xs transition-all";
  const selectBase = "w-full rounded-lg border border-slate-200 bg-white text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none h-10 px-3 text-sm transition-all appearance-none";
  const selectSm = "w-full rounded-lg border border-slate-200 bg-white text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none h-9 px-3 text-xs transition-all appearance-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[96vh] overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Package className="size-5 text-indigo-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800">{titleText}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="size-5" />
          </button>
        </div>

        <form className="p-4 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-center gap-2 text-red-600 text-sm">
              <span className="shrink-0 text-lg">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Section: Identification */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-2 flex items-center gap-1.5">
              <Hash size={12} /> Identification
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.name')}</label>
                <Input type="text" className={inputBase} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required autoFocus />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.cip1')}</label>
                <Input className={`${inputBase} font-mono`} value={form.cip1} onChange={(e) => setForm((p) => ({ ...p, cip1: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.cip2')}</label>
                  <Input className={`${inputSm} font-mono`} value={form.cip2} onChange={(e) => setForm((p) => ({ ...p, cip2: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.cip3')}</label>
                  <Input className={`${inputSm} font-mono`} value={form.cip3} onChange={(e) => setForm((p) => ({ ...p, cip3: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Stock & Localisation */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-2 flex items-center gap-1.5">
              <Layers size={12} /> Stock & Localisation
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {!isEditMode && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.initial_stock')}</label>
                  <Input type="number" className={inputBase} value={form.stock} onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))} min={0} step={1} required />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.rayon')}</label>
                <Select className={selectBase} value={form.rayon} onChange={(e) => setForm((f) => ({ ...f, rayon: e.target.value }))}>
                  <option value="">{t('products:form.select_rayon')}</option>
                  {rayons.flatMap(parent => {
                    if (parent.parent) return [];
                    const children = rayons.filter(child => child.parent === parent.id);
                    return [(
                      <optgroup key={parent.id} label={parent.name}>
                        <option value={parent.id}>{parent.name}</option>
                        {children.map(child => (
                          <option key={child.id} value={child.id}>↳ {child.name}</option>
                        ))}
                      </optgroup>
                    )];
                  })}
                </Select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.provider')}</label>
                <Select className={selectBase} value={form.fournisseur} onChange={(e) => {
                  const val = e.target.value;
                  setForm((p) => ({ ...p, fournisseur: val, is_supplier_exclusive: val ? p.is_supplier_exclusive : false }));
                }}>
                  <option value="">-</option>
                  {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.alert')}</label>
                  <Input type="number" className={inputSm} value={form.stock_alert} onChange={(e) => setForm((p) => ({ ...p, stock_alert: e.target.value }))} min={0} step={1} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.min')}</label>
                  <Input type="number" className={inputSm} value={form.stock_minimum} onChange={(e) => setForm((p) => ({ ...p, stock_minimum: e.target.value }))} min={0} step={1} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.max')}</label>
                  <Input type="number" className={inputSm} value={form.stock_maximum} onChange={(e) => setForm((p) => ({ ...p, stock_maximum: e.target.value }))} min={0} step={1} />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Classification */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-2 flex items-center gap-1.5">
              <Layers size={12} /> Classification
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.forme')}</label>
                <Select className={selectBase} value={form.forme} onChange={(e) => setForm((p) => ({ ...p, forme: e.target.value }))}>
                  <option value="">-</option>
                  {formes.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.groupe')}</label>
                <Select className={selectBase} value={form.groupe} onChange={(e) => setForm((p) => ({ ...p, groupe: e.target.value }))}>
                  <option value="">-</option>
                  {groupes.map(g => <option key={g.id} value={g.id}>{g.nom}</option>)}
                </Select>
              </div>
            </div>
          </div>

          {/* Section: Tarification */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-2 flex items-center gap-1.5">
              <DollarSign size={12} /> Tarification
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.cost_price')} (HT)</label>
                <div className="flex">
                  <Input type="number" className={`${inputBase} rounded-r-none border-r-0`} value={form.cost_price} onChange={(e) => setForm((p) => ({ ...p, cost_price: e.target.value }))} step="0.01" required />
                  <span className="px-3 flex items-center bg-slate-100 border border-slate-200 border-l-0 rounded-r-lg text-slate-500 text-sm font-medium">F</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.selling_price')} (HT)</label>
                <div className="flex">
                  <Input type="number" className={`${inputBase} rounded-r-none border-r-0 font-semibold text-indigo-600`} value={form.selling_price} onChange={(e) => setForm((p) => ({ ...p, selling_price: e.target.value }))} step="0.01" required />
                  <span className="px-3 flex items-center bg-slate-100 border border-slate-200 border-l-0 rounded-r-lg text-slate-500 text-sm font-medium">F</span>
                </div>
                {sellingPrice > 0 && (
                  <p className="text-[10px] text-slate-400 mt-1">TTC : {prixVenteTTC.toFixed(2)} F</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.tva')}</label>
                <Select className={selectSm} value={form.tva} onChange={(e) => setForm((p) => ({ ...p, tva: e.target.value }))} disabled={loadingTVA}>
                  {tvaList.map((t) => (
                    <option key={t.id} value={t.taux}>{t.taux}% {t.libelle ? `(${t.libelle})` : ''}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Marge HT (F)</label>
                <div className={`${inputSm} flex items-center justify-center font-bold ${margeHT < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{margeHT.toFixed(2)} F</div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.margin_coeff')}</label>
                <div className={`${inputSm} flex items-center justify-center font-bold ${coefMultiplicateur < 1 ? 'text-red-600' : 'text-emerald-600'}`}>{coefMultiplicateur.toFixed(2)}</div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.margin_percent')}</label>
                <div className={`${inputSm} flex items-center justify-center font-bold ${pourcMarge < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{pourcMarge.toFixed(1)}%</div>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.expiration_date')}</label>
              <Input type="date" lang={getLocale()} className={`${inputBase} md:w-1/4`} value={form.expire_date} onChange={(e) => setForm((p) => ({ ...p, expire_date: e.target.value }))} />
            </div>
          </div>

          {/* Section: Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-white border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => setForm((p) => ({ ...p, use_lot_management: !p.use_lot_management }))}>
              <Checkbox checked={form.use_lot_management} onCheckedChange={(checked) => setForm((p) => ({ ...p, use_lot_management: !!checked }))} />
              <div>
                <span className="text-sm font-medium text-slate-800">{t('products:form.lot_management')}</span>
                <p className="text-[10px] text-slate-400">{t('products:form.lot_management_desc')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-blue-50 border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer" onClick={() => setForm(p => ({ ...p, requires_prescription: !p.requires_prescription }))}>
              <Checkbox checked={form.requires_prescription} onCheckedChange={(checked) => setForm(p => ({ ...p, requires_prescription: !!checked }))} />
              <div>
                <span className="text-sm font-medium text-slate-800">{t('products:form.requires_prescription')}</span>
                <p className="text-[10px] text-slate-400">{t('products:form.prescription_desc')}</p>
              </div>
            </div>
            <div className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${form.fournisseur ? 'bg-amber-50 border-amber-100 hover:bg-amber-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`} onClick={() => form.fournisseur && setForm((p) => ({ ...p, is_supplier_exclusive: !p.is_supplier_exclusive }))}>
              <Checkbox checked={form.is_supplier_exclusive} onCheckedChange={(checked) => setForm((p) => ({ ...p, is_supplier_exclusive: !!checked }))} disabled={!form.fournisseur} />
              <div>
                <span className="text-sm font-medium text-slate-800">{t('products:form.supplier_exclusive')}</span>
                <p className="text-[10px] text-slate-400">
                  {t('products:form.exclusive_desc', { provider: form.fournisseur ? fournisseurs.find(f => String(f.id) === form.fournisseur)?.name : t('products:form.provider_placeholder_short') })}
                </p>
              </div>
            </div>
          </div>

          {/* Section: Alerte comptoir */}
          <div className="bg-red-50 rounded-lg border border-red-100 p-3">
            <label className="block text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <AlertTriangle size={12} /> Message d&apos;alerte comptoir
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-200 bg-white hover:border-slate-300 focus:border-red-400 focus:ring-1 focus:ring-red-100 transition-all min-h-[60px] text-sm p-2 outline-none"
              placeholder="Ex: Changement de conditionnement, vérifier le code barre..."
              value={form.message_alerte || ''}
              onChange={(e) => setForm((p) => ({ ...p, message_alerte: e.target.value }))}
            />
            <p className="text-[10px] text-slate-400 mt-1">Ce message s&apos;affichera en plein écran lors du passage de ce produit en caisse.</p>
          </div>

          {/* Section: Réserve */}
          <div className="bg-indigo-50/50 rounded-lg border border-indigo-100 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Layers className="text-indigo-600 size-4" />
                <div>
                  <h4 className="text-sm font-semibold text-indigo-600">{t('products:form.reserve_title')}</h4>
                  <p className="text-[10px] text-indigo-400 font-medium">{t('products:form.reserve_desc')}</p>
                </div>
              </div>
              <Checkbox checked={form.has_reserve_storage} onCheckedChange={(checked) => {
                const isChecked = !!checked;
                setForm(p => ({ ...p, has_reserve_storage: isChecked, capacite_rayon: (isChecked && (p.capacite_rayon === '0' || !p.capacite_rayon)) ? '50' : p.capacite_rayon, min_rayon: (isChecked && (p.min_rayon === '0' || !p.min_rayon)) ? '10' : p.min_rayon }));
              }} />
            </div>
            {form.has_reserve_storage && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.rayon_capacity')}</label>
                  <Input type="number" className={inputBase} placeholder={t('products:form.placeholder_capacity')} value={form.capacite_rayon} onChange={(e) => setForm(p => ({ ...p, capacite_rayon: e.target.value }))} />
                  <p className="text-xs text-slate-400 mt-1">{t('products:form.capacity_desc')}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.rayon_reorder_threshold')}</label>
                  <Input type="number" className={inputBase} placeholder={t('products:form.placeholder_reorder')} value={form.min_rayon} onChange={(e) => setForm(p => ({ ...p, min_rayon: e.target.value }))} />
                  <p className="text-xs text-slate-400 mt-1">{t('products:form.reorder_desc')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Pathologie Chronique */}
          <div className={`p-3 rounded-lg border transition-all cursor-pointer ${form.is_chronic ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-200 hover:bg-slate-100'}`} onClick={() => setForm((p) => ({ ...p, is_chronic: !p.is_chronic }))}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Checkbox checked={form.is_chronic} onCheckedChange={(checked) => setForm((p) => ({ ...p, is_chronic: !!checked }))} />
                <div>
                  <span className="text-sm font-medium text-slate-800">{t('products:form.chronic_pathology')}</span>
                  <p className="text-xs text-slate-500">{t('products:form.chronic_desc')}</p>
                </div>
              </div>
              {form.is_chronic && (
                <div className="w-full md:w-48">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{t('products:form.treatment_duration')}</label>
                  <div className="flex">
                    <Input type="number" className={`${inputSm} rounded-r-none border-r-0`} value={form.default_treatment_days} onChange={(e) => setForm((p) => ({ ...p, default_treatment_days: e.target.value }))} min={1} />
                    <span className="px-3 flex items-center bg-slate-100 border border-slate-200 border-l-0 rounded-r-lg text-slate-500 text-xs font-medium">{t('common:days')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              {t('common:cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : `💾 ${isEditMode ? t('common:save') : t('products:actions.create')}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}