import React from 'react';
import { Search, RefreshCw, Plus, Lock, ArrowUpRight, ArrowDownRight, Banknote } from 'lucide-react';
import DatePicker from 'react-datepicker';
import type { useJournalCaisse } from '../../hooks/useJournalCaisse';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { cn } from '../../lib/utils';

interface Props {
  state: ReturnType<typeof useJournalCaisse>;
}

export default function JournalCaisseFilters({ state }: Props) {
  const {
    t, totalCount, searchQuery, setSearchQuery, filterMode, setFilterMode,
    users, selectedUser, setSelectedUser, dateDebut, setDateDebut,
    dateFin, setDateFin, detectedShift, setTodayDateRange,
    fetchData, loading, setIsMovementModalOpen, openClosingModal,
    filterType, setFilterType
  } = state;

  return (
    <div className="bg-white border-b border-slate-200 shrink-0 p-4 shadow-sm">
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-600 shrink-0">
            <Banknote className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">{t('title')}</h1>
            <div className="text-slate-500 text-xs flex items-center gap-2 mt-0.5">
              <span>{t('subtitle')}</span>
              <span className="size-1 rounded-full bg-slate-300"></span>
              <span className="font-semibold text-emerald-600">{t('operations_count', { count: totalCount })}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 w-full lg:w-auto">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px] lg:w-64">
            <input
              type="text"
              placeholder={t('search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 h-9 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
            />
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          {/* Mode filter */}
          <div className="w-full sm:w-auto">
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="w-full sm:w-auto h-9 px-3 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
            >
              <option value="all">{t('all_modes')}</option>
              <option value="especes">💵 {t('common:payment_modes.especes')}</option>
              <option value="cheque">✍️ {t('common:payment_modes.cheque')}</option>
              <option value="carte">💳 {t('common:payment_modes.carte')}</option>
              <option value="virement">🏦 {t('common:payment_modes.virement')}</option>
              <option value="om">📶 {t('common:payment_modes.om')}</option>
              <option value="momo">📶 {t('common:payment_modes.momo')}</option>
            </select>
          </div>

          {/* Cashier filter */}
          <div className="w-full sm:w-auto">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full sm:w-auto h-9 px-3 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
            >
              <option value="">👤 {t('all_cashiers')}</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.username}
                </option>
              ))}
            </select>
          </div>

          {/* Date Pickers */}
          <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 w-full lg:w-auto">
            <div className="flex items-center px-2 py-1 gap-1">
              <DatePicker
                selected={dateDebut}
                onChange={(date: Date | null) => setDateDebut(date)}
                showTimeInput
                timeFormat="HH:mm"
                dateFormat="dd/MM/yy HH:mm"
                placeholderText={t('date_start')}
                locale="fr"
                className="w-36 text-xs bg-transparent focus:outline-none cursor-pointer pr-8 font-medium text-slate-700"
                isClearable
              />
              <span className="text-slate-300 text-[10px]">→</span>
              <DatePicker
                selected={dateFin}
                onChange={(date: Date | null) => setDateFin(date)}
                showTimeInput
                timeFormat="HH:mm"
                dateFormat="dd/MM/yy HH:mm"
                placeholderText={t('date_end')}
                locale="fr"
                className="w-36 text-xs bg-transparent focus:outline-none cursor-pointer pr-8 font-medium text-slate-700"
                isClearable
              />
            </div>

            {detectedShift?.active && (
              <div className="flex flex-col items-center justify-center px-2 py-1 border-l border-slate-200">
                <Badge variant="outline" className="text-[8px] font-black text-emerald-600 border-emerald-200 uppercase">Shift</Badge>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={setTodayDateRange}
              className="h-7 px-2 text-emerald-600 hover:bg-emerald-50 text-xs"
              title={t('today')}
            >
              {t('today_short') || 'Auj.'}
            </Button>

            <div className="w-px h-4 bg-slate-200 mx-0.5"></div>

            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="h-7 w-7 p-0"
              title={t('refresh')}
            >
              {loading ? <div className="animate-spin rounded-full size-3.5 border-b-2 border-emerald-600" /> : <RefreshCw className="size-3.5 text-slate-500" />}
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 w-full sm:w-auto ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMovementModalOpen(true)}
              className="gap-2 flex-1 sm:flex-none border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <Plus className="size-4" /> <span className="sm:inline">{t('new_operation')}</span>
            </Button>
            <Button
              size="sm"
              onClick={openClosingModal}
              disabled={loading || !selectedUser}
              className="bg-emerald-600 hover:bg-emerald-700 shadow-md gap-2 flex-1 sm:flex-none"
              title={!selectedUser ? t('messages.no_cashier_selected') : t('close_register')}
            >
              <Lock className="size-4" /> <span className="sm:inline">{t('close_register')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Status Filters Bar */}
      <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200 w-full sm:w-auto overflow-x-auto gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn("font-medium px-6", filterType === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}
            onClick={() => setFilterType('all')}
          >
            {t('filter.all')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("font-medium px-6 flex items-center gap-1", filterType === 'entrees' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-600 hover:bg-emerald-50')}
            onClick={() => setFilterType('entrees')}
          >
            <ArrowUpRight className="size-4" /> {t('filter.entries')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("font-medium px-6 flex items-center gap-1", filterType === 'sorties' ? 'bg-red-600 text-white shadow-sm' : 'text-red-600 hover:bg-red-50')}
            onClick={() => setFilterType('sorties')}
          >
            <ArrowDownRight className="size-4" /> {t('filter.exits')}
          </Button>
        </div>
      </div>
    </div>
  );
}
