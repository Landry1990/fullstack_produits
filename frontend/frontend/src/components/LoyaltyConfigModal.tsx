import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
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
    const [settings, setSettings] = useState<LoyaltySetting | null>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

    useEffect(() => {
        if (isOpen) {
            fetchSettings()
        }
    }, [isOpen])

    const fetchSettings = async () => {
        console.log("LoyaltyConfigModal: Fetching settings...")
        setLoading(true)
        try {
            const url = `${apiBaseUrl}/api/loyalty-settings/`
            console.log("LoyaltyConfigModal: GET", url)
            let res = await axios.get(url)
            console.log("LoyaltyConfigModal: Response", res.data)
            
            // Handle paginated, array, or single object response
            let data = res.data
            if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
                data = data.results[0]
            } else if (Array.isArray(data)) {
                data = data[0]
            }
            
            if (data && typeof data === 'object' && 'amount_per_point' in data) {
                console.log("LoyaltyConfigModal: Setting data", data)
                setSettings(data)
            } else {
                console.warn("LoyaltyConfigModal: No data found, using defaults")
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
            toast.error('Erreur lors du chargement des paramètres')
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
                await axios.put(`${apiBaseUrl}/api/loyalty-settings/${settings.id}/`, settings)
            } else {
                // POST will use update_or_create in backend
                await axios.post(`${apiBaseUrl}/api/loyalty-settings/`, settings)
            }
            onClose()
            toast.success('Configuration enregistrée !')
        } catch (err) {
            toast.error('Erreur enregistrement')
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title="💎 Configuration Fidélité"
            subtitle="Paramétrer le programme de fidélité"
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
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Montant d'achat pour 1 point (FCFA)</label>
                            <input 
                                type="number" 
                                className="input input-bordered w-full h-12 rounded-xl"
                                value={settings.amount_per_point}
                                onChange={e => setSettings({...settings, amount_per_point: e.target.value})}
                            />
                            <p className="text-xs text-gray-400 mt-1">Ex: 1000 = 1 point par tranche de 1000 F</p>
                        </div>

                        <div className="divider text-xs uppercase tracking-wider">Usage Manuel</div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Valeur d'un point (FCFA)</label>
                            <input 
                                type="number" 
                                className="input input-bordered w-full h-12 rounded-xl"
                                value={settings.point_value}
                                onChange={e => setSettings({...settings, point_value: e.target.value})}
                            />
                            <p className="text-xs text-gray-400 mt-1">Si utilisé comme monnaie. Ex: 10 F</p>
                        </div>

                        <div className="divider text-xs uppercase tracking-wider">Récompense Automatique</div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Seuil (Points)</label>
                                <input 
                                    type="number" 
                                    className="input input-bordered w-full h-12 rounded-xl"
                                    value={settings.auto_reward_threshold}
                                    onChange={e => setSettings({...settings, auto_reward_threshold: parseInt(e.target.value) || 0})}
                                />
                                <p className="text-xs text-gray-400 mt-1">0 = Désactivé</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Remise (%)</label>
                                <input 
                                    type="number" 
                                    className="input input-bordered w-full h-12 rounded-xl"
                                    step="0.01"
                                    value={settings.auto_reward_percent}
                                    onChange={e => setSettings({...settings, auto_reward_percent: e.target.value})}
                                />
                                <p className="text-xs text-gray-400 mt-1">Ex: 5.00 pour 5%</p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                             <button type="button" className="btn btn-ghost px-6 rounded-xl" onClick={onClose} disabled={saving}>Annuler</button>
                             <button type="submit" className="btn btn-primary px-8 rounded-xl shadow-lg shadow-primary/20" disabled={saving}>
                                {saving && <span className="loading loading-spinner"></span>}
                                Enregistrer
                             </button>
                        </div>
                    </form>
                ) : (
                    <div className="text-error text-center py-8">Erreur de chargement</div>
                )}
            </div>
        </PremiumModal>
    )
}

