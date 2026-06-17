import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Database, Plus, CheckCircle2 } from 'lucide-react';
import { useProductSearch } from '../../../hooks/inventaire/useProductSearch';
import { formatDate } from '../../../utils/dateUtils';

interface InventaireProductSearchProps {
    searchLogic: ReturnType<typeof useProductSearch>;
    isReadOnly: boolean;
}

export const InventaireProductSearch: React.FC<InventaireProductSearchProps> = ({
    searchLogic,
    isReadOnly
}) => {
    const { t } = useTranslation(['stock', 'common']);
    const {
        searchQuery, setSearchQuery,
        searchResults, loadingSearch,
        selectedItemIndex, searchInputRef, focusInput,
        handleSearchKeyDown, handleProductSelect,
        showLotModal, setShowLotModal,
        selectedProductForLot, setSelectedProductForLot,
        availableLots, loadingLots, selectedLotIndex, setSelectedLotIndex,
        lotQuantities, setLotQuantities,
        handleLotSelection,
        handleMultiLotConfirm
    } = searchLogic;

    const lotModalRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (selectedItemIndex >= 0) {
            const el = document.getElementById(`search-result-${selectedItemIndex}`);
            if (el) {
                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedItemIndex]);

    React.useEffect(() => {
        if (showLotModal && lotModalRef.current) {
            lotModalRef.current.focus();
        }
    }, [showLotModal]);

    React.useEffect(() => {
        if (showLotModal && !loadingLots) {
            const firstInput = document.getElementById('lot-input-0') || document.getElementById('lot-input-global');
            if (firstInput) {
                (firstInput as HTMLInputElement).focus();
                (firstInput as HTMLInputElement).select();
            }
        }
    }, [showLotModal, loadingLots]);

    if (isReadOnly) return null;

    const getItemProps = (index: number) => ({
        className: index === selectedItemIndex
            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-[1.01]'
            : 'hover:bg-slate-100'
    });

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-1 overflow-visible relative">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                <input
                    ref={searchInputRef}
                    type="text"
                    className="w-full h-8 pl-10 pr-10 text-sm bg-transparent rounded-lg focus:bg-slate-50/50 outline-none text-slate-700 placeholder:text-slate-300"
                    placeholder={t('inventaire.detail.search_placeholder')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    autoFocus
                />
                {loadingSearch && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full size-4 border-b-2 border-emerald-500"></div>
                    </div>
                )}
            </div>

            {/* Search Results Dropdown */}
            {searchQuery && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-[12vh] overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-200">
                {searchResults.length === 0 ? (
                  <div className="text-center py-6 text-slate-400">
                    {loadingSearch ? (
                        <div className="flex justify-center"><div className="animate-spin rounded-full size-5 border-b-2 border-emerald-500"></div></div>
                    ) : (
                        <div className="flex flex-col items-center gap-1">
                            <Search className="h-6 w-6 text-slate-200" />
                            <p className="text-sm">{t('inventaire.detail.no_result')}</p>
                        </div>
                    )}
                  </div>
                ) : (
                  <div className="p-1 space-y-0.5">
                    {searchResults.map((p, idx) => {
                      const itemProps = getItemProps(idx);
                      return (
                        <div
                          key={p.id}
                          id={`search-result-${idx}`}
                          onClick={() => handleProductSelect(p)}
                          className={`group flex items-center justify-between py-1.5 px-3 rounded-lg cursor-pointer transition-all ${itemProps.className}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs truncate">{p.name}</div>
                            <div className={`text-[9px] flex gap-1.5 mt-0.5 ${idx === selectedItemIndex ? 'text-white/80' : 'text-slate-500'}`}>
                              <span className="font-mono">{p.cip1}</span>
                              {p.rayon_name && <span>• {p.rayon_name}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-mono ${idx === selectedItemIndex ? 'text-white/70' : 'text-slate-400'}`}>
                              {(p.selling_price ?? 0).toLocaleString()} F
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${idx === selectedItemIndex ? 'bg-white/20 border-white/20 text-white' : (p.stock ?? 0) > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-500 border-red-200'}`}>
                                {p.stock ?? 0}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Lot Selection Modal */}
            {showLotModal && selectedProductForLot && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-4">
                            <div className="size-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                                <Database className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">
                                    {t('inventaire.lot_modal.title', { name: selectedProductForLot.name })}
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    {t('inventaire.lot_modal.subtitle')}
                                </p>
                            </div>
                        </div>
                        <div
                            ref={lotModalRef}
                            className="p-4 bg-slate-50 max-h-[60vh] overflow-y-auto outline-none focus:ring-2 focus:ring-emerald-500/20"
                            onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleMultiLotConfirm(); }}
                            tabIndex={0}
                        >
                            {loadingLots ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-4">
                                    <div className="animate-spin rounded-full size-10 border-b-2 border-emerald-500"></div>
                                    <p className="text-sm text-slate-500 font-medium animate-pulse">{t('inventaire.lot_modal.loading')}</p>
                                </div>
                            ) : availableLots.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
                                    <div className="size-16 rounded-full bg-white flex items-center justify-center mb-2 shadow-sm border border-slate-200">
                                        <Database className="h-8 w-8 text-slate-200" />
                                    </div>
                                    <h4 className="font-bold text-slate-700 text-lg">{t('inventaire.lot_modal.no_lots_title', 'Aucun lot disponible')}</h4>
                                    <p className="text-sm text-slate-500 max-w-sm">
                                        {t('inventaire.lot_modal.no_lots_desc', "Il n'y a actuellement aucun lot en stock pour ce produit.")}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {availableLots.map((lot, idx) => (
                                        <div
                                            key={lot.id}
                                            className={`flex items-center gap-4 p-4 rounded-xl border transition-all
                                                ${idx === selectedLotIndex
                                                    ? 'bg-emerald-50 border-emerald-300 shadow-sm'
                                                    : 'bg-white border-slate-200'}`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold font-mono text-base text-slate-800">{lot.lot}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    Exp: {formatDate(lot.date_expiration) !== '-' ? formatDate(lot.date_expiration) : 'N/A'} • {lot.quantity_remaining} u.
                                                </div>
                                            </div>
                                            <div className="w-24">
                                                <input
                                                    id={`lot-input-${idx}`}
                                                    type="number"
                                                    className="w-full h-10 text-center font-mono font-bold text-sm rounded-lg border border-slate-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                                                    value={lotQuantities[lot.id.toString()] ?? ''}
                                                    onChange={e => setLotQuantities(prev => ({ ...prev, [lot.id.toString()]: e.target.value }))}
                                                    onFocus={() => setSelectedLotIndex(idx)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const nextInput = document.getElementById(`lot-input-${idx + 1}`) || document.getElementById('lot-input-global');
                                                            if (nextInput) (nextInput as HTMLInputElement).focus();
                                                            else handleMultiLotConfirm();
                                                        } else if (e.key === 'ArrowDown') {
                                                            e.preventDefault();
                                                            const nextInput = document.getElementById(`lot-input-${idx + 1}`) || document.getElementById('lot-input-global');
                                                            if (nextInput) (nextInput as HTMLInputElement).focus();
                                                        } else if (e.key === 'ArrowUp') {
                                                            e.preventDefault();
                                                            const prevInput = document.getElementById(`lot-input-${idx - 1}`);
                                                            if (prevInput) (prevInput as HTMLInputElement).focus();
                                                        }
                                                    }}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Options supplémentaires */}
                            <div className="mt-6 pt-6 border-t border-slate-200 space-y-3">
                                {/* GLOBAL */}
                                <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${selectedLotIndex === availableLots.length ? 'bg-slate-100 border-slate-400 shadow-sm' : 'bg-white border-slate-200'}`}>
                                    <div className="flex-1">
                                        <div className="font-bold text-sm text-slate-700">{t('inventaire.lot_modal.btn_global')}</div>
                                        <div className="text-[10px] text-slate-400">{t('inventaire.lot_modal.desc_global')}</div>
                                    </div>
                                    <div className="w-24">
                                        <input
                                            id="lot-input-global"
                                            type="number"
                                            className="w-full h-10 text-center font-mono font-bold text-sm rounded-lg border border-slate-200 bg-white focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 outline-none transition-all"
                                            value={lotQuantities['GLOBAL'] ?? ''}
                                            onChange={e => setLotQuantities(prev => ({ ...prev, ['GLOBAL']: e.target.value }))}
                                            onFocus={() => setSelectedLotIndex(availableLots.length)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleMultiLotConfirm();
                                                } else if (e.key === 'ArrowUp') {
                                                    e.preventDefault();
                                                    const prevInput = document.getElementById(`lot-input-${availableLots.length - 1}`);
                                                    if (prevInput) (prevInput as HTMLInputElement).focus();
                                                }
                                            }}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                {/* NEW LOT */}
                                <button
                                    onClick={() => handleLotSelection('NEW')}
                                    className="w-full flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
                                >
                                    <div className="text-left">
                                        <div className="font-bold text-sm text-slate-700 group-hover:text-emerald-600 transition-colors">{t('inventaire.lot_modal.btn_new')}</div>
                                        <div className="text-[10px] text-slate-400">{t('inventaire.lot_modal.desc_new')}</div>
                                    </div>
                                    <Plus className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-all" />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between gap-3">
                            <button
                                className="inline-flex items-center justify-center h-10 flex-1 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                                onClick={() => { setShowLotModal(false); setSelectedProductForLot(null); setLotQuantities({}); focusInput(); }}
                            >
                                {t('common:cancel')}
                            </button>
                            <button
                                className="inline-flex items-center justify-center h-10 flex-[2] rounded-xl text-sm font-black bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors gap-2 disabled:opacity-60"
                                onClick={handleMultiLotConfirm}
                                disabled={loadingLots}
                            >
                                <CheckCircle2 className="h-5 w-5" />
                                {t('common:confirm')} (Ctrl+Enter)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
