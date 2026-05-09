import React from 'react';
import PremiumModal from '../common/PremiumModal';
import type { useFournisseurs } from '../../hooks/useFournisseurs';

interface Props {
  hook: ReturnType<typeof useFournisseurs>;
}

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

  return (
    <>
      {/* Add Modal */}
      <PremiumModal
        isOpen={isAddModalOpen}
        onClose={actions.closeAddModal}
        title={t('providers:form.add_title')}
        subtitle={t('providers:form.company_info')}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        }
        maxWidth="max-w-2xl"
        disableClose={isSubmitting}
      >
        <form className="p-6 space-y-6" onSubmit={actions.handleAddFournisseur}>
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/40 border-b border-gray-100 pb-2">
              {t('providers:form.company_info')}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('providers:form.name')} *</label>
                <input 
                  type="text" 
                  placeholder={t('providers:form.name_placeholder')}
                  value={newFournisseur.name} 
                  onChange={e => state.setNewFournisseur(f => ({...f, name: e.target.value}))} 
                  className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                  required 
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('providers:form.phone')} *</label>
                <input 
                  type="tel" 
                  placeholder={t('providers:form.phone_placeholder')}
                  value={newFournisseur.phone} 
                  onChange={e => state.setNewFournisseur(f => ({...f, phone: e.target.value}))} 
                  className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                  required 
                  disabled={isSubmitting}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('providers:form.email')} *</label>
              <input 
                type="email" 
                placeholder={t('providers:form.email_placeholder')}
                value={newFournisseur.email} 
                onChange={e => state.setNewFournisseur(f => ({...f, email: e.target.value}))} 
                className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                required 
                disabled={isSubmitting}
              />
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-100 rounded-xl">
              <input
                type="checkbox"
                id="is_divers_add"
                checked={newFournisseur.is_divers || false}
                onChange={e => state.setNewFournisseur(f => ({...f, is_divers: e.target.checked}))}
                className="checkbox checkbox-primary checkbox-sm"
                disabled={isSubmitting}
              />
              <div className="flex flex-col">
                <label htmlFor="is_divers_add" className="text-sm font-semibold text-gray-700 cursor-pointer">
                  Fournisseur Divers
                </label>
                <span className="text-[11px] text-gray-500">Utilisé pour la gestion des achats divers (produits hors catalogue principal).</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/40 border-b border-gray-100 pb-2">
              {t('providers:form.payment_conditions')}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('providers:form.payment_type')}</label>
                <select 
                  value={newFournisseur.type_reglement} 
                  onChange={e => state.setNewFournisseur(f => ({...f, type_reglement: e.target.value as 'FACTURE'|'RELEVE'}))} 
                  className="select select-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                  disabled={isSubmitting}
                >
                  <option value="FACTURE">{t('providers:form.payment_type_invoice')}</option>
                  <option value="RELEVE">{t('providers:form.payment_type_statement')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('providers:form.delay')}</label>
                <input 
                  type="number" 
                  min="0"
                  placeholder={t('providers:form.delay_hint')}
                  value={newFournisseur.delai_paiement_jours} 
                  onChange={e => state.setNewFournisseur(f => ({...f, delai_paiement_jours: parseInt(e.target.value) || 0}))} 
                  className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {newFournisseur.type_reglement === 'RELEVE' && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <label className="block text-xs font-bold uppercase tracking-wider text-orange-600 mb-2">
                  Durée de la tranche de relevé (jours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex: 10 → tranches du 1-10, 11-20, 21-31"
                  value={newFournisseur.periode_releve_jours ?? 10}
                  onChange={e => state.setNewFournisseur(f => ({...f, periode_releve_jours: parseInt(e.target.value) || 10}))}
                  className="input input-bordered w-full h-12 rounded-xl focus:border-orange-400 focus:ring-2 focus:ring-orange-200 transition-all"
                  disabled={isSubmitting}
                />
                <p className="text-[11px] text-orange-500/80 mt-1">
                  Le relevé commence le 1er du mois. Ex: 10 jours → tranche 1→10, 11→20, 21→fin du mois.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/40 border-b border-gray-100 pb-2">
              {t('providers:form.address_section')}
            </h4>
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('providers:form.address')} *</label>
              <textarea 
                placeholder={t('providers:form.address_placeholder')}
                value={newFournisseur.address} 
                onChange={e => state.setNewFournisseur(f => ({...f, address: e.target.value}))} 
                className="textarea textarea-bordered w-full h-24 rounded-xl resize-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                required 
                disabled={isSubmitting}
              />
              <p className="text-[11px] text-base-content/40 mt-1">{t('providers:form.address_hint')}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn btn-ghost px-6 rounded-xl" onClick={actions.closeAddModal} disabled={isSubmitting}>
              {t('providers:form.cancel')}
            </button>
            <button type="submit" className="btn btn-primary px-8 rounded-xl shadow-lg shadow-primary/20" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  {t('providers:form.saving', { defaultValue: 'Enregistrement...' })}
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {t('providers:form.add_btn')}
                </>
              )}
            </button>
          </div>
        </form>
      </PremiumModal>

      {/* Edit Modal */}
      <PremiumModal
        isOpen={isEditModalOpen}
        onClose={actions.closeEditModal}
        title={t('providers:form.edit_title')}
        subtitle={editingFournisseur?.name || ''}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        }
        gradientFrom="secondary/10"
        gradientVia="primary/5"
        gradientTo="accent/10"
        maxWidth="max-w-2xl"
      >
        {editingFournisseur && (
          <form className="p-6 space-y-6" onSubmit={actions.handleEditFournisseur}>
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/40 border-b border-gray-100 pb-2">
                {t('providers:form.company_info')}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('providers:form.name')} *</label>
                  <input 
                    type="text" 
                    placeholder={t('providers:form.name_placeholder')}
                    value={editingFournisseur.name} 
                    onChange={e => state.setEditingFournisseur(f => f ? {...f, name: e.target.value} : null)} 
                    className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                    required 
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('providers:form.phone')} *</label>
                  <input 
                    type="tel" 
                    placeholder={t('providers:form.phone_placeholder')}
                    value={editingFournisseur.phone} 
                    onChange={e => state.setEditingFournisseur(f => f ? {...f, phone: e.target.value} : null)} 
                    className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                    required 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('providers:form.email')} *</label>
                <input 
                  type="email" 
                  placeholder={t('providers:form.email_placeholder')}
                  value={editingFournisseur.email} 
                  onChange={e => state.setEditingFournisseur(f => f ? {...f, email: e.target.value} : null)} 
                  className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                  required 
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-100 rounded-xl">
                <input
                  type="checkbox"
                  id="is_divers_edit"
                  checked={editingFournisseur.is_divers || false}
                  onChange={e => state.setEditingFournisseur(f => f ? {...f, is_divers: e.target.checked} : null)}
                  className="checkbox checkbox-primary checkbox-sm"
                />
                <div className="flex flex-col">
                  <label htmlFor="is_divers_edit" className="text-sm font-semibold text-gray-700 cursor-pointer">
                    Fournisseur Divers
                  </label>
                  <span className="text-[11px] text-gray-500">Utilisé pour la gestion des achats divers (produits hors catalogue principal).</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/40 border-b border-gray-100 pb-2">
                {t('providers:form.payment_conditions')}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('providers:form.payment_type')}</label>
                  <select 
                    value={editingFournisseur.type_reglement || 'FACTURE'} 
                    onChange={e => state.setEditingFournisseur(f => f ? {...f, type_reglement: e.target.value as 'FACTURE'|'RELEVE'} : null)} 
                    className="select select-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                  >
                    <option value="FACTURE">{t('providers:form.payment_type_invoice')}</option>
                    <option value="RELEVE">{t('providers:form.payment_type_statement')}</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('providers:form.delay')}</label>
                  <input 
                    type="number" 
                    min="0"
                    placeholder={t('providers:form.delay_hint')}
                    value={editingFournisseur.delai_paiement_jours ?? 0} 
                    onChange={e => state.setEditingFournisseur(f => f ? {...f, delai_paiement_jours: parseInt(e.target.value) || 0} : null)} 
                    className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                  />
                </div>
              </div>

              {editingFournisseur.type_reglement === 'RELEVE' && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                  <label className="block text-xs font-bold uppercase tracking-wider text-orange-600 mb-2">
                    Durée de la tranche de relevé (jours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Ex: 10 → tranches du 1-10, 11-20, 21-31"
                    value={editingFournisseur.periode_releve_jours ?? 10}
                    onChange={e => state.setEditingFournisseur(f => f ? {...f, periode_releve_jours: parseInt(e.target.value) || 10} : null)}
                    className="input input-bordered w-full h-12 rounded-xl focus:border-orange-400 focus:ring-2 focus:ring-orange-200 transition-all"
                  />
                  <p className="text-[11px] text-orange-500/80 mt-1">
                    Le relevé commence le 1er du mois. Ex: 10 jours → tranche 1→10, 11→20, 21→fin du mois.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/40 border-b border-gray-100 pb-2">
                {t('providers:form.address_section')}
              </h4>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('providers:form.address')} *</label>
                <textarea 
                  placeholder={t('providers:form.address_placeholder')}
                  value={editingFournisseur.address} 
                  onChange={e => state.setEditingFournisseur(f => f ? {...f, address: e.target.value} : null)} 
                  className="textarea textarea-bordered w-full h-24 rounded-xl resize-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                  required 
                />
                <p className="text-[11px] text-base-content/40 mt-1">{t('providers:form.address_hint')}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn btn-ghost px-6 rounded-xl" onClick={actions.closeEditModal}>
                {t('providers:form.cancel')}
              </button>
              <button type="submit" className="btn btn-secondary px-8 rounded-xl shadow-lg shadow-secondary/20">
                {t('providers:form.save_btn')}
              </button>
            </div>
          </form>
        )}
      </PremiumModal>
    </>
  );
}
