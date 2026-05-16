import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
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
      <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-full overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center opacity-30">
            <div className="size-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2-2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="font-semibold text-gray-500">{t('providers:details.no_provider_selected')}</p>
            <p className="text-sm text-gray-400 mt-1 max-w-[200px]">{t('providers:details.select_instruction')}</p>
        </div>
      </div>
    );
  }

  const solde = Number(selectedFournisseur.solde_dette || 0);

  return (
    <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-white shrink-0 flex justify-between items-start">
         <div className="flex items-center gap-4">
            <div className="size-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl font-bold shrink-0">
              {selectedFournisseur.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">{selectedFournisseur.name}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{t('providers:table.provider')}</p>
            </div>
         </div>
         <div className="flex gap-1">
            <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors" onClick={actions.openEditModal} title={t('providers:details.edit')}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors" onClick={actions.handleDeleteFournisseur} title={t('providers:details.delete')}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              className={`p-2 rounded-lg transition-colors ${selectedFournisseur.is_active === false ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:bg-gray-100'}`}
              onClick={actions.handleToggleActive}
              title={selectedFournisseur.is_active === false ? t('providers:details.reactivate') : t('providers:details.hide')}
            >
              {selectedFournisseur.is_active === false ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Contact Info */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t('providers:details.contact_address')}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t('providers:details.contact_address')}</span>
                <div className="text-sm text-gray-700 leading-relaxed">
                  {selectedFournisseur.address || t('providers:details.not_provided')}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t('providers:details.direct_line')}</span>
                  <div className="text-sm font-mono font-medium text-gray-900">{selectedFournisseur.phone || '—'}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t('providers:details.email')}</span>
                  <div className="text-sm text-gray-700 break-all">{selectedFournisseur.email || '—'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Finance Section */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">💰</span>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t('providers:details.financial_situation')}</h3>
              </div>
              <button
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium px-3 py-1 rounded-md hover:bg-indigo-50 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  state.setFinanceModalState({ isOpen: true });
                }}
              >
                {t('providers:details.manage_payments')}
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
               <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{t('providers:details.debt_balance')}</div>
                  <div className={`text-lg font-bold font-mono ${solde > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                     {formatCurrency(solde)}
                  </div>
               </div>
               <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs text-center">
                  {t('providers:details.history_available')}
               </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between border border-gray-100">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('providers:details.internal_ref')}</span>
            <span className="text-xs font-mono text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">#{selectedFournisseur.id}</span>
          </div>

          {/* Catalogue Fournisseur */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div
              className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => state.setShowCatalogue(!showCatalogue)}
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{t('providers:details.product_catalogue')}</h3>
                  <p className="text-[11px] text-gray-400">
                    {catalogueLoading ? t('providers:details.loading') : t('providers:details.products_ordered_plural', { count: catalogue.length })}
                  </p>
                </div>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${showCatalogue ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {showCatalogue && (
              <div className="px-5 pb-5 border-t border-gray-100">
                {catalogue.length > 0 && (
                  <div className="relative my-3">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder={t('providers:catalogue.search_placeholder')}
                      className="input input-sm input-bordered w-full pl-9 bg-gray-50 text-sm h-9 rounded-lg border-gray-200"
                      value={catalogueSearch}
                      onChange={(e) => state.setCatalogueSearch(e.target.value)}
                    />
                  </div>
                )}

                {catalogueLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full size-6 border-b-2 border-indigo-600"></div>
                  </div>
                ) : filteredCatalogue.length === 0 ? (
                  <div className="text-center py-6 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-sm">
                      {catalogueSearch ? t('providers:catalogue.no_result') : t('providers:catalogue.empty')}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">{t('providers:catalogue.headers.cip')}</th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">{t('providers:catalogue.headers.product')}</th>
                          <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">{t('providers:catalogue.headers.last_price')}</th>
                          <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase">{t('providers:catalogue.headers.last_order')}</th>
                          <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">{t('providers:catalogue.headers.margin')}</th>
                          <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase">{t('providers:catalogue.headers.total_qty')}</th>
                          <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase">{t('providers:catalogue.headers.stock')}</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {filteredCatalogue.map((item) => (
                          <tr key={item.produit_id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2">
                              <span className="font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                {item.cip}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-xs text-gray-700 line-clamp-1" title={item.produit_nom}>
                                {item.produit_nom}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className="text-xs font-medium text-gray-700">
                                {formatCurrency(item.dernier_prix_achat)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="text-[10px] text-gray-400">
                                {item.derniere_commande
                                  ? new Date(item.derniere_commande).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
                                  : '-'
                                }
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className={`text-xs font-medium ${item.marge >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCurrency(item.marge)}
                              </span>
                              <span className="text-[10px] text-gray-400 ml-1">
                                ({item.marge_pourcent}%)
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                                {item.qte_totale}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                item.stock_actuel <= 0
                                  ? 'bg-red-50 text-red-600'
                                  : item.stock_actuel < 10
                                    ? 'bg-amber-50 text-amber-600'
                                    : 'bg-emerald-50 text-emerald-600'
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
