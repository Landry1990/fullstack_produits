import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp } from '../../lib/motion';
import { useAccounting, type Compte, type Ecriture, type LigneEcriture, type Journal } from '../../hooks/useAccounting';
import api from '../../services/api';
import type { TFunction } from 'i18next';
import type { Locale } from 'date-fns';
import { 
    LayoutDashboard, 
    BookOpen, 
    Scale, 
    TrendingUp, 
    PlusCircle, 
    RefreshCcw,
    ChevronRight as _ChevronRight,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    Calendar,
    Settings,
    FileText,
    FileSpreadsheet,
    Percent,
    Building2,
    Zap,
    Users,
    Landmark,
    Wifi,
    Paperclip,
    Ellipsis,
    Banknote,
    Receipt,
    Check,
    History,
    Pencil,
    Lock,
    X,
    type LucideIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import PaginationControls from '../ui/PaginationControls';
import { PageContainer } from '../ui/PageContainer';
import { LocalizedDateInput } from '../LocalizedDateInput';
import i18n from '../../i18n';
import { formatCurrency as formatCurrencyValue, formatNumber as formatNumberValue } from '../../utils/formatters';

const comptaLocale = () => (i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR');
const formatFCFA = (amount: number) => formatCurrencyValue(amount, comptaLocale());
const formatAmount = (amount: number) => formatNumberValue(amount, 0, comptaLocale());

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
        rapportTva,
        ecritures, 
        ecrituresCount,
        ecrituresPage,
        setEcrituresPage,
        ecrituresSearch,
        setEcrituresSearch,
        ecrituresJournal: _ecrituresJournal,
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
        exportDocument,
        actions 
    } = useAccounting();

    // Onglet actif → type de document exporté
    const exportDocType = ({
        'dashboard': 'resultat',
        'grand-livre': 'grand_livre',
        'achats': 'ecritures',
        'charges': 'ecritures',
        'balance': 'balance',
        'bilan': 'bilan',
        'resultat': 'resultat',
        'tva': 'tva',
    } as Record<string, string>)[activeTab];

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
        { id: 'tva', label: t('tabs.tva'), icon: <Percent className="size-4" /> },
        { id: 'charges', label: t('tabs.charges'), icon: <PlusCircle className="size-4" /> },
        { id: 'immos', label: t('tabs.immos', 'Immobilisations'), icon: <FileText className="size-4" /> },
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
        <motion.div variants={staggerContainer} initial="hidden" animate="show">
        <PageContainer variant="dense" className="bg-slate-50 p-4 md:p-8 animate-fade-in">
            {/* Header */}
            <motion.div variants={fadeInUp} className="flex flex-col xl:flex-row xl:items-center justify-between mb-8 gap-6">
                <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-2 block">{t('ohada')}</span>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800 flex items-center gap-3">
                        {t('title')}
                        {isFetching && (
                            <RefreshCcw className="size-5 text-blue-500 animate-spin opacity-40" />
                        )}
                    </h1>
                    <p className="text-slate-500 mt-2 text-sm max-w-xl">{t('subtitle')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                    {/* Exercice Selector */}
                    <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
                        <Calendar className="size-4 text-blue-500" />
                        <select
                            className="bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 cursor-pointer"
                            aria-label={t('exercice.label')}
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
                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 px-3 py-2">
                        <LocalizedDateInput
                            className="bg-transparent border-none focus:ring-0 text-sm p-1 w-32 text-slate-700"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                            aria-label={t('common:from', 'Du')}
                        />
                        <div className="w-px h-4 bg-slate-300" aria-hidden="true"></div>
                        <LocalizedDateInput
                            className="bg-transparent border-none focus:ring-0 text-sm p-1 w-32 text-slate-700"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                            aria-label={t('common:to', 'Au')}
                        />
                    </div>

                    {/* Exports Excel / PDF du document de l'onglet actif */}
                    {exportDocType && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => exportDocument(exportDocType, 'excel')}
                                className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 text-sm font-medium hover:bg-emerald-100 transition-colors"
                                title={t('export.excel')}
                            >
                                <FileSpreadsheet className="size-4" />
                                Excel
                            </button>
                            <button
                                onClick={() => exportDocument(exportDocType, 'pdf')}
                                className="flex items-center gap-2 px-3 py-2 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 text-sm font-medium hover:bg-rose-100 transition-colors"
                                title={t('export.pdf')}
                            >
                                <FileText className="size-4" />
                                PDF
                            </button>
                            {['bilan', 'resultat'].includes(exportDocType) && (
                                <button
                                    onClick={() => exportDocument('liasse', 'excel')}
                                    className="flex items-center gap-2 px-3 py-2 bg-violet-50 text-violet-700 rounded-xl border border-violet-200 text-sm font-medium hover:bg-violet-100 transition-colors"
                                    title={t('export.liasse')}
                                >
                                    <FileSpreadsheet className="size-4" />
                                    Liasse
                                </button>
                            )}
                            {['ecritures', 'grand_livre'].includes(exportDocType) && (
                                <button
                                    onClick={() => exportDocument('fec', 'txt')}
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-200 text-sm font-medium hover:bg-blue-100 transition-colors"
                                    title={t('export.fec')}
                                >
                                    <FileText className="size-4" />
                                    FEC
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Navigation Tabs */}
            <motion.div variants={fadeInUp} className="flex overflow-x-auto hide-scrollbar gap-1 mb-8 p-1.5 rounded-2xl bg-white border border-slate-200 shadow-sm w-full lg:w-fit">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`group flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 font-bold text-sm
                            ${activeTab === tab.id 
                                ? 'bg-blue-600 text-white shadow-sm' 
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                    >
                        <span className={`transition-transform ${activeTab === tab.id ? 'scale-110' : ''}`}>
                            {tab.icon}
                        </span>
                        <span className="whitespace-nowrap">{tab.label}</span>
                    </button>
                ))}
            </motion.div>

            {/* Content Area */}
            {isLoading ? (
                <motion.div variants={fadeInUp} className="flex flex-col items-center justify-center py-20">
                    <span className="size-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-3"></span>
                    <p className="font-medium text-slate-400">{t('loading_msg')}</p>
                </motion.div>
            ) : (
                <motion.div variants={fadeInUp} className="space-y-6">
                    <Suspense fallback={
                        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                            <span className="size-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-2"></span>
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
                        {activeTab === 'tva' && <TvaTab rapport={rapportTva} t={t} />}
                        {activeTab === 'immos' && <ImmosTab t={t} />}
                        {activeTab === 'plan' && <PlanTab comptes={comptes} actions={actions} t={t} />}
                        {activeTab === 'charges' && <ChargesTab actions={actions} comptes={comptes} journaux={journaux} ecritures={ecritures} locale={currentLocale} t={t} />}
                    </Suspense>
                </motion.div>

            )}
        </PageContainer>
        </motion.div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface DashboardTabProps {
    resultat: { total_produits?: number; total_charges?: number; valeur_stock?: number; resultat_net?: number; marge_nette_pct?: number } | undefined;
    actions: ReturnType<typeof useAccounting>['actions'];
    t: TFunction<'accounting'>;
}

function DashboardTab({ resultat, actions, t }: DashboardTabProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 animate-fade-in">
            {/* KPI Card 1 - Revenue */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-4 border-t-emerald-500 shadow-sm">
                <p className="text-slate-400 text-caption font-bold uppercase tracking-wide mb-1 truncate">{t('dashboard.revenue')}</p>
                <h3 className="text-lg font-black text-emerald-600">{formatFCFA(resultat?.total_produits || 0)}</h3>
                <div className="mt-1 flex items-center gap-1 text-caption text-emerald-400">
                    <ArrowUpRight className="size-3" />
                    <span className="truncate">{t('kpi.revenue_label')}</span>
                </div>
            </div>

            {/* KPI Card 2 - Stock */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-4 border-t-emerald-500 shadow-sm">
                <p className="text-slate-400 text-caption font-bold uppercase tracking-wide mb-1 truncate">{t('kpi.stock_value_label')}</p>
                <h3 className="text-lg font-black text-emerald-600">{formatFCFA(resultat?.valeur_stock || 0)}</h3>
                <div className="mt-1 flex items-center gap-1 text-caption text-emerald-400">
                    <BookOpen className="size-3" />
                    <span className="truncate">{t('kpi.stock_variation_label')}</span>
                </div>
            </div>

            {/* KPI Card 3 - Expenses */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-4 border-t-emerald-500 shadow-sm">
                <p className="text-slate-400 text-caption font-bold uppercase tracking-wide mb-1 truncate">{t('dashboard.expenses')}</p>
                <h3 className="text-lg font-black text-emerald-600">{formatFCFA(resultat?.total_charges || 0)}</h3>
                <div className="mt-1 flex items-center gap-1 text-caption text-emerald-400">
                    <ArrowDownRight className="size-3" />
                    <span className="truncate">{t('kpi.expenses_label')}</span>
                </div>
            </div>

            {/* Performance Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-4 border-t-emerald-500 shadow-sm">
                <p className="text-caption text-slate-400 font-bold uppercase tracking-wide mb-2 truncate">{t('performance.title')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                        <p className="text-caption text-emerald-600 font-medium truncate">{t('performance.produits_label')}</p>
                        <p className="text-sm font-bold text-emerald-600">{formatFCFA(resultat?.total_produits || 0)}</p>
                    </div>
                    <div className="bg-red-50 p-2 rounded-lg border border-red-100">
                        <p className="text-caption text-red-500 font-medium truncate">{t('performance.charges_label')}</p>
                        <p className="text-sm font-bold text-red-500">{formatFCFA(resultat?.total_charges || 0)}</p>
                    </div>
                </div>
            </div>

            {/* Net Result Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-4 border-t-emerald-500 shadow-sm flex flex-col justify-between">
                <div>
                    <p className="text-slate-400 text-caption font-bold uppercase tracking-wide mb-1 truncate">{t('dashboard.net_result')}</p>
                    <h3 className="text-lg font-black text-emerald-600">
                        {formatFCFA(resultat?.resultat_net || 0)}
                    </h3>
                </div>
                <span className={`mt-1 px-2 py-0.5 rounded-full text-caption font-bold w-fit ${
                    resultat?.resultat_net >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>
                    {resultat?.resultat_net >= 0 ? t('dashboard.profit') : t('dashboard.loss')}
                </span>
            </div>

            {/* Closure Banner */}
            <div className="md:col-span-5 bg-gradient-to-r from-blue-600 to-indigo-600 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm text-center md:text-left">
                <div>
                    <h4 className="text-lg font-bold text-white">{t('dashboard.ready_title')}</h4>
                    <p className="text-white/80 text-sm">{t('dashboard.ready_subtitle')}</p>
                </div>

                <button
                    onClick={() => actions.initializeHistory.mutate()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={actions.initializeHistory.isPending}
                >
                    <RefreshCcw className={`size-4 ${actions.initializeHistory.isPending ? 'animate-spin' : ''}`} />
                    {actions.initializeHistory.isPending ? t('dashboard.init_loading') : t('dashboard.init_button')}
                </button>
            </div>
        </div>
    );
}

interface AchatsTabProps {
    ecritures: Ecriture[];
    count: number;
    page: number;
    setPage: (page: number | ((prev: number) => number)) => void;
    locale: Locale;
    t: TFunction<'accounting'>;
}

function AchatsTab({ ecritures, count, page, setPage, locale, t }: AchatsTabProps) {
    const itemsPerPage = 50;
    const totalPages = Math.ceil(count / itemsPerPage);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100">
                <h3 className="font-bold text-base text-slate-800">{t('achats.title')}</h3>
                <p className="text-xs text-slate-400 mt-1">{t('achats.subtitle')}</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-separate border-spacing-0">
                    <thead>
                        <tr className="bg-slate-50 text-label font-black uppercase tracking-widest text-slate-400">
                            <th className="px-4 py-3 border-b border-slate-200">{t('ledger.cols.date')}</th>
                            <th className="px-4 py-3 border-b border-slate-200">{t('ledger.cols.ref')}</th>
                            <th className="px-4 py-3 border-b border-slate-200">{t('ledger.cols.label')}</th>
                            <th className="px-4 py-3 border-b border-slate-200 text-right">{t('ledger.cols.debit')}</th>
                            <th className="px-4 py-3 border-b border-slate-200 text-right">{t('ledger.cols.credit')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {ecritures.map((e) => (
                            <React.Fragment key={e.id}>
                                <tr className="group hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 text-sm text-slate-400">{format(new Date(e.date), 'dd MMM yyyy', { locale })}</td>
                                    <td className="px-4 py-3 text-blue-600 font-medium text-sm">{e.reference}</td>
                                    <td className="px-4 py-3 text-sm text-slate-700">{e.libelle}</td>
                                    <td className="px-4 py-3 text-right text-blue-600 font-medium text-sm">{e.total_debit > 0 ? formatAmount(e.total_debit) : '-'}</td>
                                    <td className="px-4 py-3 text-right text-red-500 font-medium text-sm">{e.total_credit > 0 ? formatAmount(e.total_credit) : '-'}</td>
                                </tr>
                            </React.Fragment>
                        ))}
                        {ecritures.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                                    {t('achats.no_data')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white/50 dark:bg-slate-900/50">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                    {t('common:pagination_info', {
                        defaultValue: `Page ${page} sur ${totalPages} (${count} ${t('ledger.items_label', { defaultValue: 'achats' })})`,
                        page,
                        total: totalPages,
                        count,
                        label: t('ledger.items_label', { defaultValue: 'achats' })
                    })}
                </div>
                <PaginationControls
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                />
            </div>
        </div>
    );
}

interface GrandLivreTabProps {
    ecritures: Ecriture[];
    count: number;
    page: number;
    setPage: (page: number | ((prev: number) => number)) => void;
    search: string;
    setSearch: (search: string) => void;
    locale: Locale;
    t: TFunction<'accounting'>;
}

function GrandLivreTab({ ecritures, count, page, setPage, search, setSearch, locale, t }: GrandLivreTabProps) {
    const itemsPerPage = 50;
    const totalPages = Math.ceil(count / itemsPerPage);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-800">{t('ledger.title')}</h3>
                <div className="relative">
                    <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder={t('ledger.search_placeholder')}
                        aria-label={t('ledger.search_placeholder')}
                        className="h-9 bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all w-64"
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
                        <tr className="bg-slate-50 text-label font-black uppercase tracking-widest text-slate-400">
                            <th className="px-4 py-3 border-b border-slate-200">{t('ledger.cols.date')}</th>
                            <th className="px-4 py-3 border-b border-slate-200">{t('ledger.cols.journal')}</th>
                            <th className="px-4 py-3 border-b border-slate-200">{t('ledger.cols.ref')}</th>
                            <th className="px-4 py-3 border-b border-slate-200">{t('ledger.cols.label')}</th>
                            <th className="px-4 py-3 border-b border-slate-200 text-right">{t('ledger.cols.debit')}</th>
                            <th className="px-4 py-3 border-b border-slate-200 text-right">{t('ledger.cols.credit')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {ecritures.map((e) => (
                            <React.Fragment key={e.id}>
                                <tr className="group hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 text-sm text-slate-400">{format(new Date(e.date), 'dd MMM yyyy', { locale })}</td>
                                    <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">{e.journal_code}</span></td>
                                    <td className="px-4 py-3 text-blue-600 font-medium text-sm">{e.reference}</td>
                                    <td className="px-4 py-3 text-sm text-slate-700">{e.libelle}</td>
                                    <td className="px-4 py-3 text-right text-blue-600 font-medium text-sm">{e.total_debit > 0 ? formatAmount(e.total_debit) : '-'}</td>
                                    <td className="px-4 py-3 text-right text-red-500 font-medium text-sm">{e.total_credit > 0 ? formatAmount(e.total_credit) : '-'}</td>
                                </tr>
                                {e.lignes?.map((l: LigneEcriture) => (
                                    <tr key={l.id} className="text-xs text-slate-400 hover:text-slate-600 transition-colors bg-slate-50">
                                        <td colSpan={3}></td>
                                        <td className="px-4 py-2 pl-8 border-l-2 border-indigo-100 text-slate-600">
                                            {l.compte_numero} - {l.compte_libelle}
                                        </td>
                                        <td className="px-4 py-2 text-right font-medium text-slate-600">{l.debit > 0 ? formatAmount(l.debit) : ''}</td>
                                        <td className="px-4 py-2 text-right font-medium text-slate-600">{l.credit > 0 ? formatAmount(l.credit) : ''}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                        {ecritures.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-10 text-center text-slate-400 text-sm">
                                    {t('ledger.no_entry_found')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white/50 dark:bg-slate-900/50">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                    {t('common:pagination_info', {
                        defaultValue: `Page ${page} sur ${totalPages} (${count} ${t('ledger.items_label', { defaultValue: 'écritures' })})`,
                        page,
                        total: totalPages,
                        count,
                        label: t('ledger.items_label', { defaultValue: 'écritures' })
                    })}
                </div>
                <PaginationControls
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                />
            </div>
        </div>
    );
}

interface BalanceItem {
    numero: string;
    libelle: string;
    mouvement_debit: number;
    mouvement_credit: number;
    cloture_debit: number;
    cloture_credit: number;
}

interface BalanceTabProps {
    balance: BalanceItem[];
    t: TFunction<'accounting'>;
}

function BalanceTab({ balance, t }: BalanceTabProps) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-separate border-spacing-0">
                    <thead>
                        <tr className="bg-slate-50 text-label font-black uppercase tracking-widest text-slate-400">
                            <th className="px-4 py-3 border-b border-slate-200">{t('balance.cols.account')}</th>
                            <th className="px-4 py-3 border-b border-slate-200">{t('balance.cols.label')}</th>
                            <th className="px-4 py-3 border-b border-slate-200 text-right">{t('balance.cols.debit_mov')}</th>
                            <th className="px-4 py-3 border-b border-slate-200 text-right">{t('balance.cols.credit_mov')}</th>
                            <th className="px-4 py-3 border-b border-slate-200 text-right">{t('balance.cols.debit_sol')}</th>
                            <th className="px-4 py-3 border-b border-slate-200 text-right">{t('balance.cols.credit_sol')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {balance?.map((b) => (
                            <tr key={b.numero} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 font-mono text-blue-600 font-bold">{b.numero}</td>
                                <td className="px-4 py-3 text-sm text-slate-700">{b.libelle}</td>
                                <td className="px-4 py-3 text-right text-slate-400 text-sm">{formatAmount(b.mouvement_debit || 0)}</td>
                                <td className="px-4 py-3 text-right text-slate-400 text-sm">{formatAmount(b.mouvement_credit || 0)}</td>
                                <td className="px-4 py-3 text-right text-blue-600 font-medium text-sm">{b.cloture_debit > 0 ? formatAmount(b.cloture_debit) : '-'}</td>
                                <td className="px-4 py-3 text-right text-red-500 font-medium text-sm">{b.cloture_credit > 0 ? formatAmount(b.cloture_credit) : '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

interface BilanDetailItem {
    numero: string;
    libelle: string;
    solde: number;
}

interface BilanData {
    total_actif?: number;
    total_passif?: number;
    equilibre?: number;
    details_actif?: BilanDetailItem[];
    details_passif?: BilanDetailItem[];
}

interface BilanTabProps {
    bilan: BilanData | undefined;
    t: TFunction<'accounting'>;
}

function BilanTab({ bilan, t }: BilanTabProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-5 bg-blue-50 border-b border-blue-100">
                    <h3 className="text-base font-bold text-blue-700 flex items-center justify-between">
                        {t('bilan.actif')}
                        <span>{formatFCFA(bilan?.total_actif || 0)}</span>
                    </h3>
                </div>
                <div className="p-5 space-y-3">
                    {bilan?.details_actif?.map((d) => (
                        <div key={d.numero} className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div>
                                <span className="font-mono text-blue-300 text-xs block">{d.numero}</span>
                                <span className="font-medium text-sm text-slate-700">{d.libelle}</span>
                            </div>
                            <span className="font-bold text-blue-600">{formatFCFA(d.solde)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-5 bg-red-50 border-b border-red-100">
                    <h3 className="text-base font-bold text-red-600 flex items-center justify-between">
                        {t('bilan.passif')}
                        <span>{formatFCFA(bilan?.total_passif || 0)}</span>
                    </h3>
                </div>
                <div className="p-5 space-y-3">
                    {bilan?.details_passif?.map((d) => (
                        <div key={d.numero} className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div>
                                <span className="font-mono text-red-300 text-xs block">{d.numero}</span>
                                <span className="font-medium text-sm text-slate-700">{d.libelle}</span>
                            </div>
                            <span className="font-bold text-red-500">{formatFCFA(d.solde)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="md:col-span-2 bg-white p-5 rounded-2xl border-2 border-dashed border-slate-200 text-center">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-1">{t('bilan.equilibrium')}</p>
                <p className={`text-xl font-bold ${
                    bilan?.equilibre === 0 ? 'text-blue-600' : 'text-amber-500'
                }`}>
                    {t('bilan.difference')} : {formatFCFA(bilan?.equilibre || 0)}
                </p>
                <p className="text-xs text-slate-400 mt-2 italic">{t('bilan.note')}</p>
            </div>
        </div>
    );
}

const TYPE_STYLES: Record<string, string> = {
    PRODUIT: 'bg-blue-50 text-blue-700 border-blue-200',
    CHARGE:  'bg-red-50 text-red-600 border-red-200',
    ACTIF:   'bg-cyan-50 text-cyan-700 border-cyan-200',
    PASSIF:  'bg-amber-50 text-amber-600 border-amber-200',
};

const EMPTY_FORM = { numero: '', libelle: '', type: 'ACTIF' as const, is_active: true };

interface PlanTabProps {
    comptes: Compte[] | undefined;
    actions: ReturnType<typeof useAccounting>['actions'];
    t: TFunction<'accounting'>;
}

function PlanTab({ comptes, actions, t }: PlanTabProps) {
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Compte | null>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [confirmDelete, setConfirmDelete] = useState<Compte | null>(null);

    const openAdd = () => { setForm({ ...EMPTY_FORM }); setEditTarget(null); setModalOpen(true); };
    const openEdit = (c: Compte) => { setForm({ numero: c.numero, libelle: c.libelle, type: c.type, is_active: c.is_active }); setEditTarget(c); setModalOpen(true); };
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
        if (!confirmDelete) return;
        await actions.deleteCompte.mutateAsync(confirmDelete.id);
        setConfirmDelete(null);
    };

    const filtered = (comptes || []).filter((c) => {
        const q = search.toLowerCase();
        const matchSearch = !q || c.numero.includes(q) || c.libelle.toLowerCase().includes(q);
        const matchType = !filterType || c.type === filterType;
        return matchSearch && matchType;
    });

    const grouped: Record<string, Compte[]> = {};
    filtered.forEach((c) => {
        if (!grouped[c.type]) grouped[c.type] = [];
        grouped[c.type].push(c);
    });

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder={t('plan.search_placeholder')}
                        aria-label={t('plan.search_placeholder')}
                        className="h-9 w-full pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
                    aria-label={t('plan.filter_all_types')}
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                >
                    <option value="">{t('plan.filter_all_types')}</option>
                    <option value="ACTIF">{t('plan.filter_actif')}</option>
                    <option value="PASSIF">{t('plan.filter_passif')}</option>
                    <option value="CHARGE">{t('plan.filter_charge')}</option>
                    <option value="PRODUIT">{t('plan.filter_produit')}</option>
                </select>
                <button onClick={openAdd} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors shrink-0">
                    <PlusCircle className="size-4" /> {t('plan.new_account')}
                </button>
            </div>

            {/* Stats */}
            <div className="flex gap-3 flex-wrap text-xs text-slate-400">
                <span className="font-medium">{t('plan.accounts_count', { count: filtered.length })}</span>
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
                        <span className="ml-auto font-normal opacity-60">{t('plan.group_count', { count: items.length })}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {items.map((c) => (
                            <div key={c.id} className={`bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between group hover:shadow-sm transition-all ${!c.is_active ? 'opacity-50' : ''}`}>
                                <div className="min-w-0">
                                    <p className="font-mono text-base font-bold text-slate-800">{c.numero}</p>
                                    <p className="text-xs text-slate-400 truncate">{c.libelle}</p>
                                    {!c.is_active && <span className="text-caption text-red-500 font-bold">{t('plan.inactive')}</span>}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                                    <button
                                        onClick={() => openEdit(c)}
                                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                        title={t('plan.edit_title')}
                                        aria-label={t('plan.edit_title')}
                                    >
                                        <FileText className="size-3.5 text-blue-500" />
                                    </button>
                                    <button
                                        onClick={() => setConfirmDelete(c)}
                                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                        title={t('plan.delete_title')}
                                        aria-label={t('plan.delete_title')}
                                    >
                                        <ArrowDownRight className="size-3.5 text-red-500" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {filtered.length === 0 && (
                <div className="flex flex-col items-center py-16 text-slate-300">
                    <Settings className="size-10 mb-3" />
                    <p className="font-bold text-slate-400">{t('plan.no_account_found')}</p>
                </div>
            )}

            {/* Modal ajout / modification */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 max-h-[92vh] overflow-y-auto"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="plan-modal-title"
                    >
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 id="plan-modal-title" className="font-bold text-slate-800">
                                {editTarget ? t('plan.modal.edit') : t('plan.modal.new')}
                            </h3>
                            <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors" aria-label={t('common:close')}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            <div>
                                <label htmlFor="plan-numero" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{t('plan.modal.number_label')}</label>
                                <input
                                    id="plan-numero"
                                    type="text"
                                    className="h-10 w-full px-3 rounded-xl border border-slate-200 font-mono text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:bg-slate-50 disabled:text-slate-400"
                                    placeholder={t('plan.modal.number_placeholder')}
                                    value={form.numero}
                                    onChange={e => setForm({ ...form, numero: e.target.value })}
                                    required
                                    disabled={!!editTarget}
                                />
                                {editTarget && <p className="text-caption text-slate-400 mt-1">{t('plan.modal.number_locked')}</p>}
                            </div>
                            <div>
                                <label htmlFor="plan-libelle" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{t('plan.modal.label_label')}</label>
                                <input
                                    id="plan-libelle"
                                    type="text"
                                    className="h-10 w-full px-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                    placeholder={t('plan.modal.label_placeholder')}
                                    value={form.libelle}
                                    onChange={e => setForm({ ...form, libelle: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="plan-type" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{t('plan.modal.type_label')}</label>
                                <select
                                    id="plan-type"
                                    className="h-10 w-full px-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
                                    value={form.type}
                                    onChange={e => setForm({ ...form, type: e.target.value as Compte['type'] })}
                                    required
                                >
                                    <option value="ACTIF">{t('plan.filter_actif')}</option>
                                    <option value="PASSIF">{t('plan.filter_passif')}</option>
                                    <option value="CHARGE">{t('plan.filter_charge')}</option>
                                    <option value="PRODUIT">{t('plan.filter_produit')}</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    className="size-4 rounded border-slate-300 text-blue-600 accent-blue-600 cursor-pointer"
                                    checked={form.is_active}
                                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                                />
                                <label htmlFor="is_active" className="text-sm font-medium text-slate-700 cursor-pointer">{t('plan.modal.active_label')}</label>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={closeModal} className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors">{t('plan.modal.cancel')}</button>
                                <button
                                    type="submit"
                                    className="flex-1 h-10 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                    disabled={actions.createCompte?.isPending || actions.updateCompte?.isPending}
                                >
                                    {(actions.createCompte?.isPending || actions.updateCompte?.isPending)
                                        ? <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                                        : editTarget ? t('plan.modal.save') : t('plan.modal.create')
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
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-red-200 p-6 text-center space-y-4 max-h-[92vh] overflow-y-auto"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="plan-delete-title"
                    >
                        <div className="size-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                            <ArrowDownRight className="size-6 text-red-500" aria-hidden="true" />
                        </div>
                        <div>
                            <p id="plan-delete-title" className="font-bold text-slate-800">{t('plan.delete.title')}</p>
                            <p className="text-sm text-slate-500 mt-1">
                                <span className="font-mono font-bold">{confirmDelete.numero}</span> — {confirmDelete.libelle}
                            </p>
                            <p className="text-xs text-red-500 mt-2">{t('plan.delete.warning')}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmDelete(null)} className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors">{t('plan.delete.cancel')}</button>
                            <button
                                onClick={handleDelete}
                                className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition-colors"
                                disabled={actions.deleteCompte?.isPending}
                            >
                                {actions.deleteCompte?.isPending
                                    ? <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                                    : t('plan.delete.confirm')
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

interface ResultatDetailItem {
    compte__numero: string;
    compte__libelle: string;
    montant: number;
}

interface ResultatData {
    total_produits?: number;
    total_charges?: number;
    resultat_net?: number;
    details_produits?: ResultatDetailItem[];
    details_charges?: ResultatDetailItem[];
}

interface ResultatTabProps {
    resultat: ResultatData | undefined;
    t: TFunction<'accounting'>;
}

function ResultatTab({ resultat, t }: ResultatTabProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden border-t-4 border-t-blue-500 shadow-sm">
                <div className="p-5 bg-blue-50">
                    <h3 className="text-base font-bold text-blue-700 flex items-center justify-between">
                        {t('resultat.products')}
                        <span>{formatFCFA(resultat?.total_produits || 0)}</span>
                    </h3>
                </div>
                <div className="p-5 space-y-3">
                    {resultat?.details_produits?.map((d) => (
                        <div key={d.compte__numero} className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-blue-300 text-xs">{d.compte__numero}</span>
                                <span className="font-medium text-sm text-slate-700">{d.compte__libelle}</span>
                            </div>
                            <span className="font-bold text-blue-600">{formatFCFA(d.montant)}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden border-t-4 border-t-red-500 shadow-sm">
                <div className="p-5 bg-red-50">
                    <h3 className="text-base font-bold text-red-600 flex items-center justify-between">
                        {t('resultat.charges')}
                        <span>{formatFCFA(resultat?.total_charges || 0)}</span>
                    </h3>
                </div>
                <div className="p-5 space-y-3">
                    {resultat?.details_charges?.map((d) => (
                        <div key={d.compte__numero} className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-red-300 text-xs">{d.compte__numero}</span>
                                <span className="font-medium text-sm text-slate-700">{d.compte__libelle}</span>
                            </div>
                            <span className="font-bold text-red-500">{formatFCFA(d.montant)}</span>
                        </div>
                    ))}
                    {(!resultat?.details_charges || resultat.details_charges.length === 0) && (
                        <p className="text-center text-slate-400 italic py-10 font-medium">{t('resultat.no_charges')}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

interface OhadaCategory {
    id: string;
    compte: string;
    label: string;
    icon: LucideIcon;
}

const categoriesOHADA: OhadaCategory[] = [
    { id: 'loyer', compte: '613000', label: 'Loyer (Bail)', icon: Building2 },
    { id: 'energie', compte: '605000', label: 'Eau & Électricité (ENEO/CAMWATER)', icon: Zap },
    { id: 'salaires', compte: '660000', label: 'Salaires du personnel', icon: Users },
    { id: 'impots', compte: '640000', label: 'Impôts et Taxes', icon: Receipt },
    { id: 'internet', compte: '622000', label: 'Internet & Téléphone', icon: Wifi },
    { id: 'fournitures', compte: '604000', label: 'Fournitures de bureau', icon: Paperclip },
    { id: 'autre', compte: 'autre', label: 'Autre charge...', icon: Ellipsis },
];

const MODES_PAIEMENT = [
    { compte: '571100', journal: 'CA', icon: Banknote, labelKey: 'charges_simple.payment_cash' },
    { compte: '521100', journal: 'BQ', icon: Landmark, labelKey: 'charges_simple.payment_bank' },
] as const;

interface ChargesTabProps {
    actions: ReturnType<typeof useAccounting>['actions'];
    comptes: Compte[] | undefined;
    journaux: Journal[] | undefined;
    ecritures: Ecriture[] | undefined;
    locale: Locale;
    t: TFunction<'accounting'>;
}

function ChargesTab({ actions, comptes, journaux, ecritures, locale, t }: ChargesTabProps) {
    const emptyForm = {
        typeCharge: '',
        comptePersonnalise: '',
        modePaiement: '571100', // Default Caisse
        libelle: '',
        montant: '',
        date: new Date().toISOString().split('T')[0]
    };
    const [formData, setFormData] = useState(emptyForm);
    const [editingId, setEditingId] = useState<number | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const targetCompteNumero = formData.typeCharge === 'autre' ? formData.comptePersonnalise : formData.typeCharge;

        // Résolution du compte de charge — création automatique si absent
        const catInfo = categoriesOHADA.find(c => c.compte === targetCompteNumero);
        let chargeCompte = comptes?.find((c) => c.numero === targetCompteNumero);
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
            gooeyToast.error(t('charges_simple.account_not_found'));
            return;
        }

        // Résolution du compte de trésorerie — création automatique si absent
        const tresoMeta = formData.modePaiement === '571100'
            ? { libelle: t('charges_simple.cash_account'), type: 'ACTIF' as const }
            : { libelle: t('charges_simple.bank_account'), type: 'ACTIF' as const };
        let tresoCompte = comptes?.find((c) => c.numero === formData.modePaiement);
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
        const journalNom  = formData.modePaiement === '571100' ? t('charges_simple.cash_account') : t('charges_simple.bank_account');
        let targetJournal = journaux?.find((j) => j.code === journalCode);
        if (!targetJournal) {
            try {
                const res = await api.post('compta/journaux/', { code: journalCode, nom: journalNom });
                targetJournal = res.data;
            } catch {
                gooeyToast.error(t('charges_simple.journal_error', { journalCode }));
                return;
            }
        }

        if (!tresoCompte || !targetJournal) {
            gooeyToast.error(t('charges_simple.account_not_found'));
            return;
        }

        const lignes = [
            { compte: chargeCompte.id, debit: parseFloat(formData.montant), credit: 0, libelle_ligne: formData.libelle },
            { compte: tresoCompte.id,  debit: 0, credit: parseFloat(formData.montant), libelle_ligne: formData.libelle }
        ];
        if (editingId !== null) {
            actions.updateEcriture.mutate({
                id: editingId,
                date: formData.date,
                journal: targetJournal.id,
                libelle: formData.libelle,
                lignes,
            });
            setEditingId(null);
            setFormData({ ...formData, libelle: '', montant: '' });
        } else {
            actions.createEcriture.mutate({
                date: formData.date,
                journal: targetJournal.id,
                reference: `PIECE_${Date.now().toString().slice(-6)}`,
                libelle: formData.libelle,
                lignes,
            });
            setFormData({ ...formData, libelle: '', montant: '' });
        }
    };

    // Charge une écriture existante dans le formulaire pour modification
    const startEdit = (ecriture: Ecriture) => {
        const chargeLigne = ecriture.lignes.find(l => (l.compte_numero || '').startsWith('6') && l.debit > 0);
        const tresoLigne = ecriture.lignes.find(l => l.credit > 0);
        if (!chargeLigne) return;
        const compteNum = chargeLigne.compte_numero || '';
        const isCategory = categoriesOHADA.some(c => c.compte === compteNum);
        setEditingId(ecriture.id);
        setFormData({
            typeCharge: isCategory ? compteNum : 'autre',
            comptePersonnalise: isCategory ? '' : compteNum,
            modePaiement: tresoLigne?.compte_numero === '521100' ? '521100' : '571100',
            libelle: ecriture.libelle,
            montant: String(chargeLigne.debit),
            date: ecriture.date,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormData(emptyForm);
    };

    const chargeAccounts = comptes?.filter((c) => c.numero.startsWith('6'));
    const selectedCategory = categoriesOHADA.find(c => c.compte === formData.typeCharge);

    // Récap comptable de l'écriture qui sera créée
    const compteDebit = formData.typeCharge === 'autre'
        ? formData.comptePersonnalise
        : formData.typeCharge;
    const compteDebitLibelle = formData.typeCharge === 'autre'
        ? chargeAccounts?.find(c => c.numero === formData.comptePersonnalise)?.libelle
        : selectedCategory ? t(`ohada_categories.${selectedCategory.id}`, { defaultValue: selectedCategory.label }) : '';
    const modeInfo = MODES_PAIEMENT.find(m => m.compte === formData.modePaiement)!;

    // Dernières écritures de charge (débit sur un compte 6x), 6 max.
    const recentCharges = (ecritures || [])
        .map(e => ({
            ecriture: e,
            ligne: e.lignes.find(l => (l.compte_numero || '').startsWith('6') && l.debit > 0),
        }))
        .filter((x): x is { ecriture: Ecriture; ligne: LigneEcriture } => Boolean(x.ligne))
        .slice(0, 6);

    return (
        <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-blue-600 mb-2">{t('charges_simple.title')}</h3>
                <p className="text-slate-400 text-sm">{t('charges_simple.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sélecteur visuel de catégories */}
                <div className="lg:col-span-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">{t('charges_simple.category')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                    {categoriesOHADA.map(cat => {
                        const isSelected = formData.typeCharge === cat.compte;
                        const CatIcon = cat.icon;
                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setFormData({...formData, typeCharge: cat.compte})}
                                aria-pressed={isSelected}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors duration-200 text-left cursor-pointer
                                    ${isSelected
                                        ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500/30'
                                        : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'}`}
                            >
                                <span className={`size-9 rounded-lg flex items-center justify-center shrink-0 transition-colors
                                    ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    <CatIcon className="size-4" />
                                </span>
                                <span className={`flex-1 min-w-0 font-medium text-sm leading-tight ${
                                    isSelected ? 'text-blue-700' : 'text-slate-700'
                                }`}>
                                    {t(`ohada_categories.${cat.id}`, { defaultValue: cat.label })}
                                </span>
                                {isSelected && <Check className="size-4 text-blue-600 shrink-0" />}
                            </button>
                        );
                    })}
                    </div>
                </div>

                {/* Formulaire de détails */}
                <div className={`lg:col-span-2 bg-white p-6 rounded-2xl border shadow-sm h-fit transition-colors ${editingId !== null ? 'border-amber-300 ring-1 ring-amber-300/40' : 'border-slate-200'}`}>
                    {editingId !== null && (
                        <div className="flex items-center justify-between gap-3 mb-5 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 animate-fade-in">
                            <p className="text-sm font-medium text-amber-700 flex items-center gap-2">
                                <Pencil className="size-4" />
                                {t('charges_simple.editing_banner')}
                            </p>
                            <button
                                type="button"
                                onClick={cancelEdit}
                                className="text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-lg p-1 transition-colors cursor-pointer"
                                title={t('charges_simple.cancel_edit')}
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-5">

                        {formData.typeCharge === 'autre' && (
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 animate-fade-in">
                                <label htmlFor="charge-account-select" className="block text-xs font-bold text-amber-600 uppercase tracking-wide mb-2">{t('charges_simple.select_account')}</label>
                                <select
                                    id="charge-account-select"
                                    className="h-10 w-full px-3 rounded-xl border border-amber-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all appearance-none cursor-pointer"
                                    value={formData.comptePersonnalise}
                                    onChange={(e) => setFormData({...formData, comptePersonnalise: e.target.value})}
                                    required
                                >
                                    <option value="">{t('charges_simple.select_account_placeholder')}</option>
                                    {chargeAccounts?.map((c) => (
                                        <option key={c.numero} value={c.numero}>{c.numero} - {c.libelle}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <fieldset className="col-span-2 md:col-span-1">
                                <legend className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{t('charges_simple.payment_method')}</legend>
                                <div className="grid grid-cols-2 gap-2" role="radiogroup">
                                    {MODES_PAIEMENT.map(mode => {
                                        const isSelected = formData.modePaiement === mode.compte;
                                        const ModeIcon = mode.icon;
                                        return (
                                            <button
                                                key={mode.compte}
                                                type="button"
                                                role="radio"
                                                aria-checked={isSelected}
                                                onClick={() => setFormData({...formData, modePaiement: mode.compte})}
                                                className={`flex items-center justify-center gap-2 h-10 px-3 rounded-xl border text-sm font-medium whitespace-nowrap transition-colors duration-200 cursor-pointer
                                                    ${isSelected
                                                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500/30'
                                                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-slate-50'}`}
                                            >
                                                <ModeIcon className="size-4" />
                                                {t(mode.labelKey)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </fieldset>
                            <div className="col-span-2 md:col-span-1">
                                <label htmlFor="charge-date" className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{t('charges.date')}</label>
                                <LocalizedDateInput
                                    id="charge-date"
                                    className="h-10 w-full px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                    value={formData.date}
                                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="charge-label" className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{t('charges_simple.label')}</label>
                            <input
                                id="charge-label"
                                type="text"
                                placeholder={t('charges_simple.label_placeholder')}
                                className="h-10 w-full px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                value={formData.libelle}
                                onChange={(e) => setFormData({...formData, libelle: e.target.value})}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="charge-amount" className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{t('charges_simple.amount')}</label>
                            <div className="relative">
                                <input
                                    id="charge-amount"
                                    type="number"
                                    min="0"
                                    placeholder={t('charges_simple.amount_placeholder')}
                                    className="w-full px-4 py-4 pr-16 rounded-xl border border-slate-200 bg-white text-2xl font-bold text-blue-600 text-right focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                    value={formData.montant}
                                    onChange={(e) => setFormData({...formData, montant: e.target.value})}
                                    required
                                />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">{t('charges_simple.currency')}</span>
                            </div>
                        </div>

                        {/* Récap de l'écriture qui sera créée */}
                        {compteDebit && (
                            <div className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-500 animate-fade-in">
                                <span className="truncate">
                                    <span className="font-bold text-slate-600">{t('charges_simple.recap_debit')}</span>{' '}
                                    <span className="font-mono">{compteDebit}</span>{' '}
                                    <span className="truncate">{compteDebitLibelle}</span>
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="truncate">
                                    <span className="font-bold text-slate-600">{t('charges_simple.recap_credit')}</span>{' '}
                                    <span className="font-mono">{modeInfo.compte}</span>{' '}
                                    {t(`charges_simple.${formData.modePaiement === '571100' ? 'cash_account' : 'bank_account'}`)}
                                </span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className={`inline-flex items-center justify-center w-full h-11 px-4 text-white rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer ${editingId !== null ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                            disabled={actions.createEcriture.isPending || actions.updateEcriture.isPending || !formData.typeCharge}
                        >
                            {(actions.createEcriture.isPending || actions.updateEcriture.isPending)
                                ? t('charges.saving')
                                : editingId !== null ? t('charges_simple.update') : t('charges_simple.submit')}
                        </button>

                        {!formData.typeCharge && (
                            <p className="text-center text-red-500 text-xs font-medium mt-2">{t('charges_simple.select_category_warning')}</p>
                        )}
                    </form>
                </div>
            </div>

            {/* Dernières charges enregistrées */}
            <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
                    <History className="size-4 text-slate-400" />
                    <h4 className="text-sm font-bold text-slate-700">{t('charges_simple.recent')}</h4>
                </div>
                {recentCharges.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-slate-400 italic">{t('charges_simple.recent_empty')}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-bold">
                                    <th className="text-left px-5 py-2.5">{t('charges.date')}</th>
                                    <th className="text-left px-5 py-2.5">{t('charges_simple.label')}</th>
                                    <th className="text-left px-5 py-2.5">{t('charges_simple.col_account')}</th>
                                    <th className="text-left px-5 py-2.5">{t('charges_simple.col_journal')}</th>
                                    <th className="text-right px-5 py-2.5">{t('charges.amount')}</th>
                                    <th className="text-right px-5 py-2.5"><span className="sr-only">{t('charges_simple.edit_title')}</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentCharges.map(({ ecriture, ligne }) => (
                                    <tr key={ecriture.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-2.5 whitespace-nowrap text-slate-500">
                                            {format(new Date(ecriture.date), 'dd MMM yyyy', { locale })}
                                        </td>
                                        <td className="px-5 py-2.5 text-slate-700 font-medium max-w-56 truncate">{ecriture.libelle}</td>
                                        <td className="px-5 py-2.5 whitespace-nowrap">
                                            <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{ligne.compte_numero}</span>
                                        </td>
                                        <td className="px-5 py-2.5 whitespace-nowrap">
                                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{ecriture.journal_code}</span>
                                        </td>
                                        <td className="px-5 py-2.5 text-right font-bold text-red-500 whitespace-nowrap">{formatFCFA(ligne.debit)}</td>
                                        <td className="px-5 py-2.5 text-right">
                                            {ecriture.est_liee ? (
                                                <span
                                                    className="inline-flex items-center justify-center size-7 rounded-lg text-slate-300"
                                                    title={t('charges_simple.locked_title')}
                                                >
                                                    <Lock className="size-3.5" />
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => startEdit(ecriture)}
                                                    className="inline-flex items-center justify-center size-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                                    title={t('charges_simple.edit_title')}
                                                >
                                                    <Pencil className="size-3.5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

interface TvaLigne {
    mois: string;
    tva_collectee: number;
    tva_deductible: number;
    tva_nette: number;
}

interface RapportTva {
    details: TvaLigne[];
    total_tva_collectee: number;
    total_tva_deductible: number;
    tva_nette_a_payer: number;
    note: string;
}

function TvaTab({ rapport, t }: { rapport?: RapportTva; t: TFunction }) {
    const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
    if (!rapport || rapport.details.length === 0) {
        return <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-sm">{t('tva.empty')}</div>;
    }
    const net = rapport.tva_nette_a_payer;
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="text-xs font-bold uppercase text-slate-400">{t('tva.collectee')}</div>
                    <div className="text-xl font-black text-slate-800">{fmt(rapport.total_tva_collectee)} F</div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="text-xs font-bold uppercase text-slate-400">{t('tva.deductible')}</div>
                    <div className="text-xl font-black text-slate-800">{fmt(rapport.total_tva_deductible)} F</div>
                </div>
                <div className={`rounded-2xl border p-4 ${net >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className={`text-xs font-bold uppercase ${net >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{t('tva.net')}</div>
                    <div className={`text-xl font-black ${net >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{fmt(Math.abs(net))} F</div>
                </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-bold">
                            <th className="text-left px-4 py-2.5">{t('tva.month')}</th>
                            <th className="text-right px-4 py-2.5">{t('tva.collectee')}</th>
                            <th className="text-right px-4 py-2.5">{t('tva.deductible')}</th>
                            <th className="text-right px-4 py-2.5">{t('tva.net')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rapport.details.map((l) => (
                            <tr key={l.mois} className="border-t border-slate-100">
                                <td className="px-4 py-2.5 font-semibold text-slate-700">{l.mois}</td>
                                <td className="px-4 py-2.5 text-right text-slate-700">{fmt(l.tva_collectee)}</td>
                                <td className="px-4 py-2.5 text-right text-slate-700">{fmt(l.tva_deductible)}</td>
                                <td className={`px-4 py-2.5 text-right font-bold ${l.tva_nette >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{fmt(l.tva_nette)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-slate-400 italic">{t('tva.note')}</p>
        </div>
    );
}

// ── Onglet Immobilisations (amortissements) ──────────────────

interface Immo {
    id: number;
    nom: string;
    compte_immo_numero: string;
    date_acquisition: string;
    valeur_acquisition: number;
    duree_annees: number;
    dotation_annuelle: number;
    cumul_amortissements: number;
    valeur_nette_comptable: number;
    dotations: { id: number; annee: number; montant: number }[];
    mode_paiement: string;
}

function ImmosTab({ t }: { t: TFunction }) {
    const [immos, setImmos] = useState<Immo[]>([]);
    const [annee] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('compta/immobilisations/');
            setImmos(res.data.results || res.data);
        } catch {
            gooeyToast.error(t('immos.load_error', 'Chargement impossible'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { load(); }, [load]);

    const doter = async (immo: Immo) => {
        try {
            await api.post(`compta/immobilisations/${immo.id}/generer_dotation/`, { annee });
            gooeyToast.success(t('immos.dotation_ok', 'Dotation générée'));
            load();
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
            gooeyToast.error(msg || t('immos.dotation_error', 'Dotation impossible'));
        }
    };

    const doterTout = async () => {
        try {
            const res = await api.post('compta/immobilisations/generer_dotations_annee/', { annee });
            gooeyToast.success(t('immos.dotation_all_ok', 'Dotations générées : {{n}}', { n: res.data.generees?.length || 0 }));
            load();
        } catch {
            gooeyToast.error(t('immos.dotation_error', 'Dotation impossible'));
        }
    };

    if (loading) return <div className="py-16 text-center text-slate-400">{t('loading_msg')}</div>;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800">{t('immos.title', 'Immobilisations')} — {annee}</h3>
                <button onClick={doterTout}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                    {t('immos.doter_tout', 'Doter tout')}
                </button>
            </div>
            <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                        <th className="px-4 py-2.5 text-left">{t('immos.nom', 'Nom')}</th>
                        <th className="px-4 py-2.5 text-left">{t('immos.compte', 'Compte')}</th>
                        <th className="px-4 py-2.5 text-left">{t('immos.acquisition', 'Acquisition')}</th>
                        <th className="px-4 py-2.5 text-right">{t('immos.valeur', 'Valeur')}</th>
                        <th className="px-4 py-2.5 text-right">{t('immos.dotation', 'Dot./an')}</th>
                        <th className="px-4 py-2.5 text-right">{t('immos.cumul', 'Amorti')}</th>
                        <th className="px-4 py-2.5 text-right">{t('immos.vnc', 'VNC')}</th>
                        <th className="px-4 py-2.5"></th>
                    </tr>
                </thead>
                <tbody>
                    {immos.length === 0 && (
                        <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">{t('immos.empty', 'Aucune immobilisation')}</td></tr>
                    )}
                    {immos.map(im => (
                        <tr key={im.id} className="border-t border-slate-100">
                            <td className="px-4 py-2.5 font-medium text-slate-700">{im.nom}</td>
                            <td className="px-4 py-2.5 text-slate-500">{im.compte_immo_numero}</td>
                            <td className="px-4 py-2.5 text-slate-500">{im.date_acquisition}</td>
                            <td className="px-4 py-2.5 text-right">{formatFCFA(im.valeur_acquisition)}</td>
                            <td className="px-4 py-2.5 text-right text-slate-600">{formatFCFA(im.dotation_annuelle)}</td>
                            <td className="px-4 py-2.5 text-right text-slate-600">{formatFCFA(im.cumul_amortissements)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{formatFCFA(im.valeur_nette_comptable)}</td>
                            <td className="px-4 py-2.5 text-right">
                                <button onClick={() => doter(im)}
                                    disabled={im.dotations.some(d => d.annee === annee)}
                                    className="px-2.5 py-1 text-xs font-medium rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed">
                                    {im.dotations.some(d => d.annee === annee) ? t('immos.dote', 'Dotée') : t('immos.doter', 'Doter')}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
