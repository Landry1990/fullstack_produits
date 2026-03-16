import React from 'react';
import { useTranslation } from 'react-i18next';
import PremiumModal from '../../common/PremiumModal';
import { formatCurrency } from '../../../utils/formatters';
import { format } from 'date-fns';


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
    const { t } = useTranslation();
    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('avoirs.modals.lot_title', 'Sélectionner un Lot pour le Retour')}
        >
            <div className="space-y-4">
                {loadingLots ? (
                    <div className="flex justify-center p-8">
                        <span className="loading loading-spinner loading-md text-primary" />
                    </div>
                ) : availableLots.length > 0 ? (
                    <div className="overflow-x-auto border border-base-200 rounded-xl">
                        <table className="table table-zebra table-sm">
                            <thead className="bg-base-200">
                                <tr>
                                    <th>{t('avoirs.form.table_lot')}</th>
                                    <th>{t('avoirs.table.date')}</th>
                                    <th>{t('stock.table_stock')}</th>
                                    <th>{t('avoirs.form.table_price')}</th>
                                    <th className="text-right">{t('common.actions_title')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {availableLots.map(lot => (
                                    <tr key={lot.id}>
                                        <td className="font-mono font-bold text-xs">{lot.lot || 'N/A'}</td>
                                        <td className="text-xs">
                                            {lot.date_expiration ? format(new Date(lot.date_expiration), 'dd/MM/yyyy') : '-'}
                                        </td>
                                        <td>
                                            <span className="badge badge-sm badge-ghost">{lot.quantity_remaining}</span>
                                        </td>
                                        <td className="font-mono text-xs">{formatCurrency(lot.price_cost || 0)}</td>
                                        <td className="text-right">
                                            <button 
                                                type="button"
                                                className="btn btn-primary btn-sm"
                                                onClick={() => onSelectLot(lot)}
                                            >
                                                {t('common.select', 'Sélectionner')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center p-8 bg-base-200/50 rounded-xl text-base-content/60">
                        {t('avoirs.modals.no_lots', 'Aucun lot disponible en stock pour ce produit.')}
                    </div>
                )}
            </div>
        </PremiumModal>
    );
};
