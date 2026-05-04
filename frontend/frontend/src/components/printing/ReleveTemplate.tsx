import React from 'react';
import type { Creance, Client, PharmacySettings } from '../../types';
import { formatNumber } from '../../utils/formatters';
import { formatDate } from '../../utils/dateUtils';

interface ReleveTemplateProps {
    client: Client | null;
    creances: Creance[];
    settings: PharmacySettings;
    dateDebut?: string;
    dateFin?: string;
    totals: { total: number; paye: number; reste: number };
}

export const ReleveTemplate: React.FC<ReleveTemplateProps> = ({
    client,
    creances,
    settings,
    dateDebut,
    dateFin,
    totals
}) => {
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    };

    const formatM = (val: number | string) => formatNumber(Math.round(Number(val) || 0));

    return (
        <div data-theme="light" className="p-8 bg-white text-black font-sans text-xs max-w-[210mm] mx-auto">
            
            {/* EN-TÊTE PHARMACIE */}
            <div className="flex justify-between items-start mb-8 border-b-[3px] border-slate-900 pb-4">
                <div className="flex-1">
                    <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-1 leading-none">
                        {settings.pharmacy_name || 'PHARMACIE'}
                    </h1>
                    <div className="text-slate-600 space-y-0.5 text-[11px] leading-tight max-w-sm">
                        <p className="italic whitespace-pre-line">{settings.address}</p>
                        {settings.phone && <p className="font-bold">Tél: {settings.phone}</p>}
                        <div className="text-[10px] font-bold uppercase mt-2">
                            {settings.niu && <span className="mr-3">NIU: <span className="text-slate-500">{settings.niu}</span></span>}
                            {settings.registre_commerce && <span>RC: <span className="text-slate-500">{settings.registre_commerce}</span></span>}
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xl font-black mb-1 inline-block uppercase tracking-widest text-slate-900">
                        RELEVÉ DE FACTURES
                    </div>
                    <div className="text-slate-600 font-bold text-[10px] uppercase tracking-widest text-right">
                        Réf: REL-{client?.id ? `${client.id}-` : ''}{new Date().getFullYear()}{String(new Date().getMonth() + 1).padStart(2, '0')}{String(new Date().getDate()).padStart(2, '0')}
                    </div>
                    <div className="text-slate-400 font-bold text-[9px] uppercase tracking-widest text-right mt-1">
                        Édité le {formatDate(new Date().toISOString())}
                    </div>
                </div>
            </div>

            {/* INFORMATIONS CLIENT & PÉRIODE */}
            <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-[9px] uppercase tracking-widest font-black text-slate-400 mb-2 border-b border-slate-200 pb-1.5">
                        Client
                    </div>
                    <div className="flex flex-col gap-0.5 text-sm">
                        <p className="font-black text-slate-900 uppercase text-lg leading-tight mb-1">{client?.name || 'Client Inconnu'}</p>
                        {client?.address && <p className="text-slate-600 text-xs">{client.address}</p>}
                        {client?.phone && <p className="text-slate-600 text-xs font-medium mt-1">Tél: {client.phone}</p>}
                    </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-center">
                    <div className="text-[9px] uppercase tracking-widest font-black text-slate-400 mb-2 border-b border-slate-200 pb-1.5">
                        Période couverte
                    </div>
                    <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Du :</span>
                            <span className="font-bold text-sm bg-white px-2 py-0.5 rounded border border-slate-200">{dateDebut ? formatDate(dateDebut) : '...'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500">Au :</span>
                            <span className="font-bold text-sm bg-white px-2 py-0.5 rounded border border-slate-200">{dateFin ? formatDate(dateFin) : "Aujourd'hui"}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* TABLEAU DES CRÉANCES */}
            <div className="mb-8">
                <table className="w-full border-collapse">
                    <thead className="table-header-group">
                        <tr className="bg-slate-100 text-slate-900 border-y-2 border-slate-900 text-[10px] uppercase tracking-wider">
                            <th className="py-2.5 px-3 text-left font-black">Date</th>
                            <th className="py-2.5 px-2 text-left font-black">N° Facture</th>
                            <th className="py-2.5 px-2 text-left font-black">Bénéficiaire (Ayant droit)</th>
                            <th className="py-2.5 px-3 text-right font-black">Total TTC</th>
                            <th className="py-2.5 px-3 text-right font-black">Déjà Réglé</th>
                            <th className="py-2.5 px-3 text-right font-black bg-slate-200/50">Reste à Payer</th>
                        </tr>
                    </thead>
                    <tbody className="text-[11px] align-middle">
                        {creances.length > 0 ? creances.map((c, idx) => (
                            <tr key={idx} className="border-b border-slate-200 break-inside-avoid hover:bg-slate-50">
                                <td className="py-2 px-3 font-medium text-slate-600">{formatDate(c.date)}</td>
                                <td className="py-2 px-2 font-mono font-bold text-slate-900">{c.numero_facture || '-'}</td>
                                <td className="py-2 px-2 text-slate-700 uppercase">{(c as any).ayant_droit_details?.nom || c.ayant_droit || '-'}</td>
                                <td className="py-2 px-3 text-right font-medium text-slate-700">{formatM(c.total_ttc)}</td>
                                <td className="py-2 px-3 text-right text-emerald-600 font-medium">{formatM(c.montant_paye)}</td>
                                <td className="py-2 px-3 text-right font-black text-rose-600 bg-rose-50/30">{formatM(c.reste_a_payer)}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-slate-400 italic font-medium">
                                    Aucune facture impayée trouvée pour cette période.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* TOTAUX */}
            <div className="flex justify-end border-t-[3px] border-slate-900 pt-6 mb-12 page-break-inside-avoid">
                <div className="w-80">
                    <div className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-3 ml-2">
                        Récapitulatif Global
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5 shadow-sm">
                        <div className="grid grid-cols-[1fr,120px] items-center text-slate-600">
                            <span className="text-[10px] uppercase font-bold tracking-wider">Total Facturé</span>
                            <div className="text-right font-mono font-bold text-sm pr-1">
                                {formatM(totals.total)}
                            </div>
                        </div>
                        <div className="grid grid-cols-[1fr,120px] items-center text-emerald-600">
                            <span className="text-[10px] uppercase font-bold tracking-wider">Total Réglé</span>
                            <div className="text-right font-mono font-bold text-sm pr-1">
                                {formatM(totals.paye)}
                            </div>
                        </div>
                        <div className="border-t border-slate-300 my-2"></div>
                        <div className="grid grid-cols-[1fr,120px] items-center text-rose-600 bg-rose-50 rounded-lg p-2 -mx-2 ring-1 ring-rose-100">
                            <span className="text-[11px] uppercase font-black tracking-wider pl-1">NET À PAYER</span>
                            <div className="text-right font-mono font-black text-lg">
                                {formatM(totals.reste)} <span className="text-[9px] font-bold opacity-70 ml-0.5">FCFA</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SIGNATURES */}
            <div className="grid grid-cols-2 gap-20 pt-8 page-break-inside-avoid border-t border-slate-200 text-center">
                <div>
                    <div className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-16">Signature Client</div>
                    <div className="text-slate-300">________________________</div>
                </div>
                <div>
                    <div className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-16">La Direction</div>
                    <div className="text-slate-300">________________________</div>
                </div>
            </div>

        </div>
    );
};
