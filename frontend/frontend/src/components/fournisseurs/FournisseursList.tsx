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
    <div className="md:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-full">
      {/* Header with Search and Actions */}
      <div className="p-4 border-b border-gray-100 shrink-0">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center h-10">
            {selectedIds.length > 0 ? (
              <div className="flex items-center gap-2 w-full animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="dropdown dropdown-bottom">
                  <div tabIndex={0} role="button" className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                    <MoreVertical className="size-4" />
                    {t('common:actions_title', { defaultValue: 'Actions' })}
                    <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs bg-white/20 rounded-full">{selectedIds.length}</span>
                  </div>
                  <ul tabIndex={0} className="dropdown-content z-[100] menu p-2 shadow-xl bg-white rounded-lg w-52 border border-gray-100 mt-1">
                    <li className="menu-title px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {t('common:bulk_actions', { defaultValue: 'Actions Groupées' })}
                    </li>
                    <li>
                      <a onClick={actions.handleBulkDelete} className="flex items-center gap-2 py-2 hover:bg-red-50 text-red-600 font-medium text-sm">
                        <Trash2 className="size-4" /> {t('common:actions.delete', { defaultValue: 'Supprimer' })}
                      </a>
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => state.setSelectedIds([])}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="size-4" />
                  {t('common:actions.cancel', { defaultValue: 'Annuler' })}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Truck className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-gray-900 leading-none">{t('providers:title')}</h2>
                    <span className="text-[10px] text-gray-400 font-medium">{totalCount} {t('common:items', { defaultValue: 'fournisseurs' })}</span>
                  </div>
                </div>
                <div className="flex gap-1 items-center">
                  <button
                    className={`p-2 rounded-lg transition-colors ${showInactive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'}`}
                    onClick={() => state.setShowInactive(!showInactive)}
                    title={showInactive ? t('providers:hide_inactive') : t('providers:show_inactive')}
                  >
                    {showInactive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </button>
                  <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors" onClick={() => state.setIsEcheancierModalOpen(true)} title={t('providers:schedule_btn')}>
                    <Calendar className="size-4" />
                  </button>
                  <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors" onClick={() => state.setIsPointageModalOpen(true)} title={t('providers:pointage_btn')}>
                    <CheckSquare className="size-4" />
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t('providers:search_placeholder')}
                className="input input-sm input-bordered w-full pl-10 h-9 bg-gray-50 border-gray-200 focus:border-indigo-500 focus:bg-white transition-all rounded-lg text-sm"
                value={searchTerm}
                onChange={(e) => {
                  state.setSearchTerm(e.target.value);
                  state.setHighlightedIndex(-1);
                }}
                onKeyDown={actions.handleKeyDown}
              />
            </div>
            {!selectedIds.length && (
              <button className="inline-flex items-center justify-center h-9 w-9 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors" onClick={actions.openAddModal} title={t('providers:new_provider')}>
                <UserPlus className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List content */}
      <div className="flex-1 overflow-auto p-2 space-y-0.5">
        {fournisseurs.length > 0 ? (
          fournisseurs.map((fournisseur, index) => {
            const isSelected = selectedFournisseur?.id === fournisseur.id;
            const isChecked = selectedIds.includes(fournisseur.id!);
            const isHighlighted = searchTerm && highlightedIndex === index;
            const solde = Number(fournisseur.solde_dette || 0);

            return (
              <div
                key={fournisseur.id}
                className={`group flex items-center p-2.5 rounded-lg cursor-pointer transition-all border border-transparent ${
                  isSelected
                    ? 'bg-indigo-50 border-indigo-100 shadow-sm'
                    : isHighlighted
                      ? 'bg-gray-100 border-gray-200'
                      : isChecked
                        ? 'bg-green-50 border-green-100'
                        : 'hover:bg-gray-50'
                }`}
                onClick={() => actions.selectFournisseur(fournisseur)}
              >
                {/* Selection Indicator */}
                {isSelected && <div className="absolute left-0 top-2.5 bottom-2.5 w-0.5 bg-indigo-500 rounded-full" />}

                {/* Checkbox */}
                <div className="mr-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className={`checkbox checkbox-xs rounded border-gray-300 transition-all ${isChecked ? 'checkbox-success' : 'opacity-0 group-hover:opacity-100'}`}
                    checked={isChecked}
                    onChange={() => actions.toggleSelect(fournisseur.id!)}
                  />
                </div>

                {/* Avatar */}
                <div className={`size-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0 transition-all ${
                  isSelected ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                }`}>
                  {getInitials(fournisseur.name)}
                </div>

                {/* Info */}
                <div className="ml-2.5 flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className={`text-sm font-semibold truncate transition-colors ${isSelected ? 'text-indigo-700' : 'text-gray-900'}`}>
                      {fournisseur.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {fournisseur.phone ? (
                       <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono">
                         <Phone className="size-3" />
                         {fournisseur.phone}
                       </div>
                    ) : (
                      <span className="text-[10px] text-gray-400 italic">{t('common:no_phone', { defaultValue: 'Aucun numéro' })}</span>
                    )}
                  </div>
                </div>

                {/* Balance Badge */}
                {solde !== 0 && (
                  <div className="ml-2 text-right">
                    <div className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded-md ${
                      solde > 0
                        ? 'bg-red-50 text-red-600 border border-red-100'
                        : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    }`}>
                      {formatCurrency(solde)}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
            <div className="size-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Truck className="size-8 text-gray-300" />
            </div>
            <h3 className="text-base font-semibold text-gray-500">{searchTerm ? t('providers:no_result') : t('providers:empty_list')}</h3>
            <p className="text-sm text-gray-400 mt-1">{t('providers:search_hint', { defaultValue: 'Essayez de changer vos critères de recherche.' })}</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="px-3 py-2 border-t border-gray-100 bg-white flex items-center justify-between shrink-0">
          <button
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-30 transition-colors"
            disabled={currentPage <= 1}
            onClick={() => state.setCurrentPage((p: number) => p - 1)}
          >
            {t('common:pagination.prev', { defaultValue: 'Préc.' })}
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
                  className={`size-7 rounded-md text-xs font-medium transition-all ${
                    currentPage === page
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'hover:bg-gray-100 text-gray-500'
                  }`}
                  onClick={() => state.setCurrentPage(page)}
                >{page}</button>
              );
            })}
          </div>

          <button
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-30 transition-colors"
            disabled={currentPage >= totalPages}
            onClick={() => state.setCurrentPage((p: number) => p + 1)}
          >
             {t('common:pagination.next', { defaultValue: 'Suiv.' })}
          </button>
        </div>
      )}
    </div>
  );
}
