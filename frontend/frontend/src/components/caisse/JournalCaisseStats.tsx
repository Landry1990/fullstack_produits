import React from 'react';
import { ArrowUpRight, ArrowDownRight, Banknote, CreditCard, Wallet } from 'lucide-react';
import { formatCurrency, normalizeNumberInput } from '../../utils/formatters';
import type { useJournalCaisse } from '../../hooks/useJournalCaisse';
import { cn } from '../../lib/utils';

interface Props {
  state: ReturnType<typeof useJournalCaisse>;
}

export default function JournalCaisseStats({ state }: Props) {
  const { t, serverTotals, totauxParMode } = state;

  return (
    <>
      {/* Global Stats Cards — version compacte */}
      <div className="grid grid-cols-5 gap-2 px-4 md:px-6 pt-3 pb-1 shrink-0">
        {/* Card 1: Ventes nettes */}
        <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider truncate">{t('stats.net_sales')}</div>
            <div className="text-base font-black text-emerald-600 leading-tight">{formatCurrency(serverTotals?.total_ventes ?? totauxParMode.ventes)}</div>
            <div className="text-[9px] text-slate-400 truncate">{t('stats.ca_real')}</div>
          </div>
          <div className="p-1.5 bg-emerald-100 rounded-md text-emerald-600 shrink-0">
            <ArrowUpRight className="size-3.5" />
          </div>
        </div>

        {/* Card 2: Recouvrements */}
        <div className="bg-white/50 px-3 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between gap-2 opacity-70">
          <div className="min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider truncate">{t('stats.recoveries')}</div>
              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 text-[7px] uppercase font-bold px-1 text-slate-500">{t('stats.memo')}</span>
            </div>
            <div className="text-base font-bold text-slate-600 leading-tight">{formatCurrency(serverTotals?.total_recouvrement ?? totauxParMode.recouvrement)}</div>
            <div className="text-[9px] text-slate-400 truncate">{t('stats.debt_collection')}</div>
          </div>
          <div className="p-1.5 bg-slate-100 rounded-md text-slate-400 shrink-0">
            <Wallet className="size-3.5" />
          </div>
        </div>

        {/* Card 3: Espèces à justifier */}
        <div className="bg-white px-3 py-2 rounded-lg border-l-4 border-l-emerald-400 border border-slate-200 shadow-sm flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[9px] text-emerald-600 font-black uppercase tracking-wider truncate">{t('stats.cash_to_justify')}</div>
            <div className="text-base font-black text-emerald-600 leading-tight">{formatCurrency(serverTotals?.total_theorique ?? totauxParMode.total)}</div>
            <div className="text-[9px] text-emerald-400 truncate italic">{t('stats.cash_formula')}</div>
          </div>
          <div className="p-1.5 bg-emerald-50 rounded-md text-emerald-600 shrink-0">
            <Banknote className="size-3.5" />
          </div>
        </div>

        {/* Card 4: Mobile Money */}
        <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider truncate">{t('stats.mobile_payments')}</div>
            <div className="text-[10px] font-bold text-orange-500">{formatCurrency((serverTotals?.details?.om || 0) + (serverTotals?.details?.momo || 0) || (totauxParMode.global_par_mode.om + totauxParMode.global_par_mode.momo))}</div>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between items-center text-[10px]">
              <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-orange-500"></span> OM</span>
              <span className="font-bold text-slate-600">{formatCurrency(serverTotals?.details?.om ?? totauxParMode.global_par_mode.om)}</span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-yellow-400"></span> MoMo</span>
              <span className="font-bold text-slate-600">{formatCurrency(serverTotals?.details?.momo ?? totauxParMode.global_par_mode.momo)}</span>
            </div>
          </div>
        </div>

        {/* Card 5: Banque / Digital */}
        <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider truncate">{t('stats.bank_digital')}</div>
            <div className="text-base font-bold text-sky-600 leading-tight">{formatCurrency((serverTotals?.details?.carte || 0) + (serverTotals?.details?.cheque || 0) + (serverTotals?.details?.virement || 0) || (totauxParMode.global_par_mode.carte + totauxParMode.global_par_mode.cheque + totauxParMode.global_par_mode.virement))}</div>
            <div className="text-[9px] text-slate-400 truncate uppercase">{t('stats.non_cash_sales')}</div>
          </div>
          <div className="p-1.5 bg-sky-50 rounded-md text-sky-600 shrink-0">
            <CreditCard className="size-3.5" />
          </div>
        </div>
      </div>

      {/* Adaptive Details Bar */}
      <div className="px-4 md:px-6 flex flex-wrap gap-2 items-center mb-2 min-h-[28px]">
        <span className="text-[10px] font-black uppercase text-slate-400 mr-2">{t('stats.flow_details')}</span>

        {/* Part 1: All payments breakdown (Sales + Recoveries) */}
        {Object.entries(serverTotals?.details || totauxParMode.global_par_mode).map(([mode, value]) => {
          const numValue = normalizeNumberInput(value);
          if (numValue === 0) return null;

          const labels: Record<string, {label: string, colorClass: string}> = {
            especes: { label: t('common:payment_modes.especes'), colorClass: 'bg-emerald-500' },
            cheque: { label: t('common:payment_modes.cheque'), colorClass: 'bg-sky-500' },
            carte: { label: t('common:payment_modes.carte'), colorClass: 'bg-sky-500' },
            virement: { label: t('common:payment_modes.virement'), colorClass: 'bg-sky-500' },
            om: { label: 'O.M.', colorClass: 'bg-amber-500' },
            momo: { label: 'MoMo', colorClass: 'bg-amber-400' },
            depot: { label: t('common:payment_modes.depot'), colorClass: 'bg-sky-500' },
            en_compte: { label: t('common:payment_modes.en_compte'), colorClass: 'bg-amber-500' },
            recouvrement: { label: t('common:payment_modes.recouvrement'), colorClass: 'bg-emerald-600' }
          };

          const info = labels[mode] || { label: mode.toUpperCase(), colorClass: 'bg-slate-300' };

          return (
            <div key={mode} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-[10px] font-bold">
              <span className={cn("size-1.5 rounded-full", info.colorClass)}></span>
              <span className="text-slate-500">{info.label}:</span>
              <span className="text-slate-700">{formatCurrency(numValue)}</span>
            </div>
          );
        })}

        {/* Part 2: Movements breakdown */}
        {(serverTotals?.total_entrees ?? totauxParMode.entrees) !== 0 && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-[10px] font-bold text-emerald-700">
            <ArrowUpRight className="size-3" />
            <span className="text-emerald-600">{t('filter.entries')}:</span>
            <span>{formatCurrency(serverTotals?.total_entrees ?? totauxParMode.entrees)}</span>
          </div>
        )}
        {(serverTotals?.total_sorties ?? totauxParMode.sorties) !== 0 && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-red-200 bg-red-50 text-[10px] font-bold text-red-700">
            <ArrowDownRight className="size-3" />
            <span className="text-red-600">{t('filter.exits')}:</span>
            <span>{formatCurrency(serverTotals?.total_sorties ?? totauxParMode.sorties)}</span>
          </div>
        )}

        {/* Performance Summary Bar */}
        <div className="flex items-center gap-0 mt-2 sm:mt-0">
          <div className="flex items-center gap-3 bg-slate-100 py-1.5 px-4 rounded-l-full border border-slate-200">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase text-slate-500">{t('stats.interval_activity')}</span>
              <span className="text-xs font-bold text-slate-700">{formatCurrency((serverTotals?.total_ventes ?? totauxParMode.ventes) + (serverTotals?.total_entrees ?? totauxParMode.entrees))}</span>
            </div>
            <div className="w-px h-5 bg-slate-200"></div>
            <div className="flex flex-col opacity-60">
              <span className="text-[8px] font-black uppercase italic text-slate-600">{t('stats.expenses')}</span>
              <span className="text-xs font-bold text-slate-700">-{formatCurrency(serverTotals?.total_sorties ?? totauxParMode.sorties)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-emerald-600 text-white py-1.5 px-4 rounded-r-full shadow-lg shadow-emerald-200">
            <div className="flex flex-col items-start">
              <span className="text-[8px] font-black uppercase text-white/70 tracking-wider leading-tight">{t('stats.net_operational_balance')}</span>
              <span className="text-[7px] text-white/60 uppercase font-bold">{t('stats.excluding_recoveries')}</span>
            </div>
            <div className="w-px h-5 bg-white/20"></div>
            <span className="text-sm font-black">{formatCurrency(
              (serverTotals?.total_ventes ?? totauxParMode.ventes)
              + (serverTotals?.total_entrees ?? totauxParMode.entrees)
              - (serverTotals?.total_sorties ?? totauxParMode.sorties)
            )}</span>
          </div>
        </div>
      </div>
    </>
  );
}
