import React from 'react';
import { ArrowUpRight, ArrowDownRight, Banknote, CreditCard, Wallet } from 'lucide-react';
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters';
import type { useJournalCaisse } from '../../hooks/useJournalCaisse';

interface Props {
  state: ReturnType<typeof useJournalCaisse>;
}

export default function JournalCaisseStats({ state }: Props) {
  const { t, serverTotals, totauxParMode } = state;

  return (
    <>
      {/* Global Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 p-4 md:p-6 pb-2 shrink-0">
        {/* Card 1: Sales */}
        <div className="bg-base-100 p-5 rounded-xl border border-base-200 shadow-sm flex flex-col justify-center">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-base-content/60 text-xs font-bold uppercase tracking-wider mb-1">{t('stats.net_sales')}</h3>
              <div className="text-2xl font-black text-primary">{formatCurrency(serverTotals?.total_ventes ?? totauxParMode.ventes)}</div>
              <div className="text-[10px] text-base-content/40 mt-1 font-medium">{t('stats.ca_real')}</div>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg text-primary">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 2: Recoveries - Informational only */}
        <div className="bg-base-100/50 p-5 rounded-xl border border-base-200 shadow-sm flex flex-col justify-center opacity-80 group hover:opacity-100 transition-opacity">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base-content/60 text-[10px] font-bold uppercase tracking-wider">{t('stats.recoveries')}</h3>
                <span className="badge badge-ghost badge-xs text-[8px] uppercase font-bold opacity-50">{t('stats.memo')}</span>
              </div>
              <div className="text-xl font-bold text-base-content/70">{formatCurrency(serverTotals?.total_recouvrement ?? totauxParMode.recouvrement)}</div>
              <div className="text-[9px] text-base-content/40 mt-1 font-medium">{t('stats.debt_collection')}</div>
            </div>
            <div className="p-2 bg-base-200 rounded-lg text-base-content/30">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Card 3: Cash - Total physical reconciliation */}
        <div className="bg-base-100 p-5 rounded-xl border-l-4 border-l-success border border-base-200 shadow-md flex flex-col justify-center">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-success text-xs font-black uppercase tracking-wider mb-1">{t('stats.cash_to_justify')}</h3>
              <div className="text-2xl font-black text-success">{formatCurrency(serverTotals?.total_theorique ?? totauxParMode.total)}</div>
              <div className="text-[10px] text-success/60 font-medium mt-1 uppercase italic">{t('stats.cash_formula')}</div>
            </div>
            <div className="p-3 bg-success/10 rounded-lg text-success">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 4: Digital / Mobile Money */}
        <div className="bg-base-100 p-5 rounded-xl border border-base-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <h3 className="text-base-content/60 text-xs font-bold uppercase tracking-wider mb-1">{t('stats.mobile_payments')}</h3>
            <div className="text-xs font-bold text-orange-500">{formatCurrency((serverTotals?.details?.om || 0) + (serverTotals?.details?.momo || 0) || (totauxParMode.ventes_par_mode.om + totauxParMode.ventes_par_mode.momo))}</div>
          </div>
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex justify-between items-center text-[11px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> OM</span>
              <span className="font-bold opacity-70">{formatCurrency(serverTotals?.details?.om ?? totauxParMode.ventes_par_mode.om)}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400"></span> MoMo</span>
              <span className="font-bold opacity-70">{formatCurrency(serverTotals?.details?.momo ?? totauxParMode.ventes_par_mode.momo)}</span>
            </div>
          </div>
        </div>

        {/* Card 5: Bank / Others (Grouped as Bank) */}
        <div className="bg-base-100 p-5 rounded-xl border border-base-200 shadow-sm flex flex-col justify-center">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-base-content/60 text-xs font-bold uppercase tracking-wider mb-1">{t('stats.bank_digital')}</h3>
              <div className="text-xl font-bold text-info">{formatCurrency((serverTotals?.details?.carte || 0) + (serverTotals?.details?.cheque || 0) + (serverTotals?.details?.virement || 0) || (totauxParMode.ventes_par_mode.carte + totauxParMode.ventes_par_mode.cheque + totauxParMode.ventes_par_mode.virement))}</div>
              <div className="text-[10px] text-base-content/40 mt-1 font-medium uppercase text-xs">{t('stats.non_cash_sales')}</div>
            </div>
            <div className="p-3 bg-info/10 rounded-lg text-info">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Adaptive Details Bar */}
      <div className="px-4 md:px-6 flex flex-wrap gap-2 items-center mb-4 min-h-[32px]">
        <span className="text-[10px] font-black uppercase text-base-content/40 mr-2">{t('stats.flow_details')}</span>
        
        {/* Part 1: Sales breakdown */}
        {Object.entries(serverTotals?.details || totauxParMode.ventes_par_mode).map(([mode, value]) => {
          const numValue = normalizeNumberInput(value);
          if (numValue === 0) return null;
          
          const labels: Record<string, {label: string, color: string}> = {
            especes: { label: t('common:payment_modes.especes'), color: 'success' },
            cheque: { label: t('common:payment_modes.cheque'), color: 'info' },
            carte: { label: t('common:payment_modes.carte'), color: 'info' },
            virement: { label: t('common:payment_modes.virement'), color: 'info' },
            om: { label: 'O.M.', color: 'warning' },
            momo: { label: 'MoMo', color: 'warning' },
            depot: { label: t('common:payment_modes.depot'), color: 'info' },
            en_compte: { label: t('common:payment_modes.en_compte'), color: 'warning' },
            recouvrement: { label: t('common:payment_modes.recouvrement'), color: 'primary' }
          };
          
          const info = labels[mode] || { label: mode.toUpperCase(), color: 'ghost' };
          
          return (
            <div key={mode} className={`badge badge-ghost border-base-300 gap-2 p-3 text-[10px] font-bold`}>
              <span className={`w-1.5 h-1.5 rounded-full bg-${info.color}`}></span>
              <span className="opacity-60">{info.label}:</span>
              <span>{formatCurrency(numValue)}</span>
            </div>
          );
        })}

        {/* Part 2: Movements breakdown */}
        {(serverTotals?.total_entrees ?? totauxParMode.entrees) !== 0 && (
          <div className="badge badge-success badge-outline gap-2 p-3 text-[10px] font-bold text-success/80">
            <ArrowUpRight className="w-3 h-3" />
            <span className="opacity-60">{t('filter.entries')}:</span>
            <span>{formatCurrency(serverTotals?.total_entrees ?? totauxParMode.entrees)}</span>
          </div>
        )}
        {(serverTotals?.total_sorties ?? totauxParMode.sorties) !== 0 && (
          <div className="badge badge-error badge-outline gap-2 p-3 text-[10px] font-bold text-error/80">
            <ArrowDownRight className="w-3 h-3" />
            <span className="opacity-60">{t('filter.exits')}:</span>
            <span>{formatCurrency(serverTotals?.total_sorties ?? totauxParMode.sorties)}</span>
          </div>
        )}

        {/* Performance Summary Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0 mt-4 sm:mt-0">
          <div className="flex items-center gap-4 bg-base-200 py-2 px-6 rounded-l-full border border-base-300">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase opacity-50">{t('stats.interval_activity')}</span>
              <span className="text-sm font-bold text-base-content">{formatCurrency((serverTotals?.total_ventes ?? totauxParMode.ventes) + (serverTotals?.total_entrees ?? totauxParMode.entrees))}</span>
            </div>
            <div className="w-px h-6 bg-base-300"></div>
            <div className="flex flex-col opacity-60">
              <span className="text-[9px] font-black uppercase italic">{t('stats.expenses')}</span>
              <span className="text-sm font-bold">-{formatCurrency(serverTotals?.total_sorties ?? totauxParMode.sorties)}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-primary text-white py-2 px-6 rounded-r-emerald-none rounded-r-full shadow-xl shadow-primary/20 flex-1 sm:flex-none justify-center sm:justify-start">
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-black uppercase opacity-70 tracking-wider leading-tight">{t('stats.net_operational_balance')}</span>
              <span className="text-[8px] opacity-60 uppercase font-bold">{t('stats.excluding_recoveries')}</span>
            </div>
            <div className="w-px h-6 bg-white/20 mx-1"></div>
            <span className="text-xl font-black">{formatCurrency((serverTotals?.total_ventes ?? totauxParMode.ventes) + (serverTotals?.total_entrees ?? totauxParMode.entrees) - (serverTotals?.total_sorties ?? totauxParMode.sorties))}</span>
          </div>
        </div>
      </div>
    </>
  );
}
