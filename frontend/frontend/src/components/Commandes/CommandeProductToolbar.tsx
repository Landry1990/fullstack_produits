import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../shadcn/input';
import { Select } from '../ui/Select';
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
                <h2 className="font-bold text-xs text-slate-800 whitespace-nowrap">
                    📦 {commandeProduitsCount}
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
                        size="sm"
                        className="text-[10px] h-7"
                        value={commandeSortBy || 'chrono'}
                        onChange={(e) => onSortProduits(e.target.value as SortBy)}
                    >
                        <option value="chrono">🕒 {t('orders:product_table.sort_options.chrono')}</option>
                        <option value="stock">📦 {t('orders:product_table.sort_options.stock')}</option>
                        <option value="name">ABC {t('orders:product_table.sort_options.name')}</option>
                        <option value="qty">🔢 {t('orders:product_table.sort_options.qty')}</option>
                    </Select>
                )}
                {saving && <span className="text-[10px] text-amber-600 animate-pulse font-bold">{t('orders:form.saving')}</span>}
            </div>

            <div className="flex items-center gap-3">
                {selectedRowsSize > 0 && (
                    <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3 ml-1">
                        <span className="text-[10px] text-slate-500 font-bold">{selectedRowsSize} sél.</span>
                        <Button type="button" variant="danger" size="sm" className="h-6 px-2 text-[10px]" onClick={onDeleteSelected}>
                            Suppr.
                        </Button>
                        {viewMode === 'EDIT' && selectedCommandeStatus === 'PREP' && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-[10px] flex items-center gap-1 border-blue-500 text-blue-600 hover:bg-blue-50"
                                onClick={onTransferClick}
                                title={t('orders:actions.transfer_products')}
                            >
                                <span>➡️</span>
                                <span className="hidden sm:inline">{t('orders:actions.transfer')}</span>
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
