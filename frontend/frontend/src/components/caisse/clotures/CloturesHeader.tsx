/**
 * En-tête de l'écran Historique des clôtures :
 * titre, sélecteur d'onglet (Clôtures/Sessions), filtres date/caissier/poste,
 * boutons Filtrer / Réinitialiser / Export Excel.
 */
import DatePicker, { registerLocale } from 'react-datepicker'
import { fr } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import { Banknote, Clock, Download } from 'lucide-react'
import { Button } from '../../shadcn/button'
import { Badge } from '../../shadcn/badge'
import { cn } from '../../../lib/utils'
import type { useHistoriqueClotures } from '../../../hooks/caisse/useHistoriqueClotures'

registerLocale('fr', fr)

interface Props {
  state: ReturnType<typeof useHistoriqueClotures>
}

export default function CloturesHeader({ state }: Props) {
  const {
    t, canViewSessions, activeTab, setActiveTab, sessions,
    dateDebut, setDateDebut, dateFin, setDateFin, setCurrentPage,
    users, selectedUser, setSelectedUser,
    isMultiCaisse, postesCaisses, selectedPosteCaisse, setSelectedPosteCaisse,
    handleSearch, resetFilters, exportExcel, loading, clotures,
  } = state

  return (
    <div className="bg-white border-b border-slate-200 shrink-0 p-6">
      <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
              <Banknote className="size-6" />
            </div>
            {t('title')}
          </h1>
          <p className="text-slate-500 mt-1 pl-12 text-sm">
            {t('description')}
          </p>

          {/* Tab Selector */}
          {canViewSessions && (
            <div className="flex gap-1 mt-4 ml-12 bg-slate-100 rounded-lg p-1 w-fit">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('clotures')}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all", activeTab === 'clotures' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
              >
                <Banknote className="size-4" />
                {t('tabs.closings')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('sessions')}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all", activeTab === 'sessions' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
              >
                <Clock className="size-4" />
                {t('tabs.sessions')}
                {sessions.filter(s => s.est_actif).length > 0 && (
                  <Badge variant="outline" className="ml-1 px-1.5 py-0.5 text-caption font-bold rounded-full bg-emerald-50 text-emerald-600 border-emerald-200 animate-pulse">
                    {t('sessions.active_badge', { count: sessions.filter(s => s.est_actif).length })}
                  </Badge>
                )}
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap lg:flex-nowrap gap-3 items-end w-full lg:w-auto">
          <div className="flex-1 lg:w-48">
            <label htmlFor="cloture-date-debut" className="block py-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{t('filters.date_start')}</span>
            </label>
            <DatePicker
              id="cloture-date-debut"
              selected={dateDebut}
              onChange={(date: Date | null) => {
                const now = new Date()
                setDateDebut(date ?? new Date(now.getFullYear(), now.getMonth(), 1))
                setCurrentPage(1)
              }}
              dateFormat="dd/MM/yyyy"
              placeholderText={t('filters.select_placeholder')}
              locale="fr"
              className="w-full h-9 px-3 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
              isClearable
            />
          </div>

          <div className="flex-1 lg:w-48">
            <label htmlFor="cloture-date-fin" className="block py-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{t('filters.date_end')}</span>
            </label>
            <DatePicker
              id="cloture-date-fin"
              selected={dateFin}
              onChange={(date: Date | null) => {
                const now = new Date()
                setDateFin(date ?? new Date(now.getFullYear(), now.getMonth() + 1, 0))
                setCurrentPage(1)
              }}
              dateFormat="dd/MM/yyyy"
              placeholderText={t('filters.select_placeholder')}
              locale="fr"
              className="w-full h-9 px-3 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all"
              isClearable
              minDate={dateDebut || undefined}
            />
          </div>

          <div className="flex-1 lg:w-48">
              <label htmlFor="cloture-cashier-select" className="block py-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{t('filters.cashier')}</span>
              </label>
              <select
                  id="cloture-cashier-select"
                  value={selectedUser}
                  onChange={(e) => {
                      setSelectedUser(e.target.value)
                      setCurrentPage(1)
                  }}
                  className="w-full h-9 px-3 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all font-medium"
              >
                  <option value="">👤 {t('filters.all_cashiers') || 'Tous les caissiers'}</option>
                  {users.map((u) => (
                      <option key={u.id} value={u.id}>
                          {u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.username}
                      </option>
                  ))}
              </select>
          </div>

          {isMultiCaisse && (
              <div className="flex-1 lg:w-48">
                  <label htmlFor="cloture-poste-select" className="block py-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{t('filters.post')}</span>
                  </label>
                  <select
                      id="cloture-poste-select"
                      value={selectedPosteCaisse}
                      onChange={(e) => {
                          setSelectedPosteCaisse(e.target.value)
                          setCurrentPage(1)
                      }}
                      className="w-full h-9 px-3 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition-all font-medium"
                  >
                      <option value="">🖥️ {t('filters.all_posts')}</option>
                      {postesCaisses.map((p) => (
                          <option key={p.id} value={p.id}>{p.nom}</option>
                      ))}
                  </select>
              </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSearch}
              disabled={loading}
              className="lg:px-6"
            >
              {loading ? <div className="animate-spin rounded-full size-4 border-b-2 border-white" /> : t('filters.filter_btn')}
            </Button>

            {(dateDebut || dateFin) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                title={t('filters.reset_title')}
                disabled={loading}
              >
                ✕ {t('filters.reset_btn')}
              </Button>
            )}
<Button
              onClick={exportExcel}
              variant="outline" size="sm" className="gap-2 text-emerald-600"
              disabled={loading || clotures.length === 0}
            >
              <Download className="size-4" />
              Excel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
