import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CommandeProduit, ProduitModel, Commande } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface FieldConfig {
    name: string;
    editable: boolean;
}

interface CommandeProductTableProps {
    // Data
    commandeProduits: CommandeProduit[];
    produitsList: ProduitModel[]; // For name resolution
    
    // UI State
    selectedRows: Set<number>;
    commandeType?: 'LOC' | 'DIR';
    viewMode: 'CREATE' | 'EDIT' | 'LIST' | 'DETAILS';
    selectedCommande: Commande | null;
    saving: boolean;
    fieldsConfig: FieldConfig[];
    focusedField: { row: number; field: number } | null;

    // Actions
    toggleRowSelection: (index: number) => void;
    toggleAllRows: () => void;
    deleteSelectedRows: () => void;
    openTransferModal: () => void;
    
    // Updates
    updateCommandeProduitField: (
        index: number, 
        field: 'quantity' | 'unites_gratuites' | 'price' | 'tva' | 'marge' | 'selling_price' | 'lot' | 'date_expiration' | 'prix_euro', 
        value: string | number
    ) => void;
    
    handleTableFieldKeyDown: (e: React.KeyboardEvent, rowIndex: number, fieldIndex: number) => void;
    onRemoveProduct: (index: number) => void;
    onCreateAvoir?: () => void; // Optional handler for creating credit note
    commandeSortBy?: 'chrono' | 'stock' | 'name' | 'qty';
    onSortProduits?: (sortBy: 'chrono' | 'stock' | 'name' | 'qty') => void;
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
    updateCommandeProduitField,
    handleTableFieldKeyDown,
    onRemoveProduct,
    commandeSortBy,
    onSortProduits
}: CommandeProductTableProps) {
    const { t } = useTranslation(['orders', 'common']);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    
    // Deletion Modal State
    const [productToDelete, setProductToDelete] = useState<number | null>(null);
    const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);
    
    // Auto-select content when input receives focus
    const handleSelectAll = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };
    
    return (
        <div className="flex-1 min-h-0 flex flex-col bg-base-100 rounded-xl shadow-sm border border-base-200">
            <div className="py-1.5 px-3 border-b border-base-100 flex justify-between items-center shrink-0 flex-wrap gap-x-4 gap-y-2">
                {/* PARTIE GAUCHE: Titre + Recherche + Tri */}
                <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-xs text-base-content whitespace-nowrap">
                    📦 {commandeProduits.length}
                    </h2>
                    {/* SEARCH INPUT COMPACT */}
                    {commandeProduits.length > 0 && (
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={t('orders:product_table.search_placeholder')}
                                className="input input-xs input-bordered w-40 pl-7"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 absolute left-2 top-2 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    )}
                    {commandeProduits.length > 0 && onSortProduits && (
                        <select 
                            className="select select-bordered select-xs text-[10px] h-7 min-h-7" 
                            value={commandeSortBy || 'chrono'} 
                            onChange={(e) => onSortProduits(e.target.value as any)}
                        >
                            <option value="chrono">🕒 {t('orders:product_table.sort_options.chrono')}</option>
                            <option value="stock">📦 {t('orders:product_table.sort_options.stock')}</option>
                            <option value="name">ABC {t('orders:product_table.sort_options.name')}</option>
                            <option value="qty">🔢 {t('orders:product_table.sort_options.qty')}</option>
                        </select>
                    )}
                    {saving && <span className="text-[10px] text-warning animate-pulse font-bold">{t('orders:form.saving')}</span>}
                </div>
                
                {/* PARTIE DROITE: STATS AGRANDIES */}
                <div className="flex items-center gap-3">
                    {(() => {
                        const stats = commandeProduits.reduce((acc, p) => {
                            const qty = Number(p.quantity || 0);
                            const price = Number(p.price || 0);
                            const tvaRate = Number(p.tva || 0);
                            const lineHT = qty * price;
                            const lineTVA = lineHT * (tvaRate / 100);
                            return { ht: acc.ht + lineHT, tva: acc.tva + lineTVA };
                        }, { ht: 0, tva: 0 });
                        const totalTTC = stats.ht + stats.tva;
                        
                        return (
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col items-end">
                                    <span className="text-[9px] uppercase font-bold text-base-content/40 -mb-1">{t('orders:product_table.total_ht')}</span>
                                    <span className="text-sm font-bold">{formatCurrency(stats.ht)}</span>
                                </div>
                                <div className="flex flex-col items-end border-l pl-4 border-base-200">
                                    <span className="text-[9px] uppercase font-bold text-base-content/40 -mb-1">TVA</span>
                                    <span className="text-sm font-bold text-base-content/70">{formatCurrency(stats.tva)}</span>
                                </div>
                                <div className="bg-primary/10 text-primary border border-primary/20 px-4 py-1.5 rounded flex flex-col items-end shadow-sm">
                                    <span className="text-[9px] uppercase font-black -mb-1">Total TTC</span>
                                    <span className="text-lg font-black leading-none">{formatCurrency(totalTTC)}</span>
                                </div>
                            </div>
                        );
                    })()}

                    {selectedRows.size > 0 && (
                        <div className="flex items-center gap-1.5 border-l pl-3 ml-1">
                            <span className="text-[10px] text-base-content/70 font-bold">{selectedRows.size} sél.</span>
                            <button type="button" className="btn btn-error btn-xs h-6 min-h-6 px-2 text-[10px]" onClick={() => setIsDeletingMultiple(true)}>
                                Suppr.
                            </button>
                            {viewMode === 'EDIT' && selectedCommande?.status === 'PREP' && (
                                <button type="button" className="btn btn-info btn-xs h-6 min-h-6 px-2 text-[10px]" onClick={openTransferModal}>
                                    ➡️
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-auto">
            {commandeProduits.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-base-content/30 gap-4 py-12">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="font-light">{t('orders:product_table.empty_state')}</p>
                </div>
            ) : (
                <table className="table table-xs table-pin-rows w-full relative">
                <thead className="sticky top-0 z-30">
                    <tr className="!bg-base-200 text-[10px] uppercase tracking-wider text-base-content/80 font-bold border-b-2 border-base-300">
                    <th className="!bg-base-200 w-8 px-2">
                        <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={selectedRows.size === commandeProduits.length && commandeProduits.length > 0}
                        onChange={toggleAllRows}
                        />
                    </th>
                    <th className="!bg-base-200 pl-2 font-bold w-[35%] min-w-[350px]">{t('orders:product_table.headers.product')}</th>
                    <th className="!bg-base-200 pl-2 font-bold w-24">{t('orders:product_table.headers.cip')}</th>
                    <th className="!bg-base-200 text-center w-14 text-orange-600 font-bold border-x border-base-300/30">{t('orders:product_table.info_row.stock', 'Stk')}</th>
                    <th className="!bg-base-200 text-right w-16 font-bold">{t('orders:product_table.headers.qty')}</th>
                    <th className="!bg-base-200 text-center w-14 font-bold text-success border-l border-base-300/30">{t('orders:product_table.headers.ug')}</th>
                    {commandeType === 'DIR' && (
                        <th className="!bg-base-200 text-right w-20 font-bold text-blue-600 border-l border-base-300/30">{t('orders:product_table.headers.dev_price')}</th>
                    )}
                    <th className="!bg-base-200 text-right w-20 font-bold border-l border-base-300/30">{t('orders:product_table.headers.buy_price_ht')}</th>
                    <th className="!bg-base-200 text-right w-14 font-bold">{t('orders:product_table.headers.tva')}</th>
                    <th className="!bg-base-200 text-right w-14 font-bold">{t('orders:product_table.headers.margin')}</th>
                    <th className="!bg-base-200 text-right w-20 font-bold border-l border-base-300/30">{t('orders:product_table.headers.sell_price')}</th>
                    <th className="!bg-base-200 text-left w-24 font-bold border-l border-base-300/30">{t('orders:product_table.headers.lot')}</th>
                    <th className="!bg-base-200 text-left w-24 font-bold border-l border-base-300/30">{t('orders:product_table.headers.exp_date')}</th>
                    <th className="!bg-base-200 w-12 rounded-tr-lg"></th>
                    </tr>
                </thead>
                <tbody>
                    {commandeProduits.map((p, index) => {
                        let produitName = '';
                        let cip = '';
                        let isExclusive = false;
                        let supplierName = '';

                        // Resolve Product Data
                        const isObjectProduit = p.produit && typeof p.produit === 'object';
                        const produitId = isObjectProduit ? (p.produit as any).id : p.produit;

                        if (isObjectProduit && (p.produit as any).name) {
                            produitName = (p.produit as any).name;
                            cip = (p.produit as any).cip1 || '';
                            isExclusive = (p.produit as any).is_supplier_exclusive || false;
                            supplierName = (p.produit as any).fournisseur_name || '';
                        } else {
                            // Try to find in produitsList (local cache)
                            const found = produitId ? produitsList.find(prod => prod.id === produitId) : null;
                            if (found) {
                                produitName = found.name;
                                cip = found.cip1 || '';
                                isExclusive = found.is_supplier_exclusive || false;
                                supplierName = found.fournisseur_name || '';
                            } else if ((p as any).produit_nom) {
                                 // Fallback to flattened fields from API
                                 produitName = (p as any).produit_nom;
                                 cip = (p as any).produit_cip || (p as any).produit_ref || '';
                            } else if (p.produit === null) {
                                produitName = t('common:unknown_product_deleted', { defaultValue: 'Produit inconnu (supprimé)' });
                            } else {
                                produitName = t('orders:product_table.unknown_product_id', { id: produitId, defaultValue: `Produit #${produitId}` });
                            }
                        }

                        const isDeleted = p.produit === null || produitName.includes('(supprimé)');

                        // Local Search Filter
                        if (searchQuery) {
                            const q = searchQuery.toLowerCase();
                            const matchesName = produitName.toLowerCase().includes(q);
                            const matchesCip = cip.toLowerCase().includes(q);
                            if (!matchesName && !matchesCip) {
                                return null;
                            }
                        }

                        return (
                        <React.Fragment key={p.id || `row-${index}`}>
                        <tr 
                            className={`hover:bg-base-50/50 group border-b border-base-100 last:border-0 ${selectedRows.has(index) ? 'bg-primary/5' : ''}`}
                        >
                            <td className="px-2">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-xs"
                                checked={selectedRows.has(index)}
                                onChange={() => toggleRowSelection(index)}
                            />
                            </td>
                            <td className="pl-2 py-0.5 min-w-[350px]">
                            <div className="font-medium text-xs">
                                <div className="flex items-center gap-1">
                                    <span className={`${isDeleted ? 'italic text-base-content/50' : ''} whitespace-nowrap overflow-hidden text-ellipsis`} title={produitName}>
                                        {produitName}
                                    </span>
                                    {isExclusive && (
                                        <div 
                                            className="tooltip tooltip-right z-50 inline-flex shrink-0" 
                                            data-tip={t('orders:product_table.exclusivity_tooltip', { provider: supplierName || t('orders:product_table.specific_provider') })}
                                        >
                                            <span className="badge badge-success badge-xs font-bold text-white w-4 h-4 p-0 flex items-center justify-center text-[8px]">
                                              E
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            </td>
                            {/* CIP Column */}
                        <td className="pl-2 py-0.5">
                            <span className="text-xs font-mono font-bold text-base-content/80">
                                {(() => {
                                    if (p.produit && typeof p.produit === 'object' && p.produit.cip1) return p.produit.cip1;
                                    const produitId = (p.produit && typeof p.produit === 'object') ? p.produit.id : p.produit;
                                    const found = produitsList.find(prod => prod.id === produitId);
                                    if (found && found.cip1) return found.cip1;
                                    const flatCip = (p as any).cip || (p as any).produit_cip || (p as any).produit_ref;
                                    if (flatCip && flatCip !== (p as any).produit_nom) return flatCip;
                                    return '-';
                                })()}
                            </span>
                        </td>
                        {/* Stock Actuel */}
                        <td className="text-center py-0.5 bg-orange-50/20">
                            {(() => {
                                const currentStock = (p.produit && typeof p.produit === 'object' && p.produit.stock !== undefined) 
                                    ? p.produit.stock 
                                    : (p as any).produit_stock ?? 0;
                                return (
                                    <span className={`text-[10px] font-bold px-1 rounded ${currentStock <= 0 ? 'text-error bg-error/10' : 'text-orange-600'}`}>
                                        {currentStock}
                                    </span>
                                );
                            })()}
                        </td>
                        {/* Quantity (0) */}
                        <td className="text-right py-0.5">
                        <input
                            type="text"
                            data-row={index}
                            data-field="quantity"
                            value={p.quantity}
                            onChange={(e) => updateCommandeProduitField(index, 'quantity', e.target.value)}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, 0)}
                            onFocus={handleSelectAll}
                            className={`input input-ghost h-7 min-h-7 px-1 text-sm w-full text-right font-bold focus:bg-base-100 focus:text-primary ${!fieldsConfig[0].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                            autoFocus={focusedField?.row === index && focusedField?.field === 0}
                            readOnly={!fieldsConfig[0].editable}
                            tabIndex={!fieldsConfig[0].editable ? -1 : 0}
                        />
                        </td>
                        {/* Unites Gratuites (1) */}
                        <td className="text-center py-0.5">
                        <input
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
                            className={`input input-ghost h-7 min-h-7 px-1 text-xs w-full text-center font-bold bg-success/5 focus:bg-success/10 focus:text-success ${!fieldsConfig[1].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                            placeholder="0"
                            autoFocus={focusedField?.row === index && focusedField?.field === 1}
                            readOnly={!fieldsConfig[1].editable}
                            tabIndex={!fieldsConfig[1].editable ? -1 : 0}
                        />
                        </td>
                        {/* Prix Euro (Direct Only) */}
                        {commandeType === 'DIR' && (
                            <td className="text-right py-0.5 bg-blue-50/10 border-l border-blue-100">
                            <input
                                type="text"
                                data-row={index}
                                data-field="prix_euro"
                                value={p.prix_euro || ''}
                                onChange={(e) => updateCommandeProduitField(index, 'prix_euro', e.target.value)}
                                onFocus={handleSelectAll}
                                onKeyDown={(e) => handleTableFieldKeyDown(e, index, 2)}
                                className="input input-ghost h-7 min-h-7 px-1 text-sm w-full text-right focus:bg-blue-50 focus:text-blue-600 font-mono"
                                placeholder="..."
                            />
                            </td>
                        )}
                        {/* Price (2) */}
                        <td className="text-right py-0.5">
                        <input
                            type="text"
                            data-row={index}
                            data-field="price"
                            value={p.price}
                            onChange={(e) => updateCommandeProduitField(index, 'price', e.target.value)}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, (commandeType === 'DIR' ? 3 : 2))}
                            onFocus={handleSelectAll}
                            className={`input input-ghost h-7 min-h-7 px-1 text-sm w-full text-right focus:bg-base-100 focus:text-primary ${!fieldsConfig[2].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                            autoFocus={focusedField?.row === index && focusedField?.field === 2}
                            readOnly={!fieldsConfig[2].editable}
                            tabIndex={!fieldsConfig[2].editable ? -1 : 0}
                        />
                        </td>
                        {/* TVA (3) */}
                        <td className="text-right py-0.5">
                        <input
                            type="text"
                            data-row={index}
                            data-field="tva"
                            value={p.tva || ''}
                            onChange={(e) => updateCommandeProduitField(index, 'tva', e.target.value)}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, (commandeType === 'DIR' ? 4 : 3))}
                            onFocus={handleSelectAll}
                            className={`input input-ghost h-7 min-h-7 px-1 text-sm w-full text-right opacity-70 focus:opacity-100 ${!fieldsConfig[3].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                            autoFocus={focusedField?.row === index && focusedField?.field === 3}
                            readOnly={!fieldsConfig[3].editable}
                            tabIndex={!fieldsConfig[3].editable ? -1 : 0}
                        />
                        </td>
                        {/* Marge (4) */}
                        <td className="text-right py-0.5">
                        <input
                            type="text"
                            data-row={index}
                            data-field="marge"
                            value={p.marge || ''}
                            onChange={(e) => updateCommandeProduitField(index, 'marge', e.target.value)}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, (commandeType === 'DIR' ? 5 : 4))}
                            onFocus={handleSelectAll}
                            className={`input input-ghost h-7 min-h-7 px-1 text-sm w-full text-right font-bold focus:bg-base-100 ${Number(p.marge || 0) >= 1.34 ? 'text-success' : 'text-warning'} ${!fieldsConfig[4].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                            autoFocus={focusedField?.row === index && focusedField?.field === 4}
                            readOnly={!fieldsConfig[4].editable}
                            tabIndex={!fieldsConfig[4].editable ? -1 : 0}
                        />
                        </td>
                        {/* Selling Price (5) */}
                        <td className="text-right py-0.5">
                        <input
                            type="text"
                            data-row={index}
                            data-field="selling_price"
                            value={p.selling_price}
                            onChange={(e) => updateCommandeProduitField(index, 'selling_price', e.target.value)}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, (commandeType === 'DIR' ? 6 : 5))}
                            onFocus={handleSelectAll}
                            className={`input input-ghost h-7 min-h-7 px-1 text-sm w-full text-right font-bold focus:bg-base-100 focus:text-primary ${!fieldsConfig[5].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                            autoFocus={focusedField?.row === index && focusedField?.field === 5}
                            readOnly={!fieldsConfig[5].editable}
                            tabIndex={!fieldsConfig[5].editable ? -1 : 0}
                        />
                        </td>
                        {/* Lot (6) */}
                        <td className="text-left py-0.5">
                        <input
                            type="text"
                            data-row={index}
                            data-field="lot"
                            value={p.lot || ''}
                            onChange={(e) => updateCommandeProduitField(index, 'lot', e.target.value)}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, (commandeType === 'DIR' ? 7 : 6))}
                            onFocus={handleSelectAll}
                            className={`input input-ghost h-7 min-h-7 px-1 text-[10px] w-full focus:bg-base-100 ${!fieldsConfig[6].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                            placeholder="Lot"
                            autoFocus={focusedField?.row === index && focusedField?.field === 6}
                            readOnly={!fieldsConfig[6].editable}
                            tabIndex={!fieldsConfig[6].editable ? -1 : 0}
                        />
                        </td>
                        {/* Expiration (7) */}
                        <td className="text-left py-0.5">
                        <input
                            type="text"
                            data-row={index}
                            data-field="date_expiration"
                            value={p.date_expiration || ''}
                            onChange={(e) => updateCommandeProduitField(index, 'date_expiration', e.target.value)}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, (commandeType === 'DIR' ? 8 : 7))}
                            onFocus={handleSelectAll}
                            className={`input input-ghost h-7 min-h-7 px-1 text-[10px] w-full focus:bg-base-100 ${!fieldsConfig[7].editable ? 'bg-base-200 cursor-not-allowed' : ''} ${p.date_expiration && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(p.date_expiration) ? 'input-error text-error' : ''}`}
                            placeholder="MM/YY"
                            maxLength={5}
                            autoFocus={focusedField?.row === index && focusedField?.field === 7}
                            readOnly={!fieldsConfig[7].editable}
                            tabIndex={!fieldsConfig[7].editable ? -1 : 0}
                        />
                        </td>
                        <td className="w-12 text-center p-0">
                            <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100">
                                <button type="button" className="btn btn-ghost btn-xs h-6 w-6 p-0 text-info" onClick={() => setExpandedRow(expandedRow === index ? null : index)}>ℹ️</button>
                                <button type="button" className="btn btn-ghost btn-xs h-6 w-6 p-0 text-error" onClick={() => setProductToDelete(index)}>🗑️</button>
                            </div>
                        </td>
                    </tr>
                    
                    {/* Collapsible Info Row */}
                    {expandedRow === index && (
                        <tr className="bg-blue-50/30 border-b border-base-200">
                            <td colSpan={14} className="p-0">
                                {(() => {
                                    // Extract stats either from full product object or from flattened serializer fields
                                    const pObj = (p.produit && typeof p.produit === 'object') ? p.produit : null;
                                    const pAny = p as any;
                                    
                                    // Merge available data
                                    const stats = {
                                        dernier_achat: (pObj as any)?.dernier_achat || pAny.produit_dernier_achat,
                                        dernier_vente: (pObj as any)?.dernier_vente || pAny.produit_dernier_vente,
                                        rotation_moyenne: pObj?.rotation_moyenne || pAny.produit_rotation_moyenne,
                                        stock_minimum: pObj?.stock_minimum || pAny.produit_stock_minimum || 0,
                                        stock_maximum: (pObj as any)?.stock_maximum || pAny.produit_stock_maximum || 0,
                                        stock_alert: pObj?.stock_alert || pAny.produit_stock_alert || 0,
                                        cost_price: (pObj as any)?.cost_price || pAny.produit_cost_price || p.price,
                                        stock: pObj?.stock ?? pAny.produit_stock ?? 0,
                                    };
                                    
                                    const formatAchat = stats.dernier_achat ? new Date(stats.dernier_achat).toLocaleDateString(t('common:locale', 'fr-FR'), { day: 'numeric', month: 'long', year: 'numeric' }) : 'Inconnu';
                                    const formatVente = stats.dernier_vente ? new Date(stats.dernier_vente).toLocaleDateString(t('common:locale', 'fr-FR'), { day: 'numeric', month: 'long', year: 'numeric' }) : 'Jamais';
                                    
                                    return (
                                        <div className="p-4 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 text-sm">
                                            <div>
                                                <div className="text-xs uppercase font-bold text-base-content/50 mb-1">{t('orders:product_table.info_row.purchase_history', "Historique d'Achat")}</div>
                                                <div className="font-medium text-base-content">{formatAchat}</div>
                                                <div className="text-xs text-base-content/60 mt-0.5">{t('orders:product_table.info_row.last_buy_price', "Dernier prix d'achat")}: {stats.cost_price ? formatCurrency(Number(stats.cost_price)) : '-'}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs uppercase font-bold text-base-content/50 mb-1">{t('orders:product_table.info_row.sales_history', "Historique de Vente")}</div>
                                                <div className="font-medium text-base-content">{formatVente}</div>
                                                {stats.rotation_moyenne && (
                                                    <div className="text-xs text-info mt-0.5 font-medium">{t('orders:product_table.info_row.rotation', 'Rotation')}: {Number(stats.rotation_moyenne).toFixed(2)} / jour</div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-xs uppercase font-bold text-base-content/50 mb-1">{t('orders:product_table.info_row.stock_alerts', 'Alertes Stock')}</div>
                                                <div className="font-medium">
                                                    Min: <span className="text-warning">{stats.stock_minimum}</span> / Max: <span className="text-success">{stats.stock_maximum}</span>
                                                </div>
                                                {stats.stock_alert > 0 && (
                                                    <div className="text-xs text-error mt-0.5">{t('orders:product_table.info_row.alert_threshold', "Seuil d'alerte")}: {stats.stock_alert}</div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-xs uppercase font-bold text-base-content/50 mb-1">{t('orders:product_table.info_row.indicators', 'Indicateurs')}</div>
                                                <div className="flex flex-col gap-1">
                                                    {stats.stock <= 0 ? (
                                                        <div className="text-xs text-error font-medium">⚠️ {t('orders:product_table.info_row.stock_out', 'Stock en rupture')}</div>
                                                    ) : stats.rotation_moyenne && Number(stats.rotation_moyenne) > 0 ? (
                                                        <div className="text-xs">
                                                            {t('orders:product_table.info_row.stock_life', "Durée de vie stock actuel")}: <span className="font-bold">~{Math.round(stats.stock / Number(stats.rotation_moyenne))} j</span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-base-content/50">{t('orders:product_table.info_row.rotation_unknown', 'Rotation inconnue')}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </td>
                        </tr>
                    )}
                    </React.Fragment>
                    );
                    })}
                </tbody>
                <tfoot className="sticky bottom-0 z-30">
                    <tr className="!bg-base-200 text-[10px] uppercase font-bold text-base-content/70 border-t-2 border-base-300 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                        <th colSpan={3} className="!bg-base-200 pl-4 py-2">Fin de liste - {commandeProduits.length} articles</th>
                        <th className="!bg-base-200 py-2"></th>
                        <th className="!bg-base-200 py-2"></th>
                        <th className="!bg-base-200 py-2"></th>
                        {commandeType === 'DIR' && <th className="!bg-base-200 py-2"></th>}
                        <th className="!bg-base-200 py-2"></th>
                        <th className="!bg-base-200 py-2"></th>
                        <th className="!bg-base-200 py-2"></th>
                        <th className="!bg-base-200 py-2"></th>
                        <th className="!bg-base-200 py-2"></th>
                        <th className="!bg-base-200 py-2"></th>
                        <th className="!bg-base-200 py-2 rounded-br-lg"></th>
                    </tr>
                </tfoot>
                </table>
            )}
            </div>

            {/* Deletion Modals */}
            {productToDelete !== null && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg text-error">{t('common:confirm_deletion', 'Confirmer la suppression')}</h3>
                        <p className="py-4">{t('orders:messages.remove_product_confirm', 'Êtes-vous sûr de vouloir retirer ce produit de la commande ?')}</p>
                        <div className="modal-action">
                            <button className="btn btn-ghost" onClick={() => setProductToDelete(null)}>{t('common:cancel', 'Annuler')}</button>
                            <button className="btn btn-error text-white" onClick={() => {
                                onRemoveProduct(productToDelete);
                                setProductToDelete(null);
                            }}>{t('common:confirm', 'Confirmer')}</button>
                        </div>
                    </div>
                </div>
            )}

            {isDeletingMultiple && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg text-error">{t('orders:bulk_delete_title', 'Confirmer la suppression multiple')}</h3>
                        <p className="py-4">{t('orders:bulk_delete_confirm_minimal', { count: selectedRows.size, defaultValue: `Êtes-vous sûr de vouloir supprimer les ${selectedRows.size} produits sélectionnés ?` })}</p>
                        <div className="modal-action">
                            <button className="btn btn-ghost" onClick={() => setIsDeletingMultiple(false)}>{t('common:cancel', 'Annuler')}</button>
                            <button className="btn btn-error text-white" onClick={() => {
                                deleteSelectedRows();
                                setIsDeletingMultiple(false);
                            }}>{t('common:confirm', 'Confirmer')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
