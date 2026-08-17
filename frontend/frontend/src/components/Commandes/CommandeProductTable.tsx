import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import type { CommandeProduit, ProduitModel, Commande } from '../../types';
import { usePharmacySettings } from '../../context/PharmacySettingsContext';
import { Checkbox } from '../shadcn/checkbox';
import { Table, TableHeader, TableBody, TableHead, TableRow } from '../shadcn/table';
import { type FieldConfig, type SortBy, type FieldType } from './productTableUtils';
import { CommandeProductToolbar } from './CommandeProductToolbar';
import { CommandeProductRow } from './CommandeProductRow';
import { CommandeProductExpandedRow } from './CommandeProductExpandedRow';
import { CommandeDeleteModals } from './CommandeDeleteModals';

interface CommandeProductTableProps {
    commandeProduits: CommandeProduit[];
    produitsList: ProduitModel[];
    selectedRows: Set<number>;
    commandeType?: 'LOC' | 'DIR';
    viewMode: 'CREATE' | 'EDIT' | 'LIST' | 'DETAILS';
    selectedCommande: Commande | null;
    saving: boolean;
    fieldsConfig: FieldConfig[];
    focusedField: { row: number; field: number } | null;
    toggleRowSelection: (index: number) => void;
    toggleAllRows: () => void;
    deleteSelectedRows: () => void;
    openTransferModal: () => void;
    onViewProductDetails?: (produitId: number) => void;
    updateCommandeProduitField: (index: number, field: FieldType, value: string | number) => void;
    handleTableFieldKeyDown: (e: React.KeyboardEvent, rowIndex: number, fieldIndex: number) => void;
    handleSellingPriceBlur?: (index: number) => void;
    onRemoveProduct: (index: number) => void;
    onEditProduct?: (produitId: number) => void;
    onCreateAvoir?: () => void;
    commandeSortBy?: SortBy;
    onSortProduits?: (sortBy: SortBy) => void;
    highlightedIndex?: number | null;
}

