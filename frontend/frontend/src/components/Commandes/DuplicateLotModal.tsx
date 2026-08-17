import { useTranslation } from 'react-i18next';
import { AlertTriangle, PackagePlus, Plus, X } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '../shadcn/dialog';
import { Button } from '../shadcn/button';
import type { ProduitModel, CommandeProduit } from '../../types';

interface DuplicateLotModalProps {
    isOpen: boolean;
    product: ProduitModel | null;
    existingLines: CommandeProduit[];
    onAddNewLine: () => void;
    onIncrementExisting: (index: number) => void;
    onCancel: () => void;
}

function _getProductName(cp: CommandeProduit): string {
    if (typeof cp.produit === 'object' && cp.produit !== null) return cp.produit.name;
    return cp.produit_nom || `Produit #${cp.produit}`;
}

export default function DuplicateLotModal({
    isOpen,
    product,
    existingLines,
    onAddNewLine,
    onIncrementExisting,
    onCancel,
}: DuplicateLotModalProps) {
    const { t } = useTranslation(['orders', 'common']);
    if (!isOpen || !product) return null;

    const hasMultipleLines = existingLines.length > 1;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
            <DialogContent className="max-w-md p-0 overflow-hidden" aria-describedby="duplicate-lot-desc">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-amber-100 bg-amber-50">
                    <div className="p-2 rounded-full bg-amber-100">
                        <AlertTriangle className="size-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <DialogTitle asChild>
                            <h3 className="font-bold text-slate-800 text-sm">{t('orders:duplicate_lot.title')}</h3>
                        </DialogTitle>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{product.name}</p>
                    </div>
                </div>

                <div className="px-5 py-4 space-y-3">
                    <DialogDescription asChild>
                        <p id="duplicate-lot-desc" className="text-sm text-slate-600">
                            {t('orders:duplicate_lot.already_in_order')}
                            {hasMultipleLines ? ` ${t('orders:duplicate_lot.multiple_lines', { count: existingLines.length })}` : ''}. {t('orders:duplicate_lot.question')}
                        </p>
                    </DialogDescription>

                    <div className="space-y-2">
                        {existingLines.map((line, i) => (
                            <button
                                key={line.id}
                                onClick={() => onIncrementExisting(i)}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-colors text-left group"
                            >
                                <Plus className="size-4 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-slate-700">
                                        {t('orders:duplicate_lot.increment')} — {hasMultipleLines ? t('orders:duplicate_lot.line_label', { number: i + 1 }) : t('orders:duplicate_lot.line_label_singular')}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-3">
                                        <span>{t('orders:duplicate_lot.qty', { qty: line.quantity })}</span>
                                        {line.lot && <span>{t('orders:duplicate_lot.lot', { lot: line.lot })}</span>}
                                        {line.date_expiration && <span>{t('orders:duplicate_lot.exp', { date: line.date_expiration })}</span>}
                                        {!line.lot && !line.date_expiration && <span className="italic">{t('orders:duplicate_lot.no_lot')}</span>}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={onAddNewLine}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-left group"
                    >
                        <PackagePlus className="size-4 text-indigo-400 group-hover:text-indigo-600 shrink-0" />
                        <div>
                            <div className="text-xs font-medium text-indigo-700">{t('orders:duplicate_lot.new_line')}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{t('orders:duplicate_lot.new_line_desc')}</div>
                        </div>
                    </button>
                </div>

                <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
                    <Button type="button" variant="ghost" onClick={onCancel}>
                        {t('orders:duplicate_lot.cancel')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
