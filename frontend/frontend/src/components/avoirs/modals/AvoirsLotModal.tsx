import React from 'react';
import { useTranslation } from 'react-i18next';
import PremiumModal from '../../common/PremiumModal';
import { formatCurrency } from '../../../utils/formatters';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';


interface LotModalProps {
    isOpen: boolean;
    onClose: () => void;
    availableLots: any[];
    loadingLots: boolean;
    onSelectLot: (lot: any) => void;
}

export const AvoirsLotModal: React.FC<LotModalProps> = ({
    isOpen,
    onClose,
    availableLots,
    loadingLots,
    onSelectLot
}) => {
    const { t, i18n } = useTranslation(['stock', 'common']);
    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('avoirs.modals.lot_title', 'Sélectionner un Lot pour le Retour')}
        >
            <div className="space-y-4">
                {loadingLots ? (
                    <div className="flex justify-center p-8">
                        <span className="inline-block size-4 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin loading-md text-indigo-600" />
                    </div>
                ) : availableLots.length > 0 ? (
                    <div className="overflow-x-auto border border-gray-100 rounded-xl">
                        <table className="w-full text-sm border-separate border-spacing-0">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th>{t('avoirs.form.table_lot')}</th>
                                    <th>{t('avoirs.table.date')}</th>
                                    <th>{t('stock.table_stock')}</th>
                                    <th>{t('avoirs.form.table_price')}</th>
                                    <th className="text-right">{t('common:actions_title')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {availableLots.map(lot => (
                                    <tr key={lot.id}>
                                        <td className="font-mono font-bold text-xs">{lot.lot || 'N/A'}</td>
                                        <td className="text-xs">
                                            {lot.date_expiration ? format(new Date(lot.date_expiration), 'dd/MM/yyyy', { locale: i18n.language === 'fr' ? fr : enUS }) : '-'}
                                        </td>
                                        <td>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">{lot.quantity_remaining}</span>
                                        </td>
                                        <td className="font-mono text-xs">{formatCurrency(lot.price_cost || 0)}</td>
                                        <td className="text-right">
                                            <button 
                                                type="button"
                                                className="inline-flex items-center justify-center h-8 px-3 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                                                onClick={() => onSelectLot(lot)}
                                            >
                                                {t('common:select', 'Sélectionner')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center p-8 bg-gray-50 rounded-xl text-gray-500">
                        {t('avoirs.modals.no_lots', 'Aucun lot disponible en stock pour ce produit.')}
                    </div>
                )}
            </div>
        </PremiumModal>
    );
};