export default function CommandeProductTable({
    commandeProduits,
    produitsList,
    selectedRows,
    commandeType = 'LOC',
    viewMode,
    selectedCommande,
    saving,
    fieldsConfig,
    focusedField,
    toggleRowSelection,
    toggleAllRows,
    deleteSelectedRows,
    openTransferModal,
    onViewProductDetails,
    updateCommandeProduitField,
    handleSellingPriceBlur,
    handleTableFieldKeyDown,
    onRemoveProduct,
    onEditProduct,
    commandeSortBy,
    onSortProduits,
    highlightedIndex = null,
}: CommandeProductTableProps) {
    const { t } = useTranslation(['orders', 'common']);
    const { settings: pharmacySettings } = usePharmacySettings();
    const marginThreshold = pharmacySettings?.min_margin_threshold ?? 1.34;

    const [searchQuery, setSearchQuery] = useState('');
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const [productToDelete, setProductToDelete] = useState<number | null>(null);
    const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);

    const tableRef = useRef<HTMLDivElement>(null);

    const handleTableKeyDownCapture = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!onViewProductDetails) return;
        if (e.shiftKey && e.key === 'Enter') {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' && target.hasAttribute('data-row')) {
                const rowIdx = parseInt(target.getAttribute('data-row')!, 10);
                const p = commandeProduits[rowIdx];
                if (!p) return;
                const isObjectProduit = p.produit && typeof p.produit === 'object';
                const produitId = isObjectProduit ? (p.produit as { id: number }).id : p.produit;
                if (produitId) {
                    e.preventDefault();
                    e.stopPropagation();
                    onViewProductDetails(Number(produitId));
                }
            }
        }
    }, [commandeProduits, onViewProductDetails]);

    const colSpan = commandeType === 'DIR' ? 15 : 14;

    return (
        <div ref={tableRef} onKeyDownCapture={handleTableKeyDownCapture} className="flex-1 min-h-0 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200">
            <CommandeProductToolbar
                commandeProduitsCount={commandeProduits.length}
                selectedRowsSize={selectedRows.size}
                viewMode={viewMode}
                selectedCommandeStatus={selectedCommande?.status}
                saving={saving}
                commandeSortBy={commandeSortBy}
                onSortProduits={onSortProduits}
                onDeleteSelected={() => setIsDeletingMultiple(true)}
                onTransferClick={openTransferModal}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
            />

            <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
                {commandeProduits.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 py-12">
                        <Package className="h-16 w-16 text-slate-200" />
                        <p className="font-light">{t('orders:product_table.empty_state')}</p>
                    </div>
                ) : (
                    <Table className="w-full relative text-sm">
                        <TableHeader>
                            <TableRow className="sticky top-0 z-30 bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600 font-bold border-b-2 border-slate-300">
                                <TableHead className="bg-slate-100 w-8 px-2 whitespace-nowrap">
                                    <Checkbox
                                        checked={selectedRows.size === commandeProduits.length && commandeProduits.length > 0}
                                        onCheckedChange={() => toggleAllRows()}
                                    />
                                </TableHead>
                                <TableHead className="bg-slate-100 pl-2 font-bold min-w-[260px] w-full whitespace-nowrap">{t('orders:product_table.headers.product')}</TableHead>
                                <TableHead className="bg-slate-100 pl-2 font-bold min-w-[96px] whitespace-nowrap">{t('orders:product_table.headers.cip')}</TableHead>
                                <TableHead className="bg-slate-100 text-center min-w-[56px] text-amber-600 font-bold border-x border-slate-300/30 whitespace-nowrap">{t('orders:product_table.headers.stock_short')}</TableHead>
                                <TableHead className="bg-slate-100 text-right min-w-[64px] font-bold whitespace-nowrap">{t('orders:product_table.headers.qty')}</TableHead>
                                <TableHead className="bg-slate-100 text-center min-w-[56px] font-bold text-emerald-600 border-l border-slate-300/30 whitespace-nowrap">{t('orders:product_table.headers.ug')}</TableHead>
                                {commandeType === 'DIR' && (
                                    <TableHead className="bg-slate-100 text-right min-w-[96px] font-bold text-blue-600 border-l border-slate-300/30 whitespace-nowrap">{t('orders:product_table.headers.dev_price')}</TableHead>
                                )}
                                <TableHead className="bg-slate-100 text-right min-w-[96px] font-bold border-l border-slate-300/30 whitespace-nowrap">{t('orders:product_table.headers.buy_price_ht')}</TableHead>
                                <TableHead className="bg-slate-100 text-right min-w-[112px] font-bold text-indigo-600 border-l border-slate-300/30 whitespace-nowrap">{t('orders:product_table.headers.amount')}</TableHead>
                                <TableHead className="bg-slate-100 text-right min-w-[72px] font-bold whitespace-nowrap">{t('orders:product_table.headers.tva')}</TableHead>
                                <TableHead className="bg-slate-100 text-right min-w-[64px] font-bold whitespace-nowrap">{t('orders:product_table.headers.margin')}</TableHead>
                                <TableHead className="bg-slate-100 text-right min-w-[96px] font-bold border-l border-slate-300/30 pr-3 whitespace-nowrap">{t('orders:product_table.headers.sell_price')}</TableHead>
                                <TableHead className="bg-slate-100 text-left min-w-[96px] font-bold border-l border-slate-300/30 whitespace-nowrap">{t('orders:product_table.headers.lot')}</TableHead>
                                <TableHead className="bg-slate-100 text-left min-w-[96px] font-bold border-l border-slate-300/30 whitespace-nowrap">{t('orders:product_table.headers.exp_date')}</TableHead>
                                <TableHead className="bg-slate-100 min-w-[48px] rounded-tr-lg"></TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {commandeProduits.map((p, index) => (
                                <React.Fragment key={p.id || (typeof p.produit === 'object' ? p.produit.id : p.produit) || `row-${p.produit_cip}-${p.produit_nom}`}>
                                    <CommandeProductRow
                                        p={p}
                                        index={index}
                                        produitsList={produitsList}
                                        commandeType={commandeType}
                                        fieldsConfig={fieldsConfig}
                                        focusedField={focusedField}
                                        selectedRows={selectedRows}
                                        highlightedIndex={highlightedIndex}
                                        isExpanded={expandedRow === index}
                                        marginThreshold={marginThreshold}
                                        searchQuery={searchQuery}
                                        toggleRowSelection={toggleRowSelection}
                                        updateCommandeProduitField={updateCommandeProduitField}
                                        handleTableFieldKeyDown={handleTableFieldKeyDown}
                                        handleSellingPriceBlur={handleSellingPriceBlur}
                                        onToggleExpand={() => setExpandedRow(expandedRow === index ? null : index)}
                                        onDeleteProduct={() => setProductToDelete(index)}
                                        onEditProduct={(() => {
                                            const produitId = p.produit && typeof p.produit === 'object' ? p.produit.id : p.produit;
                                            return onEditProduct && produitId ? () => onEditProduct(produitId as number) : undefined;
                                        })()}
                                    />
                                    {expandedRow === index && (
                                        <CommandeProductExpandedRow p={p} colSpan={colSpan} />
                                    )}
                                </React.Fragment>
                            ))}
                            <TableRow className="sticky bottom-0 z-30 bg-slate-100 text-[10px] uppercase font-bold text-slate-500 border-t-2 border-slate-300 shadow-md">
                                <TableHead colSpan={3} className="bg-slate-100 pl-4 py-2">{t('orders:product_table.end_of_list', { count: commandeProduits.length })}</TableHead>
                                <TableHead className="bg-slate-100 py-2"></TableHead>
                                <TableHead className="bg-slate-100 py-2"></TableHead>
                                <TableHead className="bg-slate-100 py-2"></TableHead>
                                {commandeType === 'DIR' && <TableHead className="bg-slate-100 py-2"></TableHead>}
                                <TableHead className="bg-slate-100 py-2"></TableHead>
                                <TableHead className="bg-slate-100 py-2"></TableHead>
                                <TableHead className="bg-slate-100 py-2"></TableHead>
                                <TableHead className="bg-slate-100 py-2"></TableHead>
                                <TableHead className="bg-slate-100 py-2"></TableHead>
                                <TableHead className="bg-slate-100 py-2"></TableHead>
                                <TableHead className="bg-slate-100 py-2"></TableHead>
                                <TableHead className="bg-slate-100 py-2"></TableHead>
                                <TableHead className="bg-slate-100 py-2 rounded-br-lg"></TableHead>
                            </TableRow>
                        </TableBody>
                    </Table>
                )}
            </div>

            <CommandeDeleteModals
                productToDelete={productToDelete}
                isDeletingMultiple={isDeletingMultiple}
                selectedRowsSize={selectedRows.size}
                onClearProductToDelete={() => setProductToDelete(null)}
                onConfirmDeleteProduct={onRemoveProduct}
                onClearDeletingMultiple={() => setIsDeletingMultiple(false)}
                onConfirmDeleteMultiple={deleteSelectedRows}
            />
        </div>
    );
}
