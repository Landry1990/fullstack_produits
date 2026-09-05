import React from 'react';
import { Package, Loader2 } from 'lucide-react';
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
    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-lg p-0 overflow-hidden" aria-describedby="lot-modal-desc">
                <DialogHeader className="px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                            <Package className="size-4 text-indigo-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-sm font-bold text-slate-900">
                                Sélectionner un lot
                            </DialogTitle>
                            <DialogDescription id="lot-modal-desc" className="text-xs">
                                Lots disponibles en stock
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-5">
                    {loadingLots ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="size-6 animate-spin text-indigo-600" />
                        </div>
                    ) : availableLots.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-sm">
                            Aucun lot disponible en stock pour ce produit.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">Lot</TableHead>
                                        <TableHead className="text-center text-xs">Expiration</TableHead>
                                        <TableHead className="text-center text-xs">Stock</TableHead>
                                        <TableHead className="text-right text-xs">Prix achat</TableHead>
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
                                                        <div className="text-[10px] text-amber-400">({daysLeft}j)</div>
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
                                                        Choisir
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

                <DialogFooter className="px-5 py-3 border-t border-slate-100">
                    <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                        Annuler
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

