import { useState, useEffect } from 'react'
import api from '../services/api'
import { toast } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import PremiumModal from './common/PremiumModal'

interface LoyaltySetting {
    id: number
    amount_per_point: string
    point_value: string
    auto_reward_threshold: number
    auto_reward_percent: string
}

interface Props {
    isOpen: boolean
    onClose: () => void
}

export default function LoyaltyConfigModal({ isOpen, onClose }: Props) {
    const { t } = useTranslation(['clients', 'common'])
    const [settings, setSettings] = useState<LoyaltySetting | null>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    useEffect(() => {
        if (isOpen) {
            fetchSettings()
        }
    }, [isOpen])

    const fetchSettings = async () => {
        setLoading(true)
        try {
            let res = await api.get('loyalty-settings/')
            
            // Handle paginated, array, or single object response
            let data = res.data
            if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
                data = data.results[0]
            } else if (Array.isArray(data)) {
                data = data[0]
            }
            
            if (data && typeof data === 'object' && 'amount_per_point' in data) {
                setSettings(data)
            } else {
                // Fallback default values if backend returns empty
                setSettings({
                    id: 0,
                    amount_per_point: "1000",
                    point_value: "10",
                    auto_reward_threshold: 0,
                    auto_reward_percent: "0"
                } as LoyaltySetting)
            }
        } catch (err) {
            console.error("LoyaltyConfigModal: Fetch error", err)
            // Even on error, set default settings so the modal isn't empty
            setSettings({
                id: 0,
                amount_per_point: "1000",
                point_value: "10",
                auto_reward_threshold: 0,
                auto_reward_percent: "0"
            } as LoyaltySetting)
            toast.error(t('common:messages.error_loading'))
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!settings) return
        setSaving(true)
        try {
            // For singleton, use PUT to update existing or POST will handle it
            // Check if settings has an id
            if (settings.id) {
                await api.put(`loyalty-settings/${settings.id}/`, settings)
            } else {
                // POST will use update_or_create in backend
                await api.post('loyalty-settings/', settings)
            }
            onClose()
            toast.success(t('common:messages.saved'))
        } catch (err) {
            toast.error(t('common:messages.error_saving'))
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('clients:loyalty.title')}
            subtitle={t('clients:loyalty.subtitle')}
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            }
            gradientFrom="purple-500/10"
            gradientVia="primary/5"
            gradientTo="purple-500/10"
            disableClose={saving}
        >
            <div className="p-6">
                {loading ? (
                    <div className="flex justify-center py-8"><span className="loading loading-spinner text-primary"></span></div>
                ) : settings ? (
                    <form onSubmit={handleSave} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('clients:loyalty.amount_per_point')}</label>
                            <input 
                                type="number" 
                                className="input input-bordered w-full h-12 rounded-xl"
                                value={settings.amount_per_point}
                                onChange={e => setSettings({...settings, amount_per_point: e.target.value})}
                            />
                            <p className="text-xs text-base-content/40 mt-1">{t('clients:loyalty.amount_per_point_hint')}</p>
                        </div>

                        <div className="divider text-xs uppercase tracking-wider">{t('clients:loyalty.manual_usage')}</div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('clients:loyalty.point_value')}</label>
                            <input 
                                type="number" 
                                className="input input-bordered w-full h-12 rounded-xl"
                                value={settings.point_value}
                                onChange={e => setSettings({...settings, point_value: e.target.value})}
                            />
                            <p className="text-xs text-base-content/40 mt-1">{t('clients:loyalty.point_value_hint')}</p>
                        </div>

                        <div className="divider text-xs uppercase tracking-wider">{t('clients:loyalty.auto_reward')}</div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('clients:loyalty.threshold')}</label>
                                <input 
                                    type="number" 
                                    className="input input-bordered w-full h-12 rounded-xl"
                                    value={settings.auto_reward_threshold}
                                    onChange={e => setSettings({...settings, auto_reward_threshold: parseInt(e.target.value) || 0})}
                                />
                                <p className="text-xs text-base-content/40 mt-1">{t('clients:loyalty.threshold_hint')}</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('clients:loyalty.discount')}</label>
                                <input 
                                    type="number" 
                                    className="input input-bordered w-full h-12 rounded-xl"
                                    step="0.01"
                                    value={settings.auto_reward_percent}
                                    onChange={e => setSettings({...settings, auto_reward_percent: e.target.value})}
                                />
                                <p className="text-xs text-base-content/40 mt-1">{t('clients:loyalty.discount_hint')}</p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                             <button type="button" className="btn btn-ghost px-6 rounded-xl" onClick={onClose} disabled={saving}>{t('common:cancel')}</button>
                             <button type="submit" className="btn btn-primary px-8 rounded-xl shadow-lg shadow-primary/20" disabled={saving}>
                                {saving && <span className="loading loading-spinner"></span>}
                                {t('common:save')}
                             </button>
                        </div>
                    </form>
                ) : (
                    <div className="text-error text-center py-8">{t('common:error')}</div>
                )}
            </div>
        </PremiumModal>
    )
}

