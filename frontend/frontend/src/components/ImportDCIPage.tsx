import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import type { Substance } from '../hooks/useSubstances';

interface StatsData {
  substances: number;
  medicament_references: number;
  total_produits: number;
  linked_produits: number;
  unlinked_produits: number;
  link_rate: number;
}

interface UnlinkedProduct {
  id: number;
  name: string;
  cip1: string;
  stock: number;
  selling_price: number;
  suggestion: { id: number; nom: string } | null;
}

interface UnlinkedResponse {
  results: UnlinkedProduct[];
  count: number;
  page: number;
  page_size: number;
}

export default function ImportDCIPage() {
  const { t } = useTranslation(['products', 'common']);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Upload
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{created: number; skipped: number} | null>(null);

  // Auto-match
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<any>(null);

  // Unlinked products
  const [unlinkedData, setUnlinkedData] = useState<UnlinkedResponse | null>(null);
  const [unlinkedPage, setUnlinkedPage] = useState(1);
  const [unlinkedSearch, setUnlinkedSearch] = useState('');
  const [loadingUnlinked, setLoadingUnlinked] = useState(false);
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [substances, setSubstances] = useState<Substance[]>([]);

  const fetchStats = useCallback(() => {
    setLoadingStats(true);
    api.get('dci-admin/stats/')
      .then(r => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoadingStats(false));
  }, []);

  const fetchUnlinked = useCallback(() => {
    setLoadingUnlinked(true);
    api.get('dci-admin/unlinked/', {
      params: { page: unlinkedPage, page_size: 50, search: unlinkedSearch },
    })
      .then(r => setUnlinkedData(r.data))
      .catch(console.error)
      .finally(() => setLoadingUnlinked(false));
  }, [unlinkedPage, unlinkedSearch]);

  useEffect(() => {
    fetchStats();
    api.get('substances/?page_size=500')
      .then(r => setSubstances(r.data.results || []))
      .catch(console.error);
  }, [fetchStats]);

  useEffect(() => {
    fetchUnlinked();
  }, [fetchUnlinked]);

  const handleUpload = () => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    api.post('dci-admin/upload_compo/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
      .then(r => {
        setUploadResult(r.data);
        fetchStats();
      })
      .catch(err => alert(err.response?.data?.error || 'Erreur upload'))
      .finally(() => setUploading(false));
  };

  const handleAutoMatch = () => {
    setMatching(true);
    api.post('dci-admin/auto_match/')
      .then(r => {
        setMatchResult(r.data);
        fetchStats();
        fetchUnlinked();
      })
      .catch(err => alert(err.response?.data?.error || 'Erreur matching'))
      .finally(() => setMatching(false));
  };

  const handleManualLink = (produitId: number, substanceId: number | null) => {
    if (!substanceId) return;
    setLinkingId(produitId);
    api.post('dci-admin/manual_link/', {
      produit_id: produitId,
      substance_ids: [substanceId],
      dci_reference_id: substanceId,
    })
      .then(() => {
        fetchUnlinked();
        fetchStats();
      })
      .catch(err => alert(err.response?.data?.error || 'Erreur liaison'))
      .finally(() => setLinkingId(null));
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header — épuré comme CatalogueDCI */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t('products:dci_admin.title', 'Gestion DCI & Matching')}</h1>
          <p className="text-sm text-base-content/50 mt-1 font-medium">{t('products:dci_admin.subtitle', 'Import de substances et liaison automatique avec la base ANSM')}</p>
        </div>
        <button onClick={fetchStats} className="btn btn-ghost btn-sm opacity-60 hover:opacity-100">
          {t('common:refresh', 'Actualiser')}
        </button>
      </div>

      {/* Stats — blocs légers sans ombre, bordure subtile */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label={t('products:dci_admin.substances', 'Substances')}
          value={stats?.substances ?? '-'}
          loading={loadingStats}
          icon={<FlaskIcon />}
        />
        <StatCard
          label={t('products:dci_admin.medicament_refs', 'Références ANSM')}
          value={stats?.medicament_references ?? '-'}
          loading={loadingStats}
          icon={<BookIcon />}
        />
        <StatCard
          label={t('products:dci_admin.linked', 'Produits liés')}
          value={stats ? `${stats.linked_produits} / ${stats.total_produits}` : '-'}
          loading={loadingStats}
          icon={<LinkIcon />}
          sub={`${stats?.link_rate ?? 0}%`}
        />
        <StatCard
          label={t('products:dci_admin.unlinked', 'Non liés')}
          value={stats?.unlinked_produits ?? '-'}
          loading={loadingStats}
          icon={<UnlinkIcon />}
          accent="error"
        />
      </div>

      {/* Actions — simples blocs rounded-3xl, pas de card DaisyUI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload COMPO.txt */}
        <div className="bg-base-100 rounded-3xl border border-base-200 p-6">
          <h2 className="font-bold text-lg flex items-center gap-2 mb-1">
            <UploadIcon />
            {t('products:dci_admin.import_compo', 'Importer COMPO.txt')}
          </h2>
          <p className="text-sm text-base-content/50 mb-4">{t('products:dci_admin.import_desc', 'Fichier ANSM contenant la liste des substances actives')}</p>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".txt"
              onChange={e => { setFile(e.target.files?.[0] || null); setUploadResult(null); }}
              className="file-input file-input-bordered w-full rounded-xl bg-base-200/50 border-none"
            />
            <button
              className="btn btn-primary rounded-2xl"
              disabled={!file || uploading}
              onClick={handleUpload}
            >
              {uploading ? <span className="loading loading-spinner loading-sm" /> : t('common:upload', 'Envoyer')}
            </button>
          </div>
          {uploadResult && (
            <div className="mt-3 text-sm font-medium text-success">
              {uploadResult.created} substances créées, {uploadResult.skipped} existantes ignorées.
            </div>
          )}
        </div>

        {/* Auto Match */}
        <div className="bg-base-100 rounded-3xl border border-base-200 p-6">
          <h2 className="font-bold text-lg flex items-center gap-2 mb-1">
            <MagicIcon />
            {t('products:dci_admin.auto_match', 'Matcher automatique')}
          </h2>
          <p className="text-sm text-base-content/50 mb-4">{t('products:dci_admin.match_desc', 'Analyse tous les produits et tente de les lier aux substances par nom')}</p>
          <button
            className="btn btn-secondary rounded-2xl w-full"
            disabled={matching}
            onClick={handleAutoMatch}
          >
            {matching ? (
              <><span className="loading loading-spinner loading-sm" /> {t('products:dci_admin.matching', 'Analyse en cours...')}</>
            ) : (
              <>{t('products:dci_admin.run_match', 'Lancer le matching')}</>
            )}
          </button>
          {matchResult && (
            <div className={`mt-3 text-sm font-medium ${matchResult.newly_linked > 0 ? 'text-success' : 'text-warning'}`}>
              {matchResult.newly_linked} nouveaux liens créés. Total liés : {matchResult.total_linked} / {matchResult.total_produits} ({matchResult.link_rate}%)
            </div>
          )}
        </div>
      </div>

      {/* Unlinked Products — table épurée, pas de zebra, pas de card */}
      <div className="bg-base-100 rounded-3xl border border-base-200 overflow-hidden">
        <div className="p-6 border-b border-base-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <BoxIcon />
            {t('products:dci_admin.unlinked_products', 'Produits non liés')}
            <span className="badge badge-sm bg-base-200 text-base-content font-bold">{unlinkedData?.count ?? 0}</span>
          </h2>
          <div className="relative">
            <input
              type="text"
              placeholder={t('products:dci_admin.search_product', 'Rechercher un produit...')}
              className="input input-bordered input-sm w-full md:w-64 rounded-xl bg-base-200/50 border-none"
              value={unlinkedSearch}
              onChange={e => { setUnlinkedSearch(e.target.value); setUnlinkedPage(1); }}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="border-b border-base-200 bg-base-200/30">
                <th className="text-xs uppercase tracking-wider text-base-content/50 font-bold">{t('products:produit', 'Produit')}</th>
                <th className="text-xs uppercase tracking-wider text-base-content/50 font-bold">CIP</th>
                <th className="text-xs uppercase tracking-wider text-base-content/50 font-bold">Stock</th>
                <th className="text-xs uppercase tracking-wider text-base-content/50 font-bold">Prix</th>
                <th className="text-xs uppercase tracking-wider text-base-content/50 font-bold">{t('products:dci_admin.suggestion', 'Suggestion')}</th>
                <th className="text-xs uppercase tracking-wider text-base-content/50 font-bold">{t('products:dci_admin.manual_link', 'Liaison manuelle')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loadingUnlinked ? (
                <tr><td colSpan={7} className="text-center py-12"><span className="loading loading-spinner loading-md" /></td></tr>
              ) : unlinkedData?.results.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 opacity-40 font-medium">{t('products:dci_admin.all_linked', 'Tous les produits sont liés !')}</td></tr>
              ) : (
                unlinkedData?.results.map(p => (
                  <tr key={p.id} className="border-b border-base-200 hover:bg-base-200/30 transition-colors">
                    <td className="font-bold text-sm">{p.name}</td>
                    <td className="font-mono text-xs text-base-content/50">{p.cip1 || '-'}</td>
                    <td className="text-sm text-base-content/70">{p.stock}</td>
                    <td className="font-mono text-sm font-bold text-primary">{p.selling_price} F</td>
                    <td>
                      {p.suggestion ? (
                        <span className="badge badge-sm bg-primary/10 text-primary border-none cursor-pointer hover:bg-primary/20 transition-colors"
                          onClick={() => handleManualLink(p.id, p.suggestion!.id)}>
                          {p.suggestion.nom}
                        </span>
                      ) : (
                        <span className="text-base-content/30 text-xs">-</span>
                      )}
                    </td>
                    <td>
                      <select
                        className="select select-bordered select-xs w-full max-w-[200px] rounded-xl bg-base-200/50 border-none"
                        value=""
                        onChange={e => {
                          const val = parseInt(e.target.value);
                          if (val) handleManualLink(p.id, val);
                          e.target.value = '';
                        }}
                      >
                        <option value="">{t('products:dci_admin.choose_dci', 'Choisir DCI...')}</option>
                        {substances.map(s => (
                          <option key={s.id} value={s.id}>{s.nom}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {linkingId === p.id && <span className="loading loading-spinner loading-xs text-primary" />}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {unlinkedData && unlinkedData.count > unlinkedData.page_size && (
          <div className="flex justify-center gap-2 p-4 border-t border-base-200">
            <button
              className="btn btn-xs btn-ghost"
              disabled={unlinkedPage <= 1}
              onClick={() => setUnlinkedPage(p => p - 1)}
            >Précédent</button>
            <span className="text-sm py-1 opacity-60 font-medium">Page {unlinkedPage} / {Math.ceil(unlinkedData.count / unlinkedData.page_size)}</span>
            <button
              className="btn btn-xs btn-ghost"
              disabled={unlinkedPage >= Math.ceil(unlinkedData.count / unlinkedData.page_size)}
              onClick={() => setUnlinkedPage(p => p + 1)}
            >Suivant</button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Icon Components ---
function StatCard({ label, value, loading, icon, sub, accent }: { label: string; value: string | number; loading: boolean; icon: React.ReactNode; sub?: string; accent?: string }) {
  const isError = accent === 'error';
  return (
    <div className={`p-5 rounded-2xl border transition-colors ${isError ? 'border-error/10 bg-error/[0.02]' : 'border-base-200 bg-base-100'}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className={isError ? 'text-error opacity-60' : 'text-primary opacity-60'}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{label}</span>
      </div>
      <div className="text-3xl font-black tracking-tight">
        {loading ? <span className="loading loading-spinner loading-md" /> : value}
      </div>
      {sub && <div className="text-xs font-bold text-success mt-1 opacity-80">{sub}</div>}
    </div>
  );
}

function FlaskIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.31"/><path d="M14 2v7.31"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M9.5 9.3a6.5 6.5 0 1 1-4 0"/></svg>;
}
function BookIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
}
function LinkIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
}
function UnlinkIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64A5 5 0 0 1 20.77 10a5 5 0 0 1-1.41 3.59l-3 3a5 5 0 0 1-3.58 1.41"/><path d="M13.41 10.59 16 8"/><path d="M10.59 13.41 8 16"/><path d="M6.64 18.36A5 5 0 0 1 4.23 15a5 5 0 0 1 1.41-3.59l3-3a5 5 0 0 1 3.58-1.41"/></svg>;
}
function UploadIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
}
function MagicIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/></svg>;
}
function BoxIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>;
}
