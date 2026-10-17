import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { formatCurrency, normalizeNumberInput } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateUtils';
import type { LigneInventaire } from '../../../types';
import { getProduitName } from '../../../types/inventory';

const ROW_GRID_CLASSES = (isReadOnly: boolean) =>
    `grid ${!isReadOnly ? "grid-cols-[32px_1fr_70px_60px_60px_50px] md:grid-cols-[36px_minmax(160px,1.4fr)_100px_90px_100px_minmax(90px,1fr)_85px_65px_65px_60px_44px]" : "grid-cols-[1fr_70px_60px_60px_50px] md:grid-cols-[minmax(180px,1.4fr)_100px_90px_100px_minmax(90px,1fr)_85px_65px_65px_60px]"} gap-1 md:gap-2 py-1.5 px-2 md:px-4 items-center hover:bg-slate-50 transition-colors`;

interface InventaireLineRowProps {
    line: LigneInventaire;
    isReadOnly: boolean;
    isDirty: boolean;
    isSelected: boolean;
    saving: boolean;
    nextLineId?: number;
    prevLineId?: number;
    onToggleSelect: (id: number) => void;
    onUpdateQuantity: (id: number, qty: number) => void;
    onDeleteLine: (id: number) => void;
    onQtyEnter?: () => void;
    style?: React.CSSProperties;
}

/**
 * Ligne du tableau d'inventaire — mémoïsée pour que la saisie d'une
 * quantité ou le scroll virtualisé ne re-render que les lignes concernées.
 */
