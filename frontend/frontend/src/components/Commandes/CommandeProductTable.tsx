import React from 'react';
import type { CommandeProduit, ProduitModel, Commande } from '../../types';

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
        field: 'quantity' | 'unites_gratuites' | 'price' | 'tva' | 'marge' | 'selling_price' | 'lot' | 'date_expiration', 
        value: string | number
    ) => void;
    
    handleTableFieldKeyDown: (e: React.KeyboardEvent, rowIndex: number, fieldIndex: number) => void;
    onRemoveProduct: (index: number) => void;
}

export default function CommandeProductTable({
    commandeProduits,
    produitsList,
    selectedRows,
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
    onRemoveProduct
}: CommandeProductTableProps) {
    return (
        <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl shadow-sm border border-base-200">
            <div className="p-4 border-b border-base-100 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
                <h2 className="font-bold text-sm md:text-base text-base-content">
                Produits ({commandeProduits.length})
                </h2>
                <div className="flex items-center gap-4">
                    {saving && <span className="text-sm text-warning animate-pulse">Sauvegarde...</span>}
                    {!saving && lastSaved && <span className="text-xs text-success">Enregistré à {lastSaved.toLocaleTimeString()}</span>}
                    <div className="text-base md:text-lg font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg">
                    Total : {commandeProduits.reduce((acc, p) => acc + (Number(p.price || 0) * Number(p.quantity || 0)), 0).toLocaleString('fr-FR')} F
                    </div>
                </div>
            </div>
            {selectedRows.size > 0 && (
                <div className="flex items-center gap-2">
                <span className="text-sm text-base-content/70">{selectedRows.size} sélectionné(s)</span>
                <button
                    type="button"
                    className="btn btn-error btn-xs"
                    onClick={deleteSelectedRows}
                >
                    Supprimer
                </button>
                {/* Bouton Transférer - visible uniquement en mode EDIT sur commande PREP */}
                {viewMode === 'EDIT' && selectedCommande?.status === 'PREP' && (
                    <button
                    type="button"
                    className="btn btn-info btn-xs gap-1"
                    onClick={openTransferModal}
                    >
                    ➡️ Transférer
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
                <p className="font-light">Commencez par rechercher et ajouter des produits (F2)</p>
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
                    <th className="bg-base-200 pl-4 font-semibold text-xs uppercase">Produit</th>
                    <th className="bg-base-200 text-right w-24 font-semibold text-xs uppercase">Qté</th>
                    <th className="bg-base-200 text-center w-20 bg-success/10 font-semibold text-xs uppercase text-success">UG</th>
                    <th className="bg-base-200 text-right w-32 font-semibold text-xs uppercase">Prix Achat HT</th>
                    <th className="bg-base-200 text-right w-24 font-semibold text-xs uppercase">TVA</th>
                    <th className="bg-base-200 text-right w-24 font-semibold text-xs uppercase">Marge</th>
                    <th className="bg-base-200 text-right w-32 font-semibold text-xs uppercase">Prix Vente</th>
                    <th className="bg-base-200 text-left w-32 font-semibold text-xs uppercase">Lot</th>
                    <th className="bg-base-200 text-left w-36 font-semibold text-xs uppercase">Date Exp</th>
                    <th className="bg-base-200 w-10"></th>
                    </tr>
                </thead>
                <tbody>
                    {commandeProduits.map((p, index) => (
                    <tr 
                        key={p.id} 
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
                            {(() => {
                            // Try to get product name from different sources
                            if (typeof p.produit === 'object' && p.produit.name) {
                                return p.produit.name;
                            }
                            // Check if there's a produit_nom field from API
                            if ((p as any).produit_nom) {
                                return (p as any).produit_nom;
                            }
                            // Try to find in produitsList
                            const produitId = typeof p.produit === 'object' ? p.produit.id : p.produit;
                            const found = produitsList.find(prod => prod.id === produitId);
                            if (found) {
                                return found.name;
                            }
                            // Last resort: show ID
                            return `Produit #${produitId}`;
                            })()}
                        </div>
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
                            className={`input input-ghost input-sm text-sm w-full text-center font-medium bg-success/10 focus:bg-success/20 focus:text-success ${!fieldsConfig[1].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                            placeholder="0"
                            autoFocus={focusedField?.row === index && focusedField?.field === 1}
                            readOnly={!fieldsConfig[1].editable}
                            tabIndex={!fieldsConfig[1].editable ? -1 : 0}
                        />
                        </td>
                        {/* Price (2) - Index updated */}
                        <td className="text-right py-2 md:py-3">
                        <input
                            type="text"
                            data-row={index}
                            data-field={2}
                            value={p.price}
                            onChange={(e) => updateCommandeProduitField(index, 'price', e.target.value)}
                            onKeyDown={(e) => handleTableFieldKeyDown(e, index, 2)}
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
                    ))}
                </tbody>
                </table>
            )}
            </div>
        </div>
    );
}
