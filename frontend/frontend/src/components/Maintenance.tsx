import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Trash2, Download, Eye, ShieldAlert, AlertTriangle,
  CheckSquare, Square, Calendar, Loader2,
  Wrench, ChevronDown, ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PurgeTable {
  key: string;
  label: string;
  children: string[];
}

interface PreviewResult {
  key: string;
  label: string;
  count: number;
  children: { label: string; count: number }[];
}

interface PurgeResult {
  key: string;
  label: string;
  deleted: number;
}

// Group tables by category for display
const TABLE_CATEGORIES: Record<string, { label: string; icon: string; keys: string[] }> = {
  ventes: {
    label: '💰 Ventes & Facturation',
    icon: '💰',
    keys: ['factures', 'caisse', 'releves', 'coupons', 'promis'],
  },
  achats: {
    label: '📦 Achats & Fournisseurs',
    icon: '📦',
    keys: ['commandes', 'avoirs', 'paiements_fournisseur'],
  },
  stock: {
    label: '📊 Stock',
    icon: '📊',
    keys: ['mouvements_stock', 'ajustements_stock'],
  },
  caisse: {
    label: '🏦 Caisse',
    icon: '🏦',
    keys: ['clotures_caisse', 'mouvements_caisse'],
  },
  audit: {
    label: '📋 Audit & Logs',
    icon: '📋',
    keys: ['ordonnancier', 'audit_logs', 'activity_logs', 'sms_logs'],
  },
  objectifs: {
    label: '🎯 Objectifs',
    icon: '🎯',
    keys: ['objectifs'],
  },
};

