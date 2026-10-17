import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, PackageX, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
import { formatCurrency, normalizeNumberInput } from '../../../utils/formatters';
import type { LigneInventaire } from '../../../types';
import { getProduitName } from '../../../types/inventory';
import { EmptyState } from '../../ui/EmptyState';
import { InventaireLineRow } from './InventaireLineRow';

// Virtualisation au-delà de 500 lignes : fenêtre rendue autour du scroll,
// hauteur de ligne fixe (px) pour le calcul des spacers.
const VIRTUALIZE_THRESHOLD = 500;
const ROW_HEIGHT = 44;
const OVERSCAN_ROWS = 8;

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

    const pendingTotals = useMemo(() => {
        return lignes.reduce((acc, l) => {
            acc.promis += l.pending_promis || 0;
            acc.forced += l.pending_force || 0;
            return acc;
        }, { promis: 0, forced: 0 });
    }, [lignes]);

    // --- Virtualisation (> 500 lignes) ---
    const virtualize = sortedLines.length > VIRTUALIZE_THRESHOLD;
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const headerRef = React.useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportH, setViewportH] = useState(0);

    React.useEffect(() => {
        if (!virtualize) return;
        const el = scrollRef.current;
        if (!el) return;
        const update = () => setViewportH(el.clientHeight);
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [virtualize]);

    const headerH = headerRef.current?.offsetHeight ?? 0;
    const firstIdx = virtualize
        ? Math.max(0, Math.floor(Math.max(0, scrollTop - headerH) / ROW_HEIGHT) - OVERSCAN_ROWS)
        : 0;
    const visibleCount = virtualize
        ? Math.ceil((viewportH || 600) / ROW_HEIGHT) + OVERSCAN_ROWS * 2
        : sortedLines.length;
    const lastIdx = Math.min(sortedLines.length, firstIdx + visibleCount);
    const visibleLines = virtualize ? sortedLines.slice(firstIdx, lastIdx) : sortedLines;

    if (sortedLines.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 animate-in fade-in">
                <EmptyState
                    icon={<PackageX className="size-8" />}
                    title={lignes.length === 0
                        ? t('inventaire.detail.empty_list_title')
                        : t('inventaire.detail.no_ecart_title')}
                    description={lignes.length === 0
                        ? t('inventaire.detail.empty_list')
                        : t('inventaire.detail.no_ecart_desc')}
                    className="p-12"
                />
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

            {/* Pending stock obligations warning */}
            {(pendingTotals.promis + pendingTotals.forced) > 0 && (
                <div className="px-4 py-2 border-b border-amber-200 bg-amber-50 flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                    <span className="text-xs font-medium text-amber-800">
                        {t('inventaire.detail.obligations_alert', { promis: pendingTotals.promis, forced: pendingTotals.forced })}
                    </span>
                </div>
            )}

            {/* Sort Controls */}
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/30 flex justify-end items-center gap-2">
                <div className="text-sm font-medium text-slate-500">
                    {t('inventaire.detail.sort.title')}
                </div>
                <select
                    className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500 transition-all"
                    aria-label={t('inventaire.detail.sort.title')}
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
                    aria-label={sortOrder === 'asc' ? t('common:sort.asc') : t('common:sort.desc')}
                >
                    {sortOrder === 'asc' ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
                </button>
            </div>

            {/* Table Header */}
            <div
                className="overflow-x-auto overflow-y-auto flex-1 w-full"
                ref={scrollRef}
                onScroll={virtualize ? (e) => setScrollTop(e.currentTarget.scrollTop) : undefined}
            >
               <div className="min-w-[640px] md:min-w-[980px]">
                    <div ref={headerRef} className={`grid ${!isReadOnly ? "grid-cols-[32px_1fr_70px_60px_60px_50px] md:grid-cols-[36px_minmax(160px,1.4fr)_100px_90px_100px_minmax(90px,1fr)_85px_65px_65px_60px_44px]" : "grid-cols-[1fr_70px_60px_60px_50px] md:grid-cols-[minmax(180px,1.4fr)_100px_90px_100px_minmax(90px,1fr)_85px_65px_65px_60px]"} gap-1 md:gap-2 p-2 px-2 md:px-4 border-b border-slate-100 bg-slate-50/50 text-caption md:text-xs font-bold uppercase tracking-wider text-slate-400`}>
                        {!isReadOnly && (
                            <div className="flex items-center justify-center">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    checked={selectedLines.size === sortedLines.length && sortedLines.length > 0}
                                    onChange={toggleSelectAll}
                                    aria-label={t('stock:cadencier.select_all')}
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

                    {/* Grouped Table Body — virtualisé au-delà de 500 lignes */}
                    <div className="divide-y divide-slate-50">
                        {virtualize && firstIdx > 0 && (
                            <div style={{ height: firstIdx * ROW_HEIGHT }} aria-hidden="true" />
                        )}
                        {visibleLines.map((l, i) => {
                            const idx = firstIdx + i;
                            return (
                                <InventaireLineRow
                                    key={l.id}
                                    line={l}
                                    isReadOnly={isReadOnly}
                                    isDirty={!!dirtyLineIds?.has(l.id)}
                                    isSelected={selectedLines.has(l.id)}
                                    saving={saving}
                                    nextLineId={sortedLines[idx + 1]?.id}
                                    prevLineId={sortedLines[idx - 1]?.id}
                                    onToggleSelect={toggleSelectLine}
                                    onUpdateQuantity={handleUpdateQuantity}
                                    onDeleteLine={handleDeleteLine}
                                    onQtyEnter={onQtyEnter}
                                    style={virtualize ? { height: ROW_HEIGHT } : undefined}
                                />
                            );
                        })}
                        {virtualize && lastIdx < sortedLines.length && (
                            <div style={{ height: (sortedLines.length - lastIdx) * ROW_HEIGHT }} aria-hidden="true" />
                        )}
                    </div>
               </div>
            </div>

            {/* Sticky Footer for Totals */}
            <div className="bg-slate-100/80 backdrop-blur-md p-2 md:p-3 px-3 md:px-6 border-t border-slate-200 flex justify-between items-center sticky bottom-0 z-10">
                <div className="flex gap-3 md:gap-6">
                    <div className="flex flex-col">
                        <span className="text-caption md:text-xs uppercase font-bold text-slate-400 leading-none mb-1">{t('inventaire.detail.items_count')}</span>
                        <span className="font-bold text-xs md:text-sm text-slate-700">{sortedLines.length}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                    <div className="text-right">
                        <div className="text-caption md:text-xs uppercase font-bold text-slate-400 leading-none mb-1">{t('inventaire.detail.total_gap_value')}</div>
                        <div className={`text-base md:text-lg font-black font-mono ${totalEcartValeur > 0 ? "text-emerald-600" : totalEcartValeur < 0 ? "text-red-500" : "text-slate-400"}`}>
                            {totalEcartValeur > 0 ? '+' : ''}{formatCurrency(totalEcartValeur)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

