import React from 'react';
import { formatNumber, formatCurrency } from '../../utils/formatters';
import { useTranslation } from 'react-i18next';
import { useDocumentLocale } from '../../context/PharmacySettingsContext';
import type { PharmacySettings } from './InvoiceTemplate';

interface AvoirLigne {
    produit_nom: string;
    produit_cip: string;
    quantity: number;
    price: string;
    total: string;
    lot: string;
    date_expiration: string;
    motif: string;
    est_cloture: boolean;
}

export interface AvoirData {
    id: number;
    numero: string;
    date: string;
    fournisseur_name: string;
    type_avoir: string;
    type_avoir_display: string;
    status: string;
    observations: string;
    created_by_name: string;
    validated_by_name: string;
    stock_decharge: boolean;
    stock_decharge_by_name: string;
    total_ht: string;
    lignes: AvoirLigne[];
}

interface AvoirPrintTemplateProps {
    settings: PharmacySettings;
    data: AvoirData;
}

const formatDateDoc = (dateStr: string, locale: string) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return dateStr; }
};

const formatExpiryDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
    } catch { return dateStr; }
};

const AvoirPrintTemplate: React.FC<AvoirPrintTemplateProps> = ({ settings, data }) => {
    const { lang: docLang, locale: docLocale } = useDocumentLocale();
    const { t } = useTranslation('printing', { lng: docLang });

    const totalQty = data.lignes.reduce((s, l) => s + Number(l.quantity), 0);
    const totalHT = Number(data.total_ht);

    return (
        <div
            data-theme="light"
            className="bg-white p-6 max-w-[210mm] mx-auto font-sans text-label leading-tight text-gray-900 shadow-none print:shadow-none print:max-w-none print:w-full"
        >
            {/* ── HEADER ── */}
            <div className="flex justify-between items-start mb-6 border-b-2 border-gray-900 pb-4">

                {/* Gauche : Pharmacie */}
                <div className="flex-1">
                    <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900 mb-1 leading-none">
                        {settings.pharmacy_name}
                    </h1>
                    <div className="space-y-0.5 text-gray-500 text-caption">
                        {settings.address && (
                            <div className="whitespace-pre-line leading-tight italic">{settings.address}</div>
                        )}
                        <div className="flex flex-col gap-0.5 mt-1.5 font-bold text-gray-700">
                            {settings.phone && <span>{t('invoice.tel')} : {settings.phone}</span>}
                            <span className="uppercase">
                                {settings.niu && `${t('invoice.niu')} : ${settings.niu}`}
                                {settings.niu && settings.registre_commerce && ' | '}
                                {settings.registre_commerce && `${t('invoice.rc')} : ${settings.registre_commerce}`}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Droite : Titre avoir */}
                <div className="text-right">
                    <div className="border-2 border-gray-900 text-gray-900 px-6 py-2 rounded-sm text-xl font-black mb-2 inline-block uppercase tracking-wider">
                        {t('avoir.title')}
                    </div>
                    <div className="text-gray-400 font-bold text-caption uppercase tracking-widest">
                        {t('invoice.ref')} : {data.numero}
                    </div>
                </div>
            </div>

            {/* ── METADATA BOXES ── */}
            <div className="grid grid-cols-2 gap-6 mb-6">

                {/* Fournisseur */}
                <div className="bg-white p-4 rounded-xl border border-gray-100">
                    <div className="text-micro uppercase tracking-widest font-black text-gray-400 mb-2 border-b border-gray-100 pb-1.5">
                        {t('avoir.supplier')}
                    </div>
                    <p className="font-bold text-gray-900 uppercase text-sm">{data.fournisseur_name}</p>
                </div>

                {/* Détails avoir */}
                <div className="bg-white p-4 rounded-xl border border-gray-100">
                    <div className="text-micro uppercase tracking-widest font-black text-gray-400 mb-2 border-b border-gray-100 pb-1.5">
                        {t('avoir.details')}
                    </div>
                    <div className="space-y-1 text-label">
                        <div className="flex justify-between">
                            <span className="text-gray-500">{t('invoice.date')} :</span>
                            <span className="font-bold">{formatDateDoc(data.date, docLocale)}</span>
                        </div>
                        <div className="flex justify-between border-t border-gray-100 pt-1 mt-1">
                            <span className="text-gray-500">{t('avoir.general_reason')} :</span>
                            <span className="font-bold uppercase">{data.type_avoir_display}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">{t('avoir.status')} :</span>
                            <span className={`font-bold uppercase ${data.status === 'VALIDEE' ? 'text-emerald-600' : 'text-amber-500'}`}>
                                {data.status === 'VALIDEE' ? t('avoir.status_validated') : t('avoir.status_draft')}
                            </span>
                        </div>
                        {data.stock_decharge && (
                            <div className="flex justify-between">
                                <span className="text-gray-500">{t('avoir.stock_unloaded_by')} :</span>
                                <span className="font-bold uppercase text-indigo-600">{data.stock_decharge_by_name || '—'}</span>
                            </div>
                        )}
                        {data.created_by_name && (
                            <div className="flex justify-between">
                                <span className="text-gray-500">{t('avoir.created_by')} :</span>
                                <span className="font-bold uppercase">{data.created_by_name}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── TABLE PRODUITS ── */}
            <div className="flex-grow">
                <table className="w-full mb-4 border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-gray-700 border-b-2 border-gray-900 text-micro uppercase tracking-[0.1em]">
                            <th className="py-2.5 px-3 text-left font-black rounded-l">{t('invoice.designation')}</th>
                            <th className="py-2.5 px-2 text-center font-black w-14">{t('avoir.lot_exp')}</th>
                            <th className="py-2.5 px-2 text-left font-black w-32">{t('avoir.line_reason')}</th>
                            <th className="py-2.5 px-2 text-center font-black w-10">{t('invoice.qty')}</th>
                            <th className="py-2.5 px-2 text-right font-black w-24">{t('avoir.unit_price_fcfa')}</th>
                            <th className="py-2.5 px-3 text-right font-black w-28 rounded-r">{t('avoir.total_fcfa')}</th>
                        </tr>
                    </thead>
                    <tbody className="text-caption">
                        {data.lignes.map((ligne, _idx) => (
                            <tr key={ligne.produit_nom ?? `ligne-${ligne.produit_cip}-${ligne.lot}`} className="border-b border-gray-50 break-inside-avoid">
                                <td className="py-2 px-3">
                                    <div className="font-bold text-gray-900 text-[10.5px] uppercase leading-tight">{ligne.produit_nom}</div>
                                    {ligne.produit_cip && (
                                        <div className="text-[8.5px] text-gray-400 font-mono mt-0.5">{t('invoice.cip')} : {ligne.produit_cip}</div>
                                    )}
                                </td>
                                <td className="py-2 px-2 text-center align-middle">
                                    {ligne.lot && <div className="font-mono text-micro font-bold">{ligne.lot}</div>}
                                    {ligne.date_expiration && (
                                        <div className="text-[8px] text-gray-400">{t('invoice.exp')} : {formatExpiryDate(ligne.date_expiration)}</div>
                                    )}
                                    {!ligne.lot && !ligne.date_expiration && <span className="text-gray-300">—</span>}
                                </td>
                                <td className="py-2 px-2 align-middle">
                                    {ligne.motif
                                        ? <span className="text-micro italic text-gray-600">{ligne.motif}</span>
                                        : <span className="text-gray-300">—</span>
                                    }
                                </td>
                                <td className="py-2 px-2 text-center align-middle font-bold text-gray-900">{ligne.quantity}</td>
                                <td className="py-2 px-2 text-right align-middle text-gray-600 font-medium">{formatNumber(Number(ligne.price), 0, docLocale)}</td>
                                <td className="py-2 px-3 text-right align-middle font-black text-gray-900 text-[10.5px]">{formatNumber(Number(ligne.total), 0, docLocale)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Résumé lignes */}
                <div className="px-3 py-2 bg-gray-50 rounded-lg flex justify-between items-center text-micro uppercase font-bold text-gray-400 tracking-widest mb-4">
                    <div className="flex gap-6">
                        <span>{t('invoice.lines')} : <span className="text-gray-700">{data.lignes.length}</span></span>
                        <span>{t('avoir.units')} : <span className="text-gray-700">{totalQty}</span></span>
                    </div>
                    <div className="text-gray-300 italic">{t('avoir.official_doc')}</div>
                </div>
            </div>

            {/* ── TOTAUX + FOOTER ── */}
            <div className="mt-4 border-t-2 border-gray-900 pt-4 flex gap-8 items-start">

                {/* Observations */}
                <div className="flex-1">
                    {data.observations && (
                        <div>
                            <div className="text-micro uppercase tracking-widest font-black text-gray-400 mb-1">{t('avoir.observations')}</div>
                            <p className="text-caption text-gray-600 italic leading-relaxed">{data.observations}</p>
                        </div>
                    )}
                    <div className="mt-6">
                        <div className="text-micro uppercase tracking-widest font-black text-gray-400 mb-1">{t('avoir.supplier_signature')}</div>
                        <div className="border-b border-gray-300 h-10 w-40"></div>
                    </div>
                </div>

                {/* Total */}
                <div className="min-w-[180px]">
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 text-caption">
                        <span className="text-gray-500 uppercase font-bold tracking-wider">{t('invoice.total_ht')}</span>
                        <span className="font-black text-gray-900">{formatCurrency(totalHT, docLocale)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 mt-1 bg-gray-900 text-white px-3 rounded-lg">
                        <span className="text-caption font-black uppercase tracking-wider">{t('avoir.credit_amount')}</span>
                        <span className="font-black text-base">{formatCurrency(totalHT, docLocale)}</span>
                    </div>
                </div>
            </div>

            {/* Pied de page */}
            <div className="mt-6 pt-3 border-t border-gray-100 flex justify-between text-[8px] text-gray-400">
                <span>{data.stock_decharge ? t('avoir.stock_unloaded') : t('avoir.stock_not_unloaded')}</span>
                <span>{t('avoir.printed_on')} {new Date().toLocaleString(docLocale)}</span>
            </div>
        </div>
    );
};

export default AvoirPrintTemplate;
