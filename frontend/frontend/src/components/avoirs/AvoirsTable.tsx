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
            <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
                <Table className="w-full table-fixed text-sm">
                    <TableHeader className="sticky top-0 z-10">
                        <TableRow className="bg-slate-50 border-b border-slate-100 hover:bg-slate-50">
                            <TableHead className="w-12 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <span className="sr-only">Sélection</span>
                            </TableHead>
                            <TableHead className="w-28 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 text-left">{t('stock:avoirs.table.date')}</TableHead>
                            <TableHead className="w-32 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 text-left">{t('stock:avoirs.table.numero')}</TableHead>
                            <TableHead className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 text-left">{t('stock:avoirs.table.fournisseur')}</TableHead>
                            <TableHead className="w-32 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 text-left">{t('stock:avoirs.table.type')}</TableHead>
                            <TableHead className="w-16 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">{t('stock:avoirs.table.lines')}</TableHead>
                            <TableHead className="w-32 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">{t('stock:avoirs.table.montant')}</TableHead>
                            <TableHead className="w-28 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">{t('stock:avoirs.table.status')}</TableHead>
                            <TableHead className="w-32 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 text-right"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <TableRow key={i} className="border-b border-slate-100 animate-pulse hover:bg-transparent">
                                <TableCell className="py-2 px-3 text-center"><div className="size-4 rounded bg-slate-200 mx-auto" /></TableCell>
                                <TableCell className="py-2 px-3"><div className="h-4 rounded bg-slate-200" style={{ width: '70%' }} /></TableCell>
                                <TableCell className="py-2 px-3"><div className="h-4 rounded bg-slate-200" style={{ width: '60%' }} /></TableCell>
                                <TableCell className="py-2 px-3"><div className="h-4 rounded bg-slate-200" style={{ width: '80%' }} /></TableCell>
                                <TableCell className="py-2 px-3"><div className="h-4 rounded bg-slate-200" style={{ width: '50%' }} /></TableCell>
                                <TableCell className="py-2 px-3 text-center"><div className="size-4 rounded bg-slate-200 mx-auto" /></TableCell>
                                <TableCell className="py-2 px-3"><div className="h-4 rounded bg-slate-200 ml-auto" style={{ width: '60%' }} /></TableCell>
                                <TableCell className="py-2 px-3 text-center"><div className="h-4 rounded bg-slate-200 mx-auto" style={{ width: '50%' }} /></TableCell>
                                <TableCell className="py-2 px-3"></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    }

    if (avoirs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="p-4 bg-slate-100 rounded-2xl mb-4">
                    <Inbox className="size-10 text-slate-300" />
                </div>
                <h3 className="text-base font-semibold text-slate-700">{t('stock:avoirs.empty')}</h3>
            </div>
        );
    }

    const draftAvoirs = avoirs.filter(a => isDraftStatus(a.status));
    const draftAvoirsCount = draftAvoirs.length;
    const allSelected = draftAvoirsCount > 0 && selectedIds.size === draftAvoirsCount;

    return (
        <div className="overflow-auto flex-1 min-h-0">
            <Table className="w-full table-fixed text-sm">
                <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-slate-50 border-b border-slate-100 hover:bg-slate-50">
                        <TableHead className="w-12 px-3 py-2 text-center">
                            <Checkbox
                                checked={allSelected}
                                onCheckedChange={onToggleSelectAll}
                                disabled={draftAvoirsCount === 0}
                                aria-label={t('common:select_all')}
                            />
                        </TableHead>
                        {selectedIds.size > 0 ? (
                            <TableHead colSpan={8} className="bg-slate-50 px-3 py-2">
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
                                <TableHead className="w-28 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 text-left">{t('stock:avoirs.table.date')}</TableHead>
                                <TableHead className="w-32 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 text-left">{t('stock:avoirs.table.numero')}</TableHead>
                                <TableHead className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 text-left">{t('stock:avoirs.table.fournisseur')}</TableHead>
                                <TableHead className="w-32 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 text-left">{t('stock:avoirs.table.type')}</TableHead>
                                <TableHead className="w-16 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">{t('stock:avoirs.table.lines')}</TableHead>
                                <TableHead className="w-32 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">{t('stock:avoirs.table.montant')}</TableHead>
                                <TableHead className="w-28 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">{t('stock:avoirs.table.status')}</TableHead>
                                <TableHead className="w-32 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 text-right"></TableHead>
                            </>
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody className="text-sm">
                    {avoirs.map((avoir) => {
                        const isDraft = isDraftStatus(avoir.status);
                        const montant = Number(avoir.total_ht) || 0;
                        const nbLignes = avoir.produits?.length ?? null;

                        return (
                            <TableRow
                                key={avoir.id}
                                className={`group cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50/80 ${selectedIds.has(avoir.id) ? 'bg-emerald-50/40' : ''}`}
                                onClick={() => selectedIds.size === 0 && onView(avoir)}
                                data-state={selectedIds.has(avoir.id) ? 'selected' : undefined}
                            >
                                <TableCell className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                    {isDraft && (
                                        <Checkbox
                                            checked={selectedIds.has(avoir.id)}
                                            onCheckedChange={() => onToggleSelection(avoir.id)}
                                            aria-label={t('common:select')}
                                        />
                                    )}
                                </TableCell>
                                <TableCell className="px-3 py-2">
                                    <div className="font-semibold text-slate-900 text-sm">
                                        {format(new Date(avoir.created_at || avoir.date), 'dd/MM/yyyy', { locale: i18n.language === 'fr' ? fr : enUS })}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                                        {format(new Date(avoir.created_at || avoir.date), 'HH:mm', { locale: i18n.language === 'fr' ? fr : enUS })}
                                    </div>
                                </TableCell>
                                <TableCell className="px-3 py-2">
                                    <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                        {avoir.numero}
                                    </span>
                                </TableCell>
                                <TableCell className="px-3 py-2">
                                    <div className="font-semibold text-slate-700 text-sm leading-tight truncate" title={avoir.fournisseur_name || ''}>
                                        {avoir.fournisseur_name || <span className="text-slate-300 italic text-xs">—</span>}
                                    </div>
                                </TableCell>
                                <TableCell className="px-3 py-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${getTypeAvoirStyle(avoir.type_avoir)}`}>
                                        {getTypeAvoirLabel(avoir.type_avoir, t)}
                                    </span>
                                </TableCell>
                                <TableCell className="px-3 py-2 text-center">
                                    {nbLignes !== null ? (
                                        <span className="inline-flex items-center justify-center size-6 rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                                            {nbLignes}
                                        </span>
                                    ) : (
                                        <span className="text-slate-300">—</span>
                                    )}
                                </TableCell>
                                <TableCell className="px-3 py-2 text-right">
                                    <span className={`font-mono font-bold text-sm ${montant > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                                        {formatCurrency(montant)}
                                    </span>
                                </TableCell>
                                <TableCell className="px-3 py-2 text-center">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${getStatusStyle(avoir.status_display || avoir.status)}`}>
                                        {getStatusLabel(avoir.status_display || avoir.status, t)}
                                    </span>
                                </TableCell>
                                <TableCell className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
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
