import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Save, X, PlusCircle, Trash2, ArrowLeft, Package } from 'lucide-react';
import type { UseAvoirsDataReturn } from '../../hooks/useAvoirsData';
import { ProductSearch, type SearchResult } from '../common/ProductSearch';
import { useProductSearch as useProductSearchBase } from '../../hooks/product-search';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { cn } from '../../lib/utils';

interface AvoirsFormProps {
    data: UseAvoirsDataReturn;
}

export const AvoirsForm: React.FC<AvoirsFormProps> = ({ data }) => {
    const { t } = useTranslation(['stock', 'common']);

    const {
        viewMode,
        editingAvoirId,
        typeAvoir,
        setTypeAvoir,
        observations,
        setObservations,
        lignes,
        fournisseurSearch,
        setFournisseurSearch,
        filteredFournisseurs,
        isSearchingFournisseur,
        showFournisseurList,
        setShowFournisseurList,
        selectFournisseur,
        handleBackToList,
        handleSave,
        selectProduct,
        updateLine,
        removeLine,
        handleOpenLotModal,
        loading
    } = data;

    // Local Product Search hook from new architecture
    const {
        searchQuery: searchProduitQuery,
        setSearchQuery: setSearchProduitQuery,
        searchInputRef,
        handleKeyDown,
        getItemProps,
        resetSearch
    } = useProductSearchBase({
        modes: ['products']
    });

    const handleSelectProduct = (product: SearchResult) => {
        selectProduct(product as any);
        resetSearch();
        searchInputRef.current?.focus();
    };

    return (
        <form onSubmit={handleSave} className="min-h-screen bg-slate-50 p-4 md:p-6 space-y-6">
            
            {/* Header / Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 relative z-[50]">
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleBackToList}
                        className="size-9 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                    >
                        <ArrowLeft className="size-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">
                            {viewMode === 'EDIT' ? t('stock:avoirs.form.title_edit', { id: editingAvoirId }) : t('stock:avoirs.form.title_new')}
                        </h1>
                        <p className="text-sm text-slate-500">
                            {t('stock:avoirs.form.subtitle')}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleBackToList}
                        className="h-10"
                    >
                        {t('stock:avoirs.form.cancel')}
                    </Button>
                    <Button
                        type="submit"
                        className="h-10 gap-2 bg-emerald-600 hover:bg-emerald-700"
                        disabled={loading}
                        onClick={() => setShowFournisseurList(false)}
                    >
                        <Save className="size-4" />
                        {loading ? t('stock:avoirs.form.saving') : t('stock:avoirs.form.save_draft')}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Col: General Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
                        <h2 className="font-bold text-lg text-slate-800 border-b border-slate-100 pb-2">{t('stock:avoirs.form.general_info')}</h2>

                        {/* Fournisseur */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-slate-500 mb-1">
                                {t('stock:avoirs.form.fournisseur')} <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm font-medium text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
                                    placeholder={t('stock:avoirs.form.fournisseur_placeholder')}
                                    value={fournisseurSearch}
                                    onChange={(e) => {
                                        setFournisseurSearch(e.target.value);
                                        setShowFournisseurList(true);
                                    }}
                                    onFocus={() => setShowFournisseurList(true)}
                                />
                                {isSearchingFournisseur && (
                                    <span className="inline-block size-4 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                                )}
                            </div>

                            {showFournisseurList && filteredFournisseurs.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-[100] mt-1 bg-white rounded-xl shadow-lg border border-slate-200 max-h-60 overflow-y-auto w-full">
                                    {filteredFournisseurs.map(f => (
                                        <div
                                            key={f.id}
                                            className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors"
                                            onClick={() => selectFournisseur(f)}
                                        >
                                            <div className="font-medium text-sm text-slate-800">{f.name}</div>
                                            {f.address && <div className="text-xs text-slate-400 mt-0.5">{f.address}</div>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {showFournisseurList && fournisseurSearch && filteredFournisseurs.length === 0 && !isSearchingFournisseur && (
                                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 p-4 text-center text-sm text-slate-400">
                                    {t('stock:avoirs.form.no_fournisseur')}
                                </div>
                            )}

                            {/* Backdrop pour fermer la liste */}
                            {showFournisseurList && (
                                <div className="fixed inset-0 z-[45]" onClick={() => setShowFournisseurList(false)} />
                            )}
                        </div>

                        {/* Observations */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-slate-500 mb-1">
                                {t('stock:avoirs.form.observations_label')}
                            </label>
                            <textarea
                                className="w-full rounded-lg border border-slate-200 bg-white h-24 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all resize-none"
                                placeholder={t('stock:avoirs.form.observations_placeholder')}
                                value={observations}
                                onChange={(e) => setObservations(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Right Col: Products List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full">

                        {/* Search Product Bar - Using ProductSearch generic */}
                        <div className="p-4 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                            <ProductSearch
                                searchQuery={searchProduitQuery}
                                setSearchQuery={setSearchProduitQuery}
                                results={[]} // Results are fetched via API in the hook
                                loading={false}
                                modes={['products']}
                                onSelect={handleSelectProduct}
                                searchInputRef={searchInputRef}
                                handleKeyDown={handleKeyDown}
                                getItemProps={getItemProps}
                                placeholder={t('stock:avoirs.form.search_product_placeholder')}
                            />
                        </div>

                        {/* Empty State / Table */}
                        <div className="flex-1 p-0 overflow-x-auto">
                            {lignes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-4">
                                    <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center">
                                        <Package className="size-8" />
                                    </div>
                                    <p className="text-lg font-medium">{t('stock:avoirs.form.empty_lines')}</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm border-separate border-spacing-0">
                                    <thead className="bg-slate-100 sticky top-0 z-[5]">
                                        <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            <th className="py-3 px-4 text-left">{t('stock:avoirs.form.table_product')}</th>
                                            <th className="w-32 py-3 px-4 text-left">{t('stock:avoirs.form.table_lot')}</th>
                                            <th className="w-40 py-3 px-4 text-left">Motif</th>
                                            <th className="w-24 py-3 px-4 text-center">{t('stock:avoirs.form.table_qty')}</th>
                                            <th className="w-32 py-3 px-4 text-right">{t('stock:avoirs.form.table_price')}</th>
                                            <th className="w-32 py-3 px-4 text-right">{t('stock:avoirs.form.table_total')}</th>
                                            <th className="w-16 py-3 px-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lignes.map((ligne, index) => {
                                            const prod = typeof ligne.produit === 'object' ? ligne.produit : null;
                                            return (
                                                <tr key={index} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                                                    <td className="py-3 px-4">
                                                        <div className="font-semibold text-slate-800">{prod?.name || t('common:unknown_product', 'Produit Inconnu')}</div>
                                                        <div className="text-xs text-slate-400 font-mono mt-0.5">{prod?.cip1}</div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex flex-col gap-1">
                                                            <Badge variant="secondary" className="w-fit text-xs font-mono">
                                                                {ligne.lot || t('stock:avoirs.form.no_lot')}
                                                            </Badge>
                                                            <div className="text-xs text-slate-400">
                                                                {ligne.date_expiration ? ligne.date_expiration : t('stock:avoirs.form.no_date')}
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="link"
                                                                size="sm"
                                                                className="h-auto p-0 text-xs text-emerald-600 hover:text-emerald-700 w-fit mt-1"
                                                                onClick={() => handleOpenLotModal(index)}
                                                            >
                                                                {t('stock:avoirs.form.select_lot')}
                                                            </Button>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <input
                                                            type="text"
                                                            placeholder="Ex: lot endommagé..."
                                                            className="w-full rounded-lg border border-slate-200 bg-white h-8 px-3 text-sm text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
                                                            value={ligne.motif || ''}
                                                            onChange={(e) => updateLine(index, 'motif', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            className="w-full rounded-lg border border-slate-200 bg-white h-8 px-3 text-center text-sm font-semibold font-mono text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
                                                            value={ligne.quantity}
                                                            onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            className="w-full rounded-lg border border-slate-200 bg-white h-8 px-3 text-right text-sm font-mono text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
                                                            value={ligne.price}
                                                            onChange={(e) => updateLine(index, 'price', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-semibold text-emerald-600 font-mono">
                                                        {formatCurrency(Number(ligne.total || 0))}
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                            onClick={() => removeLine(index)}
                                                            title={t('common:remove')}
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Totals Footer */}
                        {lignes.length > 0 && (
                            <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 rounded-b-2xl">
                                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div className="text-sm font-medium text-slate-500">
                                        {t('stock:avoirs.form.items_count', { count: lignes.length, units: lignes.reduce((sum, l) => sum + Number(l.quantity), 0) })}
                                    </div>
                                    <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-xl shadow-sm border border-slate-200">
                                        <span className="text-slate-500 font-bold uppercase tracking-wider text-sm">{t('stock:avoirs.form.total_amount')}</span>
                                        <span className="text-2xl font-black text-emerald-600 font-mono tracking-tight">
                                            {formatCurrency(lignes.reduce((sum, ligne) => sum + Number(ligne.total || 0), 0))}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </form>
    );
};
