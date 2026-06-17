import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Plus, Trash2, Save, User, Award, Activity, Mail,
  Phone, MapPin, ShieldCheck, CreditCard, Building2, FileText
} from 'lucide-react';
import type { Client, AyantDroit } from '../../types';

interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  data: Partial<Client>;
  setData: (data: any) => void;
  isSubmitting: boolean;
  isEdit?: boolean;
}

function Field({
  label, icon: Icon, children, required
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-base-content/60">
        <Icon className="size-3.5 text-indigo-500" />
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function ClientFormModal({
  isOpen, onClose, onSubmit, data, setData, isSubmitting, isEdit = false
}: ClientFormModalProps) {
  const { t } = useTranslation(['clients', 'common']);
  const [tempAD, setTempAD] = useState<AyantDroit>({ matricule: '', nom: '', societe: '' });

  if (!isOpen) return null;

  const isPro = data.client_type === 'PROFESSIONNEL';

  const addAD = () => {
    if (!tempAD.matricule || !tempAD.nom) return;
    setData({ ...data, ayants_droit: [...(data.ayants_droit || []), { ...tempAD }] });
    setTempAD({ matricule: '', nom: '', societe: '' });
  };

  const removeAD = (index: number) => {
    const updated = [...(data.ayants_droit || [])];
    updated.splice(index, 1);
    setData({ ...data, ayants_droit: updated });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl max-h-[92vh] flex flex-col bg-base-100 rounded-xl shadow-2xl border border-base-200 m-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <User className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-base-content leading-tight">
                {isEdit ? t('clients:actions.edit') : t('clients:actions.create')}
              </h2>
              {isEdit && data.id && (
                <span className="text-[10px] text-base-content/50 font-medium uppercase tracking-wider">
                  ID {data.id}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-base-200 rounded-lg transition-colors">
            <X className="size-5 text-base-content/50" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Section: Type */}
          <div className="flex gap-3">
            {(['PARTICULIER', 'PROFESSIONNEL'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setData({ ...data, client_type: type })}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  data.client_type === type
                    ? 'border-indigo-500 bg-primary/10 text-primary'
                    : 'border-base-300 bg-base-100 text-base-content/70 hover:border-base-300 hover:bg-base-200'
                }`}
              >
                {type === 'PARTICULIER' ? <User className="size-4" /> : <Building2 className="size-4" />}
                {t(`clients:types.${type.toLowerCase()}`)}
              </button>
            ))}
          </div>

          {/* Section: Informations générales */}
          <div className="bg-base-100 p-5 rounded-xl border border-base-200 shadow-sm space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
              {t('clients:sections.general_info')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t('common:name')} icon={User} required>
                <input
                  value={data.name || ''}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  required
                  className="input-ref input-bordered input-sm w-full h-10 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                  placeholder="Nom complet"
                />
              </Field>

              <Field label={t('common:phone')} icon={Phone}>
                <input
                  value={data.phone || ''}
                  onChange={(e) => setData({ ...data, phone: e.target.value })}
                  className="input-ref input-bordered input-sm w-full h-10 rounded-lg font-mono focus:border-primary focus:ring-1 focus:ring-primary/20"
                  placeholder="+225 XX XX XX XX"
                />
              </Field>

              <Field label={t('common:email')} icon={Mail}>
                <input
                  type="text"
                  value={data.email || ''}
                  onChange={(e) => setData({ ...data, email: e.target.value })}
                  className="input-ref input-bordered input-sm w-full h-10 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                  placeholder="email@exemple.com"
                />
              </Field>

              <Field label={t('clients:fields.address')} icon={MapPin}>
                <input
                  value={data.address || ''}
                  onChange={(e) => setData({ ...data, address: e.target.value })}
                  className="input-ref input-bordered input-sm w-full h-10 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                  placeholder="Adresse complète"
                />
              </Field>
            </div>
          </div>

          {/* Section: Informations professionnelles */}
          {isPro && (
            <div className="bg-base-100 p-5 rounded-xl border border-base-200 shadow-sm space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
                {t('clients:sections.pro_info')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="NIU" icon={ShieldCheck}>
                  <input
                    value={(data as any).niu || ''}
                    onChange={(e) => setData({ ...data, niu: e.target.value })}
                    className="input-ref input-bordered input-sm w-full h-10 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                    placeholder="N° Identifiant Unique"
                  />
                </Field>
                <Field label="RCCM" icon={FileText}>
                  <input
                    value={(data as any).registre_commerce || ''}
                    onChange={(e) => setData({ ...data, registre_commerce: e.target.value })}
                    className="input-ref input-bordered input-sm w-full h-10 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                    placeholder="Registre du Commerce"
                  />
                </Field>
              </div>
            </div>
          )}

          {/* Section: Paramètres */}
          <div className="bg-base-100 p-5 rounded-xl border border-base-200 shadow-sm space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
              {t('clients:sections.settings')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Actif */}
              <label className="flex items-center justify-between p-3 rounded-lg border border-base-200 bg-base-200 cursor-pointer hover:border-base-300 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-md ${data.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-base-300 text-base-content/50'}`}>
                    <Activity className="size-4" />
                  </div>
                  <span className="text-sm font-medium text-base-content">{t('common:is_active')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={data.is_active ?? true}
                  onChange={(e) => setData({ ...data, is_active: e.target.checked })}
                  className="toggle toggle-success toggle-sm"
                />
              </label>

              {/* Fidélité */}
              <label className="flex items-center justify-between p-3 rounded-lg border border-base-200 bg-base-200 cursor-pointer hover:border-base-300 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-md ${data.is_loyalty_member ?? true ? 'bg-warning/20 text-warning' : 'bg-base-300 text-base-content/50'}`}>
                    <Award className="size-4" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-base-content block">{t('clients:fields.loyalty_member')}</span>
                    {(data.is_loyalty_member ?? true) && (
                      <span className="text-[10px] text-warning font-medium">{data.points_fidelite || 0} pts</span>
                    )}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={data.is_loyalty_member ?? true}
                  onChange={(e) => setData({ ...data, is_loyalty_member: e.target.checked })}
                  className="toggle toggle-warning toggle-sm"
                />
              </label>

              {/* Dépôt */}
              {!isPro && (
                <label className="flex items-center justify-between p-3 rounded-lg border border-base-200 bg-base-200 cursor-pointer hover:border-base-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md ${data.is_deposit_enabled ? 'bg-primary/20 text-primary' : 'bg-base-300 text-base-content/50'}`}>
                      <CreditCard className="size-4" />
                    </div>
                    <span className="text-sm font-medium text-base-content">{t('clients:fields.is_deposit_enabled')}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={data.is_deposit_enabled ?? false}
                    onChange={(e) => setData({ ...data, is_deposit_enabled: e.target.checked })}
                    className="toggle toggle-primary toggle-sm"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Section: Conditions financières */}
          <div className="bg-base-100 p-5 rounded-xl border border-base-200 shadow-sm space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
              {t('clients:sections.finance')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label={t('clients:finance.auto_discount') + ' (%)'} icon={ShieldCheck}>
                <input
                  type="number"
                  min={0} max={100}
                  value={data.remise_automatique || '0'}
                  onChange={(e) => setData({ ...data, remise_automatique: e.target.value })}
                  className="input-ref input-bordered input-sm w-full h-10 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </Field>
              {isPro && (
                <>
                  <Field label={t('clients:finance.credit_limit')} icon={CreditCard}>
                    <input
                      type="number"
                      value={data.plafond || '0'}
                      onChange={(e) => setData({ ...data, plafond: e.target.value })}
                      className="input-ref input-bordered input-sm w-full h-10 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  </Field>
                  <Field label={t('clients:finance.coverage') + ' (%)'} icon={ShieldCheck}>
                    <input
                      type="number"
                      min={0} max={100}
                      value={data.taux_couverture || '0'}
                      onChange={(e) => setData({ ...data, taux_couverture: e.target.value })}
                      className="input-ref input-bordered input-sm w-full h-10 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  </Field>
                  <Field label={t('clients:finance.majoration_pro') + ' (%)'} icon={ShieldCheck}>
                    <input
                      type="number"
                      min={0} max={100}
                      value={data.majoration_pro_pourcentage || '0'}
                      onChange={(e) => setData({ ...data, majoration_pro_pourcentage: e.target.value })}
                      className="input-ref input-bordered input-sm w-full h-10 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  </Field>
                </>
              )}
            </div>
          </div>

          {/* Section: Ayants droit */}
          {isPro && (
            <div className="bg-base-100 p-5 rounded-xl border border-base-200 shadow-sm space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
                {t('clients:beneficiaries.title')}
              </h3>
              <div className="flex gap-2 items-end">
                <div className="flex-1 min-w-0">
                  <input
                    value={tempAD.nom}
                    onChange={(e) => setTempAD({ ...tempAD, nom: e.target.value })}
                    className="input-ref input-bordered input-sm w-full h-9 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                    placeholder={t('clients:beneficiaries.name_placeholder')}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    value={tempAD.matricule}
                    onChange={(e) => setTempAD({ ...tempAD, matricule: e.target.value })}
                    className="input-ref input-bordered input-sm w-full h-9 rounded-lg font-mono focus:border-primary focus:ring-1 focus:ring-primary/20"
                    placeholder={t('clients:beneficiaries.id_placeholder')}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    value={tempAD.societe || ''}
                    onChange={(e) => setTempAD({ ...tempAD, societe: e.target.value })}
                    className="input-ref input-bordered input-sm w-full h-9 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                    placeholder="Société"
                  />
                </div>
                <button
                  type="button"
                  onClick={addAD}
                  disabled={!tempAD.nom || !tempAD.matricule}
                  className="inline-flex items-center px-3 py-2 h-9 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary-focus disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              {data.ayants_droit && data.ayants_droit.length > 0 && (
                <div className="rounded-xl overflow-hidden border border-base-200">
                  <table className="min-w-full divide-y divide-base-300">
                    <thead className="bg-base-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-[10px] font-semibold text-base-content/60 uppercase tracking-wider">{t('common:name')}</th>
                        <th className="px-4 py-2 text-left text-[10px] font-semibold text-base-content/60 uppercase tracking-wider">{t('clients:beneficiaries.col_id')}</th>
                        <th className="px-4 py-2 text-left text-[10px] font-semibold text-base-content/60 uppercase tracking-wider">{t('clients:beneficiaries.company')}</th>
                        <th className="px-4 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-base-100 divide-y divide-base-200">
                      {data.ayants_droit.map((ad: AyantDroit, idx: number) => (
                        <tr key={idx} className="hover:bg-base-200 transition-colors">
                          <td className="px-4 py-2.5 text-sm font-medium text-base-content">{ad.nom}</td>
                          <td className="px-4 py-2.5 text-sm font-mono text-base-content/60">{ad.matricule}</td>
                          <td className="px-4 py-2.5 text-sm text-base-content/60">{ad.societe || '—'}</td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => removeAD(idx)}
                              className="p-1 text-base-content/40 hover:text-error hover:bg-error/10 rounded-md transition-colors"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-base-200 bg-base-200/50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center px-5 py-2 text-sm font-medium rounded-lg border border-base-300 bg-base-100 text-base-content hover:bg-base-200 transition-colors"
          >
            {t('common:cancel')}
          </button>
          <button
            type="submit"
            onClick={(e) => { e.preventDefault(); onSubmit(e as any); }}
            disabled={isSubmitting}
            className="inline-flex items-center px-6 py-2 text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary-focus disabled:opacity-60 transition-colors gap-2"
          >
            {isSubmitting ? (
              <span className="inline-block size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {isEdit ? t('common:save_changes') : t('common:add')}
          </button>
        </div>
      </div>
    </div>
  );
}

