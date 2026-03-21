import React from 'react';
import { Truck, Search, MoreVertical, X, Calendar, CheckSquare, Trash2, UserPlus, Eye, EyeOff } from 'lucide-react';
import type { useFournisseurs } from '../../hooks/useFournisseurs';

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

  return (
    <div className="md:col-span-1 bg-base-100 rounded-lg shadow flex flex-col overflow-hidden h-full">
      {/* Header with Search and Actions */}
      <div className="p-0 border-b border-base-200 bg-base-100 relative z-20 shrink-0 sticky top-0 overflow-visible">
        <div className="p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center h-10">
            {selectedIds.length > 0 ? (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="dropdown dropdown-bottom">
                  <div tabIndex={0} role="button" className="btn btn-sm btn-primary gap-2 h-9">
                    <MoreVertical className="w-4 h-4" />
                    {t('common:actions_title', { defaultValue: 'Actions' })}
                    <span className="badge badge-sm bg-primary-focus border-none text-white">{selectedIds.length}</span>
                  </div>
                  <ul tabIndex={0} className="dropdown-content z-[100] menu p-2 shadow-2xl bg-base-100 rounded-box w-56 border border-base-200 mt-2">
                    <li className="menu-title px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-base-content/40">
                      {t('common:bulk_actions', { defaultValue: 'Actions Groupées' })}
                    </li>
                    <li>
                      <a onClick={actions.handleBulkDelete} className="flex items-center gap-3 py-3 hover:bg-error/10 text-error font-medium">
                        <Trash2 className="w-4 h-4" /> {t('common:actions.delete', { defaultValue: 'Supprimer' })}
                      </a>
                    </li>
                  </ul>
                </div>
                <button 
                  onClick={() => state.setSelectedIds([])}
                  className="btn btn-sm btn-ghost gap-2 text-base-content/60 hover:text-base-content h-9"
                >
                  <X className="w-4 h-4" />
                  {t('common:actions.cancel', { defaultValue: 'Annuler' })}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 animate-in fade-in duration-300">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <Truck className="w-5 h-5" />
                  </div>
                  <h2 className="font-bold text-lg tracking-tight">{t('providers:title')}</h2>
                  <span className="bg-base-200 text-base-content/60 px-2.5 py-0.5 rounded-full text-[10px] font-black">{fournisseurs.length}</span>
                </div>
                <div className="flex gap-1 items-center">
                  <button 
                    className={`btn btn-sm btn-ghost btn-square ${showInactive ? 'bg-base-200 text-base-content' : 'text-base-content/40'}`} 
                    onClick={() => state.setShowInactive(!showInactive)}
                    title={showInactive ? t('providers:hide_inactive') : t('providers:show_inactive')}
                  >
                    {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button className="btn btn-sm btn-ghost btn-square text-secondary/60 hover:text-secondary hover:bg-secondary/10" onClick={() => state.setIsEcheancierModalOpen(true)} title={t('providers:schedule_btn')}>
                    <Calendar className="w-4 h-4" />
                  </button>
                  <button className="btn btn-sm btn-ghost btn-square text-neutral/60 hover:text-neutral hover:bg-neutral/10" onClick={() => state.setIsPointageModalOpen(true)} title={t('providers:pointage_btn')}>
                    <CheckSquare className="w-4 h-4" />
                  </button>
                  <button className="btn btn-sm btn-primary gap-2 h-9 px-4 shadow-sm" onClick={actions.openAddModal}>
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden xl:inline">{t('providers:new_provider')}</span>
                  </button>
                </div>
              </>
            )}
          </div>
          
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 group-focus-within:text-primary transition-colors">
              <Search className="w-4 h-4" />
            </span>
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder={t('providers:search_placeholder')}
              className="input input-sm input-bordered w-full pl-10 h-10 bg-base-200/50 border-transparent focus:border-primary focus:bg-base-100 transition-all rounded-xl shadow-none" 
              value={searchTerm}
              onChange={(e) => {
                state.setSearchTerm(e.target.value);
                state.setHighlightedIndex(-1);
              }}
              onKeyDown={actions.handleKeyDown}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="table table-xs table-pin-rows w-full">
          <thead className="bg-[#f8fafc] text-[#64748b]">
            <tr>
              <th className="py-2 px-2 w-10">
                <input 
                  type="checkbox" 
                  className="checkbox checkbox-xs"
                  checked={selectedIds.length === fournisseurs.length && fournisseurs.length > 0}
                  onChange={actions.toggleSelectAll}
                />
              </th>
              <th className="py-2 px-2 font-semibold uppercase text-xs tracking-wider text-left">{t('providers:table.provider')}</th>
              <th className="py-2 px-2 font-semibold uppercase text-xs tracking-wider text-center">{t('providers:table.phone')}</th>
            </tr>
          </thead>
          <tbody>
            {fournisseurs.length > 0 ? (
              fournisseurs.map((fournisseur, index) => (
                <tr 
                  key={fournisseur.id} 
                  className={`hover cursor-pointer transition-all border-b border-slate-50 ${
                    selectedFournisseur?.id === fournisseur.id ? 'bg-blue-50/50 text-primary' : 'text-base-content/80'
                  } ${
                    searchTerm && highlightedIndex === index ? 'bg-base-200' : ''
                  }`}
                  onClick={() => actions.selectFournisseur(fournisseur)}
                >
                  <td className="py-1.5 px-2">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs"
                      checked={selectedIds.includes(fournisseur.id!)}
                      onChange={() => actions.toggleSelect(fournisseur.id!)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <div className="font-semibold text-sm truncate max-w-[140px]" title={fournisseur.name}>{fournisseur.name}</div>
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <span className="font-mono text-xs text-base-content/60">{fournisseur.phone || '-'}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="text-center py-6 opacity-50">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xl">📭</span>
                    <span className="text-xs">{searchTerm ? t('providers:no_result') : t('providers:empty_list')}</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-2 border-t border-base-200 bg-base-100 flex items-center justify-between text-xs shrink-0">
          <span className="text-base-content/40">
            {totalCount} {t('common:items', { defaultValue: 'fournisseur' })}{totalCount > 1 ? 's' : ''}
          </span>
          <div className="join">
            <button
              className="join-item btn btn-xs"
              disabled={currentPage <= 1}
              onClick={() => state.setCurrentPage((p: number) => p - 1)}
            >«</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) { page = i + 1; }
              else if (currentPage <= 3) { page = i + 1; }
              else if (currentPage >= totalPages - 2) { page = totalPages - 4 + i; }
              else { page = currentPage - 2 + i; }
              return (
                <button
                  key={page}
                  className={`join-item btn btn-xs ${currentPage === page ? 'btn-active btn-primary' : ''}`}
                  onClick={() => state.setCurrentPage(page)}
                >{page}</button>
              );
            })}
            <button
              className="join-item btn btn-xs"
              disabled={currentPage >= totalPages}
              onClick={() => state.setCurrentPage((p: number) => p + 1)}
            >»</button>
          </div>
        </div>
      )}
    </div>
  );
}
