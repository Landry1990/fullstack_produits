import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
    PackageSearch, ShoppingBag, X, ChevronLeft, ChevronRight,
    TrendingUp, AlertTriangle, Package, Clock
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { useStockAnalysis } from '../hooks/useStockAnalysis';
import { StockAnalysisFilters } from './stock/StockAnalysisFilters';
import { StockAnalysisTable } from './stock/StockAnalysisTable';
import StockHealthDashboard from './stock/StockHealthDashboard';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from './shadcn/card';
import { Button } from './shadcn/button';
import { Badge } from './shadcn/badge';
import { Tabs, TabsList, TabsTrigger } from './shadcn/tabs';

const tabs = [
    { id: 'pilotage' as const, label: 'Pilotage', icon: TrendingUp },
    { id: 'unsold' as const, label: 'Invendus', icon: Clock },
    { id: 'overstock' as const, label: 'Surstock', icon: Package },
    { id: 'shortage' as const, label: 'Ruptures', icon: AlertTriangle },
];

const StockAnalysis = () => {
    const { t } = useTranslation(['stock', 'common']);
    const {
        activeTab,
        setActiveTab,
        fournisseurs,
        selectedFournisseur,
        setSelectedFournisseur,
        data,
        loading,
        error,
        selectedItems,
        unsoldDays,
        setUnsoldDays,
        page,
        setPage,
        actions
    } = useStockAnalysis();

    const currentTab = tabs.find(t => t.id === activeTab) || tabs[0];
    const TabIcon = currentTab.icon;

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
            <Toaster position="top-right" />

            <div className="max-w-[1600px] mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20">
                            <PackageSearch className="size-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                                {t('stock:analyse.title')}
                            </h1>
                            <p className="text-sm font-medium text-slate-500 mt-0.5">
                                {t('stock:analyse.subtitle')}
                            </p>
                        </div>
                    </div>

                    {activeTab !== 'pilotage' && data && !loading && (
                        <Badge variant="outline" className="self-start sm:self-auto text-xs">
                            {data.total_items} articles · {formatCurrency(Math.round(data.total_value))}
                        </Badge>
                    )}
                </div>

                {/* Navigation Tabs — shadcn */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                    <TabsList className="bg-white border border-slate-200 p-1 h-11 w-full sm:w-auto">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <TabsTrigger
                                    key={tab.id}
                                    value={tab.id}
                                    className="gap-2 px-4 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow"
                                >
                                    <Icon className="size-4" />
                                    <span className="hidden sm:inline">{t(`stock:analyse.tabs.${tab.id}`, tab.label)}</span>
                                    <span className="sm:hidden">{tab.label}</span>
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                </Tabs>

                {activeTab === 'pilotage' ? (
                    <StockHealthDashboard />
                ) : (
                    <div className="space-y-6">
                        {/* Filters Card */}
                        <Card>
                            <CardHeader className="pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        <TabIcon className="size-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">
                                            {t(`stock:analyse.tabs.${activeTab}`, currentTab.label)}
                                        </CardTitle>
                                        <CardDescription>
                                            Filtrer et analyser les articles de cette catégorie
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <StockAnalysisFilters
                                    activeTab={activeTab}
                                    fournisseurs={fournisseurs}
                                    selectedFournisseur={selectedFournisseur}
                                    onFournisseurChange={setSelectedFournisseur}
                                    unsoldDays={unsoldDays}
                                    onUnsoldDaysChange={setUnsoldDays}
                                    onRefresh={actions.fetchData}
                                    loading={loading}
                                />
                            </CardContent>
                        </Card>

                        {/* Stats Cards */}
                        {!loading && data && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <Card>
                                    <CardContent className="p-5 flex items-center gap-4">
                                        <div className="size-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                            <Package className="size-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                                Articles
                                            </p>
                                            <p className="text-2xl font-bold text-slate-900">{data.total_items}</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardContent className="p-5 flex items-center gap-4">
                                        <div className="size-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                                            <TrendingUp className="size-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                                {activeTab === 'unsold' ? 'Valeur invendus' :
                                                 activeTab === 'overstock' ? 'Valeur excédents' :
                                                 'Valeur totale'}
                                            </p>
                                            <p className="text-2xl font-bold text-red-600">
                                                {formatCurrency(Math.round(data.total_value))}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {activeTab === 'shortage' && (
                                    <Card>
                                        <CardContent className="p-5 flex items-center gap-4">
                                            <div className="size-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                                <AlertTriangle className="size-5" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                                    Alerts critiques
                                                </p>
                                                <p className="text-2xl font-bold text-amber-600">{data.critical_count ?? 0}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        )}

                        {/* Table Card */}
                        <Card className="overflow-hidden">
                            {error && (
                                <div className="m-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                                    <X className="size-5 shrink-0" />
                                    <span className="text-sm font-medium">{error}</span>
                                </div>
                            )}

                            <StockAnalysisTable
                                items={data?.items || []}
                                loading={loading}
                                activeTab={activeTab}
                                selectedItems={selectedItems}
                                onToggleSelect={actions.toggleSelectItem}
                                onToggleSelectAll={actions.toggleSelectAll}
                            />

                            {/* Pagination */}
                            {!loading && data && data.total_pages && data.total_pages > 1 && (
                                <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <p className="text-sm text-slate-500">
                                        Page <span className="font-semibold text-slate-900">{data.current_page}</span> sur <span className="font-semibold text-slate-900">{data.total_pages}</span>
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                        >
                                            <ChevronLeft className="size-4" />
                                        </Button>
                                        <span className="min-w-[3rem] text-center text-sm font-semibold text-slate-900">
                                            {page}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setPage((p) => Math.min(data.total_pages || 1, p + 1))}
                                            disabled={page === data.total_pages}
                                        >
                                            <ChevronRight className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>
                )}

                {/* Floating Action Bar */}
                {(activeTab === 'shortage' || activeTab === 'overstock') && selectedItems.size > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
                        <Card className="bg-slate-900 text-white border-slate-800 shadow-2xl">
                            <CardContent className="p-4 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-lg bg-emerald-600 flex items-center justify-center font-bold">
                                        {selectedItems.size}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">{t('stock:analyse.shortage.selected')}</p>
                                        <p className="text-xs text-slate-400">Prêts à être ajoutés à une commande</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={actions.handleGenerateOrder}
                                    >
                                        <ShoppingBag className="size-4" />
                                        {t('stock:analyse.shortage.generate_order')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-slate-400 hover:text-white hover:bg-white/10"
                                        onClick={() => actions.toggleSelectAll()}
                                    >
                                        <X className="size-5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StockAnalysis;
