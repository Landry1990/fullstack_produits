import React from 'react';
import { Truck, Search, MoreVertical, X, Calendar, CheckSquare, Trash2, UserPlus, Eye, EyeOff, Phone } from 'lucide-react';
import type { useFournisseurs } from '../../hooks/useFournisseurs';
import { formatCurrency } from '../../utils/formatters';

interface Props {
  hook: ReturnType<typeof useFournisseurs>;
}

export default function FournisseursList({ hook }: Props) {
  const { state, actions } = hook;
  const {
    t,
    fournisseurs,
    selectedFournisseur,
    selectedIds,
    currentPage,
    totalCount,
    totalPages,
    searchTerm,
    highlightedIndex,
    showInactive,
    searchInputRef
  } = state;

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="md:col-span-1 bg-base-100 rounded-2xl shadow-sm border border-base-200 flex flex-col overflow-hidden h-full">
      {/* Header with Search and Actions */}
      <div className="p-0 border-b border-base-200 bg-base-100 relative z-20 shrink-0 sticky top-0 overflow-visible">
        <div className="p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center h-10">
            {selectedIds.length > 0 ? (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200 w-full">
                <div className="dropdown dropdown-bottom">
                  <div tabIndex={0} role="button" className="btn btn-sm btn-primary gap-2 h-9 rounded-xl">
                    <MoreVertical className="size-4" />
                    {t('common:actions_title', { defaultValue: 'Actions' })}
                    <span className="badge badge-sm bg-primary-focus border-none text-white">{selectedIds.length}</span>
                  </div>
                  <ul tabIndex={0} className="dropdown-content z-[100] menu p-2 shadow-2xl bg-base-100 rounded-box w-56 border border-base-200 mt-2">
                    <li className="menu-title px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-base-content/40">
                      {t('common:bulk_actions', { defaultValue: 'Actions Groupées' })}
                    </li>
                    <li>
                      <a onClick={actions.handleBulkDelete} className="flex items-center gap-3 py-3 hover:bg-error/10 text-error font-medium">
                        <Trash2 className="size-4" /> {t('common:actions.delete', { defaultValue: 'Supprimer' })}
                      </a>
                    </li>
                  </ul>
                </div>
                <button 
                  onClick={() => state.setSelectedIds([])}
                  className="btn btn-sm btn-ghost gap-2 text-base-content/60 hover:text-base-content h-9 rounded-xl ml-auto"
                >
                  <X className="size-4" />
                  {t('common:actions.cancel', { defaultValue: 'Annuler' })}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 animate-in fade-in duration-300">
                  <div className="p-2 bg-primary/10 text-primary rounded-xl">
                    <Truck className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg tracking-tight leading-none">{t('providers:title')}</h2>
                    <span className="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">{totalCount} {t('common:items', { defaultValue: 'fournisseurs' })}</span>
                  </div>
                </div>
                <div className="flex gap-1 items-center">
                  <button 
                    className={`btn btn-sm btn-ghost btn-square rounded-xl ${showInactive ? 'bg-base-200 text-base-content' : 'text-base-content/40'}`} 
                    onClick={() => state.setShowInactive(!showInactive)}
                    title={showInactive ? t('providers:hide_inactive') : t('providers:show_inactive')}
                  >
                    {showInactive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </button>
                  <button className="btn btn-sm btn-ghost btn-square rounded-xl text-secondary/60 hover:text-secondary hover:bg-secondary/10" onClick={() => state.setIsEcheancierModalOpen(true)} title={t('providers:schedule_btn')}>
                    <Calendar className="size-4" />
                  </button>
                  <button className="btn btn-sm btn-ghost btn-square rounded-xl text-neutral/60 hover:text-neutral hover:bg-neutral/10" onClick={() => state.setIsPointageModalOpen(true)} title={t('providers:pointage_btn')}>
                    <CheckSquare className="size-4" />
                  </button>
                </div>
              </>
            )}
          </div>
          
          <div className="flex gap-2">
            <div className="relative group flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 group-focus-within:text-primary transition-colors">
                <Search className="size-4" />
              </span>
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder={t('providers:search_placeholder')}
                className="input input-sm input-bordered w-full pl-10 h-10 bg-base-200/50 border-transparent focus:border-primary focus:bg-base-100 transition-all rounded-xl shadow-none font-medium" 
                value={searchTerm}
                onChange={(e) => {
                  state.setSearchTerm(e.target.value);
                  state.setHighlightedIndex(-1);
                }}
                onKeyDown={actions.handleKeyDown}
              />
            </div>
            {!selectedIds.length && (
              <button className="btn btn-primary btn-square btn-md h-10 w-10 shadow-sm rounded-xl" onClick={actions.openAddModal} title={t('providers:new_provider')}>
                <UserPlus className="size-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List content */}
      <div className="flex-1 overflow-auto p-2 space-y-1 custom-scrollbar">
        {fournisseurs.length > 0 ? (
          fournisseurs.map((fournisseur, index) => {
            const isSelected = selectedFournisseur?.id === fournisseur.id;
            const isChecked = selectedIds.includes(fournisseur.id!);
            const isHighlighted = searchTerm && highlightedIndex === index;
            const solde = Number(fournisseur.solde_dette || 0);

            return (
              <div 
                key={fournisseur.id} 
                className={`group flex items-center p-3 rounded-2xl cursor-pointer transition-all relative overflow-hidden border border-transparent ${
                  isSelected 
                    ? 'bg-primary/10 border-primary/20 shadow-sm' 
                    : isHighlighted 
                      ? 'bg-base-200 border-base-300' 
                      : isChecked
                        ? 'bg-success/5 border-success/20'
                        : 'hover:bg-base-200/50'
                }`}
                onClick={() => actions.selectFournisseur(fournisseur)}
              >
                {/* Selection Indicator */}
                {isSelected && <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-full" />}
                
                {/* Checkbox */}
                <div className="mr-3 scale-90" onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    className={`checkbox checkbox-sm rounded-lg border-base-300 transition-all ${isChecked ? 'checkbox-success' : 'checkbox-primary opacity-0 group-hover:opacity-100'}`}
                    checked={isChecked}
                    onChange={() => actions.toggleSelect(fournisseur.id!)}
                  />
                </div>

                {/* Avatar */}
                <div className={`size-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-all ${
                  isSelected ? 'bg-primary text-primary-content shadow-lg shadow-primary/20 scale-105' : 'bg-base-200 text-base-content/60 group-hover:bg-base-300'
                }`}>
                  {getInitials(fournisseur.name)}
                </div>

                {/* Info */}
                <div className="ml-3 flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className={`font-bold text-sm truncate transition-colors ${isSelected ? 'text-primary' : 'text-base-content'}`}>
                      {fournisseur.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {fournisseur.phone ? (
                       <div className="flex items-center gap-1 text-[10px] text-base-content/40 font-mono">
                         <Phone className="size-3" />
                         {fournisseur.phone}
                       </div>
                    ) : (
                      <span className="text-[10px] text-base-content/30 italic">{t('common:no_phone', { defaultValue: 'Aucun numéro' })}</span>
                    )}
                  </div>
                </div>

                {/* Balance Badge */}
                {solde !== 0 && (
                  <div className="ml-2 text-right">
                    <div className={`text-[11px] font-black font-mono px-2 py-1 rounded-lg ${
                      solde > 0 
                        ? 'bg-red-100/50 text-red-600 dark:bg-red-900/20 dark:text-red-400' 
                        : 'bg-emerald-100/50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                    }`}>
                      {formatCurrency(solde)}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="size-20 rounded-full bg-base-200 flex items-center justify-center mb-6">
              <Truck className="size-10 text-base-content/20" />
            </div>
            <h3 className="text-lg font-bold text-base-content/70">{searchTerm ? t('providers:no_result') : t('providers:empty_list')}</h3>
            <p className="text-sm text-base-content/40 mt-1">{t('providers:search_hint', { defaultValue: 'Essayez de changer vos critères de recherche.' })}</p>
          </div>
        )}
      </div>
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-base-200 bg-base-100 flex items-center justify-between shrink-0">
          <button
            className="btn btn-xs btn-ghost gap-1 font-bold disabled:opacity-30"
            disabled={currentPage <= 1}
            onClick={() => state.setCurrentPage((p: number) => p - 1)}
          >
            <X className="size-3 rotate-45" /> {t('common:pagination.prev', { defaultValue: 'Préc.' })}
          </button>
          
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) { page = i + 1; }
              else if (currentPage <= 3) { page = i + 1; }
              else if (currentPage >= totalPages - 2) { page = totalPages - 4 + i; }
              else { page = currentPage - 2 + i; }
              return (
                <button
                  key={page}
                  className={`size-6 rounded-lg text-[10px] font-bold transition-all ${
                    currentPage === page 
                      ? 'bg-primary text-primary-content shadow-sm' 
                      : 'hover:bg-base-200 text-base-content/60'
                  }`}
                  onClick={() => state.setCurrentPage(page)}
                >{page}</button>
              );
            })}
          </div>

          <button
            className="btn btn-xs btn-ghost gap-1 font-bold disabled:opacity-30"
            disabled={currentPage >= totalPages}
            onClick={() => state.setCurrentPage((p: number) => p + 1)}
          >
             {t('common:pagination.next', { defaultValue: 'Suiv.' })} <X className="size-3 -rotate-45" />
          </button>
        </div>
      )}
    </div>
  );
}
