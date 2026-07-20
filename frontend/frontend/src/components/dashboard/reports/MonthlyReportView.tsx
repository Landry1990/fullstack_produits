import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
    TrendingUp, 
    ArrowUpRight, 
    ArrowDownRight, 
    Users, 
    Package, 
    Gift, 
    CreditCard, 
    BarChart3,
    DollarSign,
    Calculator
} from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { Badge } from '../../shadcn/badge';

interface MonthlyReportViewProps {
    data: unknown;
}

const formatMoney = (v: number) => formatCurrency(Math.round(v || 0));

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({ data }) => {
    const { t } = useTranslation(['reports', 'common']);
    
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-indigo-600 text-[10px] font-bold uppercase tracking-widest mb-1">
                        <TrendingUp className="size-3" />
                        <span>{t('monthly_report.ca_ttc', 'CA TTC')}</span>
                    </div>
                    <div className="text-xl font-black text-indigo-600">{formatMoney(data.ca?.ca_ttc)}</div>
                </div>
                
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-bold uppercase tracking-widest mb-1">
                        <DollarSign className="size-3" />
                        <span>{t('monthly_report.ca_ht', 'CA HT')}</span>
                    </div>
                    <div className="text-xl font-black text-emerald-600">{formatMoney(data.ca?.ca_ht)}</div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-blue-600 text-[10px] font-bold uppercase tracking-widest mb-1">
                        <Calculator className="size-3" />
                        <span>{t('monthly_report.margin', 'Marge')} ({data.marge?.marge_pct || 0}%)</span>
                    </div>
                    <div className="text-xl font-black text-blue-600">{formatMoney(data.marge?.marge_brute)}</div>
                </div>

                <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                        <Package className="size-3" />
                        <span>{t('monthly_report.nb_sales', 'Nb Ventes')}</span>
                    </div>
                    <div className="text-xl font-black text-slate-800">{data.ca?.nb_ventes || 0}</div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-amber-600 text-[10px] font-bold uppercase tracking-widest mb-1">
                        <CreditCard className="size-3" />
                        <span>{t('monthly_report.receivables', 'Créances')}</span>
                    </div>
                    <div className="text-xl font-black text-amber-600">{formatMoney(data.creances?.total)}</div>
                    <div className="text-[10px] font-bold text-amber-600/60 mt-0.5">{t('monthly_report.invoices', { count: data.creances?.nb_factures || 0 })}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Encaissements */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            <DollarSign className="size-4 text-indigo-600" />
                            {t('monthly_report.payments', 'Encaissements')}
                        </h3>
                    </div>
                    <div className="p-4 space-y-3">
                        {(data.encaissements || []).map((enc: unknown, _idx: number) => (
                            <div key={enc.id ?? enc.mode_label ?? enc.mode} className="flex justify-between items-center p-2 rounded-xl border border-slate-200">
                                <span className="text-xs font-bold text-slate-500 uppercase">{enc.mode_label || enc.mode}</span>
                                <span className="text-sm font-black text-slate-800">{formatMoney(enc.montant)}</span>
                            </div>
                        ))}
                        {(!data.encaissements || data.encaissements.length === 0) && (
                            <div className="text-center py-4 text-xs font-bold text-slate-300 uppercase">
                                {t('monthly_report.no_payments', 'Aucun encaissement')}
                            </div>
                        )}
                    </div>
                </div>

                {/* TVA */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            <BarChart3 className="size-4 text-slate-600" />
                            {t('monthly_report.tva_split', 'Répartition TVA')}
                        </h3>
                    </div>
                    <div className="p-4 space-y-3">
                        {(data.ca_par_tva || []).map((tva: unknown, _idx: number) => (
                            <div key={`tva-${tva.taux}`} className="flex justify-between items-center p-2 rounded-xl border border-slate-200">
                                <span className="text-xs font-bold text-slate-500 uppercase">TVA {tva.taux}%</span>
                                <span className="text-sm font-black text-slate-800">{formatMoney(tva.montant_tva)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Mouvements Caisse */}
                {data.mouvements_caisse && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp className="size-4 text-purple-600" />
                                {t('monthly_report.cash_movements', 'Mouvements Caisse')}
                            </h3>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="flex justify-between items-center p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                                <div className="flex items-center gap-2">
                                    <ArrowUpRight className="size-4 text-emerald-600" />
                                    <span className="text-xs font-bold text-emerald-600 uppercase">{t('monthly_report.entries', 'Entrées')}</span>
                                </div>
                                <span className="text-sm font-black text-emerald-600">{formatMoney(data.mouvements_caisse.total_entrees)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-red-50 border border-red-100">
                                <div className="flex items-center gap-2">
                                    <ArrowDownRight className="size-4 text-red-600" />
                                    <span className="text-xs font-bold text-red-600 uppercase">{t('monthly_report.exits', 'Sorties')}</span>
                                </div>
                                <span className="text-sm font-black text-red-600">{formatMoney(data.mouvements_caisse.total_sorties)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-slate-100 border border-slate-200">
                                <span className="text-xs font-bold text-slate-500 uppercase">{t('monthly_report.final_balance', 'Solde Final')}</span>
                                <span className="text-sm font-black text-slate-800">{formatMoney(data.mouvements_caisse.solde)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Top Fournisseurs */}
                {data.achats_par_fournisseur && data.achats_par_fournisseur.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <Package className="size-4 text-indigo-600" />
                                {t('monthly_report.top_suppliers', 'Top Fournisseurs')}
                            </h3>
                        </div>
                        <div className="p-4 space-y-2">
                            {data.achats_par_fournisseur.slice(0, 5).map((f: unknown, _idx: number) => (
                                <div key={f.fournisseur_id ?? f.fournisseur_nom} className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-slate-500 truncate max-w-[150px] uppercase">{f.fournisseur_nom}</span>
                                    <span className="font-black text-slate-800">{formatMoney(f.montant_total)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Clients Pro */}
                {data.clients_professionnels && data.clients_professionnels.ca_total > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <Users className="size-4 text-blue-600" />
                                {t('monthly_report.pro_clients', 'Clients Professionnels')}
                            </h3>
                        </div>
                        <div className="p-4 space-y-2">
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-slate-400 uppercase">{t('monthly_report.total_ca', 'CA Total')}</span>
                                <span className="text-slate-800">{formatMoney(data.clients_professionnels.ca_total)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-emerald-600 uppercase">{t('monthly_report.paid', 'Payé')}</span>
                                <span className="text-emerald-600">{formatMoney(data.clients_professionnels.montant_paye)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-amber-600 uppercase">{t('monthly_report.remains', 'Reste')}</span>
                                <span className="text-amber-600">{formatMoney(data.clients_professionnels.reste_a_payer)}</span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase text-slate-300">{t('monthly_report.collection', 'Recouvrement')}</span>
                                <Badge variant="secondary" className="font-black">{data.clients_professionnels.taux_recouvrement_pct}%</Badge>
                            </div>
                        </div>
                    </div>
                )}

                {/* Unités Gratuites */}
                {data.unites_gratuites && data.unites_gratuites.valeur_totale > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <Gift className="size-4 text-purple-600" />
                                {t('monthly_report.free_units', 'Unités Gratuites')}
                            </h3>
                        </div>
                        <div className="p-4 space-y-2">
                            <div className="flex justify-between text-xs font-bold text-slate-500">
                                <span className="uppercase">{t('monthly_report.monetary_value', 'Valeur Monétaire')}</span>
                                <span className="text-slate-800">{formatMoney(data.unites_gratuites.valeur_totale)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold text-slate-500">
                                <span className="uppercase">{t('monthly_report.given_quantity', 'Quantité Donnée')}</span>
                                <span className="text-slate-800">{data.unites_gratuites.quantite_totale}</span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                                <span className="text-[10px] font-black uppercase text-slate-300">{t('monthly_report.ca_impact', 'Impact sur CA')}</span>
                                <Badge className="font-black">{data.unites_gratuites.pct_du_ca}%</Badge>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
