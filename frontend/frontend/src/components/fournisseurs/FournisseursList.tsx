import React from 'react';
import { Truck, Search, MoreVertical, X, Calendar, CheckSquare, Trash2, UserPlus, Eye, EyeOff, Phone } from 'lucide-react';
import type { useFournisseurs } from '../../hooks/useFournisseurs';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { cn } from '../../lib/utils';

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
    <div className="md:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-full">
      {/* Header with Search and Actions */}
      <div className="p-4 border-b border-slate-200 shrink-0">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center h-10">
            {selectedIds.length > 0 ? (
              <div className="flex items-center gap-2 w-full animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="dropdown-ref dropdown-ref-bottom-ref">
                  <div tabIndex={0} role="button" className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                    <MoreVertical className="size-4" />
                    {t('common:actions_title', { defaultValue: 'Actions' })}
                    <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs bg-white/20 rounded-full">{selectedIds.length}</span>
                  </div>
                  <ul tabIndex={0} className="dropdown-ref-content-ref z-[100] menu-ref p-2 shadow-xl bg-white rounded-lg w-52 border border-slate-200 mt-1">
                    <li className="menu-title px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {t('common:bulk_actions', { defaultValue: 'Actions Groupées' })}
                    </li>
                    <li>
                      <a onClick={actions.handleBulkDelete} className="flex items-center gap-2 py-2 hover:bg-red-50 text-red-600 font-medium text-sm">
                        <Trash2 className="size-4" /> {t('common:actions.delete', { defaultValue: 'Supprimer' })}
                      </a>
                    </li>
                  </ul>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => state.setSelectedIds([])}
                  className="ml-auto gap-1.5 text-slate-500"
                >
                  <X className="size-4" />
                  {t('common:actions.cancel', { defaultValue: 'Annuler' })}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <Truck className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-slate-800 leading-none">{t('providers:title')}</h2>
                    <Badge variant="secondary" className="text-[10px] mt-1">{totalCount} {t('common:items', { defaultValue: 'fournisseurs' })}</Badge>
                  </div>
                </div>
                <div className="flex gap-1 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("size-9", showInactive ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500')}
                    onClick={() => state.setShowInactive(!showInactive)}
                    title={showInactive ? t('providers:hide_inactive') : t('providers:show_inactive')}
                  >
                    {showInactive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="size-9 text-slate-500" onClick={() => state.setIsEcheancierModalOpen(true)} title={t('providers:schedule_btn')}>
                    <Calendar className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-9 text-slate-500" onClick={() => state.setIsPointageModalOpen(true)} title={t('providers:pointage_btn')}>
                    <CheckSquare className="size-4" />
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t('providers:search_placeholder')}
                className="w-full pl-10 h-9 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
                value={searchTerm}
                onChange={(e) => {
                  state.setSearchTerm(e.target.value);
                  state.setHighlightedIndex(-1);
                }}
                onKeyDown={actions.handleKeyDown}
              />
            </div>
            {!selectedIds.length && (
              <Button size="icon" className="h-9 w-9 bg-emerald-600 hover:bg-emerald-700" onClick={actions.openAddModal} title={t('providers:new_provider')}>
                <UserPlus className="size-4" />
              </Button>
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
                className={cn("group flex items-center p-2.5 rounded-lg cursor-pointer transition-all border border-transparent relative",
                  isSelected ? 'bg-emerald-50 border-emerald-100 shadow-sm' : isHighlighted ? 'bg-slate-100 border-slate-200' : isChecked ? 'bg-emerald-50/50 border-emerald-100' : 'hover:bg-slate-100')}
                onClick={() => actions.selectFournisseur(fournisseur)}
              >
                {/* Selection Indicator */}
                {isSelected && <div className="absolute left-0 top-2.5 bottom-2.5 w-0.5 bg-emerald-500 rounded-full" />}

                {/* Checkbox */}
                <div className="mr-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className={cn("size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer transition-all", isChecked ? '' : 'opacity-0 group-hover:opacity-100')}
                    checked={isChecked}
                    onChange={() => actions.toggleSelect(fournisseur.id!)}
                  />
                </div>

                {/* Avatar */}
                <div className={cn("size-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0 transition-all",
                  isSelected ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200')}>
                  {getInitials(fournisseur.name)}
                </div>

                {/* Info */}
                <div className="ml-2.5 flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className={cn("text-sm font-semibold truncate transition-colors", isSelected ? 'text-emerald-700' : 'text-slate-800')}>
                      {fournisseur.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {fournisseur.phone ? (
                       <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                         <Phone className="size-3" />
                         {fournisseur.phone}
                       </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">{t('common:no_phone', { defaultValue: 'Aucun numéro' })}</span>
                    )}
                  </div>
                </div>

                {/* Balance Badge */}
                {solde !== 0 && (
                  <div className="ml-2 text-right">
                    <Badge variant="outline" className={cn("text-[10px] font-semibold font-mono px-2 py-0.5",
                      solde > 0 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200')}>
                      {formatCurrency(solde)}
                    </Badge>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
            <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Truck className="size-8 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-600">{searchTerm ? t('providers:no_result') : t('providers:empty_list')}</h3>
            <p className="text-sm text-slate-400 mt-1">{t('providers:search_hint', { defaultValue: 'Essayez de changer vos critères de recherche.' })}</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={currentPage <= 1}
            onClick={() => state.setCurrentPage((p: number) => p - 1)}
          >
            {t('common:pagination.prev', { defaultValue: 'Préc.' })}
          </Button>

          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) { page = i + 1; }
              else if (currentPage <= 3) { page = i + 1; }
              else if (currentPage >= totalPages - 2) { page = totalPages - 4 + i; }
              else { page = currentPage - 2 + i; }
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'ghost'}
                  size="sm"
                  className={cn("size-7 p-0 text-xs", currentPage === page ? 'bg-emerald-600 hover:bg-emerald-700' : 'text-slate-500')}
                  onClick={() => state.setCurrentPage(page)}
                >{page}</Button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={currentPage >= totalPages}
            onClick={() => state.setCurrentPage((p: number) => p + 1)}
          >
             {t('common:pagination.next', { defaultValue: 'Suiv.' })}
          </Button>
        </div>
      )}
    </div>
  );
}
