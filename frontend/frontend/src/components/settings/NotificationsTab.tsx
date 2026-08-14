import { Smartphone, Info, Bell, Loader2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../shadcn/input'
import { Checkbox } from '../shadcn/checkbox'
import type { NotificationsTabProps } from './types'

export function NotificationsTab({ formData, handleChange, t, testingWhatsapp, testingTelegram, gettingChatId, handleTestWhatsapp, handleTestTelegram, handleGetChatId }: NotificationsTabProps) {
  return (
    <>
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
    </>
  )
}
