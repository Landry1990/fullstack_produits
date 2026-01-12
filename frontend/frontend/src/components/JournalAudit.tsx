import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AuditLog {
  id: number;
  user_name: string;
  action: string;
  action_display: string;
  model_name: string;
  object_id: string;
  description: string;
  details: Record<string, unknown> | null;
  ip_address: string;
  timestamp: string;
}

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
}

interface Statistics {
  total_logs: number;
  actions_stats: Array<{ action: string; action_label: string; count: number }>;
  top_users: Array<{ user_id: number; username: string; display_name: string; count: number }>;
  recent_activity: {
    last_24h: number;
    last_7d: number;
    last_30d: number;
  };
}

const ACTION_TYPES = [
  { value: '', label: 'Tous' },
  { value: 'STOCK_ADJ', label: 'Ajustement stock' },
  { value: 'PRICE_CHG', label: 'Changement prix' },
  { value: 'CLOTURE', label: 'Clôture caisse' },
  { value: 'INV_CANCEL', label: 'Annulation facture' },
  { value: 'INV_DEL', label: 'Suppression facture' },
  { value: 'INV_VALID', label: 'Validation facture' },
  { value: 'INV_CRE', label: 'Création inventaire' },
  { value: 'INV_VAL', label: 'Validation inventaire' },
  { value: 'CREATE', label: 'Création' },
  { value: 'UPDATE', label: 'Modification' },
  { value: 'DELETE', label: 'Suppression' },
];

