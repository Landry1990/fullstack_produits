import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
    formatColumnHeader, 
    formatValue,
    isNumericColumn
} from '../../../hooks/useCentreRapports';
import type { QueryDefinition, PaginationData } from '../../../hooks/useCentreRapports';
import { MonthlyReportView } from './MonthlyReportView';
import { ChevronLeft, ChevronRight, Inbox, Eye, Download } from 'lucide-react';

interface ReportResultsProps {
    selectedQuery: QueryDefinition;
    results: any;
    pagination: PaginationData | null;
    loading: boolean;
    onPageChange: (url: string | null) => void;
}

export const ReportResults: React.FC<ReportResultsProps> = ({
    selectedQuery,
    results,
    pagination,
    loading,
    onPageChange
}) => {
    const { t } = useTranslation(['reports', 'common']);

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

            const columns = Object.keys(results[0]).filter(k => !k.startsWith('_') && k !== 'id');

            return (
                <div className="bg-base-100 rounded-3xl border border-base-300 shadow-sm overflow-hidden animate-in fade-in duration-500">
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
                                {results.slice(0, 100).map((row, idx) => (
                                    <tr key={idx} className="hover:bg-primary/5 transition-all group">
                                        {columns.map((col, subIdx) => (
                                            <td 
                                                key={col} 
                                                className={`py-4 px-4 text-sm font-medium text-base-content/80 ${subIdx === 0 ? 'pl-6 font-bold' : ''} ${isNumericColumn(col) ? 'text-right' : 'text-left'}`}
                                            >
                                                {formatValue(col, row[col], t)}
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
                        </table>
                    </div>
                    {results.length > 100 && !pagination && (
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
                <div className="mt-6 p-4 bg-base-100 rounded-2xl border border-base-300 shadow-sm flex items-center justify-between">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/40">
                        Total: <span className="text-base-content">{pagination.count}</span> éléments
                    </div>
                    <div className="flex gap-2">
                        <button 
                            className="btn btn-sm btn-outline rounded-xl font-bold uppercase tracking-widest text-[10px] gap-2"
                            disabled={!pagination.previous || loading}
                            onClick={() => onPageChange(pagination.previous)}
                        >
                            <ChevronLeft className="w-4 h-4" />
                            {t('common:previous', 'Précédent')}
                        </button>
                        <button 
                            className="btn btn-sm btn-outline rounded-xl font-bold uppercase tracking-widest text-[10px] gap-2"
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

