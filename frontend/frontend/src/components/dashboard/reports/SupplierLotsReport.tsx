import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Truck } from 'lucide-react';
import { formatColumnHeader, formatValue, isNumericColumn } from '../../../hooks/useCentreRapports';
import { groupBySupplier, type SupplierAggregate, type SupplierLotRow } from '../../../hooks/reports/supplierGroups';
import { Card, CardContent, CardHeader, CardTitle } from '../../shadcn/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../shadcn/table';

interface SupplierLotsReportProps {
    rows: SupplierLotRow[];
}

/** Vue groupée du rapport « Ventes par Fournisseur (Lots) » avec totaux et moyennes par fournisseur. */
export const SupplierLotsReport: React.FC<SupplierLotsReportProps> = ({ rows }) => {
    const { t } = useTranslation(['reports', 'common']);
    const { groups, grand } = useMemo(() => groupBySupplier(rows), [rows]);
    const columns = useMemo(() => Object.keys(rows[0]).filter(k => k !== 'fournisseur' && !k.startsWith('_')), [rows]);

    const aggregateRow = (
        key: string,
        label: string,
        values: Record<string, number>,
        className: string
    ) => (
        <TableRow key={key} className={className}>
            {columns.map((col, idx) => (
                <TableCell key={col} className={isNumericColumn(col) ? 'text-right' : 'text-left'}>
                    {idx === 0 ? label : col in values ? formatValue(col, Math.round(values[col] * 100) / 100, t) : ''}
                </TableCell>
            ))}
        </TableRow>
    );

    const aggregateRows = (key: string, name: string, agg: SupplierAggregate, grandTotal = false) => [
        aggregateRow(
            `${key}-total`,
            grandTotal
                ? t('reports:supplier_lots.grand_total', { count: agg.count, defaultValue: 'TOTAL GÉNÉRAL ({{count}} lots)' })
                : t('reports:supplier_lots.total', { name, count: agg.count, defaultValue: 'Total {{name}} ({{count}} lots)' }),
            agg.totals,
            grandTotal
                ? 'font-black text-emerald-800 bg-emerald-100/70 hover:bg-emerald-100/70 border-t-2 border-emerald-300'
                : 'font-bold text-slate-800 bg-slate-100 hover:bg-slate-100 border-t border-slate-300'
        ),
        aggregateRow(
            `${key}-avg`,
            t('reports:supplier_lots.average', { defaultValue: 'Marge moyenne par lot' }),
            agg.averages,
            grandTotal
                ? 'italic text-emerald-700 bg-emerald-50 hover:bg-emerald-50'
                : 'italic text-slate-500 bg-slate-50 hover:bg-slate-50'
        ),
    ];

    return (
        <Card className="overflow-hidden animate-in fade-in duration-500">
            <CardHeader className="border-b border-slate-200 bg-slate-50 py-4 px-6">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500">
                        {t('results.title', { defaultValue: 'Résultats' })}
                    </CardTitle>
                    <span className="text-caption text-slate-400 font-bold">
                        {t('reports:supplier_lots.summary', {
                            suppliers: groups.length, lots: grand.count,
                            defaultValue: '{{suppliers}} fournisseur(s) · {{lots}} lot(s)',
                        })}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
                <Table className="border-0 rounded-none">
                    <TableHeader>
                        <TableRow>
                            {columns.map(col => (
                                <TableHead key={col} className={isNumericColumn(col) ? 'text-right' : 'text-left'}>
                                    {formatColumnHeader(col, t)}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    {groups.map(group => (
                        <TableBody key={group.fournisseur}>
                            <TableRow className="bg-emerald-50/60 hover:bg-emerald-50/60">
                                <TableCell colSpan={columns.length} className="font-black uppercase tracking-wider text-emerald-700">
                                    <span className="inline-flex items-center gap-2">
                                        <Truck className="size-4" />
                                        {group.fournisseur}
                                    </span>
                                </TableCell>
                            </TableRow>
                            {group.rows.map((row, i) => (
                                <TableRow key={`${group.fournisseur}-${String(row.nom_produit)}-${String(row.lot)}-${i}`}>
                                    {columns.map((col, idx) => (
                                        <TableCell
                                            key={col}
                                            className={`${idx === 0 ? 'font-medium' : ''} ${isNumericColumn(col) ? 'text-right' : 'text-left'} ${
                                                (col === 'marge' || col === 'taux_marge') && Number(row[col]) < 0 ? 'text-red-600 font-bold' : ''
                                            }`}
                                        >
                                            {formatValue(col, row[col], t)}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                            {aggregateRows(group.fournisseur, group.fournisseur, group)}
                        </TableBody>
                    ))}
                    <TableBody>{aggregateRows('grand', '', grand, true)}</TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};
