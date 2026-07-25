import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';
import type { CommandeProduit, ProduitModel } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../shadcn/input';
import { Checkbox } from '../shadcn/checkbox';
import {
    type FieldConfig,
    type FieldType,
    handleSelectAll,
    normalizeExpiryMMYY,
    finalizeExpiryMMYY,
    resolveProductInfo,
    resolveCip,
    resolveStock,
} from './productTableUtils';

interface CommandeProductRowProps {
    p: CommandeProduit;
    index: number;
    produitsList: ProduitModel[];
    commandeType: 'LOC' | 'DIR';
    fieldsConfig: FieldConfig[];
    focusedField: { row: number; field: number } | null;
    selectedRows: Set<number>;
    highlightedIndex?: number | null;
    isExpanded: boolean;
    marginThreshold: number;
    searchQuery: string;
    toggleRowSelection: (index: number) => void;
    updateCommandeProduitField: (index: number, field: FieldType, value: string | number) => void;
    handleTableFieldKeyDown: (e: React.KeyboardEvent, rowIndex: number, fieldIndex: number) => void;
    handleSellingPriceBlur?: (index: number) => void;
    onToggleExpand: () => void;
    onDeleteProduct: () => void;
}

export function CommandeProductRow({
    p,
    index,
    produitsList,
    commandeType,
    fieldsConfig,
    focusedField,
    selectedRows,
    highlightedIndex = null,
    isExpanded: _isExpanded,
    marginThreshold,
    searchQuery,
    toggleRowSelection,
    updateCommandeProduitField,
    handleTableFieldKeyDown,
    handleSellingPriceBlur,
    onToggleExpand,
    onDeleteProduct,
}: CommandeProductRowProps) {
    const { t } = useTranslation(['orders', 'common']);

    const { produitName, isExclusive, supplierName, isDeleted } = resolveProductInfo(p, produitsList, t);

    // Local search filter
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const cipVal = resolveCip(p, produitsList);
        const matchesName = produitName.toLowerCase().includes(q);
        const matchesCip = cipVal.toLowerCase().includes(q);
        if (!matchesName && !matchesCip) return null;
    }

    const cip = resolveCip(p, produitsList);
    const currentStock = resolveStock(p);
    // dirty state handled by parent

    const _price = Number(p.price || 0);
    const _selling = Number(p.selling_price || 0);
    const _tva = Number(p.tva || 0);
    const hasMarginIssue = _price > 0 && _selling > 0 && (_selling / (1 + _tva / 100)) < _price;

    return (
        <React.Fragment key={p.id || `row-${index}`}>
            <tr
                className={`hover:bg-slate-100/50 group border-b border-slate-200 last:border-0 ${selectedRows.has(index) ? 'bg-indigo-50' : ''} ${highlightedIndex === index ? 'ring-2 ring-amber-400 bg-amber-50 animate-pulse' : ''} ${hasMarginIssue ? 'bg-red-50' : ''}`}
            >
                <td className="px-2">
                    <Checkbox
                        checked={selectedRows.has(index)}
                        onCheckedChange={() => toggleRowSelection(index)}
                    />
                </td>

                {/* Product Info */}
                <td className="pl-2 py-0.5 min-w-[220px]">
                    <div className="font-medium text-sm">
                        <div className="flex items-center gap-1">
                            <span className={`${isDeleted ? 'italic text-slate-400' : ''} whitespace-nowrap overflow-hidden text-ellipsis`} title={produitName}>
                                {produitName}
                            </span>
                            {isExclusive && (
                                <div
                                    className="group relative z-50 inline-flex shrink-0"
                                    title={t('orders:product_table.exclusivity_tooltip', { provider: supplierName || t('orders:product_table.specific_provider') })}
                                >
                                    <span className="inline-flex items-center justify-center size-4 rounded text-[8px] font-bold bg-emerald-100 text-emerald-600">
                                        E
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </td>

                {/* CIP Column */}
                <td className="pl-2 py-0.5">
                    <span className="text-sm font-mono font-bold text-slate-600">{cip}</span>
                </td>

                {/* Stock Actuel */}
                <td className="text-center py-0.5 bg-amber-50/20">
                    <span className={`text-xs font-bold px-1 rounded ${currentStock <= 0 ? 'text-red-600 bg-red-50' : 'text-amber-600'}`}>
                        {currentStock}
                    </span>
                </td>

                {/* Quantity (0) */}
                <td className="text-right py-0.5">
                    <Input
                        type="text"
                        data-row={index}
                        data-field="quantity"
                        value={p.quantity}
                        onChange={(e) => updateCommandeProduitField(index, 'quantity', e.target.value)}
                        onKeyDown={(e) => handleTableFieldKeyDown(e, index, 0)}
                        onFocus={handleSelectAll}
                        className={`h-8 px-2 text-sm w-full text-right font-bold focus:bg-white focus:text-indigo-600 ${!fieldsConfig[0].editable ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                        autoFocus={focusedField?.row === index && focusedField?.field === 0}
                        readOnly={!fieldsConfig[0].editable}
                        tabIndex={!fieldsConfig[0].editable ? -1 : 0}
                    />
                </td>

                {/* Unites Gratuites (1) */}
                <td className="text-center py-0.5">
                    <Input
                        type="text"
                        inputMode="numeric"
                        data-row={index}
                        data-field="unites_gratuites"
                        value={p.unites_gratuites || 0}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (/^\d*$/.test(val)) {
                                updateCommandeProduitField(index, 'unites_gratuites', val === '' ? 0 : parseInt(val));
                            }
                        }}
                        onKeyDown={(e) => handleTableFieldKeyDown(e, index, 1)}
                        onFocus={handleSelectAll}
                        className={`h-8 px-2 text-xs w-full text-center font-bold bg-emerald-50 focus:bg-emerald-100 focus:text-emerald-600 ${!fieldsConfig[1].editable ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                        placeholder="0"
                        autoFocus={focusedField?.row === index && focusedField?.field === 1}
                        readOnly={!fieldsConfig[1].editable}
                        tabIndex={!fieldsConfig[1].editable ? -1 : 0}
                    />
                </td>

                {/* Prix Euro (Direct Only) */}
                {commandeType === 'DIR' && (
                    <td className="text-right py-0.5 bg-blue-50/10 border-l border-blue-100">
                        <Input
                            type="text"
                            data-row={index}
                            data-field="prix_euro"
                            value={p.prix_euro || ''}
                            onChange={(e) => updateCommandeProduitField(index, 'prix_euro', e.target.value)}
                            onFocus={handleSelectAll}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, 2)}
                            className="h-8 px-2 text-sm w-full text-right focus:bg-blue-50 focus:text-blue-600 font-mono"
                            placeholder="..."
                        />
                    </td>
                )}

                {/* Price (2) */}
                <td className="text-right py-0.5">
                    <Input
                        type="text"
                        data-row={index}
                        data-field="price"
                        value={p.price}
                        onChange={(e) => updateCommandeProduitField(index, 'price', e.target.value)}
                        onKeyDown={(e) => handleTableFieldKeyDown(e, index, (commandeType === 'DIR' ? 3 : 2))}
                        onFocus={handleSelectAll}
                        className={`h-8 px-2 text-sm w-full text-right focus:bg-white focus:text-indigo-600 ${!fieldsConfig[2].editable ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                        autoFocus={focusedField?.row === index && focusedField?.field === 2}
                        readOnly={!fieldsConfig[2].editable}
                        tabIndex={!fieldsConfig[2].editable ? -1 : 0}
                    />
                </td>

                {/* Montant = qty × price */}
                <td className="text-right py-0.5 font-bold text-indigo-600 font-mono">
                    {(() => {
                        const qty = Number(p.quantity || 0);
                        const price = Number(p.price || 0);
                        return (qty * price).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                    })()}
                </td>

                {/* TVA (3) */}
                <td className="text-right py-0.5">
                    <Input
                        type="text"
                        data-row={index}
                        data-field="tva"
                        value={p.tva || ''}
                        onChange={(e) => updateCommandeProduitField(index, 'tva', e.target.value)}
                        onKeyDown={(e) => handleTableFieldKeyDown(e, index, (commandeType === 'DIR' ? 4 : 3))}
                        onFocus={handleSelectAll}
                        className={`h-8 px-2 text-sm w-full text-right text-slate-500 focus:opacity-100 ${!fieldsConfig[3].editable ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                        autoFocus={focusedField?.row === index && focusedField?.field === 3}
                        readOnly={!fieldsConfig[3].editable}
                        tabIndex={!fieldsConfig[3].editable ? -1 : 0}
                    />
                </td>

                {/* Marge (4) */}
                <td className="text-right py-0.5">
                    <div className="relative flex items-center justify-end">
                        <Input
                            type="text"
                            data-row={index}
                            data-field="marge"
                            value={p.marge || ''}
                            onChange={(e) => updateCommandeProduitField(index, 'marge', e.target.value)}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, (commandeType === 'DIR' ? 5 : 4))}
                            onFocus={handleSelectAll}
                            className={`h-8 px-2 text-sm w-full text-right font-bold focus:bg-white ${Number(p.marge || 0) >= marginThreshold ? 'text-emerald-600' : 'text-amber-600 bg-amber-50 border-amber-300'} ${!fieldsConfig[4].editable ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                            autoFocus={focusedField?.row === index && focusedField?.field === 4}
                            readOnly={!fieldsConfig[4].editable}
                            tabIndex={!fieldsConfig[4].editable ? -1 : 0}
                        />
                        {Number(p.marge || 0) > 0 && Number(p.marge || 0) < marginThreshold && (
                            <div className="absolute right-1 top-1/2 -translate-y-1/2" title={t('orders:product_table.low_margin_tooltip', { threshold: marginThreshold, defaultValue: `Marge faible (seuil: ${marginThreshold})` })}>
                                <AlertTriangle className="size-3.5 text-amber-600" />
                            </div>
                        )}
                    </div>
                </td>

                {/* Selling Price (5) */}
                <td className="text-right py-0.5 pr-3">
                    <Input
                        type="text"
                        data-row={index}
                        data-field="selling_price"
                        value={p.selling_price}
                        onChange={(e) => updateCommandeProduitField(index, 'selling_price', e.target.value)}
                        onKeyDown={(e) => handleTableFieldKeyDown(e, index, (commandeType === 'DIR' ? 6 : 5))}
                        onFocus={handleSelectAll}
                        onBlur={() => handleSellingPriceBlur?.(index)}
                        className={`h-8 px-2 text-sm w-full text-right font-bold focus:bg-white focus:text-indigo-600 ${!fieldsConfig[5].editable ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                        autoFocus={focusedField?.row === index && focusedField?.field === 5}
                        readOnly={!fieldsConfig[5].editable}
                        tabIndex={!fieldsConfig[5].editable ? -1 : 0}
                    />
                </td>

                {/* Lot (6) */}
                <td className="text-left py-0.5">
                    <Input
                        type="text"
                        data-row={index}
                        data-field="lot"
                        value={p.lot || ''}
                        onChange={(e) => updateCommandeProduitField(index, 'lot', e.target.value)}
                        onKeyDown={(e) => handleTableFieldKeyDown(e, index, (commandeType === 'DIR' ? 7 : 6))}
                        onFocus={handleSelectAll}
                        className={`h-9 px-2.5 text-xs font-medium w-full focus:bg-white ${!fieldsConfig[6].editable ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                        placeholder="Lot"
                        autoFocus={focusedField?.row === index && focusedField?.field === 6}
                        readOnly={!fieldsConfig[6].editable}
                        tabIndex={!fieldsConfig[6].editable ? -1 : 0}
                    />
                </td>

                {/* Expiration (7) */}
                <td className="text-left py-0.5">
                    <Input
                        type="text"
                        data-row={index}
                        data-field="date_expiration"
                        value={p.date_expiration || ''}
                        onChange={(e) => {
                            updateCommandeProduitField(index, 'date_expiration', normalizeExpiryMMYY(e.target.value));
                        }}
                        onBlur={(e) => {
                            const finalized = finalizeExpiryMMYY(e.target.value);
                            updateCommandeProduitField(index, 'date_expiration', finalized);
                        }}
                        onKeyDown={(e) => handleTableFieldKeyDown(e, index, (commandeType === 'DIR' ? 8 : 7))}
                        onFocus={handleSelectAll}
                        className={`h-9 px-2.5 text-xs font-medium w-full focus:bg-white ${!fieldsConfig[7].editable ? 'bg-slate-100 cursor-not-allowed' : ''} ${p.date_expiration && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(p.date_expiration) ? 'border-red-500 text-red-600' : ''}`}
                        placeholder="MM/YY"
                        maxLength={5}
                        autoFocus={focusedField?.row === index && focusedField?.field === 7}
                        readOnly={!fieldsConfig[7].editable}
                        tabIndex={!fieldsConfig[7].editable ? -1 : 0}
                    />
                </td>

                <td className="w-12 text-center p-0">
                    <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100">
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-600" onClick={onToggleExpand}><Info className="size-3.5" /></Button>
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600" onClick={onDeleteProduct}><Trash2 className="size-3.5" /></Button>
                    </div>
                </td>
            </tr>
        </React.Fragment>
    );
}
