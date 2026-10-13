import React from 'react';
import { Search, RefreshCw, Plus, Lock, ArrowUpRight, ArrowDownRight, Banknote, AlertTriangle, CheckCircle2 } from 'lucide-react';
import DatePicker from 'react-datepicker';
import type { useJournalCaisse } from '../../hooks/useJournalCaisse';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { cn } from '../../lib/utils';
import { getJournalPaymentModes, getPaymentModeWithIcon } from '../../config/paymentModes';

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

  const closingBlocked = !selectedUser || !!detectedShift?.hasActiveSession;
  const closingStatusText = !selectedUser
    ? t('messages.no_cashier_selected')
    : detectedShift?.hasActiveSession
      ? t('closing.active_session_blocked')
      : t('closing.ready_to_close');

  return (
    <div className="shrink-0 p-2 sm:p-3 space-y-2">
      {/* Ligne 1 : titre + statut clôture + actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="p-1.5 sm:p-2 bg-emerald-100 rounded-lg text-emerald-600 shrink-0">
          <Banknote className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight leading-tight truncate">{t('title')}</h1>
          <div className="text-slate-500 text-caption sm:text-xs flex items-center gap-1.5 truncate">
            <span className="hidden sm:inline">{t('subtitle')}</span>
            <span className="hidden sm:inline size-1 rounded-full bg-slate-300" />
            <span className="font-semibold text-emerald-600 truncate">{t('operations_count', { count: totalCount })}</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Statut clôture — pastille compacte permanente */}
          <div
            role="status"
            title={closingStatusText}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption sm:text-xs font-bold",
              closingBlocked
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            )}
          >
            {closingBlocked
              ? <AlertTriangle className="size-3.5 shrink-0" />
              : <CheckCircle2 className="size-3.5 shrink-0" />}
            <span className="hidden xl:inline max-w-48 truncate">{closingStatusText}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMovementModalOpen(true)}
            className="gap-1.5 h-8 px-2.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            title={t('new_operation')}
          >
            <Plus className="size-4" />
            <span className="hidden md:inline">{t('new_operation')}</span>
          </Button>
          <Button
            size="sm"
            onClick={openClosingModal}
            disabled={loading || !selectedUser || detectedShift?.hasActiveSession}
            className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 shadow-md gap-1.5"
            title={closingStatusText}
          >
            <Lock className="size-4" />
            <span className="hidden md:inline">{t('close_register')}</span>
          </Button>
        </div>
      </div>

      {/* Ligne 2 : type de flux + filtres */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-200 overflow-x-auto gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 px-2.5 sm:px-3 text-xs font-medium", filterType === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}
            onClick={() => setFilterType('all')}
          >
            {t('filter.all')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 px-2.5 sm:px-3 text-xs font-medium flex items-center gap-1", filterType === 'entrees' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-600 hover:bg-emerald-50')}
            onClick={() => setFilterType('entrees')}
          >
            <ArrowUpRight className="size-3.5" /> {t('filter.entries')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 px-2.5 sm:px-3 text-xs font-medium flex items-center gap-1", filterType === 'sorties' ? 'bg-red-600 text-white shadow-sm' : 'text-red-600 hover:bg-red-50')}
            onClick={() => setFilterType('sorties')}
          >
            <ArrowDownRight className="size-3.5" /> {t('filter.exits')}
          </Button>
        </div>

        {/* Recherche */}
        <div className="relative flex-1 min-w-36 max-w-56">
          <input
            type="text"
            aria-label={t('search_placeholder')}
            placeholder={t('search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
          />
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        {/* Mode */}
        <select
          aria-label={t('all_modes')}
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value)}
          className="h-8 px-2 rounded-lg bg-slate-100 border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all max-w-32"
        >
          <option value="all">{t('all_modes')}</option>
          {getJournalPaymentModes().map(m => (
            <option key={m.value} value={m.value}>{getPaymentModeWithIcon(m.value, t)}</option>
          ))}
        </select>

        {/* Caissier */}
        <select
          aria-label={t('all_cashiers')}
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="h-8 px-2 rounded-lg bg-slate-100 border border-slate-200 text-xs sm:text-sm text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all max-w-40"
        >
          <option value="">👤 {t('all_cashiers')}</option>
          {users.map((u: unknown) => (
            <option key={u.id} value={u.id}>
              {u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.username}
            </option>
          ))}
        </select>

        {/* Dates */}
        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 min-w-60 flex-1 lg:flex-none">
          <div className="flex flex-1 min-w-0 items-center px-1.5 py-0.5 gap-1">
            <label htmlFor="journal-date-debut" className="sr-only">{t('date_start')}</label>
            <DatePicker
              id="journal-date-debut"
              selected={dateDebut}
              onChange={(date: Date | null) => setDateDebut(date)}
              showTimeInput
              timeFormat="HH:mm"
              dateFormat="dd/MM/yy HH:mm"
              placeholderText={t('date_start')}
              locale="fr"
              className="w-full min-w-0 text-caption sm:text-xs bg-transparent focus:outline-none cursor-pointer pr-5 font-medium text-slate-700"
              isClearable
            />
            <span className="text-slate-300 text-caption shrink-0">→</span>
            <label htmlFor="journal-date-fin" className="sr-only">{t('date_end')}</label>
            <DatePicker
              id="journal-date-fin"
              selected={dateFin}
              onChange={(date: Date | null) => setDateFin(date)}
              showTimeInput
              timeFormat="HH:mm"
              dateFormat="dd/MM/yy HH:mm"
              placeholderText={t('date_end')}
              locale="fr"
              className="w-full min-w-0 text-caption sm:text-xs bg-transparent focus:outline-none cursor-pointer pr-5 font-medium text-slate-700"
              isClearable
            />
          </div>

          {detectedShift?.active && (
            <div className="flex items-center px-1.5 border-l border-slate-200 shrink-0">
              <Badge variant="outline" className="text-[8px] font-black text-emerald-600 border-emerald-200 uppercase">Shift</Badge>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={setTodayDateRange}
            className="h-7 px-1.5 text-emerald-600 hover:bg-emerald-50 text-caption font-bold shrink-0"
            title={t('today')}
          >
            {t('today_short') || 'Auj.'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="h-7 w-7 p-0 shrink-0"
            title={t('refresh')}
            aria-label={t('refresh')}
          >
            {loading ? <div className="animate-spin rounded-full size-3.5 border-b-2 border-emerald-600" /> : <RefreshCw className="size-3.5 text-slate-500" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
