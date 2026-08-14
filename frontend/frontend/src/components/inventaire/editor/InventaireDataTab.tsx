import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, PackageX, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency, normalizeNumberInput } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateUtils';
import type { LigneInventaire } from '../../../types';
import { getProduitName } from '../../../types/inventory';

interface InventaireDataTabProps {
    lignes: LigneInventaire[];
    isReadOnly: boolean;
    saving: boolean;
    selectedLines: Set<number>;
    toggleSelectAll: () => void;
    toggleSelectLine: (id: number) => void;
    dirtyLineIds?: Set<number>;
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
    dirtyLineIds,
    handleUpdateQuantity,
    handleDeleteLine,
    handleBulkDelete,
    onQtyEnter
}) => {
    const { t } = useTranslation(['stock', 'common']);

    const [sortBy, setSortBy] = useState<'nom' | 'chronologie' | 'ecart' | 'prix'>('chronologie');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    React.useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // F3 or "/" focuses the search input (when not already in an input)
            if (e.key === 'F3' || (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement))) {
                e.preventDefault();
                onQtyEnter?.();
                return;
            }
            // Shift+Delete removes the focused line (from qty input) or first selected line
            if (e.key === 'Delete' && e.shiftKey && !isReadOnly) {
                if (e.target instanceof HTMLInputElement && e.target.type === 'number') {
                    const idAttr = e.target.id;
                    if (idAttr?.startsWith('qty-input-')) {
                        const lineId = parseInt(idAttr.replace('qty-input-', ''), 10);
                        if (!isNaN(lineId)) {
                            e.preventDefault();
                            handleDeleteLine(lineId);
                        }
                    }
                } else if (selectedLines.size > 0) {
                    e.preventDefault();
                    const firstId = Array.from(selectedLines)[0];
                    handleDeleteLine(firstId);
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedLines, isReadOnly, handleDeleteLine, onQtyEnter]);

    // Sorting lines (show every line in the inventory, no ecart filtering)
    const sortedLines = useMemo(() => {
        return lignes
            .slice().sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'nom': {
                    const nameA = a.produit_nom || getProduitName(a.produit) || '';
                    const nameB = b.produit_nom || getProduitName(b.produit) || '';
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
        return sortedLines.reduce((acc, l) => {
            const pmp = normalizeNumberInput(l.produit_pmp || '0')
                || normalizeNumberInput(l.produit_cost_price || '0');
            const ecart = (l.quantite_physique || 0) - (l.stock_theorique || 0);
            return acc + (ecart * pmp);
        }, 0);
    }, [sortedLines]);

    if (sortedLines.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-400 flex flex-col items-center gap-4 animate-in fade-in">
                <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                    <PackageX className="h-8 w-8" />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-slate-700 mb-1">
                       {lignes.length === 0
                           ? t('inventaire.detail.empty_list_title')
                           : t('inventaire.detail.no_ecart_title')}
                   </h3>
                   <p className="text-sm max-w-sm mx-auto">
                       {lignes.length === 0
                           ? t('inventaire.detail.empty_list')
                           : t('inventaire.detail.no_ecart_desc')}
                   </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300 flex flex-col flex-1 min-h-0">
            {/* Action Bar for Selection */}
            {selectedLines.size > 0 && !isReadOnly && (
                <div className="bg-amber-50 p-4 border-b border-amber-200 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">{selectedLines.size}</span>
                        <span className="text-sm font-medium text-amber-800">{t('inventaire.detail.selected')}</span>
                    </div>
                    <button
                        type="button"
                        className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-sm font-bold bg-red-500 text-white gap-2 hover:bg-red-600 transition-colors disabled:opacity-60"
                        onClick={handleBulkDelete}
                        disabled={saving}
                    >
                        <Trash2 className="h-4 w-4" />
                        {t('inventaire.detail.delete_selected')}
                    </button>
                </div>
            )}

            {/* Sort Controls */}
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/30 flex justify-end items-center gap-2">
                <div className="text-sm font-medium text-slate-500">
                    {t('inventaire.detail.sort.title')}
                </div>
                <select
                    className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500 transition-all"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'nom' | 'chronologie' | 'ecart' | 'prix')}
                >
                    <option value="chronologie">{t('inventaire.detail.sort.chronologie')}</option>
                    <option value="nom">{t('inventaire.detail.sort.nom')}</option>
                    <option value="ecart">{t('inventaire.detail.sort.ecart')}</option>
                    <option value="prix">{t('inventaire.detail.sort.prix')}</option>
                </select>
                <button
                    type="button"
                    className="inline-flex items-center justify-center size-8 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    title={sortOrder === 'asc' ? t('common:sort.asc') : t('common:sort.desc')}
                >
                    {sortOrder === 'asc' ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
                </button>
            </div>

            {/* Table Header */}
            <div className="overflow-x-auto overflow-y-auto flex-1 w-full">
               <div className="min-w-[640px] md:min-w-[980px]">
                    <div className={`grid ${!isReadOnly ? "grid-cols-[32px_1fr_70px_60px_60px_50px] md:grid-cols-[36px_minmax(160px,1.4fr)_100px_90px_100px_minmax(90px,1fr)_85px_65px_65px_60px_44px]" : "grid-cols-[1fr_70px_60px_60px_50px] md:grid-cols-[minmax(180px,1.4fr)_100px_90px_100px_minmax(90px,1fr)_85px_65px_65px_60px]"} gap-1 md:gap-2 p-2 px-2 md:px-4 border-b border-slate-100 bg-slate-50/50 text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-400`}>
                        {!isReadOnly && (
                            <div className="flex items-center justify-center">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    checked={selectedLines.size === sortedLines.length && sortedLines.length > 0}
                                    onChange={toggleSelectAll}
                                />
                            </div>
                        )}
                        <div>{t('inventaire.detail.col_product')}</div>
                        <div className="hidden md:block">{t('inventaire.detail.col_cip')}</div>
                        <div className="hidden md:block">{t('inventaire.detail.col_lot')}</div>
                        <div className="hidden md:block">{t('inventaire.detail.col_expiration')}</div>
                        <div className="hidden md:block">{t('inventaire.detail.col_rayon')}</div>
                        <div className="text-right">{t('inventaire.detail.col_cmp')}</div>
                        <div className="text-center">{t('inventaire.detail.col_theo')}</div>
                        <div className="text-center">{t('inventaire.detail.col_phys')}</div>
                        <div className="text-center">{t('inventaire.detail.col_gap')}</div>
                        {!isReadOnly && <div className="hidden md:block text-right">{t('inventaire.detail.col_actions')}</div>}
                    </div>

                    {/* Grouped Table Body */}
                    <div className="divide-y divide-slate-50">
                        {sortedLines.map((l) => {
                            const currentEcart = (l.quantite_physique || 0) - (l.stock_theorique || 0);
                            const ecartClass = currentEcart > 0 ? "text-emerald-600 bg-emerald-50 border-emerald-100"
                                            : currentEcart < 0 ? "text-red-500 bg-red-50 border-red-100"
                                            : "text-slate-300 bg-white border-transparent";
                            const rayonName = l.produit_rayon || '-';

                            const isDirty = dirtyLineIds?.has(l.id);
                            const cip = l.produit_cip;
                            const lotNumero = l.lot_numero;
                            const lotExpiration = l.lot_expiration;
                            return (
                                <div key={l.id} className={`grid ${!isReadOnly ? "grid-cols-[32px_1fr_70px_60px_60px_50px] md:grid-cols-[36px_minmax(160px,1.4fr)_100px_90px_100px_minmax(90px,1fr)_85px_65px_65px_60px_44px]" : "grid-cols-[1fr_70px_60px_60px_50px] md:grid-cols-[minmax(180px,1.4fr)_100px_90px_100px_minmax(90px,1fr)_85px_65px_65px_60px]"} gap-1 md:gap-2 py-1.5 px-2 md:px-4 items-center hover:bg-slate-50 transition-colors ${l.isLocalOnly ? 'bg-amber-50/50 border-l-[2px] border-l-amber-400' : ''} ${isDirty ? 'bg-blue-50/30 border-l-[2px] border-l-blue-400' : ''}`}>
                                    {!isReadOnly && (
                                        <div className="flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                checked={selectedLines.has(l.id)}
                                                onChange={() => toggleSelectLine(l.id)}
                                            />
                                        </div>
                                    )}

                                    {/* Product Info — nom seul en desktop (CIP/Lot/Péremption en colonnes dédiées), tout inline sur mobile */}
                                    <div className="min-w-0">
                                        <div className="md:hidden flex items-baseline gap-2 min-w-0">
                                            <span className="font-bold text-xs text-slate-800 truncate shrink-0 max-w-[55%]" title={l.produit_nom || getProduitName(l.produit)}>
                                                {l.produit_nom || getProduitName(l.produit)}
                                            </span>
                                            {isDirty && (
                                                <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" title={t('common:unsaved')} />
                                            )}
                                            <span className="text-[10px] font-mono text-slate-400 truncate">{cip}</span>
                                            {lotNumero && (
                                                <span className="text-[10px] font-mono text-emerald-600 font-bold truncate shrink-0">
                                                    {t('inventaire.detail.lot_label')} {lotNumero}
                                                </span>
                                            )}
                                            {lotExpiration && (
                                                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                                    {formatDate(lotExpiration)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="hidden md:flex items-center gap-1 font-bold text-sm text-slate-800 truncate" title={l.produit_nom || getProduitName(l.produit)}>
                                            <span className="truncate">{l.produit_nom || getProduitName(l.produit)}</span>
                                            {isDirty && (
                                                <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" title={t('common:unsaved')} />
                                            )}
                                        </div>
                                    </div>

                                    {/* CIP Column - hidden on mobile */}
                                    <div className="hidden md:block truncate text-xs font-mono text-slate-500">
                                        {cip || '-'}
                                    </div>

                                    {/* Lot Column - hidden on mobile */}
                                    <div className="hidden md:block truncate text-xs font-mono font-bold text-emerald-600">
                                        {lotNumero || '-'}
                                    </div>

                                    {/* Péremption Column - hidden on mobile */}
                                    <div className="hidden md:block truncate text-xs font-mono text-slate-500">
                                        {lotExpiration ? formatDate(lotExpiration) : '-'}
                                    </div>

                                    {/* Rayon Column - hidden on mobile */}
                                    <div className="hidden md:block truncate text-xs font-medium text-slate-500">
                                        {rayonName}
                                    </div>

                                    <div className="text-right text-[10px] md:text-xs font-medium text-slate-600">
                                        {formatCurrency(normalizeNumberInput(String(l.pmp_snapshot || l.produit_cost_price || '0')))}
                                    </div>

                                    {/* Stock Théorique */}
                                    <div className="flex justify-center">
                                        <div className="bg-slate-50 px-1 md:px-2 py-0.5 rounded border border-slate-200 min-w-[35px] md:min-w-[45px] text-center">
                                            <span className="font-mono font-bold text-[10px] md:text-xs text-slate-400">{l.stock_theorique}</span>
                                        </div>
                                    </div>

                                    {/* Stock Physique (Input) */}
                                    <div className="flex justify-center">
                                        {isReadOnly ? (
                                            <div className="bg-slate-50 px-1 md:px-2 py-1 rounded border border-slate-200 min-w-[35px] md:min-w-[45px] text-center">
                                                <span className="font-mono font-bold text-[10px] md:text-xs text-slate-700">{l.quantite_physique}</span>
                                            </div>
                                        ) : (
                                            <input
                                                id={`qty-input-${l.id}`}
                                                type="number"
                                                className="h-7 md:h-8 px-1 md:px-2 w-12 md:w-16 text-center font-mono font-bold text-xs md:text-sm rounded-lg border border-slate-200 bg-slate-50/30 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all"
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
                                    <div className="flex justify-center">
                                        <div className={`px-1 md:px-2 py-0.5 rounded border font-mono font-bold text-[10px] md:text-xs min-w-[32px] md:min-w-[40px] text-center ${ecartClass}`}>
                                            {currentEcart > 0 ? '+' : ''}{currentEcart}
                                        </div>
                                    </div>

                                    {/* Actions - hidden on mobile */}
                                    {!isReadOnly && (
                                        <div className="hidden md:flex justify-end pr-1">
                                            <button
                                                type="button"
                                                className="inline-flex items-center justify-center size-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                                                onClick={() => handleDeleteLine(l.id)}
                                                disabled={saving}
                                                title={t('common:remove')}
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
            <div className="bg-slate-100/80 backdrop-blur-md p-2 md:p-3 px-3 md:px-6 border-t border-slate-200 flex justify-between items-center sticky bottom-0 z-10">
                <div className="flex gap-3 md:gap-6">
                    <div className="flex flex-col">
                        <span className="text-[10px] md:text-xs uppercase font-bold text-slate-400 leading-none mb-1">{t('inventaire.detail.items_count')}</span>
                        <span className="font-bold text-xs md:text-sm text-slate-700">{sortedLines.length}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                    <div className="text-right">
                        <div className="text-[10px] md:text-xs uppercase font-bold text-slate-400 leading-none mb-1">{t('inventaire.detail.total_gap_value')}</div>
                        <div className={`text-base md:text-lg font-black font-mono ${totalEcartValeur > 0 ? "text-emerald-600" : totalEcartValeur < 0 ? "text-red-500" : "text-slate-400"}`}>
                            {totalEcartValeur > 0 ? '+' : ''}{formatCurrency(totalEcartValeur)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
