import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Calendar, User, CreditCard, Smartphone, CheckCircle2 } from 'lucide-react';
import type { Facture } from '../../../types';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../../../utils/formatters';

interface ProductDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    facture: Facture | null;
    loading: boolean;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
    isOpen,
    onClose,
    facture,
    loading
}) => {
    const { t } = useTranslation(['sales', 'common']);
    const { user } = useAuth();
    const [sendingReminder, setSendingReminder] = useState<number | null>(null);

    const handleSendRenewalReminder = async (lineId: number, productName: string) => {
        if (!user?.token) return;
        
        setSendingReminder(lineId);
        try {
            const response = await api.post(`facture-produits/${lineId}/envoi_rappel_renouvellement/`, {});
            toast.success(response.data.detail || `Rappel envoyé pour ${productName}`);
        } catch (error: any) {
            console.error('Error sending renewal reminder:', error);
            const msg = error.response?.data?.detail || "Erreur lors de l'envoi du rappel";
            toast.error(msg);
        } finally {
            setSendingReminder(null);
        }
    };

    // Calculs de montants
    const totals = useMemo(() => {
        if (!facture) return { totalHt: 0, totalTva: 0, totalTtc: 0, remise: 0, partClient: 0 };
        const totalTtc = parseFloat(String(facture.total_ttc || '0'));
        const partClient = facture.part_client ? parseFloat(String(facture.part_client)) : totalTtc;
        
        const totalHt = parseFloat(String(facture.total_ht || '0'));
        const totalTva = parseFloat(String(facture.total_tva || '0'));
        
        return {
            totalHt: totalHt,
            totalTva: totalTva,
            totalTtc: totalTtc,
            remise: parseFloat(String(facture.remise || '0')),
            partClient: partClient
        };
    }, [facture]);

    if (!isOpen || !facture) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="border-b border-slate-200 p-6 flex justify-between items-center bg-slate-100">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-xl font-bold text-slate-800">
                                {t('invoice_details')}
                            </h2>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                facture.status === 'PAY'
                                    ? 'bg-green-100 text-green-700'
                                    : facture.status === 'ANN'
                                        ? 'bg-red-50 text-red-600'
                                        : 'bg-yellow-100 text-yellow-700'
                            }`}>
                                {facture.status_display}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                            <span className="flex items-center gap-1.5 shrink-0">
                                <span className="font-mono font-medium text-slate-800">#{facture.numero_facture || facture.id}</span>
                            </span>
                            <span className="size-1 bg-gray-300 rounded-full hidden sm:block" />
                            <span className="flex items-center gap-1.5 shrink-0">
                                <Calendar className="size-3.5" />
                                {new Date(facture.date).toLocaleString()}
                            </span>
                            <span className="size-1 bg-gray-300 rounded-full hidden sm:block" />
                            <span className="flex items-center gap-1.5 min-w-0">
                                <User className="size-3.5 shrink-0" />
                                <span className="truncate max-w-[200px] sm:max-w-none font-medium text-slate-800">
                                    {facture.client_name || facture.client_name_override || t('common:passerby_client')}
                                </span>
                            </span>
                            <span className="size-1 bg-gray-300 rounded-full hidden sm:block" />
                            <span className="flex items-center gap-1.5 shrink-0" title={t('table.operator')}>
                                <User className="size-3.5 text-blue-500" />
                                <span className="text-slate-500 text-xs">{t('table.operator')} :</span>
                                <span className="text-slate-600 font-medium">{facture.created_by_name || '-'}</span>
                            </span>
                            {facture.paiements && facture.paiements.length > 0 && facture.paiements[0].user_details ? (
                                <>
                                    <span className="size-1 bg-gray-300 rounded-full hidden sm:block" />
                                    <span className="flex items-center gap-1.5 shrink-0" title="Caissier">
                                        <div className="size-3.5 rounded-full bg-green-100 flex items-center justify-center">
                                            <User className="size-2.5 text-green-600" />
                                        </div>
                                        <span className="text-slate-500 text-xs">Caissier :</span>
                                        <span className="text-slate-600 font-medium">{facture.paiements[0].user_details.full_name || facture.paiements[0].user_details.username}</span>
                                    </span>
                                </>
                            ) : facture.validated_by_name && (
                                <>
                                    <span className="size-1 bg-gray-300 rounded-full hidden sm:block" />
                                    <span className="flex items-center gap-1.5 shrink-0" title="Caissier">
                                        <div className="size-3.5 rounded-full bg-green-100 flex items-center justify-center">
                                            <User className="size-2.5 text-green-600" />
                                        </div>
                                        <span className="text-slate-500 text-xs">Caissier :</span>
                                        <span className="text-slate-600 font-medium">{facture.validated_by_name}</span>
                                    </span>
                                </>
                            )}
                            {facture.cancelled_by_name && (
                                <>
                                    <span className="size-1 bg-gray-300 rounded-full hidden sm:block" />
                                    <span className="flex items-center gap-1.5 shrink-0" title="Annulé par">
                                        <div className="size-3.5 rounded-full bg-red-50 flex items-center justify-center">
                                            <User className="size-2.5 text-red-600" />
                                        </div>
                                        <span className="text-slate-600 font-medium">{facture.cancelled_by_name}</span>
                                    </span>
                                </>
                            )}
                        </div>
                        {facture.paiements && facture.paiements.length > 0 && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                                <CreditCard className="size-3.5" />
                                <span>Règlements:</span>
                                <div className="flex gap-2">
                                    {facture.paiements.map((p, idx) => (
                                        <span key={idx} className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 border border-slate-200 text-[10px]">
                                            {p.mode_paiement_display} ({formatCurrency(parseFloat(p.montant))})
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X className="size-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-0">
                    {loading ? (
                        <div className="flex justify-center items-center h-48 text-slate-500">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mr-3"></div>
                            {t('common:loading')}
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-100 sticky top-0 z-10 text-xs uppercase text-slate-500 font-semibold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 border-b border-slate-200">{t('fields.product')}</th>
                                    <th className="px-6 py-4 text-center border-b border-slate-200">{t('fields.quantity')}</th>
                                    <th className="px-6 py-4 text-right border-b border-slate-200">{t('fields.unit_price')} (Net)</th>
                                    <th className="px-6 py-4 text-right border-b border-slate-200">{t('fields.total')}</th>
                                    <th className="px-6 py-4 text-center border-b border-slate-200">{t('table.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm">
                                {facture.produits?.map((prod) => {
                                    const puVente = parseFloat(prod.selling_price || '0');
                                    const remiseUnitaire = parseFloat(prod.discount || '0');
                                    const puNet = puVente - remiseUnitaire;
                                    const totalLigne = prod.quantity * puNet;

                                    return (
                                        <tr key={prod.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-medium text-slate-800 uppercase">
                                                        {prod.produit_nom}
                                                    </div>
                                                    {prod.is_chronic && (
                                                        <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full border border-emerald-100 font-bold animate-pulse">
                                                            <CheckCircle2 className="size-2.5" />
                                                            CHRONIQUE
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {prod.lot && (
                                                        <span className="text-[10px] text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                                            Lot: {prod.lot} {prod.date_expiration && `(Exp: ${prod.date_expiration})`}
                                                        </span>
                                                    )}
                                                    {remiseUnitaire > 0 && (
                                                        <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                                            Remise: -{formatCurrency(remiseUnitaire)} /unité
                                                        </span>
                                                    )}
                                                    {prod.treatment_duration_days && (
                                                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                            Durée: {prod.treatment_duration_days} jours
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-700 font-medium">
                                                    {prod.quantity}
                                                </span>
                                            </td>
                                             <td className="px-6 py-3 text-right text-slate-600 font-mono">
                                                {formatCurrency(puNet)}
                                            </td>
                                            <td className="px-6 py-3 text-right font-medium font-mono text-slate-700 group-hover:text-emerald-600 transition-colors">
                                                {formatCurrency(totalLigne)}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                {prod.is_chronic && (
                                                    <button
                                                        onClick={() => handleSendRenewalReminder(prod.id, prod.produit_nom || 'produit')}
                                                        disabled={sendingReminder === prod.id}
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                            sendingReminder === prod.id
                                                                ? 'bg-slate-100 text-slate-400'
                                                                : 'border border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:shadow-sm'
                                                        }`}
                                                        title="Envoyer un rappel de renouvellement WhatsApp"
                                                    >
                                                        {sendingReminder !== prod.id && <Smartphone className="size-3" />}
                                                        Rappel
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer Totals */}
                <div className="bg-slate-100 border-t border-slate-200 p-6">
                    <div className="flex justify-end">
                    <div className="flex flex-wrap items-center justify-end gap-8 text-sm">
                        <div className="flex flex-col items-end border-r border-slate-300 pr-8 last:border-0 last:pr-0">
                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">{t('fields.subtotal_ht')}</span>
                            <span className="font-mono font-bold text-slate-800">{formatCurrency(totals.totalHt)}</span>
                        </div>
                        <div className="flex flex-col items-end border-r border-slate-300 pr-8 last:border-0 last:pr-0">
                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">{t('fields.vat')}</span>
                            <span className="font-mono font-bold text-slate-800">{formatCurrency(totals.totalTva)}</span>
                        </div>
                        {totals.remise > 0 && (
                            <div className="flex flex-col items-end border-r border-slate-300 pr-8 last:border-0 last:pr-0">
                                <span className="text-[10px] uppercase font-black tracking-widest text-orange-500 mb-1">{t('table.discount')}</span>
                                <span className="font-mono font-bold text-amber-600">-{formatCurrency(totals.remise)}</span>
                            </div>
                        )}
                        <div className="flex flex-col items-end bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 shadow-sm">
                            <span className="text-[10px] uppercase font-black tracking-widest text-blue-500 mb-1">{t('fields.total_ttc')}</span>
                            <span className="font-mono text-xl text-blue-600 font-black tracking-tight">
                                {formatCurrency(totals.totalTtc)}
                            </span>
                        </div>
                    </div>

                    {/* Part Client (Tiers Payant) - Resté en dessous car c'est une alerte importante */}
                    <div className="flex justify-end mt-4">
                        {Math.abs(totals.partClient - totals.totalTtc) > 1 && (
                            <div className="flex items-center gap-4 text-white bg-blue-500 py-2.5 px-5 rounded-xl shadow-lg">
                                <span className="uppercase text-[10px] font-black tracking-widest opacity-80 border-r border-white/20 pr-4">À payer client</span>
                                <span className="font-mono text-2xl font-black tracking-tight">
                                    {formatCurrency(totals.partClient)}
                                </span>
                            </div>
                        )}
                    </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

