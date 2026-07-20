import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import {
    Eye, Edit, Trash2, CheckCircle2, Check, MoreVertical, X,
    Loader2, Inbox
} from 'lucide-react';
import type { Avoir } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { Checkbox } from '../shadcn/checkbox';
import {
    Table, TableHeader, TableBody, TableRow, TableHead, TableCell
} from '../ui/Table';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuLabel, DropdownMenuItem
} from '../shadcn/dropdown-menu';
import { isDraftStatus, getStatusStyle, getStatusLabel, getTypeAvoirStyle, getTypeAvoirLabel } from './utils';

interface BulkActionsMenuProps {
    selectedIds: Set<number>;
    avoirs: Avoir[];
    onView: (avoir: Avoir) => void;
    onEdit: (avoir: Avoir) => void;
    onValidate: (avoir: Avoir) => void;
    onDelete: (avoir: Avoir) => void;
    onBulkValidate: () => void;
    onBulkDelete: () => void;
    bulkLoading: boolean;
}

const BulkActionsMenu: React.FC<BulkActionsMenuProps> = React.memo(({
    selectedIds, avoirs, onView, onEdit, onValidate, onDelete, onBulkValidate, onBulkDelete, bulkLoading
}) => {
    const { t } = useTranslation(['stock', 'common']);

    if (selectedIds.size === 1) {
        const id = Array.from(selectedIds)[0];
        const avoir = avoirs.find(x => x.id === id);
        if (!avoir) return null;
        const isDraft = isDraftStatus(avoir.status);

        return (
            <>
                <DropdownMenuLabel>{t('common:single_selection')}</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onView(avoir)} className="gap-2 cursor-pointer">
                    <Eye className="size-4 text-slate-500" /> {t('common:view')}
                </DropdownMenuItem>
                {isDraft && (
                    <>
                        <DropdownMenuItem onClick={() => onEdit(avoir)} className="gap-2 cursor-pointer">
                            <Edit className="size-4 text-amber-500" /> {t('common:edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onValidate(avoir)} className="gap-2 cursor-pointer">
                            <CheckCircle2 className="size-4 text-emerald-500" /> {t('common:validate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(avoir)} className="gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                            <Trash2 className="size-4" /> {t('common:delete')}
                        </DropdownMenuItem>
                    </>
                )}
            </>
        );
    }

    return (
        <>
            <DropdownMenuLabel>{t('common:bulk_actions')}</DropdownMenuLabel>
            <DropdownMenuItem onClick={onBulkValidate} disabled={bulkLoading} className="gap-2 cursor-pointer">
                {bulkLoading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4 text-emerald-500" />}
                {t('common:validate_all')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onBulkDelete} disabled={bulkLoading} className="gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                {bulkLoading ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {t('common:delete_all')}
            </DropdownMenuItem>
        </>
    );
});

interface AvoirsTableProps {
    avoirs: Avoir[];
    loading: boolean;
    selectedIds: Set<number>;
    onToggleSelection: (id: number) => void;
    onToggleSelectAll: () => void;
    onView: (avoir: Avoir) => void;
    onEdit: (avoir: Avoir) => void;
    onValidate: (avoir: Avoir) => void;
    onDelete: (avoir: Avoir) => void;
    onBulkValidate: () => void;
    onBulkDelete: () => void;
    onClearSelection: () => void;
    bulkLoading: boolean;
}

export const AvoirsTable: React.FC<AvoirsTableProps> = ({
    avoirs,
    loading,
    selectedIds,
    onToggleSelection,
    onToggleSelectAll,
    onView,
    onEdit,
    onValidate,
    onDelete,
    onBulkValidate,
    onBulkDelete,
    onClearSelection,
    bulkLoading
}) => {
    const { t, i18n } = useTranslation(['stock', 'common']);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-4">
                <Loader2 className="size-8 animate-spin text-emerald-600" />
                <p>{t('stock:avoirs.loading')}</p>
            </div>
        );
    }

    if (avoirs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-4">
                <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center">
                    <Inbox className="size-8 text-slate-400" />
                </div>
                <p>{t('stock:avoirs.empty')}</p>
            </div>
        );
    }

    const draftAvoirs = avoirs.filter(a => isDraftStatus(a.status));
    const draftAvoirsCount = draftAvoirs.length;
    const allSelected = draftAvoirsCount > 0 && selectedIds.size === draftAvoirsCount;

    return (
        <div className="overflow-auto size-full relative">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-10 text-center">
                            <Checkbox
                                checked={allSelected}
                                onCheckedChange={onToggleSelectAll}
                                disabled={draftAvoirsCount === 0}
                                aria-label={t('common:select_all')}
                            />
                        </TableHead>
                        {selectedIds.size > 0 ? (
                            <TableHead colSpan={7} className="bg-slate-50">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm" className="gap-2">
                                                    <MoreVertical className="size-4" />
                                                    {t('common:actions_title', { defaultValue: 'Actions' })}
                                                    <Badge variant="secondary" className="ml-1">{selectedIds.size}</Badge>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="w-56">
                                                <BulkActionsMenu
                                                    selectedIds={selectedIds}
                                                    avoirs={avoirs}
                                                    onView={onView}
                                                    onEdit={onEdit}
                                                    onValidate={onValidate}
                                                    onDelete={onDelete}
                                                    onBulkValidate={onBulkValidate}
                                                    onBulkDelete={onBulkDelete}
                                                    bulkLoading={bulkLoading}
                                                />
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <Button variant="ghost" size="sm" onClick={onClearSelection} className="gap-2 text-slate-500">
                                            <X className="size-4" />
                                            {t('common:actions.cancel', { defaultValue: 'Annuler' })}
                                        </Button>
                                    </div>
                                </div>
                            </TableHead>
                        ) : (
                            <>
                                <TableHead className="w-32">{t('stock:avoirs.table.date')}</TableHead>
                                <TableHead className="w-36">{t('stock:avoirs.table.numero')}</TableHead>
                                <TableHead>{t('stock:avoirs.table.fournisseur')}</TableHead>
                                <TableHead className="w-36">{t('stock:avoirs.table.type')}</TableHead>
                                <TableHead className="text-center w-16">{t('stock:avoirs.table.lines')}</TableHead>
                                <TableHead className="text-right w-32">{t('stock:avoirs.table.montant')}</TableHead>
                                <TableHead className="text-center w-28">{t('stock:avoirs.table.status')}</TableHead>
                                <TableHead className="w-28"></TableHead>
                            </>
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {avoirs.map((avoir) => {
                        const isDraft = isDraftStatus(avoir.status);
                        const montant = Number(avoir.total_ht) || 0;
                        const nbLignes = avoir.produits?.length ?? null;

                        return (
                            <TableRow
                                key={avoir.id}
                                className={`group cursor-pointer ${selectedIds.has(avoir.id) ? 'bg-emerald-50 hover:bg-emerald-50' : ''}`}
                                onClick={() => selectedIds.size === 0 && onView(avoir)}
                                data-state={selectedIds.has(avoir.id) ? 'selected' : undefined}
                            >
                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                    {isDraft && (
                                        <Checkbox
                                            checked={selectedIds.has(avoir.id)}
                                            onCheckedChange={() => onToggleSelection(avoir.id)}
                                            aria-label={t('common:select')}
                                        />
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="font-semibold text-slate-700 text-[13px]">
                                        {format(new Date(avoir.created_at || avoir.date), 'dd/MM/yyyy', { locale: i18n.language === 'fr' ? fr : enUS })}
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-medium">
                                        {format(new Date(avoir.created_at || avoir.date), 'HH:mm', { locale: i18n.language === 'fr' ? fr : enUS })}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                        {avoir.numero}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <div className="font-semibold text-slate-700 text-[13px] leading-tight">
                                        {avoir.fournisseur_name || <span className="text-slate-300 italic text-xs">—</span>}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${getTypeAvoirStyle(avoir.type_avoir)}`}>
                                        {getTypeAvoirLabel(avoir.type_avoir, t)}
                                    </span>
                                </TableCell>
                                <TableCell className="text-center">
                                    {nbLignes !== null ? (
                                        <span className="inline-flex items-center justify-center size-6 rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                                            {nbLignes}
                                        </span>
                                    ) : (
                                        <span className="text-slate-300">—</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <span className={`font-mono font-black text-sm ${montant > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                                        {formatCurrency(montant)}
                                    </span>
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${getStatusStyle(avoir.status_display || avoir.status)}`}>
                                        {getStatusLabel(avoir.status_display || avoir.status, t)}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                    {selectedIds.size === 0 && (
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="size-8 text-slate-400 hover:text-sky-600 hover:bg-sky-50"
                                                onClick={() => onView(avoir)}
                                                title={t('common:view')}
                                            >
                                                <Eye className="size-4" />
                                            </Button>
                                            {isDraft && (
                                                <>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8 text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                                        onClick={() => onEdit(avoir)}
                                                        title={t('common:edit')}
                                                    >
                                                        <Edit className="size-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                                                        onClick={() => onValidate(avoir)}
                                                        title={t('common:validate')}
                                                    >
                                                        <CheckCircle2 className="size-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => onDelete(avoir)}
                                                        title={t('common:delete')}
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
};
