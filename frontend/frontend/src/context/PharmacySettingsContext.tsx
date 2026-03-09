import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import axios from '../config/axios';
import { toast } from 'react-hot-toast';
import { useAuth } from './AuthContext';

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
  // WhatsApp Business API (Meta Cloud)
  whatsapp_enabled?: boolean;
  whatsapp_access_token?: string;
  whatsapp_phone_id?: string;
  whatsapp_business_id?: string;
}

const DEFAULT_SETTINGS: PharmacySettings = {
  id: 1,
  pharmacy_name: 'PHARMA STOCK',
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
  whatsapp_enabled: false,
  whatsapp_access_token: '',
  whatsapp_phone_id: '',
  whatsapp_business_id: ''
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

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
  const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/pharmacy-settings/` : '/api/pharmacy-settings/';

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get<PharmacySettings & { server_time: string }>(endpoint);
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
  }, [endpoint]);

  const updateSettings = useCallback(async (updates: Partial<PharmacySettings>) => {
    try {
      const { data } = await axios.put<PharmacySettings>(endpoint, updates);
      setSettings(data);
      toast.success('Paramètres sauvegardés');
      return data;
    } catch (err) {
      console.error('Error updating pharmacy settings:', err);
      toast.error('Erreur lors de la sauvegarde');
      throw err;
    }
  }, [endpoint]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [fetchSettings, isAuthenticated]);

  return (
    <PharmacySettingsContext.Provider value={{ settings, loading, error, updateSettings, refetch: fetchSettings }}>
      {children}
    </PharmacySettingsContext.Provider>
  );
};

export const usePharmacySettings = () => {
  const context = useContext(PharmacySettingsContext);
  if (context === undefined) {
    throw new Error('usePharmacySettings must be used within a PharmacySettingsProvider');
  }
  return context;
};
