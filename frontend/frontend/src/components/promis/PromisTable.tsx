import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import {
    Check, X, Printer, MessageCircle, MoreVertical, Eye,
    Clock, CheckCircle2, XCircle
} from 'lucide-react';
import type { Promis } from '../../types';
import ActionIcon from '../ui/ActionIcon';
import SelectionHeader from '../ui/SelectionHeader';
import { Checkbox } from '../shadcn/checkbox';
import { Badge } from '../shadcn/badge';
import { Button } from '../shadcn/button';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel
} from '../shadcn/dropdown-menu';
import { cn } from '../../lib/utils';

// Composant séparé pour éviter les re-renders inutiles
interface BulkActionsMenuProps {
    selectedIds: Set<number>;
    promisList: Promis[];
    onDeliver: (id: number) => void;
    onCancel: (id: number) => void;
    onPrint: (id: number) => void;
    onSms: (promis: Promis) => void;
    onWhatsApp: (id: number) => void;
    onBulkDeliver: () => void;
    onBulkCancel: () => void;
    bulkLoading: boolean;
}

const BulkActionsMenu: React.FC<BulkActionsMenuProps> = React.memo(({
    selectedIds, promisList, onDeliver, onCancel, onPrint, onSms, onWhatsApp, onBulkDeliver, onBulkCancel, bulkLoading
}) => {
    const { t } = useTranslation(['stock', 'common']);

    if (selectedIds.size === 1) {
        const id = Array.from(selectedIds)[0];
        const p = promisList.find(x => x.id === id);
        if (!p) return null;
        return (
            <>
                <li className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {t('common:single_selection')}
                </li>
                {p.status === 'ATT' && (
                    <>
                        <li>
                            <button onClick={() => onDeliver(id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-emerald-50 text-emerald-600 font-medium">
                                <Check className="size-4" /> {t('stock:promis.actions.deliver')}
                            </button>
                        </li>
                        <li>
                            <button onClick={() => onCancel(id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-50 text-red-500 font-medium">
                                <X className="size-4" /> {t('stock:promis.actions.cancel')}
                            </button>
                        </li>
                    </>
                )}
                <li>
                    <button onClick={() => onPrint(id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 text-slate-600">
                        <Printer className="size-4" /> {t('stock:promis.actions.print')}
                    </button>
                </li>
                {p.client_phone_display && (
                    <>
                        <li>
                            <button onClick={() => onSms(p)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-blue-50 text-blue-600">
                                <MessageCircle className="size-4" /> {t('stock:promis.actions.sms')}
                            </button>
                        </li>
                        <li>
                            <button onClick={() => onWhatsApp(id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-emerald-50 text-emerald-600">
                                <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.03c0 2.12.541 4.191 1.57 6.017L0 24l6.135-1.61a11.75 11.75 0 005.917 1.595h.004c6.637 0 12.032-5.396 12.035-12.032.002-3.218-1.248-6.242-3.517-8.511z"/></svg>
                                {t('stock:promis.actions.whatsapp')}
                            </button>
                        </li>
                    </>
                )}
            </>
        );
    }
    return (
        <>
            <li className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                {t('common:bulk_actions')}
            </li>
            <li>
                <button onClick={onBulkDeliver} disabled={bulkLoading} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-emerald-50 text-emerald-600 font-medium disabled:opacity-50">
                    {bulkLoading ? <span className="size-3 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin" /> : <Check className="size-4" />}
                    {t('stock:promis.actions.deliver')}
                </button>
            </li>
            <li>
                <button onClick={onBulkCancel} disabled={bulkLoading} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-50 text-red-500 font-medium disabled:opacity-50">
                    {bulkLoading ? <span className="size-3 border-2 border-slate-200 border-t-red-500 rounded-full animate-spin" /> : <X className="size-4" />}
                    {t('stock:promis.actions.cancel')}
                </button>
            </li>
        </>
    );
});

interface PromisTableProps {
    promisList: Promis[];
    loading: boolean;
    selectedIds: Set<number>;
    onToggleSelection: (id: number) => void;
    onToggleSelectAll: () => void;
    onDeliver: (id: number) => void;
    onCancel: (id: number) => void;
    onPrint: (id: number) => void;
    onSms: (promis: Promis) => void;
    onWhatsApp: (id: number) => void;
    onBulkDeliver: () => void;
    onBulkCancel: () => void;
    onClearSelection: () => void;
    onView: (promis: Promis) => void;
    bulkLoading: boolean;
}

const statusBadgeClass = (status: Promis['status']) => {
    switch (status) {
        case 'ATT': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'DEL': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'ANN': return 'bg-red-100 text-red-700 border-red-200';
        default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
};

const statusIcon = (status: Promis['status']) => {
    switch (status) {
        case 'ATT': return <Clock className="size-3" />;
        case 'DEL': return <CheckCircle2 className="size-3" />;
        case 'ANN': return <XCircle className="size-3" />;
        default: return null;
    }
};

export const PromisTable: React.FC<PromisTableProps> = ({
    promisList,
    loading,
    selectedIds,
    onToggleSelection,
    onToggleSelectAll,
    onDeliver,
    onCancel,
    onPrint,
    onSms,
    onWhatsApp,
    onBulkDeliver,
    onBulkCancel,
    onClearSelection,
    onView,
    bulkLoading
}) => {
    const { t, i18n } = useTranslation(['stock', 'common']);
    const currentLocale = i18n.language === 'fr' ? fr : enUS;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-4">
                <span className="size-6 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
                <p>{t('stock:promis.messages.loading')}</p>
            </div>
        );
    }

    if (promisList.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-4">
                <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg className="size-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                </div>
                <p>{t('stock:promis.messages.empty')}</p>
            </div>
        );
    }

    const attPromisCount = promisList.filter(p => p.status === 'ATT').length;
    const allSelected = attPromisCount > 0 && selectedIds.size === attPromisCount;

    return (
        <div className="overflow-auto size-full relative">
            <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="w-12 text-center sticky top-0 z-30 bg-slate-50 border-b border-slate-100">
                            <label className="cursor-pointer flex items-center justify-center p-4">
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={() => onToggleSelectAll()}
                                    disabled={attPromisCount === 0}
                                    className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                />
                            </label>
                        </th>
                        {selectedIds.size > 0 ? (
                            <SelectionHeader
                                selectedCount={selectedIds.size}
                                onClear={onClearSelection}
                                colSpan={7}
                                actions={
                                    <BulkActionsMenu
                                        selectedIds={selectedIds}
                                        promisList={promisList}
                                        onDeliver={onDeliver}
                                        onCancel={onCancel}
                                        onPrint={onPrint}
                                        onSms={onSms}
                                        onWhatsApp={onWhatsApp}
                                        onBulkDeliver={onBulkDeliver}
                                        onBulkCancel={onBulkCancel}
                                        bulkLoading={bulkLoading}
                                    />
                                }
                            >
                                <></>
                            </SelectionHeader>
                        ) : (
                            <>
                                <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 px-6 py-4">{t('stock:promis.table.date')}</th>
                                <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 px-6 py-4">{t('stock:promis.table.client')}</th>
                                <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 px-6 py-4">{t('stock:promis.table.phone')}</th>
                                <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 px-6 py-4">{t('stock:promis.table.product')}</th>
                                <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 px-6 py-4 text-center">{t('stock:promis.table.qty')}</th>
                                <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 px-6 py-4 text-center">{t('stock:promis.table.status')}</th>
                                <th className="sticky top-0 z-30 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 px-6 py-4 text-right pr-6">{t('stock:promis.table.actions')}</th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody className="text-slate-700 font-medium">
                    {promisList.map(p => (
                        <tr
                            key={p.id}
                            onClick={() => onView(p)}
                            className={cn(
                                'hover:bg-slate-50 transition-colors group cursor-pointer',
                                selectedIds.has(p.id) && 'bg-emerald-50/40'
                            )}
                        >
                            <td className="text-center px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                {p.status === 'ATT' && (
                                    <div className="flex justify-center">
                                        <Checkbox
                                            checked={selectedIds.has(p.id)}
                                            onCheckedChange={() => onToggleSelection(p.id)}
                                            className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                        />
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-3">
                                <div className="flex flex-col">
                                    <span className="font-semibold text-slate-700">{format(new Date(p.date_promis), 'dd/MM/yyyy', { locale: currentLocale })}</span>
                                    <span className="text-xs text-slate-400">{format(new Date(p.date_promis), 'HH:mm', { locale: currentLocale })}</span>
                                </div>
                            </td>
                            <td className="px-6 py-3">
                                <div className="font-medium text-slate-800">{p.client_display}</div>
                            </td>
                            <td className="px-6 py-3">
                                <div className="text-slate-400 font-mono text-xs">{p.client_phone_display || '-'}</div>
                            </td>
                            <td className="px-6 py-3">
                                <div className="max-w-[200px] truncate" title={p.produit_name}>
                                    <span className="font-semibold text-slate-700">{p.produit_name}</span>
                                </div>
                                {p.produit_cip && <div className="text-xs text-slate-400 font-mono mt-0.5">{p.produit_cip}</div>}
                            </td>
                            <td className="px-6 py-3 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-xs border border-slate-200">
                                    {p.quantite}
                                </span>
                            </td>
                            <td className="px-6 py-3 text-center">
                                <Badge variant="outline" className={cn('gap-1 uppercase tracking-wider', statusBadgeClass(p.status))}>
                                    {statusIcon(p.status)}
                                    {p.status_display}
                                </Badge>
                                {p.status === 'DEL' && p.date_livraison && (
                                    <div className="text-[10px] text-emerald-500 mt-1 opacity-80">
                                        {t('stock:promis.messages.delivered_on', { date: format(new Date(p.date_livraison), 'dd/MM/yyyy', { locale: currentLocale }) })}
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                    {/* Actions rapides visibles (statut ATT) */}
                                    {p.status === 'ATT' && selectedIds.size === 0 && (
                                        <>
                                            <ActionIcon
                                                icon={Check}
                                                onClick={() => onDeliver(p.id)}
                                                title={t('stock:promis.actions.deliver')}
                                                variant="success"
                                            />
                                            <ActionIcon
                                                icon={X}
                                                onClick={() => onCancel(p.id)}
                                                title={t('stock:promis.actions.cancel')}
                                                variant="error"
                                            />
                                        </>
                                    )}

                                    {/* Menu d'actions complet (clic, accessible, mobile-friendly) */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100" title={t('common:actions_title')}>
                                                <MoreVertical className="size-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-52">
                                            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-slate-400">
                                                {t('common:actions_title')}
                                            </DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => onView(p)} className="gap-2 cursor-pointer">
                                                <Eye className="size-4" />
                                                {t('common:view')}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => onPrint(p.id)} className="gap-2 cursor-pointer">
                                                <Printer className="size-4" />
                                                {t('stock:promis.actions.print')}
                                            </DropdownMenuItem>
                                            {p.client_phone_display && (
                                                <>
                                                    <DropdownMenuItem onClick={() => onSms(p)} className="gap-2 cursor-pointer text-blue-600 focus:text-blue-700">
                                                        <MessageCircle className="size-4" />
                                                        {t('stock:promis.actions.sms')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => onWhatsApp(p.id)} className="gap-2 cursor-pointer text-emerald-600 focus:text-emerald-700 font-semibold">
                                                        <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.03c0 2.12.541 4.191 1.57 6.017L0 24l6.135-1.61a11.75 11.75 0 005.917 1.595h.004c6.637 0 12.032-5.396 12.035-12.032.002-3.218-1.248-6.242-3.517-8.511z"/></svg>
                                                        {t('stock:promis.actions.whatsapp')}
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                            {p.status === 'ATT' && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => onDeliver(p.id)} className="gap-2 cursor-pointer text-emerald-600 focus:text-emerald-700 font-semibold">
                                                        <Check className="size-4" />
                                                        {t('stock:promis.actions.deliver')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => onCancel(p.id)} className="gap-2 cursor-pointer text-red-600 focus:text-red-700">
                                                        <X className="size-4" />
                                                        {t('stock:promis.actions.cancel')}
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                            {p.status !== 'ATT' && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem disabled className="gap-2 text-slate-400">
                                                        <Check className="size-4" />
                                                        {t('stock:promis.actions.deliver')}
                                                        <span className="ml-auto text-[10px] text-slate-400">
                                                            {p.status === 'DEL' ? t('stock:promis.actions.already_delivered') : t('stock:promis.actions.already_cancelled')}
                                                        </span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem disabled className="gap-2 text-slate-400">
                                                        <X className="size-4" />
                                                        {t('stock:promis.actions.cancel')}
                                                        <span className="ml-auto text-[10px] text-slate-400">
                                                            {p.status === 'DEL' ? t('stock:promis.actions.already_delivered') : t('stock:promis.actions.already_cancelled')}
                                                        </span>
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
