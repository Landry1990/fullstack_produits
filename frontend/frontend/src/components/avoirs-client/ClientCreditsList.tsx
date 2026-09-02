import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Check, ChevronLeft, ChevronRight, Download, Eye, FileText, Loader2, Plus, RotateCcw } from 'lucide-react';
import type { ClientCredit } from '../../types';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import { Badge } from '../shadcn/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../shadcn/table';
import { cn } from '../../lib/utils';

interface ClientCreditsListProps {
    credits: ClientCredit[];
    total: number;
    totalPages: number;
    page: number;
    pageSize: number;
    loading: boolean;
    isExporting: boolean;
    validatingId?: number | null;
    dateDebut: string;
    dateFin: string;
    onDateDebutChange: (value: string) => void;
    onDateFinChange: (value: string) => void;
    onPageChange: (page: number) => void;
    onExport: () => void;
    onView: (credit: ClientCredit) => void;
    onValidate: (credit: ClientCredit) => void;
    onCreate: () => void;
}

export const ClientCreditsList: React.FC<ClientCreditsListProps> = ({
    credits,
    total,
    totalPages,
    page,
    pageSize,
    loading,
    isExporting,
    validatingId,
    dateDebut,
    dateFin,
    onDateDebutChange,
    onDateFinChange,
    onPageChange,
    onExport,
    onView,
    onValidate,
    onCreate,
}) => {
    const { t } = useTranslation(['avoirs_client', 'common']);
    const locale = t('common:locale', { defaultValue: 'fr-FR' });

    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    const getStatusBadge = (status: ClientCredit['statut']) => {
        const config: Record<string, { className: string; icon: React.ReactNode }> = {
            BROUILLON: {
                className: 'bg-amber-50 text-amber-700 border-amber-200',
                icon: <span className="size-1.5 rounded-full bg-amber-500" />,
            },
            VALIDEE: {
                className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                icon: <span className="size-1.5 rounded-full bg-emerald-500" />,
            },
            ANNULEE: {
                className: 'bg-red-50 text-red-700 border-red-200',
                icon: <span className="size-1.5 rounded-full bg-red-500" />,
            },
        };
        const { className, icon } = config[status] || config.BROUILLON;
        return (
            <Badge className={cn('border shadow-none font-medium gap-1.5', className)}>
                {icon}
                {t(`statuts.${status.toLowerCase()}`)}
            </Badge>
        );
    };

    const formatCurrency = (value: string | number) => {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        const safeNum = isNaN(num) ? 0 : num;
        try {
            return new Intl.NumberFormat(locale, {
                style: 'decimal',
                minimumFractionDigits: 0,
            })
                .format(safeNum) + ' FCFA';
        } catch {
            return `${safeNum.toLocaleString(locale)} FCFA`;
        }
    };

    return (
        <div className="w-full h-full flex flex-col gap-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 w-full">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-emerald-100 rounded-lg text-emerald-600">
                            <RotateCcw className="size-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">{t('list.title')}</h1>
                            <p className="text-sm text-slate-500">{t('list.description')}</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Input
                                type="date"
                                value={dateDebut}
                                onChange={(e) => onDateDebutChange(e.target.value)}
                                className="w-36 text-sm"
                            />
                            <span className="text-slate-400">→</span>
                            <Input
                                type="date"
                                value={dateFin}
                                onChange={(e) => onDateFinChange(e.target.value)}
                                className="w-36 text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={onExport}
                                disabled={isExporting || loading}
                            >
                                {isExporting ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <Download className="size-4" />
                                )}
                                {t('list.export')}
                            </Button>
                            <Button onClick={onCreate} size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                                <Plus className="size-4" />
                                {t('list.new_credit')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col w-full flex-1 min-h-0">
                <div className="overflow-x-auto w-full">
                    <Table className="w-full min-w-[900px]">
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead className="w-[15%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('list.columns.number')}</TableHead>
                                <TableHead className="w-[10%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('list.columns.date')}</TableHead>
                                <TableHead className="w-[20%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('list.columns.client')}</TableHead>
                                <TableHead className="w-[16%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('list.columns.invoice')}</TableHead>
                                <TableHead className="w-[12%] px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('list.columns.amount')}</TableHead>
                                <TableHead className="w-[13%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('list.columns.status')}</TableHead>
                                <TableHead className="w-[14%] px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('list.columns.actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <Loader2 className="size-8 animate-spin text-emerald-600" />
                                            <span className="text-sm">{t('common:loading')}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : credits.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                                            <div className="p-3 bg-slate-50 rounded-full">
                                                <FileText className="size-8 text-slate-300" />
                                            </div>
                                            <p className="text-sm font-medium">{t('list.no_results')}</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                credits.map((credit) => (
                                    <TableRow key={credit.id} className="hover:bg-slate-50/70 transition-colors border-b border-slate-100 last:border-0">
                                        <TableCell className="px-4 py-3">
                                            <span className="font-mono font-semibold text-sm text-slate-700">{credit.numero}</span>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-sm text-slate-600">
                                            {credit.date ? format(new Date(credit.date), t('common:date_format_short', { defaultValue: 'dd/MM/yyyy' })) : '—'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-sm text-slate-700">
                                            {credit.client_name || t('list.no_client')}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-sm text-slate-600">
                                            {credit.facture_numero ? (
                                                <span className="font-mono text-xs">{credit.facture_numero}</span>
                                            ) : (
                                                '—'
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
                                            {formatCurrency(credit.montant_total)}
                                        </TableCell>
                                        <TableCell className="px-4 py-3">{getStatusBadge(credit.statut)}</TableCell>
                                        <TableCell className="px-4 py-3 text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                                                onClick={() => onView(credit)}
                                                title={t('list.view')}
                                            >
                                                <Eye className="size-4" />
                                            </Button>
                                            {credit.statut === 'BROUILLON' && (
                                                <Button
                                                    size="sm"
                                                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                                    onClick={() => onValidate(credit)}
                                                    disabled={validatingId === credit.id}
                                                >
                                                    {validatingId === credit.id ? (
                                                        <Loader2 className="size-3.5 animate-spin" />
                                                    ) : (
                                                        <Check className="size-3.5" />
                                                    )}
                                                    {t('list.validate')}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">
                        {t('list.pagination.showing', { start, end, total })}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(page - 1)}
                            disabled={page <= 1 || loading}
                            className="gap-1"
                        >
                            <ChevronLeft className="size-4" />
                            {t('list.pagination.prev')}
                        </Button>
                        <span className="text-sm font-medium text-slate-700 px-2">
                            {t('list.pagination.page', { page, total: totalPages })}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(page + 1)}
                            disabled={page >= totalPages || loading}
                            className="gap-1"
                        >
                            {t('list.pagination.next')}
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
