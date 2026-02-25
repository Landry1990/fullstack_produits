import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Database } from 'lucide-react';
import { useProductSearch } from '../../../hooks/inventaire/useProductSearch';

interface InventaireProductSearchProps {
    searchLogic: ReturnType<typeof useProductSearch>;
    isReadOnly: boolean;
}

export const InventaireProductSearch: React.FC<InventaireProductSearchProps> = ({
    searchLogic,
    isReadOnly
}) => {
    const { t } = useTranslation();
    const {
        searchQuery, setSearchQuery,
        searchResults, loadingSearch,
        selectedItemIndex, searchInputRef, focusInput,
        handleSearchKeyDown, handleProductSelect,
        showLotModal, setShowLotModal,
        selectedProductForLot, setSelectedProductForLot,
        availableLots, loadingLots, selectedLotIndex,
        handleLotSelection, handleLotModalKeyDown
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
        if (showLotModal && selectedLotIndex >= 0) {
            const el = document.getElementById(`lot-option-${selectedLotIndex}`);
            if (el) {
                el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
            }
        }
    }, [selectedLotIndex, showLotModal]);

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
                    placeholder={t('stock.inventaire.detail.search_placeholder')}
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
                            <p className="text-sm">{t('stock.inventaire.detail.no_result')}</p>
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
                                {p.stock ?? 0} {t('common.units', { defaultValue: 'TEST_STK' })}
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
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Database className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-base-content">
                                {t('stock.inventaire.lot_modal.title', { name: selectedProductForLot.name })}
                            </h3>
                            <p className="text-sm text-base-content/60 mt-1">
                                {t('stock.inventaire.lot_modal.subtitle')}
                            </p>
                        </div>
                    </div>
                
                    <div 
                        ref={lotModalRef}
                        className="p-4 bg-base-200 max-h-[60vh] overflow-y-auto outline-none focus:ring-2 focus:ring-primary/20" 
                        onKeyDown={handleLotModalKeyDown} 
                        tabIndex={0}
                    >
                        {loadingLots ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-4">
                                <span className="loading loading-spinner loading-lg text-primary"></span>
                                <p className="text-sm text-base-content/60 font-medium animate-pulse">{t('stock.inventaire.lot_modal.loading')}</p>
                            </div>
                        ) : availableLots.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
                                <div className="w-16 h-16 rounded-full bg-base-100 flex items-center justify-center mb-2 shadow-sm border border-base-300">
                                    <Database className="h-8 w-8 text-base-content/20" />
                                </div>
                                <h4 className="font-bold text-base-content text-lg">Aucun lot disponible</h4>
                                <p className="text-sm text-base-content/60 max-w-sm">
                                    Il n'y a actuellement aucun lot en stock pour ce produit. Vous pouvez soit créer un nouveau lot spécifiquement pour cet inventaire, soit inventorier le produit globalement.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {availableLots.map((lot, idx) => (
                                    <button
                                        key={lot.id}
                                        id={`lot-option-${idx}`}
                                        onClick={() => handleLotSelection(lot.id)}
                                        className={`w-full text-left p-4 rounded-xl transition-all border
                                            ${idx === selectedLotIndex 
                                                ? 'bg-primary text-primary-content border-primary shadow-lg scale-[1.02] z-10' 
                                                : 'bg-base-100 hover:bg-base-50 border-base-300 hover:border-primary/30'}
                                        `}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <div className="font-bold font-mono text-lg">{lot.lot}</div>
                                                <div className={`text-xs mt-1 ${idx === selectedLotIndex ? 'text-primary-content/70' : 'text-base-content/60'}`}>
                                                    Exp: {lot.date_expiration ? new Date(lot.date_expiration).toLocaleDateString() : 'N/A'}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-bold">
                                                    {lot.quantity_remaining} unités
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        
                        {/* Options supplémentaires toujours visibles en bas */}
                        <div className="mt-4 pt-4 border-t border-base-300 space-y-2">
                             <button
                                id={`lot-option-${availableLots.length}`}
                                onClick={() => handleLotSelection('GLOBAL')}
                                className={`w-full text-left p-4 rounded-xl transition-all border
                                    ${availableLots.length === selectedLotIndex 
                                        ? 'bg-secondary text-secondary-content border-secondary shadow-lg scale-[1.02] z-10' 
                                        : 'bg-base-100 hover:bg-base-50 border-base-300 hover:border-secondary/30'}
                                `}
                            >
                                <div className="font-bold">{t('stock.inventaire.lot_modal.btn_global')}</div>
                                <div className={`text-xs mt-1 ${availableLots.length === selectedLotIndex ? 'text-secondary-content/70' : 'text-base-content/60'}`}>
                                   {t('stock.inventaire.lot_modal.desc_global')}
                                </div>
                            </button>
                             <button
                                id={`lot-option-${availableLots.length + 1}`}
                                onClick={() => handleLotSelection('NEW')}
                                className={`w-full text-left p-4 rounded-xl transition-all border
                                    ${availableLots.length + 1 === selectedLotIndex 
                                        ? 'bg-accent text-accent-content border-accent shadow-lg scale-[1.02] z-10' 
                                        : 'bg-base-100 hover:bg-base-50 border-base-300 hover:border-accent/30'}
                                `}
                            >
                                <div className="font-bold">{t('stock.inventaire.lot_modal.btn_new')}</div>
                                <div className={`text-xs mt-1 ${availableLots.length + 1 === selectedLotIndex ? 'text-accent-content/70' : 'text-base-content/60'}`}>
                                    {t('stock.inventaire.lot_modal.desc_new')}
                                </div>
                            </button>
                        </div>
                    </div>
                
                    <div className="p-4 border-t border-base-200 bg-base-50 flex justify-end">
                        <button 
                            className="btn btn-ghost rounded-xl" 
                            onClick={() => {
                                setShowLotModal(false);
                                setSelectedProductForLot(null);
                                focusInput();
                            }}
                        >
                            {t('common.actions.cancel', { defaultValue: 'Annuler' })} (Esc)
                        </button>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button onClick={() => {
                        setShowLotModal(false);
                        setSelectedProductForLot(null);
                        focusInput();
                    }}>close</button>
                </form>
            </dialog>
            )}
        </div>
    );
};
