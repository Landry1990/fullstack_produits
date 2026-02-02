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
        if (!facture) return { totalHt: 0, totalTva: 0, totalTtc: 0 };
        return {
            totalHt: parseFloat(facture.total_ht),
            totalTva: parseFloat(facture.total_tva),
            totalTtc: parseFloat(facture.total_ttc),
        };
    }, [facture]);

    if (!isOpen || !facture) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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
                                    <th className="px-6 py-4 text-right border-b border-gray-100">P.U.</th>
                                    <th className="px-6 py-4 text-right border-b border-gray-100">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm">
                                {facture.produits.map((prod) => (
                                    <tr key={prod.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-3">
                                            <div className="font-medium text-gray-900">
                                                {prod.produit_nom}
                                            </div>
                                            {prod.lot && (
                                                <div className="text-xs text-blue-600 font-mono mt-0.5 bg-blue-50 inline-block px-1.5 py-0.5 rounded border border-blue-100">
                                                    Lot: {prod.lot} {prod.date_expiration && `(Exp: ${prod.date_expiration})`}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-700 font-medium">
                                                {prod.quantity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-right text-gray-600 font-mono">
                                            {parseFloat(prod.selling_price).toLocaleString('fr-FR')} F
                                        </td>
                                        <td className="px-6 py-3 text-right font-medium font-mono text-gray-900 group-hover:text-blue-600 transition-colors">
                                            {(prod.quantity * parseFloat(prod.selling_price)).toLocaleString('fr-FR')} F
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer Totals */}
                <div className="bg-gray-50 border-t border-gray-200 p-6">
                    <div className="flex justify-end">
                        <div className="w-64 space-y-2">
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Total HT</span>
                                <span className="font-mono">{totals.totalHt.toLocaleString('fr-FR')} F</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>TVA</span>
                                <span className="font-mono">{totals.totalTva.toLocaleString('fr-FR')} F</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
                                <span>Total TTC</span>
                                <span className="font-mono text-blue-600">{totals.totalTtc.toLocaleString('fr-FR')} F</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
