import React from 'react';
import type { useJournalCaisse } from '../../hooks/useJournalCaisse';
import type { CaisseTransaction, MouvementCaisse } from '../../types';
import { normalizeNumberInput } from '../../utils/formatters';

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
    <div className="flex-1 bg-base-100 rounded-2xl border border-base-200 shadow-sm flex flex-col overflow-hidden mx-4 md:mx-6 mb-6">
      {error && (
        <div className="p-3 bg-error/10 border-b border-error/20 flex items-center gap-2 text-error text-sm font-medium">
          <span className="text-lg">⚠️</span>
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 bg-base-100 gap-4">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="text-base-content/60 font-medium animate-pulse">{t('table.loading')}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-base-content/30 gap-3 text-center">
            <div className="w-20 h-20 bg-base-200 rounded-full flex items-center justify-center text-4xl mb-2 opacity-50 shadow-inner">📂</div>
            <p className="text-lg font-bold italic">{t('table.no_transaction')}</p>
            <p className="text-xs opacity-60 max-w-xs">{t('table.no_transaction_desc') || "Aucune opération ne correspond à vos filtres actuels."}</p>
          </div>
        ) : (
          <>
            {/* Vue Mobile */}
            <div className="md:hidden divide-y divide-base-200 overflow-y-auto max-h-[60vh]">
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
                  <div key={item.id} className="p-4 active:bg-base-200 transition-colors flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-base-content/40 uppercase tracking-tighter">{info.date}</span>
                        <span className="font-bold text-sm text-base-content leading-tight mt-0.5">{info.title}</span>
                        <span className="text-[11px] text-base-content/60 font-medium">👤 {info.subtitle}</span>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className={`font-black text-base ${isMouvement ? (item.type === 'ENTREE' ? 'text-success' : 'text-error') : 'text-base-content'}`}>
                          {isMouvement && (item.type === 'ENTREE' ? '+' : '-')}
                          {formatCurrencyLocal(info.amount)}
                        </span>
                        <span className={`badge badge-xs font-bold border-none py-2 px-2 mt-1 ${isMouvement ? (item.type === 'ENTREE' ? 'bg-success text-white' : 'bg-error text-white') : 'bg-base-200'}`}>
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
              <thead className="sticky top-0 z-30 bg-base-200 opacity-100">
                <tr className="border-b border-base-300">
                  <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3 pl-6">{t('table.date_time')}</th>
                  <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3">{t('table.cashier')}</th>
                  <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3">{t('table.entered_by')}</th>
                  <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3">{t('table.client_label')}</th>
                  <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3 min-w-[140px] uppercase tracking-wider">{t('table.piece_num')}</th>
                  <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3 text-right">{t('table.amount')}</th>
                  <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3">{t('table.mode')}</th>
                  <th className="border-b-2 border-base-200 text-xs font-bold text-base-content/50 py-3 pr-6 text-right">{t('table.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-100 bg-base-100">
                {groupedItems.map((item: any) => {
                  if (item._kind === 'mouvement') {
                    const mouv = item as MouvementCaisse;
                    return (
                      <tr key={`mouv-${mouv.id}`} className={`hover:bg-base-50/50 transition-colors ${mouv.type === 'ENTREE' ? 'bg-success/5' : 'bg-error/5'}`}>
                        <td className="font-mono text-xs whitespace-nowrap pl-6 py-4">{formatDate(mouv.date)}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-base-200 flex items-center justify-center text-xs font-bold text-base-content/50 border border-base-300">
                              {(mouv.user_nom || 'U')[0]}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-base-content">{mouv.user_nom || t('table.user')}</span>
                              <span className="text-[10px] text-base-content/50 uppercase tracking-wider font-bold">{t('table.operation')}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          <span className="text-xs text-base-content/30 italic">-</span>
                        </td>
                        <td className="py-4">
                          <div className="font-bold text-sm text-base-content">{mouv.motif}</div>
                          <div className="text-xs text-base-content/50 italic max-w-xs truncate" title={mouv.description}>{mouv.description || t('table.no_description')}</div>
                        </td>
                        <td className="font-mono text-[10px] py-4 opacity-50">MOUV-{mouv.id}</td>
                        <td className={`text-right font-black text-base py-4 ${mouv.type === 'ENTREE' ? 'text-success' : 'text-error'}`}>
                          {mouv.type === 'ENTREE' ? '+' : '-'}{formatCurrencyLocal(normalizeNumberInput(mouv.montant))}
                        </td>
                        <td className="py-4">
                          <div className={`badge badge-sm font-bold gap-1 py-1 px-2 border-none ${mouv.type === 'ENTREE' ? 'bg-success text-white' : 'bg-error text-white'}`}>
                            {mouv.type === 'ENTREE' ? t('filter_caps.entry') || 'ENTRÉE' : t('filter_caps.exit') || 'SORTIE'}
                          </div>
                        </td>
                        <td className="py-4 pr-6 text-right">
                          <span className="inline-flex items-center gap-1 text-success font-bold text-[10px] bg-success/10 px-2 py-1 rounded-md uppercase">
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
                        className={`hover:bg-base-50/50 transition-colors group ${transaction.isReleveGroup ? 'bg-primary/5 cursor-pointer border-l-4 border-l-primary' : ''}`}
                        onClick={() => transaction.isReleveGroup && transaction.releve_id && toggleReleve(transaction.releve_id)}
                      >
                        <td className="font-mono text-xs whitespace-nowrap pl-6 py-4">
                          <div className="flex flex-col">
                            <span>{formatDate(transaction.date_paiement)}</span>
                            {transaction.isReleveGroup && (
                              <span className="text-[9px] font-black text-primary uppercase mt-1 flex items-center gap-1 bg-base-100 px-1.5 py-0.5 rounded-full border border-primary/20 w-fit">
                                {isExpanded ? '▼' : '▶'} {t('table.grouped_releve')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary border border-primary/20">
                              {(transaction.user_details?.full_name || 'U')[0]}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm">
                                {transaction.user_details?.full_name || t('common:unknown') || 'Inconnu'}
                              </span>
                              <span className="text-[10px] text-base-content/40 font-mono tracking-tight">
                                @{transaction.user_details?.username || 'user'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          {transaction.facture_created_by_name ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-base-200 flex items-center justify-center text-[10px] font-bold text-base-content/50">
                                {transaction.facture_created_by_name[0]}
                              </div>
                              <span className="text-sm border-b border-dashed border-base-content/20" title="Utilisateur ayant saisi la facture">
                                {transaction.facture_created_by_name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-base-content/30 italic">-</span>
                          )}
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-base-content">{transaction.client_name}</span>
                            {transaction.is_creance_settlement && (
                              <span className="badge badge-sm badge-info text-white font-bold text-[9px] px-1.5">{t('common:creance') || 'CRÉANCE'}</span>
                            )}
                          </div>
                          {transaction.isReleveGroup && (
                            <div className="text-[10px] text-primary font-bold mt-1">Réf: {transaction.releve_reference}</div>
                          )}
                        </td>
                        <td className="font-mono text-xs py-4">
                          {transaction.isReleveGroup ? (
                            <span className="text-primary/70 font-bold italic">{transaction.items?.length} {t('common:pieces') || 'pièces'}</span>
                          ) : (
                            <span className="bg-base-200 px-2 py-1 rounded font-bold text-base-content/60 whitespace-nowrap">{transaction.facture_numero || '-'}</span>
                          )}
                        </td>
                        <td className="text-right font-black text-base py-4 text-base-content">
                          {formatCurrencyLocal(normalizeNumberInput(transaction.montant))}
                        </td>
                        <td className="py-4">
                          {(() => {
                            const mode = transaction.mode_paiement as any;
                            const isRecouvrement = mode === 'recouvrement' ||
                              transaction.is_creance_settlement ||
                              transaction.client_type === 'PROFESSIONNEL' ||
                              (transaction.reference && transaction.reference.includes('[RECOUV]'));
                            return (
                              <div className="flex flex-col">
                                <div className={`badge border-none font-bold text-[10px] gap-1.5 py-3 ${isRecouvrement ? 'bg-primary text-white' : 'bg-base-200 text-base-content'}`}>
                                  {isRecouvrement ? '💸' : getModeIcon(transaction.mode_paiement)} {isRecouvrement ? t('common:payment_modes.recouvrement_caps') || 'RECOUVREMENT' : transaction.mode_paiement_display?.toUpperCase()}
                                </div>
                                {transaction.reference && (
                                  <span className="text-[10px] text-base-content/50 mt-1 max-w-[120px] truncate" title={transaction.reference}>
                                    Réf: {transaction.reference}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-4 pr-6 text-right">
                          {transaction.statut === 'completee' ? (
                            <span className="inline-flex items-center text-success font-bold text-[10px] bg-success/10 px-2 py-1 rounded-md uppercase">{t('table.paid')}</span>
                          ) : transaction.statut === 'annulee' ? (
                            <span className="inline-flex items-center text-error font-bold text-[10px] bg-error/10 px-2 py-1 rounded-md uppercase">{t('table.cancelled')}</span>
                          ) : (
                            <span className="inline-flex items-center text-warning font-bold text-[10px] bg-warning/10 px-2 py-1 rounded-md uppercase">{t('table.pending')}</span>
                          )}
                        </td>
                      </tr>

                      {isExpanded && transaction.items?.map(subItem => (
                        <tr key={subItem.id} className="bg-primary/5 border-l-4 border-l-primary/30">
                          <td className="pl-12 py-3 text-[11px] opacity-60 font-mono">↳ {formatDate(subItem.date_paiement).split(' ')[1]}</td>
                          <td className="py-3 opacity-40 text-[11px]">-</td>
                          <td className="py-3 opacity-40 text-[11px]">-</td>
                          <td className="font-mono text-[11px] py-3 font-bold text-primary/70 whitespace-nowrap">{subItem.facture_numero}</td>
                          <td className="text-right text-[11px] py-3 pr-4 font-bold text-base-content/80">
                            {formatCurrencyLocal(normalizeNumberInput(subItem.montant))}
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-[10px] opacity-60 italic">{subItem.reference || '-'}</span>
                          </td>
                          <td className="py-3 text-[10px] font-black text-primary/40 pr-6 text-right">PIÈCE</td>
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

      <div className="p-6 border-t border-base-200 bg-base-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-sm text-base-content/50 font-medium">
          {t('pagination.showing')} <span className="text-base-content">{filteredItems.length}</span> {filteredItems.length > 1 ? t('pagination.lines_plural') : t('pagination.lines')} {t('pagination.of')} <span className="text-base-content">{totalCount}</span> {t('pagination.total')}
        </div>

        {!loading && totalCount > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-base-content/40 uppercase tracking-widest">Page {page} / {totalPages}</span>
            <div className="flex gap-1.5">
              <button
                className="btn btn-sm px-4 bg-base-100 hover:bg-base-200 border-base-300 shadow-sm transition-all"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                {t('common:pagination.prev')}
              </button>
              <button
                className="btn btn-sm px-4 bg-base-100 hover:bg-base-200 border-base-300 shadow-sm transition-all"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t('common:pagination.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