export default function Maintenance() {
  const [tables, setTables] = useState<PurgeTable[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [preview, setPreview] = useState<PreviewResult[] | null>(null);
  const [purgeResults, setPurgeResults] = useState<PurgeResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [password, setPassword] = useState('');
  const [purging, setPurging] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(Object.keys(TABLE_CATEGORIES)));

  // Fetch available tables
  useEffect(() => {
    axios.get('/api/maintenance/tables/')
      .then(res => setTables(res.data))
      .catch(() => toast.error('Erreur chargement des tables'));
  }, []);

  const toggleTable = (key: string) => {
    setSelectedTables(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setPreview(null);
    setPurgeResults(null);
  };

  const toggleCategory = (catKeys: string[]) => {
    const allSelected = catKeys.every(k => selectedTables.has(k));
    setSelectedTables(prev => {
      const next = new Set(prev);
      catKeys.forEach(k => {
        if (allSelected) next.delete(k);
        else next.add(k);
      });
      return next;
    });
    setPreview(null);
    setPurgeResults(null);
  };

  const toggleExpandCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedTables(new Set(tables.map(t => t.key)));
    setPreview(null);
    setPurgeResults(null);
  };

  const deselectAll = () => {
    setSelectedTables(new Set());
    setPreview(null);
    setPurgeResults(null);
  };

  const handlePreview = async () => {
    if (selectedTables.size === 0) {
      toast.error('Sélectionnez au moins une table');
      return;
    }
    setLoading(true);
    setPurgeResults(null);
    try {
      const res = await axios.post('/api/maintenance/preview/', {
        tables: Array.from(selectedTables),
        date_from: dateFrom || null,
        date_to: dateTo || null,
      });
      setPreview(res.data);
    } catch {
      toast.error('Erreur lors de la prévisualisation');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (selectedTables.size === 0) {
      toast.error('Sélectionnez au moins une table');
      return;
    }
    setExporting(true);
    try {
      const res = await axios.post('/api/maintenance/export/', {
        tables: Array.from(selectedTables),
        date_from: dateFrom || null,
        date_to: dateTo || null,
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `purge_backup_${new Date().toISOString().slice(0, 10)}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export CSV téléchargé !');
    } catch {
      toast.error('Erreur lors de l\'export');
    } finally {
      setExporting(false);
    }
  };

  const handlePurge = async () => {
    if (!password) {
      toast.error('Mot de passe requis');
      return;
    }
    setPurging(true);
    try {
      const res = await axios.post('/api/maintenance/purge/', {
        tables: Array.from(selectedTables),
        date_from: dateFrom || null,
        date_to: dateTo || null,
        password,
      });
      setPurgeResults(res.data.results);
      setPreview(null);
      setShowConfirmModal(false);
      setPassword('');
      toast.success('Purge effectuée avec succès !');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Erreur lors de la purge';
      toast.error(msg);
    } finally {
      setPurging(false);
    }
  };

  const totalPreviewCount = preview?.reduce((sum, p) => {
    const childTotal = p.children.reduce((cs, c) => cs + c.count, 0);
    return sum + p.count + childTotal;
  }, 0) ?? 0;

  const tableMap = new Map(tables.map(t => [t.key, t]));

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20">
          <Wrench className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Maintenance &amp; Purge</h1>
          <p className="text-sm text-base-content/60">Nettoyage sécurisé des données transactionnelles</p>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="alert alert-warning mb-6 shadow-lg">
        <AlertTriangle className="w-5 h-5" />
        <div>
          <h3 className="font-bold">Opération irréversible</h3>
          <p className="text-sm">Les données supprimées ne pourront pas être récupérées. Exportez toujours une sauvegarde CSV avant de purger.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Table Selection */}
        <div className="lg:col-span-2">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <h2 className="card-title text-lg">
                  <CheckSquare className="w-5 h-5 text-primary" />
                  Tables à purger
                </h2>
                <div className="flex gap-2">
                  <button className="btn btn-xs btn-ghost" onClick={selectAll}>Tout sélectionner</button>
                  <button className="btn btn-xs btn-ghost" onClick={deselectAll}>Tout désélectionner</button>
                </div>
              </div>

              <div className="space-y-2">
                {Object.entries(TABLE_CATEGORIES).map(([catKey, cat]) => {
                  const availableKeys = cat.keys.filter(k => tableMap.has(k));
                  if (availableKeys.length === 0) return null;
                  const allCatSelected = availableKeys.every(k => selectedTables.has(k));
                  const someCatSelected = availableKeys.some(k => selectedTables.has(k));
                  const isExpanded = expandedCategories.has(catKey);

                  return (
                    <div key={catKey} className="border border-base-300 rounded-lg overflow-hidden">
                      {/* Category header */}
                      <div
                        className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${someCatSelected ? 'bg-primary/10' : 'bg-base-200/50 hover:bg-base-200'}`}
                        onClick={() => toggleExpandCategory(catKey)}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            className="btn btn-xs btn-ghost p-0"
                            onClick={(e) => { e.stopPropagation(); toggleCategory(availableKeys); }}
                          >
                            {allCatSelected ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : someCatSelected ? (
                              <CheckSquare className="w-4 h-4 text-primary/50" />
                            ) : (
                              <Square className="w-4 h-4 text-base-content/40" />
                            )}
                          </button>
                          <span className="font-semibold text-sm">{cat.label}</span>
                          <span className="badge badge-sm badge-ghost">{availableKeys.length}</span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>

                      {/* Category items */}
                      {isExpanded && (
                        <div className="divide-y divide-base-200">
                          {availableKeys.map(key => {
                            const table = tableMap.get(key)!;
                            const isSelected = selectedTables.has(key);
                            return (
                              <label
                                key={key}
                                className={`flex items-center gap-3 px-6 py-2.5 cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-base-200/30'}`}
                              >
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm checkbox-primary"
                                  checked={isSelected}
                                  onChange={() => toggleTable(key)}
                                />
                                <span className="text-sm flex-1">{table.label}</span>
                                {table.children.length > 0 && (
                                  <span className="text-xs text-base-content/50">
                                    +{table.children.length} sous-table{table.children.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Controls */}
        <div className="space-y-4">
          {/* Date Range */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-lg mb-2">
                <Calendar className="w-5 h-5 text-secondary" />
                Période
              </h2>
              <div className="form-control mb-2">
                <label className="label"><span className="label-text text-xs">Date de début</span></label>
                <input
                  type="date"
                  className="input input-bordered input-sm"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setPreview(null); setPurgeResults(null); }}
                />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text text-xs">Date de fin</span></label>
                <input
                  type="date"
                  className="input input-bordered input-sm"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPreview(null); setPurgeResults(null); }}
                />
              </div>
              {!dateFrom && !dateTo && (
                <p className="text-xs text-warning mt-2">⚠️ Sans date, TOUTES les données seront concernées</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body gap-3">
              <h2 className="card-title text-lg">Actions</h2>

              <button
                className="btn btn-primary btn-sm w-full gap-2"
                onClick={handlePreview}
                disabled={loading || selectedTables.size === 0}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                Prévisualiser
              </button>

              <button
                className="btn btn-info btn-sm btn-outline w-full gap-2"
                onClick={handleExport}
                disabled={exporting || selectedTables.size === 0}
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Exporter CSV (backup)
              </button>

              <div className="divider my-0"></div>

              <button
                className="btn btn-error btn-sm w-full gap-2"
                onClick={() => { if (selectedTables.size > 0) setShowConfirmModal(true); else toast.error('Sélectionnez des tables'); }}
                disabled={selectedTables.size === 0}
              >
                <Trash2 className="w-4 h-4" />
                Purger les données
              </button>
            </div>
          </div>

          {/* Selection Summary */}
          <div className="card bg-base-200/50">
            <div className="card-body py-3">
              <p className="text-sm">
                <span className="font-bold text-primary">{selectedTables.size}</span> table{selectedTables.size !== 1 ? 's' : ''} sélectionnée{selectedTables.size !== 1 ? 's' : ''}
              </p>
              {dateFrom && <p className="text-xs text-base-content/60">Du: {dateFrom}</p>}
              {dateTo && <p className="text-xs text-base-content/60">Au: {dateTo}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Results */}
      {preview && (
        <div className="card bg-base-100 shadow-xl mt-6">
          <div className="card-body">
            <h2 className="card-title text-lg mb-4">
              <Eye className="w-5 h-5 text-info" />
              Prévisualisation — <span className="text-error">{totalPreviewCount.toLocaleString()}</span> lignes à supprimer
            </h2>
            <div className="overflow-x-auto">
              <table className="table table-sm table-zebra">
                <thead>
                  <tr>
                    <th>Table</th>
                    <th className="text-right">Lignes</th>
                    <th>Sous-tables</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map(p => (
                    <tr key={p.key}>
                      <td className="font-medium">{p.label}</td>
                      <td className="text-right">
                        <span className={`badge ${p.count > 0 ? 'badge-error' : 'badge-ghost'} badge-sm`}>
                          {p.count.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        {p.children.length > 0 ? (
                          <div className="flex gap-2 flex-wrap">
                            {p.children.map((c, i) => (
                              <span key={i} className="badge badge-sm badge-outline">
                                {c.label}: {c.count.toLocaleString()}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-base-content/30 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Purge Results */}
      {purgeResults && (
        <div className="card bg-success/10 border border-success/30 shadow-xl mt-6">
          <div className="card-body">
            <h2 className="card-title text-lg text-success mb-4">
              <Trash2 className="w-5 h-5" />
              Purge terminée
            </h2>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Table</th>
                    <th className="text-right">Lignes supprimées</th>
                  </tr>
                </thead>
                <tbody>
                  {purgeResults.map(r => (
                    <tr key={r.key}>
                      <td>{r.label}</td>
                      <td className="text-right font-bold text-success">{r.deleted.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-error/20">
                <ShieldAlert className="w-6 h-6 text-error" />
              </div>
              <h3 className="font-bold text-lg">Confirmation de purge</h3>
            </div>

            <div className="alert alert-error mb-4">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm">
                Cette action va <strong>supprimer définitivement</strong> les données sélectionnées.
                Pensez à exporter une sauvegarde CSV avant de continuer.
              </span>
            </div>

            <div className="bg-base-200 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
              <p className="text-xs font-semibold mb-1">Tables concernées :</p>
              <ul className="text-xs space-y-0.5">
                {Array.from(selectedTables).map(key => {
                  const t = tableMap.get(key);
                  return <li key={key}>• {t?.label || key}</li>;
                })}
              </ul>
              {(dateFrom || dateTo) && (
                <p className="text-xs mt-2 text-base-content/60">
                  Période : {dateFrom || '...'} → {dateTo || '...'}
                </p>
              )}
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text text-sm font-semibold">Mot de passe superadmin</span>
              </label>
              <input
                type="password"
                className="input input-bordered"
                placeholder="Saisissez votre mot de passe"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handlePurge(); }}
                autoFocus
              />
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setShowConfirmModal(false); setPassword(''); }}>
                Annuler
              </button>
              <button
                className="btn btn-error gap-2"
                onClick={handlePurge}
                disabled={purging || !password}
              >
                {purging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Confirmer la purge
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => { setShowConfirmModal(false); setPassword(''); }}></div>
        </div>
      )}
    </div>
  );
}
