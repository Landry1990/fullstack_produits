import { useState, useEffect } from 'react'
import axios from 'axios'

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
        setLoading(true)
        try {
            // First try to list (it's a viewset)
            let res = await axios.get(`${apiBaseUrl}/api/loyalty-settings/`)
            // If list returns array, decide how to handle (singleton logic in backend returns singleton on list? No, list returns list)
            // My backend logic:
            // def list(self, request):
            //    setting, _ = LoyaltySetting.objects.get_or_create(pk=1)
            //    return serializer.data
            // So it returns the object directly, not a list.
            setSettings(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!settings) return
        setSaving(true)
        try {
            await axios.post(`${apiBaseUrl}/api/loyalty-settings/`, settings)
            onClose()
            alert('Configuration enregistrée !')
        } catch (err) {
            alert('Erreur enregistrement')
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <dialog className="modal modal-open">
            <div className="modal-box">
                <h3 className="font-bold text-lg mb-4">💎 Configuration Fidélité</h3>
                
                {loading ? (
                    <div className="flex justify-center py-8"><span className="loading loading-spinner"></span></div>
                ) : settings ? (
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="form-control">
                            <label className="label font-bold">Montant d'achat pour 1 point (FCFA)</label>
                            <input 
                                type="number" 
                                className="input input-bordered"
                                value={settings.amount_per_point}
                                onChange={e => setSettings({...settings, amount_per_point: e.target.value})}
                            />
                            <label className="label-text-alt text-gray-500 mt-1">Ex: 1000 = 1 point par tranche de 1000 F</label>
                        </div>

                        <div className="divider">Usage Manuel</div>

                        <div className="form-control">
                            <label className="label font-bold">Valeur d'un point (FCFA)</label>
                            <input 
                                type="number" 
                                className="input input-bordered"
                                value={settings.point_value}
                                onChange={e => setSettings({...settings, point_value: e.target.value})}
                            />
                            <label className="label-text-alt text-gray-500 mt-1">Si utilisé comme monnaie. Ex: 10 F</label>
                        </div>

                        <div className="divider">Récompense Automatique</div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label font-bold">Seuil (Points)</label>
                                <input 
                                    type="number" 
                                    className="input input-bordered"
                                    value={settings.auto_reward_threshold}
                                    onChange={e => setSettings({...settings, auto_reward_threshold: parseInt(e.target.value) || 0})}
                                />
                                <label className="label-text-alt text-gray-500 mt-1">0 = Désactivé</label>
                            </div>
                            <div className="form-control">
                                <label className="label font-bold">Remise (%)</label>
                                <input 
                                    type="number" 
                                    className="input input-bordered"
                                    step="0.01"
                                    value={settings.auto_reward_percent}
                                    onChange={e => setSettings({...settings, auto_reward_percent: e.target.value})}
                                />
                                <label className="label-text-alt text-gray-500 mt-1">Ex: 5.00 pour 5%</label>
                            </div>
                        </div>

                        <div className="modal-action">
                             <button type="button" className="btn" onClick={onClose} disabled={saving}>Annuler</button>
                             <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving && <span className="loading loading-spinner"></span>}
                                Enregistrer
                             </button>
                        </div>
                    </form>
                ) : (
                    <div className="text-error">Erreur de chargement</div>
                )}
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={onClose}>close</button>
            </form>
        </dialog>
    )
}
