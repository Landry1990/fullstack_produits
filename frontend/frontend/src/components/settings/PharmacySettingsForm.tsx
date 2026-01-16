import { useState, useEffect } from 'react'
import { usePharmacySettings, type PharmacySettings } from '../../hooks/usePharmacySettings'

export default function PharmacySettingsForm() {
  const { settings, loading, updateSettings } = usePharmacySettings()
  const [formData, setFormData] = useState<Partial<PharmacySettings>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settings) {
      setFormData(settings)
    }
  }, [settings])

  const handleChange = (field: keyof PharmacySettings, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateSettings(formData)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-base-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-white shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-base-content flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Informations Pharmacie
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Configurez les informations qui apparaissent sur vos tickets et documents
          </p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="btn btn-primary gap-2"
        >
          {saving ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              Enregistrement...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              Enregistrer
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
          
          {/* Section: Identité */}
          <div className="bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="bg-base-100 px-6 py-4 border-b border-base-200">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Identité de la Pharmacie
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Nom de la pharmacie *</span>
                </label>
                <input
                  type="text"
                  value={formData.pharmacy_name || ''}
                  onChange={(e) => handleChange('pharmacy_name', e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="PHARMACIE CENTRALE"
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/50">Ce nom apparaît en haut de tous vos tickets et documents</span>
                </label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">NIU (Numéro d'Identification Unique)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.niu || ''}
                    onChange={(e) => handleChange('niu', e.target.value.toUpperCase().slice(0, 15))}
                    className="input input-bordered w-full font-mono"
                    placeholder="M012345678901234"
                    maxLength={15}
                  />
                  <label className="label">
                    <span className="label-text-alt text-base-content/50">14 à 15 caractères alphanumériques</span>
                  </label>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Registre de Commerce (RCCM)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.registre_commerce || ''}
                    onChange={(e) => handleChange('registre_commerce', e.target.value.toUpperCase().slice(0, 20))}
                    className="input input-bordered w-full font-mono"
                    placeholder="RC/DLA/2024/B/12345"
                    maxLength={20}
                  />
                  <label className="label">
                    <span className="label-text-alt text-base-content/50">20 caractères maximum</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Coordonnées */}
          <div className="bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="bg-base-100 px-6 py-4 border-b border-base-200">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Coordonnées
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Adresse</span>
                </label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="123 Avenue de la République"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Ville</span>
                  </label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={(e) => handleChange('city', e.target.value)}
                    className="input input-bordered w-full"
                    placeholder="Douala"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Pays</span>
                  </label>
                  <input
                    type="text"
                    value={formData.country || ''}
                    onChange={(e) => handleChange('country', e.target.value)}
                    className="input input-bordered w-full"
                    placeholder="Cameroun"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Téléphone</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="input input-bordered w-full"
                    placeholder="+237 6XX XXX XXX"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Email</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="input input-bordered w-full"
                    placeholder="contact@pharmacie.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Messages Ticket */}
          <div className="bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="bg-base-100 px-6 py-4 border-b border-base-200">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Messages Ticket de Caisse
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">En-tête du ticket</span>
                </label>
                <textarea
                  value={formData.receipt_header || ''}
                  onChange={(e) => handleChange('receipt_header', e.target.value)}
                  className="textarea textarea-bordered w-full"
                  rows={2}
                  placeholder="Bienvenue dans notre pharmacie!"
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/50">Message personnalisé affiché en haut du ticket</span>
                </label>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Pied de page du ticket</span>
                </label>
                <textarea
                  value={formData.ticket_footer_message || ''}
                  onChange={(e) => handleChange('ticket_footer_message', e.target.value)}
                  className="textarea textarea-bordered w-full"
                  rows={2}
                  placeholder="Merci de votre visite! À bientôt."
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/50">Message de remerciement affiché en bas du ticket</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section: Configuration Commandes */}
          <div className="bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="bg-base-100 px-6 py-4 border-b border-base-200">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Configuration Commandes
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Coefficient Commandes Directes (Euro)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={formData.coefficient_direct_commande || ''}
                  onChange={(e) => handleChange('coefficient_direct_commande', e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="1.35"
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/50">
                    Ce coefficient sera utilisé par défaut pour convertir le Prix d'achat (Euro) en Prix de Revient (FCFA).
                    <br/>
                    Formule: Prix Revient = (Prix € x Taux Change) x Coefficient
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Mobile Submit Button */}
          <div className="md:hidden">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary btn-block gap-2"
            >
              {saving ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Enregistrement...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Enregistrer les modifications
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
