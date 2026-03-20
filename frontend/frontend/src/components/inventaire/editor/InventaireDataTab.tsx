import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, PackageX, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency, normalizeNumberInput } from '../../../utils/formatters';
import type { LigneInventaire } from '../../../types';

interface InventaireDataTabProps {
    lignes: LigneInventaire[];
    isReadOnly: boolean;
    saving: boolean;
    selectedLines: Set<number>;
    toggleSelectAll: () => void;
    toggleSelectLine: (id: number) => void;
    handleUpdateQuantity: (id: number, qty: number) => void;
    handleDeleteLine: (id: number) => void;
    handleBulkDelete: () => void;
    onQtyEnter?: () => void;
}

export const InventaireDataTab: React.FC<InventaireDataTabProps> = ({
    lignes,
    isReadOnly,
    saving,
    selectedLines,
    toggleSelectAll,
    toggleSelectLine,
    handleUpdateQuantity,
    handleDeleteLine,
    handleBulkDelete,
    onQtyEnter
}) => {
    const { t } = useTranslation(['stock', 'common']);

    const [sortBy, setSortBy] = useState<'nom' | 'chronologie' | 'ecart' | 'prix'>('chronologie');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    // Sorting lines
    const sortedLines = useMemo(() => {
        return [...lignes].sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'nom': {
                    const nameA = a.produit_nom || (a.produit as any).name || '';
                    const nameB = b.produit_nom || (b.produit as any).name || '';
                    comparison = nameA.localeCompare(nameB);
                    break;
                }
                case 'chronologie': {
                    comparison = (a.id || 0) - (b.id || 0);
                    break;
                }
                case 'ecart': {
                    const ecartA = (a.quantite_physique || 0) - (a.stock_theorique || 0);
                    const ecartB = (b.quantite_physique || 0) - (b.stock_theorique || 0);
                    comparison = ecartA - ecartB;
                    break;
                }
                case 'prix': {
                    const pmpA = normalizeNumberInput(a.pmp_snapshot || a.produit_cost_price || '0');
                    const pmpB = normalizeNumberInput(b.pmp_snapshot || b.produit_cost_price || '0');
                    comparison = pmpA - pmpB;
                    break;
                }
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });
    }, [lignes, sortBy, sortOrder]);

    const totalEcartValeur = useMemo(() => {
        return lignes.reduce((acc, l) => {
            const pmp = normalizeNumberInput(l.pmp_snapshot || l.produit_cost_price || '0');
            const ecart = (l.quantite_physique || 0) - (l.stock_theorique || 0);
            return acc + (ecart * pmp);
        }, 0);
    }, [lignes]);

    if (lignes.length === 0) {
        return (
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-12 text-center text-base-content/40 flex flex-col items-center gap-4 animate-in fade-in">
                <div className="w-16 h-16 rounded-full bg-base-200 flex items-center justify-center mb-2">
                    <PackageX className="h-8 w-8" />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-base-content mb-1">{t('inventaire.detail.empty_list_title')}</h3>
                   <p className="text-sm max-w-sm mx-auto">{t('inventaire.detail.empty_list')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden animate-in fade-in duration-300 flex flex-col">
            {/* Action Bar for Selection */}
            {selectedLines.size > 0 && !isReadOnly && (
                <div className="bg-warning/10 p-4 border-b border-warning/20 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <span className="badge badge-warning font-bold">{selectedLines.size}</span>
                        <span className="text-sm font-medium text-warning-content">{t('inventaire.detail.selected')}</span>
                    </div>
                    <button 
                        className="btn btn-error btn-sm rounded-lg shadow-sm gap-2 text-white" 
                        onClick={handleBulkDelete}
                        disabled={saving}
                    >
                        <Trash2 className="h-4 w-4" />
                        {t('inventaire.detail.delete_selected')}
                    </button>
                </div>
            )}

            {/* Sort Controls */}
            <div className="px-4 py-2 border-b border-base-200 bg-base-50/30 flex justify-end items-center gap-2">
                <div className="text-sm font-medium text-base-content/60">
                    {t('inventaire.detail.sort.title')}
                </div>
                <select 
                    className="select select-bordered select-sm rounded-lg"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                >
                    <option value="chronologie">{t('inventaire.detail.sort.chronologie')}</option>
                    <option value="nom">{t('inventaire.detail.sort.nom')}</option>
                    <option value="ecart">{t('inventaire.detail.sort.ecart')}</option>
                    <option value="prix">{t('inventaire.detail.sort.prix')}</option>
                </select>
                <button 
                    className="btn btn-ghost btn-sm btn-square rounded-lg"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    title={sortOrder === 'asc' ? t('common:sort.asc', 'Croissant') : t('common:sort.desc', 'Décroissant')}
                >
                    {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                </button>
            </div>

            {/* Table Header */}
            <div className="overflow-x-auto w-full">
               <div className="min-w-[800px]">
                    <div className="grid grid-cols-12 gap-2 p-2 px-4 border-b border-base-200 bg-base-50/50 text-[10px] font-bold uppercase tracking-wider text-base-content/50">
                        {!isReadOnly && (
                            <div className="col-span-1 flex items-center justify-center">
                                <input 
                                    type="checkbox" 
                                    className="checkbox checkbox-xs rounded-sm"
                                    checked={selectedLines.size === lignes.length && lignes.length > 0}
                                    onChange={toggleSelectAll}
                                />
                            </div>
                        )}
                        <div className={!isReadOnly ? "col-span-3" : "col-span-4"}>{t('inventaire.detail.col_product')}</div>
                        <div className="col-span-2">{t('inventaire.detail.col_rayon')}</div>
                        <div className="col-span-1 text-right">{t('inventaire.detail.col_cmp')}</div>
                        <div className="col-span-1.5 text-center">{t('inventaire.detail.col_theo')}</div>
                        <div className="col-span-1.5 text-center">{t('inventaire.detail.col_phys')}</div>
                        <div className="col-span-1 text-center">{t('inventaire.detail.col_gap')}</div>
                        {!isReadOnly && <div className="col-span-1 text-right">{t('inventaire.detail.col_actions')}</div>}
                    </div>

                    {/* Grouped Table Body */}
                    <div className="divide-y divide-base-100">
                        {sortedLines.map((l) => {
                            const currentEcart = (l.quantite_physique || 0) - (l.stock_theorique || 0);
                            const ecartClass = currentEcart > 0 ? "text-success bg-success/5 border-success/10" 
                                            : currentEcart < 0 ? "text-error bg-error/5 border-error/10" 
                                            : "text-base-content/20 bg-base-100 border-transparent";
                            const rayonName = l.produit_rayon || (l.produit as any).rayon_name || '-';

                            return (
                                <div key={l.id} className={`grid grid-cols-12 gap-2 py-1.5 px-4 items-center hover:bg-base-50 transition-colors ${l.isLocalOnly ? 'bg-warning/5 border-l-[2px] border-l-warning' : ''}`}>
                                    {!isReadOnly && (
                                        <div className="col-span-1 flex items-center justify-center">
                                            <input 
                                                type="checkbox" 
                                                className="checkbox checkbox-xs rounded-sm scale-110"
                                                checked={selectedLines.has(l.id)}
                                                onChange={() => toggleSelectLine(l.id)}
                                            />
                                        </div>
                                    )}
                                    
                                    {/* Product Info */}
                                    <div className={!isReadOnly ? "col-span-3" : "col-span-4"}>
                                        <div className="font-bold text-sm text-base-content truncate pr-2" title={l.produit_nom || (l.produit as any).name}>
                                            {l.produit_nom || (l.produit as any).name}
                                        </div>
                                        <div className="text-xs font-mono opacity-50 flex gap-2 items-center leading-none mt-1">
                                            <span>{l.produit_cip || (l.produit as any).cip1}</span>
                                            {(l as any).lot_numero && (
                                                <span className="text-primary font-bold">{t('inventaire.detail.lot_label')} {(l as any).lot_numero}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Rayon Column */}
                                    <div className="col-span-2 truncate text-xs font-medium text-base-content/60">
                                        {rayonName}
                                    </div>

                                    <div className="col-span-1 text-right text-xs font-medium text-base-content/80">
                                        {formatCurrency(normalizeNumberInput(l.pmp_snapshot || l.produit_cost_price || '0'), 2)}
                                    </div>

                                    {/* Stock Théorique */}
                                    <div className="col-span-1.5 flex justify-center">
                                        <div className="bg-base-100 px-2 py-0.5 rounded border border-base-200 min-w-[45px] text-center">
                                            <span className="font-mono font-bold text-xs opacity-50">{l.stock_theorique}</span>
                                        </div>
                                    </div>

                                    {/* Stock Physique (Input) */}
                                    <div className="col-span-1.5 flex justify-center">
                                        {isReadOnly ? (
                                            <div className="bg-base-50 px-2 py-1 rounded border border-base-200 min-w-[45px] text-center">
                                                <span className="font-mono font-bold text-xs">{l.quantite_physique}</span>
                                            </div>
                                        ) : (
                                            <input 
                                                id={`qty-input-${l.id}`}
                                                type="number" 
                                                className="input input-bordered h-8 px-2 w-16 text-center font-mono font-bold text-sm rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all bg-base-50/30" 
                                                value={l.quantite_physique}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val === '') {
                                                        handleUpdateQuantity(l.id, 0);
                                                    } else {
                                                        handleUpdateQuantity(l.id, normalizeNumberInput(val));
                                                    }
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        if (l.isLocalOnly) {
                                                            // For manual entry: focus search
                                                            if (onQtyEnter) onQtyEnter();
                                                        } else {
                                                            // For pre-populated: focus next line
                                                            e.preventDefault();
                                                            const currentIdx = sortedLines.indexOf(l);
                                                            const nextLigne = sortedLines[currentIdx + 1];
                                                            if (nextLigne) {
                                                                const nextInput = document.getElementById(`qty-input-${nextLigne.id}`);
                                                                if (nextInput) (nextInput as HTMLInputElement).focus();
                                                            } else if (onQtyEnter) {
                                                                // If last line: fallback to search
                                                                onQtyEnter();
                                                            }
                                                        }
                                                    } else if (e.key === 'ArrowDown') {
                                                        e.preventDefault();
                                                        const currentIdx = sortedLines.indexOf(l);
                                                        const nextLigne = sortedLines[currentIdx + 1];
                                                        if (nextLigne) {
                                                            const nextInput = document.getElementById(`qty-input-${nextLigne.id}`);
                                                            if (nextInput) (nextInput as HTMLInputElement).focus();
                                                        }
                                                    } else if (e.key === 'ArrowUp') {
                                                        e.preventDefault();
                                                        const currentIdx = sortedLines.indexOf(l);
                                                        const prevLigne = sortedLines[currentIdx - 1];
                                                        if (prevLigne) {
                                                            const prevInput = document.getElementById(`qty-input-${prevLigne.id}`);
                                                            if (prevInput) (prevInput as HTMLInputElement).focus();
                                                        } else if (onQtyEnter) {
                                                            onQtyEnter();
                                                        }
                                                    }
                                                }}
                                                disabled={saving}
                                                min="0"
                                            />
                                        )}
                                    </div>

                                    {/* Ecart */}
                                    <div className="col-span-1 flex justify-center">
                                        <div className={`px-2 py-0.5 rounded border font-mono font-bold text-xs min-w-[40px] text-center ${ecartClass}`}>
                                            {currentEcart > 0 ? '+' : ''}{currentEcart}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {!isReadOnly && (
                                        <div className="col-span-1 flex justify-end pr-1">
                                            <button 
                                                className="btn btn-ghost btn-sm btn-circle text-error/30 hover:text-error hover:bg-error/10 transition-colors"
                                                onClick={() => handleDeleteLine(l.id)}
                                                disabled={saving}
                                                title={t('common:remove', 'Retirer')}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
               </div>
            </div>

            {/* Sticky Footer for Totals */}
            <div className="bg-base-200/80 backdrop-blur-md p-3 px-6 border-t border-base-300 flex justify-between items-center sticky bottom-0 z-10">
                <div className="flex gap-6">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold opacity-40 leading-none mb-1">{t('inventaire.detail.items_count')}</span>
                        <span className="font-bold text-sm">{lignes.length}</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-[10px] uppercase font-bold opacity-40 leading-none mb-1">{t('inventaire.detail.total_gap_value')}</div>
                        <div className={`text-lg font-black font-mono ${totalEcartValeur > 0 ? "text-success" : totalEcartValeur < 0 ? "text-error" : "text-base-content/40"}`}>
                            {totalEcartValeur > 0 ? '+' : ''}{formatCurrency(totalEcartValeur)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