export const InventaireLineRow = React.memo<InventaireLineRowProps>(({
    line: l,
    isReadOnly,
    isDirty,
    isSelected,
    saving,
    nextLineId,
    prevLineId,
    onToggleSelect,
    onUpdateQuantity,
    onDeleteLine,
    onQtyEnter,
    style
}) => {
    const { t } = useTranslation(['stock', 'common']);

    const currentEcart = (l.quantite_physique || 0) - (l.stock_theorique || 0);
    const ecartClass = currentEcart > 0 ? "text-emerald-600 bg-emerald-50 border-emerald-100"
                    : currentEcart < 0 ? "text-red-500 bg-red-50 border-red-100"
                    : "text-slate-300 bg-white border-transparent";
    const rayonName = l.produit_rayon || '-';
    const cip = l.produit_cip;
    const lotNumero = l.lot_numero;
    const lotExpiration = l.lot_expiration;

    return (
        <div
            style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 40px', ...style }}
            className={`${ROW_GRID_CLASSES(isReadOnly)} ${l.isLocalOnly ? 'bg-amber-50/50 border-l-[2px] border-l-amber-400' : ''} ${isDirty ? 'bg-blue-50/30 border-l-[2px] border-l-blue-400' : ''}`}
        >
            {!isReadOnly && (
                <div className="flex items-center justify-center">
                    <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        checked={isSelected}
                        onChange={() => onToggleSelect(l.id)}
                        aria-label={t('stock:reappro.select_product_aria', { name: l.produit_nom || getProduitName(l.produit) })}
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
                    {(l.pending_promis ?? 0) > 0 && (
                        <span className="text-caption rounded px-1.5 font-bold bg-amber-100 text-amber-700 shrink-0" title={t('inventaire.detail.badge_promis_title')}>
                            {t('inventaire.detail.badge_promis', { count: l.pending_promis })}
                        </span>
                    )}
                    {(l.pending_force ?? 0) > 0 && (
                        <span className="text-caption rounded px-1.5 font-bold bg-rose-100 text-rose-700 shrink-0" title={t('inventaire.detail.badge_forced_title')}>
                            {t('inventaire.detail.badge_forced', { count: l.pending_force })}
                        </span>
                    )}
                    <span className="text-caption font-mono text-slate-400 truncate">{cip}</span>
                    {lotNumero && (
                        <span className="text-caption font-mono text-emerald-600 font-bold truncate shrink-0">
                            {t('inventaire.detail.lot_label')} {lotNumero}
                        </span>
                    )}
                    {lotExpiration && (
                        <span className="text-caption font-mono text-slate-400 shrink-0">
                            {formatDate(lotExpiration)}
                        </span>
                    )}
                </div>
                <div className="hidden md:flex items-center gap-1 font-bold text-sm text-slate-800 truncate" title={l.produit_nom || getProduitName(l.produit)}>
                    <span className="truncate">{l.produit_nom || getProduitName(l.produit)}</span>
                    {isDirty && (
                        <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" title={t('common:unsaved')} />
                    )}
                    {(l.pending_promis ?? 0) > 0 && (
                        <span className="text-caption rounded px-1.5 font-bold bg-amber-100 text-amber-700 shrink-0" title={t('inventaire.detail.badge_promis_title')}>
                            {t('inventaire.detail.badge_promis', { count: l.pending_promis })}
                        </span>
                    )}
                    {(l.pending_force ?? 0) > 0 && (
                        <span className="text-caption rounded px-1.5 font-bold bg-rose-100 text-rose-700 shrink-0" title={t('inventaire.detail.badge_forced_title')}>
                            {t('inventaire.detail.badge_forced', { count: l.pending_force })}
                        </span>
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

            <div className="text-right text-caption md:text-xs font-medium text-slate-600">
                {formatCurrency(normalizeNumberInput(String(l.pmp_snapshot || l.produit_cost_price || '0')))}
            </div>

            {/* Stock Théorique */}
            <div className="flex justify-center">
                <div className="bg-slate-50 px-1 md:px-2 py-0.5 rounded border border-slate-200 min-w-[35px] md:min-w-[45px] text-center">
                    <span className="font-mono font-bold text-caption md:text-xs text-slate-400">{l.stock_theorique}</span>
                </div>
            </div>

            {/* Stock Physique (Input) */}
            <div className="flex justify-center">
                {isReadOnly ? (
                    <div className="bg-slate-50 px-1 md:px-2 py-1 rounded border border-slate-200 min-w-[35px] md:min-w-[45px] text-center">
                        <span className="font-mono font-bold text-caption md:text-xs text-slate-700">{l.quantite_physique}</span>
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
                                onUpdateQuantity(l.id, 0);
                            } else {
                                onUpdateQuantity(l.id, normalizeNumberInput(val));
                            }
                        }}
                        onKeyDown={e => {
                            const focusLine = (id?: number) => {
                                if (id === undefined) return false;
                                const input = document.getElementById(`qty-input-${id}`);
                                if (input) (input as HTMLInputElement).focus();
                                return !!input;
                            };
                            if (e.key === 'Enter') {
                                if (l.isLocalOnly) {
                                    // For manual entry: focus search
                                    if (onQtyEnter) onQtyEnter();
                                } else {
                                    // For pre-populated: focus next line
                                    e.preventDefault();
                                    if (!focusLine(nextLineId) && onQtyEnter) {
                                        // If last line (ou non montée en virtualisation): fallback to search
                                        onQtyEnter();
                                    }
                                }
                            } else if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                focusLine(nextLineId);
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                if (!focusLine(prevLineId) && onQtyEnter) {
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
                <div className={`px-1 md:px-2 py-0.5 rounded border font-mono font-bold text-caption md:text-xs min-w-[32px] md:min-w-[40px] text-center ${ecartClass}`}>
                    {currentEcart > 0 ? '+' : ''}{currentEcart}
                </div>
            </div>

            {/* Actions - hidden on mobile */}
            {!isReadOnly && (
                <div className="hidden md:flex justify-end pr-1">
                    <button
                        type="button"
                        className="inline-flex items-center justify-center size-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                        onClick={() => onDeleteLine(l.id)}
                        disabled={saving}
                        title={t('common:remove')}
                        aria-label={t('common:remove')}
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    );
});

InventaireLineRow.displayName = 'InventaireLineRow';
