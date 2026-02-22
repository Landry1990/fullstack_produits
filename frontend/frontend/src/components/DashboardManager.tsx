import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  useManagerStats, 
  useCurrentObjectifs
} from '../hooks/useDashboard';
import { toast } from 'react-hot-toast';
import axios from '../config/axios';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0
  }).format(amount).replace('XOF', 'F');
};

const ProgressBar = ({ rate, colorClass = 'progress-primary' }: { rate: number, colorClass?: string }) => {
  const displayRate = Math.min(rate, 100);
  return (
    <div className="w-full bg-base-200 rounded-full h-4 overflow-hidden shadow-inner border border-base-300">
      <div 
        className={`h-full transition-all duration-1000 ease-out fill-mode-forwards rounded-full ${colorClass}`}
        style={{ width: `${displayRate}%` }}
      />
    </div>
  );
};

export default function DashboardManager() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingObjectif, setEditingObjectif] = useState({
    periode: 'JOUR',
    ca_objectif: '',
    date_debut: new Date().toISOString().split('T')[0]
  });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useManagerStats();
  const { data: currentObj } = useCurrentObjectifs();
  const [exporting, setExporting] = useState(false);

  const handleExport = async (type: 'csv' | 'pdf' | 'dead_stock') => {
    setExporting(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const rapportsEndpoint = apiBaseUrl
        ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/rapports/`
        : '/api/rapports/';
      
      let url = '';
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastDay = now.toISOString();

      if (type === 'csv') {
        url = `${rapportsEndpoint}export_comptable_csv/?date_debut=${firstDay}&date_fin=${lastDay}`;
      } else if (type === 'pdf') {
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        url = `${rapportsEndpoint}rapport_mensuel_pdf/?mois=${year}-${month}`;
      } else if (type === 'dead_stock') {
        const url = `${rapportsEndpoint}stocks_morts/?min_value=100000&months=6`;
        const response = await axios.get(url);
        const data = response.data;

        if (Array.isArray(data) && data.length > 0) {
          const excelData = data.map(item => ({
            'Nom': item.name,
            'CIP': item.cip || '-',
            'Stock': item.stock,
            'Valeur': item.valeur,
            'PMP': item.pmp,
            'Dernière Vente': item.dernier_vente || 'Jamais vendu',
            'Rayon': item.rayon || '-',
            'Fournisseur': item.fournisseur || '-'
          }));

          const ws = XLSX.utils.json_to_sheet(excelData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Stocks Morts');
          
          const filename = `stocks_morts_${now.toISOString().split('T')[0]}.xlsx`;
          XLSX.writeFile(wb, filename);
          toast.success(t('common.export_success', 'Export réussi'));
        } else {
          toast("Aucun stock mort trouvé.");
        }
        return;
      }

      const response = await axios.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      const filename = type === 'csv' ? `export_comptable_${now.toISOString().split('T')[0]}.csv` :
                       `rapport_mensuel_${now.getMonth() + 1}.pdf`;
                       
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(t('common.export_success', 'Export réussi'));
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(t('common.export_error', 'Erreur lors de l\'export'));
    } finally {
      setExporting(false);
    }
  };

  const handleSaveObjectif = async () => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const endpoint = apiBaseUrl
        ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/objectifs-commerciaux/`
        : '/api/objectifs-commerciaux/';
      
      await axios.post(endpoint, editingObjectif);
      toast.success(t('manager_dashboard.messages.save_success'));
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['objectifs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'managerStats'] });
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('manager_dashboard.messages.save_error'));
    }
  };

  if (statsLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  const kpis = stats?.kpis || {
    jour: { actual: 0, target: 0, rate: 0 },
    semaine: { actual: 0, target: 0, rate: 0 },
    mois: { actual: 0, target: 0, rate: 0 }
  };

  return (
    <div className="p-6 space-y-8 animate-fade-in bg-base-200/30 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-base-100 p-6 rounded-2xl shadow-sm border border-base-300">
        <div>
          <h1 className="text-3xl font-extrabold text-base-content tracking-tight">
            {t('manager_dashboard.title', 'Tableau de Bord')} <span className="text-primary italic">{t('manager_dashboard.manager', 'Manager')}</span>
          </h1>
          <p className="text-base-content/60 font-medium">{t('manager_dashboard.subtitle', 'Suivi des performances et objectifs commerciaux')}</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary shadow-lg hover:shadow-primary/20 transition-all gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {t('manager_dashboard.set_objective', 'Fixer un Objectif')}
        </button>
      </div>

      {/* KPI Progression Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[
          { label: t('manager_dashboard.periods.today', 'Aujourd\'hui'), key: 'jour', color: 'progress-primary', icon: '📅', bg: 'bg-primary/5' },
          { label: t('manager_dashboard.periods.week', 'Semaine'), key: 'semaine', color: 'progress-secondary', icon: '📊', bg: 'bg-secondary/5' },
          { label: t('manager_dashboard.periods.month', 'Mois'), key: 'mois', color: 'progress-accent', icon: '🏗️', bg: 'bg-accent/5' }
        ].map((item) => (
          <div key={item.key} className={`card bg-base-100 shadow-xl border border-base-300 overflow-hidden transform hover:-translate-y-1 transition-all duration-300`}>
            <div className={`p-1 ${item.key === 'jour' ? 'bg-primary' : item.key === 'semaine' ? 'bg-secondary' : 'bg-accent'}`} />
            <div className="card-body p-6">
              <div className="flex justify-between items-center mb-6">
                <span className="text-4xl">{item.icon}</span>
                <span className={`badge ${item.key === 'jour' ? 'badge-primary' : item.key === 'semaine' ? 'badge-secondary' : 'badge-accent'} badge-lg font-bold p-4`}>
                  {Math.round(kpis[item.key as keyof typeof kpis].rate)}%
                </span>
              </div>
              <h2 className="text-lg font-bold text-base-content/70 uppercase tracking-widest mb-1">{item.label}</h2>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-black text-base-content">
                  {formatCurrency(kpis[item.key as keyof typeof kpis].actual)}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold uppercase tracking-tighter opacity-70">
                  <span>{t('manager_dashboard.progression', 'Progression')}</span>
                  <span>{t('manager_dashboard.target', 'Cible')}: {formatCurrency(kpis[item.key as keyof typeof kpis].target)}</span>
                </div>
                <ProgressBar 
                  rate={kpis[item.key as keyof typeof kpis].rate} 
                  colorClass={item.color} 
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Smart Alerts */}
        <div className="card bg-base-100 shadow-xl border border-base-300 h-full">
          <div className="card-body p-6">
            <h3 className="card-title text-xl font-bold mb-6 flex items-center gap-2">
              <span className="text-2xl">⚡</span> {t('manager_dashboard.alerts_title', 'Alertes Intelligentes')}
            </h3>
            <div className="space-y-4">
              {stats?.alerts && stats.alerts.length > 0 ? (
                stats.alerts.map((alert, idx) => (
                  <div 
                    key={idx} 
                    className={`alert ${
                      alert.type === 'danger' ? 'alert-error bg-red-50 border-red-200 text-red-800' : 
                      alert.type === 'warning' ? 'alert-warning bg-amber-50 border-amber-200 text-amber-800' : 
                      'alert-info'
                    } shadow-sm border rounded-xl p-4 flex items-start gap-4`}
                  >
                    <div className="text-2xl mt-1">
                      {alert.type === 'danger' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️'}
                    </div>
                    <div>
                      <h4 className="font-black text-sm uppercase tracking-tight">{t(alert.title_key)}</h4>
                      <p className="text-sm font-medium leading-tight opacity-90">{t(alert.message_key, alert.params)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-base-content/30 italic font-medium">
                  <div className="text-5xl mb-4 opacity-20">✅</div>
                  <p>{t('manager_dashboard.no_alerts', 'Aucune alerte pour le moment. Tout va bien !')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Current Objectives Overview */}
        <div className="card bg-base-100 shadow-xl border border-base-300 h-full">
          <div className="card-body p-6">
             <div className="flex justify-between items-center mb-6">
                <h3 className="card-title text-xl font-bold flex items-center gap-2">
                  <span className="text-2xl">🎯</span> {t('manager_dashboard.active_objectives', 'Objectifs Actifs')}
                </h3>
                <button 
                  onClick={() => refetchStats()} 
                  className="btn btn-ghost btn-sm btn-circle"
                  title={t('common.refresh')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
             </div>
             <div className="space-y-4">
                {[
                  { label: t('manager_dashboard.periods.daily', 'Journalier'), code: 'JOUR', color: 'text-primary' },
                  { label: t('manager_dashboard.periods.weekly', 'Hebdomadaire'), code: 'SEMAINE', color: 'text-secondary' },
                  { label: t('manager_dashboard.periods.monthly', 'Mensuel'), code: 'MOIS', color: 'text-accent' }
                ].map(p => {
                  const obj = currentObj ? (currentObj as any)[p.code.toLowerCase()] : null;
                  return (
                    <div key={p.code} className="flex items-center justify-between p-4 rounded-xl border border-base-200 hover:bg-base-200/20 transition-colors group">
                      <div>
                        <span className={`text-xs font-black uppercase tracking-widest ${p.color}`}>{p.label}</span>
                        <div className="font-bold text-base-content">
                          {obj ? formatCurrency(Number(obj.ca_objectif)) : t('manager_dashboard.not_defined', 'Non défini')}
                        </div>
                      </div>
                      <button 
                        className="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          setEditingObjectif({
                            periode: p.code,
                            ca_objectif: obj ? obj.ca_objectif : '',
                            date_debut: obj ? obj.date_debut : new Date().toISOString().split('T')[0]
                          });
                          setIsModalOpen(true);
                        }}
                      >
                        {t('manager_dashboard.modify', 'Modifier')}
                      </button>
                    </div>
                  );
                })}
             </div>
          </div>
        </div>
      </div>

      {/* Financial Exports Section */}
      <div className="card bg-base-100 shadow-xl border border-base-300">
        <div className="card-body p-6">
          <h3 className="card-title text-xl font-bold mb-6 flex items-center gap-2">
            <span className="text-2xl">📑</span> {t('manager_dashboard.exports_title', 'Rapports et Comptabilité')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 rounded-2xl bg-base-200/50 border border-base-300 hover:bg-base-200 transition-colors">
              <div className="text-sm font-black uppercase tracking-widest text-primary mb-2">{t('manager_dashboard.export_accounting_title', 'Export Comptable (CSV)')}</div>
              <p className="text-xs font-medium text-base-content/60 mb-4">{t('manager_dashboard.export_accounting_desc', 'Détail des ventes, TVA et modes de paiement pour votre comptable.')}</p>
              <button 
                onClick={() => handleExport('csv')}
                className="btn btn-primary btn-sm rounded-xl w-full gap-2"
                disabled={exporting}
              >
                {exporting ? <span className="loading loading-spinner loading-xs"></span> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>}
                {t('common.download', 'Télécharger')}
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-base-200/50 border border-base-300 hover:bg-base-200 transition-colors">
              <div className="text-sm font-black uppercase tracking-widest text-secondary mb-2">{t('manager_dashboard.report_monthly_title', 'Rapport Mensuel (PDF)')}</div>
              <p className="text-xs font-medium text-base-content/60 mb-4">{t('manager_dashboard.report_monthly_desc', 'Synthèse visuelle des performances du mois en cours.')}</p>
              <button 
                onClick={() => handleExport('pdf')}
                className="btn btn-secondary btn-sm rounded-xl w-full gap-2"
                disabled={exporting}
              >
                {exporting ? <span className="loading loading-spinner loading-xs"></span> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>}
                {t('common.download', 'Télécharger')}
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-base-200/50 border border-base-300 hover:bg-base-200 transition-colors">
              <div className="text-sm font-black uppercase tracking-widest text-accent mb-2">{t('manager_dashboard.dead_stock_title', 'Stocks Dormants (JSON)')}</div>
              <p className="text-xs font-medium text-base-content/60 mb-4">{t('manager_dashboard.dead_stock_desc', 'Liste des produits sans vente depuis plus de 6 mois.')}</p>
              <button 
                onClick={() => handleExport('dead_stock')}
                className="btn btn-accent btn-sm rounded-xl w-full gap-2"
                disabled={exporting}
              >
                {exporting ? <span className="loading loading-spinner loading-xs"></span> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>}
                {t('common.download', 'Télécharger')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Objective Modal */}
      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box rounded-3xl border border-base-300 shadow-2xl p-0 overflow-hidden">
            <div className="bg-primary p-6 text-primary-content">
               <h3 className="font-black text-2xl uppercase tracking-tight">{t('manager_dashboard.modal_title', 'Fixer un Objectif')}</h3>
               <p className="opacity-80 font-medium">{t('manager_dashboard.modal_subtitle', 'Définissez vos cibles de chiffre d\'affaires')}</p>
            </div>
            <div className="p-8 space-y-6">
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-bold text-xs uppercase tracking-widest">{t('manager_dashboard.period_label', 'Période')}</span>
                </label>
                <select 
                  className="select select-bordered select-lg rounded-2xl font-bold bg-base-200"
                  value={editingObjectif.periode}
                  onChange={(e) => setEditingObjectif({...editingObjectif, periode: e.target.value})}
                >
                  <option value="JOUR">{t('manager_dashboard.periods.daily', 'Journalier')}</option>
                  <option value="SEMAINE">{t('manager_dashboard.periods.weekly', 'Hebdomadaire')}</option>
                  <option value="MOIS">{t('manager_dashboard.periods.monthly', 'Mensuel')}</option>
                </select>
              </div>

              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-bold text-xs uppercase tracking-widest">{t('manager_dashboard.ca_target_label', 'Chiffre d\'Affaires Cible (F)')}</span>
                </label>
                <input 
                  type="number" 
                  placeholder="Ex: 500000" 
                  className="input input-bordered input-lg rounded-2xl font-black text-2xl bg-base-200"
                  value={editingObjectif.ca_objectif}
                  onChange={(e) => setEditingObjectif({...editingObjectif, ca_objectif: e.target.value})}
                />
              </div>

              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-bold text-xs uppercase tracking-widest">{t('manager_dashboard.start_date_label', 'Date de Début')}</span>
                </label>
                <input 
                  type="date" 
                  className="input input-bordered input-lg rounded-2xl font-bold bg-base-200"
                  value={editingObjectif.date_debut}
                  onChange={(e) => setEditingObjectif({...editingObjectif, date_debut: e.target.value})}
                />
                <label className="label">
                   <span className="label-text-alt opacity-60">{t('manager_dashboard.date_help', 'Lundi pour semaine, 1er du mois pour mensuel')}</span>
                </label>
              </div>

              <div className="modal-action flex gap-4 mt-8">
                <button onClick={() => setIsModalOpen(false)} className="btn btn-ghost flex-1 rounded-2xl font-bold">{t('common.cancel')}</button>
                <button onClick={handleSaveObjectif} className="btn btn-primary flex-1 rounded-2xl font-bold shadow-lg shadow-primary/20">{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
