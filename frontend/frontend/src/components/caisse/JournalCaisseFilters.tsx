import React from 'react';
import { Search, RefreshCw, Plus, Lock, ArrowUpRight, ArrowDownRight, Banknote } from 'lucide-react';
import DatePicker from 'react-datepicker';
import type { useJournalCaisse } from '../../hooks/useJournalCaisse';

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
    <div className="bg-base-100 border-b border-base-200 shrink-0 p-4 sticky-header shadow-sm">
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary shrink-0">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-base-content tracking-tight">{t('title')}</h1>
            <div className="text-base-content/50 text-xs flex items-center gap-2 mt-0.5">
              <span>{t('subtitle')}</span>
              <span className="w-1 h-1 rounded-full bg-base-300"></span>
              <span className="font-semibold text-primary/80">{t('operations_count', { count: totalCount })}</span>
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
              className="input input-sm input-bordered w-full pl-9 bg-base-200/50 border-base-300 focus:bg-base-100 transition-all text-sm"
            />
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50 text-base-content" />
          </div>

          {/* Mode filter */}
          <div className="w-full sm:w-auto">
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="select select-bordered select-sm w-full bg-base-200/50 border-base-300 font-medium text-sm"
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
              className="select select-bordered select-sm w-full bg-base-200/50 border-base-300 font-medium text-sm"
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
          <div className="flex items-center gap-1 bg-base-200/50 border border-base-300 rounded-lg p-0.5 w-full lg:w-auto">
            <div className="flex items-center px-2 py-1 gap-1">
              <DatePicker
                selected={dateDebut}
                onChange={(date: Date | null) => setDateDebut(date)}
                showTimeInput
                timeFormat="HH:mm"
                dateFormat="dd/MM/yy HH:mm"
                placeholderText={t('date_start')}
                locale="fr"
                className="w-36 text-xs bg-transparent focus:outline-none cursor-pointer pr-8 font-medium"
                isClearable
              />
              <span className="text-base-content/30 text-[10px]">→</span>
              <DatePicker
                selected={dateFin}
                onChange={(date: Date | null) => setDateFin(date)}
                showTimeInput
                timeFormat="HH:mm"
                dateFormat="dd/MM/yy HH:mm"
                placeholderText={t('date_end')}
                locale="fr"
                className="w-36 text-xs bg-transparent focus:outline-none cursor-pointer pr-8 font-medium"
                isClearable
              />
            </div>

            {detectedShift?.active && (
              <div className="flex flex-col items-center justify-center px-2 py-1 border-l border-base-300">
                <span className="text-[8px] font-black text-primary uppercase leading-none">Shift</span>
              </div>
            )}

            <button
              onClick={setTodayDateRange}
              className="btn btn-xs btn-ghost text-primary hover:bg-primary/10 px-2 min-h-0 h-7"
              title={t('today')}
            >
              {t('today_short') || 'Auj.'}
            </button>

            <div className="w-px h-4 bg-base-300 mx-0.5"></div>

            <button
              onClick={fetchData}
              className="btn btn-xs btn-ghost btn-square min-h-0 h-7"
              disabled={loading}
              title={t('refresh')}
            >
              {loading ? <span className="loading loading-spinner loading-[10px]"></span> : <RefreshCw className="w-3.5 h-3.5 text-base-content/60" />}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 w-full sm:w-auto ml-auto">
            <button
              onClick={() => setIsMovementModalOpen(true)}
              className="btn btn-sm btn-outline border-base-300 btn-primary gap-2 flex-1 sm:flex-none shadow-sm"
            >
              <Plus className="w-4 h-4" /> <span className="sm:inline">{t('new_operation')}</span>
            </button>
            <button
              onClick={openClosingModal}
              className="btn btn-sm btn-primary shadow-md gap-2 flex-1 sm:flex-none"
              disabled={loading || !selectedUser}
              title={!selectedUser ? t('messages.no_cashier_selected') : t('close_register')}
            >
              <Lock className="w-4 h-4" /> <span className="sm:inline">{t('close_register')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Filters Bar */}
      <div className="mt-4 pt-4 border-t border-base-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="join bg-base-50 p-1 rounded-lg border border-base-200 w-full sm:w-auto overflow-x-auto">
          <button
            className={`join-item btn btn-sm border-none font-medium px-6 ${filterType === 'all' ? 'bg-base-100 shadow-sm text-base-content' : 'bg-transparent text-base-content/60 hover:text-base-content'}`}
            onClick={() => setFilterType('all')}
          >
            {t('filter.all')}
          </button>
          <button
            className={`join-item btn btn-sm border-none font-medium px-6 flex items-center gap-1 ${filterType === 'entrees' ? 'bg-success text-white shadow-sm' : 'bg-transparent text-success/70 hover:text-success'}`}
            onClick={() => setFilterType('entrees')}
          >
            <ArrowUpRight className="w-4 h-4" /> {t('filter.entries')}
          </button>
          <button
            className={`join-item btn btn-sm border-none font-medium px-6 flex items-center gap-1 ${filterType === 'sorties' ? 'bg-error text-white shadow-sm' : 'bg-transparent text-error/70 hover:text-error'}`}
            onClick={() => setFilterType('sorties')}
          >
            <ArrowDownRight className="w-4 h-4" /> {t('filter.exits')}
          </button>
        </div>
      </div>
    </div>
  );
}
