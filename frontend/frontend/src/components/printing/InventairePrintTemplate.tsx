
import React from 'react';
import type { PharmacySettings } from './InvoiceTemplate';

export interface InventaireItem {
    id: number | string;
    cip1?: string;
    name: string;
    lot_numero?: string;
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

const InventairePrintTemplate: React.FC<InventairePrintTemplateProps> = ({ settings, data }) => {
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
        return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
    };

    const sortedGroups = Object.keys(data.groups).sort();

    return (
        <div data-theme="light" className="bg-base-100 p-4 max-w-[210mm] mx-auto text-base-content font-sans text-[11px] leading-tight shadow-none print:shadow-none print:max-w-none print:w-full">
            
            {/* Header section (Same style as Invoice) */}
            <div className="flex justify-between items-start mb-6 border-b-2 border-slate-900 pb-4">
                <div className="flex-1">
                    <h1 className="text-2xl font-black uppercase tracking-tight text-base-content mb-1 leading-none">
                        {settings.pharmacy_name}
                    </h1>
                    <div className="space-y-1 text-base-content/60 max-w-sm text-[11px]">
                        <div className="whitespace-pre-line leading-tight italic">{settings.address}</div>
                        <div className="flex flex-col gap-0.5 mt-2 font-bold text-base-content/90">
                            {settings.phone && <div>Tél : {settings.phone}</div>}
                        </div>
                    </div>
                </div>

                <div className="text-right">
                    <div className="border-2 border-slate-900 text-base-content px-6 py-2 rounded-sm text-xl font-black mb-2 inline-block uppercase tracking-wider">
                        {data.title}
                    </div>
                    <div className="text-base-content/60 font-bold text-[10px] uppercase tracking-widest">
                        Imprimé le {formatDate(data.date)}
                    </div>
                </div>
            </div>

            {/* Sub-header info */}
            <div className="bg-base-100 p-4 rounded-xl border border-base-200 mb-6 flex justify-between items-center text-[10px]">
                <div className="space-y-1">
                    {data.filter_name && (
                        <div>
                            <span className="text-base-content/40 uppercase font-bold mr-2">{data.group_label} :</span>
                            <span className="font-bold text-base-content">{data.filter_name}</span>
                        </div>
                    )}
                    {data.stock_label && (
                        <div>
                            <span className="text-base-content/40 uppercase font-bold mr-2">Option :</span>
                            <span className="font-bold text-emerald-600">{data.stock_label}</span>
                        </div>
                    )}
                </div>
                {data.subtitle && <div className="font-medium italic">{data.subtitle}</div>}
            </div>

            {/* Main Content Area */}
            <div className="space-y-8">
                {sortedGroups.map(groupName => (
                    <div key={groupName} className="break-inside-avoid">
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-2 border-l-4 border-primary pl-3 bg-slate-50 py-1.5 flex justify-between items-center">
                            <span>{groupName}</span>
                            <span className="text-[10px] font-bold text-slate-400 normal-case pr-4">
                                {data.groups[groupName].filter(i => !i.is_lot_line).length} produits
                            </span>
                        </h2>

                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-100/50 text-slate-900 border-b-2 border-slate-900 text-[9px] uppercase tracking-wider font-bold">
                                    <th className="py-2 px-2 text-left w-12">ID</th>
                                    <th className="py-2 px-2 text-left w-24">CIP</th>
                                    <th className="py-2 px-2 text-left">Désignation</th>
                                    <th className="py-2 px-2 text-center w-20">Lot</th>
                                    {data.is_report ? (
                                        <>
                                            <th className="py-2 px-2 text-right w-16">Théo.</th>
                                            <th className="py-2 px-2 text-right w-16">Phys.</th>
                                            <th className="py-2 px-2 text-right w-16">Écart</th>
                                            <th className="py-2 px-2 text-right w-20">Val. Écart</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="py-2 px-2 text-right w-16">Stock</th>
                                            <th className="py-2 px-2 text-right w-16">P.V.</th>
                                            <th className="py-2 px-2 text-center w-28">Qté Physique</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="text-[10px]">
                                {data.groups[groupName].map((item, idx) => (
                                    <tr key={`${groupName}-${idx}`} className={`border-b border-slate-100 ${item.is_lot_line ? 'bg-slate-50/30' : ''}`}>
                                        <td className="py-1.5 px-2 font-mono text-slate-400">{item.id}</td>
                                        <td className="py-1.5 px-2 font-mono">{item.cip1 || '-'}</td>
                                        <td className="py-1.5 px-2">
                                            <div className={`${item.is_lot_line ? 'pl-4 text-slate-500 italic' : 'font-bold text-slate-900'} leading-tight`}>
                                                {item.is_lot_line && '↳ '}{item.name}
                                            </div>
                                        </td>
                                        <td className="py-1.5 px-2 text-center font-bold text-slate-600 cursor-default" title="Numéro de lot">
                                            {item.lot_numero || '-'}
                                        </td>
                                        {data.is_report ? (
                                            <>
                                                <td className="py-1.5 px-2 text-right font-medium text-slate-500">{item.stock_theorique}</td>
                                                <td className="py-1.5 px-2 text-right font-medium text-slate-900">{item.quantite_physique}</td>
                                                <td className={`py-1.5 px-2 text-right font-black ${item.ecart && item.ecart < 0 ? 'text-red-600' : item.ecart && item.ecart > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                                                    {item.ecart && item.ecart > 0 ? `+${item.ecart}` : item.ecart}
                                                </td>
                                                <td className={`py-1.5 px-2 text-right font-black ${item.valeur_ecart && item.valeur_ecart < 0 ? 'text-red-700' : item.valeur_ecart && item.valeur_ecart > 0 ? 'text-emerald-700' : 'text-slate-300'}`}>
                                                    {formatNumber(item.valeur_ecart)}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="py-1.5 px-2 text-right font-bold text-slate-900 pr-4">{item.stock}</td>
                                                <td className="py-1.5 px-2 text-right text-slate-500 pr-4">{formatNumber(item.selling_price)}</td>
                                                <td className="py-1.5 px-2 border-l border-slate-200 bg-slate-50/20"></td>
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
                        <span className="text-[8px] uppercase font-black tracking-widest opacity-40 mb-1">Total Global des Écarts</span>
                        <div className="text-xl font-black font-mono">
                            {data.total_global_ecart > 0 ? '+' : ''}{formatNumber(data.total_global_ecart)} <span className="text-xs opacity-60">FCFA</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Legend / Info */}
            <div className="mt-8 pt-4 border-t border-slate-200 grid grid-cols-2 gap-8 text-[9px]">
                <div className="italic text-slate-400">
                    {data.is_report 
                        ? "Ce rapport détaille les écarts constatés entre le stock théorique et le comptage physique."
                        : "Veuillez remplir la colonne 'Qté Physique' lors de votre comptage. Les lots non listés doivent être signalés au verso."}
                </div>
                <div className="text-right font-bold text-slate-500 uppercase tracking-widest">
                    {settings.pharmacy_name} — Logiciel ZENITH
                </div>
            </div>
        </div>
    );
};

export default InventairePrintTemplate;
