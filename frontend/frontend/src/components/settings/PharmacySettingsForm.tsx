import { useState, useEffect } from 'react'
import { usePharmacySettings, type PharmacySettings } from '../../hooks/usePharmacySettings'
import { useTVA } from '../../hooks/useTVA'

export default function PharmacySettingsForm() {
  const { settings, loading, updateSettings } = usePharmacySettings()
  const { tvaList, loading: loadingTVA, addTVA, deleteTVA } = useTVA()
  const [formData, setFormData] = useState<Partial<PharmacySettings>>({})
  const [saving, setSaving] = useState(false)
  const [newTvaRate, setNewTvaRate] = useState('')
  const [newTvaLabel, setNewTvaLabel] = useState('')
  const [addingTva, setAddingTva] = useState(false)

  useEffect(() => {
    if (settings) {
      setFormData(settings)
    }
  }, [settings])

  const handleChange = (field: keyof PharmacySettings, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }
  
  const handleAddTva = async () => {
    if (!newTvaRate) return;
    setAddingTva(true);
    const success = await addTVA(newTvaRate, newTvaLabel);
    if (success) {
        setNewTvaRate('');
        setNewTvaLabel('');
    }
    setAddingTva(false);
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

          {/* Section: Paramètres Système & Alertes */}
          <div className="bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="bg-base-100 px-6 py-4 border-b border-base-200">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Paramètres Système & Alertes
              </h2>
            </div>
            <div className="p-6 space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Largeur Ticket (mm)</span>
                  </label>
                  <select
                    value={formData.ticket_paper_width || 80}
                    onChange={(e) => handleChange('ticket_paper_width', parseInt(e.target.value) as any)}
                    className="select select-bordered w-full"
                  >
                    <option value={80}>80mm (Standard)</option>
                    <option value={58}>58mm (Petit)</option>
                  </select>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Devise</span>
                  </label>
                  <input
                    type="text"
                    value={formData.currency_symbol || 'FCFA'}
                    onChange={(e) => handleChange('currency_symbol', e.target.value)}
                    className="input input-bordered w-full"
                    placeholder="ex: FCFA, €, $"
                  />
                </div>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Seuil Stock Bas (Jours)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.low_stock_threshold_days || 15}
                    onChange={(e) => handleChange('low_stock_threshold_days', parseInt(e.target.value) as any)}
                    className="input input-bordered w-full"
                  />
                  <label className="label">
                    <span className="label-text-alt text-base-content/50">Alerte si couverture inférieure à ce nombre</span>
                  </label>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Seuil Stock Dormant (Jours)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.dormant_stock_days || 90}
                    onChange={(e) => handleChange('dormant_stock_days', parseInt(e.target.value) as any)}
                    className="input input-bordered w-full"
                  />
                  <label className="label">
                    <span className="label-text-alt text-base-content/50">Alerte si aucune vente depuis ce nombre de jours</span>
                  </label>
                </div>
              </div>

              <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Seuil Alerte Dette Client</span>
                  </label>
                  <input
                    type="number"
                    value={formData.debt_alert_threshold || '100000'}
                    onChange={(e) => handleChange('debt_alert_threshold', e.target.value)}
                    className="input input-bordered w-full"
                  />
                   <label className="label">
                    <span className="label-text-alt text-base-content/50">Montant de dette à partir duquel une alerte est levée</span>
                  </label>
              </div>

            </div>
          </div>

          {/* Section: Gestion de la TVA */}

          {/* Section: Gestion de la TVA */}
          <div className="bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="bg-base-100 px-6 py-4 border-b border-base-200">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Gestion de la TVA
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Taux (%)</th>
                      <th>Libellé</th>
                      <th>Statut</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingTVA ? (
                      <tr><td colSpan={4} className="text-center">Chargement...</td></tr>
                    ) : !Array.isArray(tvaList) || tvaList.length === 0 ? (
                      <tr><td colSpan={4} className="text-center text-base-content/60">Aucun taux configuré</td></tr>
                    ) : (
                      tvaList.map(tva => (
                        <tr key={tva.id}>
                          <td className="font-bold">{tva.taux}%</td>
                          <td>{tva.libelle || '-'}</td>
                          <td>
                            {tva.is_active ? 
                              <span className="badge badge-success badge-sm">Actif</span> : 
                              <span className="badge badge-ghost badge-sm">Inactif</span>
                            }
                          </td>
                          <td className="text-right">
                            <button 
                                type="button"
                                onClick={() => deleteTVA(tva.id)} 
                                className="btn btn-ghost btn-xs text-error"
                                title="Supprimer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-base-100 p-4 rounded-lg border border-base-200">
                  <h3 className="font-medium mb-3 text-sm">Ajouter un nouveau taux</h3>
                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                      <div className="form-control w-full sm:w-1/3">
                          <label className="label py-0 mb-1"><span className="label-text-alt">Taux (%) *</span></label>
                          <input 
                              type="number" 
                              step="0.01" 
                              placeholder="19.25" 
                              className="input input-bordered input-sm w-full" 
                              value={newTvaRate}
                              onChange={e => setNewTvaRate(e.target.value)}
                          />
                      </div>
                      <div className="form-control w-full sm:w-1/2">
                          <label className="label py-0 mb-1"><span className="label-text-alt">Libellé (Optionnel)</span></label>
                          <input 
                              type="text" 
                              placeholder="Ex: Taux Normal" 
                              className="input input-bordered input-sm w-full"
                              value={newTvaLabel}
                              onChange={e => setNewTvaLabel(e.target.value)}
                          />
                      </div>
                      <button 
                          type="button" 
                          className="btn btn-primary btn-sm"
                          onClick={handleAddTva}
                          disabled={addingTva || !newTvaRate}
                      >
                          {addingTva ? <span className="loading loading-spinner loading-xs"></span> : 'Ajouter'}
                      </button>
                  </div>
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
