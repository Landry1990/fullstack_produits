import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { usePharmacySettings, type PharmacySettings } from '../../hooks/usePharmacySettings'
import { useTVA } from '../../hooks/useTVA'
import { useInvoiceSettings } from '../../hooks/useInvoiceSettings'
import { getApiErrorDetail } from '../../utils/errorHandling'

export default function PharmacySettingsForm() {
  const { t } = useTranslation('pharmacy_settings')
  const { settings, loading, updateSettings } = usePharmacySettings()
  const { tvaList, loading: loadingTVA, addTVA, deleteTVA } = useTVA()
  const { settings: invSettings, updateSettings: updateInvSettings } = useInvoiceSettings()
  const [formData, setFormData] = useState<Partial<PharmacySettings>>({})
  const [saving, setSaving] = useState(false)
  const [testingWhatsapp, setTestingWhatsapp] = useState(false)
  const [testingTelegram, setTestingTelegram] = useState(false)
  const [gettingChatId, setGettingChatId] = useState(false)
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
        import('react-hot-toast').then(({ toast }) => toast.success(t('tva.success_add')));
    } else {
        import('react-hot-toast').then(({ toast }) => toast.error(result.message || t('tva.error_add')));
    }
    setAddingTva(false);
  }


  const handleGetChatId = async () => {
    const bot_token = formData.telegram_bot_token
    if (!bot_token) {
      import('react-hot-toast').then(({ toast }) => toast.error('Renseignez le Token Bot Telegram d\'abord'))
      return
    }
    setGettingChatId(true)
    try {
      const { default: api } = await import('../../services/api')
      const res = await api.post('telegram/get-chat-id/', { bot_token })
      if (res.data.status === 'ok') {
        handleChange('telegram_chat_id', res.data.chat_id)
        import('react-hot-toast').then(({ toast }) => toast.success(`✅ Chat ID récupéré : ${res.data.chat_id} (${res.data.chat_name || 'inconnu'}). Sauvegardez les paramètres.`))
      } else {
        import('react-hot-toast').then(({ toast }) => toast.error('⚠️ ' + res.data.message, { duration: 8000 }))
      }
    } catch (err) {
      const msg = getApiErrorDetail(err, 'Erreur inconnue')
      import('react-hot-toast').then(({ toast }) => toast.error('❌ ' + msg, { duration: 8000 }))
    } finally {
      setGettingChatId(false)
    }
  }

  const handleTestTelegram = async () => {
    if (!formData.telegram_bot_token) {
      import('react-hot-toast').then(({ toast }) => toast.error('Renseignez le Token Bot Telegram d\'abord'))
      return
    }
    if (!formData.telegram_chat_id) {
      import('react-hot-toast').then(({ toast }) => toast.error('Chat ID manquant — utilisez le bouton « Récupérer mon Chat ID » d\'abord'))
      return
    }
    setTestingTelegram(true)
    try {
      const { default: api } = await import('../../services/api')
      const res = await api.post('telegram/test/', {
        bot_token: formData.telegram_bot_token,
        chat_id: formData.telegram_chat_id,
      })
      import('react-hot-toast').then(({ toast }) => toast.success('✅ ' + (res.data.message || 'Envoyé')))
    } catch (err) {
      const msg = getApiErrorDetail(err, 'Erreur inconnue')
      import('react-hot-toast').then(({ toast }) => toast.error('❌ ' + msg, { duration: 8000 }))
    } finally {
      setTestingTelegram(false)
    }
  }

  const handleTestWhatsapp = async () => {
    const numero = formData.pharmacist_whatsapp_number
    if (!numero) {
      import('react-hot-toast').then(({ toast }) => toast.error('Renseignez le numéro WhatsApp titulaire d\'abord'))
      return
    }
    setTestingWhatsapp(true)
    try {
      const { default: api } = await import('../../services/api')
      const res = await api.post('whatsapp/test/', { numero: numero.replace('+', '') })
      import('react-hot-toast').then(({ toast }) => toast.success('✅ ' + (res.data.message || 'Envoyé')))
    } catch (err) {
      const msg = getApiErrorDetail(err, 'Erreur inconnue')
      import('react-hot-toast').then(({ toast }) => toast.error('❌ ' + msg, { duration: 8000 }))
    } finally {
      setTestingWhatsapp(false)
    }
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-base-100 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-base-content flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            {t('title')}
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            {t('subtitle')}
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
              {t('saving')}
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              {t('save_btn')}
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
          
          {/* Section: Identité */}
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="bg-base-100 px-6 py-4 border-b border-base-200">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {t('sections.identity')}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-base-content/70">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t('hints.pharmacy_name_from_licence')}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">{t('labels.niu')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.niu || ''}
                    onChange={(e) => handleChange('niu', e.target.value.toUpperCase().slice(0, 15))}
                    className="input input-bordered w-full font-mono"
                    placeholder={t('placeholders.niu')}
                    maxLength={15}
                  />
                  <label className="label">
                    <span className="label-text-alt text-base-content/50">{t('hints.niu')}</span>
                  </label>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">{t('labels.rccm')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.registre_commerce || ''}
                    onChange={(e) => handleChange('registre_commerce', e.target.value.toUpperCase().slice(0, 20))}
                    className="input input-bordered w-full font-mono"
                    placeholder={t('placeholders.rccm')}
                    maxLength={20}
                  />
                  <label className="label">
                    <span className="label-text-alt text-base-content/50">{t('hints.rccm')}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Coordonnées */}
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="bg-base-100 px-6 py-4 border-b border-base-200">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t('sections.contact')}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">{t('labels.address')}</span>
                </label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="input input-bordered w-full"
                  placeholder={t('placeholders.address')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">{t('labels.city')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={(e) => handleChange('city', e.target.value)}
                    className="input input-bordered w-full"
                    placeholder={t('placeholders.city')}
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">{t('labels.country')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.country || ''}
                    onChange={(e) => handleChange('country', e.target.value)}
                    className="input input-bordered w-full"
                    placeholder={t('placeholders.country')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">{t('labels.phone')}</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="input input-bordered w-full"
                    placeholder={t('placeholders.phone')}
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">{t('labels.email')}</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="input input-bordered w-full"
                    placeholder={t('placeholders.email')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Messages Ticket */}
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="bg-base-100 px-6 py-4 border-b border-base-200">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t('sections.ticket')}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">{t('labels.receipt_header')}</span>
                </label>
                <textarea
                  value={formData.receipt_header || ''}
                  onChange={(e) => handleChange('receipt_header', e.target.value)}
                  className="textarea textarea-bordered w-full"
                  rows={2}
                  placeholder={t('placeholders.receipt_header')}
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/50">{t('hints.receipt_header')}</span>
                </label>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">{t('labels.ticket_footer')}</span>
                </label>
                <textarea
                  value={formData.ticket_footer_message || ''}
                  onChange={(e) => handleChange('ticket_footer_message', e.target.value)}
                  className="textarea textarea-bordered w-full"
                  rows={2}
                  placeholder={t('placeholders.ticket_footer')}
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/50">{t('hints.ticket_footer')}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section: Paramètres Système & Alertes */}
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="bg-base-100 px-6 py-4 border-b border-base-200">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t('sections.system')}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">{t('labels.paper_width')}</span>
                  </label>
                  <select
                    value={formData.ticket_paper_width || 80}
                    onChange={(e) => handleChange('ticket_paper_width', parseInt(e.target.value) as any)}
                    className="select select-bordered w-full"
                  >
                    <option value={80}>{t('labels.paper_standard')}</option>
                    <option value={58}>{t('labels.paper_small')}</option>
                  </select>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">{t('labels.currency')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.currency_symbol || 'FCFA'}
                    onChange={(e) => handleChange('currency_symbol', e.target.value)}
                    className="input input-bordered w-full"
                    placeholder={t('placeholders.currency')}
                  />
                </div>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">{t('labels.low_stock_days')}</span>
                  </label>
                  <input
                    type="number"
                    value={formData.low_stock_threshold_days || 15}
                    onChange={(e) => handleChange('low_stock_threshold_days', parseInt(e.target.value) as any)}
                    className="input input-bordered w-full"
                  />
                  <label className="label">
                    <span className="label-text-alt text-base-content/50">{t('hints.low_stock')}</span>
                  </label>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">{t('labels.dormant_stock_days')}</span>
                  </label>
                  <input
                    type="number"
                    value={formData.dormant_stock_days || 90}
                    onChange={(e) => handleChange('dormant_stock_days', parseInt(e.target.value) as any)}
                    className="input input-bordered w-full"
                  />
                  <label className="label">
                    <span className="label-text-alt text-base-content/50">{t('hints.dormant_stock')}</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">{t('labels.debt_threshold')}</span>
                      </label>
                      <input
                        type="number"
                        value={formData.debt_alert_threshold || '100000'}
                        onChange={(e) => handleChange('debt_alert_threshold', e.target.value)}
                        className="input input-bordered w-full"
                      />
                      <label className="label">
                        <span className="label-text-alt text-base-content/50">{t('hints.debt')}</span>
                      </label>
                  </div>
                  
                  <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">{t('labels.auto_logout')}</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.auto_logout_timeout !== undefined ? formData.auto_logout_timeout : 15}
                        onChange={(e) => handleChange('auto_logout_timeout', parseInt(e.target.value) || 0)}
                        className="input input-bordered w-full"
                      />
                      <label className="label">
                        <span className="label-text-alt text-base-content/50">{t('hints.auto_logout')}</span>
                      </label>
                  </div>
              </div>

            </div>
          </div>

          {/* Section: Multi-Caisse Setup */}
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="bg-base-100 px-6 py-4 border-b border-base-200 flex items-center justify-between">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Gestion Multi-Postes (Caisse)
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{invSettings?.is_multi_caisse ? 'Activé' : 'Désactivé'}</span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={invSettings?.is_multi_caisse || false}
                  onChange={(e) => updateInvSettings({ is_multi_caisse: e.target.checked })}
                />
              </div>
            </div>
            <div className="p-6">
                <div className="alert alert-info py-3 text-sm flex gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 size-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <div>
                        <p className="font-bold">Mode Multicaisse</p>
                        <p className="opacity-80">Si activé, le système demandera sur quel terminal physique envoyer la vente lors de la validation. Assurez-vous d'avoir configuré vos terminaux dans le menu "Utilisateurs &gt; Postes de Caisse".</p>
                    </div>
                </div>
                
                {invSettings?.is_multi_caisse && (
                    <div className="mt-4 p-4 bg-base-200 rounded-lg">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">Caisse Centralisée (Sessions de Ticket)</span>
                            <input
                                type="checkbox"
                                className="toggle toggle-sm"
                                checked={invSettings?.centralized_cash_register || false}
                                onChange={(e) => updateInvSettings({ centralized_cash_register: e.target.checked })}
                            />
                        </div>
                        <p className="text-xs text-base-content/60 mt-1 italic">
                            Active le groupement des ventes par session journalière (utile pour la clôture centralisée).
                        </p>
                    </div>
                )}
            </div>
          </div>
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="bg-base-100 px-6 py-4 border-b border-base-200">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('sections.tva')}
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('tva.rate')}</th>
                      <th>{t('tva.label')}</th>
                      <th>{t('tva.status')}</th>
                      <th className="text-right">{t('tva.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingTVA ? (
                      <tr><td colSpan={4} className="text-center">{t('tva.loading')}</td></tr>
                    ) : !Array.isArray(tvaList) || tvaList.length === 0 ? (
                      <tr><td colSpan={4} className="text-center text-base-content/60">{t('tva.empty')}</td></tr>
                    ) : (
                      tvaList.map(tva => (
                        <tr key={tva.id}>
                          <td className="font-bold">{tva.taux}%</td>
                          <td>{tva.libelle || '-'}</td>
                          <td>
                            {tva.is_active ? 
                              <span className="badge badge-success badge-sm">{t('tva.active')}</span> : 
                              <span className="badge badge-ghost badge-sm">{t('tva.inactive')}</span>
                            }
                          </td>
                          <td className="text-right">
                            <button 
                                type="button"
                                onClick={() => deleteTVA(tva.id)} 
                                className="btn btn-ghost btn-xs text-error"
                                title={t('tva.delete')}
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
                  <h3 className="font-medium mb-3 text-sm">{t('tva.add_title')}</h3>
                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                      <div className="form-control w-full sm:w-1/3">
                          <label className="label py-0 mb-1"><span className="label-text-alt">{t('tva.rate')} *</span></label>
                          <input 
                              type="number" 
                              step="0.01" 
                              placeholder={t('placeholders.tva_rate')} 
                              className="input input-bordered input-sm w-full" 
                              value={newTvaRate}
                              onChange={e => setNewTvaRate(e.target.value)}
                          />
                      </div>
                      <div className="form-control w-full sm:w-1/2">
                          <label className="label py-0 mb-1"><span className="label-text-alt">{t('tva.label')}</span></label>
                          <input 
                               type="text" 
                              placeholder={t('placeholders.tva_label')} 
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
                          {addingTva ? <span className="loading loading-spinner loading-xs"></span> : t('tva.add_btn')}
                      </button>
                  </div>
              </div>
            </div>
          </div>

          {/* Section: Configuration Commandes */}
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="bg-base-100 px-6 py-4 border-b border-base-200">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                {t('sections.orders')}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">{t('labels.coeff_direct')}</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={formData.coefficient_direct_commande || ''}
                  onChange={(e) => handleChange('coefficient_direct_commande', e.target.value)}
                  className="input input-bordered w-full"
                  placeholder={t('placeholders.coeff_direct')}
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/50">
                    {t('hints.coeff_direct')}
                    <br/>
                    {t('hints.coeff_formula')}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Mobile Submit Button */}
          {/* Section: WhatsApp Business API */}
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="bg-base-100 px-6 py-4 border-b border-base-200 flex items-center justify-between">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#25D366]" fill="currentColor" viewBox="0 0 448 512">
                  <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 54 81.2 54 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-5.5-2.8-23.4-8.6-44.4-27.4-16.4-14.6-27.4-32.7-30.6-38.2-3.2-5.6-.3-8.6 2.5-11.3 2.5-2.4 5.5-6.5 8.3-9.7 2.8-3.3 3.7-5.6 5.5-9.3 1.9-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 13.2 5.8 23.5 9.2 31.5 11.8 13.3 4.2 25.4 3.6 35 2.2 10.7-1.5 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
                </svg>
                {t('sections.whatsapp')}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{formData.whatsapp_enabled ? t('status.enabled') : t('status.disabled')}</span>
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
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 size-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>{t('hints.whatsapp_help')}</span>
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">{t('labels.whatsapp_phone_id')}</span>
                </label>
                <input
                  type="text"
                  value={formData.whatsapp_phone_id || ''}
                  onChange={(e) => handleChange('whatsapp_phone_id', e.target.value)}
                  className="input input-bordered w-full font-mono text-sm"
                  placeholder={t('placeholders.whatsapp_phone_id')}
                  disabled={!formData.whatsapp_enabled}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">{t('labels.whatsapp_token')}</span>
                </label>
                <textarea
                  value={formData.whatsapp_access_token || ''}
                  onChange={(e) => handleChange('whatsapp_access_token', e.target.value)}
                  className="textarea textarea-bordered w-full font-mono text-xs"
                  rows={3}
                  placeholder={t('placeholders.whatsapp_token')}
                  disabled={!formData.whatsapp_enabled}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">{t('labels.whatsapp_account_id')}</span>
                </label>
                <input
                  type="text"
                  value={formData.whatsapp_business_id || ''}
                  onChange={(e) => handleChange('whatsapp_business_id', e.target.value)}
                  className="input input-bordered w-full font-mono text-sm"
                  placeholder={t('placeholders.whatsapp_account_id')}
                  disabled={!formData.whatsapp_enabled}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">{t('labels.pharmacist_whatsapp')}</span>
                </label>
                <input
                  type="text"
                  value={formData.pharmacist_whatsapp_number || ''}
                  onChange={(e) => handleChange('pharmacist_whatsapp_number', e.target.value)}
                  className="input input-bordered w-full font-mono text-sm"
                  placeholder={t('placeholders.pharmacist_whatsapp')}
                  disabled={!formData.whatsapp_enabled}
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/50">{t('hints.pharmacist_whatsapp')}</span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTestWhatsapp}
                  disabled={testingWhatsapp || !formData.whatsapp_enabled}
                  className="btn btn-outline btn-success btn-sm gap-2"
                >
                  {testingWhatsapp ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M11.99 0C5.373 0 0 5.373 0 11.99c0 2.115.554 4.099 1.523 5.825L0 24l6.335-1.496A11.932 11.932 0 0011.99 24C18.607 24 24 18.627 24 11.99 24 5.373 18.607 0 11.99 0zm0 21.818a9.823 9.823 0 01-5.011-1.37l-.36-.214-3.724.879.936-3.617-.235-.372A9.808 9.808 0 012.182 11.99c0-5.41 4.398-9.808 9.808-9.808 5.41 0 9.808 4.398 9.808 9.808 0 5.41-4.398 9.828-9.808 9.828z"/>
                    </svg>
                  )}
                  Envoyer message test
                </button>
              </div>
            </div>
          </div>

          {/* Section: Telegram Bot */}
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="bg-base-100 px-6 py-4 border-b border-base-200 flex items-center justify-between">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#229ED9]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.67l-2.93-.918c-.638-.196-.65-.638.136-.943l11.434-4.41c.53-.194.995.131.822.943z"/>
                </svg>
                Telegram Bot
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{formData.telegram_enabled ? 'Activé' : 'Désactivé'}</span>
                <input
                  type="checkbox"
                  className="toggle toggle-info"
                  checked={formData.telegram_enabled || false}
                  onChange={(e) => handleChange('telegram_enabled', e.target.checked)}
                />
              </div>
            </div>
            <div className={`p-6 space-y-4 transition-all ${!formData.telegram_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="alert alert-info py-2 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 size-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>Créez un bot via <strong>@BotFather</strong> sur Telegram, copiez le token, envoyez <strong>/start</strong> au bot, puis cliquez « Récupérer mon Chat ID ».</span>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Token Bot</span>
                </label>
                <input
                  type="text"
                  value={formData.telegram_bot_token || ''}
                  onChange={(e) => handleChange('telegram_bot_token', e.target.value)}
                  className="input input-bordered w-full font-mono text-sm"
                  placeholder="123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Chat ID</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.telegram_chat_id || ''}
                    onChange={(e) => handleChange('telegram_chat_id', e.target.value)}
                    className="input input-bordered flex-1 font-mono text-sm"
                    placeholder="Cliquez le bouton ci-dessous après /start"
                  />
                  <button
                    type="button"
                    onClick={handleGetChatId}
                    disabled={gettingChatId || !formData.telegram_enabled}
                    className="btn btn-outline btn-info btn-sm gap-1"
                  >
                    {gettingChatId ? <span className="loading loading-spinner loading-xs"></span> : '🔍'}
                    Récupérer mon Chat ID
                  </button>
                </div>
                <label className="label">
                  <span className="label-text-alt text-base-content/50">Envoyez /start à votre bot Telegram puis cliquez ce bouton</span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={testingTelegram || !formData.telegram_enabled}
                  className="btn btn-outline btn-info btn-sm gap-2"
                >
                  {testingTelegram ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.67l-2.93-.918c-.638-.196-.65-.638.136-.943l11.434-4.41c.53-.194.995.131.822.943z"/>
                    </svg>
                  )}
                  Envoyer message test Telegram
                </button>
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
                  {t('saving')}
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  {t('save_changes')}
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
