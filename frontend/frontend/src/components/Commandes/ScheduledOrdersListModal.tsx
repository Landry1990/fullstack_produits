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
            icon={<Calendar className="w-6 h-6 text-primary" />}
            maxWidth="max-w-4xl"
            footer={
                <div className="flex justify-between items-center w-full">
                    <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
                    <button className="btn btn-primary shadow-lg shadow-primary/20" onClick={onCreateSchedule}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nouveau Planning
                    </button>
                </div>
            }
        >
            <div className="p-6 bg-slate-50 min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <span className="loading loading-spinner loading-lg text-primary"></span>
                        <span className="text-sm font-bold opacity-40">Chargement des plannings...</span>
                    </div>
                ) : schedules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                        <div className="w-20 h-20 bg-base-200 rounded-full flex items-center justify-center text-base-content/20">
                            <Calendar className="w-10 h-10" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold">Aucun planning configuré</h3>
                            <p className="text-sm text-base-content/50 max-w-xs mx-auto">Commencez par créer votre premier planning pour automatiser vos suggestions de commande.</p>
                        </div>
                        <button className="btn btn-primary btn-sm rounded-xl" onClick={onCreateSchedule}>
                            Créer un planning
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table table-sm w-full bg-white rounded-2xl shadow-sm border border-base-200 overflow-hidden">
                            <thead className="bg-slate-100/50">
                                <tr>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-primary/60 py-4 pl-6">Fournisseur</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-primary/60 py-4">Programmation</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-primary/60 py-4">Mode</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-primary/60 py-4">Statut</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-primary/60 py-4 pr-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-base-100">
                                {schedules.map(schedule => {
                                    const fournisseur = fournisseurs.find(f => f.id === schedule.fournisseur)
                                    return (
                                        <tr key={schedule.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="py-4 pl-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                                                        <Package className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="font-bold text-sm text-base-content">{fournisseur?.name || "Inconnu"}</span>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-base-content/80 flex items-center gap-1">
                                                        <Clock className="w-3 h-3 text-primary" />
                                                        {schedule.time}
                                                    </span>
                                                    <span className="text-[10px] text-base-content/40 font-medium">
                                                        {getDayLabels(schedule.active_days)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                <span className={`badge badge-outline border-primary/20 text-primary text-[9px] font-black uppercase px-2`}>
                                                    {schedule.execution_mode === 'OPTIMISE' ? 'Intelligent' : 'Statique'}
                                                </span>
                                            </td>
                                            <td className="py-4">
                                                <div className={`badge ${schedule.is_active ? 'badge-success text-white' : 'badge-ghost opacity-50'} badge-xs font-black text-[9px] uppercase px-2`}>
                                                    {schedule.is_active ? 'Actif' : 'Off'}
                                                </div>
                                            </td>
                                            <td className="py-4 pr-6 text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        className="btn btn-ghost btn-xs text-warning hover:bg-warning/10 rounded-lg px-2 gap-1 font-bold"
                                                        onClick={() => handleTriggerNow(schedule)}
                                                        disabled={triggeringId === schedule.id}
                                                        title="Lancer maintenant"
                                                    >
                                                        {triggeringId === schedule.id
                                                            ? <span className="loading loading-spinner loading-xs" />
                                                            : <Zap className="w-3.5 h-3.5" />}
                                                        Lancer
                                                    </button>
                                                    <button 
                                                        className="btn btn-ghost btn-xs text-primary hover:bg-primary/10 rounded-lg p-1"
                                                        onClick={() => onEditSchedule(schedule)}
                                                        title="Modifier"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button 
                                                        className="btn btn-ghost btn-xs text-error hover:bg-error/10 rounded-lg p-1"
                                                        onClick={() => schedule.id && handleDelete(schedule.id)}
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
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
