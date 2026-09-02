import { Info, MapPin, CreditCard, ChevronRight, Settings, Banknote } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../shadcn/input'
import { Checkbox } from '../shadcn/checkbox'
import { getConfigurablePaymentModes, getPaymentModeLabel } from '../../config/paymentModes'
import type { GeneralTabProps } from './types'

export function GeneralTab({ formData, handleChange, t, logo, logoInputRef, handleLogoUpload, handleLogoRemove, uploadingLogo, removingLogo }: GeneralTabProps) {
  return (
    <>
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
                  {logo ? (
                    <img src={logo} alt={t('labels.logo')} className="w-full h-full object-contain" />
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
                      {uploadingLogo ? t('buttons.logo_importing') : logo ? t('buttons.logo_replace') : t('buttons.logo_import')}
                    </Button>
                    {logo && (
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

      {/* Section: Caisse */}
      <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
        <div className="p-0">
          <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
            <h2 className="font-bold text-xl flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Banknote className="h-5 w-5 text-indigo-600" />
              </div>
              {t('sections.cash_register', { defaultValue: 'Caisse' })}
            </h2>
          </div>
          <div className="p-8 space-y-6">
            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all">
              <Checkbox
                checked={formData.billetage_obligatoire !== false}
                onCheckedChange={(checked) => handleChange('billetage_obligatoire', checked)}
              />
              <div className="flex-1">
                <span className="text-sm font-bold text-slate-800 block">
                  {t('labels.billetage_obligatoire', { defaultValue: 'Billetage obligatoire à la clôture' })}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  {t('hints.billetage_obligatoire', { defaultValue: 'Force la caissière à compter ses coupures (billets, pièces, mobile money) via un assistant à la clôture de caisse' })}
                </span>
              </div>
            </label>
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
                        import('goey-toast').then(({ gooeyToast }) => gooeyToast.error(t('messages.payment_mode_exists')))
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
                      import('goey-toast').then(({ gooeyToast }) => gooeyToast.error(t('messages.payment_mode_exists')))
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
    </>
  )
}
