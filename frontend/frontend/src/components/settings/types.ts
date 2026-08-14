import type { PharmacySettings } from '../../hooks/usePharmacySettings'
import type { TVA } from '../../types'
import type { InvoiceSettings } from '../../hooks/useInvoiceSettings'

export type TabId = 'general' | 'printing' | 'stocks' | 'tva' | 'fiscal' | 'notifications' | 'reports' | 'postes_vente'

export interface SettingsTabProps {
  formData: Partial<PharmacySettings>
  handleChange: (field: keyof PharmacySettings, value: unknown) => void
  t: (key: string, options?: Record<string, unknown>) => string
}

export interface GeneralTabProps extends SettingsTabProps {
  logo: string | undefined
  logoInputRef: React.RefObject<HTMLInputElement | null>
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleLogoRemove: () => void
  uploadingLogo: boolean
  removingLogo: boolean
}

export interface PrintingTabProps extends SettingsTabProps {
  invSettings: InvoiceSettings | null
  updateInvSettings: (updates: Partial<InvoiceSettings>) => Promise<InvoiceSettings>
}

export interface FiscalTabProps extends SettingsTabProps {
  isMargeAdministree: boolean
  isReel: boolean
}

export interface NotificationsTabProps extends SettingsTabProps {
  testingWhatsapp: boolean
  testingTelegram: boolean
  gettingChatId: boolean
  handleTestWhatsapp: () => Promise<void>
  handleTestTelegram: () => Promise<void>
  handleGetChatId: () => Promise<void>
}

export interface TVATabProps extends SettingsTabProps {
  tvaList: TVA[]
  loadingTVA: boolean
  deleteTVA: (id: number) => void
  newTvaRate: string
  setNewTvaRate: (v: string) => void
  newTvaLabel: string
  setNewTvaLabel: (v: string) => void
  addingTva: boolean
  handleAddTva: () => void
}
