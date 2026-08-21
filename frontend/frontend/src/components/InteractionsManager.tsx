import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import api from '../services/api';
import { Button } from './shadcn/button';
import { Badge } from './ui/Badge';
import { useConfirm } from '../hooks/useConfirm';
import { getApiErrorDetail } from '../utils/errorHandling';
import type { Substance } from '../hooks/useSubstances';
import { logger } from '../utils/logger'

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

const GRAVITY_COLORS: Record<string, 'error' | 'warning' | 'primary' | 'ghost'> = {
  CONTRE_INDIQUE: 'error',
  DECONSEILLE: 'warning',
  A_PRENDRE_EN_COMPTE: 'primary',
  PRECAUTION: 'ghost',
};

const GRAVITY_LABELS: Record<string, string> = {
  CONTRE_INDIQUE: 'Contre-indiqué',
  DECONSEILLE: 'Déconseillé',
  A_PRENDRE_EN_COMPTE: 'À prendre en compte',
  PRECAUTION: 'Précaution',
};

export default function InteractionsManager() {
  const { t } = useTranslation(['products', 'common']);
  const confirm = useConfirm();
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
      .catch(logger.error)
      .finally(() => setLoading(false));
  }, [page, search, gravityFilter]);

  const fetchStats = useCallback(() => {
    api.get('interactions/stats/')
      .then(r => setStats(r.data))
      .catch(logger.error);
  }, []);

  useEffect(() => {
    api.get('substances/?page_size=9999')
      .then(r => setSubstances(r.data.results || []))
      .catch(logger.error);
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
        gooeyToast.success(t('common:messages.success_save'));
      })
      .catch(err => {
        logger.error(err);
        gooeyToast.error(getApiErrorDetail(err, t('common:messages.error_saving')));
      })
      .finally(() => setSaving(false));
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: t('common:confirmation', { defaultValue: 'Confirmer la suppression' }),
      message: t('common:messages.confirm_delete', { defaultValue: 'Voulez-vous vraiment supprimer cette interaction ?' }),
      confirmText: t('common:delete', { defaultValue: 'Supprimer' }),
      cancelText: t('common:cancel', { defaultValue: 'Annuler' }),
    });
    if (!confirmed) return;
    api.delete(`interactions/${id}/`)
      .then(() => {
        fetchInteractions();
        fetchStats();
        gooeyToast.success(t('common:messages.success_delete'));
      })
      .catch(err => {
        logger.error(err);
        gooeyToast.error(getApiErrorDetail(err, t('common:messages.error_deleting')));
      });
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
        gooeyToast.success(t('common:messages.import_success'));
      })
      .catch(err => {
        logger.error(err);
        gooeyToast.error(getApiErrorDetail(err, t('common:messages.error_saving')));
      })
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
            placeholder={t('products:interactions.search_placeholder')}
            className="w-64 rounded-xl bg-base-200/50 border-none h-9 text-xs px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <select
            className="rounded-xl bg-base-200/50 border-none h-9 text-xs px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            value={gravityFilter}
            onChange={e => { setGravityFilter(e.target.value); setPage(1); }}
          >
            <option value="">{t('products:interactions.gravity_all')}</option>
            <option value="CONTRE_INDIQUE">{t('products:interactions.gravity_contre_indique')}</option>
            <option value="DECONSEILLE">{t('products:interactions.gravity_deconseille')}</option>
            <option value="A_PRENDRE_EN_COMPTE">{t('products:interactions.gravity_a_prendre_en_compte')}</option>
            <option value="PRECAUTION">{t('products:interactions.gravity_precaution')}</option>
          </select>
        </div>
        <Button variant="default" size="sm" className="rounded-xl" onClick={openAddModal}>
          {t('products:interactions.add')}
        </Button>
      </div>

      {/* CSV Upload */}
      <div className="bg-base-100 rounded-2xl border border-base-200 p-4">
        <h3 className="font-bold text-sm mb-2">{t('products:interactions.csv_import')}</h3>
        <p className="text-xs text-base-content/50 mb-3">
          {t('products:interactions.csv_format')}
        </p>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".csv"
            onChange={e => { setCsvFile(e.target.files?.[0] || null); setUploadResult(null); }}
            className="file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-base-300 file:text-base-content hover:file:bg-base-200 text-sm w-full max-w-xs rounded-xl border border-base-300 bg-base-200/50 px-3 py-1.5"
          />
          <Button
            variant="secondary" size="sm" className="rounded-xl"
            disabled={!csvFile || uploading}
            onClick={handleCsvUpload}
          >
            {uploading ? <Loader2 className="size-3 animate-spin" /> : t('products:interactions.import_btn')}
          </Button>
        </div>
        {uploadResult && (
          <div className="mt-2 text-sm">
            <span className="text-success font-medium">{uploadResult.created} {t('products:interactions.created')}</span>
            {uploadResult.updated > 0 && <span className="text-info">, {uploadResult.updated} {t('products:interactions.updated')}</span>}
            {uploadResult.skipped > 0 && <span className="text-warning">, {uploadResult.skipped} {t('products:interactions.skipped')}</span>}
            {uploadResult.errors.length > 0 && (
              <div className="mt-1 text-error text-xs">
                {uploadResult.errors.map((e) => <div key={`err-${e}`}>{e}</div>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-base-100 rounded-2xl border border-base-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="border-b border-base-200 bg-base-200/30">
                <th className="w-[20%] px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('products:interactions.col_substance_a')}</th>
                <th className="w-[20%] px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('products:interactions.col_substance_b')}</th>
                <th className="w-28 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('products:interactions.col_gravity')}</th>
                <th className="px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('products:interactions.col_description')}</th>
                <th className="w-24 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-12 text-center"><Loader2 className="size-5 animate-spin" /></td></tr>
              ) : interactions.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-12 text-center opacity-40 font-medium">{t('products:interactions.none_found')}</td></tr>
              ) : (
                interactions.map(inter => (
                  <tr key={inter.id} className="border-b border-base-200 hover:bg-base-200/30 transition-colors">
                    <td className="px-3 py-2 font-bold text-sm">{inter.substance_a_nom}</td>
                    <td className="px-3 py-2 font-bold text-sm">{inter.substance_b_nom}</td>
                    <td className="px-3 py-2">
                      <Badge variant={GRAVITY_COLORS[inter.gravity] || 'ghost'} size="sm">
                        {GRAVITY_LABELS[inter.gravity] || inter.gravity}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-base-content/70 max-w-md truncate" title={inter.description}>{inter.description}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => openEditModal(inter)}>{t('products:interactions.edit')}</Button>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-red-500" onClick={() => handleDelete(inter.id)}>{t('products:interactions.delete')}</Button>
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
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('products:interactions.previous')}</Button>
            <span className="text-sm py-1 opacity-60 font-medium">Page {page} / {totalPages}</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t('products:interactions.next')}</Button>
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
                  className="w-full rounded-xl bg-base-200/50 border-none h-10 text-sm px-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all mt-1"
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
                  className="w-full rounded-xl bg-base-200/50 border-none h-10 text-sm px-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all mt-1"
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
                  className="w-full rounded-xl bg-base-200/50 border-none h-10 text-sm px-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all mt-1"
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
                  placeholder={t('products:interactions.risk_placeholder')}
                />
              </div>
              {formSubA && formSubB && formSubA === formSubB && (
                <div className="text-error text-sm font-medium">Les deux substances doivent être différentes.</div>
              )}
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <Button variant="ghost" className="rounded-xl" onClick={() => setShowModal(false)}>Annuler</Button>
              <Button
                variant="default" className="rounded-xl"
                disabled={saving || !formSubA || !formSubB || formSubA === formSubB}
                onClick={handleSave}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : (editingId ? 'Mettre à jour' : 'Créer')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
