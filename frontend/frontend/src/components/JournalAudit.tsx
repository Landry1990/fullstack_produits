import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AuditLog {
  id: number;
  user_name: string;
  action: string;
  model_name: string;
  object_id: string;
  details: string; // JSON string
  ip_address: string;
  timestamp: string;
}

const JournalAudit: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

  const fetchLogs = async (pageNum: number) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const endpoint = apiBaseUrl 
        ? `${apiBaseUrl}/api/audit-logs/?page=${pageNum}`
        : `/api/audit-logs/?page=${pageNum}`;
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
  }, [page]);

  const formatAction = (action: string) => {
    const map: {[key: string]: string} = {
      'CREATE': 'Création',
      'UPDATE': 'Modification',
      'DELETE': 'Suppression',
      'LOGIN': 'Connexion',
      'EXPORT': 'Export',
    };
    return map[action] || action;
  };

  const badgeColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'badge-success';
      case 'UPDATE': return 'badge-warning';
      case 'DELETE': return 'badge-error';
      default: return 'badge-ghost';
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Journal d'Audit</h2>
      
      {error && <div className="alert alert-error mb-4">{error}</div>}

      <div className="overflow-x-auto">
        <table className="table w-full table-zebra">
          <thead>
            <tr>
              <th>Date</th>
              <th>Utilisateur</th>
              <th>Action</th>
              <th>Cible</th>
              <th>ID Objet</th>
              <th>Détails</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center">Chargement...</td></tr>
            ) : logs.map(log => (
              <tr key={log.id}>
                <td>{format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}</td>
                <td>{log.user_name || 'Système'}</td>
                <td><span className={`badge ${badgeColor(log.action)}`}>{formatAction(log.action)}</span></td>
                <td>{log.model_name}</td>
                <td>{log.object_id}</td>
                <td className="max-w-xs truncate" title={log.details}>
                  {log.details ? log.details.substring(0, 50) + (log.details.length > 50 ? '...' : '') : '-'}
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
