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
  const [actionFilter, setActionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

  const fetchLogs = async (pageNum: number) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      let endpoint = apiBaseUrl 
        ? `${apiBaseUrl}/api/audit-logs/?page=${pageNum}`
        : `/api/audit-logs/?page=${pageNum}`;
      
      if (actionFilter) {
        endpoint += `&action=${actionFilter}`;
      }
      
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Token ${token}` }
      });
      const data = response.data;
      const results = Array.isArray(data) ? data : (data.results || []);
      const count = data.count || results.length;
      setLogs(results);
      setTotalPages(Math.ceil(count / 50)); // Page size is 50 from settings
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Erreur lors du chargement des logs. Assurez-vous d'être administrateur.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page);
  }, [page, actionFilter]);

  // Filtrage local par recherche
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

  const badgeColor = (action: string) => {
    switch (action) {
      case 'CREATE':
      case 'INV_CRE':
        return 'badge-success';
      case 'UPDATE':
      case 'STOCK_ADJ':
      case 'PRICE_CHG':
        return 'badge-warning';
      case 'DELETE':
      case 'INV_CANCEL':
      case 'INV_DEL':
        return 'badge-error';
      case 'CLOTURE':
        return 'badge-info';
      case 'INV_VALID':
      case 'INV_VAL':
        return 'badge-primary';
      default:
        return 'badge-ghost';
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Journal d'Audit</h2>
      
      {error && <div className="alert alert-error mb-4">{error}</div>}

      {/* Filtres */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="form-control w-full max-w-xs">
          <label className="label">
            <span className="label-text">Type d'action</span>
          </label>
          <select 
            className="select select-bordered"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          >
            {ACTION_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        
        <div className="form-control w-full max-w-xs">
          <label className="label">
            <span className="label-text">Rechercher</span>
          </label>
          <input 
            type="text"
            placeholder="Rechercher dans les descriptions..."
            className="input input-bordered"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table w-full table-zebra">
          <thead>
            <tr>
              <th>Date</th>
              <th>Utilisateur</th>
              <th>Action</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center">Chargement...</td></tr>
            ) : filteredLogs.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-gray-500">Aucun log trouvé</td></tr>
            ) : filteredLogs.map(log => (
              <tr key={log.id}>
                <td className="whitespace-nowrap">
                  {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm', { locale: fr })}
                </td>
                <td>{log.user_name || 'Système'}</td>
                <td>
                  <span className={`badge ${badgeColor(log.action)}`}>
                    {log.action_display || log.action}
                  </span>
                </td>
                <td className="max-w-md">
                  {log.description || (
                    <span className="text-gray-400 italic">
                      {log.model_name} #{log.object_id}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center mt-4 btn-group">
        <button className="btn" disabled={page === 1} onClick={() => setPage(page - 1)}>«</button>
        <button className="btn">Page {page}</button>
        <button className="btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>»</button>
      </div>
    </div>
  );
};

export default JournalAudit;
