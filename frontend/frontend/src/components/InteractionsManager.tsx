import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import type { Substance } from '../hooks/useSubstances';

interface Interaction {
  id: number;
  substance_a: number;
  substance_b: number;
  substance_a_nom: string;
  substance_b_nom: string;
  gravity: 'PRECAUTION' | 'A_PRENDRE_EN_COMPTE' | 'DECONSEILLE' | 'CONTRE_INDIQUE';
  gravity_display: string;
  description: string;
}

interface InteractionStats {
  total: number;
  by_gravity: Record<string, number>;
  substances_with_interactions: number;
  total_substances: number;
}

const GRAVITY_COLORS: Record<string, string> = {
  CONTRE_INDIQUE: 'badge-error',
  DECONSEILLE: 'badge-warning',
  A_PRENDRE_EN_COMPTE: 'badge-info',
  PRECAUTION: 'badge-ghost',
};

const GRAVITY_LABELS: Record<string, string> = {
  CONTRE_INDIQUE: 'Contre-indiqué',
  DECONSEILLE: 'Déconseillé',
  A_PRENDRE_EN_COMPTE: 'À prendre en compte',
  PRECAUTION: 'Précaution',
};

export default function InteractionsManager() {
  const { t } = useTranslation(['products', 'common']);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [stats, setStats] = useState<InteractionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gravityFilter, setGravityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [substances, setSubstances] = useState<Substance[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formSubA, setFormSubA] = useState<number | ''>('');
  const [formSubB, setFormSubB] = useState<number | ''>('');
  const [formGravity, setFormGravity] = useState<string>('PRECAUTION');
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // CSV upload
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);

  const pageSize = 50;

  const fetchInteractions = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = { page, page_size: pageSize };
    if (search) params.search = search;
    if (gravityFilter) params.gravity = gravityFilter;
    api.get('interactions/', { params })
      .then(r => {
        setInteractions(r.data.results || []);
        setTotalCount(r.data.count || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, search, gravityFilter]);

  const fetchStats = useCallback(() => {
    api.get('interactions/stats/')
      .then(r => setStats(r.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    api.get('substances/?page_size=9999')
      .then(r => setSubstances(r.data.results || []))
      .catch(console.error);
  }, []);

  useEffect(() => { fetchInteractions(); }, [fetchInteractions]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const openAddModal = () => {
    setEditingId(null);
    setFormSubA('');
    setFormSubB('');
    setFormGravity('PRECAUTION');
    setFormDescription('');
    setShowModal(true);
  };

  const openEditModal = (inter: Interaction) => {
    setEditingId(inter.id);
    setFormSubA(inter.substance_a);
    setFormSubB(inter.substance_b);
    setFormGravity(inter.gravity);
    setFormDescription(inter.description);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formSubA || !formSubB || formSubA === formSubB) return;
    setSaving(true);
    const payload = {
      substance_a: formSubA,
      substance_b: formSubB,
      gravity: formGravity,
      description: formDescription,
    };
    const req = editingId
      ? api.patch(`interactions/${editingId}/`, payload)
      : api.post('interactions/', payload);
    req
      .then(() => {
        setShowModal(false);
        fetchInteractions();
        fetchStats();
      })
      .catch(err => alert(err.response?.data?.detail || 'Erreur'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (id: number) => {
    if (!confirm('Supprimer cette interaction ?')) return;
    api.delete(`interactions/${id}/`)
      .then(() => { fetchInteractions(); fetchStats(); })
      .catch(err => alert(err.response?.data?.detail || 'Erreur'));
  };

  const handleCsvUpload = () => {
    if (!csvFile) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', csvFile);
    api.post('interactions/upload_csv/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
      .then(r => {
        setUploadResult(r.data);
        fetchInteractions();
        fetchStats();
      })
      .catch(err => alert(err.response?.data?.error || 'Erreur upload'))
      .finally(() => setUploading(false));
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Stats interactions */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl border border-base-200 bg-base-100">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">Total</div>
          <div className="text-2xl font-black">{stats?.total ?? '-'}</div>
        </div>
        {(['CONTRE_INDIQUE', 'DECONSEILLE', 'A_PRENDRE_EN_COMPTE', 'PRECAUTION'] as const).map(g => (
          <div key={g} className="p-4 rounded-2xl border border-base-200 bg-base-100">
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">{GRAVITY_LABELS[g]}</div>
            <div className="text-2xl font-black">{stats?.by_gravity?.[g] ?? 0}</div>
          </div>
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Rechercher une substance..."
            className="input input-bordered input-sm w-64 rounded-xl bg-base-200/50 border-none"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <select
            className="select select-bordered select-sm rounded-xl bg-base-200/50 border-none"
            value={gravityFilter}
            onChange={e => { setGravityFilter(e.target.value); setPage(1); }}
          >
            <option value="">Toutes gravités</option>
            <option value="CONTRE_INDIQUE">Contre-indiqué</option>
            <option value="DECONSEILLE">Déconseillé</option>
            <option value="A_PRENDRE_EN_COMPTE">À prendre en compte</option>
            <option value="PRECAUTION">Précaution</option>
          </select>
        </div>
        <button className="btn btn-primary btn-sm rounded-xl" onClick={openAddModal}>
          + Ajouter une interaction
        </button>
      </div>

      {/* CSV Upload */}
      <div className="bg-base-100 rounded-2xl border border-base-200 p-4">
        <h3 className="font-bold text-sm mb-2">Import CSV d'interactions</h3>
        <p className="text-xs text-base-content/50 mb-3">
          Format: substance_a,substance_b,gravity,description (gravity: PRECAUTION, A_PRENDRE_EN_COMPTE, DECONSEILLE, CONTRE_INDIQUE)
        </p>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".csv"
            onChange={e => { setCsvFile(e.target.files?.[0] || null); setUploadResult(null); }}
            className="file-input file-input-bordered file-input-sm w-full max-w-xs rounded-xl bg-base-200/50 border-none"
          />
          <button
            className="btn btn-secondary btn-sm rounded-xl"
            disabled={!csvFile || uploading}
            onClick={handleCsvUpload}
          >
            {uploading ? <span className="loading loading-spinner loading-xs" /> : 'Importer'}
          </button>
        </div>
        {uploadResult && (
          <div className="mt-2 text-sm">
            <span className="text-success font-medium">{uploadResult.created} créées</span>
            {uploadResult.updated > 0 && <span className="text-info">, {uploadResult.updated} mises à jour</span>}
            {uploadResult.skipped > 0 && <span className="text-warning">, {uploadResult.skipped} ignorées</span>}
            {uploadResult.errors.length > 0 && (
              <div className="mt-1 text-error text-xs">
                {uploadResult.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-base-100 rounded-2xl border border-base-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="border-b border-base-200 bg-base-200/30">
                <th className="text-xs uppercase tracking-wider opacity-50 font-bold">Substance A</th>
                <th className="text-xs uppercase tracking-wider opacity-50 font-bold">Substance B</th>
                <th className="text-xs uppercase tracking-wider opacity-50 font-bold">Gravité</th>
                <th className="text-xs uppercase tracking-wider opacity-50 font-bold">Description</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12"><span className="loading loading-spinner loading-md" /></td></tr>
              ) : interactions.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 opacity-40 font-medium">Aucune interaction trouvée</td></tr>
              ) : (
                interactions.map(inter => (
                  <tr key={inter.id} className="border-b border-base-200 hover:bg-base-200/30 transition-colors">
                    <td className="font-bold text-sm">{inter.substance_a_nom}</td>
                    <td className="font-bold text-sm">{inter.substance_b_nom}</td>
                    <td>
                      <span className={`badge badge-sm ${GRAVITY_COLORS[inter.gravity] || 'badge-ghost'}`}>
                        {GRAVITY_LABELS[inter.gravity] || inter.gravity}
                      </span>
                    </td>
                    <td className="text-xs text-base-content/70 max-w-md truncate" title={inter.description}>{inter.description}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-xs" onClick={() => openEditModal(inter)}>Éditer</button>
                        <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(inter.id)}>Suppr.</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t border-base-200">
            <button className="btn btn-xs btn-ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Précédent</button>
            <span className="text-sm py-1 opacity-60 font-medium">Page {page} / {totalPages}</span>
            <button className="btn btn-xs btn-ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Suivant</button>
          </div>
        )}
      </div>

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-base-100 rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editingId ? 'Modifier l\'interaction' : 'Nouvelle interaction'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider opacity-50">Substance A</label>
                <select
                  className="select select-bordered w-full rounded-xl bg-base-200/50 border-none mt-1"
                  value={formSubA}
                  onChange={e => setFormSubA(Number(e.target.value))}
                >
                  <option value="">Choisir...</option>
                  {substances.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider opacity-50">Substance B</label>
                <select
                  className="select select-bordered w-full rounded-xl bg-base-200/50 border-none mt-1"
                  value={formSubB}
                  onChange={e => setFormSubB(Number(e.target.value))}
                >
                  <option value="">Choisir...</option>
                  {substances.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider opacity-50">Gravité</label>
                <select
                  className="select select-bordered w-full rounded-xl bg-base-200/50 border-none mt-1"
                  value={formGravity}
                  onChange={e => setFormGravity(e.target.value)}
                >
                  <option value="PRECAUTION">Précaution d'emploi</option>
                  <option value="A_PRENDRE_EN_COMPTE">À prendre en compte</option>
                  <option value="DECONSEILLE">Déconseillé</option>
                  <option value="CONTRE_INDIQUE">Contre-indiqué</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider opacity-50">Description / Conduite à tenir</label>
                <textarea
                  className="textarea textarea-bordered w-full rounded-xl bg-base-200/50 border-none mt-1"
                  rows={3}
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Décrire le risque et la conduite à tenir..."
                />
              </div>
              {formSubA && formSubB && formSubA === formSubB && (
                <div className="text-error text-sm font-medium">Les deux substances doivent être différentes.</div>
              )}
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button className="btn btn-ghost rounded-xl" onClick={() => setShowModal(false)}>Annuler</button>
              <button
                className="btn btn-primary rounded-xl"
                disabled={saving || !formSubA || !formSubB || formSubA === formSubB}
                onClick={handleSave}
              >
                {saving ? <span className="loading loading-spinner loading-sm" /> : (editingId ? 'Mettre à jour' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
