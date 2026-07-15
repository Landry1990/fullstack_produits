import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Search, Info, Trash2, Package } from 'lucide-react';
import type { CommandeProduit, ProduitModel, Commande } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { usePharmacySettings } from '../../context/PharmacySettingsContext';
import { Button } from '../ui/Button';
import { Input } from '../shadcn/input';
import { Checkbox } from '../shadcn/checkbox';
import { Select } from '../ui/Select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../shadcn/dialog';



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

    onViewProductDetails?: (produitId: number) => void;

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

    highlightedIndex?: number | null;

}

const normalizeExpiryMMYY = (raw: string) => {
    const cleaned = String(raw ?? '').replace(/\s/g, '').replace(/[^0-9/]/g, '');
    if (cleaned === '') return '';
    const digits = cleaned.replace(/\//g, '').slice(0, 4);
    if (digits.length <= 2) {
        return digits;
    }
    const mm = digits.slice(0, 2);
    const yy = digits.slice(2);
    return `${mm}/${yy}`;
};

const finalizeExpiryMMYY = (raw: string) => {
    const normalized = normalizeExpiryMMYY(raw);
    const match = normalized.match(/^(\d{1,2})(?:\/(\d{0,2}))?$/);
    if (!match) return '';
    const mmRaw = match[1] || '';
    const yyRaw = match[2] || '';
    if (mmRaw.length === 0) return '';
    const mmNum = Number(mmRaw);
    if (!Number.isFinite(mmNum) || mmNum < 1 || mmNum > 12) return '';
    if (yyRaw.length !== 2) return `${String(mmNum).padStart(2, '0')}${yyRaw ? `/${yyRaw}` : ''}`;
    return `${String(mmNum).padStart(2, '0')}/${yyRaw}`;
};

const handleSelectAll = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
};


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

    handleTableFieldKeyDown,

    onRemoveProduct,

    commandeSortBy,

    onSortProduits,

    highlightedIndex = null

}: CommandeProductTableProps) {

    const { t } = useTranslation(['orders', 'common']);
    const { settings: pharmacySettings } = usePharmacySettings();
    const marginThreshold = pharmacySettings?.min_margin_threshold ?? 1.34;

    const [searchQuery, setSearchQuery] = useState('');

    const [expandedRow, setExpandedRow] = useState<number | null>(null);

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



    // Deletion Modal State

    const [productToDelete, setProductToDelete] = useState<number | null>(null);

    const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);

    

    return (

        <div ref={tableRef} onKeyDownCapture={handleTableKeyDownCapture} className="flex-1 min-h-0 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200">

            <div className="py-1.5 px-3 border-b border-slate-200 flex justify-between items-center shrink-0 flex-wrap gap-x-4 gap-y-2">

                {/* PARTIE GAUCHE: Titre + Recherche + Tri */}

                <div className="flex items-center gap-2 flex-wrap">

                    <h2 className="font-bold text-xs text-slate-800 whitespace-nowrap">

                    📦 {commandeProduits.length}

                    </h2>

                    {/* SEARCH INPUT COMPACT */}

                    {commandeProduits.length > 0 && (

                        <div className="relative">

                            <Input

                                type="text"

                                placeholder={t('orders:product_table.search_placeholder')}

                                className="w-40 h-7 pl-7 text-xs"

                                value={searchQuery}

                                onChange={(e) => setSearchQuery(e.target.value)}

                            />

                            <Search className="h-3 w-3 absolute left-2 top-2 text-slate-400" />

                        </div>

                    )}

                    {commandeProduits.length > 0 && onSortProduits && (

                        <Select

                            size="sm"
                            className="text-[10px] h-7"

                            value={commandeSortBy || 'chrono'}

                            onChange={(e) => onSortProduits(e.target.value as any)}

                        >

                            <option value="chrono">🕒 {t('orders:product_table.sort_options.chrono')}</option>

                            <option value="stock">📦 {t('orders:product_table.sort_options.stock')}</option>

                            <option value="name">ABC {t('orders:product_table.sort_options.name')}</option>

                            <option value="qty">🔢 {t('orders:product_table.sort_options.qty')}</option>

                        </Select>

                    )}

                    {saving && <span className="text-[10px] text-amber-600 animate-pulse font-bold">{t('orders:form.saving')}</span>}

                </div>

                

                {/* PARTIE DROITE: ACTIONS SÉLECTION */}

                <div className="flex items-center gap-3">

                    {selectedRows.size > 0 && (

                        <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3 ml-1">

                            <span className="text-[10px] text-slate-500 font-bold">{selectedRows.size} sél.</span>

                            <Button type="button" variant="danger" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setIsDeletingMultiple(true)}>

                                Suppr.

                            </Button>

                            {viewMode === 'EDIT' && selectedCommande?.status === 'PREP' && (

                                <Button

                                    type="button"

                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[10px] flex items-center gap-1 border-blue-500 text-blue-600 hover:bg-blue-50"

                                    onClick={openTransferModal}

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



            <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[60vh]">

            {commandeProduits.length === 0 ? (

                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 py-12">

                <Package className="h-16 w-16 text-slate-200" />

                <p className="font-light">{t('orders:product_table.empty_e')}</p>

                </div>

            ) : (

                <table className="w-full relative text-sm">

                <thead className="sticky top-0 z-30">

                    <tr className="!bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600 font-bold border-b-2 border-slate-300">

                    <th className="!bg-slate-100 w-8 px-2">

                        <Checkbox

                        checked={selectedRows.size === commandeProduits.length && commandeProduits.length > 0}

                        onCheckedChange={() => toggleAllRows()}

                        />

                    </th>

                    <th className="!bg-slate-100 pl-2 font-bold w-[35%] min-w-[350px]">{t('orders:product_table.headers.product')}</th>

                    <th className="!bg-slate-100 pl-2 font-bold w-24">{t('orders:product_table.headers.cip')}</th>

                    <th className="!bg-slate-100 text-center w-14 text-amber-600 font-bold border-x border-slate-300/30">{t('orders:product_table.info_row.stock', 'Stk')}</th>

                    <th className="!bg-slate-100 text-right w-16 font-bold">{t('orders:product_table.headers.qty')}</th>

                    <th className="!bg-slate-100 text-center w-14 font-bold text-emerald-600 border-l border-slate-300/30">{t('orders:product_table.headers.ug')}</th>

                    {commandeType === 'DIR' && (

                        <th className="!bg-slate-100 text-right w-24 font-bold text-blue-600 border-l border-slate-300/30">{t('orders:product_table.headers.dev_price')}</th>

                    )}

                    <th className="!bg-slate-100 text-right w-24 font-bold border-l border-slate-300/30">{t('orders:product_table.headers.buy_price_ht')}</th>

                    <th className="!bg-slate-100 text-right w-24 font-bold text-indigo-600 border-l border-slate-300/30">Montant</th>

                    <th className="!bg-slate-100 text-right w-16 font-bold">{t('orders:product_table.headers.tva')}</th>

                    <th className="!bg-slate-100 text-right w-16 font-bold">{t('orders:product_table.headers.margin')}</th>

                    <th className="!bg-slate-100 text-right w-24 font-bold border-l border-slate-300/30">{t('orders:product_table.headers.sell_price')}</th>

                    <th className="!bg-slate-100 text-left w-24 font-bold border-l border-slate-300/30">{t('orders:product_table.headers.lot')}</th>

                    <th className="!bg-slate-100 text-left w-24 font-bold border-l border-slate-300/30">{t('orders:product_table.headers.exp_date')}</th>

                    <th className="!bg-slate-100 w-12 rounded-tr-lg"></th>

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

                            className={`hover:bg-slate-100/50 group border-b border-slate-200 last:border-0 ${selectedRows.has(index) ? 'bg-indigo-50' : ''} ${highlightedIndex === index ? 'ring-2 ring-amber-400 bg-amber-50 animate-pulse' : ''}`}

                        >

                            <td className="px-2">

                            <Checkbox

                                checked={selectedRows.has(index)}

                                onCheckedChange={() => toggleRowSelection(index)}

                            />

                            </td>

                            <td className="pl-2 py-0.5 min-w-[350px]">

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

                            <span className="text-sm font-mono font-bold text-slate-600">

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

                        <td className="text-center py-0.5 bg-amber-50/20">

                            {(() => {

                                const currentStock = (p.produit && typeof p.produit === 'object' && p.produit.stock !== undefined) 

                                    ? p.produit.stock 

                                    : (p as any).produit_stock ?? 0;

                                return (

                                    <span className={`text-xs font-bold px-1 rounded ${currentStock <= 0 ? 'text-red-600 bg-red-50' : 'text-amber-600'}`}>

                                        {currentStock}

                                    </span>

                                );

                            })()}

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

                        {/* Montant = qty × price (UG non inclus) */}

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

                        <td className="text-right py-0.5">

                        <Input

                            type="text"

                            data-row={index}

                            data-field="selling_price"

                            value={p.selling_price}

                            onChange={(e) => updateCommandeProduitField(index, 'selling_price', e.target.value)}

                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, (commandeType === 'DIR' ? 6 : 5))}

                            onFocus={handleSelectAll}

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

                                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-600" onClick={() => setExpandedRow(expandedRow === index ? null : index)}><Info className="size-3.5" /></Button>

                                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600" onClick={() => setProductToDelete(index)}><Trash2 className="size-3.5" /></Button>

                            </div>

                        </td>

                    </tr>

                    

                    {/* Collapsible Info Row */}

                    {expandedRow === index && (

                        <tr className="bg-blue-50/30 border-b border-slate-200">

                            <td colSpan={14} className="p-0">

                                {(() => {

                                    // Extract s either from full product object or from flattened serializer fields

                                    const pObj = (p.produit && typeof p.produit === 'object') ? p.produit : null;

                                    const pAny = p as any;

                                    

                                    // Merge available data

                                    const s = {

                                        dernier_achat: (pObj as any)?.dernier_achat || pAny.produit_dernier_achat,

                                        dernier_vente: (pObj as any)?.dernier_vente || pAny.produit_dernier_vente,

                                        rotation_moyenne: pObj?.rotation_moyenne || pAny.produit_rotation_moyenne,

                                        stock_minimum: pObj?.stock_minimum || pAny.produit_stock_minimum || 0,

                                        stock_maximum: (pObj as any)?.stock_maximum || pAny.produit_stock_maximum || 0,

                                        stock_alert: pObj?.stock_alert || pAny.produit_stock_alert || 0,

                                        cost_price: (pObj as any)?.cost_price || pAny.produit_cost_price || p.price,

                                        stock: pObj?.stock ?? pAny.produit_stock ?? 0,

                                    };

                                    

                                    const formatAchat = s.dernier_achat ? new Date(s.dernier_achat).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Inconnu';

                                    const formatVente = s.dernier_vente ? new Date(s.dernier_vente).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Jamais';

                                    

                                    return (

                                        <div className="p-4 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 text-sm">

                                            <div>

                                                <div className="text-xs uppercase font-bold text-slate-400 mb-1">{t('orders:product_table.info_row.purchase_history', "Historique d'Achat")}</div>

                                                <div className="font-medium text-slate-800">{formatAchat}</div>

                                                <div className="text-xs text-slate-500 mt-0.5">{t('orders:product_table.info_row.last_buy_price', "Dernier prix d'achat")}: {s.cost_price ? formatCurrency(Number(s.cost_price)) : '-'}</div>

                                            </div>

                                            <div>

                                                <div className="text-xs uppercase font-bold text-slate-400 mb-1">{t('orders:product_table.info_row.sales_history', "Historique de Vente")}</div>

                                                <div className="font-medium text-slate-800">{formatVente}</div>

                                                {s.rotation_moyenne && Number(s.rotation_moyenne) > 0 && (

                                                    <div className="text-xs text-blue-600 mt-0.5 font-medium">
                                                        {t('orders:product_table.info_row.rotation', 'Rotation')}: {Number(s.rotation_moyenne).toFixed(2)} / mois
                                                        <span className="text-slate-400 ml-1">({(Number(s.rotation_moyenne) / 30).toFixed(2)} / j)</span>
                                                    </div>

                                                )}

                                            </div>

                                            <div>

                                                <div className="text-xs uppercase font-bold text-slate-400 mb-1">{t('orders:product_table.info_row.stock_alerts', 'Alertes Stock')}</div>

                                                <div className="font-medium">

                                                    Min: <span className="text-amber-600">{s.stock_minimum}</span> / Max: <span className="text-emerald-600">{s.stock_maximum}</span>

                                                </div>

                                                {s.stock_alert > 0 && (

                                                    <div className="text-xs text-red-600 mt-0.5">{t('orders:product_table.info_row.alert_threshold', "Seuil d'alerte")}: {s.stock_alert}</div>

                                                )}

                                            </div>

                                            <div>

                                                <div className="text-xs uppercase font-bold text-slate-400 mb-1">{t('orders:product_table.info_row.indicators', 'Indicateurs')}</div>

                                                <div className="flex flex-col gap-1">

                                                    {s.stock <= 0 ? (

                                                        <div className="text-xs text-red-600 font-medium">⚠️ {t('orders:product_table.info_row.stock_out', 'Stock en rupture')}</div>

                                                    ) : s.rotation_moyenne && Number(s.rotation_moyenne) > 0 ? (

                                                        <div className="text-xs">

                                                            {t('orders:product_table.info_row.stock_life', "Durée de vie stock actuel")}: <span className="font-bold">~{Math.round(s.stock / (Number(s.rotation_moyenne) / 30))} j</span>

                                                        </div>

                                                    ) : (

                                                        <div className="text-xs text-slate-400">{t('orders:product_table.info_row.rotation_unknown', 'Rotation inconnue')}</div>

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

                    <tr className="!bg-slate-100 text-[10px] uppercase font-bold text-slate-500 border-t-2 border-slate-300 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">

                        <th colSpan={3} className="!bg-slate-100 pl-4 py-2">Fin de liste - {commandeProduits.length} articles</th>

                        <th className="!bg-slate-100 py-2"></th>

                        <th className="!bg-slate-100 py-2"></th>

                        <th className="!bg-slate-100 py-2"></th>

                        {commandeType === 'DIR' && <th className="!bg-slate-100 py-2"></th>}

                        <th className="!bg-slate-100 py-2"></th>

                        <th className="!bg-slate-100 py-2"></th>

                        <th className="!bg-slate-100 py-2"></th>

                        <th className="!bg-slate-100 py-2"></th>

                        <th className="!bg-slate-100 py-2"></th>

                        <th className="!bg-slate-100 py-2"></th>

                        <th className="!bg-slate-100 py-2 rounded-br-lg"></th>

                    </tr>

                </tfoot>

                </table>

            )}

            </div>



            {/* Deletion Modals */}

            <Dialog open={productToDelete !== null} onOpenChange={(open) => { if (!open) setProductToDelete(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">{t('common:confirm_deletion', 'Confirmer la suppression')}</DialogTitle>
                        <DialogDescription>{t('orders:messages.remove_product_confirm', 'Êtes-vous sûr de vouloir retirer ce produit de la commande ?')}</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setProductToDelete(null)}>{t('common:cancel', 'Annuler')}</Button>
                        <Button variant="danger" onClick={() => {
                            onRemoveProduct(productToDelete!);
                            setProductToDelete(null);
                        }}>{t('common:confirm', 'Confirmer')}</Button>
                    </div>
                </DialogContent>
            </Dialog>



            <Dialog open={isDeletingMultiple} onOpenChange={(open) => { if (!open) setIsDeletingMultiple(false); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">{t('orders:bulk_delete_title', 'Confirmer la suppression multiple')}</DialogTitle>
                        <DialogDescription>{t('orders:bulk_delete_confirm_minimal', { count: selectedRows.size, defaultValue: `Êtes-vous sûr de vouloir supprimer les ${selectedRows.size} produits sélectionnés ?` })}</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setIsDeletingMultiple(false)}>{t('common:cancel', 'Annuler')}</Button>
                        <Button variant="danger" onClick={() => {
                            deleteSelectedRows();
                            setIsDeletingMultiple(false);
                        }}>{t('common:confirm', 'Confirmer')}</Button>
                    </div>
                </DialogContent>
            </Dialog>

        </div>

    );

}

