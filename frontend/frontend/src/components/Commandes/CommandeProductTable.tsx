import React, { useState } from 'react';
import type { CommandeProduit, ProduitModel, Commande } from '../../types';
import { useTranslation } from 'react-i18next';

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
    lastSaved: Date | null;
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
    lastSaved,
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
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    
    // Auto-select content when input receives focus
    const handleSelectAll = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };
    
    return (
        <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl shadow-sm border border-base-200">
            <div className="p-4 border-b border-base-100 flex justify-between items-center shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-4 flex-wrap">
                <h2 className="font-bold text-sm md:text-base text-base-content whitespace-nowrap">
                {t('orders.product_table.title', { count: commandeProduits.length })}
                </h2>
                {/* SEARCH INPUT */}
                {commandeProduits.length > 0 && (
                    <div className="relative">
                        <input
                            type="text"
                            placeholder={t('orders.product_table.search_placeholder', 'Rechercher un produit...')}
                            className="input input-sm input-bordered w-full sm:w-64 pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-2.5 top-2.5 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {searchQuery && (
                            <button 
                                className="btn btn-ghost btn-xs btn-circle absolute right-1 top-1.5"
                                onClick={() => setSearchQuery('')}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                )}
                {commandeProduits.length > 0 && onSortProduits && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-base-content/60 font-medium whitespace-nowrap">Trier par:</span>
                        <select 
                            className="select select-bordered select-sm text-xs" 
                            value={commandeSortBy || 'chrono'} 
                            onChange={(e) => onSortProduits(e.target.value as any)}
                        >
                            <option value="chrono">Chronologie</option>
                            <option value="stock">Qté en stock</option>
                            <option value="name">Nom</option>
                            <option value="qty">Qté saisie</option>
                        </select>
                    </div>
                )}
                <div className="flex items-center gap-2 md:gap-4 overflow-x-auto">
                    {saving && <span className="text-sm text-warning animate-pulse">{t('orders.form.saving')}</span>}
                    {!saving && lastSaved && <span className="text-xs text-success hidden md:inline">{t('orders.product_table.saved_at', { time: lastSaved.toLocaleTimeString() })}</span>}
                    
                    {(() => {
                        const stats = commandeProduits.reduce((acc, p) => {
                            const qty = Number(p.quantity || 0);
                            const price = Number(p.price || 0);
                            const tvaRate = Number(p.tva || 0);
                            
                            const lineHT = qty * price;
                            const lineTVA = lineHT * (tvaRate / 100);
                            
                            return {
                                ht: acc.ht + lineHT,
                                tva: acc.tva + lineTVA
                            };
                        }, { ht: 0, tva: 0 });
                        
                        const totalTTC = stats.ht + stats.tva;
                        
                        return (
                            <div className="flex gap-2 text-xs md:text-sm">
                                <div className="bg-base-200 px-2 py-1 rounded flex flex-col items-end">
                                    <span className="text-[10px] text-base-content/60 uppercase">{t('orders.product_table.total_ht')}</span>
                                    <span className="font-bold">{stats.ht.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} F</span>
                                </div>
                                <div className="bg-base-200 px-2 py-1 rounded flex flex-col items-end">
                                    <span className="text-[10px] text-base-content/60 uppercase">{t('orders.product_table.total_tva')}</span>
                                    <span className="font-bold">{stats.tva.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} F</span>
                                </div>
                                <div className="bg-primary/10 px-3 py-1 rounded-lg flex flex-col items-end border border-primary/20">
                                    <span className="text-[10px] text-primary/70 uppercase">{t('orders.product_table.total_ttc')}</span>
                                    <span className="font-bold text-primary">{totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} F</span>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>
            {selectedRows.size > 0 && (
                <div className="flex items-center gap-2">
                <span className="text-sm text-base-content/70">{t('orders.product_table.selected_count', { count: selectedRows.size })}</span>
                <button
                    type="button"
                    className="btn btn-error btn-xs"
                    onClick={deleteSelectedRows}
                >
                    {t('orders.product_table.delete_btn')}
                </button>
                {/* Bouton Transférer - visible uniquement en mode EDIT sur commande PREP */}
                {viewMode === 'EDIT' && selectedCommande?.status === 'PREP' && (
                    <button
                    type="button"
                    className="btn btn-info btn-xs gap-1"
                    onClick={openTransferModal}
                    >
                    ➡️ {t('orders.product_table.transfer_btn')}
                    </button>
                )}
                </div>
            )}
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-auto">
            {commandeProduits.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-base-content/30 gap-4 py-12">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="font-light">{t('orders.product_table.empty_state')}</p>
                </div>
            ) : (
                <table className="table table-pin-rows w-full">
                <thead>
                    <tr className="bg-base-50 text-xs uppercase tracking-wider text-base-content/60 font-semibold border-b border-base-200">
                    <th className="bg-base-50 w-12">
                        <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={selectedRows.size === commandeProduits.length && commandeProduits.length > 0}
                        onChange={toggleAllRows}
                        />
                    </th>
                    <th className="bg-base-200 pl-4 font-semibold text-xs uppercase">{t('orders.product_table.headers.product')}</th>
                    <th className="bg-base-200 pl-2 font-semibold text-xs uppercase w-28">{t('orders.product_table.headers.cip')}</th>
                    <th className="bg-base-200 text-center w-24 font-semibold text-xs uppercase text-orange-600 bg-orange-50">Stock</th>
                    <th className="bg-base-200 text-right w-24 font-semibold text-xs uppercase">{t('orders.product_table.headers.qty')}</th>
                    <th className="bg-base-200 text-center w-20 bg-success/10 font-semibold text-xs uppercase text-success">{t('orders.product_table.headers.ug')}</th>
                    {commandeType === 'DIR' && (
                        <th className="bg-base-200 text-right w-28 font-semibold text-xs uppercase text-blue-600 bg-blue-50">{t('orders.product_table.headers.dev_price')}</th>
                    )}
                    <th className="bg-base-200 text-right w-32 font-semibold text-xs uppercase">{t('orders.product_table.headers.buy_price_ht')}</th>
                    <th className="bg-base-200 text-right w-24 font-semibold text-xs uppercase">{t('orders.product_table.headers.tva')}</th>
                    <th className="bg-base-200 text-right w-24 font-semibold text-xs uppercase">{t('orders.product_table.headers.margin')}</th>
                    <th className="bg-base-200 text-right w-32 font-semibold text-xs uppercase">{t('orders.product_table.headers.sell_price')}</th>
                    <th className="bg-base-200 text-left w-32 font-semibold text-xs uppercase">{t('orders.product_table.headers.lot')}</th>
                    <th className="bg-base-200 text-left w-36 font-semibold text-xs uppercase">{t('orders.product_table.headers.exp_date')}</th>
                    <th className="bg-base-200 w-10"></th>
                    </tr>
                </thead>
                <tbody>
                    {commandeProduits.map((p, index) => {
                        let name = '';
                        let cip = '';
                        let isExclusive = false;
                        let supplierName = '';

                        // Resolve Product Data
                        if (typeof p.produit === 'object' && p.produit.name) {
                            name = p.produit.name;
                            cip = p.produit.cip1 || '';
                            isExclusive = p.produit.is_supplier_exclusive || false;
                            supplierName = p.produit.fournisseur_name || '';
                        } else {
                            // Try to find in produitsList
                            const produitId = typeof p.produit === 'object' ? p.produit.id : p.produit;
                            const found = produitsList.find(prod => prod.id === produitId);
                            if (found) {
                                name = found.name;
                                cip = found.cip1 || '';
                                isExclusive = found.is_supplier_exclusive || false;
                                supplierName = found.fournisseur_name || '';
                            } else if ((p as any).produit_nom) {
                                 // Fallback to flattened fields from API
                                 name = (p as any).produit_nom;
                                 cip = (p as any).cip || (p as any).produit_cip || (p as any).produit_ref || ''; 
                                 if (cip === name) cip = ''; // Avoid dupes if ref is name
                            } else {
                                name = `Produit #${produitId}`;
                            }
                        }

                        // Local Search Filter
                        if (searchQuery) {
                            const q = searchQuery.toLowerCase();
                            const matchesName = name.toLowerCase().includes(q);
                            const matchesCip = cip.toLowerCase().includes(q);
                            if (!matchesName && !matchesCip) {
                                return null;
                            }
                        }

                        return (
                        <tr 
                            key={p.id || `row-${index}`} 
                            className={`hover:bg-base-50/50 group border-b border-base-100 last:border-0 ${selectedRows.has(index) ? 'bg-primary/5' : ''}`}
                        >
                            <td>
                            <input
                                type="checkbox"
                                className="checkbox checkbox-xs"
                                checked={selectedRows.has(index)}
                                onChange={() => toggleRowSelection(index)}
                            />
                            </td>
                            <td className="pl-4 py-2 md:py-3">
                            <div className="font-medium text-sm">
                                <div className="flex items-center gap-1 flex-wrap">
                                    <span className="break-words max-w-[200px]">
                                        {name}
                                    </span>
                                    {isExclusive && (
                                        <div 
                                            className="tooltip tooltip-right z-50 ml-1 inline-flex shrink-0" 
                                            data-tip={t('orders.product_table.exclusivity_tooltip', { provider: supplierName || t('orders.product_table.specific_provider') })}
                                        >
                                            <span className="badge badge-success badge-sm font-bold text-white w-5 h-5 p-0 flex items-center justify-center text-[10px]">
                                              E
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            </td>
                            {/* CIP Column */}
                        <td className="pl-2 py-2 md:py-3">
                            <span className="text-xs font-mono text-base-content/70">
                                {(() => {
                                    // 1. Try direct object
                                    if (typeof p.produit === 'object' && p.produit.cip1) return p.produit.cip1;
                                    
                                    // 2. Try lookup in list
                                    const produitId = typeof p.produit === 'object' ? p.produit.id : p.produit;
                                    const found = produitsList.find(prod => prod.id === produitId);
                                    if (found && found.cip1) return found.cip1;
                                    
                                    // 3. Fallback to flat fields
                                    const flatCip = (p as any).cip || (p as any).produit_cip || (p as any).produit_ref;
                                    if (flatCip && flatCip !== (p as any).produit_nom) return flatCip;
                                    
                                    return '-';
                                })()}
                            </span>
                        </td>
                        {/* Stock Actuel */}
                        <td className="text-center py-2 md:py-3 bg-orange-50/20">
                            {(() => {
                                const currentStock = (typeof p.produit === 'object' && p.produit.stock !== undefined) 
                                    ? p.produit.stock 
                                    : (p as any).produit_stock ?? 0;
                                
                                return (
                                    <span className={`text-xs font-bold px-2 py-1 rounded ${currentStock <= 0 ? 'text-error bg-error/10' : 'text-orange-600 bg-orange-100/50'}`}>
                                        {currentStock}
                                    </span>
                                );
                            })()}
                        </td>
                        {/* Quantity (0) */}
                        <td className="text-right py-2 md:py-3">
                        <input
                            type="text"
                            data-row={index}
                            data-field={0}
                            value={p.quantity}
                            onChange={(e) => updateCommandeProduitField(index, 'quantity', e.target.value)}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, 0)}
                            onFocus={handleSelectAll}
                            className={`input input-ghost input-sm text-base w-full text-right font-medium focus:bg-base-100 focus:text-primary ${!fieldsConfig[0].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                            autoFocus={focusedField?.row === index && focusedField?.field === 0}
                            readOnly={!fieldsConfig[0].editable}
                            tabIndex={!fieldsConfig[0].editable ? -1 : 0}
                        />
                        </td>
                        {/* Unites Gratuites (1) - NEW */}
                        <td className="text-center py-2 md:py-3">
                        <input
                            type="text"
                            inputMode="numeric"
                            data-row={index}
                            data-field={1}
                            value={p.unites_gratuites || 0}
                            onChange={(e) => {
                            const val = e.target.value;
                            if (/^\d*$/.test(val)) {
                                updateCommandeProduitField(index, 'unites_gratuites', val === '' ? 0 : parseInt(val));
                            }
                            }}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, 1)}
                            onFocus={handleSelectAll}
                            className={`input input-ghost input-sm text-sm w-full text-center font-medium bg-success/10 focus:bg-success/20 focus:text-success ${!fieldsConfig[1].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                            placeholder="0"
                            autoFocus={focusedField?.row === index && focusedField?.field === 1}
                            readOnly={!fieldsConfig[1].editable}
                            tabIndex={!fieldsConfig[1].editable ? -1 : 0}
                        />
                        </td>
                        {/* Prix Euro (Direct Only) - with keyboard navigation */}
                        {commandeType === 'DIR' && (
                            <td className="text-right py-2 md:py-3 bg-blue-50/10 border-l border-blue-100">
                            <input
                                type="text"
                                data-row={index}
                                data-field="euro"
                                value={p.prix_euro || ''}
                                onChange={(e) => updateCommandeProduitField(index, 'prix_euro', e.target.value)}
                                onFocus={handleSelectAll}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === 'Tab') {
                                        e.preventDefault();
                                        // Move to price field (field 2)
                                        setTimeout(() => {
                                            const nextInput = document.querySelector(
                                                `input[data-row="${index}"][data-field="2"]`
                                            ) as HTMLInputElement;
                                            nextInput?.focus();
                                            nextInput?.select();
                                        }, 0);
                                    }
                                }}
                                className="input input-ghost input-sm text-base w-full text-right focus:bg-blue-50 focus:text-blue-600 font-mono"
                                placeholder="Dev."
                            />
                            </td>
                        )}
                        {/* Price (2) - Index updated */}
                        <td className="text-right py-2 md:py-3">
                        <input
                            type="text"
                            data-row={index}
                            data-field={2}
                            value={p.price}
                            onChange={(e) => updateCommandeProduitField(index, 'price', e.target.value)}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, 2)}
                            onFocus={handleSelectAll}
                            className={`input input-ghost input-sm text-base w-full text-right focus:bg-base-100 focus:text-primary ${!fieldsConfig[2].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                            autoFocus={focusedField?.row === index && focusedField?.field === 2}
                            readOnly={!fieldsConfig[2].editable}
                            tabIndex={!fieldsConfig[2].editable ? -1 : 0}
                        />
                        </td>
                        {/* TVA (3) - Index updated */}
                        <td className="text-right py-2 md:py-3">
                        <input
                            type="text"
                            data-row={index}
                            data-field={3}
                            value={p.tva || ''}
                            onChange={(e) => updateCommandeProduitField(index, 'tva', e.target.value)}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, 3)}
                            onFocus={handleSelectAll}
                            className={`input input-ghost input-sm text-base w-full text-right focus:bg-base-100 focus:text-primary ${!fieldsConfig[3].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                            autoFocus={focusedField?.row === index && focusedField?.field === 3}
                            readOnly={!fieldsConfig[3].editable}
                            tabIndex={!fieldsConfig[3].editable ? -1 : 0}
                        />
                        </td>
                        {/* Marge (4) - Index updated */}
                        <td className="text-right py-2 md:py-3">
                        <input
                            type="text"
                            data-row={index}
                            data-field={4}
                            value={p.marge || ''}
                            onChange={(e) => updateCommandeProduitField(index, 'marge', e.target.value)}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, 4)}
                            onFocus={handleSelectAll}
                            className={`input input-ghost input-sm text-base w-full text-right focus:bg-base-100 focus:text-primary ${!fieldsConfig[4].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                            autoFocus={focusedField?.row === index && focusedField?.field === 4}
                            readOnly={!fieldsConfig[4].editable}
                            tabIndex={!fieldsConfig[4].editable ? -1 : 0}
                        />
                        </td>
                        {/* Selling Price (5) - Index updated */}
                        <td className="text-right py-2 md:py-3">
                        <input
                            type="text"
                            data-row={index}
                            data-field={5}
                            value={p.selling_price}
                            onChange={(e) => updateCommandeProduitField(index, 'selling_price', e.target.value)}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, 5)}
                            onFocus={handleSelectAll}
                            className={`input input-ghost input-sm text-base w-full text-right focus:bg-base-100 focus:text-primary ${!fieldsConfig[5].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                            autoFocus={focusedField?.row === index && focusedField?.field === 5}
                            readOnly={!fieldsConfig[5].editable}
                            tabIndex={!fieldsConfig[5].editable ? -1 : 0}
                        />
                        </td>
                        {/* Lot (6) - Index updated */}
                        <td className="text-left py-2 md:py-3">
                        <input
                            type="text"
                            data-row={index}
                            data-field={6}
                            value={p.lot || ''}
                            onChange={(e) => updateCommandeProduitField(index, 'lot', e.target.value)}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, 6)}
                            onFocus={handleSelectAll}
                            className={`input input-ghost input-sm text-xs w-full focus:bg-base-100 focus:text-primary ${!fieldsConfig[6].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                            placeholder="N° Lot"
                            autoFocus={focusedField?.row === index && focusedField?.field === 6}
                            readOnly={!fieldsConfig[6].editable}
                            tabIndex={!fieldsConfig[6].editable ? -1 : 0}
                        />
                        </td>
                        {/* Expiration (7) - Index updated */}
                        <td className="text-left py-2 md:py-3">
                        <input
                            type="text"
                            data-row={index}
                            data-field={7}
                            value={p.date_expiration || ''}
                            onChange={(e) => updateCommandeProduitField(index, 'date_expiration', e.target.value)}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, 7)}
                            onFocus={handleSelectAll}
                            className={`input input-ghost input-sm text-xs w-full focus:bg-base-100 focus:text-primary ${!fieldsConfig[7].editable ? 'bg-base-200 cursor-not-allowed' : ''} ${p.date_expiration && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(p.date_expiration) ? 'input-error' : ''}`}
                            placeholder="MM/YY"
                            maxLength={5}
                            autoFocus={focusedField?.row === index && focusedField?.field === 7}
                            readOnly={!fieldsConfig[7].editable}
                            tabIndex={!fieldsConfig[7].editable ? -1 : 0}
                        />
                        </td>
                        {/* Delete Button */}
                        <td className="w-10 text-center">
                        <button 
                            type="button"
                            className="btn btn-ghost btn-xs text-error opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => onRemoveProduct(index)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                        </td>
                    </tr>
                    );
                    })}
                </tbody>
                </table>
            )}
            </div>
        </div>
    );
}
