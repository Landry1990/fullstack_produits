
import React from 'react';
import { useTranslation } from 'react-i18next';
import { type PharmacySettings } from './InvoiceTemplate';
import { formatCurrency, formatNumber } from '../../utils/formatters';

export interface StockValuationData {
    is_pmp: boolean;
    type_valorisation: string;
    total_ht: number;
    total_tva: number;
    total_ttc: number;
    tva_breakdown: {
        rate: number;
        ht: number;
        tva: number;
        ttc: number;
    }[];
    group_by?: 'rayon' | 'forme' | 'groupe' | string;
    group_breakdown?: {
        name: string;
        ht: number;
        tva: number;
        ttc: number;
    }[];
    date: string;
}

interface StockValuationTemplateProps {
    settings: PharmacySettings;
    data: StockValuationData;
}

const StockValuationTemplate: React.FC<StockValuationTemplateProps> = ({ settings, data }) => {
    const { t } = useTranslation(['reports', 'common']);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const docTitle = data.is_pmp ? t('stock_valuation.doc_title_pmp') : t('stock_valuation.doc_title_vente');
    const typeLabel = data.is_pmp ? t('stock_valuation.valuation_pmp') : t('stock_valuation.valuation_vente');

    // Get the localized label for the grouping category
    const getGroupLabel = () => {
        if (!data.group_by) return '';
        return t(`stock_valuation.group_by_${data.group_by}`);
    };

    return (
        <div data-theme="light" className="bg-base-100 p-8 max-w-[210mm] mx-auto text-base-content font-sans text-[11px] leading-tight shadow-none print:shadow-none print:max-w-none print:w-full relative">
            
            {/* Header Section */}
            <div className="flex justify-between items-start mb-10 border-b-2 border-slate-900 pb-6">
                <div className="flex-1">
                    <h1 className="text-3xl font-black uppercase tracking-tight text-base-content mb-2 leading-none">
                        {settings.pharmacy_name}
                    </h1>
                    <div className="space-y-1 text-base-content/60 max-w-sm text-[12px]">
                        <div className="whitespace-pre-line leading-tight italic">{settings.address}</div>
                        <div className="flex flex-col gap-1 mt-3 font-bold text-base-content/90">
                            {settings.phone && <div className="flex items-center gap-2"><span>Tél : {settings.phone}</span></div>}
                            <div className="flex items-center gap-2 uppercase text-[10px]">
                                {settings.niu && <span>NIU : {settings.niu}</span>}
                                {settings.registre_commerce && <span>| RC : {settings.registre_commerce}</span>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-right">
                    <div className="border-4 border-slate-900 text-base-content px-8 py-3 rounded-sm text-2xl font-black mb-3 inline-block uppercase tracking-widest">
                        {t('stock_valuation.recap_title')}
                    </div>
                    <div className="text-base-content/40 font-black text-[11px] uppercase tracking-widest">
                        {docTitle}
                    </div>
                    <div className="text-base-content/60 font-bold text-[10px] mt-2 uppercase">
                         {formatDate(data.date)}
                    </div>
                </div>
            </div>

            {/* Main Stats Banner */}
            <div className="grid grid-cols-1 gap-8 mb-12">
                <div className="bg-slate-50 border-2 border-slate-100 rounded-3xl p-8 flex justify-between items-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full -ml-12 -mb-12"></div>
                    
                    <div className="relative z-10">
                        <div className="text-[10px] uppercase font-black text-slate-400 tracking-[0.3em] mb-4">{t('stock_valuation.valuation_method')}</div>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-2xl font-black text-slate-900 uppercase tracking-tight">{typeLabel}</div>
                            </div>
                        </div>
                    </div>

                    <div className="text-right relative z-10">
                        <div className="text-[10px] uppercase font-black text-primary tracking-[0.3em] mb-2">{t('stock_valuation.total_general')}</div>
                        <div className="text-5xl font-black text-slate-900 tracking-tighter tabular-nums leading-none">
                            {formatCurrency(data.total_ttc)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Totals Section */}
            <div className="grid grid-cols-2 gap-10 mb-8">
                <div className="space-y-6">
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-900 pb-2 flex justify-between items-center">
                        <span>{t('monthly_report.total_ca')}</span>
                        <span className="text-[10px] text-slate-300 font-bold">{t('total_general')}</span>
                    </h2>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-4 py-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                            <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{t('stock_valuation.ht_total')}</span>
                            <span className="text-lg font-black text-slate-900">{formatCurrency(data.total_ht)}</span>
                        </div>
                        <div className="flex justify-between items-center px-4 py-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                            <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{t('stock_valuation.tva_total')}</span>
                            <span className="text-lg font-black text-slate-900">{formatCurrency(data.total_tva)}</span>
                        </div>
                        <div className="flex justify-between items-center px-4 py-5 bg-primary text-white rounded-2xl shadow-md ring-4 ring-primary/10">
                            <span className="text-[11px] font-black uppercase tracking-widest">{t('stock_valuation.recap_title')} {data.is_pmp ? 'PMP' : 'TTC'}</span>
                            <span className="text-xl font-black tabular-nums">{formatCurrency(data.total_ttc)}</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-900 pb-2 flex justify-between items-center">
                        <span>{t('stock_valuation.tva_breakdown_title')}</span>
                    </h2>
                    
                    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                        <table className="w-full text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-[9px] uppercase font-black text-slate-400 border-b border-slate-100">
                                    <th className="py-4 px-2">{t('stock_valuation.tva_table_rate')}</th>
                                    <th className="py-4 px-2">{t('stock_valuation.tva_table_base')}</th>
                                    <th className="py-4 px-2">{t('stock_valuation.tva_table_tva')}</th>
                                    <th className="py-4 px-2">{t('stock_valuation.tva_table_total')}</th>
                                </tr>
                            </thead>
                            <tbody className="text-[11px]">
                                {data.tva_breakdown.map((item, idx) => (
                                    <tr key={idx} className="border-b border-slate-50 last:border-0">
                                        <td className="py-4 px-2 font-black text-primary bg-primary/5">{item.rate}%</td>
                                        <td className="py-4 px-2 font-medium text-slate-600">{formatNumber(item.ht, 0)}</td>
                                        <td className="py-4 px-2 font-medium text-slate-600">{formatNumber(item.tva, 0)}</td>
                                        <td className="py-4 px-2 font-black text-slate-900">{formatNumber(item.ttc, 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Optional Group Breakdown Section */}
            {data.group_breakdown && data.group_breakdown.length > 0 && (
                <div className="mt-4 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-900 pb-2 mb-6 flex justify-between items-center">
                        <span>{t('stock_valuation.tva_breakdown_title')} — {getGroupLabel()}</span>
                        <span className="text-[10px] text-slate-300 font-bold">{data.group_breakdown.length} {t('common.categories', 'Catégories')}</span>
                    </h2>
                    
                    <div className="bg-white border-2 border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-900 text-white text-[9px] uppercase font-black tracking-widest">
                                    <th className="py-4 px-6 text-left">{t('stock_valuation.category_header')} ({getGroupLabel()})</th>
                                    <th className="py-4 px-4 text-right">{t('stock_valuation.tva_table_base')}</th>
                                    <th className="py-4 px-4 text-right">{t('stock_valuation.tva_table_tva')}</th>
                                    <th className="py-4 px-6 text-right">{t('stock_valuation.tva_table_total')}</th>
                                </tr>
                            </thead>
                            <tbody className="text-[11px]">
                                {data.group_breakdown.map((item, idx) => (
                                    <tr key={idx} className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/20' : ''}`}>
                                        <td className="py-4 px-6 text-left font-black text-slate-900">
                                            {item.name}
                                        </td>
                                        <td className="py-4 px-4 text-right font-medium text-slate-500 tabular-nums">{formatNumber(item.ht, 0)}</td>
                                        <td className="py-4 px-4 text-right font-medium text-slate-500 tabular-nums">{formatNumber(item.tva, 0)}</td>
                                        <td className="py-4 px-6 text-right font-black text-slate-900 tabular-nums bg-primary/5 group-hover:bg-primary/10">
                                            {formatNumber(item.ttc, 0)}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-slate-100/50 font-black">
                                    <td className="py-4 px-6 text-left uppercase text-[9px] tracking-widest text-slate-400">Total Reconstitué</td>
                                    <td className="py-4 px-4 text-right tabular-nums">{formatNumber(data.total_ht, 0)}</td>
                                    <td className="py-4 px-4 text-right tabular-nums">{formatNumber(data.total_tva, 0)}</td>
                                    <td className="py-4 px-6 text-right tabular-nums text-lg text-primary">{formatNumber(data.total_ttc, 0)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Note and Certification */}
            <div className="mt-8 border-t-2 border-slate-100 pt-8">
                <div className="flex gap-12 items-start text-slate-400">
                    <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{t('stock_valuation.note_title')}</span>
                        </div>
                        <p className="text-[11px] leading-relaxed italic pr-12">
                            {data.is_pmp 
                                ? t('stock_valuation.note_body_pmp', { date: formatDate(data.date) })
                                : t('stock_valuation.note_body_vente', { date: formatDate(data.date) })
                            }
                            <br />
                            {t('stock_valuation.certification')}
                        </p>
                    </div>
                    
                    <div className="w-64 text-center">
                        <div className="text-[9px] uppercase font-black tracking-[0.2em] mb-4">{t('stock_valuation.stamp_placeholder')}</div>
                        <div className="h-28 border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center italic text-[9px] text-slate-300">
                            ---
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-10 pt-4 border-t border-slate-50 text-center text-[9px] text-slate-300 uppercase font-black tracking-[0.3em]">
                {settings.pharmacy_name} — {t('stock_valuation.footer_label')} — ZENITH
            </div>
        </div>
    );
};

export default StockValuationTemplate;
