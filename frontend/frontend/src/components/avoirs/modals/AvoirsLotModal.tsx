import React from 'react';
import { X, Package } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

interface LotModalProps {
    isOpen: boolean;
    onClose: () => void;
    availableLots: any[];
    loadingLots: boolean;
    onSelectLot: (lot: any) => void;
}

const formatExpiry = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch { return dateStr; }
};

export const AvoirsLotModal: React.FC<LotModalProps> = ({
    isOpen,
    onClose,
    availableLots,
    loadingLots,
    onSelectLot
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                            <Package className="size-4 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900 text-sm">Sélectionner un lot</h2>
                            <p className="text-xs text-gray-400">Lots disponibles en stock</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="size-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5">
                    {loadingLots ? (
                        <div className="flex justify-center py-10">
                            <span className="size-6 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
                        </div>
                    ) : availableLots.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-sm">
                            Aucun lot disponible en stock pour ce produit.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100">
                                        <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Lot</th>
                                        <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Expiration</th>
                                        <th className="px-4 py-2.5 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Stock</th>
                                        <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Prix achat</th>
                                        <th className="px-4 py-2.5"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {availableLots.map(lot => {
                                        const expire = lot.date_expiration ? new Date(lot.date_expiration) : null;
                                        const daysLeft = expire ? Math.ceil((expire.getTime() - Date.now()) / 86400000) : null;
                                        const expiryClass = daysLeft === null ? 'text-gray-500'
                                            : daysLeft < 0 ? 'text-red-600 font-bold'
                                            : daysLeft < 30 ? 'text-amber-500 font-bold'
                                            : 'text-gray-700';
                                        return (
                                            <tr key={lot.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <span className="font-mono font-bold text-xs text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                                                        {lot.lot || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className={`px-4 py-3 text-center text-xs ${expiryClass}`}>
                                                    {formatExpiry(lot.date_expiration)}
                                                    {daysLeft !== null && daysLeft >= 0 && daysLeft < 30 && (
                                                        <div className="text-[10px] text-amber-400">({daysLeft}j)</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                        {lot.quantity_remaining}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">
                                                    {formatCurrency(Number(lot.price_cost) || 0)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors"
                                                        onClick={() => onSelectLot(lot)}
                                                    >
                                                        Choisir
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
                    <button onClick={onClose} className="h-8 px-4 text-sm text-gray-500 hover:text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors">
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    );
};

