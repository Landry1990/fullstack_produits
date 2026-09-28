import React from 'react';
import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import type { StockLot } from '../../../types';
import { formatCurrency } from '../../../utils/formatters';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter
} from '../../shadcn/dialog';
import { Button } from '../../shadcn/button';
import {
    Table, TableHeader, TableBody, TableRow, TableHead, TableCell
} from '../../shadcn/table';
import { EmptyState } from '../../ui/EmptyState';
import SkeletonTable from '../../ui/SkeletonTable';

interface LotModalProps {
    isOpen: boolean;
    onClose: () => void;
    availableLots: StockLot[];
    loadingLots: boolean;
    onSelectLot: (lot: StockLot) => void;
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
    const { t } = useTranslation(['stock', 'common']);
    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-hidden flex flex-col" aria-describedby="lot-modal-desc">
                <DialogHeader className="px-5 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                            <Package className="size-4 text-indigo-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-sm font-bold text-slate-900">
                                {t('stock:avoirs.avoirs_lot_modal.select_lot')}
                            </DialogTitle>
                            <DialogDescription id="lot-modal-desc" className="text-xs">
                                {t('stock:avoirs.avoirs_lot_modal.available_lots')}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-5 flex-1 min-h-0 overflow-auto">
                    {loadingLots ? (
                        <SkeletonTable rows={3} columns={5} />
                    ) : availableLots.length === 0 ? (
                        <EmptyState
                            compact
                            title={t('stock:avoirs.avoirs_lot_modal.no_lots')}
                        />
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">{t('stock:avoirs.avoirs_lot_modal.col_lot')}</TableHead>
                                        <TableHead className="text-center text-xs">{t('stock:avoirs.avoirs_lot_modal.col_expiry')}</TableHead>
                                        <TableHead className="text-center text-xs">{t('stock:avoirs.avoirs_lot_modal.col_stock')}</TableHead>
                                        <TableHead className="text-right text-xs">{t('stock:avoirs.avoirs_lot_modal.col_price')}</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {availableLots.map(lot => {
                                        const expire = lot.date_expiration ? new Date(lot.date_expiration) : null;
                                        const daysLeft = expire ? Math.ceil((expire.getTime() - Date.now()) / 86400000) : null;
                                        const expiryClass = daysLeft === null ? 'text-slate-500'
                                            : daysLeft < 0 ? 'text-red-600 font-bold'
                                            : daysLeft < 30 ? 'text-amber-500 font-bold'
                                            : 'text-slate-700';
                                        return (
                                            <TableRow key={lot.id}>
                                                <TableCell>
                                                    <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                                                        {lot.lot || 'N/A'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className={`text-center text-xs ${expiryClass}`}>
                                                    {formatExpiry(lot.date_expiration)}
                                                    {daysLeft !== null && daysLeft >= 0 && daysLeft < 30 && (
                                                        <div className="text-caption text-amber-400">{t('stock:avoirs.avoirs_lot_modal.days_left', { days: daysLeft })}</div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                        {lot.quantity_remaining}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs text-slate-700">
                                                    {formatCurrency(Number(lot.price_cost) || 0)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        className="h-7 text-xs"
                                                        onClick={() => onSelectLot(lot)}
                                                    >
                                                        {t('stock:avoirs.avoirs_lot_modal.choose')}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                <DialogFooter className="px-5 py-3 border-t border-slate-100 shrink-0">
                    <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                        {t('common:cancel')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

