import React from 'react';
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

interface MonthlyReportViewProps {
    data: any;
}

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({ data }) => {
    const formatMoney = (v: number) => Math.round(v || 0).toLocaleString('fr-FR') + ' F';
    
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-primary text-[10px] font-bold uppercase tracking-widest mb-1">
                        <TrendingUp className="w-3 h-3" />
                        <span>CA TTC</span>
                    </div>
                    <div className="text-xl font-black text-primary">{formatMoney(data.ca?.ca_ttc)}</div>
                </div>
                
                <div className="bg-success/5 border border-success/10 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-success text-[10px] font-bold uppercase tracking-widest mb-1">
                        <DollarSign className="w-3 h-3" />
                        <span>CA HT</span>
                    </div>
                    <div className="text-xl font-black text-success">{formatMoney(data.ca?.ca_ht)}</div>
                </div>

                <div className="bg-info/5 border border-info/10 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-info text-[10px] font-bold uppercase tracking-widest mb-1">
                        <Calculator className="w-3 h-3" />
                        <span>Marge ({data.marge?.marge_pct || 0}%)</span>
                    </div>
                    <div className="text-xl font-black text-info">{formatMoney(data.marge?.marge_brute)}</div>
                </div>

                <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-base-content/40 text-[10px] font-bold uppercase tracking-widest mb-1">
                        <Package className="w-3 h-3" />
                        <span>Nb Ventes</span>
                    </div>
                    <div className="text-xl font-black text-base-content">{data.ca?.nb_ventes || 0}</div>
                </div>

                <div className="bg-warning/5 border border-warning/10 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-warning text-[10px] font-bold uppercase tracking-widest mb-1">
                        <CreditCard className="w-3 h-3" />
                        <span>Créances</span>
                    </div>
                    <div className="text-xl font-black text-warning">{formatMoney(data.creances?.total)}</div>
                    <div className="text-[10px] font-bold text-warning/60 mt-0.5">{data.creances?.nb_factures || 0} factures</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Encaissements */}
                <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-base-200 bg-base-50/50">
                        <h3 className="text-xs font-bold text-base-content uppercase tracking-widest flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-primary" />
                            Encaissements
                        </h3>
                    </div>
                    <div className="p-4 space-y-3">
                        {(data.encaissements || []).map((enc: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-2 rounded-xl border border-base-200">
                                <span className="text-xs font-bold text-base-content/60 uppercase">{enc.mode_label || enc.mode}</span>
                                <span className="text-sm font-black text-base-content">{formatMoney(enc.montant)}</span>
                            </div>
                        ))}
                        {(!data.encaissements || data.encaissements.length === 0) && (
                            <div className="text-center py-4 text-xs font-bold text-base-content/20 uppercase">Aucun encaissement</div>
                        )}
                    </div>
                </div>

                {/* TVA */}
                <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-base-200 bg-base-50/50">
                        <h3 className="text-xs font-bold text-base-content uppercase tracking-widest flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-secondary" />
                            Répartition TVA
                        </h3>
                    </div>
                    <div className="p-4 space-y-3">
                        {(data.ca_par_tva || []).map((tva: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-2 rounded-xl border border-base-200">
                                <span className="text-xs font-bold text-base-content/60 uppercase">TVA {tva.taux}%</span>
                                <span className="text-sm font-black text-base-content">{formatMoney(tva.montant_tva)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Mouvements Caisse */}
                {data.mouvements_caisse && (
                    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-base-200 bg-base-50/50">
                            <h3 className="text-xs font-bold text-base-content uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-accent" />
                                Mouvements Caisse
                            </h3>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="flex justify-between items-center p-2 rounded-xl bg-success/5 border border-success/10">
                                <div className="flex items-center gap-2">
                                    <ArrowUpRight className="w-4 h-4 text-success" />
                                    <span className="text-xs font-bold text-success uppercase">Entrées</span>
                                </div>
                                <span className="text-sm font-black text-success">{formatMoney(data.mouvements_caisse.total_entrees)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-error/5 border border-error/10">
                                <div className="flex items-center gap-2">
                                    <ArrowDownRight className="w-4 h-4 text-error" />
                                    <span className="text-xs font-bold text-error uppercase">Sorties</span>
                                </div>
                                <span className="text-sm font-black text-error">{formatMoney(data.mouvements_caisse.total_sorties)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 rounded-xl bg-base-200 border border-base-300">
                                <span className="text-xs font-bold text-base-content/60 uppercase">Solde Final</span>
                                <span className="text-sm font-black text-base-content">{formatMoney(data.mouvements_caisse.solde)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Top Fournisseurs */}
                {data.achats_par_fournisseur && data.achats_par_fournisseur.length > 0 && (
                    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-base-200 bg-base-50/50">
                            <h3 className="text-xs font-bold text-base-content uppercase tracking-widest flex items-center gap-2">
                                <Package className="w-4 h-4 text-primary" />
                                Top Fournisseurs
                            </h3>
                        </div>
                        <div className="p-4 space-y-2">
                            {data.achats_par_fournisseur.slice(0, 5).map((f: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-base-content/60 truncate max-w-[150px] uppercase">{f.fournisseur_nom}</span>
                                    <span className="font-black text-base-content">{formatMoney(f.montant_total)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Clients Pro */}
                {data.clients_professionnels && data.clients_professionnels.ca_total > 0 && (
                    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-base-200 bg-base-50/50">
                            <h3 className="text-xs font-bold text-base-content uppercase tracking-widest flex items-center gap-2">
                                <Users className="w-4 h-4 text-info" />
                                Clients Professionnels
                            </h3>
                        </div>
                        <div className="p-4 space-y-2">
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-base-content/40 uppercase">CA Total</span>
                                <span className="text-base-content">{formatMoney(data.clients_professionnels.ca_total)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-success uppercase">Payé</span>
                                <span className="text-success">{formatMoney(data.clients_professionnels.montant_paye)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-warning uppercase">Reste</span>
                                <span className="text-warning">{formatMoney(data.clients_professionnels.reste_a_payer)}</span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-base-200 flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase text-base-content/30">Recouvrement</span>
                                <span className="badge badge-info badge-sm font-black">{data.clients_professionnels.taux_recouvrement_pct}%</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Unités Gratuites */}
                {data.unites_gratuites && data.unites_gratuites.valeur_totale > 0 && (
                    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-base-200 bg-base-50/50">
                            <h3 className="text-xs font-bold text-base-content uppercase tracking-widest flex items-center gap-2">
                                <Gift className="w-4 h-4 text-accent" />
                                Unités Gratuites
                            </h3>
                        </div>
                        <div className="p-4 space-y-2">
                            <div className="flex justify-between text-xs font-bold text-base-content/60">
                                <span className="uppercase">Valeur Monétaire</span>
                                <span className="text-base-content">{formatMoney(data.unites_gratuites.valeur_totale)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold text-base-content/60">
                                <span className="uppercase">Quantité Donnée</span>
                                <span className="text-base-content">{data.unites_gratuites.quantite_totale}</span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-base-200 flex justify-between items-center text-xs">
                                <span className="text-[10px] font-black uppercase text-base-content/30">Impact sur CA</span>
                                <span className="badge badge-accent badge-sm font-black">{data.unites_gratuites.pct_du_ca}%</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
