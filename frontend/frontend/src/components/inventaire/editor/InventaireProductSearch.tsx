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

    if (isReadOnly) return null;

    React.useEffect(() => {
        if (selectedItemIndex >= 0) {
            const el = document.getElementById(`search-result-${selectedItemIndex}`);
            if (el) {
                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedItemIndex]);

    const lotModalRef = React.useRef<HTMLDivElement>(null);

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

    const getItemProps = (index: number) => ({
        className: index === selectedItemIndex ? 'bg-primary text-primary-content shadow-lg shadow-primary/20 scale-[1.01]' : 'hover:bg-base-200'
    });

    return (
        <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-1 overflow-visible relative">
            <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-base-content/30" />
                <input 
                    ref={searchInputRef}
                    type="text" 
                    className="input input-ghost w-full h-16 pl-14 pr-16 text-lg focus:bg-base-200/50 rounded-2xl focus:outline-none" 
                    placeholder={t('inventaire.detail.search_placeholder')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    autoFocus
                />
                {loadingSearch && (
                    <div className="absolute right-6 top-1/2 -translate-y-1/2">
                        <span className="loading loading-spinner text-primary"></span>
                    </div>
                )}
            </div>

            {/* Search Results Dropdown */}
            {searchQuery && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-base-100 rounded-2xl shadow-2xl border border-base-300 max-h-[40vh] overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-200">
                {searchResults.length === 0 ? (
                  <div className="text-center py-6 text-base-content/40">
                    {loadingSearch ? (
                        <span className="loading loading-spinner text-primary"></span>
                    ) : (
                        <div className="flex flex-col items-center gap-1">
                            <Search className="h-6 w-6 opacity-20" />
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
                          className={`
                            group flex items-center justify-between py-2.5 px-4 rounded-xl cursor-pointer transition-all
                            ${itemProps.className}
                          `}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm truncate">{p.name}</div>
                            <div className={`text-[10px] flex gap-2 mt-0.5 opacity-70 ${idx === selectedItemIndex ? 'text-primary-content/80' : 'text-base-content/60'}`}>
                              <span className="font-mono">{p.cip1}</span>
                              {p.rayon_name && <span className="opacity-50">• {p.rayon_name}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${idx === selectedItemIndex ? 'bg-white/20 border-white/20' : (p.stock ?? 0) > 0 ? 'bg-success/10 text-success border-success/20' : 'bg-error/10 text-error border-error/20'}`}>
                                {p.stock ?? 0} {t('common:units_short')}
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
                <dialog className="modal modal-open">
                <div className="modal-box max-w-md rounded-2xl shadow-2xl border border-base-300 p-0 overflow-hidden bg-base-100">
                    <div className="p-6 border-b border-base-200 bg-base-50 flex items-center gap-4">
                        <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Database className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-base-content">
                                {t('inventaire.lot_modal.title', { name: selectedProductForLot.name })}
                            </h3>
                            <p className="text-sm text-base-content/60 mt-1">
                                {t('inventaire.lot_modal.subtitle')}
                            </p>
                        </div>
                    </div>
                                        <div 
                            ref={lotModalRef}
                            className="p-4 bg-base-200 max-h-[60vh] overflow-y-auto outline-none focus:ring-2 focus:ring-primary/20" 
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.ctrlKey) {
                                    handleMultiLotConfirm();
                                }
                            }}
                            tabIndex={0}
                        >
                            {loadingLots ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-4">
                                    <span className="loading loading-spinner loading-lg text-primary"></span>
                                    <p className="text-sm text-base-content/60 font-medium animate-pulse">{t('inventaire.lot_modal.loading')}</p>
                                </div>
                            ) : availableLots.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
                                    <div className="size-16 rounded-full bg-base-100 flex items-center justify-center mb-2 shadow-sm border border-base-300">
                                        <Database className="h-8 w-8 text-base-content/20" />
                                    </div>
                                    <h4 className="font-bold text-base-content text-lg">{t('inventaire.lot_modal.no_lots_title', 'Aucun lot disponible')}</h4>
                                    <p className="text-sm text-base-content/60 max-w-sm">
                                        {t('inventaire.lot_modal.no_lots_desc', "Il n'y a actuellement aucun lot en stock pour ce produit. Vous pouvez soit créer un nouveau lot spécifiquement pour cet inventaire, soit inventorier le produit globalement.")}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {availableLots.map((lot, idx) => (
                                        <div 
                                            key={lot.id}
                                            className={`flex items-center gap-4 p-4 rounded-xl border transition-all
                                                ${idx === selectedLotIndex 
                                                    ? 'bg-primary/5 border-primary shadow-sm' 
                                                    : 'bg-base-100 border-base-300'}
                                            `}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold font-mono text-base text-base-content">{lot.lot}</div>
                                                <div className="text-[10px] text-base-content/50 mt-0.5">
                                                    Exp: {formatDate(lot.date_expiration) !== '-' ? formatDate(lot.date_expiration) : 'N/A'} • {lot.quantity_remaining} u.
                                                </div>
                                            </div>
                                            
                                            <div className="w-24">
                                                <input 
                                                    id={`lot-input-${idx}`}
                                                    type="number"
                                                    className="input input-bordered w-full h-10 text-center font-mono font-bold text-sm rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                            <div className="mt-6 pt-6 border-t border-base-300 space-y-3">
                                 {/* GLOBAL */}
                                 <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${selectedLotIndex === availableLots.length ? 'bg-secondary/5 border-secondary shadow-sm' : 'bg-base-100 border-base-300'}`}>
                                    <div className="flex-1">
                                        <div className="font-bold text-sm">{t('inventaire.lot_modal.btn_global')}</div>
                                        <div className="text-[10px] opacity-50">{t('inventaire.lot_modal.desc_global')}</div>
                                    </div>
                                    <div className="w-24">
                                        <input 
                                            id="lot-input-global"
                                            type="number"
                                            className="input input-bordered w-full h-10 text-center font-mono font-bold text-sm rounded-lg focus:border-secondary"
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
                                    className="w-full flex items-center justify-between p-3 rounded-xl border border-dashed border-base-300 hover:border-primary hover:bg-primary/5 transition-all group"
                                >
                                    <div className="text-left">
                                        <div className="font-bold text-sm group-hover:text-primary transition-colors">{t('inventaire.lot_modal.btn_new')}</div>
                                        <div className="text-[10px] opacity-40">{t('inventaire.lot_modal.desc_new')}</div>
                                    </div>
                                    <Plus className="h-4 w-4 opacity-30 group-hover:opacity-100 group-hover:text-primary transition-all" />
                                </button>
                            </div>
                        </div>
                    
                        <div className="p-4 border-t border-base-200 bg-base-50 flex justify-between gap-3">
                            <button 
                                className="btn btn-ghost rounded-xl flex-1" 
                                onClick={() => {
                                    setShowLotModal(false);
                                    setSelectedProductForLot(null);
                                    setLotQuantities({});
                                    focusInput();
                                }}
                            >
                                {t('common:cancel')}
                            </button>
                            <button 
                                className="btn btn-primary rounded-xl flex-[2] shadow-lg shadow-primary/20 gap-2 font-bold"
                                onClick={handleMultiLotConfirm}
                                disabled={loadingLots}
                            >
                                <CheckCircle2 className="h-5 w-5" />
                                {t('common:confirm')} (Ctrl+Enter)
                            </button>
                        </div>
                    </div>
                    <form method="dialog" className="modal-backdrop">
                        <button onClick={() => {
                            setShowLotModal(false);
                            setSelectedProductForLot(null);
                            setLotQuantities({});
                            focusInput();
                        }}>{t('common:actions.close', 'close')}</button>
                    </form>
                </dialog>
            )}
        </div>
    );
};
