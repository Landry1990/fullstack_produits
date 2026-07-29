import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { usePharmacySettings, type PharmacySettings } from '../../hooks/usePharmacySettings'
import { useTVA } from '../../hooks/useTVA'
import type { TVA } from '../../types'
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
  MapPin,
  CreditCard,
  Settings,
  MessageSquare,
  Smartphone,
  ChevronRight,
  FileText,
  Mail,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  PackageX,
  Clock,
  DollarSign,
  Users,
  Lock,
  Trash2,
  Loader2,
  Store
} from 'lucide-react'
import { Button } from '../ui/Button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs'
import { Input } from '../shadcn/input'
import { Checkbox } from '../shadcn/checkbox'
import { Badge } from '../shadcn/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/Table'
import { Select } from '../ui/Select'
import { getConfigurablePaymentModes, getPaymentModeLabel } from '../../config/paymentModes'

type TabId = 'general' | 'printing' | 'stocks' | 'tva' | 'fiscal' | 'notifications' | 'reports' | 'postes_vente'

function TVARow({ tva, onDelete, t }: { tva: TVA; onDelete: (id: number) => void; t: (key: string) => string }) {
  return (
    <TableRow className="hover:bg-indigo-50/50 transition-colors group">
      <TableCell className="font-black text-2xl text-indigo-600">{tva.taux}%</TableCell>
      <TableCell className="font-medium text-slate-500">{tva.libelle || '-'}</TableCell>
      <TableCell>
        {tva.is_active ? (
          <Badge className="bg-emerald-500 text-white font-bold px-4 py-1.5 rounded-lg shadow-sm shadow-emerald-500/20">{t('tva.active')}</Badge>
        ) : (
          <Badge variant="outline" className="font-medium px-4 py-1.5 rounded-lg opacity-60">{t('tva.inactive')}</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDelete(tva.id)}
          className="text-red-600 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
          title={t('tva.delete')}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

function TVATable({ tvaList, loadingTVA, deleteTVA, t }: { tvaList: TVA[]; loadingTVA: boolean; deleteTVA: (id: number) => void; t: (key: string) => string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <Table className="w-full">
        <TableHeader>
          <TableRow className="bg-slate-100 hover:bg-slate-100">
            <TableHead className="font-bold text-slate-500">{t('tva.rate')}</TableHead>
            <TableHead className="font-bold text-slate-500">{t('tva.label')}</TableHead>
            <TableHead className="font-bold text-slate-500">{t('tva.status')}</TableHead>
            <TableHead className="text-right font-bold text-slate-500">{t('tva.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loadingTVA ? (
            <TableRow><TableCell colSpan={4} className="text-center p-12"><Loader2 className="inline-block size-8 animate-spin text-indigo-600" /></TableCell></TableRow>
          ) : !Array.isArray(tvaList) || tvaList.length === 0 ? (
            <TableRow><TableCell colSpan={4} className="text-center p-12 opacity-40 italic">{t('tva.empty')}</TableCell></TableRow>
          ) : (
            tvaList.map(tva => <TVARow key={tva.id} tva={tva} onDelete={deleteTVA} t={t} />)
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function TVAForm({ t, newTvaRate, setNewTvaRate, newTvaLabel, setNewTvaLabel, addingTva, handleAddTva }: { t: (key: string) => string; newTvaRate: string; setNewTvaRate: (v: string) => void; newTvaLabel: string; setNewTvaLabel: (v: string) => void; addingTva: boolean; handleAddTva: () => void }) {
  return (
    <div className="bg-slate-100 p-8 rounded-[2rem] border border-slate-200">
      <h3 className="font-bold text-lg mb-6 flex items-center gap-3">
        <Settings className="size-5 text-indigo-600" />
        {t('tva.add_title')}
      </h3>
      <div className="flex flex-col md:flex-row gap-6 items-end">
        <div className="flex flex-col gap-1 w-full md:w-48">
          <label><span className="text-sm font-bold text-slate-500">{t('tva.rate')} *</span></label>
          <div className="relative">
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              className="w-full h-12 rounded-xl font-bold pr-10"
              value={newTvaRate}
              onChange={e => setNewTvaRate(e.target.value)}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-300">%</div>
          </div>
        </div>
        <div className="flex flex-col gap-1 w-full md:flex-1">
          <label><span className="text-sm font-bold text-slate-500">{t('tva.label')}</span></label>
          <Input
            type="text"
            placeholder={t('placeholders.tva_label')}
            className="w-full h-12 rounded-xl"
            value={newTvaLabel}
            onChange={e => setNewTvaLabel(e.target.value)}
          />
        </div>
        <Button
          type="button"
          onClick={handleAddTva}
          disabled={addingTva || !newTvaRate}
          className="h-12 px-10 rounded-xl shadow-lg shadow-indigo-500/30"
        >
          {addingTva ? <Loader2 className="size-5 animate-spin" /> : t('tva.add_btn')}
        </Button>
      </div>
    </div>
  )
}

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
        import('react-hot-toast').then(({ toast }) => toast.error('⚠️ ' + res.data.message, { duration: 8000 }))
      }
    } catch (err) {
      const msg = getApiErrorDetail(err, t('messages.unknown_error'))
      import('react-hot-toast').then(({ toast }) => toast.error('❌ ' + msg, { duration: 8000 }))
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
      import('react-hot-toast').then(({ toast }) => toast.success('✅ ' + (res.data.message || t('messages.test_sent'))))
    } catch (err) {
      const msg = getApiErrorDetail(err, t('messages.unknown_error'))
      import('react-hot-toast').then(({ toast }) => toast.error('❌ ' + msg, { duration: 8000 }))
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
      import('react-hot-toast').then(({ toast }) => toast.success('✅ ' + (res.data.message || t('messages.test_sent'))))
    } catch (err) {
      const msg = getApiErrorDetail(err, t('messages.unknown_error'))
      import('react-hot-toast').then(({ toast }) => toast.error('❌ ' + msg, { duration: 8000 }))
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
                {/* Section: Identité */}
                <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
                  <div className="p-0">
                    <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                          <Info className="h-5 w-5 text-indigo-600" />
                        </div>
                        {t('sections.identity')}
                      </h2>
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="flex items-start gap-4 p-5 rounded-xl bg-indigo-50/50 border border-indigo-100 text-sm text-slate-500 leading-relaxed">
                        <Info className="h-6 w-6 text-indigo-600 shrink-0" />
                        <span>{t('hints.pharmacy_name_from_licence')}</span>
                      </div>

                      {/* Logo upload */}
                      <div className="flex flex-col gap-3">
                        <label>
                          <span className="text-sm font-bold text-slate-500">{t('labels.logo')}</span>
                        </label>
                        <div className="flex items-center gap-6">
                          <div className="shrink-0 w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
                            {settings.logo ? (
                              <img src={settings.logo} alt={t('labels.logo')} className="w-full h-full object-contain" />
                            ) : (
                              <Settings className="h-8 w-8 text-slate-200" />
                            )}
                          </div>
                          <div className="flex flex-col gap-2 flex-1">
                            <p className="text-xs text-slate-400">
                              {t('hints.logo')}
                            </p>
                            <div className="flex items-center gap-3">
                              <input
                                ref={logoInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg"
                                onChange={handleLogoUpload}
                                className="hidden"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={uploadingLogo}
                                onClick={() => logoInputRef.current?.click()}
                              >
                                {uploadingLogo ? t('buttons.logo_importing') : settings.logo ? t('buttons.logo_replace') : t('buttons.logo_import')}
                              </Button>
                              {settings.logo && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={removingLogo}
                                  onClick={handleLogoRemove}
                                  className="text-red-600 hover:text-red-600"
                                >
                                  {removingLogo ? t('buttons.logo_deleting') : t('buttons.logo_delete')}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex flex-col gap-1">
                          <label>
                            <span className="text-sm font-bold text-slate-500">{t('labels.niu')}</span>
                          </label>
                          <Input
                            type="text"
                            value={formData.niu || ''}
                            onChange={(e) => handleChange('niu', e.target.value.toUpperCase().slice(0, 15))}
                            className="w-full rounded-xl border border-slate-300 bg-white h-12 px-4 text-sm font-mono font-bold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all"
                            placeholder={t('placeholders.niu')}
                            maxLength={15}
                          />
                          <label>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                <ChevronRight className="size-3" /> {t('hints.niu')}
                            </span>
                          </label>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label>
                            <span className="text-sm font-bold text-slate-500">{t('labels.rccm')}</span>
                          </label>
                          <Input
                            type="text"
                            value={formData.registre_commerce || ''}
                            onChange={(e) => handleChange('registre_commerce', e.target.value.toUpperCase().slice(0, 20))}
                            className="w-full rounded-xl border border-slate-300 bg-white h-12 px-4 text-sm font-mono font-bold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all"
                            placeholder={t('placeholders.rccm')}
                            maxLength={20}
                          />
                          <label>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                <ChevronRight className="size-3" /> {t('hints.rccm')}
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Coordonnées */}
                <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
                  <div className="p-0">
                    <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                          <MapPin className="h-5 w-5 text-indigo-600" />
                        </div>
                        {t('sections.contact')}
                      </h2>
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="flex flex-col gap-1">
                        <label>
                          <span className="text-sm font-bold text-slate-500">{t('labels.address')}</span>
                        </label>
                        <Input
                          type="text"
                          value={formData.address || ''}
                          onChange={(e) => handleChange('address', e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white h-12 px-4 text-sm font-bold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all"
                          placeholder={t('placeholders.address')}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex flex-col gap-1">
                          <label>
                            <span className="text-sm font-bold text-slate-500">{t('labels.city')}</span>
                          </label>
                          <Input
                            type="text"
                            value={formData.city || ''}
                            onChange={(e) => handleChange('city', e.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white h-12 px-4 text-sm font-bold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all"
                            placeholder={t('placeholders.city')}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label>
                            <span className="text-sm font-bold text-slate-500">{t('labels.country')}</span>
                          </label>
                          <Input
                            type="text"
                            value={formData.country || ''}
                            onChange={(e) => handleChange('country', e.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white h-12 px-4 text-sm font-bold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all"
                            placeholder={t('placeholders.country')}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="flex flex-col gap-1">
                          <label>
                            <span className="text-sm font-bold text-slate-500">{t('labels.phone')}</span>
                          </label>
                          <Input
                            type="tel"
                            value={formData.phone || ''}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white h-12 px-4 text-sm font-bold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all"
                            placeholder={t('placeholders.phone')}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label>
                            <span className="text-sm font-bold text-slate-500">{t('labels.phone2', { defaultValue: 'Téléphone 2' })}</span>
                          </label>
                          <Input
                            type="tel"
                            value={formData.phone2 || ''}
                            onChange={(e) => handleChange('phone2', e.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white h-12 px-4 text-sm font-bold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all"
                            placeholder={t('placeholders.phone2', { defaultValue: 'Numéro secondaire' })}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label>
                            <span className="text-sm font-bold text-slate-500">{t('labels.email')}</span>
                          </label>
                          <Input
                            type="email"
                            value={formData.email || ''}
                            onChange={(e) => handleChange('email', e.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white h-12 px-4 text-sm font-bold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all"
                            placeholder={t('placeholders.email')}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Devise */}
                <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
                  <div className="p-0">
                    <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                          <CreditCard className="h-5 w-5 text-indigo-600" />
                        </div>
                        {t('labels.currency')}
                      </h2>
                    </div>
                    <div className="p-8">
                      <div className="flex flex-col gap-1 max-w-xs">
                        <Input
                          type="text"
                          value={formData.currency_symbol || 'FCFA'}
                          onChange={(e) => handleChange('currency_symbol', e.target.value)}
                          className="w-full font-bold text-indigo-600 h-12 rounded-xl text-center text-xl"
                          placeholder={t('placeholders.currency')}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Modes de paiement */}
                <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
                  <div className="p-0">
                    <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                          <CreditCard className="h-5 w-5 text-indigo-600" />
                        </div>
                        {t('sections.payment_modes')}
                      </h2>
                    </div>
                    <div className="p-8 space-y-6">
                      <p className="text-sm text-slate-500">
                        {t('hints.payment_modes')}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {getConfigurablePaymentModes(formData.custom_payment_modes).map((mode) => {
                          const disabledSet = new Set(formData.disabled_payment_modes || []);
                          const customModes = new Set((formData.custom_payment_modes || []).map((c: { value: string }) => c.value));
                          const isDisabled = disabledSet.has(mode.value)
                          const isCustom = customModes.has(mode.value)
                          return (
                            <label
                              key={mode.value}
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                isDisabled
                                  ? 'border-red-200 bg-red-50/50 opacity-60'
                                  : 'border-emerald-200 bg-emerald-50/50'
                              }`}
                            >
                              <Checkbox
                                checked={!isDisabled}
                                onCheckedChange={(checked) => {
                                  const current = formData.disabled_payment_modes || []
                                  if (checked) {
                                    handleChange('disabled_payment_modes', current.filter((v: string) => v !== mode.value))
                                  } else {
                                    handleChange('disabled_payment_modes', [...current, mode.value])
                                  }
                                }}
                              />
                              <span className="text-lg">{mode.icon}</span>
                              <span className="text-sm font-medium text-slate-800 flex-1">
                                {getPaymentModeLabel(mode.value, t, formData.custom_payment_modes)}
                              </span>
                              {isCustom && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    const updated = (formData.custom_payment_modes || []).filter((c: { value: string }) => c.value !== mode.value)
                                    handleChange('custom_payment_modes', updated)
                                    const currentDisabled = formData.disabled_payment_modes || []
                                    if (currentDisabled.includes(mode.value)) {
                                      handleChange('disabled_payment_modes', currentDisabled.filter((v: string) => v !== mode.value))
                                    }
                                  }}
                                  className="text-red-400 hover:text-red-600 text-xs font-bold transition-colors h-auto p-0"
                                  title={t('buttons.delete_mode_title')}
                                >✕</Button>
                              )}
                            </label>
                          )
                        })}
                      </div>

                      {/* Ajouter un mode personnalisé */}
                      <div className="border-t border-slate-200 pt-4">
                        <h3 className="text-sm font-bold text-slate-600 mb-3">
                          {t('labels.add_custom_mode')}
                        </h3>
                        <div className="flex items-center gap-3">
                          <Input
                            type="text"
                            id="new-payment-mode-input"
                            placeholder={t('placeholders.custom_mode')}
                            className="flex-1 h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                const input = e.currentTarget
                                const label = input.value.trim()
                                if (!label) return
                                const value = label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
                                if (!value) return
                                const existing = [...(formData.custom_payment_modes || [])]
                                if (existing.some((m: { value: string }) => m.value === value)) {
                                  import('react-hot-toast').then(({ toast }) => toast.error(t('messages.payment_mode_exists')))
                                  return
                                }
                                handleChange('custom_payment_modes', [...existing, { value, label }])
                                input.value = ''
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const input = document.getElementById('new-payment-mode-input') as HTMLInputElement
                              if (!input) return
                              const label = input.value.trim()
                              if (!label) return
                              const value = label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
                              if (!value) return
                              const existing = [...(formData.custom_payment_modes || [])]
                              if (existing.some((m: { value: string }) => m.value === value)) {
                                import('react-hot-toast').then(({ toast }) => toast.error(t('messages.payment_mode_exists')))
                                return
                              }
                              handleChange('custom_payment_modes', [...existing, { value, label }])
                              input.value = ''
                            }}
                          >
                            {t('buttons.add')}
                          </Button>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                          {t('hints.custom_mode')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
            </TabsContent>

            {/* --- TAB: PRINTING --- */}
            <TabsContent value="printing" className="mt-0 data-[state=inactive]:hidden space-y-8">
                {/* Section: Messages Ticket */}
                <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
                  <div className="p-0">
                    <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                          <MessageSquare className="h-5 w-5 text-indigo-600" />
                        </div>
                        {t('sections.ticket')}
                      </h2>
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="flex flex-col gap-1">
                        <label>
                          <span className="text-sm font-bold text-slate-500">{t('labels.receipt_header')}</span>
                        </label>
                        <textarea
                          value={formData.receipt_header || ''}
                          onChange={(e) => handleChange('receipt_header', e.target.value)}
                          className="w-full rounded-xl p-4 transition-all leading-relaxed"
                          rows={4}
                          placeholder={t('placeholders.receipt_header')}
                        />
                        <label>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <ChevronRight className="size-3" /> {t('hints.receipt_header')}
                          </span>
                        </label>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label>
                          <span className="text-sm font-bold text-slate-500">{t('labels.ticket_footer')}</span>
                        </label>
                        <textarea
                          value={formData.ticket_footer_message || ''}
                          onChange={(e) => handleChange('ticket_footer_message', e.target.value)}
                          className="w-full rounded-xl p-4 transition-all"
                          rows={3}
                          placeholder={t('placeholders.ticket_footer')}
                        />
                        <label>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <ChevronRight className="size-3" /> {t('hints.ticket_footer')}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Format & Multi-Caisse */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white shadow-xl border border-slate-200 rounded-2xl">
                    <div className="p-6 p-8">
                      <h3 className="font-bold text-lg flex items-center gap-3 mb-6">
                        <Printer className="size-6 text-indigo-600" />
                        {t('sections.printing_format')}
                      </h3>
                      <div className="flex flex-col gap-1">
                        <label>
                          <span className="text-sm font-bold text-slate-500">{t('labels.paper_width')}</span>
                        </label>
                        <Select
                          size="lg"
                          value={formData.ticket_paper_width || 80}
                          onChange={(e) => handleChange('ticket_paper_width', parseInt(e.target.value))}
                          className="rounded-xl"
                        >
                          <option value={80}>{t('labels.paper_standard')}</option>
                          <option value={58}>{t('labels.paper_small')}</option>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white shadow-xl border border-slate-200 rounded-2xl">
                    <div className="p-6 p-8">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg flex items-center gap-3">
                          <Smartphone className="size-6 text-indigo-600" />
                          {t('sections.multi_pos')}
                        </h3>
                        <Checkbox
                          checked={invSettings?.is_multi_caisse || false}
                          onCheckedChange={(checked) => updateInvSettings({ is_multi_caisse: !!checked })}
                          className="ml-2"
                        />
                      </div>
                      <p className="text-sm text-slate-500 italic leading-relaxed">
                        {t('hints.multi_pos')}
                      </p>
                      
                      {invSettings?.is_multi_caisse && (
                        <div className="mt-6 p-5 bg-indigo-50/50 rounded-xl space-y-4 border border-indigo-100 animate-in zoom-in-95 duration-300">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold">{t('labels.centralized_cash_register')}</span>
                            <Checkbox
                              checked={invSettings?.centralized_cash_register || false}
                              onCheckedChange={(checked) => updateInvSettings({ centralized_cash_register: !!checked })}
                            />
                          </div>
                          <p className="text-xs text-slate-500">
                            {t('hints.centralized_cash_register')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
            </TabsContent>

            {/* --- TAB: STOCKS & ORDERS --- */}
            <TabsContent value="stocks" className="mt-0 data-[state=inactive]:hidden space-y-8">
                <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
                  <div className="p-0">
                    <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                          <Package className="h-5 w-5 text-indigo-600" />
                        </div>
                        {t('sections.alerts_system')}
                      </h2>
                    </div>
                    <div className="p-8 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex flex-col gap-1">
                          <label>
                            <span className="text-sm font-bold text-slate-500">{t('labels.low_stock_days')}</span>
                          </label>
                          <Input
                            type="number"
                            value={formData.low_stock_threshold_days || 15}
                            onChange={(e) => handleChange('low_stock_threshold_days', parseInt(e.target.value))}
                            className="w-full h-12 rounded-xl"
                          />
                          <label>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                <ChevronRight className="size-3" /> {t('hints.low_stock')}
                            </span>
                          </label>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label>
                            <span className="text-sm font-bold text-slate-500">{t('labels.dormant_stock_days')}</span>
                          </label>
                          <Input
                            type="number"
                            value={formData.dormant_stock_days || 90}
                            onChange={(e) => handleChange('dormant_stock_days', parseInt(e.target.value))}
                            className="w-full h-12 rounded-xl"
                          />
                          <label>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                <ChevronRight className="size-3" /> {t('hints.dormant_stock')}
                            </span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex flex-col gap-1">
                          <label>
                            <span className="text-sm font-bold text-slate-500">{t('labels.debt_threshold')}</span>
                          </label>
                          <Input
                            type="number"
                            value={formData.debt_alert_threshold || '100000'}
                            onChange={(e) => handleChange('debt_alert_threshold', e.target.value)}
                            className="w-full h-12 rounded-xl"
                          />
                          <label>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                <ChevronRight className="size-3" /> {t('hints.debt')}
                            </span>
                          </label>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label>
                            <span className="text-sm font-bold text-slate-500">{t('labels.auto_logout')}</span>
                          </label>
                          <Input
                            type="number"
                            min="0"
                            value={formData.auto_logout_timeout !== undefined ? formData.auto_logout_timeout : 15}
                            onChange={(e) => handleChange('auto_logout_timeout', parseInt(e.target.value) || 0)}
                            className="w-full h-12 rounded-xl"
                          />
                          <label>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                <ChevronRight className="size-3" /> {t('hints.auto_logout')}
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Paramètres Caisse (Sécurité) */}
                <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
                  <div className="p-0">
                    <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-amber-50 rounded-lg">
                          <Lock className="h-5 w-5 text-amber-600" />
                        </div>
                        {t('sections.cash_security')}
                      </h2>
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="flex items-start gap-4">
                        <Checkbox
                          id="hide_cash_totals"
                          checked={formData.hide_cash_totals || false}
                          onCheckedChange={(checked) => handleChange('hide_cash_totals', !!checked)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <label htmlFor="hide_cash_totals" className="font-medium text-slate-800 cursor-pointer">
                            {t('labels.hide_cash_totals')}
                          </label>
                          <p className="text-sm text-slate-500 mt-1">
                            {t('hints.hide_cash_totals')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
                  <div className="p-0">
                    <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                          <Settings className="h-5 w-5 text-indigo-600" />
                        </div>
                        {t('sections.orders')}
                      </h2>
                    </div>
                    <div className="p-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex flex-col gap-1">
                          <label>
                            <span className="text-sm font-bold text-slate-500">{t('labels.coeff_direct')}</span>
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            min="1"
                            value={formData.coefficient_direct_commande || ''}
                            onChange={(e) => handleChange('coefficient_direct_commande', e.target.value)}
                            className="w-full font-bold text-indigo-600 h-12 rounded-xl"
                            placeholder={t('placeholders.coeff_direct')}
                          />
                          <label>
                            <span className="text-xs text-slate-400 flex flex-col gap-1 mt-1">
                              <span className="flex items-center gap-1 font-medium"><ChevronRight className="size-3" /> {t('hints.coeff_direct')}</span>
                              <span className="flex items-center gap-1 italic"><ChevronRight className="size-3" /> {t('hints.coeff_formula')}</span>
                            </span>
                          </label>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label>
                            <span className="text-sm font-bold text-slate-500">{t('labels.taux_change')}</span>
                          </label>
                          <Input
                            type="number"
                            step="0.001"
                            min="1"
                            value={formData.taux_change_actif || ''}
                            onChange={(e) => handleChange('taux_change_actif', e.target.value)}
                            className="w-full font-bold text-indigo-600 h-12 rounded-xl"
                            placeholder={t('placeholders.taux_change')}
                          />
                          <label>
                            <span className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                              <ChevronRight className="size-3" /> {t('hints.taux_change')}
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            </TabsContent>

            {/* --- TAB: TVA --- */}
            <TabsContent value="tva" className="mt-0 data-[state=inactive]:hidden space-y-8">
              <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
                <div className="p-0">
                  <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
                    <h2 className="font-bold text-xl flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg">
                        <Percent className="h-5 w-5 text-indigo-600" />
                      </div>
                      {t('sections.tva')}
                    </h2>
                  </div>
                  <div className="p-8 space-y-8">
                    <TVATable tvaList={tvaList} loadingTVA={loadingTVA} deleteTVA={deleteTVA} t={t} />
                    <TVAForm
                      t={t}
                      newTvaRate={newTvaRate}
                      setNewTvaRate={setNewTvaRate}
                      newTvaLabel={newTvaLabel}
                      setNewTvaLabel={setNewTvaLabel}
                      addingTva={addingTva}
                      handleAddTva={handleAddTva}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* --- TAB: FISCALITÉ --- */}
            <TabsContent value="fiscal" className="mt-0 data-[state=inactive]:hidden space-y-8">
              <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
                <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
                  <h2 className="font-bold text-xl flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <DollarSign className="h-5 w-5 text-indigo-600" />
                    </div>
                    {t('sections.fiscal')}
                  </h2>
                  <p className="text-sm text-slate-500 mt-2">
                    {t('hints.fiscal_intro')}
                  </p>
                </div>
                <div className="p-8 space-y-6">
                  {/* Régime fiscal */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">{t('labels.regime_fiscal')}</label>
                      <Select
                        value={formData.regime_fiscal || 'REEL'}
                        onChange={(e) => handleChange('regime_fiscal', e.target.value)}
                      >
                        <option value="REEL">{t('options.regime_reel')}</option>
                        <option value="SIMPLIFIE">{t('options.regime_simplifie')}</option>
                      </Select>
                      <p className="text-xs text-slate-400 mt-1">
                        {t('hints.regime_fiscal')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">{t('labels.mode_imposition')}</label>
                      <Select
                        value={formData.mode_imposition || 'MARGE_ADMINISTREE'}
                        onChange={(e) => handleChange('mode_imposition', e.target.value)}
                      >
                        <option value="MARGE_ADMINISTREE">{t('options.imposition_marge')}</option>
                        <option value="DROIT_COMMUN">{t('options.imposition_common')}</option>
                      </Select>
                      <p className="text-xs text-slate-400 mt-1">
                        {t('hints.mode_imposition')}
                      </p>
                    </div>
                  </div>

                  {/* Taux d'accompte — actifs uniquement en Droit Commun */}
                  <div className={`border-t border-slate-200 pt-6 transition-all duration-300 ${isMargeAdministree ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="font-bold text-sm text-slate-600 uppercase tracking-wide">{t('fiscal.acompte_title')}</h3>
                      {isMargeAdministree && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{t('hints.disabled_marge')}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className={`transition-all duration-300 ${isReel ? '' : 'opacity-40'}`}>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('labels.taux_acompte_reel')}</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.taux_accompte_reel ?? 2}
                          onChange={(e) => handleChange('taux_accompte_reel', parseFloat(e.target.value))}
                          className="font-bold"
                          disabled={isMargeAdministree || !isReel}
                        />
                      </div>
                      <div className={`transition-all duration-300 ${!isReel ? '' : 'opacity-40'}`}>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('labels.taux_acompte_simplifie')}</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.taux_accompte_simplifie ?? 5}
                          onChange={(e) => handleChange('taux_accompte_simplifie', parseFloat(e.target.value))}
                          className="font-bold"
                          disabled={isMargeAdministree || isReel}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('labels.taux_cac')}</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.taux_cac ?? 10}
                          onChange={(e) => handleChange('taux_cac', parseFloat(e.target.value))}
                          className="font-bold"
                          disabled={isMargeAdministree}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Taux de précompte — actifs uniquement en Droit Commun */}
                  <div className={`border-t border-slate-200 pt-6 transition-all duration-300 ${isMargeAdministree ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="font-bold text-sm text-slate-600 uppercase tracking-wide">{t('fiscal.precompte_title')}</h3>
                      {isMargeAdministree && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{t('hints.disabled_marge')}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={`transition-all duration-300 ${isReel ? '' : 'opacity-40'}`}>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('labels.taux_precompte_reel')}</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.taux_precompte_reel ?? 1}
                          onChange={(e) => handleChange('taux_precompte_reel', parseFloat(e.target.value))}
                          className="font-bold"
                          disabled={isMargeAdministree || !isReel}
                        />
                      </div>
                      <div className={`transition-all duration-300 ${!isReel ? '' : 'opacity-40'}`}>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('labels.taux_precompte_simplifie')}</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.taux_precompte_simplifie ?? 5}
                          onChange={(e) => handleChange('taux_precompte_simplifie', parseFloat(e.target.value))}
                          className="font-bold"
                          disabled={isMargeAdministree || isReel}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Marge administrée — active uniquement en Marge Administrée */}
                  <div className={`border-t border-slate-200 pt-6 transition-all duration-300 ${!isMargeAdministree ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="font-bold text-sm text-slate-600 uppercase tracking-wide">{t('fiscal.marge_brute_title')}</h3>
                      {!isMargeAdministree && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{t('hints.disabled_common')}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{t('labels.taux_marge_brute')}</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.taux_marge_brute ?? 14}
                          onChange={(e) => handleChange('taux_marge_brute', parseFloat(e.target.value))}
                          className="font-bold"
                          disabled={!isMargeAdministree}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Info box */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex gap-3">
                    <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-slate-600 space-y-1">
                      <p className="font-bold text-slate-700">{t('fiscal.info_title')}</p>
                      <p>• <strong>{t('options.regime_reel')}</strong> : {t('fiscal.info_reel')}</p>
                      <p>• <strong>{t('options.regime_simplifie')}</strong> : {t('fiscal.info_simplifie')}</p>
                      <p>• <strong>{t('fiscal.marge_brute_title')}</strong> : {t('fiscal.info_marge')}</p>
                      <p>• <strong>{t('options.imposition_common')}</strong> : {t('fiscal.info_common')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* --- TAB: NOTIFICATIONS --- */}
            <TabsContent value="notifications" className="mt-0 data-[state=inactive]:hidden space-y-8">
                {/* Section: WhatsApp */}
                <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
                  <div className="p-0">
                    <div className="px-8 py-5 border-b border-slate-200 flex items-center justify-between bg-[#25D366]/5">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-[#25D366]/20 rounded-lg">
                          <Smartphone className="h-5 w-5 text-[#25D366]" />
                        </div>
                        {t('sections.whatsapp')}
                      </h2>
                      <Checkbox
                        checked={formData.whatsapp_enabled || false}
                        onCheckedChange={(checked) => handleChange('whatsapp_enabled', !!checked)}
                      />
                    </div>
                    <div className={`p-8 space-y-8 transition-all duration-300 ${!formData.whatsapp_enabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                      <div className="flex gap-4 p-5 rounded-xl bg-blue-50 border border-blue-200 text-sm leading-relaxed">
                        <Info className="size-6 text-blue-500 shrink-0" />
                        <span>{t('hints.whatsapp_help')}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex flex-col gap-1">
                          <label><span className="text-sm font-bold text-slate-500">{t('labels.whatsapp_phone_id')}</span></label>
                          <Input
                            type="text"
                            value={formData.whatsapp_phone_id || ''}
                            onChange={(e) => handleChange('whatsapp_phone_id', e.target.value)}
                            className="w-full font-mono h-12 rounded-xl"
                            placeholder={t('placeholders.whatsapp_phone_id')}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label><span className="text-sm font-bold text-slate-500">{t('labels.whatsapp_account_id')}</span></label>
                          <Input
                            type="text"
                            value={formData.whatsapp_business_id || ''}
                            onChange={(e) => handleChange('whatsapp_business_id', e.target.value)}
                            className="w-full font-mono h-12 rounded-xl"
                            placeholder={t('placeholders.whatsapp_account_id')}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label><span className="text-sm font-bold text-slate-500">{t('labels.whatsapp_token')}</span></label>
                        <textarea
                          value={formData.whatsapp_access_token || ''}
                          onChange={(e) => handleChange('whatsapp_access_token', e.target.value)}
                          className="w-full font-mono text-xs rounded-xl p-4"
                          rows={3}
                          placeholder={t('placeholders.whatsapp_token')}
                        />
                      </div>

                      <div className="flex flex-col gap-1 max-w-lg">
                        <label><span className="text-sm font-bold text-slate-500">{t('labels.pharmacist_whatsapp')}</span></label>
                        <div className="flex gap-4">
                          <Input
                            type="text"
                            value={formData.pharmacist_whatsapp_number || ''}
                            onChange={(e) => handleChange('pharmacist_whatsapp_number', e.target.value)}
                            className="flex-1 font-mono h-12 rounded-xl"
                            placeholder={t('placeholders.pharmacist_whatsapp')}
                          />
                          <Button
                            type="button"
                            variant="primary"
                            onClick={handleTestWhatsapp}
                            disabled={testingWhatsapp || !formData.whatsapp_enabled}
                            className="h-12 px-6 rounded-xl shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700"
                          >
                            {testingWhatsapp ? <Loader2 className="size-5 animate-spin" /> : <Smartphone className="size-5" />}
                          </Button>
                        </div>
                        <label>
                          <span className="text-xs text-slate-400 italic">{t('hints.pharmacist_whatsapp')}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Telegram */}
                <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
                  <div className="p-0">
                    <div className="px-8 py-5 border-b border-slate-200 flex items-center justify-between bg-[#229ED9]/5">
                      <h2 className="font-bold text-xl flex items-center gap-3">
                        <div className="p-2 bg-[#229ED9]/20 rounded-lg">
                          <Bell className="h-5 w-5 text-[#229ED9]" />
                        </div>
                        {t('sections.telegram')}
                      </h2>
                      <Checkbox
                        checked={formData.telegram_enabled || false}
                        onCheckedChange={(checked) => handleChange('telegram_enabled', !!checked)}
                      />
                    </div>
                    <div className={`p-8 space-y-8 transition-all duration-300 ${!formData.telegram_enabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                      <div className="flex gap-4 p-5 rounded-xl bg-blue-50 border border-blue-200 text-sm">
                        <Info className="size-6 text-blue-500 shrink-0" />
                        <span>{t('hints.telegram')}</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label><span className="text-sm font-bold text-slate-500">{t('labels.telegram_bot_token')}</span></label>
                        <Input
                          type="text"
                          value={formData.telegram_bot_token || ''}
                          onChange={(e) => handleChange('telegram_bot_token', e.target.value)}
                          className="w-full font-mono h-12 rounded-xl"
                          placeholder={t('placeholders.telegram_bot_token')}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label><span className="text-sm font-bold text-slate-500">{t('labels.telegram_chat_id')}</span></label>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <Input
                            type="text"
                            value={formData.telegram_chat_id || ''}
                            onChange={(e) => handleChange('telegram_chat_id', e.target.value)}
                            className="flex-1 font-mono h-12 rounded-xl"
                            placeholder={t('placeholders.telegram_chat_id')}
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleGetChatId}
                              disabled={gettingChatId || !formData.telegram_enabled}
                              className="h-12 px-6 rounded-xl flex-1 font-bold border-blue-500 text-blue-600 hover:bg-blue-50"
                            >
                              {gettingChatId ? <Loader2 className="size-5 animate-spin" /> : t('buttons.get_chat_id')}
                            </Button>
                            <Button
                              type="button"
                              onClick={handleTestTelegram}
                              disabled={testingTelegram || !formData.telegram_enabled}
                              className="h-12 px-8 rounded-xl shadow-lg shadow-blue-500/20 font-bold bg-blue-600 hover:bg-blue-700"
                            >
                              {testingTelegram ? <Loader2 className="size-5 animate-spin" /> : t('buttons.test')}
                            </Button>
                          </div>
                        </div>
                        <label>
                            <span className="text-xs text-slate-400">{t('hints.telegram_start')}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
            </TabsContent>

            {/* --- TAB: RAPPORTS AUTOMATIQUES --- */}
            <TabsContent value="reports" className="mt-0 data-[state=inactive]:hidden space-y-8">
                {/* Section: Activation et Configuration Générale */}
                <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
                  <div className="p-6 space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                      <div className="p-3 bg-indigo-50 rounded-xl">
                        <FileText className="size-6 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">{t('sections.monthly_report')}</h3>
                        <p className="text-sm text-slate-500">{t('hints.monthly_report')}</p>
                      </div>
                    </div>

                    {/* Activation */}
                    <div className="flex items-center justify-between p-4 bg-slate-100 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Bell className="size-5 text-indigo-600" />
                        <div>
                          <p className="font-medium text-slate-800">{t('labels.monthly_report_enabled')}</p>
                          <p className="text-xs text-slate-500">{t('hints.monthly_report_enabled')}</p>
                        </div>
                      </div>
                      <Checkbox
                        checked={formData.monthly_report_enabled || false}
                        onCheckedChange={(checked) => handleChange('monthly_report_enabled', !!checked)}
                      />
                    </div>

                    {/* Jour d'envoi */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label>
                          <span className="font-medium text-slate-800 flex items-center gap-2">
                            <Clock className="size-4 text-slate-400" />
                            {t('labels.monthly_report_day')}
                          </span>
                        </label>
                        <Input
                          type="number"
                          min={1}
                          max={28}
                          value={formData.monthly_report_day || 1}
                          onChange={(e) => handleChange('monthly_report_day', parseInt(e.target.value))}
                          className="w-full h-12 rounded-xl"
                          disabled={!formData.monthly_report_enabled}
                        />
                        <label>
                          <span className="text-xs text-slate-400">{t('hints.monthly_report_day')}</span>
                        </label>
                      </div>

                      <div>
                        <label>
                          <span className="font-medium text-slate-800 flex items-center gap-2">
                            <Mail className="size-4 text-slate-400" />
                            {t('labels.report_recipients')}
                          </span>
                        </label>
                        <textarea
                          value={formData.report_recipients_email || ''}
                          onChange={(e) => handleChange('report_recipients_email', e.target.value)}
                          className="w-full rounded-xl min-h-[48px]"
                          placeholder={t('placeholders.report_recipients')}
                          disabled={!formData.monthly_report_enabled}
                        />
                        <label>
                          <span className="text-xs text-slate-400">{t('hints.report_recipients')}</span>
                        </label>
                      </div>
                    </div>

                    {/* Options d'envoi */}
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={formData.report_send_whatsapp || false}
                          onCheckedChange={(checked) => handleChange('report_send_whatsapp', !!checked)}
                          disabled={!formData.monthly_report_enabled}
                        />
                        <span className="text-sm text-slate-800 flex items-center gap-1">
                          <Smartphone className="size-4 text-emerald-600" />
                          {t('labels.report_send_whatsapp')}
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={formData.report_send_telegram || false}
                          onCheckedChange={(checked) => handleChange('report_send_telegram', !!checked)}
                          disabled={!formData.monthly_report_enabled}
                        />
                        <span className="text-sm text-slate-800 flex items-center gap-1">
                          <MessageSquare className="size-4 text-blue-500" />
                          {t('labels.report_send_telegram')}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Section: Éléments du Rapport */}
                <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
                  <div className="p-6 space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                      <div className="p-3 bg-emerald-50 rounded-xl">
                        <BarChart3 className="size-6 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">{t('sections.report_items')}</h3>
                        <p className="text-sm text-slate-500">{t('hints.report_items')}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Ventes */}
                      <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                        <Checkbox
                          checked={formData.report_include_sales || false}
                          onCheckedChange={(checked) => handleChange('report_include_sales', !!checked)}
                          className="mt-0.5"
                          disabled={!formData.monthly_report_enabled}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="size-4 text-emerald-600" />
                            <span className="font-medium text-slate-800">{t('report_items.sales.title')}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{t('report_items.sales.hint')}</p>
                        </div>
                      </label>

                      {/* Marges */}
                      <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                        <Checkbox
                          checked={formData.report_include_margin || false}
                          onCheckedChange={(checked) => handleChange('report_include_margin', !!checked)}
                          className="mt-0.5"
                          disabled={!formData.monthly_report_enabled}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <DollarSign className="size-4 text-emerald-600" />
                            <span className="font-medium text-slate-800">{t('report_items.margins.title')}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{t('report_items.margins.hint')}</p>
                        </div>
                      </label>

                      {/* Santé stock */}
                      <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                        <Checkbox
                          checked={formData.report_include_stock_health || false}
                          onCheckedChange={(checked) => handleChange('report_include_stock_health', !!checked)}
                          className="mt-0.5"
                          disabled={!formData.monthly_report_enabled}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Package className="size-4 text-blue-500" />
                            <span className="font-medium text-slate-800">{t('report_items.stock_health.title')}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{t('report_items.stock_health.hint')}</p>
                        </div>
                      </label>

                      {/* Ruptures */}
                      <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                        <Checkbox
                          checked={formData.report_include_ruptures || false}
                          onCheckedChange={(checked) => handleChange('report_include_ruptures', !!checked)}
                          className="mt-0.5"
                          disabled={!formData.monthly_report_enabled}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <PackageX className="size-4 text-red-600" />
                            <span className="font-medium text-slate-800">{t('report_items.ruptures.title')}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{t('report_items.ruptures.hint')}</p>
                        </div>
                      </label>

                      {/* Péremption */}
                      <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                        <Checkbox
                          checked={formData.report_include_expiration || false}
                          onCheckedChange={(checked) => handleChange('report_include_expiration', !!checked)}
                          className="mt-0.5"
                          disabled={!formData.monthly_report_enabled}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="size-4 text-amber-600" />
                            <span className="font-medium text-slate-800">{t('report_items.expiration.title')}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{t('report_items.expiration.hint')}</p>
                        </div>
                      </label>

                      {/* Top produits */}
                      <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                        <Checkbox
                          checked={formData.report_include_top_products || false}
                          onCheckedChange={(checked) => handleChange('report_include_top_products', !!checked)}
                          className="mt-0.5"
                          disabled={!formData.monthly_report_enabled}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="size-4 text-purple-600" />
                            <span className="font-medium text-slate-800">{t('report_items.top_products.title')}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{t('report_items.top_products.hint')}</p>
                        </div>
                      </label>

                      {/* Rotation lente */}
                      <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                        <Checkbox
                          checked={formData.report_include_slow_moving || false}
                          onCheckedChange={(checked) => handleChange('report_include_slow_moving', !!checked)}
                          className="mt-0.5"
                          disabled={!formData.monthly_report_enabled}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Clock className="size-4 text-slate-600" />
                            <span className="font-medium text-slate-800">{t('report_items.slow_moving.title')}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{t('report_items.slow_moving.hint')}</p>
                        </div>
                      </label>

                      {/* Dettes */}
                      <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                        <Checkbox
                          checked={formData.report_include_debt || false}
                          onCheckedChange={(checked) => handleChange('report_include_debt', !!checked)}
                          className="mt-0.5"
                          disabled={!formData.monthly_report_enabled}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Users className="size-4 text-indigo-600" />
                            <span className="font-medium text-slate-800">{t('report_items.debt.title')}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{t('report_items.debt.hint')}</p>
                        </div>
                      </label>

                      {/* Résumé financier */}
                      <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                        <Checkbox
                          checked={formData.report_include_financial_summary || false}
                          onCheckedChange={(checked) => handleChange('report_include_financial_summary', !!checked)}
                          className="mt-0.5"
                          disabled={!formData.monthly_report_enabled}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <DollarSign className="size-4 text-emerald-600" />
                            <span className="font-medium text-slate-800">{t('report_items.financial.title')}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{t('report_items.financial.hint')}</p>
                        </div>
                      </label>

                      {/* Comparaison */}
                      <label className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors md:col-span-2 lg:col-span-3">
                        <Checkbox
                          checked={formData.report_include_comparison || false}
                          onCheckedChange={(checked) => handleChange('report_include_comparison', !!checked)}
                          className="mt-0.5"
                          disabled={!formData.monthly_report_enabled}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="size-4 text-blue-500" />
                            <span className="font-medium text-slate-800">{t('report_items.comparison.title')}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{t('report_items.comparison.hint')}</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
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
