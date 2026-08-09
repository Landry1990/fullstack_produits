
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PharmacySettings } from './InvoiceTemplate';
import { formatNumber as formatNumberStandard } from '../../utils/formatters';

export interface InventaireItem {
    id: number | string;
    cip1?: string;
    name: string;
    lot_numero?: string;
    lot_expiration?: string | null;
    stock: number;
    selling_price?: number;
    is_lot_line?: boolean;
    // For discrepancy reports
    stock_theorique?: number;
    quantite_physique?: number;
    ecart?: number;
    valeur_ecart?: number;
    pmp?: number;
    rayon?: string;
}

export interface InventairePrintData {
    title: string;
    subtitle?: string;
    filter_name?: string;
    group_label?: string;
    stock_label?: string;
    date: string;
    groups: Record<string, InventaireItem[]>;
    is_report?: boolean; // If true, show discrepancy columns
    total_global_ecart?: number;
}

interface InventairePrintTemplateProps {
    settings: PharmacySettings;
    data: InventairePrintData;
}

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

const formatNumber = (num: number | undefined) => {
    if (num === undefined) return '-';
    return formatNumberStandard(num);
};

const formatExpiration = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

const InventairePrintTemplate: React.FC<InventairePrintTemplateProps> = ({ settings, data }) => {
    const { t } = useTranslation(['stock', 'common']);
    const sortedGroups = Object.keys(data.groups).sort();

    return (
        <div className="bg-white p-4 max-w-[210mm] mx-auto text-slate-900 font-sans text-[11px] leading-tight shadow-none print:shadow-none print:max-w-none print:w-full relative">
            <style>
                {`
                @media print {
                    @page {
                        size: A4;
                        margin: 15mm 10mm 20mm 10mm;
                    }
                    .page-footer {
                        position: fixed;
                        bottom: 0;
                        right: 0;
                        width: 100%;
                        text-align: right;
                        font-size: 9px;
                        color: #94a3b8;
                        border-top: 1px solid #e2e8f0;
                        padding-top: 5px;
                    }
                    .page-number:after {
                        content: attr(data-page-label) counter(page);
                    }
                    /* Répéter l'en-tête de tableau sur chaque page */
                    thead {
                        display: table-header-group;
                    }
                    tfoot {
                        display: table-footer-group;
                    }
                    /* Éviter coupure dans une ligne */
                    tr {
                        page-break-inside: avoid;
                    }
                    /* Saut de page entre groupes si le groupe est trop grand */
                    .group-block {
                        page-break-inside: auto;
                    }
                    /* Garder le titre de groupe avec ses premières lignes */
                    .group-title {
                        page-break-after: avoid;
                    }
                }
                `}
            </style>

            <div className="page-footer hidden print:block">
                <span className="page-number" data-page-label={t('common:page')}></span>
            </div>
            
            {/* Header section (Same style as Invoice) */}
            <div className="flex justify-between items-start mb-6 border-b-2 border-slate-900 pb-4">
                <div className="flex-1">
                    <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-1 leading-none">
                        {settings.pharmacy_name}
                    </h1>
                    <div className="space-y-1 text-slate-900/60 max-w-sm text-[11px]">
                        <div className="whitespace-pre-line leading-tight italic">{settings.address}</div>
                        <div className="flex flex-col gap-0.5 mt-2 font-bold text-slate-900/90">
                            {settings.phone && <div>{t('common:phone_short')}{settings.phone}</div>}
                        </div>
                    </div>
                </div>

                <div className="text-right">
                    <div className="border-2 border-slate-900 text-slate-900 px-6 py-2 rounded-sm text-xl font-black mb-2 inline-block uppercase tracking-wider">
                        {data.title}
                    </div>
                    <div className="text-slate-900/60 font-bold text-[10px] uppercase tracking-widest">
                        {t('common:printed_on')}{formatDate(data.date)}
                    </div>
                </div>
            </div>

            {/* Sub-header info */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6 flex justify-between items-center text-[10px]">
                <div className="space-y-1">
                    {data.filter_name && (
                        <div>
                            <span className="text-slate-900/40 uppercase font-bold mr-2">{data.group_label}:</span>
                            <span className="font-bold text-slate-900">{data.filter_name}</span>
                        </div>
                    )}
                    {data.stock_label && (
                        <div>
                            <span className="text-slate-900/40 uppercase font-bold mr-2">{t('common:option')}</span>
                            <span className="font-bold text-emerald-600">{data.stock_label}</span>
                        </div>
                    )}
                </div>
                {data.subtitle && <div className="font-medium italic">{data.subtitle}</div>}
            </div>

            {/* Main Content Area */}
            <div className="space-y-8">
                {sortedGroups.map((groupName, groupIdx) => (
                    <div key={groupName} className="group-block" style={{ pageBreakBefore: groupIdx > 0 ? 'auto' : 'avoid' }}>
                        <h2 className="group-title text-sm font-black text-slate-900 uppercase tracking-wider mb-2 border-l-4 border-emerald-500 pl-3 bg-slate-100 py-1.5 flex justify-between items-center">
                            <span>{groupName}</span>
                            <span className="text-[10px] font-bold text-slate-900/50 normal-case pr-4">
                                {data.groups[groupName].filter(i => !i.is_lot_line).length} {t('common:products')}
                            </span>
                        </h2>

                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-100/50 text-slate-900 border-b-2 border-slate-900 text-[9px] uppercase tracking-wider font-bold">
                                    <th className="py-2 px-2 text-left w-12">{t('common:id')}</th>
                                    <th className="py-2 px-2 text-left w-24">{t('common:cip')}</th>
                                    <th className="py-2 px-2 text-left">{t('common:designation')}</th>
                                    <th className="py-2 px-2 text-center w-20">{t('common:lot')}</th>
                                    <th className="py-2 px-2 text-center w-20">{t('stock:inventaire.detail.col_expiration')}</th>
                                    {data.is_report ? (
                                        <>
                                            <th className="py-2 px-2 text-right w-16">{t('stock:inventaire.detail.col_theo')}</th>
                                            <th className="py-2 px-2 text-right w-16">{t('stock:inventaire.detail.col_phys')}</th>
                                            <th className="py-2 px-2 text-right w-16">{t('stock:inventaire.detail.col_gap')}</th>
                                            <th className="py-2 px-2 text-right w-20">{t('stock:inventaire.detail.total_gap_value')}</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="py-2 px-2 text-right w-16">{t('common:stock')}</th>
                                            <th className="py-2 px-2 text-right w-16">{t('common:selling_price_short')}</th>
                                            <th className="py-2 px-2 text-center w-28">{t('stock:inventaire.detail.col_phys_qty')}</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="text-[10px]">
                                {data.groups[groupName].map((item) => (
                                    <tr key={item.id} className={`border-b border-slate-100 ${item.is_lot_line ? 'bg-slate-100/30' : ''}`}>
                                        <td className="py-1.5 px-2 font-mono text-slate-900/50">{item.id}</td>
                                        <td className="py-1.5 px-2 font-mono">{item.cip1 || '-'}</td>
                                        <td className="py-1.5 px-2">
                                            <div className={`${item.is_lot_line ? 'pl-4 text-slate-900/60 italic' : 'font-bold text-slate-900'} leading-tight`}>
                                                {item.is_lot_line && '↳ '}{item.name}
                                            </div>
                                        </td>
                                        <td className="py-1.5 px-2 text-center font-bold text-slate-900/70 cursor-default" title={t('common:lot_number')}>
                                            {item.lot_numero || '-'}
                                        </td>
                                        <td className="py-1.5 px-2 text-center font-medium text-slate-900/70">
                                            {formatExpiration(item.lot_expiration)}
                                        </td>
                                        {data.is_report ? (
                                            <>
                                                <td className="py-1.5 px-2 text-right font-medium text-slate-900/60">{item.stock_theorique}</td>
                                                <td className="py-1.5 px-2 text-right font-medium text-slate-900">{item.quantite_physique}</td>
                                                <td className={`py-1.5 px-2 text-right font-black ${item.ecart && item.ecart < 0 ? 'text-red-600' : item.ecart && item.ecart > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                                                    {item.ecart && item.ecart > 0 ? `+${item.ecart}` : item.ecart}
                                                </td>
                                                <td className={`py-1.5 px-2 text-right font-black ${item.valeur_ecart && item.valeur_ecart < 0 ? 'text-red-600' : item.valeur_ecart && item.valeur_ecart > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                                                    {formatNumber(item.valeur_ecart)}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="py-1.5 px-2 text-right font-bold text-slate-900 pr-4">{item.stock}</td>
                                                <td className="py-1.5 px-2 text-right text-slate-900/60 pr-4">{formatNumber(item.selling_price)}</td>
                                                <td className="py-1.5 px-2 border-l border-slate-300 bg-slate-100/20 text-center font-bold text-sm">
                                                    {item.quantite_physique !== undefined ? item.quantite_physique : ''}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>

            {/* Summary Footer */}
            {data.is_report && data.total_global_ecart !== undefined && (
                <div className="mt-8 flex justify-end">
                    <div className="bg-slate-900 text-white rounded-lg px-6 py-3 flex flex-col items-end shadow-lg min-w-[200px]">
                        <span className="text-[8px] uppercase font-black tracking-widest opacity-40 mb-1">{t('stock:inventaire.print.total_global_gap')}</span>
                        <div className="text-xl font-black font-mono">
                            {data.total_global_ecart > 0 ? '+' : ''}{formatNumber(data.total_global_ecart)} <span className="text-xs opacity-60">{t('common:currency_symbol')}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Legend / Info */}
            <div className="mt-8 pt-4 border-t border-slate-300 grid grid-cols-2 gap-8 text-[9px]">
                <div className="italic text-slate-900/50">
                    {data.is_report 
                        ? t('stock:inventaire.print.report_legend')
                        : t('stock:inventaire.print.fill_legend')}
                </div>
                <div className="text-right font-bold text-slate-900/60 uppercase tracking-widest">
                    {settings.pharmacy_name} · {t('common:software_name')}
                </div>
            </div>
        </div>
    );
};

export default InventairePrintTemplate;
