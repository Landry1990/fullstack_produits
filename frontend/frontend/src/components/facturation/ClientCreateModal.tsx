import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()

  if (!isOpen) return null

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          ➕ {t('facturation.create_client.title')}
          <span className="badge badge-sm badge-primary">
            {newClientForm.client_type === 'PARTICULIER' 
              ? t('facturation.create_client.individual') 
              : t('facturation.create_client.professional')}
          </span>
        </h3>

        <form onSubmit={handleCreateClient} className="space-y-4">
          {/* Type de client */}
          <div className="flex gap-4">
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                className="radio radio-primary radio-sm"
                checked={newClientForm.client_type === 'PARTICULIER'}
                onChange={() => setNewClientForm((prev: any) => ({ ...prev, client_type: 'PARTICULIER' }))}
              />
              <span className="label-text">{t('facturation.create_client.individual')}</span>
            </label>
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                className="radio radio-secondary radio-sm"
                checked={newClientForm.client_type === 'PROFESSIONNEL'}
                onChange={() => setNewClientForm((prev: any) => ({ ...prev, client_type: 'PROFESSIONNEL' }))}
              />
              <span className="label-text">{t('facturation.create_client.professional')}</span>
            </label>
          </div>

          {/* Infos de base */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-xs">{t('facturation.create_client.name')} *</span>
              </label>
              <input
                type="text"
                value={newClientForm.name}
                onChange={e => setNewClientForm((prev: any) => ({ ...prev, name: e.target.value }))}
                className="input input-bordered input-sm w-full"
                placeholder="Nom complet"
                required
              />
            </div>
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-xs">{t('facturation.create_client.phone')} *</span>
              </label>
              <input
                type="tel"
                value={newClientForm.phone}
                onChange={e => setNewClientForm((prev: any) => ({ ...prev, phone: e.target.value }))}
                className="input input-bordered input-sm w-full"
                placeholder="0612345678"
                required
              />
            </div>
          </div>

          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs">{t('facturation.create_client.email')} *</span>
            </label>
            <input
              type="email"
              value={newClientForm.email}
              onChange={e => setNewClientForm((prev: any) => ({ ...prev, email: e.target.value }))}
              className="input input-bordered input-sm w-full"
              placeholder="email@exemple.com"
              required
            />
          </div>

          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs">{t('facturation.create_client.address')} *</span>
            </label>
            <textarea
              value={newClientForm.address}
              onChange={e => setNewClientForm((prev: any) => ({ ...prev, address: e.target.value }))}
              className="textarea textarea-bordered textarea-sm w-full h-16 resize-none"
              placeholder="Adresse complète"
              required
            />
          </div>

          {/* Champs professionnels */}
          {newClientForm.client_type === 'PROFESSIONNEL' && (
            <div className="bg-base-200 p-3 rounded-lg space-y-3">
              <h4 className="text-sm font-bold text-secondary">{t('facturation.create_client.pro_options')}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs">{t('facturation.create_client.credit_limit')}</span>
                  </label>
                  <input
                    type="number"
                    value={newClientForm.plafond}
                    onChange={e => setNewClientForm((prev: any) => ({ ...prev, plafond: e.target.value }))}
                    className="input input-bordered input-sm w-full"
                    min="0"
                  />
                </div>
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs">{t('facturation.create_client.coverage')}</span>
                  </label>
                  <input
                    type="number"
                    value={newClientForm.taux_couverture}
                    onChange={e => setNewClientForm((prev: any) => ({ ...prev, taux_couverture: e.target.value }))}
                    className="input input-bordered input-sm w-full"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="modal-action mt-6">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
            >
              {t('facturation.create_client.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary gap-2"
              disabled={isCreatingClient}
            >
              {isCreatingClient ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <> {t('facturation.create_client.submit')}</>
              )}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}>
        <button>close</button>
      </form>
    </dialog>
  )
}
