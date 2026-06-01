import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useAccounting } from '../../hooks/useAccounting';
import api from '../../services/api';
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
    Settings,
    FileText,
    Download
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import Pagination from '../ui/Pagination';

const amountFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const formatFCFA = (amount: number) => amountFormatter.format(amount) + ' F';
const formatAmount = (amount: number) => amountFormatter.format(amount);

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
        ecrituresCount,
        ecrituresPage,
        setEcrituresPage,
        ecrituresSearch,
        setEcrituresSearch,
        ecrituresJournal,
        setEcrituresJournal,
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

    useEffect(() => {
        if (activeTab === 'achats') {
            setEcrituresJournal('AC');
        } else if (activeTab === 'grand-livre') {
            setEcrituresJournal('');
        }
        setEcrituresPage(1);
    }, [activeTab, setEcrituresJournal, setEcrituresPage]);

    const currentLocale = i18n.language === 'en' ? enUS : fr;

    const tabs = [
        { id: 'dashboard', label: t('tabs.dashboard'), icon: <LayoutDashboard className="size-4" /> },
        { id: 'grand-livre', label: t('tabs.grand_livre'), icon: <BookOpen className="size-4" /> },
        { id: 'achats', label: t('tabs.achats'), icon: <Search className="size-4" /> },
        { id: 'balance', label: t('tabs.balance'), icon: <Scale className="size-4" /> },
        { id: 'bilan', label: t('tabs.bilan'), icon: <TrendingUp className="size-4" /> },
        { id: 'resultat', label: t('tabs.resultat'), icon: <ArrowUpRight className="size-4" /> },
        { id: 'charges', label: t('tabs.charges'), icon: <PlusCircle className="size-4" /> },
        { id: 'plan', label: t('tabs.plan'), icon: <Settings className="size-4" /> },
    ];

    const handleExerciceChange = useCallback((exId: string) => {
        const selected = exercices?.find(ex => ex.id.toString() === exId);
        if (selected) {
            setCurrentExercice(selected);
            setDateRange({ start: selected.date_debut, end: selected.date_fin });
        }
    }, [exercices, setCurrentExercice, setDateRange]);

    return (
        <div className="min-h-screen bg-base-200 text-base-content p-4 md:p-8 animate-fade-in">
            {/* Header - Harmonized with other pages */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-8 gap-6">
                <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary mb-2 block">{t('ohada')}</span>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
                        {t('title')}
                        {isFetching && (
                            <RefreshCcw className="size-5 text-primary animate-spin opacity-40" />
                        )}
                    </h1>
                    <p className="text-base-content/60 mt-2 text-sm max-w-xl">{t('subtitle')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-base-100 p-3 rounded-xl border border-base-300 shadow-sm">
                    {/* Exercice Selector */}
                    <div className="flex items-center gap-3 px-3 py-2 bg-base-200 rounded-lg border border-base-300">
                        <Calendar className="size-4 text-primary" />
                        <select 
                            className="bg-transparent border-none focus:ring-0 text-sm font-medium text-base-content cursor-pointer"
                            value={currentExercice?.id || ''}
                            onChange={(e) => handleExerciceChange(e.target.value)}
                        >
                            {exercices?.map(ex => (
                                <option key={ex.id} value={ex.id}>
                                    {ex.nom} {ex.est_cloture ? '• '+t('exercice.closed') : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date Range Picker */}
                    <div className="flex items-center gap-2 bg-base-200 rounded-lg border border-base-300 px-3 py-2">
                        <input 
                            type="date" 
                            className="bg-transparent border-none focus:ring-0 text-sm p-1 w-32"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                        />
                        <div className="w-px h-4 bg-base-400"></div>
                        <input 
                            type="date" 
                            className="bg-transparent border-none focus:ring-0 text-sm p-1 w-32"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                        />
                    </div>
                </div>
            </div>

            {/* Navigation Tabs - Harmonized */}
            <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-8 p-1.5 rounded-xl bg-base-100 border border-base-300 shadow-sm w-full lg:w-fit">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`group flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm relative
                            ${activeTab === tab.id 
                                ? 'bg-primary text-white shadow-sm' 
                                : 'text-base-content/60 hover:text-base-content hover:bg-base-200'
                            }`}
                    >
                        <span className={`transition-transform ${activeTab === tab.id ? 'scale-110' : ''}`}>
                            {tab.icon}
                        </span>
                        <span className="whitespace-nowrap">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content Area */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                    <RefreshCcw className="size-10 text-primary animate-spin mb-3" />
                    <p className="font-medium text-base-content/50">{t('loading_msg')}</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <Suspense fallback={
                        <div className="flex flex-col items-center justify-center py-20 text-base-content/30">
                            <RefreshCcw className="size-8 animate-spin mb-2" />
                            <p className="text-xs font-medium uppercase tracking-wider">{t('loading_data')}</p>
                        </div>
                    }>
                        {activeTab === 'dashboard' && <DashboardTab resultat={resultat} actions={actions} t={t} />}
                        {activeTab === 'grand-livre' && (
                            <GrandLivreTab 
                                ecritures={ecritures} 
                                count={ecrituresCount}
                                page={ecrituresPage}
                                setPage={setEcrituresPage}
                                search={ecrituresSearch}
                                setSearch={setEcrituresSearch}
                                locale={currentLocale} 
                                t={t} 
                            />
                        )}
                        {activeTab === 'achats' && (
                            <AchatsTab 
                                ecritures={ecritures} 
                                count={ecrituresCount}
                                page={ecrituresPage}
                                setPage={setEcrituresPage}
                                locale={currentLocale} 
                                t={t} 
                            />
                        )}
                        {activeTab === 'balance' && <BalanceTab balance={balance?.comptes || []} t={t} />}
                        {activeTab === 'bilan' && <BilanTab bilan={bilan} t={t} />}
                        {activeTab === 'resultat' && <ResultatTab resultat={resultat} t={t} />}
                        {activeTab === 'plan' && <PlanTab comptes={comptes} actions={actions} />}
                        {activeTab === 'charges' && <ChargesTab actions={actions} comptes={comptes} journaux={journaux} t={t} />}
                    </Suspense>
                </div>

            )}
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DashboardTab({ resultat, actions, t }: any) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
            {/* KPI Summary Cards - Harmonized */}
            <div className="bg-base-100 p-5 rounded-xl border border-base-300 shadow-sm">
                <p className="text-base-content/60 text-xs font-medium uppercase tracking-wide mb-1">{t('dashboard.revenue')} (701)</p>
                <h3 className="text-2xl font-bold text-primary">{formatFCFA(resultat?.total_produits || 0)}</h3>
                <div className="mt-2 flex items-center gap-1 text-xs text-primary/60">
                    <ArrowUpRight className="size-3" />
                    <span>{t('kpi.revenue_label')}</span>
                </div>
            </div>

            <div className="bg-base-100 p-5 rounded-xl border border-base-300 shadow-sm">
                <p className="text-base-content/60 text-xs font-medium uppercase tracking-wide mb-1">{t('kpi.stock_value_label')} (311)</p>
                <h3 className="text-2xl font-bold text-warning">{formatFCFA(resultat?.valeur_stock || 0)}</h3>
                <div className="mt-2 flex items-center gap-1 text-xs text-warning/60">
                    <BookOpen className="size-3" />
                    <span>{t('kpi.stock_variation_label')}</span>
                </div>
            </div>

            <div className="bg-base-100 p-5 rounded-xl border border-base-300 shadow-sm">
                <p className="text-base-content/60 text-xs font-medium uppercase tracking-wide mb-1">{t('dashboard.expenses')} (Achats +)</p>
                <h3 className="text-2xl font-bold text-error">{formatFCFA(resultat?.total_charges || 0)}</h3>
                <div className="mt-2 flex items-center gap-1 text-xs text-error/60">
                    <ArrowDownRight className="size-3" />
                    <span>{t('kpi.expenses_label')}</span>
                </div>
            </div>

            {/* Performance Comparison Card */}
            <div className="md:col-span-2 bg-base-100 p-5 rounded-xl border border-base-300 shadow-sm">
                <div className="mb-4">
                    <h4 className="font-semibold text-sm text-primary">{t('performance.title')}</h4>
                    <p className="text-xs text-base-content/60">{t('performance.subtitle')}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-success/10 p-4 rounded-lg">
                        <p className="text-xs text-success font-medium">{t('performance.produits_label')}</p>
                        <p className="text-lg font-bold text-success">{formatFCFA(resultat?.total_produits || 0)}</p>
                    </div>
                    <div className="bg-error/10 p-4 rounded-lg">
                        <p className="text-xs text-error font-medium">{t('performance.charges_label')}</p>
                        <p className="text-lg font-bold text-error">{formatFCFA(resultat?.total_charges || 0)}</p>
                    </div>
                </div>
            </div>

            {/* Net Result Card */}
            <div className={`bg-base-100 p-5 rounded-xl border border-base-300 shadow-sm flex flex-col justify-between
                ${resultat?.resultat_net >= 0 ? 'bg-primary/10/50' : 'bg-error/10/50'}`}>
                <div>
                    <p className="text-base-content/60 text-xs font-medium uppercase tracking-wide mb-1">{t('dashboard.net_result')}</p>
                    <h3 className={`text-2xl font-bold ${resultat?.resultat_net >= 0 ? 'text-primary' : 'text-error'}`}>
                        {formatFCFA(resultat?.resultat_net || 0)}
                    </h3>
                </div>
                <span className={`mt-3 px-2 py-1 rounded-full text-xs font-medium w-fit
                    ${resultat?.resultat_net >= 0 ? 'bg-primary text-white' : 'bg-error text-white'}`}>
                    {resultat?.resultat_net >= 0 ? t('dashboard.profit') : t('dashboard.loss')}
                </span>
            </div>

            {/* Closure Banner - Simplified */}
            <div className="md:col-span-3 bg-primary p-5 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm text-center md:text-left">
                <div>
                    <h4 className="text-lg font-semibold text-white">{t('dashboard.ready_title')}</h4>
                    <p className="text-white/80 text-sm">{t('dashboard.ready_subtitle')}</p>
                </div>

                <button 
                    onClick={() => actions.initializeHistory.mutate()}
                    className="btn bg-base-100 text-primary border-none px-4 py-2 rounded-lg font-medium text-sm hover:bg-base-100/90 transition-colors"
                >
                    <RefreshCcw className={`size-4 mr-2 ${actions.initializeHistory.isPending ? 'animate-spin' : ''}`} />
                    {actions.initializeHistory.isPending ? t('dashboard.init_loading') : t('dashboard.init_button')}
                </button>
            </div>
        </div>
    );
}

function AchatsTab({ ecritures, count, page, setPage, locale, t }: any) {
    const itemsPerPage = 50;
    const totalPages = Math.ceil(count / itemsPerPage);

    return (
        <div className="bg-base-100 rounded-xl border border-base-300 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-base-300">
                <h3 className="font-semibold text-lg text-primary">{t('achats.title')}</h3>
                <p className="text-xs text-base-content/60 mt-1">{t('achats.subtitle')}</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-separate border-spacing-0">
                    <thead>
                        <tr className="bg-base-200 border-b border-base-200 text-xs font-medium uppercase text-base-content/60">
                            <th className="px-4 py-3">{t('ledger.cols.date')}</th>
                            <th className="px-4 py-3">{t('ledger.cols.ref')}</th>
                            <th className="px-4 py-3">{t('ledger.cols.label')}</th>
                            <th className="px-4 py-3 text-right">{t('ledger.cols.debit')}</th>
                            <th className="px-4 py-3 text-right">{t('ledger.cols.credit')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-base-200">
                        {ecritures.map((e: any) => (
                            <React.Fragment key={e.id}>
                                <tr className="group hover:bg-base-200 transition-colors">
                                    <td className="px-4 py-3 text-sm text-base-content/60">{format(new Date(e.date), 'dd MMM yyyy', { locale })}</td>
                                    <td className="px-4 py-3 text-primary font-medium text-sm">{e.reference}</td>
                                    <td className="px-4 py-3 text-sm">{e.libelle}</td>
                                    <td className="px-4 py-3 text-right text-primary font-medium text-sm">{e.total_debit > 0 ? formatAmount(e.total_debit) : '-'}</td>
                                    <td className="px-4 py-3 text-right text-error font-medium text-sm">{e.total_credit > 0 ? formatAmount(e.total_credit) : '-'}</td>
                                </tr>
                            </React.Fragment>
                        ))}
                        {ecritures.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-12 text-center text-base-content/50 text-sm">
                                    {t('achats.no_data')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <Pagination 
                currentPage={page}
                totalPages={totalPages}
                totalItems={count}
                onPrev={() => setPage((p: number) => Math.max(1, p - 1))}
                onNext={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                hasNext={page < totalPages}
                label={t('ledger.items_label', { defaultValue: 'achats' })}
            />
        </div>
    );
}

function GrandLivreTab({ ecritures, count, page, setPage, search, setSearch, locale, t }: any) {
    const itemsPerPage = 50;
    const totalPages = Math.ceil(count / itemsPerPage);

    return (
        <div className="bg-base-100 rounded-xl border border-base-300 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-base-300 flex items-center justify-between">
                <h3 className="font-semibold text-lg text-primary">{t('ledger.title')}</h3>
                <div className="relative">
                    <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
                    <input 
                        type="text" 
                        placeholder={t('ledger.search_placeholder')}
                        className="input input-bordered bg-base-200 border-base-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-primary w-64"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-separate border-spacing-0">
                    <thead>
                        <tr className="bg-base-200 border-b border-base-200 text-xs font-medium uppercase text-base-content/60">
                            <th className="px-4 py-3">{t('ledger.cols.date')}</th>
                            <th className="px-4 py-3">{t('ledger.cols.journal')}</th>
                            <th className="px-4 py-3">{t('ledger.cols.ref')}</th>
                            <th className="px-4 py-3">{t('ledger.cols.label')}</th>
                            <th className="px-4 py-3 text-right">{t('ledger.cols.debit')}</th>
                            <th className="px-4 py-3 text-right">{t('ledger.cols.credit')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-base-200">
                        {ecritures.map((e: any) => (
                            <React.Fragment key={e.id}>
                                <tr className="group hover:bg-base-200 transition-colors">
                                    <td className="px-4 py-3 text-sm text-base-content/60">{format(new Date(e.date), 'dd MMM yyyy', { locale })}</td>
                                    <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-base-200 text-base-content border border-base-300">{e.journal_code}</span></td>
                                    <td className="px-4 py-3 text-primary font-medium text-sm">{e.reference}</td>
                                    <td className="px-4 py-3 text-sm">{e.libelle}</td>
                                    <td className="px-4 py-3 text-right text-primary font-medium text-sm">{e.total_debit > 0 ? formatAmount(e.total_debit) : '-'}</td>
                                    <td className="px-4 py-3 text-right text-error font-medium text-sm">{e.total_credit > 0 ? formatAmount(e.total_credit) : '-'}</td>
                                </tr>
                                {e.lignes?.map((l: any) => (
                                    <tr key={l.id} className="text-xs text-base-content/60 hover:text-base-content transition-colors bg-base-200">
                                        <td colSpan={3}></td>
                                        <td className="px-4 py-2 pl-8 border-l-2 border-indigo-100">
                                            {l.compte_numero} - {l.compte_libelle}
                                        </td>
                                        <td className="px-4 py-2 text-right font-medium">{l.debit > 0 ? formatAmount(l.debit) : ''}</td>
                                        <td className="px-4 py-2 text-right font-medium">{l.credit > 0 ? formatAmount(l.credit) : ''}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                        {ecritures.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-10 text-center text-base-content/50 text-sm">
                                    Aucune écriture trouvée
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Pagination Controls */}
            <Pagination 
                currentPage={page}
                totalPages={totalPages}
                totalItems={count}
                onPrev={() => setPage((p: number) => Math.max(1, p - 1))}
                onNext={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                hasNext={page < totalPages}
                label={t('ledger.items_label', { defaultValue: 'écritures' })}
            />
        </div>
    );
}

function BalanceTab({ balance, t }: any) {
    return (
        <div className="bg-base-100 rounded-xl border border-base-300 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-separate border-spacing-0">
                    <thead>
                    <tr className="bg-base-200 border-b border-base-200 text-xs font-medium uppercase text-base-content/60">
                        <th className="px-4 py-3">{t('balance.cols.account')}</th>
                        <th className="px-4 py-3">{t('balance.cols.label')}</th>
                        <th className="px-4 py-3 text-right">{t('balance.cols.debit_mov')}</th>
                        <th className="px-4 py-3 text-right">{t('balance.cols.credit_mov')}</th>
                        <th className="px-4 py-3 text-right">{t('balance.cols.debit_sol')}</th>
                        <th className="px-4 py-3 text-right">{t('balance.cols.credit_sol')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-base-200">
                    {balance?.map((b: any) => (
                        <tr key={b.numero} className="hover:bg-base-200 transition-colors">
                            <td className="px-4 py-3 font-mono text-primary font-medium">{b.numero}</td>
                            <td className="px-4 py-3 text-sm">{b.libelle}</td>
                            <td className="px-4 py-3 text-right text-base-content/60 text-sm">{formatAmount(b.mouvement_debit || 0)}</td>
                            <td className="px-4 py-3 text-right text-base-content/60 text-sm">{formatAmount(b.mouvement_credit || 0)}</td>
                            <td className="px-4 py-3 text-right text-primary font-medium text-sm">{b.cloture_debit > 0 ? formatAmount(b.cloture_debit) : '-'}</td>
                            <td className="px-4 py-3 text-right text-error font-medium text-sm">{b.cloture_credit > 0 ? formatAmount(b.cloture_credit) : '-'}</td>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-base-100 rounded-xl border border-base-300 overflow-hidden shadow-sm">
                <div className="p-5 bg-primary/10/50 border-b border-base-300">
                    <h3 className="text-lg font-semibold text-primary flex items-center justify-between">
                        {t('bilan.actif')}
                        <span>{formatFCFA(bilan?.total_actif || 0)}</span>
                    </h3>
                </div>
                <div className="p-5 space-y-3">
                    {bilan?.details_actif?.map((d: any) => (
                        <div key={d.numero} className="flex items-center justify-between border-b border-base-300 pb-2">
                            <div>
                                <span className="font-mono text-primary/40 text-xs block">{d.numero}</span>
                                <span className="font-medium text-sm">{d.libelle}</span>
                            </div>
                            <span className="font-semibold text-primary">{formatFCFA(d.solde)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-base-100 rounded-xl border border-base-300 overflow-hidden shadow-sm">
                <div className="p-5 bg-error/10/50 border-b border-base-300">
                    <h3 className="text-lg font-semibold text-error flex items-center justify-between">
                        {t('bilan.passif')}
                        <span>{formatFCFA(bilan?.total_passif || 0)}</span>
                    </h3>
                </div>
                <div className="p-5 space-y-3">
                    {bilan?.details_passif?.map((d: any) => (
                        <div key={d.numero} className="flex items-center justify-between border-b border-base-300 pb-2">
                            <div>
                                <span className="font-mono text-error/40 text-xs block">{d.numero}</span>
                                <span className="font-medium text-sm">{d.libelle}</span>
                            </div>
                            <span className="font-semibold text-error">{formatFCFA(d.solde)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="md:col-span-2 bg-base-100 p-5 rounded-xl border-2 border-dashed border-base-300 text-center">
                <p className="text-base-content/50 text-xs font-medium uppercase tracking-wide mb-1">{t('bilan.equilibrium')}</p>
                <p className={`text-xl font-semibold ${bilan?.equilibre === 0 ? 'text-primary' : 'text-warning'}`}>
                    {t('bilan.difference')} : {formatFCFA(bilan?.equilibre || 0)}
                </p>
                <p className="text-xs text-base-content/50 mt-2 italic">{t('bilan.note')}</p>
            </div>
        </div>
    );
}

const TYPE_STYLES: Record<string, string> = {
    PRODUIT: 'bg-primary/10 text-primary border-primary/20',
    CHARGE:  'bg-error/10 text-error border-error/20',
    ACTIF:   'bg-info/10 text-info border-info/20',
    PASSIF:  'bg-warning/10 text-warning border-warning/20',
};

const EMPTY_FORM = { numero: '', libelle: '', type: 'ACTIF' as const, is_active: true };

function PlanTab({ comptes, actions }: any) {
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<any>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [confirmDelete, setConfirmDelete] = useState<any>(null);

    const openAdd = () => { setForm({ ...EMPTY_FORM }); setEditTarget(null); setModalOpen(true); };
    const openEdit = (c: any) => { setForm({ numero: c.numero, libelle: c.libelle, type: c.type, is_active: c.is_active }); setEditTarget(c); setModalOpen(true); };
    const closeModal = () => { setModalOpen(false); setEditTarget(null); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editTarget) {
            await actions.updateCompte.mutateAsync({ id: editTarget.id, ...form });
        } else {
            await actions.createCompte.mutateAsync(form);
        }
        closeModal();
    };

    const handleDelete = async () => {
        await actions.deleteCompte.mutateAsync(confirmDelete.id);
        setConfirmDelete(null);
    };

    const filtered = (comptes || []).filter((c: any) => {
        const q = search.toLowerCase();
        const matchSearch = !q || c.numero.includes(q) || c.libelle.toLowerCase().includes(q);
        const matchType = !filterType || c.type === filterType;
        return matchSearch && matchType;
    });

    const grouped: Record<string, any[]> = {};
    filtered.forEach((c: any) => {
        if (!grouped[c.type]) grouped[c.type] = [];
        grouped[c.type].push(c);
    });

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/30" />
                    <input
                        type="text"
                        placeholder="Rechercher un compte (numéro ou libellé)…"
                        className="input input-bordered w-full pl-9 text-sm h-9"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="select select-bordered select-sm h-9"
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                >
                    <option value="">Tous les types</option>
                    <option value="ACTIF">Actif</option>
                    <option value="PASSIF">Passif</option>
                    <option value="CHARGE">Charge</option>
                    <option value="PRODUIT">Produit</option>
                </select>
                <button onClick={openAdd} className="btn btn-primary btn-sm gap-1.5 shrink-0">
                    <PlusCircle className="size-4" /> Nouveau compte
                </button>
            </div>

            {/* Stats */}
            <div className="flex gap-3 flex-wrap text-xs text-base-content/50">
                <span className="font-medium">{filtered.length} compte(s)</span>
                {Object.entries(grouped).map(([type, items]) => (
                    <span key={type} className={`px-2 py-0.5 rounded-full border font-semibold ${TYPE_STYLES[type]}`}>
                        {type} ({items.length})
                    </span>
                ))}
            </div>

            {/* Grouped list */}
            {Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg mb-2 border text-xs font-black uppercase tracking-wider ${TYPE_STYLES[type]}`}>
                        {type}
                        <span className="ml-auto font-normal opacity-60">{items.length} compte(s)</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {items.map((c: any) => (
                            <div key={c.id} className={`bg-base-100 p-3 rounded-xl border border-base-300 flex items-center justify-between group hover:shadow-sm transition-all ${!c.is_active ? 'opacity-50' : ''}`}>
                                <div className="min-w-0">
                                    <p className="font-mono text-base font-bold text-base-content">{c.numero}</p>
                                    <p className="text-xs text-base-content/60 truncate">{c.libelle}</p>
                                    {!c.is_active && <span className="text-[10px] text-error font-bold">INACTIF</span>}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                                    <button
                                        onClick={() => openEdit(c)}
                                        className="btn btn-ghost btn-xs"
                                        title="Modifier"
                                    >
                                        <FileText className="size-3.5 text-primary" />
                                    </button>
                                    <button
                                        onClick={() => setConfirmDelete(c)}
                                        className="btn btn-ghost btn-xs"
                                        title="Supprimer"
                                    >
                                        <ArrowDownRight className="size-3.5 text-error" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {filtered.length === 0 && (
                <div className="flex flex-col items-center py-16 text-base-content/30">
                    <Settings className="size-10 mb-3" />
                    <p className="font-bold">Aucun compte trouvé</p>
                </div>
            )}

            {/* Modal ajout / modification */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-base-100 rounded-2xl shadow-xl w-full max-w-md border border-base-300">
                        <div className="p-5 border-b border-base-200 flex items-center justify-between">
                            <h3 className="font-bold text-base-content">
                                {editTarget ? 'Modifier le compte' : 'Nouveau compte'}
                            </h3>
                            <button onClick={closeModal} className="btn btn-ghost btn-xs btn-circle">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-1">Numéro de compte *</label>
                                <input
                                    type="text"
                                    className="input input-bordered w-full font-mono"
                                    placeholder="Ex: 701200"
                                    value={form.numero}
                                    onChange={e => setForm({ ...form, numero: e.target.value })}
                                    required
                                    disabled={!!editTarget}
                                />
                                {editTarget && <p className="text-[10px] text-base-content/40 mt-1">Le numéro ne peut pas être modifié.</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-1">Libellé *</label>
                                <input
                                    type="text"
                                    className="input input-bordered w-full"
                                    placeholder="Ex: Ventes de médicaments"
                                    value={form.libelle}
                                    onChange={e => setForm({ ...form, libelle: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-1">Type *</label>
                                <select
                                    className="select select-bordered w-full"
                                    value={form.type}
                                    onChange={e => setForm({ ...form, type: e.target.value as any })}
                                    required
                                >
                                    <option value="ACTIF">Actif</option>
                                    <option value="PASSIF">Passif</option>
                                    <option value="CHARGE">Charge</option>
                                    <option value="PRODUIT">Produit</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    className="checkbox checkbox-sm checkbox-primary"
                                    checked={form.is_active}
                                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                                />
                                <label htmlFor="is_active" className="text-sm font-medium cursor-pointer">Compte actif</label>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={closeModal} className="btn btn-ghost flex-1">Annuler</button>
                                <button
                                    type="submit"
                                    className="btn btn-primary flex-1"
                                    disabled={actions.createCompte?.isPending || actions.updateCompte?.isPending}
                                >
                                    {(actions.createCompte?.isPending || actions.updateCompte?.isPending)
                                        ? <span className="loading loading-spinner loading-xs" />
                                        : editTarget ? 'Enregistrer' : 'Créer'
                                    }
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal confirmation suppression */}
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-base-100 rounded-2xl shadow-xl w-full max-w-sm border border-error/30 p-6 text-center space-y-4">
                        <div className="size-12 bg-error/10 rounded-full flex items-center justify-center mx-auto">
                            <ArrowDownRight className="size-6 text-error" />
                        </div>
                        <div>
                            <p className="font-bold text-base-content">Supprimer ce compte ?</p>
                            <p className="text-sm text-base-content/60 mt-1">
                                <span className="font-mono font-bold">{confirmDelete.numero}</span> — {confirmDelete.libelle}
                            </p>
                            <p className="text-xs text-error/70 mt-2">Impossible si des écritures y sont rattachées.</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost flex-1">Annuler</button>
                            <button
                                onClick={handleDelete}
                                className="btn btn-error flex-1"
                                disabled={actions.deleteCompte?.isPending}
                            >
                                {actions.deleteCompte?.isPending ? <span className="loading loading-spinner loading-xs" /> : 'Supprimer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ResultatTab({ resultat, t }: any) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card bg-base-100 rounded-xl border border-base-300 overflow-hidden border-t-4 border-t-indigo-500 shadow-sm">
                <div className="p-5 bg-primary/10/50">
                    <h3 className="text-lg font-semibold text-primary flex items-center justify-between">
                        {t('resultat.products')}
                        <span>{formatFCFA(resultat?.total_produits || 0)}</span>
                    </h3>
                </div>
                <div className="p-5 space-y-3">
                    {resultat?.details_produits?.map((d: any) => (
                        <div key={d.compte__numero} className="flex items-center justify-between border-b border-base-300 pb-2">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-primary/40 text-xs">{d.compte__numero}</span>
                                <span className="font-medium text-sm">{d.compte__libelle}</span>
                            </div>
                            <span className="font-semibold text-primary">{formatFCFA(d.montant)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="card bg-base-100 rounded-xl border border-base-300 overflow-hidden border-t-4 border-t-red-500 shadow-sm">
                <div className="p-5 bg-error/10/50">
                    <h3 className="text-lg font-semibold text-error flex items-center justify-between">
                        {t('resultat.charges')}
                        <span>{formatFCFA(resultat?.total_charges || 0)}</span>
                    </h3>
                </div>
                <div className="p-5 space-y-3">
                    {resultat?.details_charges?.map((d: any) => (
                        <div key={d.compte__numero} className="flex items-center justify-between border-b border-base-300 pb-2">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-error/40 text-xs">{d.compte__numero}</span>
                                <span className="font-medium text-sm">{d.compte__libelle}</span>
                            </div>
                            <span className="font-semibold text-error">{formatFCFA(d.montant)}</span>
                        </div>
                    ))}
                    {(!resultat?.details_charges || resultat.details_charges.length === 0) && (
                        <p className="text-center text-base-content/50 italic py-10 font-medium">{t('resultat.no_charges')}</p>
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const targetCompteNumero = formData.typeCharge === 'autre' ? formData.comptePersonnalise : formData.typeCharge;

        // Résolution du compte de charge — création automatique si absent
        const catInfo = categoriesOHADA.find(c => c.compte === targetCompteNumero);
        let chargeCompte = comptes?.find((c: any) => c.numero === targetCompteNumero);
        if (!chargeCompte && catInfo && catInfo.compte !== 'autre') {
            try {
                const res = await actions.createCompte.mutateAsync({
                    numero: catInfo.compte,
                    libelle: catInfo.label.replace(/\s*\(.*\)/, '').trim(),
                    type: 'CHARGE' as const,
                    is_active: true
                });
                chargeCompte = res.data;
            } catch { return; }
        }
        if (!chargeCompte) {
            alert("Compte de charge introuvable. Créez-le d'abord dans le Plan Comptable.");
            return;
        }

        // Résolution du compte de trésorerie — création automatique si absent
        const tresoMeta = formData.modePaiement === '571100'
            ? { libelle: 'Caisse', type: 'ACTIF' as const }
            : { libelle: 'Banque', type: 'ACTIF' as const };
        let tresoCompte = comptes?.find((c: any) => c.numero === formData.modePaiement);
        if (!tresoCompte) {
            try {
                const res = await actions.createCompte.mutateAsync({
                    numero: formData.modePaiement,
                    ...tresoMeta,
                    is_active: true
                });
                tresoCompte = res.data;
            } catch { return; }
        }

        // Résolution du journal — création automatique si absent
        const journalCode = formData.modePaiement === '571100' ? 'CA' : 'BQ';
        const journalNom  = formData.modePaiement === '571100' ? 'Caisse' : 'Banque';
        let targetJournal = journaux?.find((j: any) => j.code === journalCode);
        if (!targetJournal) {
            try {
                const res = await api.post('compta/journaux/', { code: journalCode, nom: journalNom });
                targetJournal = res.data;
            } catch {
                alert(`Erreur: impossible de créer le journal '${journalCode}'.`);
                return;
            }
        }

        actions.createEcriture.mutate({
            date: formData.date,
            journal: targetJournal.id,
            reference: `PIECE_${Date.now().toString().slice(-6)}`,
            libelle: formData.libelle,
            lignes: [
                { compte: chargeCompte.id, debit: parseFloat(formData.montant), credit: 0, libelle_ligne: formData.libelle },
                { compte: tresoCompte.id,  debit: 0, credit: parseFloat(formData.montant), libelle_ligne: formData.libelle }
            ]
        });

        setFormData({ ...formData, libelle: '', montant: '' });
    };

    const chargeAccounts = comptes?.filter((c: any) => c.numero.startsWith('6'));

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <h3 className="text-2xl font-semibold text-primary mb-2">Saisie Simplifiée des Charges</h3>
                <p className="text-base-content/60 text-sm">Enregistrez vos dépenses courantes. Elles seront automatiquement intégrées au compte de résultat.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sélecteur visuel de catégories */}
                <div className="md:col-span-1 space-y-2">
                    <p className="text-xs font-medium text-base-content/50 uppercase tracking-wide mb-3">Catégorie de dépense</p>
                    {categoriesOHADA.map(cat => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setFormData({...formData, typeCharge: cat.compte})}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group
                                ${formData.typeCharge === cat.compte 
                                    ? 'border-indigo-500 bg-primary/10 shadow-sm' 
                                    : 'border-base-300 bg-base-100 hover:border-indigo-200 hover:bg-base-200'}`}
                        >
                            <span className="text-xl grayscale group-hover:grayscale-0 transition-all">{cat.icon}</span>
                            <span className={`font-medium text-sm ${formData.typeCharge === cat.compte ? 'text-primary' : 'text-base-content'}`}>
                                {cat.label}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Formulaire de détails */}
                <div className="md:col-span-2 card bg-base-100 p-6 rounded-xl border border-base-300 shadow-sm h-fit">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        
                        {formData.typeCharge === 'autre' && (
                            <div className="bg-warning/10 p-4 rounded-xl border border-warning/20 mb-4 animate-fade-in">
                                <label className="block text-xs font-medium text-warning uppercase tracking-wide mb-2">Sélectionnez le compte exact</label>
                                <select 
                                    className="select select-bordered w-full bg-base-100 border-warning/30 rounded-lg py-2 font-medium text-base-content"
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

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-medium text-base-content/60 uppercase tracking-wide mb-2">Moyen de Paiement</label>
                                <select 
                                    className="select select-bordered w-full bg-base-200 border-base-300 rounded-lg py-2.5 font-medium text-base-content focus:ring-primary"
                                    value={formData.modePaiement}
                                    onChange={(e) => setFormData({...formData, modePaiement: e.target.value})}
                                    required
                                >
                                    <option value="571100">💵 Espèces (Caisse)</option>
                                    <option value="521100">🏦 Virement / Chèque (Banque)</option>
                                </select>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-medium text-base-content/60 uppercase tracking-wide mb-2">{t('charges.date')}</label>
                                <input 
                                    type="date"
                                    className="input input-bordered w-full bg-base-200 border-base-300 rounded-lg py-2.5 px-3 font-medium text-base-content focus:ring-primary"
                                    value={formData.date}
                                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-base-content/60 uppercase tracking-wide mb-2">Motif (Libellé)</label>
                            <input 
                                type="text" 
                                placeholder="Ex: Paiement facture ENEO Avril..."
                                className="input input-bordered w-full bg-base-200 border-base-300 rounded-lg py-3 px-4 font-medium text-base-content focus:ring-primary"
                                value={formData.libelle}
                                onChange={(e) => setFormData({...formData, libelle: e.target.value})}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-base-content/60 uppercase tracking-wide mb-2">Montant (FCFA)</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    placeholder="0"
                                    className="input input-bordered w-full bg-base-200 border-base-300 rounded-lg py-4 px-4 text-2xl font-semibold text-primary focus:ring-primary pr-16 text-right"
                                    value={formData.montant}
                                    onChange={(e) => setFormData({...formData, montant: e.target.value})}
                                    required
                                />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-semibold text-lg text-base-content/50">FCFA</span>
                            </div>
                        </div>

                        <button 
                            type="submit"
                            className="inline-flex items-center justify-center w-full px-4 py-3 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-focus transition-colors shadow-sm py-3 rounded-lg font-medium text-sm transition-all hover:shadow-md"
                            disabled={actions.createEcriture.isPending || !formData.typeCharge}
                        >
                            {actions.createEcriture.isPending ? t('charges.saving') : "Enregistrer la dépense"}
                        </button>
                        
                        {!formData.typeCharge && (
                            <p className="text-center text-error text-xs font-medium mt-2">Veuillez sélectionner une catégorie de dépense à gauche.</p>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}
