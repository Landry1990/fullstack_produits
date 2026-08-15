import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { usePharmacySettings, type PharmacySettings } from '../../hooks/usePharmacySettings'
import { useTVA } from '../../hooks/useTVA'
import { useInvoiceSettings } from '../../hooks/useInvoiceSettings'
import { getApiErrorDetail } from '../../utils/errorHandling'
import PosteVenteSettingsSection from './PosteVenteSettingsSection'
import {
  Info,
  Printer,
  Package,
  Percent,
  Bell,
  Save,
  Settings,
  FileText,
  DollarSign,
  Store
} from 'lucide-react'
import { Button } from '../ui/Button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs'
import type { TabId } from './types'
import { GeneralTab } from './GeneralTab'
import { PrintingTab } from './PrintingTab'
import { StocksTab } from './StocksTab'
import { TVATab } from './TVATab'
import { FiscalTab } from './FiscalTab'
import { NotificationsTab } from './NotificationsTab'
import { ReportsTab } from './ReportsTab'

export default function PharmacySettingsForm() {
  const { t } = useTranslation('pharmacy_settings')
  const { settings, loading, updateSettings, uploadLogo, removeLogo } = usePharmacySettings()
  const { tvaList, loading: loadingTVA, addTVA, deleteTVA } = useTVA()
  const { settings: invSettings, updateSettings: updateInvSettings } = useInvoiceSettings()
  const [formData, setFormData] = useState<Partial<PharmacySettings>>({})
  const isMargeAdministree = formData.mode_imposition === 'MARGE_ADMINISTREE'
  const isReel = formData.regime_fiscal === 'REEL'
  const [saving, setSaving] = useState(false)
  const [testingWhatsapp, setTestingWhatsapp] = useState(false)
  const [testingTelegram, setTestingTelegram] = useState(false)
  const [gettingChatId, setGettingChatId] = useState(false)
  const [newTvaRate, setNewTvaRate] = useState('')
  const [newTvaLabel, setNewTvaLabel] = useState('')
  const [addingTva, setAddingTva] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [removingLogo, setRemovingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (settings) {
      setFormData(settings)
    }
  }, [settings])

  const handleChange = (field: keyof PharmacySettings, value: unknown) => {
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
      import('react-hot-toast').then(({ toast }) => toast.error(t('messages.telegram_token_required')))
      return
    }
    setGettingChatId(true)
    try {
      const { default: api } = await import('../../services/api')
      const res = await api.post('telegram/get-chat-id/', { bot_token })
      if (res.data.status === 'ok') {
        handleChange('telegram_chat_id', res.data.chat_id)
        import('react-hot-toast').then(({ toast }) => toast.success(t('messages.telegram_chat_retrieved', { id: res.data.chat_id, name: res.data.chat_name || t('common:unknown') })))
      } else {
        import('react-hot-toast').then(({ toast }) => toast.error(res.data.message, { duration: 8000 }))
      }
    } catch (err) {
      const msg = getApiErrorDetail(err, t('messages.unknown_error'))
      import('react-hot-toast').then(({ toast }) => toast.error(msg, { duration: 8000 }))
    } finally {
      setGettingChatId(false)
    }
  }

  const handleTestTelegram = async () => {
    if (!formData.telegram_bot_token) {
      import('react-hot-toast').then(({ toast }) => toast.error(t('messages.telegram_token_required')))
      return
    }
    if (!formData.telegram_chat_id) {
      import('react-hot-toast').then(({ toast }) => toast.error(t('messages.telegram_chat_id_missing')))
      return
    }
    setTestingTelegram(true)
    try {
      const { default: api } = await import('../../services/api')
      const res = await api.post('telegram/test/', {
        bot_token: formData.telegram_bot_token,
        chat_id: formData.telegram_chat_id,
      })
      import('react-hot-toast').then(({ toast }) => toast.success(res.data.message || t('messages.test_sent')))
    } catch (err) {
      const msg = getApiErrorDetail(err, t('messages.unknown_error'))
      import('react-hot-toast').then(({ toast }) => toast.error(msg, { duration: 8000 }))
    } finally {
      setTestingTelegram(false)
    }
  }

  const handleTestWhatsapp = async () => {
    const numero = formData.pharmacist_whatsapp_number
    if (!numero) {
      import('react-hot-toast').then(({ toast }) => toast.error(t('messages.whatsapp_number_required')))
      return
    }
    setTestingWhatsapp(true)
    try {
      const { default: api } = await import('../../services/api')
      const res = await api.post('whatsapp/test/', { numero: numero.replace('+', '') })
      import('react-hot-toast').then(({ toast }) => toast.success(res.data.message || t('messages.test_sent')))
    } catch (err) {
      const msg = getApiErrorDetail(err, t('messages.unknown_error'))
      import('react-hot-toast').then(({ toast }) => toast.error(msg, { duration: 8000 }))
    } finally {
      setTestingWhatsapp(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      import('react-hot-toast').then(({ toast }) => toast.error(t('messages.logo_size')))
      return
    }
    setUploadingLogo(true)
    try {
      await uploadLogo(file)
    } catch {
      /* error already toasted in context */
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const handleLogoRemove = async () => {
    setRemovingLogo(true)
    try {
      await removeLogo()
    } catch {
      /* error already toasted in context */
    } finally {
      setRemovingLogo(false)
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const tabs = [
    { id: 'general', label: t('tabs.general'), icon: Info },
    { id: 'printing', label: t('tabs.printing'), icon: Printer },
    { id: 'stocks', label: t('tabs.stocks'), icon: Package },
    { id: 'tva', label: t('tabs.tva'), icon: Percent },
    { id: 'fiscal', label: t('tabs.fiscal'), icon: DollarSign },
    { id: 'notifications', label: t('tabs.notifications'), icon: Bell },
    { id: 'reports', label: t('tabs.reports'), icon: FileText },
    { id: 'postes_vente', label: t('tabs.sales_points'), icon: Store },
  ] as const

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Header */}
      <div className="px-6 py-4 border-b shrink-0">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <Settings className="h-6 w-6 text-indigo-600" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-6 mt-4 self-start">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-muted/30">
          <div className="max-w-4xl mx-auto p-6 pb-32">
            <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* --- TAB: GENERAL --- */}
            <TabsContent value="general" className="mt-0 data-[state=inactive]:hidden space-y-8">
              <GeneralTab
                formData={formData}
                handleChange={handleChange}
                t={t}
                logo={settings.logo}
                logoInputRef={logoInputRef}
                handleLogoUpload={handleLogoUpload}
                handleLogoRemove={handleLogoRemove}
                uploadingLogo={uploadingLogo}
                removingLogo={removingLogo}
              />
            </TabsContent>

            {/* --- TAB: PRINTING --- */}
            <TabsContent value="printing" className="mt-0 data-[state=inactive]:hidden space-y-8">
              <PrintingTab
                formData={formData}
                handleChange={handleChange}
                t={t}
                invSettings={invSettings}
                updateInvSettings={updateInvSettings}
              />
            </TabsContent>

            {/* --- TAB: STOCKS & ORDERS --- */}
            <TabsContent value="stocks" className="mt-0 data-[state=inactive]:hidden space-y-8">
              <StocksTab
                formData={formData}
                handleChange={handleChange}
                t={t}
              />
            </TabsContent>

            {/* --- TAB: TVA --- */}
            <TabsContent value="tva" className="mt-0 data-[state=inactive]:hidden space-y-8">
              <TVATab
                formData={formData}
                handleChange={handleChange}
                t={t}
                tvaList={tvaList}
                loadingTVA={loadingTVA}
                deleteTVA={deleteTVA}
                newTvaRate={newTvaRate}
                setNewTvaRate={setNewTvaRate}
                newTvaLabel={newTvaLabel}
                setNewTvaLabel={setNewTvaLabel}
                addingTva={addingTva}
                handleAddTva={handleAddTva}
              />
            </TabsContent>

            {/* --- TAB: FISCALITÉ --- */}
            <TabsContent value="fiscal" className="mt-0 data-[state=inactive]:hidden space-y-8">
              <FiscalTab
                formData={formData}
                handleChange={handleChange}
                t={t}
                isMargeAdministree={isMargeAdministree}
                isReel={isReel}
              />
            </TabsContent>

            {/* --- TAB: NOTIFICATIONS --- */}
            <TabsContent value="notifications" className="mt-0 data-[state=inactive]:hidden space-y-8">
              <NotificationsTab
                formData={formData}
                handleChange={handleChange}
                t={t}
                testingWhatsapp={testingWhatsapp}
                testingTelegram={testingTelegram}
                gettingChatId={gettingChatId}
                handleTestWhatsapp={handleTestWhatsapp}
                handleTestTelegram={handleTestTelegram}
                handleGetChatId={handleGetChatId}
              />
            </TabsContent>

            {/* --- TAB: RAPPORTS AUTOMATIQUES --- */}
            <TabsContent value="reports" className="mt-0 data-[state=inactive]:hidden space-y-8">
              <ReportsTab
                formData={formData}
                handleChange={handleChange}
                t={t}
              />
            </TabsContent>

            {/* --- TAB: POINTS DE VENTE --- */}
            <TabsContent value="postes_vente" className="mt-0 data-[state=inactive]:hidden space-y-8">
              <PosteVenteSettingsSection />
            </TabsContent>
          </form>
        </div>
      </div>
      </Tabs>

      {/* STICKY BOTTOM ACTION BAR */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-xl border-t z-50 flex justify-center items-center">
        <Button
          onClick={() => handleSubmit()}
          disabled={saving}
          size="lg"
          className="gap-3 min-w-[240px] text-lg shadow-lg"
        >
          {saving ? (
            t('saving')
          ) : (
            <>
              <Save className="h-5 w-5" />
              {t('save_btn')}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
