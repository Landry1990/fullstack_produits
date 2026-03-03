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

  const handleChange = (field: keyof PharmacySettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }
  
  const handleAddTva = async () => {
    if (!newTvaRate) return;
    setAddingTva(true);
    const result = await addTVA(newTvaRate, newTvaLabel);
    if (result.success) {
        setNewTvaRate('');
        setNewTvaLabel('');
        import('react-hot-toast').then(({ toast }) => toast.success('Taux de TVA ajouté avec succès'));
    } else {
        import('react-hot-toast').then(({ toast }) => toast.error(result.message || 'Erreur lors de l\'ajout de la TVA'));
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
          {/* Section: WhatsApp Business API */}
          <div className="bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="bg-base-100 px-6 py-4 border-b border-base-200 flex items-center justify-between">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#25D366]" fill="currentColor" viewBox="0 0 448 512">
                  <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 54 81.2 54 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-5.5-2.8-23.4-8.6-44.4-27.4-16.4-14.6-27.4-32.7-30.6-38.2-3.2-5.6-.3-8.6 2.5-11.3 2.5-2.4 5.5-6.5 8.3-9.7 2.8-3.3 3.7-5.6 5.5-9.3 1.9-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 13.2 5.8 23.5 9.2 31.5 11.8 13.3 4.2 25.4 3.6 35 2.2 10.7-1.5 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
                </svg>
                WhatsApp Business (Meta Cloud API)
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{formData.whatsapp_enabled ? 'Activé' : 'Désactivé'}</span>
                <input
                  type="checkbox"
                  className="toggle toggle-success"
                  checked={formData.whatsapp_enabled || false}
                  onChange={(e) => handleChange('whatsapp_enabled', e.target.checked)}
                />
              </div>
            </div>
            <div className={`p-6 space-y-4 transition-all ${!formData.whatsapp_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="alert alert-info py-2 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>Utilisez un token permanent généré sur le portail Meta Developers.</span>
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Phone Number ID</span>
                </label>
                <input
                  type="text"
                  value={formData.whatsapp_phone_id || ''}
                  onChange={(e) => handleChange('whatsapp_phone_id', e.target.value)}
                  className="input input-bordered w-full font-mono text-sm"
                  placeholder="Ex: 105678901234567"
                  disabled={!formData.whatsapp_enabled}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Access Token (Permanent)</span>
                </label>
                <textarea
                  value={formData.whatsapp_access_token || ''}
                  onChange={(e) => handleChange('whatsapp_access_token', e.target.value)}
                  className="textarea textarea-bordered w-full font-mono text-xs"
                  rows={3}
                  placeholder="EAABw..."
                  disabled={!formData.whatsapp_enabled}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">WhatsApp Business Account ID</span>
                </label>
                <input
                  type="text"
                  value={formData.whatsapp_business_id || ''}
                  onChange={(e) => handleChange('whatsapp_business_id', e.target.value)}
                  className="input input-bordered w-full font-mono text-sm"
                  placeholder="Ex: 987654321098765"
                  disabled={!formData.whatsapp_enabled}
                />
              </div>
            </div>
          </div>

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
