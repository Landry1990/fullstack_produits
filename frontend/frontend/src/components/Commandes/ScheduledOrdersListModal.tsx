import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import PremiumModal from '../common/PremiumModal'
import { 
    Calendar, 
    Plus, 
    Edit, 
    Trash2, 
    Clock, 
    Bell,
    Settings2,
    Package,
    ArrowRight,
    Zap
} from 'lucide-react'
import type { Fournisseur, OrderSchedule } from '../../types'
import procurementService from '../../services/procurementService'

interface ScheduledOrdersListModalProps {
    isOpen: boolean;
    onClose: () => void;
    onEditSchedule: (schedule: OrderSchedule) => void;
    onCreateSchedule: () => void;
    fournisseurs: Fournisseur[];
    refreshTrigger?: number;
}

export default function ScheduledOrdersListModal({
    isOpen,
    onClose,
    onEditSchedule,
    onCreateSchedule,
    fournisseurs,
    refreshTrigger
}: ScheduledOrdersListModalProps) {
    const { t } = useTranslation(['orders', 'common'])
    const [schedules, setSchedules] = useState<OrderSchedule[]>([])
    const [loading, setLoading] = useState(false)
    const [triggeringId, setTriggeringId] = useState<number | null>(null)

    useEffect(() => {
        if (isOpen) fetchSchedules()
    }, [isOpen, refreshTrigger])

    async function fetchSchedules() {
        setLoading(true)
        try {
            const data = await procurementService.getSchedules()
            setSchedules(data.results || data)
        } catch (err) {
            toast.error("Erreur lors du chargement des plannings")
        } finally {
            setLoading(false)
        }
    }

    async function handleTriggerNow(schedule: OrderSchedule) {
        if (!schedule.id) return
        if (!window.confirm(`Lancer immédiatement la génération pour "${fournisseurs.find(f => f.id === schedule.fournisseur)?.name || 'ce fournisseur'}" ?`)) return
        setTriggeringId(schedule.id)
        try {
            const result = await procurementService.triggerNow(schedule.id)
            if (result.commande_id) {
                toast.success(`Commande #${result.commande_id} créée — ${result.nb_produits} produit(s) · ${result.total_ht.toLocaleString('fr-FR')} F HT`)
            } else {
                toast(result.detail || 'Aucune suggestion générée.', { icon: '⚠️' })
            }
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Erreur lors de la génération')
        } finally {
            setTriggeringId(null)
        }
    }

    async function handleDelete(id: number) {
        if (!window.confirm("Voulez-vous vraiment supprimer ce planning ?")) return
        try {
            await procurementService.deleteSchedule(id)
            toast.success("Planning supprimé")
            fetchSchedules()
        } catch (err) {
            toast.error("Erreur lors de la suppression")
        }
    }

    const getDayLabels = (days: number[]) => {
        const labels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
        return days.map(d => labels[d]).join(', ')
    }

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title="Commandes Programmées"
            subtitle="Gérez vos plannings de génération automatique de commandes"
            icon={<Calendar className="size-6 text-primary" />}
            maxWidth="max-w-4xl"
            footer={
                <div className="flex justify-between items-center w-full">
                    <button className="btn-ref btn-ghost" onClick={onClose}>Fermer</button>
                    <button className="btn-ref btn-primary shadow-lg shadow-indigo-500/20" onClick={onCreateSchedule}>
                        <Plus className="size-4 mr-2" />
                        Nouveau Planning
                    </button>
                </div>
            }
        >
            <div className="p-6 bg-base-200 min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <span className="inline-block size-8 border-2 border-base-300 border-t-indigo-600 rounded-full animate-spin"></span>
                        <span className="text-sm font-bold opacity-40">Chargement des plannings...</span>
                    </div>
                ) : schedules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                        <div className="size-20 bg-base-200 rounded-full flex items-center justify-center text-base-content/20">
                            <Calendar className="size-10" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold">Aucun planning configuré</h3>
                            <p className="text-sm text-base-content/50 max-w-xs mx-auto">Commencez par créer votre premier planning pour automatiser vos suggestions de commande.</p>
                        </div>
                        <button className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-focus transition-colors" onClick={onCreateSchedule}>
                            Créer un planning
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden text-sm">
                            <thead className="bg-base-200/50">
                                <tr>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-primary/60 py-4 pl-6">Fournisseur</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-primary/60 py-4">Programmation</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-primary/60 py-4">Mode</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-primary/60 py-4">Statut</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-primary/60 py-4 pr-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-base-200">
                                {schedules.map(schedule => {
                                    const fournisseur = fournisseurs.find(f => f.id === schedule.fournisseur)
                                    return (
                                        <tr key={schedule.id} className="hover:bg-base-200/80 transition-colors group">
                                            <td className="py-4 pl-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                                                        <Package className="size-3.5" />
                                                    </div>
                                                    <span className="font-bold text-sm text-base-content">{fournisseur?.name || "Inconnu"}</span>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-base-content/80 flex items-center gap-1">
                                                        <Clock className="size-3 text-primary" />
                                                        {schedule.time}
                                                    </span>
                                                    <span className="text-[10px] text-base-content/50 font-medium">
                                                        {getDayLabels(schedule.active_days)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                <span className={`inline-flex items-center border border-indigo-200 text-primary text-[9px] font-black uppercase px-2 rounded-full`}>
                                                    {schedule.execution_mode === 'OPTIMISE' ? 'Intelligent' : 'Statique'}
                                                </span>
                                            </td>
                                            <td className="py-4">
                                                <div className={`inline-flex items-center rounded-full text-[9px] font-black uppercase px-2 py-0.5 ${schedule.is_active ? 'bg-success/20 text-success' : 'bg-base-200 text-base-content/50'}`}>
                                                    {schedule.is_active ? 'Actif' : 'Off'}
                                                </div>
                                            </td>
                                            <td className="py-4 pr-6 text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-warning hover:bg-warning/10 rounded-lg transition-colors"
                                                        onClick={() => handleTriggerNow(schedule)}
                                                        disabled={triggeringId === schedule.id}
                                                        title="Lancer maintenant"
                                                    >
                                                        {triggeringId === schedule.id
                                                            ? <span className="inline-block size-3 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin" />
                                                            : <Zap className="size-3.5" />}
                                                        Lancer
                                                    </button>
                                                    <button 
                                                        className="btn-ref btn-ghost btn-xs text-primary hover:bg-primary/10 rounded-lg p-1"
                                                        onClick={() => onEditSchedule(schedule)}
                                                        title="Modifier"
                                                    >
                                                        <Edit className="size-3.5" />
                                                    </button>
                                                    <button 
                                                        className="btn-ref btn-ghost btn-xs text-error hover:bg-error/10 rounded-lg p-1"
                                                        onClick={() => schedule.id && handleDelete(schedule.id)}
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </PremiumModal>
    )
}
