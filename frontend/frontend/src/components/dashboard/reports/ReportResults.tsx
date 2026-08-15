import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    formatColumnHeader, 
    formatValue,
    isNumericColumn,
    isSummableColumn,
    isAverageColumn,
    isPercentageColumn
} from '../../../hooks/useCentreRapports';
import type { QueryDefinition, PaginationData } from '../../../hooks/useCentreRapports';
import { MonthlyReportView } from './MonthlyReportView';
import { StockValuationReport } from './StockValuationReport';
import { ChevronLeft, ChevronRight, Inbox, Eye, Download, AlertTriangle } from 'lucide-react';
import { Button } from '../../shadcn/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../shadcn/card';
import { Badge } from '../../shadcn/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../ui/Table';

// Constante de module pour éviter la recréation à chaque render
const EMPTY_PARAMS: Record<string, unknown> = {};

interface ReportResultsProps {
    selectedQuery: QueryDefinition;
    results: unknown;
    pagination: PaginationData | null;
    loading: boolean;
    onPageChange: (url: string | null) => void;
    onFilterChange?: (key: string, value: string) => void;
    currentParams?: Record<string, unknown>;
}

export const ReportResults: React.FC<ReportResultsProps> = ({
    selectedQuery,
    results,
    pagination,
    loading,
    onPageChange,
    onFilterChange,
    currentParams = EMPTY_PARAMS
}) => {
    const { t } = useTranslation(['reports', 'common']);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const margeFilter = (currentParams['filtre_marge'] as string) || 'all';

    const setMargeFilter = (f: 'all' | 'negative' | 'low') => {
        onFilterChange?.('filtre_marge', f === 'all' ? '' : f);
        tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        const scrollable = tableContainerRef.current?.closest('.overflow-y-auto');
        if (scrollable) scrollable.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (!results) {
        return (
            <Card className="flex-1 flex flex-col items-center justify-center border-dashed border-slate-300 bg-slate-50/50 animate-in fade-in duration-700">
                <CardContent className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Inbox className="size-20 mb-4 opacity-20" />
                    <CardTitle className="text-xl font-black uppercase tracking-[0.2em] text-slate-500">{t('results.execute_prompt', 'En attente d\'exécution...')}</CardTitle>
                    <CardDescription className="mt-2">{t('results.execute_prompt', { defaultValue: 'Exécutez une requête pour visualiser les résultats' })}</CardDescription>
                </CardContent>
            </Card>
        );
    }

    const renderData = () => {
        // Special case: Monthly Report
        if (selectedQuery.id === 'rapport_mensuel' && typeof results === 'object' && !Array.isArray(results)) {
            return <MonthlyReportView data={results} />;
        }

        // Special case: Stock Valuation Report
        if (selectedQuery.resultType === 'stock_valuation' && typeof results === 'object' && !Array.isArray(results)) {
            return <StockValuationReport data={results} />;
        }

        // Special case: Direct Download / Raw results
        if (selectedQuery.resultType === 'raw') {
            return (
                <Card className="border-emerald-200 bg-emerald-50/50 animate-in zoom-in duration-500">
                    <CardContent className="flex flex-col items-center justify-center py-20 text-emerald-700">
                        <Download className="size-16 mb-4" />
                        <CardTitle className="text-lg font-black uppercase tracking-widest">{t('results.export_success_short', { defaultValue: 'Rapport Généré' })}</CardTitle>
                        {results && typeof results === 'object' && (results as { filename?: string }).filename && (
                            <CardDescription className="mt-2 opacity-70">{(results as { filename?: string }).filename}</CardDescription>
                        )}
                    </CardContent>
                </Card>
            );
        }

        // Generic Cards Display
        if (selectedQuery.resultType === 'cards' && typeof results === 'object' && !Array.isArray(results)) {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {Object.entries(results).map(([key, value]) => {
                        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                            return (
                                <Card key={key}>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">{key.replace(/_/g, ' ')}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {Object.entries(value as object).map(([subKey, subValue]) => (
                                                <div key={subKey} className="flex justify-between items-center text-sm border-b border-slate-200/50 pb-2 last:border-0 last:pb-0">
                                                    <span className="text-slate-500 font-bold uppercase text-[10px] tracking-tight">{subKey.replace(/_/g, ' ')}</span>
                                                    <span className="font-black text-slate-800">{formatValue(subKey, subValue, t)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        }
                        return (
                            <Card key={key} className="flex flex-col justify-center">
                                <CardHeader className="pb-1">
                                    <CardTitle className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">{key.replace(/_/g, ' ')}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-black text-slate-800">{formatValue(key, value, t)}</div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            );
        }

        // Table Display
        if (Array.isArray(results)) {
            if (results.length === 0) {
                return (
                    <Card className="border-dashed border-slate-300 bg-slate-50/50">
                        <CardContent className="flex flex-col items-center justify-center py-20 text-slate-400 italic">
                            <Inbox className="size-12 mb-2 text-slate-300" />
                            <CardDescription className="text-base">{t('results.empty', 'Aucun résultat trouvé pour cette période.')}</CardDescription>
                        </CardContent>
                    </Card>
                );
            }

            const isMargesReport = selectedQuery.id === 'detail_marges_lots';
            const isMultiYearCAReport = selectedQuery.id === 'rapport_ca_multi_annuel';

            // Filtrer les lignes TOTAL du backend pour éviter le double total (backend + frontend footer)
            // Certains rapports retournent déjà une ligne total qu'il ne faut pas compter dans le calcul frontend
            const isTotalRow = (r: unknown): boolean => {
                if (!r || typeof r !== 'object') return false;
                const row = r as Record<string, unknown>;
                // Déjà géré pour le rapport multi-annuel
                if (isMultiYearCAReport && row['Mois'] === 'total_general') return true;
                // Détecter les lignes TOTAL (case insensitive) dans n'importe quelle colonne string
                return Object.values(row).some(val => 
                    typeof val === 'string' && val.toUpperCase() === 'TOTAL'
                );
            };
            
            // S'assurer que results est bien un tableau avant de filtrer
            const filteredResults = Array.isArray(results) 
                ? results.filter((r: unknown) => !isTotalRow(r))
                : results;

            // Utiliser filteredResults (et non results) pour obtenir les colonnes
            const dataForColumns = filteredResults.length > 0 ? filteredResults : results;
            const rawColumns = dataForColumns.length > 0 
                ? Object.keys(dataForColumns[0]).filter(k => !k.startsWith('_') && k !== 'id' && !k.endsWith('_id'))
                : [];
            const rawColumnsSet = new Set(rawColumns);
            const columns = selectedQuery.columns 
                ? selectedQuery.columns.filter(col => rawColumnsSet.has(col))
                : rawColumns;

            return (
                <Card ref={tableContainerRef} className="overflow-hidden animate-in fade-in duration-500">
                    <CardHeader className="border-b border-slate-200 bg-slate-50 py-4 px-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500">
                                {t('results.title', { defaultValue: 'Résultats' })}
                            </CardTitle>
                            {/* Filtre marge — visible uniquement pour detail_marges_lots */}
                            {isMargesReport && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2">{t('reports.results.filter_margin', { defaultValue: 'Filtre marge :' })}</span>
                                    {(['all', 'negative', 'low'] as const).map(f => (
                                        <Button
                                            key={f}
                                            onClick={() => setMargeFilter(f)}
                                            variant={margeFilter === f ? 'default' : 'outline'}
                                            size="sm"
                                            className={`h-7 px-3 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                                                margeFilter === f
                                                    ? f === 'negative' ? 'bg-red-500 hover:bg-red-600' : f === 'low' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
                                                    : 'text-slate-500'
                                            }`}
                                        >
                                            {f === 'all' ? t('reports.results.filter_all', { defaultValue: 'Toutes' }) : f === 'negative' ? t('reports.results.filter_negative', { defaultValue: 'Négatives' }) : t('reports.results.filter_low', { defaultValue: '< 25%' })}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="mt-2 flex items-center justify-end">
                            <span className="text-[10px] text-slate-400 font-bold">
                                {t('reports.results.lines_count', { filtered: filteredResults.length, total: results.length, defaultValue: `${filteredResults.length} / ${results.length} lignes` })}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table className="border-0 rounded-none">
                            <TableHeader>
                                <TableRow>
                                    {columns.map((col) => (
                                        <TableHead
                                            key={col}
                                            className={isNumericColumn(col) ? 'text-right' : 'text-left'}
                                        >
                                            {formatColumnHeader(col, t)}
                                        </TableHead>
                                    ))}
                                    <TableHead className="w-10"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(isMargesReport ? filteredResults : filteredResults.slice(0, 100)).map((row: Record<string, unknown>) => (
                                    <TableRow
                                        key={String(row.id ?? row.produit_id ?? row.code ?? row['nom'] ?? row['produit_nom'])}
                                        className={
                                            isMargesReport && Number(row['taux_marge'] ?? 0) < 0 ? 'bg-red-50 hover:bg-red-100' :
                                            isMargesReport && Number(row['taux_marge'] ?? 0) < 25 ? 'bg-amber-50 hover:bg-amber-100' : ''
                                        }
                                    >
                                        {columns.map((col, subIdx) => (
                                            <TableCell
                                                key={col}
                                                className={`${subIdx === 0 ? 'font-bold' : ''} ${isNumericColumn(col) ? 'text-right' : 'text-left'} ${
                                                    col === 'taux_marge' && Number(row[col]) < 0 ? 'text-red-600 font-black' :
                                                    col === 'taux_marge' && Number(row[col]) < 25 ? 'text-amber-600 font-bold' :
                                                    col === 'marge' && Number(row[col]) < 0 ? 'text-red-600 font-black' :
                                                    col === 'statut' && row[col] === 'PERTE' ? 'text-red-600 font-black' :
                                                    col === 'statut' && row[col] === 'FAIBLE' ? 'text-amber-600 font-bold' :
                                                    col === 'statut' && row[col] === 'OK' ? 'text-emerald-600 font-bold' : ''
                                                }`}
                                            >
                                                {col === 'statut' ? (
                                                    <Badge className={
                                                        row[col] === 'PERTE' ? 'bg-red-100 text-red-700 hover:bg-red-100' :
                                                        row[col] === 'FAIBLE' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' :
                                                        row[col] === 'OK' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : ''
                                                    }>
                                                        {row[col] === 'PERTE' ? 'PERTE' : row[col] === 'FAIBLE' ? 'FAIBLE' : row[col] === 'OK' ? 'OK' : formatValue(col, row[col], t)}
                                                    </Badge>
                                                ) : (
                                                    formatValue(col, row[col], t)
                                                )}
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="size-7 p-0 opacity-0 group-hover:opacity-100 transition-all text-slate-400 hover:text-emerald-600">
                                                <Eye className="size-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            {/* Generic Summary Footer for all Table Reports */}
                            {filteredResults.length > 0 && (
                                <TableBody className="border-t-2 border-emerald-200 bg-emerald-50/60">
                                    <TableRow className="font-black text-emerald-700 uppercase hover:bg-emerald-50/60">
                                        {columns.map((col, idx) => {
                                            if (idx === 0) return <TableCell key={col} className="text-[10px] tracking-widest">{t('common:total', 'TOTAL / MOYENNE')}</TableCell>;

                                            if (isAverageColumn(col)) {
                                                const total = filteredResults.reduce((sum: number, r: Record<string, unknown>) => sum + (Number(r[col]) || 0), 0);
                                                const avg = filteredResults.length > 0 ? total / filteredResults.length : 0;
                                                return (
                                                    <TableCell key={col} className={`text-right text-sm ${isNumericColumn(col) ? 'text-right' : ''}`}>
                                                        <div className="flex flex-col items-end">
                                                            <span>{formatValue(col, avg, t)}</span>
                                                            <span className="text-[9px] opacity-50 uppercase tracking-wider">{t('reports.results.footer_avg_label', { defaultValue: 'moyenne' })}</span>
                                                        </div>
                                                    </TableCell>
                                                );
                                            }

                                            if (isSummableColumn(col)) {
                                                const total = filteredResults.reduce((sum: number, r: Record<string, unknown>) => sum + (Number(r[col]) || 0), 0);
                                                return <TableCell key={col} className="text-right text-sm">{formatValue(col, total, t)}</TableCell>;
                                            }

                                            if (isPercentageColumn(col)) {
                                                if (col === 'taux_marge') {
                                                    const totalMtVente = filteredResults.reduce((sum: number, r: Record<string, unknown>) => sum + (Number(r['mt_vente']) || 0), 0);
                                                    const totalMarge   = filteredResults.reduce((sum: number, r: Record<string, unknown>) => sum + (Number(r['marge']) || 0), 0);
                                                    const tauxGlobal   = totalMtVente > 0 ? (totalMarge / totalMtVente) * 100 : 0;
                                                    return (
                                                        <TableCell key={col} className="text-right text-sm">
                                                            <div className="flex flex-col items-end">
                                                                <span>{tauxGlobal.toFixed(1)} %</span>
                                                                <span className="text-[9px] opacity-50 uppercase tracking-wider">{t('reports.results.footer_global_label', { defaultValue: 'global' })}</span>
                                                            </div>
                                                        </TableCell>
                                                    );
                                                }
                                                const total = filteredResults.reduce((sum: number, r: Record<string, unknown>) => sum + (Number(r[col]) || 0), 0);
                                                const avg = filteredResults.length > 0 ? (total / filteredResults.length) : 0;
                                                return <TableCell key={col} className="text-right text-sm">{avg.toFixed(1)} %</TableCell>;
                                            }

                                            return <TableCell key={col}></TableCell>;
                                        })}
                                        <TableCell></TableCell>
                                    </TableRow>
                                </TableBody>
                            )}
                        </Table>
                    </CardContent>
                    {!isMargesReport && filteredResults.length > 100 && !pagination && (
                        <CardFooter className="p-4 bg-slate-50 border-t border-slate-200 justify-center">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                                {t('results.limited_display', 'Affichage limité aux 100 premiers résultats sur {{total}}', { total: Array.isArray(results) ? results.length : 0 })}
                            </span>
                        </CardFooter>
                    )}
                </Card>
            );
        }

        return (
            <Card className="bg-slate-100 border-slate-200">
                <CardContent className="overflow-auto max-h-[600px]">
                    <pre className="text-xs font-mono text-slate-600">
                        {JSON.stringify(results, null, 2)}
                    </pre>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {renderData()}
            </div>

            {pagination && (
                <Card className="mt-6">
                    <CardFooter className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center sm:text-left">
                            Total: <span className="text-slate-800">{pagination.count}</span> éléments
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button 
                                variant="outline" size="sm"
                                className="rounded-xl font-bold uppercase tracking-widest text-[10px] gap-2 flex-1 sm:flex-initial"
                                disabled={!pagination.previous || loading}
                                onClick={() => onPageChange(pagination.previous)}
                            >
                                <ChevronLeft className="size-4" />
                                {t('common:previous', 'Précédent')}
                            </Button>
                            <Button 
                                variant="outline" size="sm"
                                className="rounded-xl font-bold uppercase tracking-widest text-[10px] gap-2 flex-1 sm:flex-initial"
                                disabled={!pagination.next || loading}
                                onClick={() => onPageChange(pagination.next)}
                            >
                                {t('common:next', 'Suivant')}
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
};

