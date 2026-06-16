import React from 'react';
import { Eye, EyeOff, Building2, MapPin, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { useFournisseurs } from '../../hooks/useFournisseurs';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { cn } from '../../lib/utils';

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
      <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
            <div className="size-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Building2 className="size-10 text-slate-400" />
            </div>
            <p className="font-semibold text-slate-600">{t('providers:details.no_provider_selected')}</p>
            <p className="text-sm text-slate-400 mt-1 max-w-[200px]">{t('providers:details.select_instruction')}</p>
        </div>
      </div>
    );
  }

  const solde = Number(selectedFournisseur.solde_dette || 0);

  return (
    <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-white shrink-0 flex justify-between items-start">
         <div className="flex items-center gap-4">
            <div className="size-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-xl font-bold shrink-0">
              {selectedFournisseur.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 leading-tight">{selectedFournisseur.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t('providers:table.provider')}</p>
            </div>
         </div>
         <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="size-9 text-slate-500" onClick={actions.openEditModal} title={t('providers:details.edit')}>
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-9 text-slate-500 hover:text-red-600 hover:bg-red-50" onClick={actions.handleDeleteFournisseur} title={t('providers:details.delete')}>
              <Trash2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("size-9", selectedFournisseur.is_active === false ? 'text-amber-600 bg-amber-50' : 'text-slate-500')}
              onClick={actions.handleToggleActive}
              title={selectedFournisseur.is_active === false ? t('providers:details.reactivate') : t('providers:details.hide')}
            >
              {selectedFournisseur.is_active === false ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </Button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Contact Info */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <MapPin className="size-4 text-emerald-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('providers:details.contact_address')}</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t('providers:details.contact_address')}</span>
                <div className="text-sm text-slate-700 leading-relaxed">
                  {selectedFournisseur.address || t('providers:details.not_provided')}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t('providers:details.direct_line')}</span>
                  <div className="text-sm font-mono font-medium text-slate-700">{selectedFournisseur.phone || '—'}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t('providers:details.email')}</span>
                  <div className="text-sm text-slate-700 break-all">{selectedFournisseur.email || '—'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Finance Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">💰</span>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('providers:details.financial_situation')}</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={(e) => {
                  e.stopPropagation();
                  state.setFinanceModalState({ isOpen: true });
                }}
              >
                {t('providers:details.manage_payments')}
              </Button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
               <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{t('providers:details.debt_balance')}</div>
                  <div className={cn("text-lg font-bold font-mono", solde > 0 ? 'text-red-600' : 'text-emerald-600')}>
                     {formatCurrency(solde)}
                  </div>
               </div>
               <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 text-xs text-center">
                  {t('providers:details.history_available')}
               </div>
            </div>
          </div>

          <div className="bg-slate-100 rounded-lg p-3 flex items-center justify-between border border-slate-200">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{t('providers:details.internal_ref')}</span>
            <Badge variant="secondary" className="text-xs font-mono">#{selectedFournisseur.id}</Badge>
          </div>

          {/* Catalogue Fournisseur */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div
              className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => state.setShowCatalogue(!showCatalogue)}
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-md">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{t('providers:details.product_catalogue')}</h3>
                  <p className="text-[11px] text-slate-500">
                    {catalogueLoading ? t('providers:details.loading') : t('providers:details.products_ordered_plural', { count: catalogue.length })}
                  </p>
                </div>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", showCatalogue ? 'rotate-180' : '')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {showCatalogue && (
              <div className="px-5 pb-5 border-t border-slate-200">
                {catalogue.length > 0 && (
                  <div className="relative my-3">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder={t('providers:catalogue.search_placeholder')}
                      className="w-full pl-9 h-9 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
                      value={catalogueSearch}
                      onChange={(e) => state.setCatalogueSearch(e.target.value)}
                    />
                  </div>
                )}

                {catalogueLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full size-6 border-b-2 border-emerald-600"></div>
                  </div>
                ) : filteredCatalogue.length === 0 ? (
                  <div className="text-center py-6 text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-sm">
                      {catalogueSearch ? t('providers:catalogue.no_result') : t('providers:catalogue.empty')}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">{t('providers:catalogue.headers.cip')}</th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">{t('providers:catalogue.headers.product')}</th>
                          <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase">{t('providers:catalogue.headers.last_price')}</th>
                          <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase">{t('providers:catalogue.headers.last_order')}</th>
                          <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase">{t('providers:catalogue.headers.margin')}</th>
                          <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase">{t('providers:catalogue.headers.total_qty')}</th>
                          <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase">{t('providers:catalogue.headers.stock')}</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {filteredCatalogue.map((item) => (
                          <tr key={item.produit_id} className="hover:bg-base-200 transition-colors">
                            <td className="px-3 py-2">
                              <span className="font-mono text-[10px] bg-base-200 px-1.5 py-0.5 rounded text-base-content/70">
                                {item.cip}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-xs text-base-content line-clamp-1" title={item.produit_nom}>
                                {item.produit_nom}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className="text-xs font-medium text-base-content">
                                {formatCurrency(item.dernier_prix_achat)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="text-[10px] text-base-content/50">
                                {item.derniere_commande
                                  ? new Date(item.derniere_commande).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
                                  : '-'
                                }
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className={`text-xs font-medium ${item.marge >= 0 ? 'text-success' : 'text-error'}`}>
                                {formatCurrency(item.marge)}
                              </span>
                              <span className="text-[10px] text-base-content/50 ml-1">
                                ({item.marge_pourcent}%)
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="text-xs font-medium text-base-content/70 bg-base-200 px-2 py-0.5 rounded-full">
                                {item.qte_totale}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                item.stock_actuel <= 0
                                  ? 'bg-error/10 text-error'
                                  : item.stock_actuel < 10
                                    ? 'bg-warning/10 text-warning'
                                    : 'bg-success/10 text-success'
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
