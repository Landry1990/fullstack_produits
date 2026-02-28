import { useState, useEffect, useCallback } from 'react'
import axios from '../config/axios'
import { toast } from 'react-hot-toast'

export interface PharmacySettings {
    id: number
    pharmacy_name: string
    address: string
    city: string
    country: string
    phone: string
    email: string
    niu: string
    registre_commerce: string
    ticket_footer_message: string
    receipt_header: string
    logo?: string
    coefficient_direct_commande?: string
    low_stock_threshold_days?: number
    dormant_stock_days?: number
    debt_alert_threshold?: string
    ticket_paper_width?: number
    currency_symbol?: string
    locale?: string
    // WhatsApp Business API (Meta Cloud)
    whatsapp_enabled?: boolean
    whatsapp_access_token?: string
    whatsapp_phone_id?: string
    whatsapp_business_id?: string
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
    whatsapp_enabled: false,
    whatsapp_access_token: '',
    whatsapp_phone_id: '',
    whatsapp_business_id: ''
}

export function usePharmacySettings() {
    const [settings, setSettings] = useState<PharmacySettings>(DEFAULT_SETTINGS)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/pharmacy-settings/` : '/api/pharmacy-settings/'

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true)
            const { data } = await axios.get<PharmacySettings>(endpoint)
            setSettings(data)
            setError(null)
        } catch (err) {
            console.error('Error fetching pharmacy settings:', err)
            setError('Erreur lors du chargement des paramètres')
            // Use defaults on error
            setSettings(DEFAULT_SETTINGS)
        } finally {
            setLoading(false)
        }
    }, [endpoint])

    const updateSettings = useCallback(async (updates: Partial<PharmacySettings>) => {
        try {
            const { data } = await axios.put<PharmacySettings>(endpoint, updates)
            setSettings(data)
            toast.success('Paramètres sauvegardés')
            return data
        } catch (err) {
            console.error('Error updating pharmacy settings:', err)
            toast.error('Erreur lors de la sauvegarde')
            throw err
        }
    }, [endpoint])

    useEffect(() => {
        fetchSettings()
    }, [fetchSettings])

    return {
        settings,
        loading,
        error,
        updateSettings,
        refetch: fetchSettings
    }
}
