import { X, Plus, Save, Building2 } from 'lucide-react';
import type { useFournisseurs } from '../../hooks/useFournisseurs';

interface Props {
  hook: ReturnType<typeof useFournisseurs>;
}

// Composants Field et Section déplacés hors du composant parent pour éviter recréation à chaque render
const Field = ({
  label, children, required
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-medium text-base-content/60">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-base-100 p-5 rounded-xl border border-base-200 shadow-sm space-y-4">
    <h4 className="text-xs font-semibold uppercase tracking-wider text-base-content/50">
      {title}
    </h4>
    {children}
  </div>
);

export default function FournisseurFormModals({ hook }: Props) {
  const { state, actions } = hook;
  const {
    t,
    isAddModalOpen,
    isEditModalOpen,
    newFournisseur,
    editingFournisseur,
    isSubmitting
  } = state;

  const renderForm = (isEdit: boolean) => {
    const data = isEdit ? editingFournisseur : newFournisseur;
    if (!data) return null;

    const setData = isEdit
      ? (fn: any) => state.setEditingFournisseur(fn)
      : (fn: any) => state.setNewFournisseur(fn);

    const handleSubmit = isEdit ? actions.handleEditFournisseur : actions.handleAddFournisseur;
    const close = isEdit ? actions.closeEditModal : actions.closeAddModal;
    const btnLabel = isEdit ? t('providers:form.save_btn') : t('providers:form.add_btn');
    const title = isEdit ? t('providers:form.edit_title') : t('providers:form.add_title');

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={close} />
        <div className="relative z-10 w-full max-w-2xl max-h-[92vh] flex flex-col bg-base-100 rounded-xl shadow-2xl border border-base-200 m-4">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-base-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <Building2 className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-base-content leading-tight">{title}</h2>
                {isEdit && editingFournisseur && (
                  <span className="text-[10px] text-base-content/50 font-medium">{editingFournisseur.name}</span>
                )}
              </div>
            </div>
            <button onClick={close} className="p-2 hover:bg-base-200 rounded-lg transition-colors">
              <X className="size-5 text-base-content/50" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            <Section title={t('providers:form.company_info')}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t('providers:form.name')} required>
                  <input
                    type="text"
                    placeholder={t('providers:form.name_placeholder')}
                    value={data.name}
                    onChange={e => setData((f: any) => ({...f, name: e.target.value}))}
                    className="input-ref input-bordered input-sm w-full h-10 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                    required
                    disabled={isSubmitting}
                    autoFocus={!isEdit}
                  />
                </Field>
                <Field label={t('providers:form.phone')} required>
                  <input
                    type="tel"
                    placeholder={t('providers:form.phone_placeholder')}
                    value={data.phone}
                    onChange={e => setData((f: any) => ({...f, phone: e.target.value}))}
                    className="input-ref input-bordered input-sm w-full h-10 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                    required
                    disabled={isSubmitting}
                  />
                </Field>
              </div>
              <Field label={t('providers:form.email')}>
                <input
                  type="email"
                  placeholder={t('providers:form.email_placeholder')}
                  value={data.email}
                  onChange={e => setData((f: any) => ({...f, email: e.target.value}))}
                  className="input-ref input-bordered input-sm w-full h-10 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                  disabled={isSubmitting}
                />
              </Field>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-base-200 bg-base-200 cursor-pointer hover:border-base-300 transition-colors">
                <input
                  type="checkbox"
                  checked={data.is_divers || false}
                  onChange={e => setData((f: any) => ({...f, is_divers: e.target.checked}))}
                  className="size-4 rounded border-base-300 text-primary focus:ring-primary cursor-pointer"
                  disabled={isSubmitting}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-base-content">Fournisseur Divers</span>
                  <span className="text-[11px] text-base-content/60">Utilisé pour la gestion des achats divers.</span>
                </div>
              </label>
            </Section>

            <Section title={t('providers:form.payment_conditions')}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label={t('providers:form.payment_type')}>
                  <select
                    value={data.type_reglement}
                    onChange={e => setData((f: any) => ({...f, type_reglement: e.target.value as 'FACTURE'|'RELEVE'}))}
                    className="select-ref select-bordered select-sm w-full h-10 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                    disabled={isSubmitting}
                  >
                    <option value="FACTURE">{t('providers:form.payment_type_invoice')}</option>
                    <option value="RELEVE">{t('providers:form.payment_type_statement')}</option>
                  </select>
                </Field>
                <Field label={t('providers:form.delay')}>
                  <input
                    type="number"
                    min="0"
                    placeholder={t('providers:form.delay_hint')}
                    value={data.delai_paiement_jours}
                    onChange={e => setData((f: any) => ({...f, delai_paiement_jours: parseInt(e.target.value) || 0}))}
                    className="input-ref input-bordered input-sm w-full h-10 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                    disabled={isSubmitting}
                  />
                </Field>
              </div>
              {data.type_reglement === 'RELEVE' && (
                <div className="p-4 bg-warning/10 border border-orange-100 rounded-lg">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-warning mb-2">
                    Durée de la tranche de relevé (jours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Ex: 10"
                    value={data.periode_releve_jours ?? 10}
                    onChange={e => setData((f: any) => ({...f, periode_releve_jours: parseInt(e.target.value) || 10}))}
                    className="input-ref input-bordered input-sm w-full h-10 rounded-lg focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
                    disabled={isSubmitting}
                  />
                  <p className="text-[11px] text-orange-500 mt-1">Le relevé commence le 1er du mois.</p>
                </div>
              )}
            </Section>

            <Section title={t('providers:form.address_section')}>
              <Field label={t('providers:form.address')}>
                <textarea
                  placeholder={t('providers:form.address_placeholder')}
                  value={data.address}
                  onChange={e => setData((f: any) => ({...f, address: e.target.value}))}
                  className="textarea-ref textarea-bordered textarea-sm w-full h-24 rounded-lg resize-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  disabled={isSubmitting}
                />
              </Field>
              <p className="text-[11px] text-base-content/50">{t('providers:form.address_hint')}</p>
            </Section>
          </form>

          {/* Footer */}
          <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-base-200 bg-base-200/50 rounded-b-xl">
            <button
              type="button"
              onClick={close}
              disabled={isSubmitting}
              className="inline-flex items-center px-5 py-2 text-sm font-medium rounded-lg border border-base-300 bg-base-100 text-base-content hover:bg-base-200 transition-colors"
            >
              {t('providers:form.cancel')}
            </button>
            <button
              type="submit"
              onClick={(e) => { e.preventDefault(); handleSubmit(e as any); }}
              disabled={isSubmitting}
              className="inline-flex items-center px-6 py-2 text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary-focus disabled:opacity-60 transition-colors gap-2"
            >
              {isSubmitting ? (
                <span className="inline-block size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                isEdit ? <Save className="size-4" /> : <Plus className="size-4" />
              )}
              {btnLabel}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {isAddModalOpen && renderForm(false)}
      {isEditModalOpen && renderForm(true)}
    </>
  );
}