const JournalAudit: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filtres
  const [actionFilter, setActionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  
  // Données supplémentaires
  const [users, setUsers] = useState<User[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  
  // UI State
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showStats, setShowStats] = useState(true);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/users/` : `/api/users/`;
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Token ${token}` }
      });
      setUsers(response.data.results || response.data || []);
    } catch (err) {
      console.error('Erreur chargement utilisateurs:', err);
    }
  };

  const fetchStatistics = async () => {
    try {
      const token = localStorage.getItem('access_token');
      let endpoint = apiBaseUrl 
        ? `${apiBaseUrl}/api/audit-logs/statistics/`
        : `/api/audit-logs/statistics/`;
      
      // Ajouter les filtres actifs aux statistiques
      const params = new URLSearchParams();
      if (actionFilter) params.append('action', actionFilter);
      if (userFilter) params.append('user', userFilter);
      if (modelFilter) params.append('model_name', modelFilter);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      
      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }
      
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Token ${token}` }
      });
      setStatistics(response.data);
    } catch (err) {
      console.error('Erreur chargement statistiques:', err);
    }
  };

  const fetchLogs = async (pageNum: number) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      let endpoint = apiBaseUrl 
        ? `${apiBaseUrl}/api/audit-logs/?page=${pageNum}`
        : `/api/audit-logs/?page=${pageNum}`;
      
      const params = new URLSearchParams();
      if (actionFilter) params.append('action', actionFilter);
      if (userFilter) params.append('user', userFilter);
      if (modelFilter) params.append('model_name', modelFilter);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      
      if (params.toString()) {
        endpoint += `&${params.toString()}`;
      }
      
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Token ${token}` }
      });
      const data = response.data;
      const results = Array.isArray(data) ? data : (data.results || []);
      const count = data.count || results.length;
      setLogs(results);
      setTotalPages(Math.ceil(count / 50));
      
      // Extraire les modèles uniques
      const uniqueModels = [...new Set(results.map((log: AuditLog) => log.model_name))].filter(Boolean);
      setModels(uniqueModels as string[]);
      
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Erreur lors du chargement des logs. Assurez-vous d'être administrateur.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchLogs(page);
    fetchStatistics();
  }, [page, actionFilter, userFilter, modelFilter, dateFrom, dateTo]);

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
      const token = localStorage.getItem('access_token');
      let endpoint = apiBaseUrl 
        ? `${apiBaseUrl}/api/audit-logs/export_csv/`
        : `/api/audit-logs/export_csv/`;
      
      const params = new URLSearchParams();
      if (actionFilter) params.append('action', actionFilter);
      if (userFilter) params.append('user', userFilter);
      if (modelFilter) params.append('model_name', modelFilter);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      
      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }
      
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Token ${token}` },
        responseType: 'blob'
      });
      
      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Erreur export CSV:', err);
      alert('Erreur lors de l\'export CSV');
    }
  };

  const handleResetFilters = () => {
    setActionFilter('');
    setUserFilter('');
    setModelFilter('');
    setDateFrom('');
    setDateTo('');
    setSearchQuery('');
    setPage(1);
  };

  const getActionStyle = (action: string) => {
    switch (action) {
      case 'CREATE':
      case 'INV_CRE':
        return { badge: 'badge-success', icon: '➕', bg: 'bg-green-50' };
      case 'UPDATE':
      case 'STOCK_ADJ':
      case 'PRICE_CHG':
        return { badge: 'badge-warning', icon: '✏️', bg: 'bg-yellow-50' };
      case 'DELETE':
      case 'INV_CANCEL':
      case 'INV_DEL':
        return { badge: 'badge-error', icon: '🗑️', bg: 'bg-red-50' };
      case 'CLOTURE':
        return { badge: 'badge-info', icon: '💰', bg: 'bg-blue-50' };
      case 'INV_VALID':
      case 'INV_VAL':
        return { badge: 'badge-primary', icon: '✅', bg: 'bg-purple-50' };
      default:
        return { badge: 'badge-ghost', icon: '📝', bg: 'bg-gray-50' };
    }
  };

  const toggleExpandLog = (logId: number) => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">📋 Journal d'Audit</h2>
        <p className="text-gray-600">Suivez toutes les actions effectuées sur le système</p>
      </div>
      
      {error && (
        <div className="alert alert-error mb-4 shadow-lg">
          <div>
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Statistiques */}
      {statistics && showStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="stat bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg">
            <div className="stat-title text-blue-100">Total Logs</div>
            <div className="stat-value">{statistics.total_logs.toLocaleString()}</div>
          </div>
          <div className="stat bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg">
            <div className="stat-title text-green-100">Dernières 24h</div>
            <div className="stat-value">{statistics.recent_activity.last_24h}</div>
          </div>
          <div className="stat bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg">
            <div className="stat-title text-purple-100">Derniers 7 jours</div>
            <div className="stat-value">{statistics.recent_activity.last_7d}</div>
          </div>
          <div className="stat bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-lg">
            <div className="stat-title text-orange-100">Derniers 30 jours</div>
            <div className="stat-value">{statistics.recent_activity.last_30d}</div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Filtres</h3>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowStats(!showStats)}
              className="btn btn-sm btn-outline"
            >
              {showStats ? '📊 Masquer stats' : '📊 Afficher stats'}
            </button>
            <button 
              onClick={handleExportCSV}
              className="btn btn-sm btn-success"
            >
              📥 Export CSV
            </button>
            <button 
              onClick={handleResetFilters}
              className="btn btn-sm btn-ghost"
            >
              🔄 Réinitialiser
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Type d'action</span>
            </label>
            <select 
              className="select select-bordered w-full"
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            >
              {ACTION_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Utilisateur</span>
            </label>
            <select 
              className="select select-bordered w-full"
              value={userFilter}
              onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
            >
              <option value="">Tous</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.first_name || user.last_name 
                    ? `${user.first_name} ${user.last_name}`.trim() 
                    : user.username}
                </option>
              ))}
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Modèle</span>
            </label>
            <select 
              className="select select-bordered w-full"
              value={modelFilter}
              onChange={(e) => { setModelFilter(e.target.value); setPage(1); }}
            >
              <option value="">Tous</option>
              {models.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Date début</span>
            </label>
            <div className="flex gap-1">
              <input 
                type="date"
                className="input input-bordered w-full"
                value={dateFrom ? dateFrom.split('T')[0] : ''}
                onChange={(e) => { 
                    const d = e.target.value;
                    const t = dateFrom ? dateFrom.split('T')[1] : '00:00';
                    setDateFrom(d ? `${d}T${t}` : '');
                    setPage(1); 
                }}
                lang="fr"
              />
              <input 
                type="time"
                className="input input-bordered w-32"
                value={dateFrom ? dateFrom.split('T')[1] : ''}
                onChange={(e) => { 
                     const t = e.target.value;
                     const d = dateFrom ? dateFrom.split('T')[0] : new Date().toISOString().split('T')[0];
                     setDateFrom(`${d}T${t}`);
                     setPage(1);
                }}
                lang="fr"
              />
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Date fin</span>
            </label>
            <div className="flex gap-1">
              <input 
                type="date"
                className="input input-bordered w-full"
                value={dateTo ? dateTo.split('T')[0] : ''}
                onChange={(e) => { 
                    const d = e.target.value;
                    const t = dateTo ? dateTo.split('T')[1] : '23:59';
                    setDateTo(d ? `${d}T${t}` : '');
                    setPage(1); 
                }}
                lang="fr"
              />
              <input 
                type="time"
                className="input input-bordered w-32"
                value={dateTo ? dateTo.split('T')[1] : ''}
                onChange={(e) => { 
                     const t = e.target.value;
                     const d = dateTo ? dateTo.split('T')[0] : new Date().toISOString().split('T')[0];
                     setDateTo(`${d}T${t}`);
                     setPage(1);
                }}
                lang="fr"
              />
            </div>
          </div>
          
          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Rechercher</span>
            </label>
            <input 
              type="text"
              placeholder="Description, utilisateur..."
              className="input input-bordered w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <div className="btn-group">
            <button 
              className={`btn btn-sm ${viewMode === 'cards' ? 'btn-active' : ''}`}
              onClick={() => setViewMode('cards')}
            >
              🗂️ Cartes
            </button>
            <button 
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              📄 Tableau
            </button>
          </div>
        </div>
      </div>

      {/* Logs */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="loading loading-spinner loading-lg"></div>
          <span className="ml-4 text-lg">Chargement des logs...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-xl text-gray-500">Aucun log trouvé</p>
          <p className="text-gray-400 mt-2">Essayez de modifier vos filtres de recherche</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="space-y-3">
          {filteredLogs.map(log => {
            const style = getActionStyle(log.action);
            const isExpanded = expandedLog === log.id;
            
            return (
              <div 
                key={log.id} 
                className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden border-l-4 ${
                  style.badge === 'badge-success' ? 'border-green-500' :
                  style.badge === 'badge-warning' ? 'border-yellow-500' :
                  style.badge === 'badge-error' ? 'border-red-500' :
                  style.badge === 'badge-info' ? 'border-blue-500' :
                  style.badge === 'badge-primary' ? 'border-purple-500' :
                  'border-gray-300'
                }`}
              >
                <div className={`p-4 ${style.bg}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-3xl">{style.icon}</div>
                      <div>
                        <span className={`badge ${style.badge} badge-lg`}>
                          {log.action_display || log.action}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 font-medium text-lg mb-1">
                        {log.description || (
                          <span className="text-gray-500 italic">
                            {log.model_name} #{log.object_id}
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <strong>{log.user_name || 'Système'}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {format(new Date(log.timestamp), 'dd/MM/yyyy à HH:mm:ss', { locale: fr })}
                        </span>
                        {log.ip_address && (
                          <span className="flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                            {log.ip_address}
                          </span>
                        )}
                      </div>
                    </div>

                    {log.details && Object.keys(log.details).length > 0 && (
                      <button
                        onClick={() => toggleExpandLog(log.id)}
                        className="btn btn-sm btn-ghost flex-shrink-0"
                      >
                        {isExpanded ? '▲ Masquer' : '▼ Détails'}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && log.details && (
                  <div className="bg-gray-800 text-green-400 p-4 font-mono text-sm overflow-x-auto">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date/Heure</th>
                <th>Utilisateur</th>
                <th>Action</th>
                <th>Description</th>
                <th>Modèle</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => {
                const style = getActionStyle(log.action);
                return (
                  <tr key={log.id} className="hover">
                    <td>{log.id}</td>
                    <td className="whitespace-nowrap">
                      {format(new Date(log.timestamp), 'dd/MM/yy HH:mm', { locale: fr })}
                    </td>
                    <td>{log.user_name || 'Système'}</td>
                    <td>
                      <span className={`badge ${style.badge} badge-sm`}>
                        {style.icon} {log.action_display}
                      </span>
                    </td>
                    <td className="max-w-md truncate">
                      {log.description || `${log.model_name} #${log.object_id}`}
                    </td>
                    <td><code className="text-xs">{log.model_name}</code></td>
                    <td className="text-xs text-gray-500">{log.ip_address}</td>
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
            ← Précédent
          </button>
          <div className="px-4 py-2 bg-white rounded-lg shadow-md">
            <span className="font-semibold">Page {page}</span>
            {totalPages > 1 && <span className="text-gray-500"> sur {totalPages}</span>}
          </div>
          <button 
            className="btn btn-outline" 
            disabled={page >= totalPages} 
            onClick={() => setPage(page + 1)}
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
};

export default JournalAudit;
