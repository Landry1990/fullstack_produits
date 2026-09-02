import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Package, ArrowRight } from 'lucide-react';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import { Select } from '../shadcn/select';
import type { SortBy } from './productTableUtils';

interface CommandeProductToolbarProps {
    commandeProduitsCount: number;
    selectedRowsSize: number;
    viewMode: 'CREATE' | 'EDIT' | 'LIST' | 'DETAILS';
    selectedCommandeStatus?: string;
    saving: boolean;
    commandeSortBy?: SortBy;
    onSortProduits?: (sortBy: SortBy) => void;
    onDeleteSelected: () => void;
    onTransferClick: () => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
}

export function CommandeProductToolbar({
    commandeProduitsCount,
    selectedRowsSize,
    viewMode,
    selectedCommandeStatus,
    saving,
    commandeSortBy,
    onSortProduits,
    onDeleteSelected,
    onTransferClick,
    searchQuery,
    onSearchChange,
}: CommandeProductToolbarProps) {
    const { t } = useTranslation(['orders', 'common']);

    return (
        <div className="py-1.5 px-3 border-b border-slate-200 flex justify-between items-center shrink-0 flex-wrap gap-x-4 gap-y-2">
            <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-xs text-slate-800 whitespace-nowrap flex items-center gap-1">
                    <Package className="size-3 text-slate-600" />
                    {commandeProduitsCount}
                </h2>
                {commandeProduitsCount > 0 && (
                    <div className="relative">
                        <Input
                            type="text"
                            placeholder={t('orders:product_table.search_placeholder')}
                            className="w-40 h-7 pl-7 text-xs"
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                        <Search className="h-3 w-3 absolute left-2 top-2 text-slate-400" />
                    </div>
                )}
                {commandeProduitsCount > 0 && onSortProduits && (
                    <Select
                        className="h-7 text-[10px] py-1 px-2 pr-6"
                        value={commandeSortBy || 'chrono'}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onSortProduits(e.target.value as SortBy)}
                        aria-label={t('orders:list.sort_by')}
                    >
                        <option value="chrono">{t('orders:product_table.sort_options.chrono')}</option>
                        <option value="stock">{t('orders:product_table.sort_options.stock')}</option>
                        <option value="name">{t('orders:product_table.sort_options.name')}</option>
                        <option value="qty">{t('orders:product_table.sort_options.qty')}</option>
                    </Select>
                )}
                {saving && <span className="text-[10px] text-amber-600 animate-pulse font-bold">{t('orders:form.saving')}</span>}
            </div>

            <div className="flex items-center gap-3">
                {selectedRowsSize > 0 && (
                    <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3 ml-1">
                        <span className="text-[10px] text-slate-500 font-bold">{selectedRowsSize} {t('orders:product_table.selected_short')}</span>
                        <Button type="button" variant="destructive" size="sm" className="h-6 px-2 text-[10px]" onClick={onDeleteSelected}>
                            {t('orders:product_table.delete_btn')}
                        </Button>
                        {viewMode === 'EDIT' && selectedCommandeStatus === 'PREP' && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-[10px] gap-1 border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                onClick={onTransferClick}
                                aria-label={t('orders:actions.transfer_products')}
                            >
                                <ArrowRight className="size-3" />
                                <span className="hidden sm:inline">{t('orders:actions.transfer')}</span>
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
