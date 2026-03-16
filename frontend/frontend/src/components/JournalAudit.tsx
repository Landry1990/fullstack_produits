import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import axios from '../config/axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuditLogs, useAuditStats, useUsers } from '../hooks/useAudit';
import { formatNumber } from '../utils/formatters';

const JournalAudit: React.FC = () => {
    const { t, i18n } = useTranslation();

    const ACTION_TYPES = [
      { value: '', label: t('audit.actions.all') },
      { value: 'STOCK_ADJ', label: t('audit.actions.STOCK_ADJ') },
      { value: 'PRICE_CHG', label: t('audit.actions.PRICE_CHG') },
      { value: 'CLOTURE', label: t('audit.actions.CLOTURE') },
      { value: 'INV_CANCEL', label: t('audit.actions.INV_CANCEL') },
      { value: 'INV_DEL', label: t('audit.actions.INV_DEL') },
      { value: 'INV_VALID', label: t('audit.actions.INV_VALID') },
      { value: 'INV_CRE', label: t('audit.actions.INV_CRE') },
      { value: 'INV_VAL', label: t('audit.actions.INV_VAL') },
    
      { value: 'ORD_RECV', label: t('audit.actions.ORD_RECV') },
      { value: 'ORD_CNCL', label: t('audit.actions.ORD_CNCL') },
      { value: 'CREATE', label: t('audit.actions.CREATE') },
      { value: 'UPDATE', label: t('audit.actions.UPDATE') },
      { value: 'DELETE', label: t('audit.actions.DELETE') },
    ];
    // State for UI only (filters and view mode)
    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [userFilter, setUserFilter] = useState('');
    
    const [expandedLog, setExpandedLog] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
    const [showStats, setShowStats] = useState(true);

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

    // React Query Hooks
    const { 
        data: logsData, 
        isLoading: loading, 
        isError: error 
    } = useAuditLogs({
        page,
        action: actionFilter,
        user: userFilter,
        date_from: dateFrom,
        date_to: dateTo
    });

    const { data: statistics } = useAuditStats({
        action: actionFilter,
        user: userFilter,
        date_from: dateFrom,
        date_to: dateTo
    });

    const { data: users = [] } = useUsers();

    // Derived Data
    const logs = logsData?.results || [];
    const totalPages = Math.ceil((logsData?.count || 0) / 50);

    const filteredLogs = useMemo(() => {
        if (!searchQuery.trim()) return logs;
        const query = searchQuery.toLowerCase();
        return logs.filter(log => 
          log.description?.toLowerCase().includes(query) ||
          log.user_name?.toLowerCase().includes(query) ||
          log.model_name?.toLowerCase().includes(query) ||
          log.action_display?.toLowerCase().includes(query)
        );
    }, [logs, searchQuery]);

    const handleExportCSV = async () => {
        try {
          let endpoint = apiBaseUrl 
            ? `${apiBaseUrl}/api/audit-logs/export_csv/`
            : `/api/audit-logs/export_csv/`;
          
          const params = new URLSearchParams();
          if (actionFilter) params.append('action', actionFilter);
          if (userFilter) params.append('user', userFilter);
          if (dateFrom) params.append('date_from', dateFrom);
          if (dateTo) params.append('date_to', dateTo);
          
          if (params.toString()) {
            endpoint += `?${params.toString()}`;
          }
          
          const response = await axios.get(endpoint, {
            responseType: 'blob'
          });
          
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
          document.body.appendChild(link);
          link.click();
          link.remove();
        } catch (err) {
          console.error('Erreur export CSV:', err);
          alert(t('audit.messages.export_error'));
        }
    };

    const handleResetFilters = () => {
        setActionFilter('');
        setUserFilter('');
        setDateFrom('');
        setDateTo('');
        setSearchQuery('');
        setPage(1);
    };

    const getActionStyle = (action: string) => {
        switch (action) {
          case 'CREATE':
          case 'INV_CRE':
            return { badge: 'badge-success', icon: '➕', bg: 'bg-green-50', color: 'text-green-700' };
          case 'UPDATE':
          case 'STOCK_ADJ':
          case 'PRICE_CHG':
            return { badge: 'badge-warning', icon: '✏️', bg: 'bg-yellow-50', color: 'text-yellow-700' };
          case 'DELETE':
          case 'INV_CANCEL':
          case 'ORD_CNCL':
          case 'INV_DEL':
            return { badge: 'badge-error', icon: '🗑️', bg: 'bg-red-50', color: 'text-red-700' };
          case 'CLOTURE':
          case 'ORD_RECV':
            return { badge: 'badge-info', icon: '💰', bg: 'bg-blue-50', color: 'text-blue-700' };
          case 'INV_VALID':
          case 'INV_VAL':
            return { badge: 'badge-primary', icon: '✅', bg: 'bg-purple-50', color: 'text-purple-700' };
          default:
            return { badge: 'badge-ghost', icon: '📝', bg: 'bg-gray-50', color: 'text-gray-700' };
        }
    };

    const formatAuditDetails = (log: any) => {
        if (!log.details || Object.keys(log.details).length === 0) return null;
        const d = log.details;

        // Custom formatting logic based on action and details structure
        if (log.action === 'PRICE_CHG') {
            return t('audit.details.price_change', { old: d.old_price, new: d.new_price });
        }
        if (log.action === 'STOCK_ADJ') {
            return t('audit.details.stock_adj', { old: d.old_quantity, new: d.new_quantity, reason: d.reason || t('audit.actions.STOCK_ADJ') });
        }
        if (d.sudo_validation) {
            return t('audit.details.sudo_val', { user: d.sudo_user, permission: d.sudo_permission });
        }
        if (d.changes) {
            return Object.entries(d.changes)
                .map(([key, val]: [any, any]) => `${key}: ${val.old} ➔ ${val.new}`)
                .join(', ');
        }
        
        // Fallback: search for common keys
        const highlights = [];
        if ('amount' in d) highlights.push(t('audit.details.amount', { amount: d.amount }));
        if ('montant' in d) highlights.push(t('audit.details.amount', { amount: d.montant }));
        if ('quantity' in d) highlights.push(t('audit.details.quantity', { quantity: d.quantity }));
        if ('ecart' in d) highlights.push(t('audit.details.ecart', { ecart: d.ecart }));
        
        return highlights.length > 0 ? highlights.join(' | ') : null;
    };

    const toggleExpandLog = (logId: number) => {
        setExpandedLog(expandedLog === logId ? null : logId);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">📋 {t('audit.title')}</h2>
            <p className="text-gray-600">{t('audit.subtitle')}</p>
          </div>
          
          {error && (
            <div className="alert alert-error mb-4 shadow-lg">
              <div>
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t('audit.messages.load_error')}</span>
              </div>
            </div>
          )}
    
          {/* Statistiques */}
          {statistics && showStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="stat bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg">
                <div className="stat-title text-blue-100">{t('audit.stats.total')}</div>
                <div className="stat-value">{formatNumber(statistics.total_logs)}</div>
              </div>
              <div className="stat bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg">
                <div className="stat-title text-green-100">{t('audit.stats.last_24h')}</div>
                <div className="stat-value">{statistics.recent_activity.last_24h}</div>
              </div>
              <div className="stat bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg">
                <div className="stat-title text-purple-100">{t('audit.stats.last_7d')}</div>
                <div className="stat-value">{statistics.recent_activity.last_7d}</div>
              </div>
              <div className="stat bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-lg">
                <div className="stat-title text-orange-100">{t('audit.stats.last_30d')}</div>
                <div className="stat-value">{statistics.recent_activity.last_30d}</div>
              </div>
            </div>
          )}
    
          {/* Filtres compacts */}
          <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 overflow-hidden mb-6">
            <div className="p-4 bg-base-200/50 flex flex-wrap items-center justify-between gap-4 border-b border-base-200">
                <div className="flex items-center gap-2">
                    <span className="p-2 bg-primary/10 rounded-lg">🔍</span>
                    <h3 className="font-black text-sm uppercase tracking-wider opacity-70">{t('audit.filters.title')}</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowStats(!showStats)} className={`btn btn-sm ${showStats ? 'btn-primary' : 'btn-ghost'} rounded-lg font-bold`}>
                        {showStats ? t('audit.filters.hide_stats') : t('audit.filters.show_stats')}
                    </button>
                    <button onClick={handleExportCSV} className="btn btn-sm btn-success text-white rounded-lg font-bold">{t('audit.filters.export')}</button>
                    <button onClick={handleResetFilters} className="btn btn-sm btn-ghost rounded-lg opacity-50 hover:opacity-100">{t('audit.filters.reset')}</button>
                </div>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase opacity-40 ml-1">{t('audit.filters.action_label')}</label>
                    <select className="select select-bordered select-sm w-full font-bold focus:ring-0" value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}>
                        {ACTION_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase opacity-40 ml-1">{t('audit.filters.user_label')}</label>
                    <select className="select select-bordered select-sm w-full font-bold focus:ring-0" value={userFilter} onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}>
                        <option value="">{t('audit.filters.all_users')}</option>
                        {users.filter(u => u.id).map(user => (
                            <option key={user.id} value={user.id?.toString()}>
                                {user.first_name || user.last_name ? `${user.first_name} ${user.last_name}` : user.username}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1 lg:col-span-1">
                    <label className="text-[10px] font-black uppercase opacity-40 ml-1">{t('audit.filters.date_from')}</label>
                    <input type="datetime-local" className="input input-bordered input-sm w-full font-bold" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
                </div>
                <div className="flex flex-col gap-1 lg:col-span-1">
                    <label className="text-[10px] font-black uppercase opacity-40 ml-1">{t('audit.filters.date_to')}</label>
                    <input type="datetime-local" className="input input-bordered input-sm w-full font-bold" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
                </div>
                <div className="flex flex-col gap-1 lg:col-span-1">
                    <label className="text-[10px] font-black uppercase opacity-40 ml-1">{t('audit.filters.search_label')}</label>
                    <input type="text" placeholder={t('audit.filters.search_placeholder')} className="input input-bordered input-sm w-full font-bold" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
            </div>
          </div>
            {/* View Toggle */}
          <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                  <h3 className="font-black text-xs uppercase opacity-40">{t('audit.view.flux')}</h3>
                  <div className="badge badge-ghost font-bold text-[10px]">{filteredLogs.length} {t('audit.view.items')}</div>
              </div>
              <div className="join bg-base-100 shadow-sm border border-base-200 p-0.5 rounded-xl">
                  <button onClick={() => setViewMode('cards')} className={`join-item btn btn-xs px-4 rounded-lg font-bold ${viewMode === 'cards' ? 'btn-neutral' : 'btn-ghost opacity-40'}`}>{t('audit.view.cards_btn')}</button>
                    <button onClick={() => setViewMode('table')} className={`join-item btn btn-xs px-4 rounded-lg font-bold ${viewMode === 'table' ? 'btn-neutral' : 'btn-ghost opacity-40'}`}>{t('audit.view.table_btn')}</button>
              </div>
          </div>

          {/* Logs */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-base-100 rounded-3xl border-2 border-dashed border-base-200">
              <div className="loading loading-spinner loading-lg text-primary"></div>
              <span className="mt-4 font-black uppercase text-xs opacity-30 tracking-widest">{t('audit.view.loading')}</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="bg-base-100 rounded-3xl border-2 border-dashed border-base-200 p-24 text-center">
              <div className="text-5xl mb-6 opacity-20">🍃</div>
              <p className="font-black text-lg opacity-40 uppercase">{t('audit.view.empty_title')}</p>
              <p className="text-sm opacity-30 mt-1">{t('audit.view.empty_subtitle')}</p>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="space-y-4">
              {filteredLogs.map(log => {
                const style = getActionStyle(log.action);
                const isExpanded = expandedLog === log.id;
                const formattedDetails = formatAuditDetails(log);
                const isSudo = !!log.details?.sudo_validation;
                
                return (
                  <div key={log.id} className="bg-base-100 rounded-2xl shadow-sm border border-base-200 overflow-hidden group hover:border-primary/30 transition-all">
                    <div className="flex flex-col md:flex-row md:items-center">
                        <div className={`p-4 md:w-48 flex-shrink-0 flex items-center gap-3 border-r border-base-200 ${style.bg}/30`}>
                            <span className="text-2xl">{style.icon}</span>
                            <div className="flex flex-col">
                                <span className={`text-[10px] font-black uppercase ${style.color}`}>{log.action_display || log.action}</span>
                                <span className="text-[10px] font-bold opacity-40 leading-tight">
                                    {format(new Date(log.timestamp), "HH:mm:ss", { locale: fr })}
                                </span>
                            </div>
                        </div>

                        <div className="p-4 flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-sm text-base-content/80 line-clamp-1">{log.description || `${log.model_name} #${log.object_id}`}</span>
                                    {isSudo && <span className="badge badge-error badge-sm font-black text-[9px] text-white">{t('audit.view.sudo_badge')}</span>}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                                    <span className="flex items-center gap-1 font-bold opacity-60">
                                        <div className="w-1.5 h-1.5 rounded-full bg-base-300"></div>
                                        {log.user_name || t('audit.view.system_user')}
                                    </span>
                                    <span className="opacity-30 font-bold">{format(new Date(log.timestamp), 'dd MMMM yyyy', { locale: i18n.language === 'fr' ? fr : undefined })}</span>
                                    {formattedDetails && (
                                        <span className="font-black text-primary/80 bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">
                                            {formattedDetails}
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                {log.details && (
                                    <button onClick={() => toggleExpandLog(log.id)} className={`btn btn-circle btn-sm ${isExpanded ? 'btn-neutral' : 'btn-ghost'}`}>
                                        {isExpanded ? '▲' : t('audit.view.json_btn')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {isExpanded && log.details && (
                      <div className="bg-neutral text-neutral-content p-6 font-mono text-[11px] border-t border-neutral-focus">
                        <div className="flex justify-between items-center mb-4 opacity-50">
                            <span className="font-black">{t('audit.view.raw_data')}</span>
                            <span className="text-[9px]">ID: {log.id}</span>
                        </div>
                        <pre className="whitespace-pre-wrap leading-relaxed opacity-80">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-base-100 rounded-3xl border border-base-200 shadow-sm overflow-hidden">
              <table className="table w-full">
                <thead>
                  <tr className="bg-base-200/50">
                    <th className="font-black text-[10px] uppercase opacity-50 pl-6">{t('audit.table.timestamp')}</th>
                    <th className="font-black text-[10px] uppercase opacity-50">{t('audit.table.user')}</th>
                    <th className="font-black text-[10px] uppercase opacity-50">{t('audit.table.operation')}</th>
                    <th className="font-black text-[10px] uppercase opacity-50">{t('audit.table.description')}</th>
                    <th className="font-black text-[10px] uppercase opacity-50 text-right pr-6">{t('audit.table.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-200">
                  {filteredLogs.map(log => {
                    const style = getActionStyle(log.action);
                    const isSudo = !!log.details?.sudo_validation;
                    const details = formatAuditDetails(log);

                    return (
                      <tr key={log.id} className="hover:bg-base-200/30 transition-colors">
                        <td className="pl-6 border-none">
                            <div className="flex flex-col">
                                <span className="font-black text-xs">{format(new Date(log.timestamp), 'HH:mm:ss', { locale: i18n.language === 'fr' ? fr : undefined })}</span>
                                <span className="text-[9px] font-bold opacity-30">{format(new Date(log.timestamp), 'dd/MM/yy', { locale: i18n.language === 'fr' ? fr : undefined })}</span>
                            </div>
                        </td>
                        <td className="border-none">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-base-300 flex items-center justify-center font-black text-[10px] uppercase">
                                    {(log.user_name || t('audit.view.system_user'))[0]}
                                </div>
                                <span className="font-bold text-xs uppercase opacity-80">{log.user_name || t('audit.view.system_user')}</span>
                            </div>
                        </td>
                        <td className="border-none">
                             <div className={`badge ${style.badge} font-black text-[9px] gap-1 px-3 py-1.5`}>
                                 <span>{style.icon}</span>
                                 <span>{log.action_display || log.action}</span>
                             </div>
                        </td>
                        <td className="max-w-md border-none">
                             <div className="flex flex-col gap-0.5 py-1">
                                <span className="font-bold text-xs text-base-content/80">{log.description}</span>
                                {details && <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-1 rounded inline-block w-fit">{details}</span>}
                                {log.model_name && <span className="text-[9px] font-bold opacity-20 uppercase tracking-tighter">{log.model_name} #{log.object_id}</span>}
                             </div>
                        </td>
                        <td className="text-right pr-6 border-none">
                            {isSudo && log.details ? (
                                <div className="tooltip tooltip-left" data-tip={`Validé par ${log.details.sudo_user}`}>
                                    <span className="badge badge-error text-white font-black text-[9px]">{t('audit.table.sudo')}</span>
                                </div>
                            ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block"></span>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
    
          {/* Pagination */}
          {!loading && filteredLogs.length > 0 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button 
                className="btn btn-outline" 
                disabled={page === 1} 
                onClick={() => setPage(page - 1)}
              >
                ← {t('common.pagination.prev')}
              </button>
              <div className="px-4 py-2 bg-white rounded-lg shadow-md">
                <span className="font-semibold">{t('common.pagination.page_info_simple', { page })}</span>
                {totalPages > 1 && <span className="text-gray-500"> {t('common.pagination.page_of', { count: totalPages })}</span>}
              </div>
              <button 
                className="btn btn-outline" 
                disabled={page >= totalPages} 
                onClick={() => setPage(page + 1)}
              >
                {t('common.pagination.next')} →
              </button>
            </div>
          )}
        </div>
      );
};

export default JournalAudit;
