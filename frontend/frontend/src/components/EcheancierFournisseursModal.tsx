import { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import PremiumModal from './common/PremiumModal';
import { formatCurrency } from '../utils/formatters';

interface Echeance {
  fournisseur_id: number;
  fournisseur_nom: string;
  type_reglement: 'FACTURE' | 'RELEVE';
  commande_id: number | null;
  numero_facture: string;
  montant_du: number;
  date_echeance: string;
  jours_restants: number;
  status: 'EN RETARD' | "AUJOURD'HUI" | 'À VENIR';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRegler: (fournisseurId: number) => void;
  onPointer?: (fournisseurId: number, fournisseurNom: string) => void;
}

export default function EcheancierFournisseursModal({ isOpen, onClose, onRegler, onPointer }: Props) {
  const { t } = useTranslation(['providers', 'common']);
  const [echeances, setEcheances] = useState<Echeance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TOUS');

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

  useEffect(() => {
    if (isOpen) {
      fetchEcheances();
      setSearchTerm('');
      setStatusFilter('TOUS');
    }
  }, [isOpen]);

  async function fetchEcheances() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${apiBaseUrl}/api/fournisseurs/echeancier/`);
      setEcheances(data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  const filteredEcheances = echeances.filter(e => {
    const matchSearch = e.fournisseur_nom.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        e.numero_facture.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'TOUS' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('providers:schedule.title')}
      subtitle={t('providers:schedule.subtitle')}
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      }
      maxWidth="max-w-5xl"
    >
      <div className="p-6 flex flex-col" style={{ maxHeight: '80vh' }}>
        {error && (
          <div className="alert alert-error mb-4 shrink-0">
            <span>{error}</span>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4 mb-4 shrink-0">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input 
              type="text" 
              placeholder={t('providers:schedule.search_placeholder')} 
              className="input input-sm input-bordered w-full pl-9"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="select select-sm select-bordered w-48 font-medium"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="TOUS">{t('providers:schedule.status_all')}</option>
            <option value="EN RETARD">{t('providers:schedule.status_late')}</option>
            <option value="AUJOURD'HUI">{t('providers:schedule.status_today')}</option>
            <option value="À VENIR">{t('providers:schedule.status_upcoming')}</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center flex-1 items-center p-10">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : filteredEcheances.length === 0 ? (
          <div className="text-center flex-1 flex flex-col justify-center p-10 bg-base-200/50 rounded-xl border border-slate-100">
            <div className="text-4xl mb-4 opacity-50">✅</div>
            <h3 className="text-lg font-bold text-base-content/90">{t('providers:schedule.empty')}</h3>
            <p className="text-sm text-base-content/60">{t('providers:schedule.empty_subtitle')}</p>
          </div>
        ) : (
          <div className="overflow-auto rounded-xl border border-base-200 shadow-sm flex-1">
            <table className="table table-sm w-full table-pin-rows">
              <thead className="bg-[#f8fafc] text-[#64748b]">
                <tr>
                  <th className="font-semibold uppercase text-[10px] tracking-wider py-3">{t('providers:schedule.table.provider')}</th>
                  <th className="font-semibold uppercase text-[10px] tracking-wider py-3">{t('providers:schedule.table.ref_type')}</th>
                  <th className="font-semibold uppercase text-[10px] tracking-wider text-right py-3">{t('providers:schedule.table.amount')}</th>
                  <th className="font-semibold uppercase text-[10px] tracking-wider text-center py-3">{t('providers:schedule.table.due_date')}</th>
                  <th className="font-semibold uppercase text-[10px] tracking-wider text-center py-3">{t('providers:schedule.table.status')}</th>
                  <th className="font-semibold uppercase text-[10px] tracking-wider text-center py-3">{t('providers:schedule.table.action')}</th>
                </tr>
              </thead>
              <tbody className="bg-base-100">
                {filteredEcheances.map((e) => (
                  <tr key={`${e.fournisseur_id}-${e.commande_id || 'releve'}`} className="hover:bg-base-200/50 transition-colors border-b border-slate-100 last:border-0">
                    <td className="py-3">
                      <div className="font-bold text-base-content">{e.fournisseur_nom}</div>
                    </td>
                    <td className="py-3">
                        <div className="font-mono text-xs text-base-content/80 font-medium bg-base-200 px-2 py-0.5 rounded inline-block">
                          {e.numero_facture}
                        </div>
                        <div className="text-[10px] text-base-content/40 mt-0.5 uppercase tracking-wide">
                          {e.type_reglement === 'RELEVE' ? t('providers:schedule.type_statement') : t('providers:schedule.type_invoice')}
                        </div>
                    </td>
                    <td className="py-3 text-right">
                      <div className={`font-black tracking-tight ${e.status === 'EN RETARD' ? 'text-red-600' : 'text-base-content/90'}`}>
                        {formatCurrency(e.montant_du)}
                      </div>
                    </td>
                    <td className="py-3 text-center">
                      <div className="font-semibold text-sm text-base-content/90">
                        {new Date(e.date_echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        e.status === 'EN RETARD' ? 'bg-red-100 text-red-700' :
                        e.status === "AUJOURD'HUI" ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {e.status}
                        {e.jours_restants < 0 ? ` (${Math.abs(e.jours_restants)}j)` : e.jours_restants > 0 ? ` (dans ${e.jours_restants}j)` : ''}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                       <button 
                         className="btn btn-xs btn-primary btn-outline rounded-full px-4 hover:shadow-md transition-all gap-1 mr-2"
                         onClick={() => onRegler(e.fournisseur_id)}
                       >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                         </svg>
                         {t('providers:schedule.table.pay_btn')}
                       </button>
                       <button 
                         className="btn btn-xs btn-neutral btn-outline rounded-full px-3 hover:shadow-md transition-all gap-1"
                         onClick={() => onPointer && onPointer(e.fournisseur_id, e.fournisseur_nom)}
                         title={t('providers:schedule.table.pointage_btn')}
                       >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                         </svg>
                         {t('providers:schedule.table.pointage_btn')}
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PremiumModal>
  );
}
