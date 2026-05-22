import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Commande, PharmacySettings } from '../../types';
import { formatNumber } from '../../utils/formatters';
import { formatDate as formatLocaleDate, formatDateTime } from '../../utils/dateUtils';

interface ReceptionCommandeTemplateProps {
    commande: Commande;
    settings: PharmacySettings;
    fournisseurName: string;
}

export const ReceptionCommandeTemplate: React.FC<ReceptionCommandeTemplateProps> = ({ commande, settings, fournisseurName }) => {
    const { t } = useTranslation(['orders', 'common']);

    const formatDate = (dateStr: string) => {
        return formatDateTime(dateStr);
    };

    const formatM = (val: number | string) => {
        const n = typeof val === 'string' ? parseFloat(val) : val;
        return formatNumber(Math.round(n || 0));
    };

    const now = formatDateTime(new Date());

    const produits = commande.produits || [];
    
    // Calculate totals
    const totalHT = produits.reduce((sum, p) => sum + (parseFloat(p.price) * p.quantity), 0);
    const totalTVA = produits.reduce((sum, p) => {
        const price = parseFloat(p.price);
        const qty = p.quantity;
        const tvaPercent = parseFloat(String(p.tva || 0));
        return sum + (price * qty * tvaPercent / 100);
    }, 0);
    const totalTTC = totalHT + totalTVA;
    const totalUG = produits.reduce((sum, p) => sum + (p.unites_gratuites || 0), 0);

    return (
        <div data-theme="light" className="p-4 bg-base-100 text-base-content font-sans text-[11.5px] leading-tight max-w-[210mm] mx-auto shadow-none print:shadow-none print:p-0">
            
            {/* EN-TETE PHARMACIE */}
            <div className="flex justify-between items-start mb-4 border-b-2 border-slate-900 pb-3">
                <div className="flex-1">
                    <h1 className="text-xl font-black uppercase tracking-tight text-base-content mb-0.5">
                        {settings.pharmacy_name || 'PHARMACIE'}
                    </h1>
                    <div className="text-base-content/60 space-y-0.5 text-[10.5px]">
                        <p className="italic">{settings.address}</p>
                        <p>Tél: {settings.phone} {settings.email ? `| ${settings.email}` : ''}</p>
                        <div className="text-[9px] font-bold uppercase opacity-60">
                            {settings.niu && <span className="mr-3">NIU: {settings.niu}</span>}
                            {settings.registre_commerce && <span>RC: {settings.registre_commerce}</span>}
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="border-2 border-slate-900 text-base-content px-3 py-1.5 rounded text-base font-bold mb-1 inline-block uppercase">
                        {t('orders.tabs.delivery', { defaultValue: 'BON DE RÉCEPTION' })}
                    </div>
                    <div className="text-base-content/60 font-bold text-[9px] uppercase tracking-widest">
                        Réf: {commande.numero_facture || `#${commande.id}`}
                    </div>
                </div>
            </div>

            {/* INFORMATIONS COMMANDE */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-base-100 p-3 rounded-lg border border-base-200">
                    <div className="text-[9px] uppercase tracking-widest font-black text-base-content/40 mb-1.5 border-b border-slate-100 pb-1">
                        {t('orders.form.provider_label', { defaultValue: 'Fournisseur' })}
                    </div>
                    <div className="font-black text-base text-base-content">{fournisseurName.toUpperCase()}</div>
                </div>
                <div className="bg-base-100 p-3 rounded-lg border border-base-200">
                    <div className="text-[9px] uppercase tracking-widest font-black text-base-content/40 mb-1.5 border-b border-slate-100 pb-1">
                        {t('orders.product_table.info_row.indicators', { defaultValue: 'Détails de Réception' })}
                    </div>
                    <div className="space-y-0.5 text-[11px]">
                        <div className="flex justify-between">
                            <span className="text-base-content/60">{t('orders.details.date', { defaultValue: 'Date Commande' })}:</span>
                            <span className="font-bold">{formatDate(commande.date)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-base-content/60">{t('common:print_date', { defaultValue: 'Imprimé le' })}:</span>
                            <span className="font-bold">{now}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-100 pt-1 mt-1">
                            <span className="text-base-content/60">{t('orders.details.created_by', { defaultValue: 'Saisie par' })}:</span>
                            <span className="font-bold">{(commande as any).created_by_name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-base-content/60">{t('orders.details.closed_by', { defaultValue: 'Clôturée par' })}:</span>
                            <span className="font-bold">{(commande as any).closed_by_name || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* TABLEAU DES PRODUITS */}
            <div className="mb-4">
                <table className="w-full border-collapse text-[10.5px]">
                    <thead className="table-header-group">
                        <tr className="bg-base-200/50 text-base-content border-b-2 border-slate-900 text-[8.5px] uppercase tracking-wider">
                            <th className="py-1 px-3 text-left font-black">{t('orders.product_table.headers.product')}</th>
                            <th className="py-1 px-2 text-center font-black">{t('orders.product_table.headers.cip')}</th>
                            <th className="py-1 px-2 text-center font-black">{t('orders.product_table.headers.stAnt')}</th>
                            <th className="py-1 px-2 text-center font-black">{t('orders.product_table.headers.qty')}</th>
                            <th className="py-1 px-2 text-center font-black bg-base-200/50">{t('orders.product_table.headers.ug')}</th>
                            <th className="py-1 px-2 text-center font-black">{t('orders.product_table.headers.stock')}</th>
                            <th className="py-1 px-2 text-right font-black">{t('orders.product_table.headers.buy_price_ht')}</th>
                            <th className="py-1 px-3 text-right font-black">{t('orders.product_table.headers.total_ht')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {produits.map((p, idx) => {
                            const produitName = p.produit_nom || (typeof p.produit === 'object' ? (p.produit as any).name : `Produit #${p.produit}`);
                            const cip = (p as any).produit_cip || (typeof p.produit === 'object' ? (p.produit as any).cip1 : '-');
                            const lineTotal = parseFloat(p.price) * p.quantity;
                            const tvaLabel = p.tva ? <span className="text-[7.5px] text-base-content/40 ml-1">({p.tva}%)</span> : null;
                            
                            // Audit de stock
                            const qtyTotal = (p.quantity || 0) + (p.unites_gratuites || 0);
                            const currentStock = (p as any).produit_stock ?? 0;
                            const stAnt = currentStock - qtyTotal;

                            return (
                                <tr key={idx} className="border-b border-slate-100 break-inside-avoid">
                                    <td className="py-1 px-3">
                                        <div className="font-bold text-base-content uppercase text-[10px] leading-tight">{produitName}</div>
                                        {p.lot && <div className="text-[7.5px] text-base-content/60 font-mono">LOT: {p.lot} | EXP: {p.date_expiration ? formatLocaleDate(p.date_expiration) : '-'}</div>}
                                    </td>
                                    <td className="py-1 px-2 text-center font-mono text-[8.5px] text-base-content/60">{cip}</td>
                                    <td className="py-1 px-2 text-center font-black">{stAnt}</td>
                                    <td className="py-1 px-2 text-center font-black">{p.quantity}</td>
                                    <td className="py-1 px-2 text-center font-bold text-base-content/40 bg-base-200/20">{p.unites_gratuites || 0}</td>
                                    <td className="py-1 px-2 text-center font-black">{currentStock}</td>
                                    <td className="py-1 px-2 text-right text-base-content/80">{formatM(p.price)}{tvaLabel}</td>
                                    <td className="py-1 px-3 text-right font-black text-base-content">{formatM(lineTotal)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* TOTAUX ET SIGNATURES */}
            <div className="flex justify-between items-start gap-8 border-t-2 border-slate-900 pt-4">
                <div className="flex-1 space-y-3">
                    <div className="bg-base-100 p-3 rounded-lg border border-base-200">
                        <div className="text-[9px] uppercase font-black text-base-content/40 mb-1.5 tracking-widest">
                            {t('orders.details.financial_summary', { defaultValue: 'Récapitulatif Articles' })}
                        </div>
                        <div className="flex gap-6 text-[10.5px] font-bold">
                            <div>{t('orders.list.table.items', { defaultValue: 'Lignes' })}: <span className="text-base-content">{produits.length}</span></div>
                            <div>{t('orders.product_table.headers.qty', { defaultValue: 'Unités' })}: <span className="text-base-content">{produits.reduce((s, p) => s + p.quantity, 0)}</span></div>
                            <div className="text-base-content/40">{t('orders.product_table.headers.ug', { defaultValue: 'Gratuites' })}: <span>{totalUG}</span></div>
                        </div>
                        <div className="text-[8.5px] italic text-base-content/40 mt-2 leading-tight">
                            Ce document certifie la réception physique des articles mentionnés dans les stocks de l'établissement.
                        </div>
                    </div>
                </div>

                <div className="w-64 space-y-3">
                    <div className="border-2 border-slate-900 text-base-content rounded-lg p-3">
                        <div className="space-y-0.5 mb-1.5 border-b border-slate-100 pb-1.5">
                           <div className="flex justify-between text-[9px] text-base-content/60">
                               <span>{t('orders.product_table.total_ht', { defaultValue: 'TOTAL HT' })}:</span>
                               <span className="font-bold text-base-content">{formatM(totalHT)} F</span>
                           </div>
                           <div className="flex justify-between text-[9px] text-base-content/60">
                               <span>{t('orders.product_table.total_tva', { defaultValue: 'TOTAL TVA' })}:</span>
                               <span className="font-bold text-base-content">{formatM(totalTVA)} F</span>
                           </div>
                        </div>
                        <div className="text-[9px] uppercase font-black tracking-widest text-base-content/40 mb-0.5">
                            {t('orders.product_table.total_ttc', { defaultValue: 'Total TTC Réception' })}
                        </div>
                        <div className="text-xl font-black font-mono tracking-tighter flex justify-between items-baseline">
                            {formatM(totalTTC)}
                            <span className="text-[10px] font-light opacity-60 ml-2 uppercase">FCFA</span>
                        </div>
                    </div>

                    <div className="pt-2 flex flex-col items-center">
                        <div className="text-[8px] uppercase font-black tracking-widest text-base-content/40 mb-4 text-center">Cachet & Signature</div>
                        <div className="w-full h-14 border border-base-200 rounded-lg flex items-center justify-center text-[8px] text-base-content/30 uppercase italic">
                            Responsable Stocks
                        </div>
                    </div>
                </div>
            </div>

            {/* PIED DE PAGE */}
            <div className="mt-6 pt-3 border-t border-base-200 text-center text-[9px] font-bold text-base-content/30 uppercase tracking-[0.2em]">
                Logiciel de Gestion Antigravity POS - Document Interne
            </div>

        </div>
    );
};

