import { useTranslation } from 'react-i18next'
import PremiumModal from '../common/PremiumModal'

interface ClientCreateModalProps {
  isOpen: boolean
  onClose: () => void
  newClientForm: {
    client_type: 'PARTICULIER' | 'PROFESSIONNEL'
    name: string
    phone: string
    email: string
    address: string
    plafond: string
    taux_couverture: string
  }
  setNewClientForm: (val: any) => void
  isCreatingClient: boolean
  handleCreateClient: (e: React.FormEvent) => void
}

export default function ClientCreateModal({
  isOpen,
  onClose,
  newClientForm,
  setNewClientForm,
  isCreatingClient,
  handleCreateClient
}: ClientCreateModalProps) {
  const { t } = useTranslation(['facturation', 'common'])

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={`➕ ${t('create_client.title')}`}
      subtitle={newClientForm.client_type === 'PARTICULIER' 
        ? t('create_client.individual') 
        : t('create_client.professional')}
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      }
      maxWidth="max-w-lg"
      disableClose={isCreatingClient}
    >
      <form onSubmit={handleCreateClient} className="p-6 space-y-5">
        {/* Type de client */}
        <div className="flex gap-4">
          <label className="label cursor-pointer gap-2">
            <input
              type="radio"
              className="radio radio-primary radio-sm"
              checked={newClientForm.client_type === 'PARTICULIER'}
              onChange={() => setNewClientForm((prev: any) => ({ ...prev, client_type: 'PARTICULIER' }))}
            />
            <span className="label-text">{t('create_client.individual')}</span>
          </label>
          <label className="label cursor-pointer gap-2">
            <input
              type="radio"
              className="radio radio-secondary radio-sm"
              checked={newClientForm.client_type === 'PROFESSIONNEL'}
              onChange={() => setNewClientForm((prev: any) => ({ ...prev, client_type: 'PROFESSIONNEL' }))}
            />
            <span className="label-text">{t('create_client.professional')}</span>
          </label>
        </div>

        {/* Infos de base */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('create_client.name')} *</label>
            <input
              type="text"
              value={newClientForm.name}
              onChange={e => setNewClientForm((prev: any) => ({ ...prev, name: e.target.value }))}
              className="input input-bordered input-sm w-full rounded-xl"
              placeholder={t('create_client.name')}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('create_client.phone')} *</label>
            <input
              type="tel"
              value={newClientForm.phone}
              onChange={e => setNewClientForm((prev: any) => ({ ...prev, phone: e.target.value }))}
              className="input input-bordered input-sm w-full rounded-xl"
              placeholder={t('create_client.phone')}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('create_client.email')} *</label>
          <input
            type="email"
            value={newClientForm.email}
            onChange={e => setNewClientForm((prev: any) => ({ ...prev, email: e.target.value }))}
            className="input input-bordered input-sm w-full rounded-xl"
            placeholder={t('create_client.email')}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('create_client.address')} *</label>
          <textarea
            value={newClientForm.address}
            onChange={e => setNewClientForm((prev: any) => ({ ...prev, address: e.target.value }))}
            className="textarea textarea-bordered textarea-sm w-full h-16 resize-none rounded-xl"
            placeholder={t('create_client.address')}
            required
          />
        </div>

        {/* Champs professionnels */}
        {newClientForm.client_type === 'PROFESSIONNEL' && (
          <div className="bg-base-200 p-4 rounded-xl space-y-3">
            <h4 className="text-sm font-bold text-secondary">{t('create_client.pro_options')}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('create_client.credit_limit')}</label>
                <input
                  type="number"
                  value={newClientForm.plafond}
                  onChange={e => setNewClientForm((prev: any) => ({ ...prev, plafond: e.target.value }))}
                  className="input input-bordered input-sm w-full rounded-xl"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('create_client.coverage')}</label>
                <input
                  type="number"
                  value={newClientForm.taux_couverture}
                  onChange={e => setNewClientForm((prev: any) => ({ ...prev, taux_couverture: e.target.value }))}
                  className="input input-bordered input-sm w-full rounded-xl"
                  min="0"
                  max="100"
                />
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn btn-ghost px-6 rounded-xl" onClick={onClose}>
            {t('create_client.cancel')}
          </button>
          <button type="submit" className="btn btn-primary px-8 rounded-xl shadow-lg shadow-primary/20" disabled={isCreatingClient}>
            {isCreatingClient ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <> {t('create_client.submit')}</>
            )}
          </button>
        </div>
      </form>
    </PremiumModal>
  )
}

