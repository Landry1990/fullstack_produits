import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { usePharmacySettings, type PharmacySettings } from '../../hooks/usePharmacySettings'
import { useTVA } from '../../hooks/useTVA'
import { useInvoiceSettings } from '../../hooks/useInvoiceSettings'
import { getApiErrorDetail } from '../../utils/errorHandling'
import { 
  Info, 
  Printer, 
  Package, 
  Percent, 
  Bell, 
  Save, 
  MapPin, 
  CreditCard,
  Settings,
  MessageSquare,
  Smartphone,
  ChevronRight
} from 'lucide-react'

type TabId = 'general' | 'printing' | 'stocks' | 'tva' | 'notifications'

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
  const [activeTab, setActiveTab] = useState<TabId>('general')

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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
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

  const tabs = [
    { id: 'general', label: t('tabs.general'), icon: Info },
    { id: 'printing', label: t('tabs.printing'), icon: Printer },
    { id: 'stocks', label: t('tabs.stocks'), icon: Package },
    { id: 'tva', label: t('tabs.tva'), icon: Percent },
    { id: 'notifications', label: t('tabs.notifications'), icon: Bell },
  ] as const

  return (
    <div className="h-full flex flex-col bg-base-100 overflow-hidden relative">
      {/* Header */}
      <div className="px-6 py-4 border-b border-base-200 bg-base-100 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-base-content flex items-center gap-3">
              <Settings className="h-7 w-7 text-primary" />
              {t('title')}
            </h1>
            <p className="text-sm text-base-content/60 mt-1">
              {t('subtitle')}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mt-6 overflow-x-auto no-scrollbar scroll-smooth pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap font-medium border-2 ${
                activeTab === tab.id 
                  ? 'bg-primary border-primary text-primary-content shadow-lg shadow-primary/20 scale-[1.02]' 
                  : 'bg-base-100 border-base-200 text-base-content/60 hover:border-primary/30 hover:text-primary'
              }`}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-base-200/40">
        <div className="max-w-4xl mx-auto p-6 pb-32">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* --- TAB: GENERAL --- */}
            {activeTab === 'general' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Section: Identité */}
                <div className="card bg-base-100 shadow-xl shadow-base-content/5 border border-base-200 overflow-hidden rounded-3xl">
                  <div className="card-body p-0">
                    <div className="px-8 py-5 border-b border-base-200 bg-base-50/50 flex items-center justify-between">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Info className="h-5 w-5 text-primary" />
                        </div>
                        {t('sections.identity')}
                      </h2>
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="flex items-start gap-4 p-5 rounded-2xl bg-primary/5 border border-primary/10 text-sm text-base-content/70 leading-relaxed">
                        <Info className="h-6 w-6 text-primary shrink-0" />
                        <span>{t('hints.pharmacy_name_from_licence')}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-bold text-base-content/80">{t('labels.niu')}</span>
                          </label>
                          <input
                            type="text"
                            value={formData.niu || ''}
                            onChange={(e) => handleChange('niu', e.target.value.toUpperCase().slice(0, 15))}
                            className="input input-bordered w-full font-mono focus:input-primary h-12 rounded-xl transition-all"
                            placeholder={t('placeholders.niu')}
                            maxLength={15}
                          />
                          <label className="label">
                            <span className="label-text-alt opacity-50 flex items-center gap-1">
                                <ChevronRight className="size-3" /> {t('hints.niu')}
                            </span>
                          </label>
                        </div>
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-bold text-base-content/80">{t('labels.rccm')}</span>
                          </label>
                          <input
                            type="text"
                            value={formData.registre_commerce || ''}
                            onChange={(e) => handleChange('registre_commerce', e.target.value.toUpperCase().slice(0, 20))}
                            className="input input-bordered w-full font-mono focus:input-primary h-12 rounded-xl transition-all"
                            placeholder={t('placeholders.rccm')}
                            maxLength={20}
                          />
                          <label className="label">
                            <span className="label-text-alt opacity-50 flex items-center gap-1">
                                <ChevronRight className="size-3" /> {t('hints.rccm')}
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Coordonnées */}
                <div className="card bg-base-100 shadow-xl shadow-base-content/5 border border-base-200 overflow-hidden rounded-3xl">
                  <div className="card-body p-0">
                    <div className="px-8 py-5 border-b border-base-200 bg-base-50/50">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <MapPin className="h-5 w-5 text-primary" />
                        </div>
                        {t('sections.contact')}
                      </h2>
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-bold text-base-content/80">{t('labels.address')}</span>
                        </label>
                        <input
                          type="text"
                          value={formData.address || ''}
                          onChange={(e) => handleChange('address', e.target.value)}
                          className="input input-bordered w-full focus:input-primary h-12 rounded-xl transition-all"
                          placeholder={t('placeholders.address')}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-bold text-base-content/80">{t('labels.city')}</span>
                          </label>
                          <input
                            type="text"
                            value={formData.city || ''}
                            onChange={(e) => handleChange('city', e.target.value)}
                            className="input input-bordered w-full focus:input-primary h-12 rounded-xl transition-all"
                            placeholder={t('placeholders.city')}
                          />
                        </div>
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-bold text-base-content/80">{t('labels.country')}</span>
                          </label>
                          <input
                            type="text"
                            value={formData.country || ''}
                            onChange={(e) => handleChange('country', e.target.value)}
                            className="input input-bordered w-full focus:input-primary h-12 rounded-xl transition-all"
                            placeholder={t('placeholders.country')}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-bold text-base-content/80">{t('labels.phone')}</span>
                          </label>
                          <input
                            type="tel"
                            value={formData.phone || ''}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            className="input input-bordered w-full focus:input-primary h-12 rounded-xl transition-all"
                            placeholder={t('placeholders.phone')}
                          />
                        </div>
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-bold text-base-content/80">{t('labels.email')}</span>
                          </label>
                          <input
                            type="email"
                            value={formData.email || ''}
                            onChange={(e) => handleChange('email', e.target.value)}
                            className="input input-bordered w-full focus:input-primary h-12 rounded-xl transition-all"
                            placeholder={t('placeholders.email')}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Devise */}
                <div className="card bg-base-100 shadow-xl shadow-base-content/5 border border-base-200 overflow-hidden rounded-3xl">
                  <div className="card-body p-0">
                    <div className="px-8 py-5 border-b border-base-200 bg-base-50/50">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <CreditCard className="h-5 w-5 text-primary" />
                        </div>
                        {t('labels.currency')}
                      </h2>
                    </div>
                    <div className="p-8">
                      <div className="form-control max-w-xs">
                        <input
                          type="text"
                          value={formData.currency_symbol || 'FCFA'}
                          onChange={(e) => handleChange('currency_symbol', e.target.value)}
                          className="input input-bordered w-full font-bold text-primary focus:input-primary h-12 rounded-xl text-center text-xl"
                          placeholder={t('placeholders.currency')}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB: PRINTING --- */}
            {activeTab === 'printing' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Section: Messages Ticket */}
                <div className="card bg-base-100 shadow-xl shadow-base-content/5 border border-base-200 overflow-hidden rounded-3xl">
                  <div className="card-body p-0">
                    <div className="px-8 py-5 border-b border-base-200 bg-base-50/50">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <MessageSquare className="h-5 w-5 text-primary" />
                        </div>
                        {t('sections.ticket')}
                      </h2>
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-bold text-base-content/80">{t('labels.receipt_header')}</span>
                        </label>
                        <textarea
                          value={formData.receipt_header || ''}
                          onChange={(e) => handleChange('receipt_header', e.target.value)}
                          className="textarea textarea-bordered w-full focus:textarea-primary rounded-2xl p-4 transition-all leading-relaxed"
                          rows={4}
                          placeholder={t('placeholders.receipt_header')}
                        />
                        <label className="label">
                          <span className="label-text-alt opacity-50 flex items-center gap-1">
                            <ChevronRight className="size-3" /> {t('hints.receipt_header')}
                          </span>
                        </label>
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-bold text-base-content/80">{t('labels.ticket_footer')}</span>
                        </label>
                        <textarea
                          value={formData.ticket_footer_message || ''}
                          onChange={(e) => handleChange('ticket_footer_message', e.target.value)}
                          className="textarea textarea-bordered w-full focus:textarea-primary rounded-2xl p-4 transition-all"
                          rows={3}
                          placeholder={t('placeholders.ticket_footer')}
                        />
                        <label className="label">
                          <span className="label-text-alt opacity-50 flex items-center gap-1">
                            <ChevronRight className="size-3" /> {t('hints.ticket_footer')}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Format & Multi-Caisse */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="card bg-base-100 shadow-xl border border-base-200 rounded-3xl">
                    <div className="card-body p-8">
                      <h3 className="font-bold text-lg flex items-center gap-3 mb-6">
                        <Printer className="size-6 text-primary" />
                        Format d'Impression
                      </h3>
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-bold text-base-content/80">{t('labels.paper_width')}</span>
                        </label>
                        <select
                          value={formData.ticket_paper_width || 80}
                          onChange={(e) => handleChange('ticket_paper_width', parseInt(e.target.value) as any)}
                          className="select select-bordered w-full h-12 rounded-xl focus:select-primary"
                        >
                          <option value={80}>{t('labels.paper_standard')}</option>
                          <option value={58}>{t('labels.paper_small')}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="card bg-base-100 shadow-xl border border-base-200 rounded-3xl">
                    <div className="card-body p-8">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg flex items-center gap-3">
                          <Smartphone className="size-6 text-primary" />
                          Multi-Postes
                        </h3>
                        <input
                          type="checkbox"
                          className="toggle toggle-primary toggle-lg"
                          checked={invSettings?.is_multi_caisse || false}
                          onChange={(e) => updateInvSettings({ is_multi_caisse: e.target.checked })}
                        />
                      </div>
                      <p className="text-sm text-base-content/60 italic leading-relaxed">
                        Si activé, le système permet de dispatcher les ventes vers différents terminaux physiques.
                      </p>
                      
                      {invSettings?.is_multi_caisse && (
                        <div className="mt-6 p-5 bg-primary/5 rounded-2xl space-y-4 border border-primary/10 animate-in zoom-in-95 duration-300">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold">Caisse Centralisée</span>
                            <input
                              type="checkbox"
                              className="toggle toggle-sm toggle-primary"
                              checked={invSettings?.centralized_cash_register || false}
                              onChange={(e) => updateInvSettings({ centralized_cash_register: e.target.checked })}
                            />
                          </div>
                          <p className="text-xs text-base-content/50">
                            Active le groupement des ventes par session journalière pour une clôture centralisée.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB: STOCKS & ORDERS --- */}
            {activeTab === 'stocks' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="card bg-base-100 shadow-xl shadow-base-content/5 border border-base-200 overflow-hidden rounded-3xl">
                  <div className="card-body p-0">
                    <div className="px-8 py-5 border-b border-base-200 bg-base-50/50">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        Seuils d'Alerte & Système
                      </h2>
                    </div>
                    <div className="p-8 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-bold text-base-content/80">{t('labels.low_stock_days')}</span>
                          </label>
                          <input
                            type="number"
                            value={formData.low_stock_threshold_days || 15}
                            onChange={(e) => handleChange('low_stock_threshold_days', parseInt(e.target.value) as any)}
                            className="input input-bordered w-full h-12 rounded-xl focus:input-primary"
                          />
                          <label className="label">
                            <span className="label-text-alt opacity-50 flex items-center gap-1">
                                <ChevronRight className="size-3" /> {t('hints.low_stock')}
                            </span>
                          </label>
                        </div>
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-bold text-base-content/80">{t('labels.dormant_stock_days')}</span>
                          </label>
                          <input
                            type="number"
                            value={formData.dormant_stock_days || 90}
                            onChange={(e) => handleChange('dormant_stock_days', parseInt(e.target.value) as any)}
                            className="input input-bordered w-full h-12 rounded-xl focus:input-primary"
                          />
                          <label className="label">
                            <span className="label-text-alt opacity-50 flex items-center gap-1">
                                <ChevronRight className="size-3" /> {t('hints.dormant_stock')}
                            </span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-bold text-base-content/80">{t('labels.debt_threshold')}</span>
                          </label>
                          <input
                            type="number"
                            value={formData.debt_alert_threshold || '100000'}
                            onChange={(e) => handleChange('debt_alert_threshold', e.target.value)}
                            className="input input-bordered w-full h-12 rounded-xl focus:input-primary"
                          />
                          <label className="label">
                            <span className="label-text-alt opacity-50 flex items-center gap-1">
                                <ChevronRight className="size-3" /> {t('hints.debt')}
                            </span>
                          </label>
                        </div>
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-bold text-base-content/80">{t('labels.auto_logout')}</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.auto_logout_timeout !== undefined ? formData.auto_logout_timeout : 15}
                            onChange={(e) => handleChange('auto_logout_timeout', parseInt(e.target.value) || 0)}
                            className="input input-bordered w-full h-12 rounded-xl focus:input-primary"
                          />
                          <label className="label">
                            <span className="label-text-alt opacity-50 flex items-center gap-1">
                                <ChevronRight className="size-3" /> {t('hints.auto_logout')}
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card bg-base-100 shadow-xl shadow-base-content/5 border border-base-200 overflow-hidden rounded-3xl">
                  <div className="card-body p-0">
                    <div className="px-8 py-5 border-b border-base-200 bg-base-50/50">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Settings className="h-5 w-5 text-primary" />
                        </div>
                        {t('sections.orders')}
                      </h2>
                    </div>
                    <div className="p-8">
                      <div className="form-control max-w-md">
                        <label className="label">
                          <span className="label-text font-bold text-base-content/80">{t('labels.coeff_direct')}</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          value={formData.coefficient_direct_commande || ''}
                          onChange={(e) => handleChange('coefficient_direct_commande', e.target.value)}
                          className="input input-bordered w-full font-bold text-primary h-12 rounded-xl focus:input-primary"
                          placeholder={t('placeholders.coeff_direct')}
                        />
                        <label className="label">
                          <span className="label-text-alt opacity-50 flex flex-col gap-1 mt-1">
                            <span className="flex items-center gap-1 font-medium"><ChevronRight className="size-3" /> {t('hints.coeff_direct')}</span>
                            <span className="flex items-center gap-1 italic"><ChevronRight className="size-3" /> {t('hints.coeff_formula')}</span>
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB: TVA --- */}
            {activeTab === 'tva' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="card bg-base-100 shadow-xl shadow-base-content/5 border border-base-200 overflow-hidden rounded-3xl">
                  <div className="card-body p-0">
                    <div className="px-8 py-5 border-b border-base-200 bg-base-50/50">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Percent className="h-5 w-5 text-primary" />
                        </div>
                        {t('sections.tva')}
                      </h2>
                    </div>
                    <div className="p-8 space-y-8">
                      <div className="overflow-x-auto rounded-3xl border border-base-200">
                        <table className="table table-zebra table-lg">
                          <thead className="bg-base-200/50">
                            <tr>
                              <th className="font-bold text-base-content/70">{t('tva.rate')}</th>
                              <th className="font-bold text-base-content/70">{t('tva.label')}</th>
                              <th className="font-bold text-base-content/70">{t('tva.status')}</th>
                              <th className="text-right font-bold text-base-content/70">{t('tva.actions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loadingTVA ? (
                              <tr><td colSpan={4} className="text-center p-12"><span className="loading loading-spinner loading-lg text-primary"></span></td></tr>
                            ) : !Array.isArray(tvaList) || tvaList.length === 0 ? (
                              <tr><td colSpan={4} className="text-center p-12 opacity-40 italic">{t('tva.empty')}</td></tr>
                            ) : (
                              tvaList.map(tva => (
                                <tr key={tva.id} className="hover:bg-primary/5 transition-colors group">
                                  <td className="font-black text-2xl text-primary">{tva.taux}%</td>
                                  <td className="font-medium text-base-content/80">{tva.libelle || '-'}</td>
                                  <td>
                                    {tva.is_active ? 
                                      <span className="badge badge-success badge-md font-bold px-4 py-3 rounded-lg shadow-sm shadow-success/20">{t('tva.active')}</span> : 
                                      <span className="badge badge-ghost badge-md font-medium px-4 py-3 rounded-lg opacity-60">{t('tva.inactive')}</span>
                                    }
                                  </td>
                                  <td className="text-right">
                                    <button 
                                        type="button"
                                        onClick={() => deleteTVA(tva.id)} 
                                        className="btn btn-ghost btn-circle text-error hover:bg-error/10 scale-90 group-hover:scale-100 transition-all opacity-0 group-hover:opacity-100"
                                        title={t('tva.delete')}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

                      <div className="bg-base-200/50 p-8 rounded-[2rem] border border-base-200">
                          <h3 className="font-bold text-lg mb-6 flex items-center gap-3">
                            <Settings className="size-5 text-primary" />
                            {t('tva.add_title')}
                          </h3>
                          <div className="flex flex-col md:flex-row gap-6 items-end">
                              <div className="form-control w-full md:w-48">
                                  <label className="label"><span className="label-text font-bold text-base-content/70">{t('tva.rate')} *</span></label>
                                  <div className="relative">
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        placeholder="0.00" 
                                        className="input input-bordered w-full focus:input-primary h-12 rounded-xl font-bold pr-10" 
                                        value={newTvaRate}
                                        onChange={e => setNewTvaRate(e.target.value)}
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold opacity-30">%</div>
                                  </div>
                              </div>
                              <div className="form-control w-full md:flex-1">
                                  <label className="label"><span className="label-text font-bold text-base-content/70">{t('tva.label')}</span></label>
                                  <input 
                                       type="text" 
                                      placeholder={t('placeholders.tva_label')} 
                                      className="input input-bordered w-full focus:input-primary h-12 rounded-xl"
                                      value={newTvaLabel}
                                      onChange={e => setNewTvaLabel(e.target.value)}
                                  />
                              </div>
                              <button 
                                  type="button" 
                                  className="btn btn-primary h-12 px-10 rounded-xl shadow-lg shadow-primary/30 font-bold"
                                  onClick={handleAddTva}
                                  disabled={addingTva || !newTvaRate}
                              >
                                  {addingTva ? <span className="loading loading-spinner"></span> : t('tva.add_btn')}
                              </button>
                          </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB: NOTIFICATIONS --- */}
            {activeTab === 'notifications' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Section: WhatsApp */}
                <div className="card bg-base-100 shadow-xl shadow-base-content/5 border border-base-200 overflow-hidden rounded-3xl">
                  <div className="card-body p-0">
                    <div className="px-8 py-5 border-b border-base-200 flex items-center justify-between bg-[#25D366]/5">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-[#25D366]/20 rounded-lg">
                          <Smartphone className="h-5 w-5 text-[#25D366]" />
                        </div>
                        {t('sections.whatsapp')}
                      </h2>
                      <input
                        type="checkbox"
                        className="toggle toggle-success toggle-lg"
                        checked={formData.whatsapp_enabled || false}
                        onChange={(e) => handleChange('whatsapp_enabled', e.target.checked)}
                      />
                    </div>
                    <div className={`p-8 space-y-8 transition-all duration-300 ${!formData.whatsapp_enabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                      <div className="flex gap-4 p-5 rounded-2xl bg-info/5 border border-info/10 text-sm leading-relaxed">
                        <Info className="size-6 text-info shrink-0" />
                        <span>{t('hints.whatsapp_help')}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="form-control">
                          <label className="label"><span className="label-text font-bold text-base-content/80">{t('labels.whatsapp_phone_id')}</span></label>
                          <input
                            type="text"
                            value={formData.whatsapp_phone_id || ''}
                            onChange={(e) => handleChange('whatsapp_phone_id', e.target.value)}
                            className="input input-bordered w-full font-mono h-12 rounded-xl focus:input-success"
                            placeholder="ID numérique de 15 chiffres"
                          />
                        </div>
                        <div className="form-control">
                          <label className="label"><span className="label-text font-bold text-base-content/80">{t('labels.whatsapp_account_id')}</span></label>
                          <input
                            type="text"
                            value={formData.whatsapp_business_id || ''}
                            onChange={(e) => handleChange('whatsapp_business_id', e.target.value)}
                            className="input input-bordered w-full font-mono h-12 rounded-xl focus:input-success"
                            placeholder="ID du compte business"
                          />
                        </div>
                      </div>

                      <div className="form-control">
                        <label className="label"><span className="label-text font-bold text-base-content/80">{t('labels.whatsapp_token')}</span></label>
                        <textarea
                          value={formData.whatsapp_access_token || ''}
                          onChange={(e) => handleChange('whatsapp_access_token', e.target.value)}
                          className="textarea textarea-bordered w-full font-mono text-xs focus:textarea-success rounded-2xl p-4"
                          rows={3}
                          placeholder="Token EAAG..."
                        />
                      </div>

                      <div className="form-control max-w-lg">
                        <label className="label"><span className="label-text font-bold text-base-content/80">{t('labels.pharmacist_whatsapp')}</span></label>
                        <div className="flex gap-4">
                          <input
                            type="text"
                            value={formData.pharmacist_whatsapp_number || ''}
                            onChange={(e) => handleChange('pharmacist_whatsapp_number', e.target.value)}
                            className="input input-bordered flex-1 font-mono h-12 rounded-xl focus:input-success"
                            placeholder="Ex: 2376XXXXXXXX"
                          />
                          <button
                            type="button"
                            onClick={handleTestWhatsapp}
                            disabled={testingWhatsapp || !formData.whatsapp_enabled}
                            className="btn btn-success h-12 px-6 rounded-xl shadow-lg shadow-success/20"
                          >
                            {testingWhatsapp ? <span className="loading loading-spinner"></span> : <Smartphone className="size-5" />}
                          </button>
                        </div>
                        <label className="label">
                          <span className="label-text-alt opacity-50 italic">{t('hints.pharmacist_whatsapp')}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Telegram */}
                <div className="card bg-base-100 shadow-xl shadow-base-content/5 border border-base-200 overflow-hidden rounded-3xl">
                  <div className="card-body p-0">
                    <div className="px-8 py-5 border-b border-base-200 flex items-center justify-between bg-[#229ED9]/5">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-[#229ED9]/20 rounded-lg">
                          <Bell className="h-5 w-5 text-[#229ED9]" />
                        </div>
                        Rapports Telegram Bot
                      </h2>
                      <input
                        type="checkbox"
                        className="toggle toggle-info toggle-lg"
                        checked={formData.telegram_enabled || false}
                        onChange={(e) => handleChange('telegram_enabled', e.target.checked)}
                      />
                    </div>
                    <div className={`p-8 space-y-8 transition-all duration-300 ${!formData.telegram_enabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                      <div className="flex gap-4 p-5 rounded-2xl bg-info/5 border border-info/10 text-sm">
                        <Info className="size-6 text-info shrink-0" />
                        <span>Créez un bot via <strong>@BotFather</strong>, copiez le token, envoyez <strong>/start</strong> au bot, puis récupérez le Chat ID.</span>
                      </div>

                      <div className="form-control">
                        <label className="label"><span className="label-text font-bold text-base-content/80">Token Bot Telegram</span></label>
                        <input
                          type="text"
                          value={formData.telegram_bot_token || ''}
                          onChange={(e) => handleChange('telegram_bot_token', e.target.value)}
                          className="input input-bordered w-full font-mono h-12 rounded-xl focus:input-info"
                          placeholder="123456789:ABCDefGh..."
                        />
                      </div>

                      <div className="form-control">
                        <label className="label"><span className="label-text font-bold text-base-content/80">Chat ID</span></label>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <input
                            type="text"
                            value={formData.telegram_chat_id || ''}
                            onChange={(e) => handleChange('telegram_chat_id', e.target.value)}
                            className="input input-bordered flex-1 font-mono h-12 rounded-xl focus:input-info"
                            placeholder="Identifiant numérique du chat"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleGetChatId}
                              disabled={gettingChatId || !formData.telegram_enabled}
                              className="btn btn-info btn-outline h-12 px-6 rounded-xl flex-1 font-bold"
                            >
                              {gettingChatId ? <span className="loading loading-spinner"></span> : '🔍 Récupérer Chat ID'}
                            </button>
                            <button
                              type="button"
                              onClick={handleTestTelegram}
                              disabled={testingTelegram || !formData.telegram_enabled}
                              className="btn btn-info h-12 px-8 rounded-xl shadow-lg shadow-info/20 font-bold"
                            >
                              {testingTelegram ? <span className="loading loading-spinner"></span> : 'Tester'}
                            </button>
                          </div>
                        </div>
                        <label className="label">
                            <span className="label-text-alt opacity-50">Envoyez /start à votre bot avant de cliquer sur Récupérer.</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* STICKY BOTTOM ACTION BAR */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-base-100/90 backdrop-blur-xl border-t border-base-200 z-50 flex justify-center items-center shadow-2xl">
        <button
          onClick={() => handleSubmit()}
          disabled={saving}
          className={`btn btn-primary btn-wide h-14 rounded-2xl gap-3 shadow-xl shadow-primary/30 transition-all duration-300 hover:scale-105 active:scale-95 font-bold text-lg ${saving ? 'loading' : ''}`}
        >
          {saving ? (
            t('saving')
          ) : (
            <>
              <Save className="size-6" />
              {t('save_btn')}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
