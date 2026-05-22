import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Plus, Minus, History, CreditCard, Banknote, Calendar } from 'lucide-react'
import PremiumModal from '../common/PremiumModal'
import clientService from '../../services/clientService'
import { formatCurrency, formatDateFr } from '../../utils/formatters'
import type { Client, DepotClient } from '../../types/crm'

interface Props {
    isOpen: boolean
    onClose: () => void
    client: Client
    onSuccess?: () => void
}

export default function ClientDepositModal({ isOpen, onClose, client, onSuccess }: Props) {
    const { t } = useTranslation(['clients', 'common'])
    const [activeTab, setActiveTab] = useState<'transaction' | 'history'>('transaction')
    const [type, setType] = useState<'DEPOT' | 'RETRAIT'>('DEPOT')
    const [montant, setMontant] = useState('')
    const [modePaiement, setModePaiement] = useState('especes')
    const [notes, setNotes] = useState('')
    const [loading, setLoading] = useState(false)
    const [history, setHistory] = useState<DepotClient[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    useEffect(() => {
        if (isOpen && activeTab === 'history') {
            fetchHistory()
        }
    }, [isOpen, activeTab, client.id])

    const fetchHistory = async () => {
        setLoadingHistory(true)
        try {
            const data = await clientService.getDepotHistory(client.id)
            setHistory(data.results || data)
        } catch (err) {
            console.error(err)
            toast.error(t('common:messages.error_loading'))
        } finally {
            setLoadingHistory(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const amount = parseFloat(montant)
        if (isNaN(amount) || amount <= 0) {
            toast.error(t('common:messages.invalid_amount'))
            return
        }

        if (type === 'RETRAIT' && amount > parseFloat(client.solde_depot || '0')) {
            toast.error(t('common:messages.insufficient_deposit'))
            return
        }

        setLoading(true)
        try {
            await clientService.addDepot(client.id, {
                type,
                montant: amount,
                mode_paiement: modePaiement,
                notes
            })
            toast.success(t('common:messages.saved'))
            setMontant('')
            setNotes('')
            if (onSuccess) onSuccess()
            setActiveTab('history')
        } catch (err: any) {
            console.error(err)
            toast.error(err.response?.data?.error || t('common:messages.error_saving'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={`${t('clients:finance.manage_deposit')} - ${client.name}`}
            subtitle={`${t('clients:finance.solde_depot')}: ${formatCurrency(parseFloat(client.solde_depot || '0'))}`}
            icon={<CreditCard className="size-5 text-primary" />}
            maxWidth="max-w-3xl"
        >
            <div className="flex flex-col h-full">
                {/* Tabs */}
                <div className="flex border-b border-base-300 px-6 bg-base-100 sticky top-0 z-10">
                    <button
                        className={`py-4 px-6 text-sm font-medium transition-colors border-b-2 ${activeTab === 'transaction' ? 'border-indigo-500 text-primary' : 'border-transparent text-base-content/60 hover:text-base-content'}`}
                        onClick={() => setActiveTab('transaction')}
                    >
                        <div className="flex items-center gap-2">
                            <Plus className="size-4" />
                            Transaction
                        </div>
                    </button>
                    <button
                        className={`py-4 px-6 text-sm font-medium transition-colors border-b-2 ${activeTab === 'history' ? 'border-indigo-500 text-primary' : 'border-transparent text-base-content/60 hover:text-base-content'}`}
                        onClick={() => setActiveTab('history')}
                    >
                        <div className="flex items-center gap-2">
                            <History className="size-4" />
                            {t('common:history')}
                        </div>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {activeTab === 'transaction' ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4 p-1 bg-base-200 rounded-xl">
                                <button
                                    type="button"
                                    className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${type === 'DEPOT' ? 'bg-base-100 shadow-sm text-primary' : 'text-base-content/40 hover:text-base-content/60'}`}
                                    onClick={() => setType('DEPOT')}
                                >
                                    <Plus className="size-4" /> {t('common:add_deposit')}
                                </button>
                                <button
                                    type="button"
                                    className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${type === 'RETRAIT' ? 'bg-base-100 shadow-sm text-error' : 'text-base-content/40 hover:text-base-content/60'}`}
                                    onClick={() => setType('RETRAIT')}
                                >
                                    <Minus className="size-4" /> {t('common:make_withdrawal')}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('common:total')}</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            className="w-full h-12 rounded-xl border border-base-300 bg-base-100 pl-10 text-sm font-medium text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                            value={montant}
                                            onChange={e => setMontant(e.target.value)}
                                            placeholder="0"
                                            required
                                        />
                                        <Banknote className="size-5 absolute left-3 top-3.5 text-base-content/30" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">{t('common:payment_modes.title') || 'Mode de paiement'}</label>
                                    <select
                                        className="w-full h-12 rounded-xl border border-base-300 bg-base-100 px-3 text-sm font-medium text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                                        value={modePaiement}
                                        onChange={e => setModePaiement(e.target.value)}
                                    >
                                        <option value="especes">{t('common:payment_modes.especes')}</option>
                                        <option value="cheque">{t('common:payment_modes.cheque')}</option>
                                        <option value="virement">{t('common:payment_modes.virement')}</option>
                                        <option value="om">{t('common:payment_modes.om')}</option>
                                        <option value="momo">{t('common:payment_modes.momo')}</option>
                                        <option value="carte">{t('common:payment_modes.carte')}</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">Notes</label>
                                <textarea
                                    className="w-full rounded-xl border border-base-300 bg-base-100 p-3 text-sm font-medium text-base-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                    rows={3}
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Description de la transaction..."
                                ></textarea>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    className={`inline-flex items-center justify-center gap-2 px-12 py-3 rounded-xl text-sm font-bold transition-colors shadow-lg ${type === 'DEPOT' ? 'bg-primary text-white hover:bg-primary-focus shadow-indigo-500/20' : 'bg-error text-white hover:bg-error-focus shadow-red-500/20'}`}
                                    disabled={loading}
                                >
                                    {loading && <span className="inline-block size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
                                    {type === 'DEPOT' ? t('common:add_deposit') : t('common:make_withdrawal')}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            {loadingHistory ? (
                                <div className="flex justify-center py-12"><span className="inline-block size-8 border-2 border-base-300 border-t-indigo-600 rounded-full animate-spin"></span></div>
                            ) : history.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="text-xs uppercase tracking-wider text-base-content/40">
                                                <th>{t('common:date')}</th>
                                                <th>Type</th>
                                                <th className="text-right">{t('common:total')}</th>
                                                <th>Mode</th>
                                                <th className="min-w-[150px]">{t('common:info') || 'Info'}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {history.map((item) => (
                                                <tr key={item.id} className="text-sm">
                                                    <td className="whitespace-nowrap flex items-center gap-2">
                                                        <Calendar className="size-3.5 text-base-content/30" />
                                                        {formatDateFr(item.date)}
                                                    </td>
                                                    <td>
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                                                            item.type === 'DEPOT' ? 'bg-success/20 text-success' : 
                                                            item.type === 'RETRAIT' ? 'bg-error/20 text-error' : 
                                                            item.type === 'ACHAT' ? 'bg-info/20 text-info' : 'bg-warning/20 text-warning'
                                                        }`}>
                                                            {item.type_display}
                                                        </span>
                                                    </td>
                                                    <td className={`text-right font-mono font-bold whitespace-nowrap ${
                                                        item.type === 'DEPOT' || item.type === 'ANNULATION_ACHAT' ? 'text-success' : 'text-error'
                                                    }`}>
                                                        {item.type === 'DEPOT' || item.type === 'ANNULATION_ACHAT' ? '+' : '-'} {formatCurrency(parseFloat(item.montant))}
                                                    </td>
                                                    <td className="capitalize text-xs text-base-content/60">{item.mode_paiement || '-'}</td>
                                                    <td className="text-xs whitespace-nowrap text-base-content/60">
                                                        {item.facture_numero ? `#${item.facture_numero}` : item.notes || '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-base-content/40">
                                    <History className="size-12 mx-auto mb-3 text-base-content/20" />
                                    <p>{t('common:no_results_found')}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </PremiumModal>
    )
}
