import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Check, X, Printer, MessageCircle, MoreVertical } from 'lucide-react';
import type { Promis } from '../../types';
import ActionIcon from '../ui/ActionIcon';
import SelectionHeader from '../ui/SelectionHeader';

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
    bulkLoading: boolean;
}

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
    bulkLoading
}) => {
    const { t, i18n } = useTranslation(['stock', 'common']);
    const currentLocale = i18n.language === 'fr' ? fr : enUS;

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'ATT': return 'bg-warning/10 text-warning border-warning/20';
            case 'DEL': return 'bg-success/10 text-success border-success/20';
            case 'ANN': return 'bg-error/10 text-error border-error/20';
            default: return 'bg-base-200 text-base-content/60 border-base-300';
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-base-content/60 gap-4">
                <span className="loading loading-spinner loading-md text-primary" />
                <p>{t('stock:promis.messages.loading')}</p>
            </div>
        );
    }

    if (promisList.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-base-content/60 gap-4">
                <div className="w-16 h-16 rounded-full bg-base-200 flex items-center justify-center">
                    <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                </div>
                <p>{t('stock:promis.messages.empty')}</p>
            </div>
        );
    }

    const attPromisCount = promisList.filter(p => p.status === 'ATT').length;
    const allSelected = attPromisCount > 0 && selectedIds.size === attPromisCount;

    const renderBulkActions = () => {
        if (selectedIds.size === 1) {
            const id = Array.from(selectedIds)[0];
            const p = promisList.find(x => x.id === id);
            if (!p) return null;
            return (
                <>
                    <li className="menu-title px-4 py-2 text-xs font-bold uppercase tracking-widest text-base-content/40">
                        {t('common:single_selection')}
                    </li>
                    {p.status === 'ATT' && (
                        <>
                            <li>
                                <a onClick={() => onDeliver(id)} className="flex items-center gap-3 py-3 hover:bg-success/10 text-success font-medium">
                                    <Check className="w-4 h-4" /> {t('stock:promis.actions.deliver')}
                                </a>
                            </li>
                            <li>
                                <a onClick={() => onCancel(id)} className="flex items-center gap-3 py-3 hover:bg-error/10 text-error font-medium">
                                    <X className="w-4 h-4" /> {t('stock:promis.actions.cancel')}
                                </a>
                            </li>
                        </>
                    )}
                    <li>
                        <a onClick={() => onPrint(id)} className="flex items-center gap-3 py-3 hover:bg-base-200">
                            <Printer className="w-4 h-4" /> {t('stock:promis.actions.print')}
                        </a>
                    </li>
                    {p.client_phone_display && (
                        <>
                            <li>
                                <a onClick={() => onSms(p)} className="flex items-center gap-3 py-3 hover:bg-info/10 text-info">
                                    <MessageCircle className="w-4 h-4" /> {t('stock:promis.actions.sms')}
                                </a>
                            </li>
                            <li>
                                <a onClick={() => onWhatsApp(id)} className="flex items-center gap-3 py-3 hover:bg-success/10 text-success">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.03c0 2.12.541 4.191 1.57 6.017L0 24l6.135-1.61a11.75 11.75 0 005.917 1.595h.004c6.637 0 12.032-5.396 12.035-12.032.002-3.218-1.248-6.242-3.517-8.511z"/></svg> {t('stock:promis.actions.whatsapp')}
                                </a>
                            </li>
                        </>
                    )}
                </>
            );
        }
        return (
            <>
                <li className="menu-title px-4 py-2 text-xs font-bold uppercase tracking-widest text-base-content/40">
                    {t('common:bulk_actions')}
                </li>
                <li>
                    <a onClick={onBulkDeliver} className={`flex items-center gap-3 py-3 hover:bg-success/10 text-success font-medium ${bulkLoading ? 'disabled' : ''}`}>
                        {bulkLoading ? <span className="loading loading-spinner loading-xs" /> : <Check className="w-4 h-4" />}
                        {t('stock:promis.actions.deliver')}
                    </a>
                </li>
                <li>
                    <a onClick={onBulkCancel} className={`flex items-center gap-3 py-3 hover:bg-error/10 text-error font-medium ${bulkLoading ? 'disabled' : ''}`}>
                        {bulkLoading ? <span className="loading loading-spinner loading-xs" /> : <X className="w-4 h-4" />}
                        {t('stock:promis.actions.cancel')}
                    </a>
                </li>
            </>
        );
    };

    return (
        <div className="overflow-auto w-full h-full relative">
            <table className="table table-zebra table-pin-rows w-full text-sm">
                <thead>
                    <tr className="bg-base-200 text-base-content/70 border-b border-base-300">
                        <th className="w-12 text-center rounded-tl-xl sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300">
                            <label className="cursor-pointer label p-0 justify-center">
                                <input 
                                    type="checkbox" 
                                    className="checkbox checkbox-sm checkbox-primary" 
                                    checked={allSelected}
                                    onChange={onToggleSelectAll}
                                    disabled={attPromisCount === 0}
                                />
                            </label>
                        </th>
                        {selectedIds.size > 0 ? (
                            <SelectionHeader
                                selectedCount={selectedIds.size}
                                onClear={onClearSelection}
                                colSpan={7}
                                actions={renderBulkActions()}
                            >
                                <></>
                            </SelectionHeader>
                        ) : (
                            <>
                                <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 px-6 py-4">{t('stock:promis.table.date')}</th>
                                <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 px-6 py-4">{t('stock:promis.table.client')}</th>
                                <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 px-6 py-4">{t('stock:promis.table.phone')}</th>
                                <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 px-6 py-4">{t('stock:promis.table.product')}</th>
                                <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 px-6 py-4 text-center">{t('stock:promis.table.qty')}</th>
                                <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 px-6 py-4 text-center">{t('stock:promis.table.status')}</th>
                                <th className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 text-[10px] font-black uppercase tracking-widest text-base-content/40 px-6 py-4 text-right pr-6">{t('stock:promis.table.actions')}</th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody className="text-base-content font-medium">
                    {promisList.map(p => (
                        <tr key={p.id} className={`hover:bg-base-200/50 transition-colors group ${selectedIds.has(p.id) ? 'bg-primary/5' : ''}`}>
                            <td className="text-center">
                                {p.status === 'ATT' && (
                                    <label className="cursor-pointer label p-0 justify-center">
                                        <input 
                                            type="checkbox" 
                                            className="checkbox checkbox-sm checkbox-primary" 
                                            checked={selectedIds.has(p.id)}
                                            onChange={() => onToggleSelection(p.id)}
                                        />
                                    </label>
                                )}
                            </td>
                            <td>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-base-content">{format(new Date(p.date_promis), 'dd/MM/yyyy', { locale: currentLocale })}</span>
                                    <span className="text-xs text-base-content/60">{format(new Date(p.date_promis), 'HH:mm', { locale: currentLocale })}</span>
                                </div>
                            </td>
                            <td>
                                <div className="font-medium">{p.client_display}</div>
                            </td>
                            <td>
                                <div className="text-base-content/80 font-mono text-xs">{p.client_phone_display || '-'}</div>
                            </td>
                            <td>
                                <div className="max-w-[200px] truncate" title={p.produit_name}>
                                    <span className="font-semibold">{p.produit_name}</span>
                                </div>
                                {p.produit_cip && <div className="text-xs text-base-content/50 font-mono mt-0.5">{p.produit_cip}</div>}
                            </td>
                            <td className="text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-base-200 text-base-content font-mono font-bold text-xs border border-base-300">
                                    {p.quantite}
                                </span>
                            </td>
                            <td className="text-center">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${getStatusStyle(p.status)}`}>
                                    {p.status_display}
                                </span>
                                {p.status === 'DEL' && p.date_livraison && (
                                    <div className="text-[10px] text-success mt-1 opacity-80">
                                        {t('stock:promis.messages.delivered_on', { date: format(new Date(p.date_livraison), 'dd/MM/yyyy', { locale: currentLocale }) })}
                                    </div>
                                )}
                            </td>
                            <td className="text-right">
                                {selectedIds.size === 0 && (
                                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                        {p.status === 'ATT' && (
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
                                        
                                        <div className="dropdown dropdown-end dropdown-hover">
                                            <div tabIndex={0} role="button" className="p-1.5 text-base-content/60 hover:bg-base-200 rounded-lg transition-colors">
                                                <MoreVertical className="w-[18px] h-[18px]" />
                                            </div>
                                            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow-lg bg-base-100 rounded-xl w-44 border border-base-200">
                                                <li>
                                                    <a onClick={() => onPrint(p.id)} className="flex items-center gap-2 hover:bg-primary/10 hover:text-primary">
                                                        <Printer className="w-4 h-4" />
                                                        {t('stock:promis.actions.print')}
                                                    </a>
                                                </li>
                                                {p.client_phone_display && (
                                                    <>
                                                        <li>
                                                            <a onClick={() => onSms(p)} className="flex items-center gap-2 hover:bg-info/10 hover:text-info">
                                                                <MessageCircle className="w-4 h-4" />
                                                                {t('stock:promis.actions.sms')}
                                                            </a>
                                                        </li>
                                                        <li>
                                                            <a onClick={() => onWhatsApp(p.id)} className="flex items-center gap-2 hover:bg-success/10 hover:text-success font-bold">
                                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.03c0 2.12.541 4.191 1.57 6.017L0 24l6.135-1.61a11.75 11.75 0 005.917 1.595h.004c6.637 0 12.032-5.396 12.035-12.032.002-3.218-1.248-6.242-3.517-8.511z"/></svg>
                                                                {t('stock:promis.actions.whatsapp')}
                                                            </a>
                                                        </li>
                                                    </>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
