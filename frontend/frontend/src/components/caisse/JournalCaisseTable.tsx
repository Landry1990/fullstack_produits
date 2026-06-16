import React from 'react';
import { Loader2 } from 'lucide-react';
import type { useJournalCaisse } from '../../hooks/useJournalCaisse';
import type { CaisseTransaction, MouvementCaisse } from '../../types';
import { normalizeNumberInput } from '../../utils/formatters';
import { Button } from '../shadcn/button';
import { cn } from '../../lib/utils';

interface Props {
  state: ReturnType<typeof useJournalCaisse>;
}

export default function JournalCaisseTable({ state }: Props) {
  const {
    t, currentLocale, loading, error, filteredItems, groupedItems,
    expandedReleves, toggleReleve, formatCurrencyLocal,
    page, totalPages, totalCount, setPage
  } = state;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(currentLocale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'especes': return '💵';
      case 'cheque': return '📝';
      case 'carte': return '💳';
      case 'virement': return '🏦';
      case 'om': return '🟧';
      case 'momo': return '📱';
      case 'en_compte': return '📒';
      case 'depot': return '🏦';
      default: return '💰';
    }
  };

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden mx-4 md:mx-6 mb-6">
      {error && (
        <div className="p-3 bg-red-50 border-b border-red-100 flex items-center gap-2 text-red-600 text-sm font-medium">
          <span className="text-lg">⚠️</span>
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white gap-4">
            <Loader2 className="size-8 text-emerald-600 animate-spin" />
            <p className="text-slate-500 font-medium animate-pulse">{t('table.loading')}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3 text-center">
            <div className="size-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl mb-2 text-slate-400 shadow-inner">📂</div>
            <p className="text-lg font-bold italic text-slate-600">{t('table.no_transaction')}</p>
            <p className="text-xs opacity-60 max-w-xs">{t('table.no_transaction_desc') || "Aucune opération ne correspond à vos filtres actuels."}</p>
          </div>
        ) : (
          <>
            {/* Vue Mobile */}
            <div className="md:hidden divide-y divide-slate-200 overflow-y-auto max-h-[60vh]">
              {groupedItems.map((item: any) => {
                const isMouvement = item._kind === 'mouvement';
                const transaction = item as CaisseTransaction & { isReleveGroup?: boolean, items?: CaisseTransaction[] };
                const info = isMouvement ? {
                  title: item.motif,
                  subtitle: item.user_nom,
                  amount: normalizeNumberInput(item.montant),
                  type: item.type === 'ENTREE' ? 'success' : 'error',
                  badge: item.type === 'ENTREE' ? 'ENTRÉE' : 'SORTIE',
                  date: formatDate(item.date)
                } : {
                  title: transaction.client_name,
                  subtitle: transaction.user_details?.full_name,
                  amount: normalizeNumberInput(transaction.montant),
                  type: transaction.statut === 'completee' ? 'primary' : 'warning',
                  badge: transaction.mode_paiement_display,
                  date: formatDate(transaction.date_paiement)
                };

                return (
                  <div key={item.id} className="p-4 active:bg-slate-100 transition-colors flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{info.date}</span>
                        <span className="font-bold text-sm text-slate-700 leading-tight mt-0.5">{info.title}</span>
                        <span className="text-[11px] text-slate-500 font-medium">👤 {info.subtitle}</span>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className={cn("font-black text-base", isMouvement ? (item.type === 'ENTREE' ? 'text-emerald-600' : 'text-red-600') : 'text-slate-700')}>
                          {isMouvement && (item.type === 'ENTREE' ? '+' : '-')}
                          {formatCurrencyLocal(info.amount)}
                        </span>
                        <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold mt-1", isMouvement ? (item.type === 'ENTREE' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white') : 'bg-slate-100 text-slate-700')}>
                          {info.badge}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vue Desktop */}
            <table className="hidden md:table table-sm w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-30 bg-slate-100 opacity-100">
                <tr className="border-b border-slate-200">
                  <th className="border-b-2 border-slate-200 text-xs font-bold text-slate-500 py-3 pl-6">{t('table.date_time')}</th>
                  <th className="border-b-2 border-slate-200 text-xs font-bold text-slate-500 py-3">{t('table.cashier')}</th>
                  <th className="border-b-2 border-slate-200 text-xs font-bold text-slate-500 py-3">{t('table.entered_by')}</th>
                  <th className="border-b-2 border-slate-200 text-xs font-bold text-slate-500 py-3">{t('table.client_label')}</th>
                  <th className="border-b-2 border-slate-200 text-xs font-bold text-slate-500 py-3 min-w-[140px] uppercase tracking-wider">{t('table.piece_num')}</th>
                  <th className="border-b-2 border-slate-200 text-xs font-bold text-slate-500 py-3 text-right">{t('table.amount')}</th>
                  <th className="border-b-2 border-slate-200 text-xs font-bold text-slate-500 py-3">{t('table.mode')}</th>
                  <th className="border-b-2 border-slate-200 text-xs font-bold text-slate-500 py-3 pr-6 text-right">{t('table.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {groupedItems.map((item: any) => {
                  if (item._kind === 'mouvement') {
                    const mouv = item as MouvementCaisse;
                    return (
                      <tr key={`mouv-${mouv.id}`} className={cn("hover:bg-slate-50/50 transition-colors", mouv.type === 'ENTREE' ? 'bg-emerald-50/50' : 'bg-red-50/50')}>
                        <td className="font-mono text-xs whitespace-nowrap pl-6 py-4">{formatDate(mouv.date)}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200">
                              {(mouv.user_nom || 'U')[0]}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-slate-700">{mouv.user_nom || t('table.user')}</span>
                              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{t('table.operation')}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          <span className="text-xs text-slate-300 italic">-</span>
                        </td>
                        <td className="py-4">
                          <div className="font-bold text-sm text-slate-700">{mouv.motif}</div>
                          <div className="text-xs text-slate-500 italic max-w-xs truncate" title={mouv.description}>{mouv.description || t('table.no_description')}</div>
                        </td>
                        <td className="font-mono text-[10px] py-4 text-slate-500">MOUV-{mouv.id}</td>
                        <td className={cn("text-right font-black text-base py-4", mouv.type === 'ENTREE' ? 'text-emerald-600' : 'text-red-600')}>
                          {mouv.type === 'ENTREE' ? '+' : '-'}{formatCurrencyLocal(normalizeNumberInput(mouv.montant))}
                        </td>
                        <td className="py-4">
                          <span className={cn("inline-flex items-center rounded-md font-bold text-[10px] gap-1 py-1 px-2", mouv.type === 'ENTREE' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white')}>
                            {mouv.type === 'ENTREE' ? t('filter_caps.entry') || 'ENTRÉE' : t('filter_caps.exit') || 'SORTIE'}
                          </span>
                        </td>
                        <td className="py-4 pr-6 text-right">
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-1 rounded-md uppercase">
                            {t('table.validated')}
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  const transaction = item as CaisseTransaction & { isReleveGroup?: boolean, items?: CaisseTransaction[] };
                  const isExpanded = transaction.isReleveGroup && transaction.releve_id && expandedReleves.has(transaction.releve_id);

                  return (
                    <React.Fragment key={transaction.id}>
                      <tr
                        className={cn("hover:bg-slate-50/50 transition-colors group", transaction.isReleveGroup ? 'bg-emerald-50/50 cursor-pointer border-l-2 border-l-emerald-500 ring-1 ring-inset ring-emerald-500/10' : '')}
                        onClick={() => transaction.isReleveGroup && transaction.releve_id && toggleReleve(transaction.releve_id)}
                      >
                        <td className="font-mono text-xs whitespace-nowrap pl-6 py-4">
                          <div className="flex flex-col">
                            <span>{formatDate(transaction.date_paiement)}</span>
                            {transaction.isReleveGroup && (
                              <span className="text-[9px] font-black text-emerald-600 uppercase mt-1 flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-full border border-emerald-500/20 w-fit">
                                {isExpanded ? '▼' : '▶'} {t('table.grouped_releve')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-600 border border-emerald-500/20">
                              {(transaction.user_details?.full_name || 'U')[0]}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm">
                                {transaction.user_details?.full_name || t('common:unknown') || 'Inconnu'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono tracking-tight">
                                @{transaction.user_details?.username || 'user'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          {transaction.facture_created_by_name ? (
                            <div className="flex items-center gap-2">
                              <div className="size-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                {transaction.facture_created_by_name[0]}
                              </div>
                              <span className="text-sm border-b border-dashed border-slate-200" title="Utilisateur ayant saisi la facture">
                                {transaction.facture_created_by_name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300 italic">-</span>
                          )}
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-700">{transaction.client_name}</span>
                            {transaction.is_creance_settlement && (
                              <span className="inline-flex items-center rounded-md bg-sky-500 text-white font-bold text-[9px] px-1.5 py-0.5">{t('common:creance') || 'CRÉANCE'}</span>
                            )}
                          </div>
                          {transaction.isReleveGroup && (
                            <div className="text-[10px] text-emerald-600 font-bold mt-1">Réf: {transaction.releve_reference}</div>
                          )}
                        </td>
                        <td className="font-mono text-xs py-4">
                          {transaction.isReleveGroup ? (
                            <span className="text-emerald-600/70 font-bold italic">{transaction.items?.length} {t('common:pieces') || 'pièces'}</span>
                          ) : (
                            <span className="bg-slate-100 px-2 py-1 rounded font-bold text-slate-600 whitespace-nowrap">{transaction.facture_numero || '-'}</span>
                          )}
                        </td>
                        <td className="text-right font-black text-base py-4 text-slate-700">
                          {formatCurrencyLocal(normalizeNumberInput(transaction.montant))}
                        </td>
                        <td className="py-4">
                          {(() => {
                            const mode = transaction.mode_paiement as any;
                            const isRecouvrement = mode === 'recouvrement' ||
                              transaction.is_creance_settlement ||
                              (transaction.reference && transaction.reference.includes('[RECOUV]'));
                            return (
                              <div className="flex flex-col">
                                <span className={cn("inline-flex items-center rounded-md font-bold text-[10px] gap-1.5 py-1 px-2", isRecouvrement ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700')}>
                                  {isRecouvrement ? '💸' : getModeIcon(transaction.mode_paiement)} {isRecouvrement ? t('common:payment_modes.recouvrement_caps') || 'RECOUVREMENT' : transaction.mode_paiement_display?.toUpperCase()}
                                </span>
                                {transaction.reference && (
                                  <span className="text-[10px] text-slate-500 mt-1 max-w-[120px] truncate" title={transaction.reference}>
                                    Réf: {transaction.reference}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-4 pr-6 text-right">
                          {transaction.statut === 'completee' ? (
                            <span className="inline-flex items-center text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-1 rounded-md uppercase">{t('table.paid')}</span>
                          ) : transaction.statut === 'annulee' ? (
                            <span className="inline-flex items-center text-red-600 font-bold text-[10px] bg-red-50 px-2 py-1 rounded-md uppercase">{t('table.cancelled')}</span>
                          ) : (
                            <span className="inline-flex items-center text-amber-600 font-bold text-[10px] bg-amber-50 px-2 py-1 rounded-md uppercase">{t('table.pending')}</span>
                          )}
                        </td>
                      </tr>

                      {isExpanded && transaction.items?.map(subItem => (
                        <tr key={subItem.id} className="bg-emerald-50/50 border-l-2 border-l-emerald-500/30">
                          <td className="pl-12 py-3 text-[11px] opacity-60 font-mono">↳ {formatDate(subItem.date_paiement).split(' ')[1]}</td>
                          <td className="py-3 opacity-40 text-[11px]">-</td>
                          <td className="py-3 opacity-40 text-[11px]">-</td>
                          <td className="font-mono text-[11px] py-3 font-bold text-emerald-600/70 whitespace-nowrap">{subItem.facture_numero}</td>
                          <td className="text-right text-[11px] py-3 pr-4 font-bold text-slate-700">
                            {formatCurrencyLocal(normalizeNumberInput(subItem.montant))}
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-[10px] opacity-60 italic">{subItem.reference || '-'}</span>
                          </td>
                          <td className="py-3 text-[10px] font-black text-emerald-600/40 pr-6 text-right">PIÈCE</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="p-6 border-t border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-sm text-slate-500 font-medium">
          {t('pagination.showing')} <span className="text-slate-700">{filteredItems.length}</span> {filteredItems.length > 1 ? t('pagination.lines_plural') : t('pagination.lines')} {t('pagination.of')} <span className="text-slate-700">{totalCount}</span> {t('pagination.total')}
        </div>

        {!loading && totalCount > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Page {page} / {totalPages}</span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="px-4"
                disabled={page === 1}
                onClick={() => setPage(prev => prev - 1)}
              >
                {t('common:pagination.prev')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="px-4"
                disabled={page >= totalPages}
                onClick={() => setPage(prev => prev + 1)}
              >
                {t('common:pagination.next')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
