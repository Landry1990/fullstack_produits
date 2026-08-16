import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Save, Trash2, ArrowLeft, Package, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { logger } from '../../utils/logger';
import type { ProduitModel } from '../../types';
import type { UseAvoirsDataReturn } from '../../hooks/useAvoirsData';
import { ProductSearch, type SearchResult } from '../common/ProductSearch';
import { useProductSearch as useProductSearchBase } from '../../hooks/product-search/useProductSearch';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../shadcn/card';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { getTypeOptions } from './utils';
import {
    Table, TableHeader, TableBody, TableRow, TableHead, TableCell
} from '../ui/Table';

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

    const [productResults, setProductResults] = useState<SearchResult[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    useEffect(() => {
        if (searchProduitQuery.length < 2) {
            setProductResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const response = await api.get('produits/', {
                    params: { search: searchProduitQuery, page_size: 20 }
                });
                const data = response.data;
                const results: ProduitModel[] = Array.isArray(data) ? data : data.results || [];
                setProductResults(results.map(p => ({
                    ...p,
                    id: p.id,
                    name: p.name,
                    stock: p.stock,
                    selling_price: p.selling_price,
                    cip1: p.cip1,
                    rayon_name: p.rayon_name,
                })));
            } catch (e) {
                logger.error('AvoirsForm product search error', e);
                setProductResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchProduitQuery]);

    const handleSelectProduct = useCallback((product: SearchResult | ProduitModel) => {
        selectProduct(product as unknown as ProduitModel);
        resetSearch();
        setProductResults([]);
        searchInputRef.current?.focus();
    }, [selectProduct, resetSearch, searchInputRef]);

    return (
        <form onSubmit={handleSave} className="min-h-screen bg-slate-50 p-4 md:p-6 space-y-6">
            {/* Header / Actions */}
            <Card className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 relative z-50">
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleBackToList}
                        className="text-slate-500 hover:text-slate-700 hover:bg-slate-100"
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
                    >
                        {t('stock:avoirs.form.cancel')}
                    </Button>
                    <Button
                        type="submit"
                        disabled={loading}
                        onClick={() => setShowFournisseurList(false)}
                        className="gap-2"
                    >
                        {loading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        {loading ? t('stock:avoirs.form.saving') : t('stock:avoirs.form.save_draft')}
                    </Button>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Col: General Info */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">{t('stock:avoirs.form.general_info')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <Label>
                                    {t('stock:avoirs.form.fournisseur')} <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative mt-1.5">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                                    <Input
                                        type="text"
                                        placeholder={t('stock:avoirs.form.fournisseur_placeholder')}
                                        value={fournisseurSearch}
                                        onChange={(e) => {
                                            setFournisseurSearch(e.target.value);
                                            setShowFournisseurList(true);
                                        }}
                                        onFocus={() => setShowFournisseurList(true)}
                                        className="pl-9 pr-9"
                                    />
                                    {isSearchingFournisseur && (
                                        <Loader2 className="size-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600" />
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

                                {showFournisseurList && (
                                    <div className="fixed inset-0 z-[45]" onClick={() => setShowFournisseurList(false)} />
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label>{t('stock:avoirs.details.type_label', { defaultValue: 'Type d\'avoir' })} <span className="text-red-500">*</span></Label>
                                <Select
                                    value={typeAvoir}
                                    onChange={(e) => setTypeAvoir(e.target.value)}
                                    size="md"
                                >
                                    {getTypeOptions().map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {t(opt.labelKey, { defaultValue: opt.defaultLabel })}
                                        </option>
                                    ))}
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label>{t('stock:avoirs.form.observations_label')}</Label>
                                <Textarea
                                    placeholder={t('stock:avoirs.form.observations_placeholder')}
                                    value={observations}
                                    onChange={(e) => setObservations(e.target.value)}
                                    className="h-24"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Col: Products List */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="flex flex-col h-full">
                        <div className="p-4 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                            <ProductSearch
                                searchQuery={searchProduitQuery}
                                setSearchQuery={setSearchProduitQuery}
                                results={productResults}
                                loading={searchLoading}
                                modes={['products']}
                                onSelect={handleSelectProduct}
                                searchInputRef={searchInputRef}
                                handleKeyDown={handleKeyDown}
                                getItemProps={getItemProps}
                                placeholder={t('stock:avoirs.form.search_product_placeholder')}
                            />
                        </div>

                        <div className="flex-1 p-0 overflow-x-auto">
                            {lignes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-4">
                                    <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center">
                                        <Package className="size-8" />
                                    </div>
                                    <p className="text-lg font-medium">{t('stock:avoirs.form.empty_lines')}</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{t('stock:avoirs.form.table_product')}</TableHead>
                                            <TableHead className="w-32">{t('stock:avoirs.form.table_lot')}</TableHead>
                                            <TableHead className="w-40">{t('stock:avoirs.form.table_motif')}</TableHead>
                                            <TableHead className="text-center w-24">{t('stock:avoirs.form.table_qty')}</TableHead>
                                            <TableHead className="text-right w-32">{t('stock:avoirs.form.table_price')}</TableHead>
                                            <TableHead className="text-right w-32">{t('stock:avoirs.form.table_total')}</TableHead>
                                            <TableHead className="w-16"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {lignes.map((ligne, index) => {
                                            const prod = typeof ligne.produit === 'object' ? ligne.produit : null;
                                            return (
                                                <TableRow key={prod?.id ?? ligne.id ?? `ligne-${prod?.name ?? ligne.lot}`}>
                                                    <TableCell>
                                                        <div className="font-semibold text-slate-800">{prod?.name || t('common:unknown_product', { defaultValue: 'Produit Inconnu' })}</div>
                                                        <div className="text-xs text-slate-400 font-mono mt-0.5">{prod?.cip1}</div>
                                                    </TableCell>
                                                    <TableCell>
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
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="text"
                                                            size="sm"
                                                            className="text-xs"
                                                            placeholder={t('stock:avoirs.form.motif_placeholder')}
                                                            value={ligne.motif || ''}
                                                            onChange={(e) => updateLine(index, 'motif', e.target.value)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            size="sm"
                                                            className="text-center"
                                                            value={ligne.quantity}
                                                            onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-right font-mono text-sm font-semibold text-slate-700 py-2">
                                                            {formatCurrency(Number(ligne.price || 0))}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold text-emerald-600 font-mono">
                                                        {formatCurrency(Number(ligne.total || 0))}
                                                    </TableCell>
                                                    <TableCell className="text-right">
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
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </div>

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
                    </Card>
                </div>
            </div>
        </form>
    );
};
