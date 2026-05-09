import React, { useState } from 'react';
import { useAccounting } from '../../hooks/useAccounting';
import { 
    LayoutDashboard, 
    BookOpen, 
    Scale, 
    TrendingUp, 
    PlusCircle, 
    RefreshCcw,
    ChevronRight,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    Calendar,
    Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

const formatFCFA = (amount: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount) + ' F';
const formatAmount = (amount: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount);

interface ComptabiliteProps {
    defaultTab?: string;
}

export default function Comptabilite({ defaultTab = 'dashboard' }: ComptabiliteProps) {
    const { t, i18n } = useTranslation('accounting');
    const [activeTab, setActiveTab] = useState(defaultTab);
    const { 
        balance, 
        resultat, 
        bilan,
        ecritures, 
        comptes, 
        journaux,
        exercices,
        currentExercice,
        setCurrentExercice,
        isLoading, 
        isFetching,
        dateRange, 
        setDateRange,
        actions 
    } = useAccounting();

    const currentLocale = i18n.language === 'en' ? enUS : fr;

    const tabs = [
        { id: 'dashboard', label: t('tabs.dashboard'), icon: <LayoutDashboard className="w-4 h-4" /> },
        { id: 'grand-livre', label: t('tabs.grand_livre'), icon: <BookOpen className="w-4 h-4" /> },
        { id: 'achats', label: t('tabs.achats'), icon: <Search className="w-4 h-4" /> },
        { id: 'balance', label: t('tabs.balance'), icon: <Scale className="w-4 h-4" /> },
        { id: 'bilan', label: t('tabs.bilan'), icon: <TrendingUp className="w-4 h-4" /> },
        { id: 'resultat', label: t('tabs.resultat'), icon: <ArrowUpRight className="w-4 h-4" /> },
        { id: 'charges', label: t('tabs.charges'), icon: <PlusCircle className="w-4 h-4" /> },
        { id: 'plan', label: t('tabs.plan'), icon: <Settings className="w-4 h-4" /> },
    ];

    const handleExerciceChange = (exId: string) => {
        const selected = exercices?.find(ex => ex.id.toString() === exId);
        if (selected) {
            setCurrentExercice(selected);
            setDateRange({ start: selected.date_debut, end: selected.date_fin });
        }
    };

    return (
        <div className="min-h-screen bg-base-200/50 text-base-content p-4 md:p-10 animate-fade-in">
            {/* Header Executive */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between mb-12 gap-8">
                <div className="relative">
                    <div className="absolute -left-4 top-0 w-1 h-full bg-primary rounded-full blur-sm opacity-50"></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary mb-2 block ml-2">{t('ohada')}</span>
                    <h1 className="text-4xl md:text-6xl font-black tracking-tighter flex items-center gap-4 leading-none">
                        {t('title')}
                        {isFetching && (
                            <RefreshCcw className="w-6 h-6 text-primary animate-spin opacity-20" />
                        )}
                    </h1>
                    <p className="text-base-content/40 mt-3 font-bold text-lg max-w-xl leading-relaxed">{t('subtitle')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-base-100/50 backdrop-blur-md p-3 rounded-[2rem] border border-white/10 shadow-2xl">
                    {/* Exercice Selector */}
                    <div className="flex items-center gap-4 px-4 py-2 bg-base-100 rounded-2xl border border-base-300 shadow-inner">
                        <Calendar className="w-5 h-5 text-primary" />
                        <select 
                            className="bg-transparent border-none focus:ring-0 text-sm font-black uppercase tracking-wider text-base-content cursor-pointer select select-ghost select-sm"
                            value={currentExercice?.id || ''}
                            onChange={(e) => handleExerciceChange(e.target.value)}
                        >
                            {exercices?.map(ex => (
                                <option key={ex.id} value={ex.id} className="bg-base-100 text-base-content font-bold">
                                    {ex.nom} {ex.est_cloture ? '• '+t('exercice.closed') : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date Range Picker */}
                    <div className="flex items-center gap-2 bg-base-100 rounded-2xl border border-base-300 shadow-inner px-4 overflow-hidden">
                        <input 
                            type="date" 
                            className="bg-transparent border-none focus:ring-0 text-xs font-black p-3 w-32 outline-none"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                        />
                        <div className="w-px h-8 bg-base-300"></div>
                        <input 
                            type="date" 
                            className="bg-transparent border-none focus:ring-0 text-xs font-black p-3 w-32 outline-none"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                        />
                    </div>
                </div>
            </div>

            {/* Navigation Glass Tabs */}
            <div className="flex overflow-x-auto hide-scrollbar gap-3 mb-12 p-2 rounded-3xl bg-base-100/30 backdrop-blur-xl border border-white/20 shadow-xl w-full lg:w-fit">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`group flex-shrink-0 flex items-center gap-3 px-6 py-4 md:px-8 rounded-2xl transition-all duration-500 font-black text-[11px] uppercase tracking-[0.2em] relative overflow-hidden
                            ${activeTab === tab.id 
                                ? 'bg-primary text-white shadow-2xl shadow-primary/40' 
                                : 'text-base-content/40 hover:text-base-content hover:bg-base-100/50'
                            }`}
                    >
                        <span className={`transition-transform duration-500 ${activeTab === tab.id ? 'scale-110 rotate-12' : 'group-hover:rotate-12'}`}>
                            {tab.icon}
                        </span>
                        {tab.label}
                        {activeTab === tab.id && (
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none"></div>
                        )}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                    <RefreshCcw className="w-12 h-12 text-primary animate-spin mb-4" />
                    <p className="font-black uppercase tracking-widest text-primary/40">{t('loading_msg')}</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {activeTab === 'dashboard' && <DashboardTab resultat={resultat} actions={actions} t={t} />}
                    {activeTab === 'grand-livre' && <GrandLivreTab ecritures={ecritures} locale={currentLocale} t={t} />}
                    {activeTab === 'achats' && <AchatsTab ecritures={ecritures} locale={currentLocale} t={t} />}
                    {activeTab === 'balance' && <BalanceTab balance={balance} t={t} />}
                    {activeTab === 'bilan' && <BilanTab bilan={bilan} t={t} />}
                    {activeTab === 'resultat' && <ResultatTab resultat={resultat} t={t} />}
                    {activeTab === 'plan' && <PlanTab comptes={comptes} />}
                    {activeTab === 'charges' && <ChargesTab actions={actions} comptes={comptes} journaux={journaux} t={t} />}
                </div>
            )}
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DashboardTab({ resultat, actions, t }: any) {
    

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in">
            {/* KPI Summary Cards */}
            <div className="bg-base-100 p-6 rounded-3xl border border-base-300 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-3xl -mr-8 -mt-8"></div>
                <p className="text-base-content/40 font-black text-[10px] uppercase tracking-widest mb-2">Ventes Nettes (701)</p>
                <h3 className="text-2xl font-black text-primary">{formatFCFA(resultat?.total_produits || 0)}</h3>
                <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-primary/40 uppercase">
                    <ArrowUpRight className="w-4 h-4" />
                    Chiffre d'affaires
                </div>
            </div>

            <div className="bg-base-100 p-6 rounded-3xl border border-base-300 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-warning/5 blur-3xl -mr-8 -mt-8"></div>
                <p className="text-base-content/40 font-black text-[10px] uppercase tracking-widest mb-2">Valeur Stock (311)</p>
                <h3 className="text-2xl font-black text-warning">{formatFCFA(resultat?.valeur_stock || 0)}</h3>
                <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-warning/40 uppercase">
                    <BookOpen className="w-4 h-4" />
                    Variation d'inventaire
                </div>
            </div>

            <div className="bg-base-100 p-6 rounded-3xl border border-base-300 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-error/5 blur-3xl -mr-8 -mt-8"></div>
                <p className="text-base-content/40 font-black text-[10px] uppercase tracking-widest mb-2">{t('dashboard.expenses')} (Achats +)</p>
                <h3 className="text-2xl font-black text-error">{formatFCFA(resultat?.total_charges || 0)}</h3>
                <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-error/40 uppercase">
                    <ArrowDownRight className="w-4 h-4" />
                    Dépenses
                </div>
            </div>

            <div className={`p-6 rounded-3xl border border-base-300 shadow-sm relative overflow-hidden flex flex-col justify-between
                ${resultat?.resultat_net >= 0 ? 'bg-primary/5' : 'bg-error/5'}`}>
                <div>
                    <p className="text-base-content/40 font-black text-[10px] uppercase tracking-widest mb-2">{t('dashboard.net_result')}</p>
                    <h3 className={`text-3xl font-black ${resultat?.resultat_net >= 0 ? 'text-primary' : 'text-error'}`}>
                        {formatFCFA(resultat?.resultat_net || 0)}
                    </h3>
                </div>
                <div className="flex items-center justify-between mt-4">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider
                        ${resultat?.resultat_net >= 0 ? 'bg-primary text-white' : 'bg-error text-white'}`}>
                        {resultat?.resultat_net >= 0 ? t('dashboard.profit') : t('dashboard.loss')}
                    </span>
                </div>
            </div>

            {/* Closure Banner */}
            <div className="md:col-span-4 bg-primary p-6 md:p-10 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 shadow-xl shadow-primary/20 relative overflow-hidden text-center md:text-left">
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="grid grid-cols-6 gap-2 h-full transform -skew-x-12">
                        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="border-r border-white"></div>)}
                    </div>
                </div>
                
                <div className="relative z-10">
                    <h4 className="text-2xl md:text-3xl font-black text-white tracking-tighter mb-2">{t('dashboard.ready_title')}</h4>
                    <p className="text-white/80 font-bold text-sm md:text-base">{t('dashboard.ready_subtitle')}</p>
                </div>

                <button 
                    onClick={() => actions.initializeHistory.mutate()}
                    className="btn btn-lg w-full md:w-auto bg-white text-primary border-none px-6 md:px-10 py-4 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-2xl active:scale-95"
                >
                    <RefreshCcw className={`w-4 h-4 mr-2 ${actions.initializeHistory.isPending ? 'animate-spin' : ''}`} />
                    {actions.initializeHistory.isPending ? t('dashboard.init_loading') : t('dashboard.init_button')}
                </button>
            </div>
        </div>
    );
}

function AchatsTab({ ecritures, locale, t }: any) {
    const achEcritures = ecritures?.filter((e: any) => e.journal_code === 'AC') || [];
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const totalPages = Math.ceil(achEcritures.length / itemsPerPage);
    const paginated = achEcritures.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="card bg-base-100 rounded-3xl border border-base-300 overflow-hidden shadow-sm animate-fade-in">
            <div className="p-6 border-b border-base-300 bg-base-100">
                <h3 className="font-black text-xl uppercase tracking-tighter text-primary">{t('achats.title')}</h3>
                <p className="text-xs text-base-content/40 font-bold mt-1 uppercase tracking-widest">{t('achats.subtitle')}</p>
            </div>
            <div className="overflow-x-auto">
                <table className="table w-full text-left whitespace-nowrap">
                    <thead>
                        <tr className="bg-base-50/50 border-b border-base-200 text-base-content/50 text-[10px] font-black uppercase tracking-widest">
                            <th className="px-6 py-4">{t('ledger.cols.date')}</th>
                            <th className="px-6 py-4">{t('ledger.cols.ref')}</th>
                            <th className="px-6 py-4">{t('ledger.cols.label')}</th>
                            <th className="px-6 py-4 text-right">{t('ledger.cols.debit')}</th>
                            <th className="px-6 py-4 text-right">{t('ledger.cols.credit')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-base-100 font-bold">
                        {paginated.map((e: any) => (
                            <React.Fragment key={e.id}>
                                <tr className="group hover:bg-base-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-bold text-base-content/80">{format(new Date(e.date), 'dd MMM yyyy', { locale })}</td>
                                    <td className="px-6 py-4 text-primary font-black text-sm text-[13px] font-black">{e.reference}</td>
                                    <td className="px-6 py-4 text-sm font-black uppercase tracking-tighter">{e.libelle}</td>
                                    <td className="px-6 py-4 text-right text-primary font-black text-sm">{e.total_debit > 0 ? formatAmount(e.total_debit) : '-'}</td>
                                    <td className="px-6 py-4 text-right text-error font-black text-sm">{e.total_credit > 0 ? formatAmount(e.total_credit) : '-'}</td>
                                </tr>
                            </React.Fragment>
                        ))}
                        {paginated.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-20 text-center text-base-content/30 italic font-bold">
                                    {t('achats.no_data')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="p-4 border-t border-base-300 flex justify-between items-center bg-base-50">
                    <span className="text-xs font-bold text-base-content/50">
                        Page {currentPage} sur {totalPages} ({achEcritures.length} achats)
                    </span>
                    <div className="join">
                        <button 
                            className="join-item btn btn-sm" 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >«</button>
                        <button className="join-item btn btn-sm bg-base-100 font-mono">Page {currentPage}</button>
                        <button 
                            className="join-item btn btn-sm" 
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >»</button>
                    </div>
                </div>
            )}
        </div>
    );
}

function GrandLivreTab({ ecritures, locale, t }: any) {
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const filtered = ecritures?.filter((e: any) => 
        e.libelle.toLowerCase().includes(search.toLowerCase()) || 
        e.reference.toLowerCase().includes(search.toLowerCase())
    ) || [];

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Reset page when searching
    React.useEffect(() => {
        setCurrentPage(1);
    }, [search]);

    return (
        <div className="card bg-base-100 rounded-3xl border border-base-300 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-base-300 flex items-center justify-between bg-base-100">
                <h3 className="font-black text-xl uppercase tracking-tighter text-primary">{t('ledger.title')}</h3>
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
                    <input 
                        type="text" 
                        placeholder={t('ledger.search_placeholder')}
                        className="input input-bordered bg-base-200 border-base-300 rounded-xl pl-10 pr-4 py-2 text-xs font-bold focus:ring-primary w-64"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="table w-full text-left whitespace-nowrap">
                    <thead>
                        <tr className="bg-base-50/50 border-b border-base-200 text-base-content/50 text-[10px] font-black uppercase tracking-widest">
                            <th className="px-6 py-4">{t('ledger.cols.date')}</th>
                            <th className="px-6 py-4">{t('ledger.cols.journal')}</th>
                            <th className="px-6 py-4">{t('ledger.cols.ref')}</th>
                            <th className="px-6 py-4">{t('ledger.cols.label')}</th>
                            <th className="px-6 py-4 text-right">{t('ledger.cols.debit')}</th>
                            <th className="px-6 py-4 text-right">{t('ledger.cols.credit')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-base-100 font-bold">
                        {paginated.map((e: any) => (
                            <React.Fragment key={e.id}>
                                <tr className="group hover:bg-base-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-bold text-base-content/80">{format(new Date(e.date), 'dd MMM yyyy', { locale })}</td>
                                    <td className="px-6 py-4"><span className="badge badge-neutral badge-sm font-black text-[9px] uppercase">{e.journal_code}</span></td>
                                    <td className="px-6 py-4 text-primary font-black text-sm text-[13px] font-black">{e.reference}</td>
                                    <td className="px-6 py-4 text-sm font-black uppercase tracking-tighter">{e.libelle}</td>
                                    <td className="px-6 py-4 text-right text-primary font-black text-sm">{e.total_debit > 0 ? formatAmount(e.total_debit) : '-'}</td>
                                    <td className="px-6 py-4 text-right text-error font-black text-sm">{e.total_credit > 0 ? formatAmount(e.total_credit) : '-'}</td>
                                </tr>
                                {e.lignes.map((l: any) => (
                                    <tr key={l.id} className="text-[11px] text-base-content/40 hover:text-base-content transition-colors bg-base-50/30">
                                        <td colSpan={3}></td>
                                        <td className="px-6 py-1.5 pl-10 border-l-2 border-primary/10 italic">
                                            {l.compte_numero} - {l.compte_libelle}
                                        </td>
                                        <td className="px-6 py-1.5 text-right font-bold opacity-60 text-sm">{l.debit > 0 ? formatAmount(l.debit) : ''}</td>
                                        <td className="px-6 py-1.5 text-right font-bold opacity-60 text-sm">{l.credit > 0 ? formatAmount(l.credit) : ''}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                        {paginated.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-10 text-center text-base-content/40 italic font-bold">
                                    Aucune écriture trouvée
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="p-4 border-t border-base-300 flex justify-between items-center bg-base-50">
                    <span className="text-xs font-bold text-base-content/50">
                        Page {currentPage} sur {totalPages} ({filtered.length} écritures)
                    </span>
                    <div className="join">
                        <button 
                            className="join-item btn btn-sm" 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >«</button>
                        <button className="join-item btn btn-sm bg-base-100 font-mono">Page {currentPage}</button>
                        <button 
                            className="join-item btn btn-sm" 
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >»</button>
                    </div>
                </div>
            )}
        </div>
    );
}

function BalanceTab({ balance, t }: any) {
    return (
        <div className="card bg-base-100 rounded-3xl border border-base-300 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="table w-full text-left whitespace-nowrap">
                    <thead>
                    <tr className="bg-base-50/50 border-b border-base-200 text-[10px] font-black uppercase tracking-widest text-base-content/50">
                        <th className="px-6 py-4">{t('balance.cols.account')}</th>
                        <th className="px-6 py-4">{t('balance.cols.label')}</th>
                        <th className="px-6 py-4 text-right">{t('balance.cols.debit_mov')}</th>
                        <th className="px-6 py-4 text-right">{t('balance.cols.credit_mov')}</th>
                        <th className="px-6 py-4 text-right">{t('balance.cols.debit_sol')}</th>
                        <th className="px-6 py-4 text-right">{t('balance.cols.credit_sol')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-base-100 font-bold">
                    {balance?.map((b: any) => (
                        <tr key={b.numero} className="hover:bg-primary/5 transition-colors">
                            <td className="px-6 py-4 font-mono text-primary font-black">{b.numero}</td>
                            <td className="px-6 py-4 text-sm uppercase tracking-tighter">{b.libelle}</td>
                            <td className="px-6 py-4 text-right text-base-content/60 font-bold text-sm">{formatAmount(b.debit)}</td>
                            <td className="px-6 py-4 text-right text-base-content/60 font-bold text-sm">{formatAmount(b.credit)}</td>
                            <td className="px-6 py-4 text-right text-primary font-black text-sm">{b.solde_debit > 0 ? formatAmount(b.solde_debit) : '-'}</td>
                            <td className="px-6 py-4 text-right text-error font-black text-sm">{b.solde_credit > 0 ? formatAmount(b.solde_credit) : '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
        </div>
    );
}

function BilanTab({ bilan, t }: any) {
    

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="card bg-base-100 rounded-3xl border border-base-300 overflow-hidden shadow-sm">
                <div className="p-6 bg-primary/5 border-b border-base-300">
                    <h3 className="text-xl font-black text-primary flex items-center justify-between uppercase tracking-tighter">
                        {t('bilan.actif')}
                        <span>{formatFCFA(bilan?.total_actif || 0)}</span>
                    </h3>
                </div>
                <div className="p-6 space-y-4">
                    {bilan?.details_actif?.map((d: any) => (
                        <div key={d.numero} className="flex items-center justify-between border-b border-base-300 pb-3">
                            <div>
                                <span className="font-mono text-primary/40 font-black text-[10px] block">{d.numero}</span>
                                <span className="font-black text-sm uppercase tracking-tight">{d.libelle}</span>
                            </div>
                            <span className="font-black text-primary">{formatFCFA(d.solde)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="card bg-base-100 rounded-3xl border border-base-300 overflow-hidden shadow-sm">
                <div className="p-6 bg-error/5 border-b border-base-300">
                    <h3 className="text-xl font-black text-error flex items-center justify-between uppercase tracking-tighter">
                        {t('bilan.passif')}
                        <span>{formatFCFA(bilan?.total_passif || 0)}</span>
                    </h3>
                </div>
                <div className="p-6 space-y-4">
                    {bilan?.details_passif?.map((d: any) => (
                        <div key={d.numero} className="flex items-center justify-between border-b border-base-300 pb-3">
                            <div>
                                <span className="font-mono text-error/40 font-black text-[10px] block">{d.numero}</span>
                                <span className="font-black text-sm uppercase tracking-tight">{d.libelle}</span>
                            </div>
                            <span className="font-black text-error">{formatFCFA(d.solde)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="md:col-span-2 bg-base-100 p-6 rounded-2xl border-2 border-dashed border-base-300 text-center">
                <p className="text-base-content/40 text-[10px] font-black uppercase tracking-widest mb-1">{t('bilan.equilibrium')}</p>
                <p className={`text-2xl font-black ${bilan?.equilibre === 0 ? 'text-primary' : 'text-warning'}`}>
                    {t('bilan.difference')} : {formatFCFA(bilan?.equilibre || 0)}
                </p>
                <p className="text-[10px] text-base-content/40 mt-2 italic">{t('bilan.note')}</p>
            </div>
        </div>
    );
}

function PlanTab({ comptes }: any) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comptes?.map((c: any) => (
                <div key={c.numero} className="card bg-base-100 p-5 rounded-2xl border border-base-300 flex flex-row items-center justify-between group hover:border-primary/30 transition-all shadow-sm">
                    <div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg mb-1 inline-block
                            ${c.type === 'PRODUIT' ? 'bg-primary/10 text-primary' : 
                              c.type === 'CHARGE' ? 'bg-error/10 text-error' : 'bg-base-300 text-base-content/60'}`}>
                            {c.type}
                        </span>
                        <h4 className="font-black text-xs text-base-content/70 uppercase tracking-tight">{c.libelle}</h4>
                        <p className="text-2xl font-black text-base-content font-mono">{c.numero}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <ChevronRight className="w-4 h-4 text-primary" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function ResultatTab({ resultat, t }: any) {
    

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="card bg-base-100 rounded-3xl border border-base-300 overflow-hidden border-t-4 border-t-primary shadow-sm">
                <div className="p-6 bg-primary/5">
                    <h3 className="text-xl font-black text-primary flex items-center justify-between uppercase tracking-tighter">
                        {t('resultat.products')}
                        <span>{formatFCFA(resultat?.total_produits || 0)}</span>
                    </h3>
                </div>
                <div className="p-6 space-y-4">
                    {resultat?.details_produits?.map((d: any) => (
                        <div key={d.compte__numero} className="flex items-center justify-between border-b border-base-300 pb-3">
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-primary/40 font-black text-sm">{d.compte__numero}</span>
                                <span className="font-black text-sm uppercase tracking-tight">{d.compte__libelle}</span>
                            </div>
                            <span className="font-black text-primary">{formatFCFA(d.montant)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="card bg-base-100 rounded-3xl border border-base-300 overflow-hidden border-t-4 border-t-error shadow-sm">
                <div className="p-6 bg-error/5">
                    <h3 className="text-xl font-black text-error flex items-center justify-between uppercase tracking-tighter">
                        {t('resultat.charges')}
                        <span>{formatFCFA(resultat?.total_charges || 0)}</span>
                    </h3>
                </div>
                <div className="p-6 space-y-4">
                    {resultat?.details_charges?.map((d: any) => (
                        <div key={d.compte__numero} className="flex items-center justify-between border-b border-base-300 pb-3">
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-error/40 font-black text-sm">{d.compte__numero}</span>
                                <span className="font-black text-sm uppercase tracking-tight">{d.compte__libelle}</span>
                            </div>
                            <span className="font-black text-error/80">{formatFCFA(d.montant)}</span>
                        </div>
                    ))}
                    {(!resultat?.details_charges || resultat.details_charges.length === 0) && (
                        <p className="text-center text-base-content/30 italic py-10 font-medium">{t('resultat.no_charges')}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function ChargesTab({ actions, comptes, journaux, t }: any) {
    const [formData, setFormData] = useState({
        typeCharge: '',
        comptePersonnalise: '',
        modePaiement: '571100', // Default Caisse
        libelle: '',
        montant: '',
        date: new Date().toISOString().split('T')[0]
    });

    const categoriesOHADA = [
        { id: 'loyer', compte: '613000', label: 'Loyer (Bail)', icon: '🏢' },
        { id: 'energie', compte: '605000', label: 'Eau & Électricité (ENEO/CAMWATER)', icon: '⚡' },
        { id: 'salaires', compte: '660000', label: 'Salaires du personnel', icon: '👥' },
        { id: 'impots', compte: '640000', label: 'Impôts et Taxes', icon: '🏛️' },
        { id: 'internet', compte: '622000', label: 'Internet & Téléphone', icon: '🌐' },
        { id: 'fournitures', compte: '604000', label: 'Fournitures de bureau', icon: '📎' },
        { id: 'autre', compte: 'autre', label: 'Autre charge...', icon: '⚙️' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        let targetCompteNumero = formData.typeCharge === 'autre' ? formData.comptePersonnalise : formData.typeCharge;
        
        const chargeCompte = comptes.find((c: any) => c.numero === targetCompteNumero);
        const tresoCompte = comptes.find((c: any) => c.numero === formData.modePaiement);

        if (!chargeCompte) {
            alert("Erreur: Compte de charge introuvable. Veuillez vérifier votre plan comptable.");
            return;
        }
        if (!tresoCompte) {
            alert("Erreur: Compte de trésorerie introuvable.");
            return;
        }

        const journalCode = formData.modePaiement === '571100' ? 'CA' : 'BQ';
        const targetJournal = journaux?.find((j: any) => j.code === journalCode);

        if (!targetJournal) {
            alert(`Erreur: Journal '${journalCode}' introuvable. Veuillez vérifier votre configuration comptable.`);
            return;
        }

        actions.createEcriture.mutate({
            date: formData.date,
            journal: targetJournal.id,
            reference: `PIECE_${Date.now().toString().slice(-6)}`,
            libelle: formData.libelle,
            lignes: [
                { compte: chargeCompte.id, debit: parseFloat(formData.montant), credit: 0, libelle_ligne: formData.libelle },
                { compte: tresoCompte.id, debit: 0, credit: parseFloat(formData.montant), libelle_ligne: formData.libelle }
            ]
        });
        
        setFormData({ ...formData, libelle: '', montant: '' });
    };

    const chargeAccounts = comptes?.filter((c: any) => c.numero.startsWith('6'));

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="text-center mb-10">
                <h3 className="text-3xl font-black text-primary uppercase tracking-tighter mb-2">Saisie Simplifiée des Charges</h3>
                <p className="text-base-content/50 font-bold text-sm">Enregistrez vos dépenses courantes. Elles seront automatiquement intégrées au compte de résultat.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Sélecteur visuel de catégories */}
                <div className="md:col-span-1 space-y-3">
                    <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-4">Catégorie de dépense</p>
                    {categoriesOHADA.map(cat => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setFormData({...formData, typeCharge: cat.compte})}
                            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left group
                                ${formData.typeCharge === cat.compte 
                                    ? 'border-primary bg-primary/10 shadow-lg' 
                                    : 'border-base-300 bg-base-100 hover:border-primary/30 hover:bg-base-200/50'}`}
                        >
                            <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">{cat.icon}</span>
                            <span className={`font-black text-sm ${formData.typeCharge === cat.compte ? 'text-primary' : 'text-base-content'}`}>
                                {cat.label}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Formulaire de détails */}
                <div className="md:col-span-2 card bg-base-100 p-8 rounded-3xl border border-base-300 shadow-xl h-fit">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        
                        {formData.typeCharge === 'autre' && (
                            <div className="bg-warning/10 p-4 rounded-2xl border border-warning/20 mb-6 animate-fade-in">
                                <label className="block text-[10px] font-black text-warning uppercase tracking-widest mb-2">Sélectionnez le compte exact</label>
                                <select 
                                    className="select select-bordered w-full bg-base-100 border-warning/30 rounded-xl py-2 font-black text-base-content"
                                    value={formData.comptePersonnalise}
                                    onChange={(e) => setFormData({...formData, comptePersonnalise: e.target.value})}
                                    required
                                >
                                    <option value="">Sélectionnez un compte...</option>
                                    {chargeAccounts?.map((c: any) => (
                                        <option key={c.numero} value={c.numero}>{c.numero} - {c.libelle}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-6">
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-2">Moyen de Paiement</label>
                                <select 
                                    className="select select-bordered w-full bg-base-200 border-base-300 rounded-2xl py-3 font-black text-base-content focus:ring-primary h-14"
                                    value={formData.modePaiement}
                                    onChange={(e) => setFormData({...formData, modePaiement: e.target.value})}
                                    required
                                >
                                    <option value="571100">💵 Espèces (Caisse)</option>
                                    <option value="521100">🏦 Virement / Chèque (Banque)</option>
                                </select>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-2">{t('charges.date')}</label>
                                <input 
                                    type="date"
                                    className="input input-bordered w-full bg-base-200 border-base-300 rounded-2xl py-3 px-4 font-black text-base-content focus:ring-primary h-14"
                                    value={formData.date}
                                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-2">Motif (Libellé)</label>
                            <input 
                                type="text" 
                                placeholder="Ex: Paiement facture ENEO Avril..."
                                className="input input-bordered w-full bg-base-200 border-base-300 rounded-2xl py-4 px-4 font-black text-base-content focus:ring-primary h-14"
                                value={formData.libelle}
                                onChange={(e) => setFormData({...formData, libelle: e.target.value})}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-2">Montant (FCFA)</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    placeholder="0"
                                    className="input input-bordered w-full bg-base-200 border-base-300 rounded-2xl py-5 px-4 text-4xl font-black text-primary focus:ring-primary pr-20 h-24 text-right"
                                    value={formData.montant}
                                    onChange={(e) => setFormData({...formData, montant: e.target.value})}
                                    required
                                />
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-primary font-black text-3xl opacity-50">FCFA</span>
                            </div>
                        </div>

                        <button 
                            type="submit"
                            className="btn btn-primary w-full h-16 rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all shadow-xl shadow-primary/20 hover:scale-[1.02]"
                            disabled={actions.createEcriture.isPending || !formData.typeCharge}
                        >
                            {actions.createEcriture.isPending ? t('charges.saving') : "Enregistrer la dépense"}
                        </button>
                        
                        {!formData.typeCharge && (
                            <p className="text-center text-error text-xs font-bold mt-2">Veuillez sélectionner une catégorie de dépense à gauche.</p>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}
