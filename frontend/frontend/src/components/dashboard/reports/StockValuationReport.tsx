import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../../utils/formatters';
import { FileDown, Printer } from 'lucide-react';
import { usePharmacySettings } from '../../../context/PharmacySettingsContext';
import { generateStockValuationPdf } from '../../../utils/print/stockValuationPdf';

interface StockValuationData {
    is_pmp: boolean;
    type_valorisation: string;
    total_ht: number | string;
    total_tva: number | string;
    total_ttc: number | string;
    tva_breakdown: {
        rate: number;
        ht: number | string;
        tva: number | string;
        ttc: number | string;
    }[];
    group_by?: string;
    group_breakdown?: {
        name: string;
        ht: number | string;
        tva: number | string;
        ttc: number | string;
    }[];
    date: string;
}

interface Props {
    data: unknown;
}

const fmt = (v: number | string | undefined | null) => {
    if (v === null || v === undefined) return '0';
    return formatCurrency(Number(v), 'fr-FR', 'F');
};

const StockValuationReport: React.FC<Props> = ({ data }) => {
    const { t } = useTranslation(['reports', 'common']);
    const d = data as StockValuationData;
    const [downloading, setDownloading] = useState(false);
    const { settings } = usePharmacySettings();

    if (!d || !d.tva_breakdown) {
        return <div className="p-8 text-center text-slate-400">Données indisponibles</div>;
    }

    const typeLabel = d.is_pmp ? "Coût d'Achat (PMP)" : 'Prix de Vente (TTC)';

    const handleDownloadPDF = () => {
        setDownloading(true);
        try {
            generateStockValuationPdf(d, settings);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-8 animate-in fade-in duration-500 print-valuation">
            {/* Header */}
            <div className="border-b border-slate-200 pb-4 flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">
                        Récapitulatif Valeur Stock
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Méthode : {typeLabel}
                    </p>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                    <button
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors"
                    >
                        <Printer className="size-4" />
                        Imprimer
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={downloading}
                        className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-slate-800 text-white hover:bg-slate-700 text-xs font-bold transition-colors disabled:opacity-50"
                    >
                        <FileDown className="size-4" />
                        {downloading ? 'Génération...' : 'Télécharger PDF'}
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="border border-slate-200 rounded-xl p-5">
                    <p className="text-xs text-slate-500 mb-1">Valeur Totale HT</p>
                    <p className="text-xl font-bold text-slate-800">{fmt(d.total_ht)}</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-5">
                    <p className="text-xs text-slate-500 mb-1">Montant Total TVA</p>
                    <p className="text-xl font-bold text-slate-800">{fmt(d.total_tva)}</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-5">
                    <p className="text-xs text-slate-500 mb-1">
                        Valeur Totale {d.is_pmp ? 'PMP' : 'TTC'}
                    </p>
                    <p className="text-xl font-bold text-slate-800">{fmt(d.total_ttc)}</p>
                </div>
            </div>

            {/* TVA Breakdown Table */}
            <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3">
                    Répartition par taux de TVA
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="text-left py-2 px-3 text-xs text-slate-500">Taux TVA</th>
                                <th className="text-right py-2 px-3 text-xs text-slate-500">Base HT</th>
                                <th className="text-right py-2 px-3 text-xs text-slate-500">Montant TVA</th>
                                <th className="text-right py-2 px-3 text-xs text-slate-500">Total Reconstitué</th>
                            </tr>
                        </thead>
                        <tbody>
                            {d.tva_breakdown.map((item) => (
                                <tr key={item.rate} className="border-b border-slate-100">
                                    <td className="py-2 px-3 text-slate-700">{item.rate}%</td>
                                    <td className="py-2 px-3 text-right text-slate-700">{fmt(item.ht)}</td>
                                    <td className="py-2 px-3 text-right text-slate-700">{fmt(item.tva)}</td>
                                    <td className="py-2 px-3 text-right font-bold text-slate-800">{fmt(item.ttc)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Group Breakdown Table (if present) */}
            {d.group_breakdown && d.group_breakdown.length > 0 && (
                <div>
                    <h3 className="text-sm font-bold text-slate-700 mb-3">
                        Répartition par {d.group_by}
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="text-left py-2 px-3 text-xs text-slate-500">Catégorie</th>
                                    <th className="text-right py-2 px-3 text-xs text-slate-500">Base HT</th>
                                    <th className="text-right py-2 px-3 text-xs text-slate-500">Montant TVA</th>
                                    <th className="text-right py-2 px-3 text-xs text-slate-500">Total TTC</th>
                                </tr>
                            </thead>
                            <tbody>
                                {d.group_breakdown.map((item) => (
                                    <tr key={item.name} className="border-b border-slate-100">
                                        <td className="py-2 px-3 text-slate-700">{item.name}</td>
                                        <td className="py-2 px-3 text-right text-slate-700">{fmt(item.ht)}</td>
                                        <td className="py-2 px-3 text-right text-slate-700">{fmt(item.tva)}</td>
                                        <td className="py-2 px-3 text-right font-bold text-slate-800">{fmt(item.ttc)}</td>
                                    </tr>
                                ))}
                                <tr className="border-t-2 border-slate-200">
                                    <td className="py-2 px-3 font-bold text-slate-800">Total</td>
                                    <td className="py-2 px-3 text-right font-bold text-slate-800">{fmt(d.total_ht)}</td>
                                    <td className="py-2 px-3 text-right font-bold text-slate-800">{fmt(d.total_tva)}</td>
                                    <td className="py-2 px-3 text-right font-bold text-slate-800">{fmt(d.total_ttc)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Note */}
            <div className="text-xs text-slate-400 italic pt-4 border-t border-slate-100">
                Note : Cette valorisation est {d.is_pmp
                    ? 'fondée sur le PMP stocké en base.'
                    : 'fondée sur les prix de vente publics actuels.'}
            </div>
        </div>
    );
};

export { StockValuationReport };
