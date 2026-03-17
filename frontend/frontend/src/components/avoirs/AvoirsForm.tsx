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
        <form onSubmit={handleSave} className="min-h-screen bg-base-200 p-4 md:p-6 space-y-6">
            
            {/* Header / Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-base-100 p-4 rounded-2xl shadow-sm border border-base-300 relative z-[60]">
                <div className="flex items-center gap-3">
                    <button 
                        type="button" 
                        onClick={handleBackToList}
                        className="btn btn-circle btn-ghost btn-sm"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold">
                            {viewMode === 'EDIT' ? t('avoirs.form.title_edit', { id: editingAvoirId }) : t('avoirs.form.title_new')}
                        </h1>
                        <p className="text-sm text-base-content/60">
                            {t('avoirs.form.subtitle')}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button type="button" className="btn btn-ghost flex-1 sm:flex-none" onClick={handleBackToList}>
                        {t('avoirs.form.cancel')}
                    </button>
                    <button type="submit" className="btn btn-primary flex-1 sm:flex-none" disabled={loading}>
                        <Save className="w-4 h-4 mr-2" />
                        {loading ? t('avoirs.form.saving') : t('avoirs.form.save_draft')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Col: General Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-5 space-y-4">
                        <h2 className="font-bold text-lg border-b border-base-200 pb-2">{t('avoirs.form.general_info')}</h2>
                        
                        {/* Fournisseur */}
                        <div className="form-control relative">
                            <label className="label font-medium text-sm text-base-content/70">
                                {t('avoirs.form.fournisseur')} <span className="text-error">*</span>
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
                                <input
                                    type="text"
                                    className="input input-bordered w-full pl-9 focus:border-primary transition-colors"
                                    placeholder={t('avoirs.form.fournisseur_placeholder')}
                                    value={fournisseurSearch}
                                    onChange={(e) => {
                                        setFournisseurSearch(e.target.value);
                                        setShowFournisseurList(true);
                                    }}
                                    onFocus={() => setShowFournisseurList(true)}
                                />
                                {isSearchingFournisseur && (
                                    <span className="loading loading-spinner loading-xs absolute right-3 top-1/2 -translate-y-1/2 opacity-50" />
                                )}
                            </div>
                            
                            {showFournisseurList && filteredFournisseurs.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-[100] mt-1 bg-base-100 rounded-xl shadow-xl border border-base-200 max-h-60 overflow-y-auto w-full">
                                    {filteredFournisseurs.map(f => (
                                        <div
                                            key={f.id}
                                            className="p-3 hover:bg-primary/5 cursor-pointer border-b border-base-100 last:border-0 transition-colors"
                                            onClick={() => selectFournisseur(f)}
                                        >
                                            <div className="font-medium text-sm">{f.name}</div>
                                            {f.address && <div className="text-xs text-base-content/50 mt-0.5">{f.address}</div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {showFournisseurList && fournisseurSearch && filteredFournisseurs.length === 0 && !isSearchingFournisseur && (
                                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-base-100 rounded-xl shadow-xl border border-base-200 p-4 text-center text-sm text-base-content/60">
                                    {t('avoirs.form.no_fournisseur')}
                                </div>
                            )}

                            {/* Backdrop pour fermer la liste */}
                            {showFournisseurList && (
                                <div className="fixed inset-0 z-40" onClick={() => setShowFournisseurList(false)} />
                            )}
                        </div>

                        {/* Type Avoir */}
                        <div className="form-control">
                            <label className="label font-medium text-sm text-base-content/70">
                                {t('avoirs.form.type_label')} <span className="text-error">*</span>
                            </label>
                            <select 
                                className="select select-bordered focus:border-primary transition-colors w-full"
                                value={typeAvoir}
                                onChange={(e) => setTypeAvoir(e.target.value)}
                            >
                                <option value="PERIME">{t('avoirs.types.perime')}</option>
                                <option value="CASSE">{t('avoirs.types.casse')}</option>
                                <option value="ERREUR_LIVRAISON">{t('avoirs.types.erreur_livraison')}</option>
                                <option value="AUTRE">{t('avoirs.types.autre')}</option>
                            </select>
                        </div>

                        {/* Observations */}
                        <div className="form-control">
                            <label className="label font-medium text-sm text-base-content/70">
                                {t('avoirs.form.observations_label')}
                            </label>
                            <textarea 
                                className="textarea textarea-bordered h-24 focus:border-primary transition-colors w-full"
                                placeholder={t('avoirs.form.observations_placeholder')}
                                value={observations}
                                onChange={(e) => setObservations(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Right Col: Products List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col h-full">
                        
                        {/* Search Product Bar */}
                        <div className="p-4 border-b border-base-200 sticky top-0 bg-base-100 z-10 rounded-t-2xl">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/40" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder={t('avoirs.form.search_product_placeholder')}
                                    className="input input-lg w-full pl-12 bg-base-200/50 border-0 focus:bg-base-100 focus:ring-2 focus:ring-primary/20 transition-all text-lg rounded-xl"
                                    value={searchProduitQuery}
                                    onChange={(e) => setSearchProduitQuery(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                />
                                {searchProduitQuery && (
                                    <button 
                                        type="button"
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 bg-base-300 rounded-full hover:bg-base-content/20"
                                        onClick={() => {
                                            setSearchProduitQuery('')
                                            searchInputRef.current?.focus()
                                        }}
                                    >
                                        <X className="w-4 h-4 text-base-content/60" />
                                    </button>
                                )}
                            </div>

                            {/* Dropdown Résultats Produits */}
                            {searchProduitQuery.length >= 2 && produitsList.length > 0 && (
                                <ul className="absolute z-[100] w-full mt-2 bg-base-100 shadow-xl rounded-xl border border-base-200 max-h-[60vh] overflow-y-auto">
                                    {produitsList.map((product, index) => {
                                        const { className, ...props } = getItemProps(index);
                                        return (
                                            <li 
                                                key={product.id}
                                                className={`p-3 md:p-4 hover:bg-base-200 cursor-pointer border-b border-base-100 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-2 ${className}`}
                                                {...props}
                                            >
                                                <div className="flex-1">
                                                    <div className="font-bold text-base-content">{product.name}</div>
                                                    <div className="text-sm text-base-content/60 font-mono mt-0.5">{product.cip1 || 'Sans CIP'}</div>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm font-medium">
                                                    <div className="bg-base-200 px-2.5 py-1 rounded-md">
                                                        Stock: <span className={product.stock && product.stock > 0 ? 'text-success' : 'text-error'}>{product.stock || 0}</span>
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
                                <div className="flex flex-col items-center justify-center h-64 text-base-content/40 gap-4">
                                    <div className="w-16 h-16 rounded-full bg-base-200/50 flex items-center justify-center">
                                        <PlusCircle className="w-8 h-8" />
                                    </div>
                                    <p className="text-lg font-medium">{t('avoirs.form.empty_lines')}</p>
                                </div>
                            ) : (
                                <table className="table w-full">
                                    <thead className="bg-base-200/50 sticky top-0 z-[5]">
                                        <tr>
                                            <th>{t('avoirs.form.table_product')}</th>
                                            <th className="w-32">{t('avoirs.form.table_lot')}</th>
                                            <th className="w-24 text-center">{t('avoirs.form.table_qty')}</th>
                                            <th className="w-32 text-right">{t('avoirs.form.table_price')}</th>
                                            <th className="w-32 text-right">{t('avoirs.form.table_total')}</th>
                                            <th className="w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lignes.map((ligne, index) => {
                                            const prod = typeof ligne.produit === 'object' ? ligne.produit : null;
                                            return (
                                                <tr key={index} className="hover:bg-base-50 transition-colors">
                                                    <td>
                                                        <div className="font-bold">{prod?.name || 'Produit Inconnu'}</div>
                                                        <div className="text-xs opacity-60 font-mono mt-0.5">{prod?.cip1}</div>
                                                    </td>
                                                    <td>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="text-xs font-mono font-bold bg-base-200 px-2 py-1 rounded w-fit">
                                                                {ligne.lot || t('avoirs.form.no_lot')}
                                                            </div>
                                                            <div className="text-xs opacity-60">
                                                                {ligne.date_expiration ? ligne.date_expiration : t('avoirs.form.no_date')}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="text-xs text-primary hover:underline w-fit mt-1"
                                                                onClick={() => handleOpenLotModal(index)}
                                                            >
                                                                {t('avoirs.form.select_lot')}
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <input 
                                                            type="number" 
                                                            min="1"
                                                            className="input input-bordered input-sm w-full text-center font-bold font-mono"
                                                            value={ligne.quantity}
                                                            onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input 
                                                            type="number" 
                                                            step="0.01"
                                                            className="input input-bordered input-sm w-full text-right font-mono"
                                                            value={ligne.price}
                                                            onChange={(e) => updateLine(index, 'price', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="text-right font-bold text-primary font-mono">
                                                        {formatCurrency(Number(ligne.total || 0))}
                                                    </td>
                                                    <td className="text-right">
                                                        <button 
                                                            type="button"
                                                            className="btn btn-ghost btn-xs btn-circle text-error hover:bg-error/10"
                                                            onClick={() => removeLine(index)}
                                                            title={t('common:remove')}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
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
                            <div className="p-4 sm:p-6 bg-base-200/30 border-t border-base-200 rounded-b-2xl">
                                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div className="text-sm font-medium text-base-content/60">
                                        {t('avoirs.form.items_count', { count: lignes.length, units: lignes.reduce((sum, l) => sum + Number(l.quantity), 0) })}
                                    </div>
                                    <div className="flex items-center gap-4 bg-base-100 px-6 py-3 rounded-xl shadow-sm border border-base-200">
                                        <span className="text-base-content/70 font-bold uppercase tracking-wider text-sm">{t('avoirs.form.total_amount')}</span>
                                        <span className="text-2xl font-black text-primary font-mono tracking-tight">
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
