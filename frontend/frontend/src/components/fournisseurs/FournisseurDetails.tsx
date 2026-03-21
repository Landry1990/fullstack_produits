import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import type { useFournisseurs } from '../../hooks/useFournisseurs';

interface Props {
  hook: ReturnType<typeof useFournisseurs>;
}

export default function FournisseurDetails({ hook }: Props) {
  const { state, actions, derived } = hook;
  const {
    t,
    selectedFournisseur,
    showCatalogue,
    catalogueLoading,
    catalogueSearch,
    catalogue
  } = state;
  const { filteredCatalogue } = derived;

  if (!selectedFournisseur) {
    return (
      <div className="md:col-span-2 bg-base-100 rounded-lg shadow flex flex-col h-full overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center text-base-content/30 p-10 text-center animate-pulse">
            <div className="w-24 h-24 rounded-full bg-base-200/50 flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2-2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="font-bold text-base-content/40">{t('providers:details.no_provider_selected')}</p>
            <p className="text-sm text-base-content/30 mt-1 max-w-[200px]">{t('providers:details.select_instruction')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="md:col-span-2 bg-base-100 rounded-lg shadow flex flex-col h-full overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="p-6 border-b bg-gradient-to-r from-slate-50 to-white shrink-0 flex justify-between items-start sticky-header">
         <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">{t('providers:table.provider')}</span>
            </div>
            <h2 className="text-2xl font-black text-base-content leading-tight">{selectedFournisseur.name}</h2>
         </div>
         <div className="flex gap-2">
            <button className="btn btn-sm btn-circle btn-ghost text-base-content/40 hover:text-primary transition-colors" onClick={actions.openEditModal} title={t('providers:details.edit')}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button className="btn btn-sm btn-circle btn-ghost text-base-content/40 hover:text-error transition-colors" onClick={actions.handleDeleteFournisseur} title={t('providers:details.delete')}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button 
              className={`btn btn-sm btn-circle btn-ghost transition-colors ${selectedFournisseur.is_active === false ? 'text-warning' : 'text-base-content/40 hover:text-warning'}`}
              onClick={actions.handleToggleActive}
              title={selectedFournisseur.is_active === false ? t('providers:details.reactivate') : t('providers:details.hide')}
            >
              {selectedFournisseur.is_active === false ? '👁️' : '🙈'}
            </button>
         </div>
      </div>
      
      <div className="p-8 space-y-8 overflow-y-auto flex-1">
          <div className="space-y-6">
              <div className="flex gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-base-200 flex items-center justify-center text-base-content/40 shrink-0 group-hover:bg-blue-50 group-hover:text-primary transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                      <div className="text-[11px] font-bold text-base-content/40 uppercase tracking-widest mb-1.5">{t('providers:details.contact_address')}</div>
                      <div className="text-base-content/90 font-medium whitespace-pre-wrap leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100 hover:border-base-200 transition-colors">
                        {selectedFournisseur.address || t('providers:details.not_provided')}
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="flex gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-base-200 flex items-center justify-center text-base-content/40 shrink-0 group-hover:bg-blue-50 group-hover:text-primary transition-all duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                        <div className="text-[11px] font-bold text-base-content/40 uppercase tracking-widest mb-1.5">{t('providers:details.direct_line')}</div>
                        <div className="text-lg font-black text-base-content/90 font-mono tracking-tight">{selectedFournisseur.phone || '-'}</div>
                    </div>
                </div>

                <div className="flex gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-base-200 flex items-center justify-center text-base-content/40 shrink-0 group-hover:bg-blue-50 group-hover:text-primary transition-all duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                        <div className="text-[11px] font-bold text-base-content/40 uppercase tracking-widest mb-1.5">{t('providers:details.email')}</div>
                        <div className="text-base-content/80 font-semibold break-all selection:bg-blue-100 underline decoration-blue-200 decoration-2 underline-offset-4">{selectedFournisseur.email || '-'}</div>
                    </div>
                </div>
              </div>
          </div>
          
          {/* Finance Section */}
          <div className="pt-6 mt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base-content flex items-center gap-2">
                 <span className="w-8 h-8 rounded-lg bg-emerald-100/50 text-emerald-600 flex items-center justify-center text-sm">💰</span>
                 {t('providers:details.financial_situation')}
              </h3>
              <button 
                className="btn btn-ghost btn-sm text-primary hover:bg-primary/10 rounded-lg px-3 flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  state.setFinanceModalState({ isOpen: true });
                }}
              >
                {t('providers:details.manage_payments')}
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="p-4 rounded-xl bg-base-200/50 border border-slate-100">
                  <div className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mb-1">{t('providers:details.debt_balance')}</div>
                  <div className={`text-2xl font-black font-mono ${Number(selectedFournisseur.solde_dette) > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                     {formatCurrency(Number(selectedFournisseur.solde_dette || 0))}
                  </div>
               </div>
               <div className="p-4 rounded-xl bg-base-200/50 border border-slate-100 flex items-center justify-center text-base-content/40 text-xs italic text-center">
                  {t('providers:details.history_available')}
               </div>
            </div>
          </div>

          <div className="pt-8 mt-4 border-t border-slate-100">
            <div className="bg-base-200/50 rounded-2xl p-4 flex items-center justify-between">
              <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">{t('providers:details.internal_ref')}</span>
              <span className="text-[11px] font-mono text-base-content/60 bg-base-100 px-2 py-1 rounded-lg border border-base-200">#{selectedFournisseur.id}</span>
            </div>
          </div>

          {/* Catalogue Fournisseur */}
          <div className="pt-6 mt-4 border-t border-slate-100">
            <div 
              className="flex items-center justify-between cursor-pointer group"
              onClick={() => state.setShowCatalogue(!showCatalogue)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-base-content">{t('providers:details.product_catalogue')}</h3>
                  <p className="text-[11px] text-base-content/40">
                    {catalogueLoading ? t('providers:details.loading') : t('providers:details.products_ordered_plural', { count: catalogue.length })}
                  </p>
                </div>
              </div>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-5 w-5 text-base-content/40 transition-transform duration-200 ${showCatalogue ? 'rotate-180' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {showCatalogue && (
              <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Barre de recherche du catalogue */}
                {catalogue.length > 0 && (
                  <div className="relative mb-3">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input 
                      type="text" 
                      placeholder={t('providers:catalogue.search_placeholder')}
                      className="input input-sm input-bordered w-full pl-9 bg-base-100 text-xs h-8" 
                      value={catalogueSearch}
                      onChange={(e) => state.setCatalogueSearch(e.target.value)}
                    />
                  </div>
                )}

                {catalogueLoading ? (
                  <div className="flex justify-center py-8">
                    <span className="loading loading-spinner loading-md text-primary"></span>
                  </div>
                ) : filteredCatalogue.length === 0 ? (
                  <div className="text-center py-6 text-base-content/40">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-xs font-medium">
                      {catalogueSearch ? t('providers:catalogue.no_result') : t('providers:catalogue.empty')}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-base-200">
                    <table className="table table-xs w-full">
                      <thead className="bg-base-200/50">
                        <tr>
                          <th className="text-[10px] font-bold text-base-content/60 uppercase">{t('providers:catalogue.headers.cip')}</th>
                          <th className="text-[10px] font-bold text-base-content/60 uppercase">{t('providers:catalogue.headers.product')}</th>
                          <th className="text-[10px] font-bold text-base-content/60 uppercase text-right">{t('providers:catalogue.headers.last_price')}</th>
                          <th className="text-[10px] font-bold text-base-content/60 uppercase text-center">{t('providers:catalogue.headers.last_order')}</th>
                          <th className="text-[10px] font-bold text-base-content/60 uppercase text-right">{t('providers:catalogue.headers.margin')}</th>
                          <th className="text-[10px] font-bold text-base-content/60 uppercase text-center">{t('providers:catalogue.headers.total_qty')}</th>
                          <th className="text-[10px] font-bold text-base-content/60 uppercase text-center">{t('providers:catalogue.headers.stock')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCatalogue.map((item) => (
                          <tr key={item.produit_id} className="hover:bg-slate-50/50 border-b border-slate-100 last:border-0">
                            <td className="py-2">
                              <span className="font-mono text-[10px] bg-base-200 px-1.5 py-0.5 rounded text-base-content/80">
                                {item.cip}
                              </span>
                            </td>
                            <td className="py-2">
                              <span className="text-xs font-medium text-base-content/90 line-clamp-1" title={item.produit_nom}>
                                {item.produit_nom}
                              </span>
                            </td>
                            <td className="py-2 text-right">
                              <span className="text-xs font-semibold text-base-content/90">
                                {formatCurrency(item.dernier_prix_achat)}
                              </span>
                            </td>
                            <td className="py-2 text-center">
                              <span className="text-[10px] text-base-content/60">
                                {item.derniere_commande 
                                  ? new Date(item.derniere_commande).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
                                  : '-'
                                }
                              </span>
                            </td>
                            <td className="py-2 text-right">
                              <span className={`text-xs font-semibold ${item.marge >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {formatCurrency(item.marge)}
                              </span>
                              <span className="text-[9px] text-base-content/40 ml-1">
                                ({item.marge_pourcent}%)
                              </span>
                            </td>
                            <td className="py-2 text-center">
                              <span className="text-xs font-bold text-base-content/80 bg-base-200 px-2 py-0.5 rounded-full">
                                {item.qte_totale}
                              </span>
                            </td>
                            <td className="py-2 text-center">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                item.stock_actuel <= 0 
                                  ? 'bg-red-100 text-red-600' 
                                  : item.stock_actuel < 10 
                                    ? 'bg-amber-100 text-amber-600' 
                                    : 'bg-emerald-100 text-emerald-600'
                              }`}>
                                {item.stock_actuel}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
