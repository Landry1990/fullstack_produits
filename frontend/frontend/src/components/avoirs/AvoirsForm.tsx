import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Save, X, PlusCircle, Trash2, ArrowLeft } from 'lucide-react';
import type { UseAvoirsDataReturn } from '../../hooks/useAvoirsData';
import { useSearchNavigation } from '../../hooks/useSearchNavigation';
import { useProductSearch } from '../../hooks/useProductSearch';
import { formatCurrency } from '../../utils/formatters';

interface AvoirsFormProps {
    data: UseAvoirsDataReturn;
}

export const AvoirsForm: React.FC<AvoirsFormProps> = ({ data }) => {
    const { t } = useTranslation(['stock', 'common']);
    const searchInputRef = useRef<HTMLInputElement>(null);

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

    // Local Product Search hook
    const { 
        produits: produitsList, 
        searchQuery: searchProduitQuery,
        setSearchQuery: setSearchProduitQuery
    } = useProductSearch({ minSearchLength: 2, debounceMs: 200 });

    const handleSelectProduct = (product: any) => {
        selectProduct(product);
        setSearchProduitQuery('');
        searchInputRef.current?.focus();
    };

    const { getItemProps, handleKeyDown: hookHandleKeyDown } = useSearchNavigation(
        produitsList,
        handleSelectProduct,
        { resetOnSelect: true }
    );

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
            hookHandleKeyDown(e);
        }
    };

    return (
        <form onSubmit={handleSave} className="min-h-screen bg-gray-100 p-4 md:p-6 space-y-6">
            
            {/* Header / Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200 relative z-[60]">
                <div className="flex items-center gap-3">
                    <button 
                        type="button" 
                        onClick={handleBackToList}
                        className="inline-flex items-center justify-center size-8 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                        <ArrowLeft className="size-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold">
                            {viewMode === 'EDIT' ? t('stock:avoirs.form.title_edit', { id: editingAvoirId }) : t('stock:avoirs.form.title_new')}
                        </h1>
                        <p className="text-sm text-gray-500">
                            {t('stock:avoirs.form.subtitle')}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button type="button" className="inline-flex items-center justify-center h-9 px-3 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors" onClick={handleBackToList}>
                        {t('stock:avoirs.form.cancel')}
                    </button>
                    <button type="submit" className="inline-flex items-center justify-center h-9 px-4 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm" disabled={loading}>
                        <Save className="size-4 mr-2" />
                        {loading ? t('stock:avoirs.form.saving') : t('stock:avoirs.form.save_draft')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Col: General Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-4">
                        <h2 className="font-bold text-lg border-b border-gray-100 pb-2">{t('stock:avoirs.form.general_info')}</h2>
                        
                        {/* Fournisseur */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-500 mb-1">
                                {t('stock:avoirs.form.fournisseur')} <span className="text-red-600">*</span>
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-gray-200 bg-white pl-9 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all focus:border-indigo-500 transition-colors"
                                    placeholder={t('stock:avoirs.form.fournisseur_placeholder')}
                                    value={fournisseurSearch}
                                    onChange={(e) => {
                                        setFournisseurSearch(e.target.value);
                                        setShowFournisseurList(true);
                                    }}
                                    onFocus={() => setShowFournisseurList(true)}
                                />
                                {isSearchingFournisseur && (
                                    <span className="inline-block size-3 border-2 border-gray-200 border-t-indigo-600 rounded-full animate-spin absolute right-3 top-1/2 -translate-y-1/2 opacity-50" />
                                )}
                            </div>
                            
                            {showFournisseurList && filteredFournisseurs.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-[100] mt-1 bg-white rounded-xl shadow-md border border-gray-100 max-h-60 overflow-y-auto w-full">
                                    {filteredFournisseurs.map(f => (
                                        <div
                                            key={f.id}
                                            className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
                                            onClick={() => selectFournisseur(f)}
                                        >
                                            <div className="font-medium text-sm">{f.name}</div>
                                            {f.address && <div className="text-xs text-gray-500 mt-0.5">{f.address}</div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {showFournisseurList && fournisseurSearch && filteredFournisseurs.length === 0 && !isSearchingFournisseur && (
                                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-xl shadow-md border border-gray-100 p-4 text-center text-sm text-gray-500">
                                    {t('stock:avoirs.form.no_fournisseur')}
                                </div>
                            )}

                            {/* Backdrop pour fermer la liste */}
                            {showFournisseurList && (
                                <div className="fixed inset-0 z-40" onClick={() => setShowFournisseurList(false)} />
                            )}
                        </div>

                        {/* Type Avoir */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-500 mb-1">
                                {t('stock:avoirs.form.type_label')} <span className="text-red-600">*</span>
                            </label>
                            <select 
                                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 px-3 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all"
                                value={typeAvoir}
                                onChange={(e) => setTypeAvoir(e.target.value)}
                            >
                                <option value="PERIME">{t('stock:avoirs.types.perime')}</option>
                                <option value="AVARIE">{t('stock:avoirs.types.avarie', 'Avarie')}</option>
                                <option value="ERREUR">{t('stock:avoirs.types.erreur_livraison', 'Erreur de livraison')}</option>
                                <option value="NON_FACTURE">{t('stock:avoirs.types.non_facture', 'Non facturé')}</option>
                                <option value="AUTRE">{t('stock:avoirs.types.autre')}</option>
                            </select>
                        </div>

                        {/* Observations */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-500 mb-1">
                                {t('stock:avoirs.form.observations_label')}
                            </label>
                            <textarea 
                                className="textarea textarea-bordered h-24 focus:border-indigo-500 transition-colors w-full"
                                placeholder={t('stock:avoirs.form.observations_placeholder')}
                                value={observations}
                                onChange={(e) => setObservations(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Right Col: Products List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-full">
                        
                        {/* Search Product Bar */}
                        <div className="p-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder={t('stock:avoirs.form.search_product_placeholder')}
                                    className="w-full rounded-xl border-0 bg-gray-50 pl-12 py-3 text-lg font-medium text-gray-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-50 transition-all"
                                    value={searchProduitQuery}
                                    onChange={(e) => setSearchProduitQuery(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                />
                                {searchProduitQuery && (
                                    <button 
                                        type="button"
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 bg-gray-200 rounded-full hover:bg-gray-300"
                                        onClick={() => {
                                            setSearchProduitQuery('')
                                            searchInputRef.current?.focus()
                                        }}
                                    >
                                        <X className="size-4 text-gray-500" />
                                    </button>
                                )}
                            </div>

                            {/* Dropdown Résultats Produits */}
                            {searchProduitQuery.length >= 2 && produitsList.length > 0 && (
                                <ul className="absolute z-[100] w-full mt-2 bg-white shadow-md rounded-xl border border-gray-100 max-h-[60vh] overflow-y-auto">
                                    {produitsList.map((product, index) => {
                                        const { className, ...props } = getItemProps(index);
                                        return (
                                            <li 
                                                key={product.id}
                                                className={`p-3 md:p-4 hover:bg-gray-100 cursor-pointer border-b border-gray-100 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-2 ${className}`}
                                                {...props}
                                            >
                                                <div className="flex-1">
                                                    <div className="font-bold text-gray-900">{product.name}</div>
                                                    <div className="text-sm text-gray-500 font-mono mt-0.5">{product.cip1 || t('common:no_cip', 'Sans CIP')}</div>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm font-medium">
                                                    <div className="bg-gray-100 px-2.5 py-1 rounded-md">
                                                        {t('common:stock', 'Stock')}: <span className={product.stock && product.stock > 0 ? 'text-emerald-600' : 'text-red-600'}>{product.stock || 0}</span>
                                                    </div>
                                                    <div className="text-right min-w-[80px]">
                                                        {formatCurrency(Number(product.cost_price || 0))}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {/* Empty State / Table */}
                        <div className="flex-1 p-0 overflow-x-auto">
                            {lignes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-4">
                                    <div className="size-16 rounded-full bg-gray-50 flex items-center justify-center">
                                        <PlusCircle className="size-8" />
                                    </div>
                                    <p className="text-lg font-medium">{t('stock:avoirs.form.empty_lines')}</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm border-separate border-spacing-0">
                                    <thead className="bg-gray-50 sticky top-0 z-[5]">
                                        <tr>
                                            <th>{t('stock:avoirs.form.table_product')}</th>
                                            <th className="w-32">{t('stock:avoirs.form.table_lot')}</th>
                                            <th className="w-24 text-center">{t('stock:avoirs.form.table_qty')}</th>
                                            <th className="w-32 text-right">{t('stock:avoirs.form.table_price')}</th>
                                            <th className="w-32 text-right">{t('stock:avoirs.form.table_total')}</th>
                                            <th className="w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lignes.map((ligne, index) => {
                                            const prod = typeof ligne.produit === 'object' ? ligne.produit : null;
                                            return (
                                                <tr key={index} className="hover:bg-gray-50 transition-colors">
                                                    <td>
                                                        <div className="font-bold">{prod?.name || t('common:unknown_product', 'Produit Inconnu')}</div>
                                                        <div className="text-xs opacity-60 font-mono mt-0.5">{prod?.cip1}</div>
                                                    </td>
                                                    <td>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="text-xs font-mono font-bold bg-gray-100 px-2 py-1 rounded w-fit">
                                                                {ligne.lot || t('stock:avoirs.form.no_lot')}
                                                            </div>
                                                            <div className="text-xs opacity-60">
                                                                {ligne.date_expiration ? ligne.date_expiration : t('stock:avoirs.form.no_date')}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="text-xs text-indigo-600 hover:underline w-fit mt-1"
                                                                onClick={() => handleOpenLotModal(index)}
                                                            >
                                                                {t('stock:avoirs.form.select_lot')}
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <input 
                                                            type="number" 
                                                            min="1"
                                                            className="w-full rounded-lg border border-gray-200 bg-white h-8 px-3 text-center text-sm font-bold font-mono text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all"
                                                            value={ligne.quantity}
                                                            onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input 
                                                            type="number" 
                                                            step="0.01"
                                                            className="w-full rounded-lg border border-gray-200 bg-white h-8 px-3 text-right text-sm font-mono text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all"
                                                            value={ligne.price}
                                                            onChange={(e) => updateLine(index, 'price', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="text-right font-bold text-indigo-600 font-mono">
                                                        {formatCurrency(Number(ligne.total || 0))}
                                                    </td>
                                                    <td className="text-right">
                                                        <button 
                                                            type="button"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors btn-ghost btn-xs btn-circle text-red-600 hover:bg-red-50"
                                                            onClick={() => removeLine(index)}
                                                            title={t('common:remove')}
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </button>
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
                            <div className="p-4 sm:p-6 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
                                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div className="text-sm font-medium text-gray-500">
                                        {t('stock:avoirs.form.items_count', { count: lignes.length, units: lignes.reduce((sum, l) => sum + Number(l.quantity), 0) })}
                                    </div>
                                    <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-xl shadow-sm border border-gray-100">
                                        <span className="text-gray-500 font-bold uppercase tracking-wider text-sm">{t('stock:avoirs.form.total_amount')}</span>
                                        <span className="text-2xl font-black text-indigo-600 font-mono tracking-tight">
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
