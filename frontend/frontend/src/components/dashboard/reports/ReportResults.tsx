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
import { ChevronLeft, ChevronRight, Inbox, Eye, Download, AlertTriangle } from 'lucide-react';

interface ReportResultsProps {
    selectedQuery: QueryDefinition;
    results: any;
    pagination: PaginationData | null;
    loading: boolean;
    onPageChange: (url: string | null) => void;
    onFilterChange?: (key: string, value: string) => void;
    currentParams?: Record<string, any>;
}

export const ReportResults: React.FC<ReportResultsProps> = ({
    selectedQuery,
    results,
    pagination,
    loading,
    onPageChange,
    onFilterChange,
    currentParams = {}
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
            <div className="flex-1 flex flex-col items-center justify-center text-base-content/20 animate-in fade-in duration-700">
                <Inbox className="w-24 h-24 mb-4 opacity-10" />
                <p className="text-xl font-black uppercase tracking-[0.2em]">{t('results.execute_prompt', 'En attente d\'exécution...')}</p>
            </div>
        );
    }

    const renderData = () => {
        // Special case: Monthly Report
        if (selectedQuery.id === 'rapport_mensuel' && typeof results === 'object' && !Array.isArray(results)) {
            return <MonthlyReportView data={results} />;
        }

        // Special case: Direct Download / Raw results
        if (selectedQuery.resultType === 'raw') {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-success animate-in zoom-in duration-500">
                    <Download className="w-16 h-16 mb-4" />
                    <p className="text-lg font-black uppercase tracking-widest">{t('results.export_success_short', { defaultValue: 'Rapport Généré' })}</p>
                    {results && typeof results === 'object' && (results as any).filename && (
                         <p className="text-xs opacity-60 mt-2">{(results as any).filename}</p>
                    )}
                </div>
            );
        }

        // Generic Cards Display
        if (selectedQuery.resultType === 'cards' && typeof results === 'object' && !Array.isArray(results)) {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {Object.entries(results).map(([key, value]) => {
                        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                            return (
                                <div key={key} className="bg-base-100 rounded-2xl p-6 border border-base-300 shadow-sm">
                                    <div className="text-[10px] font-bold uppercase text-base-content/40 mb-4 tracking-widest">{key.replace(/_/g, ' ')}</div>
                                    <div className="space-y-2">
                                        {Object.entries(value as object).map(([subKey, subValue]) => (
                                            <div key={subKey} className="flex justify-between items-center text-sm border-b border-base-200/50 pb-2 last:border-0 last:pb-0">
                                                <span className="text-base-content/60 font-bold uppercase text-[10px] tracking-tight">{subKey.replace(/_/g, ' ')}</span>
                                                <span className="font-black text-base-content">{formatValue(subKey, subValue, t)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div key={key} className="bg-base-100 rounded-2xl p-6 border border-base-300 shadow-sm flex flex-col justify-center">
                                <div className="text-[10px] font-bold uppercase text-base-content/40 tracking-widest mb-1">{key.replace(/_/g, ' ')}</div>
                                <div className="text-2xl font-black text-base-content">{formatValue(key, value, t)}</div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        // Table Display
        if (Array.isArray(results)) {
            if (results.length === 0) {
                return (
                    <div className="flex flex-col items-center justify-center py-20 text-base-content/30 italic">
                        <Inbox className="w-12 h-12 mb-2 opacity-20" />
                        <p>{t('results.empty', 'Aucun résultat trouvé pour cette période.')}</p>
                    </div>
                );
            }

            const isMargesReport = selectedQuery.id === 'detail_marges_lots';

            const filteredResults = results;

            const columns = Object.keys(results[0]).filter(k => !k.startsWith('_') && k !== 'id');

            return (
                <div ref={tableContainerRef} className="bg-base-100 rounded-3xl border border-base-300 shadow-sm overflow-hidden animate-in fade-in duration-500">
                    {/* Filtre marge — visible uniquement pour detail_marges_lots */}
                    {isMargesReport && (
                        <div className="flex items-center gap-2 px-6 py-3 border-b border-base-200 bg-base-50">
                            <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mr-2">Filtre marge :</span>
                            {(['all', 'negative', 'low'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setMargeFilter(f)}
                                    className={`btn btn-xs rounded-full font-bold uppercase tracking-wider transition-all ${
                                        margeFilter === f
                                            ? f === 'negative' ? 'btn-error' : f === 'low' ? 'btn-warning' : 'btn-primary'
                                            : 'btn-ghost border border-base-300'
                                    }`}
                                >
                                    {f === 'all' ? 'Toutes' : f === 'negative' ? '⚠ Négatives' : '< 25%'}
                                </button>
                            ))}
                            <span className="ml-auto text-[10px] text-base-content/40 font-bold">
                                {filteredResults.length} / {results.length} lignes
                            </span>
                        </div>
                    )}
                    <div className="overflow-x-auto">
                        <table className="w-full border-separate border-spacing-0">
                            <thead>
                                <tr className="bg-base-200/50">
                                    {columns.map((col, idx) => (
                                        <th 
                                            key={col} 
                                            className={`text-xs font-semibold uppercase tracking-wider text-base-content/60 py-4 px-4 ${idx === 0 ? 'pl-6 rounded-tl-2xl' : ''} ${isNumericColumn(col) ? 'text-right' : 'text-left'}`}
                                        >
                                            {formatColumnHeader(col, t)}
                                        </th>
                                    ))}
                                    <th className="w-10 rounded-tr-2xl"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-base-100">
                                {(isMargesReport ? filteredResults : filteredResults.slice(0, 100)).map((row: any, idx: number) => (
                                    <tr key={idx} className={`hover:bg-primary/5 transition-all group ${
                                        isMargesReport && Number(row['taux_marge'] ?? 0) < 0 ? 'bg-error/5' :
                                        isMargesReport && Number(row['taux_marge'] ?? 0) < 25 ? 'bg-warning/5' : ''
                                    }`}>
                                        {columns.map((col, subIdx) => (
                                            <td 
                                                key={col} 
                                                className={`py-4 px-4 text-sm font-medium text-base-content/80 ${subIdx === 0 ? 'pl-6 font-bold' : ''} ${isNumericColumn(col) ? 'text-right' : 'text-left'} ${
                                                    col === 'taux_marge' && Number(row[col]) < 0 ? 'text-error font-black' :
                                                    col === 'taux_marge' && Number(row[col]) < 25 ? 'text-warning font-bold' :
                                                    col === 'marge' && Number(row[col]) < 0 ? 'text-error font-black' :
                                                    col === 'statut' && row[col] === 'PERTE' ? 'text-error font-black' :
                                                    col === 'statut' && row[col] === 'FAIBLE' ? 'text-warning font-bold' :
                                                    col === 'statut' && row[col] === 'OK' ? 'text-success font-bold' : ''
                                                }`}
                                            >
                                                {col === 'statut' && row[col] === 'PERTE' ? '🔴 PERTE' :
                                                 col === 'statut' && row[col] === 'FAIBLE' ? '🟡 FAIBLE' :
                                                 col === 'statut' && row[col] === 'OK' ? '🟢 OK' :
                                                 formatValue(col, row[col], t)}
                                            </td>
                                        ))}
                                        <td className="pr-4">
                                            <button className="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-primary/10 hover:text-primary">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {/* Generic Summary Footer for all Table Reports */}
                            {filteredResults.length > 0 && (
                                <tfoot className="bg-primary/5 border-t-2 border-primary/20">
                                    <tr className="font-black text-primary uppercase">
                                        {columns.map((col, idx) => {
                                            if (idx === 0) return <td key={col} className="py-4 px-6 text-[10px] tracking-widest">{t('common:total', 'TOTAL / MOYENNE')}</td>;
                                            
                                            if (isAverageColumn(col)) {
                                                const total = filteredResults.reduce((sum: number, r: any) => sum + (Number(r[col]) || 0), 0);
                                                const avg = filteredResults.length > 0 ? total / filteredResults.length : 0;
                                                return (
                                                    <td key={col} className="py-4 px-4 text-right text-sm">
                                                        <div className="flex flex-col">
                                                            <span>{formatValue(col, avg, t)}</span>
                                                            <span className="text-[9px] opacity-40 uppercase tracking-wider">moyenne</span>
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            if (isSummableColumn(col)) {
                                                const total = filteredResults.reduce((sum: number, r: any) => sum + (Number(r[col]) || 0), 0);
                                                return <td key={col} className="py-4 px-4 text-right text-sm">{formatValue(col, total, t)}</td>;
                                            }
                                            
                                            if (isPercentageColumn(col)) {
                                                // Pour taux_marge : calculer le taux global à partir de mt_vente et marge agrégés
                                                if (col === 'taux_marge') {
                                                    const totalMtVente = filteredResults.reduce((sum: number, r: any) => sum + (Number(r['mt_vente']) || 0), 0);
                                                    const totalMarge   = filteredResults.reduce((sum: number, r: any) => sum + (Number(r['marge']) || 0), 0);
                                                    const tauxGlobal   = totalMtVente > 0 ? (totalMarge / totalMtVente) * 100 : 0;
                                                    return (
                                                        <td key={col} className="py-4 px-4 text-right text-sm">
                                                            <div className="flex flex-col">
                                                                <span>{tauxGlobal.toFixed(1)} %</span>
                                                                <span className="text-[9px] opacity-40 uppercase tracking-wider">global</span>
                                                            </div>
                                                        </td>
                                                    );
                                                }
                                                const total = filteredResults.reduce((sum: number, r: any) => sum + (Number(r[col]) || 0), 0);
                                                const avg = filteredResults.length > 0 ? (total / filteredResults.length) : 0;
                                                return <td key={col} className="py-4 px-4 text-right text-sm">{avg.toFixed(1)} %</td>;
                                            }
                                            
                                            return <td key={col} className="py-4 px-4"></td>;
                                        })}
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                    {!isMargesReport && filteredResults.length > 100 && !pagination && (
                        <div className="p-4 bg-base-50 text-center text-[10px] font-black uppercase text-base-content/30 tracking-[0.2em] border-t border-base-200">
                            {t('results.limited_display', 'Affichage limité aux 100 premiers résultats sur {{total}}', { total: results.length })}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className="bg-base-200 p-6 rounded-2xl border border-base-300 overflow-auto max-h-[600px] shadow-inner">
                <pre className="text-xs font-mono text-base-content/70">
                    {JSON.stringify(results, null, 2)}
                </pre>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {renderData()}
            </div>

            {pagination && (
                <div className="mt-6 p-4 bg-base-100 rounded-2xl border border-base-300 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/40 text-center sm:text-left">
                        Total: <span className="text-base-content">{pagination.count}</span> éléments
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button 
                            className="btn btn-sm btn-outline rounded-xl font-bold uppercase tracking-widest text-[10px] gap-2 flex-1 sm:flex-initial"
                            disabled={!pagination.previous || loading}
                            onClick={() => onPageChange(pagination.previous)}
                        >
                            <ChevronLeft className="w-4 h-4" />
                            {t('common:previous', 'Précédent')}
                        </button>
                        <button 
                            className="btn btn-sm btn-outline rounded-xl font-bold uppercase tracking-widest text-[10px] gap-2 flex-1 sm:flex-initial"
                            disabled={!pagination.next || loading}
                            onClick={() => onPageChange(pagination.next)}
                        >
                            {t('common:next', 'Suivant')}
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

