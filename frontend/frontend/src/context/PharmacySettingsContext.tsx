import { createContext, use, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from './AuthContext';
import { useLicence } from './LicenceContext';

export interface PharmacySettings {
  id: number;
  pharmacy_name: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  niu: string;
  registre_commerce: string;
  ticket_footer_message: string;
  receipt_header: string;
  logo?: string;
  coefficient_direct_commande?: string;
  low_stock_threshold_days?: number;
  dormant_stock_days?: number;
  debt_alert_threshold?: string;
  ticket_paper_width?: number;
  currency_symbol?: string;
  locale?: string;
  auto_logout_timeout?: number;
  availability_weight?: number;
  rotation_weight?: number;
  // WhatsApp Business API (Meta Cloud)
  whatsapp_enabled?: boolean;
  whatsapp_access_token?: string;
  whatsapp_phone_id?: string;
  whatsapp_business_id?: string;
  pharmacist_whatsapp_number?: string;
  // Telegram Bot
  telegram_enabled?: boolean;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  // Rapport Automatique Mensuel
  monthly_report_enabled?: boolean;
  monthly_report_day?: number;
  report_include_sales?: boolean;
  report_include_margin?: boolean;
  report_include_stock_health?: boolean;
  report_include_ruptures?: boolean;
  report_include_expiration?: boolean;
  report_include_top_products?: boolean;
  report_include_slow_moving?: boolean;
  report_include_debt?: boolean;
  report_include_financial_summary?: boolean;
  report_include_comparison?: boolean;
  report_recipients_email?: string;
  report_send_whatsapp?: boolean;
  report_send_telegram?: boolean;
  // Sécurité Caisse
  hide_cash_totals?: boolean;
}

const DEFAULT_SETTINGS: PharmacySettings = {
  id: 1,
  pharmacy_name: 'ZENITH',
  address: '',
  city: 'Douala',
  country: 'Cameroun',
  phone: '',
  email: '',
  niu: '',
  registre_commerce: '',
  ticket_footer_message: 'Merci de votre visite!',
  receipt_header: '',
  logo: undefined,
  coefficient_direct_commande: '1.35',
  low_stock_threshold_days: 15,
  dormant_stock_days: 90,
  debt_alert_threshold: '100000',
  ticket_paper_width: 80,
  currency_symbol: 'FCFA',
  locale: 'fr-FR',
  auto_logout_timeout: 15,
  hide_cash_totals: false,
  availability_weight: 60,
  rotation_weight: 40,
  whatsapp_enabled: false,
  whatsapp_access_token: '',
  whatsapp_phone_id: '',
  whatsapp_business_id: '',
  pharmacist_whatsapp_number: '',
  telegram_enabled: false,
  telegram_bot_token: '',
  telegram_chat_id: '',
  // Rapport Automatique Mensuel - valeurs par défaut
  monthly_report_enabled: true,
  monthly_report_day: 1,
  report_include_sales: true,
  report_include_margin: true,
  report_include_stock_health: true,
  report_include_ruptures: true,
  report_include_expiration: true,
  report_include_top_products: true,
  report_include_slow_moving: true,
  report_include_debt: true,
  report_include_financial_summary: true,
  report_include_comparison: false,
  report_recipients_email: '',
  report_send_whatsapp: false,
  report_send_telegram: false,
};

interface PharmacySettingsContextType {
  settings: PharmacySettings;
  loading: boolean;
  error: string | null;
  updateSettings: (updates: Partial<PharmacySettings>) => Promise<PharmacySettings>;
  refetch: () => Promise<void>;
}

const PharmacySettingsContext = createContext<PharmacySettingsContextType | undefined>(undefined);

export const PharmacySettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<PharmacySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { syncTime, isAuthenticated } = useAuth();
  const { licence } = useLicence();

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<PharmacySettings & { server_time: string }>('pharmacy-settings/');
      if (data.server_time) syncTime(data.server_time);
      setSettings(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching pharmacy settings:', err);
      setError('Erreur lors du chargement des paramètres');
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, [syncTime]);

  const updateSettings = useCallback(async (updates: Partial<PharmacySettings>) => {
    try {
      const { data } = await api.put<PharmacySettings>('pharmacy-settings/', updates);
      setSettings(data);
      toast.success('Paramètres sauvegardés');
      return data;
    } catch (err) {
      console.error('Error updating pharmacy settings:', err);
      toast.error('Erreur lors de la sauvegarde');
      throw err;
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [fetchSettings, isAuthenticated]);

  // On fusionne les paramètres avec le nom de la pharmacie provenant de la licence
  const effectiveSettings = {
    ...settings,
    pharmacy_name: licence?.pharmacie_nom || settings.pharmacy_name
  };

  // Mémoriser l'objet value pour éviter les re-renders inutiles
  const contextValue = useMemo(() => ({
    settings: effectiveSettings,
    loading,
    error,
    updateSettings,
    refetch: fetchSettings
  }), [effectiveSettings, loading, error, updateSettings, fetchSettings]);

  return (
    <PharmacySettingsContext.Provider value={contextValue}>
      {children}
    </PharmacySettingsContext.Provider>
  );
};

export const usePharmacySettings = () => {
  const context = use(PharmacySettingsContext);
  if (context === undefined) {
    throw new Error('usePharmacySettings must be used within a PharmacySettingsProvider');
  }
  return context;
};
