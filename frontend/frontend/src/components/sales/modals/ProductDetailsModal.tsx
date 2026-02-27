import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Calendar, User, CreditCard } from 'lucide-react';
import type { Facture } from '../../../types';

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
    const { t } = useTranslation();

    // Calculs de montants
    const totals = useMemo(() => {
        if (!facture) return { totalHt: 0, totalTva: 0, totalTtc: 0, remise: 0, partClient: 0 };
        const totalTtc = parseFloat(String(facture.total_ttc || '0'));
        const partClient = facture.part_client ? parseFloat(String(facture.part_client)) : totalTtc;
        
        return {
            totalHt: parseFloat(String(facture.total_ht || '0')),
            totalTva: parseFloat(String(facture.total_tva || '0')),
            totalTtc: totalTtc,
            remise: parseFloat(String(facture.remise || '0')),
            partClient: partClient
        };
    }, [facture]);

    if (!isOpen || !facture) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="border-b border-gray-100 p-6 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-xl font-bold text-gray-900">
                                {t('sales.invoice_details')}
                            </h2>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                facture.status === 'PAY'
                                    ? 'bg-green-100 text-green-700'
                                    : facture.status === 'ANN'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-yellow-100 text-yellow-700'
                            }`}>
                                {facture.status_display}
                            </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1.5">
                                <span className="font-mono font-medium text-gray-700">#{facture.numero_facture || facture.id}</span>
                            </span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full" />
                            <span className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(facture.date).toLocaleString()}
                            </span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full" />
                            <span className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" />
                                {facture.client_name || facture.client_name_override || t('common.passerby_client')}
                            </span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full" />
                            <span className="flex items-center gap-1.5" title="Vendeur">
                                <User className="w-3.5 h-3.5 text-blue-500" />
                                <span className="text-gray-500 text-xs">Vendeur :</span>
                                <span className="text-gray-600 font-medium">{facture.created_by_name || '-'}</span>
                            </span>
                            {facture.paiements && facture.paiements.length > 0 && facture.paiements[0].user_details ? (
                                <>
                                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                    <span className="flex items-center gap-1.5" title="Caissier">
                                        <div className="w-3.5 h-3.5 rounded-full bg-green-100 flex items-center justify-center">
                                            <User className="w-2.5 h-2.5 text-green-600" />
                                        </div>
                                        <span className="text-gray-500 text-xs">Caissier :</span>
                                        <span className="text-gray-600 font-medium">{facture.paiements[0].user_details.full_name || facture.paiements[0].user_details.username}</span>
                                    </span>
                                </>
                            ) : facture.validated_by_name && (
                                <>
                                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                    <span className="flex items-center gap-1.5" title="Caissier">
                                        <div className="w-3.5 h-3.5 rounded-full bg-green-100 flex items-center justify-center">
                                            <User className="w-2.5 h-2.5 text-green-600" />
                                        </div>
                                        <span className="text-gray-500 text-xs">Caissier :</span>
                                        <span className="text-gray-600 font-medium">{facture.validated_by_name}</span>
                                    </span>
                                </>
                            )}
                             {facture.cancelled_by_name && (
                                <>
                                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                    <span className="flex items-center gap-1.5" title="Annulé par">
                                        <div className="w-3.5 h-3.5 rounded-full bg-red-100 flex items-center justify-center">
                                            <User className="w-2.5 h-2.5 text-red-600" />
                                        </div>
                                        <span className="text-gray-600 font-medium">{facture.cancelled_by_name}</span>
                                    </span>
                                </>
                            )}
                        </div>
                        {facture.paiements && facture.paiements.length > 0 && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Règlements:</span>
                                <div className="flex gap-2">
                                    {facture.paiements.map((p, idx) => (
                                        <span key={idx} className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 border border-gray-200">
                                            {p.mode_paiement_display} ({parseFloat(p.montant).toLocaleString('fr-FR')} F)
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-0">
                    {loading ? (
                        <div className="flex justify-center items-center h-48 text-gray-500">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                            Chargement des détails...
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 sticky top-0 z-10 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 border-b border-gray-100">Produit</th>
                                    <th className="px-6 py-4 text-center border-b border-gray-100">Qté</th>
                                    <th className="px-6 py-4 text-right border-b border-gray-100">P.U. (Net)</th>
                                    <th className="px-6 py-4 text-right border-b border-gray-100">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm">
                                {facture.produits.map((prod) => {
                                    const puVente = parseFloat(prod.selling_price || '0');
                                    const remiseUnitaire = parseFloat(prod.discount || '0');
                                    const puNet = puVente - remiseUnitaire;
                                    const totalLigne = prod.quantity * puNet;

                                    return (
                                        <tr key={prod.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-3">
                                                <div className="font-medium text-gray-900 uppercase">
                                                    {prod.produit_nom}
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {prod.lot && (
                                                        <span className="text-[10px] text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                                            Lot: {prod.lot} {prod.date_expiration && `(Exp: ${prod.date_expiration})`}
                                                        </span>
                                                    )}
                                                    {remiseUnitaire > 0 && (
                                                        <span className="text-[10px] text-orange-600 font-medium bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                                                            Remise: -{remiseUnitaire.toLocaleString('fr-FR')} F /unité
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-700 font-medium">
                                                    {prod.quantity}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-right text-gray-600 font-mono">
                                                {puNet.toLocaleString('fr-FR')} F
                                            </td>
                                            <td className="px-6 py-3 text-right font-medium font-mono text-gray-900 group-hover:text-blue-600 transition-colors">
                                                {totalLigne.toLocaleString('fr-FR')} F
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer Totals */}
                <div className="bg-gray-50 border-t border-gray-200 p-6">
                    <div className="flex justify-end">
                        <div className="w-72 space-y-2">
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Total Brut HT</span>
                                <span className="font-mono">{totals.totalHt.toLocaleString('fr-FR')} F</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Total TVA</span>
                                <span className="font-mono">{totals.totalTva.toLocaleString('fr-FR')} F</span>
                            </div>
                            {totals.remise > 0 && (
                                <div className="flex justify-between text-sm text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                    <span>Remise Facture</span>
                                    <span className="font-mono">-{totals.remise.toLocaleString('fr-FR')} F</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
                                <span>Total TTC</span>
                                <span className="font-mono text-blue-600">{totals.totalTtc.toLocaleString('fr-FR')} F</span>
                            </div>
                            
                            {/* Part Client (Tiers Payant) */}
                            {Math.abs(totals.partClient - totals.totalTtc) > 1 && (
                                <div className="flex justify-between text-xl font-black text-white bg-blue-600 p-3 rounded-lg shadow-md mt-4 animate-pulse">
                                    <span className="uppercase text-sm">À payer client</span>
                                    <span className="font-mono">{totals.partClient.toLocaleString('fr-FR')} F</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
