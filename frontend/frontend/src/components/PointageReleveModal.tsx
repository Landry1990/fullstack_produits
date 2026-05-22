import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import PremiumModal from './common/PremiumModal';
import { formatCurrency } from '../utils/formatters';
import { getLocale } from '../utils/dateUtils';

interface FactureReleve {
  id: number;
  numero_facture: string;
  date_cloture: string;
  montant: number;
}

interface ReleveResponse {
  fournisseur_id: number;
  fournisseur_nom: string;
  periode: { start_date: string; end_date: string };
  total_factures: number;
  montant_total_periode: number;
  factures: FactureReleve[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fournisseurs: { id: number; name: string }[];
  initialFournisseurId?: number;
  onReglerSelection: (fournisseurId: number, commandeIds: number[], montant: number) => void;
}

export default function PointageReleveModal({ isOpen, onClose, fournisseurs, onReglerSelection, initialFournisseurId }: Props) {
  const { t } = useTranslation(['providers', 'common']);
  const [data, setData] = useState<ReleveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fournisseur sélectionné
  const [selectedFournisseurId, setSelectedFournisseurId] = useState<number | ''>('');

  // Filtres
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12

  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(currentMonth);
  const [periodeType, setPeriodeType] = useState<string>('MENSUELLER'); // MENSUELLER, QUINZAINE_1, QUINZAINE_2, DECADE_1, DECADE_2, DECADE_3
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Pour le pointage visuel sans le stocker en DB (juste cocher en direct)
  const [pointedIds, setPointedIds] = useState<Set<number>>(new Set());

  const dateRange = useMemo(() => {
    if (periodeType === 'CUSTOM') {
      return { start: customStart, end: customEnd };
    }

    // Format YYYY-MM
    const yStr = year.toString();
    const mStr = month.toString().padStart(2, '0');

    // Last day of month
    const lastDay = new Date(year, month, 0).getDate();

    if (periodeType === 'MENSUELLER') {
      return { start: `${yStr}-${mStr}-01`, end: `${yStr}-${mStr}-${lastDay}` };
    }
    if (periodeType === 'QUINZAINE_1') {
      return { start: `${yStr}-${mStr}-01`, end: `${yStr}-${mStr}-15` };
    }
    if (periodeType === 'QUINZAINE_2') {
      return { start: `${yStr}-${mStr}-16`, end: `${yStr}-${mStr}-${lastDay}` };
    }
    if (periodeType === 'DECADE_1') {
      return { start: `${yStr}-${mStr}-01`, end: `${yStr}-${mStr}-10` };
    }
    if (periodeType === 'DECADE_2') {
      return { start: `${yStr}-${mStr}-11`, end: `${yStr}-${mStr}-20` };
    }
    if (periodeType === 'DECADE_3') {
      return { start: `${yStr}-${mStr}-21`, end: `${yStr}-${mStr}-${lastDay}` };
    }

    return { start: '', end: '' };
  }, [year, month, periodeType, customStart, customEnd]);

  // Main effect to handle modal opening and data fetching
  useEffect(() => {
    if (!isOpen) return;

    // If opening or provider changed, reset selection
    setPointedIds(new Set());

    // Handle initial provider if provided on open
    if (initialFournisseurId && !selectedFournisseurId) {
      setSelectedFournisseurId(initialFournisseurId);
      return; // selectedFournisseurId update will trigger next run
    }

    if (selectedFournisseurId && dateRange.start && dateRange.end) {
      if (periodeType === 'CUSTOM' && (!customStart || !customEnd)) {
        return;
      }
      fetchReleve(selectedFournisseurId, dateRange.start, dateRange.end);
    } else if (!selectedFournisseurId) {
      setData(null);
    }
  }, [isOpen, initialFournisseurId, selectedFournisseurId, dateRange, periodeType, customStart, customEnd]);

  async function fetchReleve(fId: number | string, start: string, end: string) {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`fournisseurs/${fId}/releve_factures/`, {
        params: {
          start_date: start,
          end_date: end
        }
      });
      setData(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || t('providers:pointage_modal.load_error'));
    } finally {
      setLoading(false);
    }
  }

  const togglePointage = (id: number) => {
    setPointedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!data) return;
    if (pointedIds.size === data.factures.length && data.factures.length > 0) {
      setPointedIds(new Set()); // Tout décocher
    } else {
      setPointedIds(new Set(data.factures.map(f => f.id))); // Tout cocher
    }
  };

  const pointageSum = useMemo(() => {
    if (!data) return 0;
    return data.factures.reduce((sum, f) => {
      if (pointedIds.has(f.id)) return sum + f.montant;
      return sum;
    }, 0);
  }, [data, pointedIds]);

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('providers:pointage_modal.title')}
      subtitle={t('providers:pointage_modal.subtitle')}
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      }
      maxWidth="max-w-5xl"
    >
      <div className="flex flex-col h-[75vh]">
        {/* En-tête / Filtres */}
        <div className="p-4 bg-base-200/50 border-b border-base-200 shrink-0">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div>
              <label className="block text-[10px] font-bold uppercase text-base-content/40 mb-1">{t('providers:pointage_modal.provider_label')}</label>
              <select 
                className="select select-sm select-bordered w-full md:w-48 font-bold text-base-content/90" 
                value={selectedFournisseurId} 
                onChange={e => setSelectedFournisseurId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">{t('providers:pointage_modal.choose_provider')}</option>
                {fournisseurs.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            {selectedFournisseurId && (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-base-content/40 mb-1">{t('providers:pointage_modal.month_label')}</label>
                  <select className="select select-sm select-bordered w-full md:w-32" value={month} onChange={e => setMonth(Number(e.target.value))} disabled={periodeType === 'CUSTOM'}>
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{new Date(0, m - 1).toLocaleString(getLocale(), { month: 'long' })}</option>
                    ))}
                  </select>
                </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-base-content/40 mb-1">{t('providers:pointage_modal.year_label')}</label>
              <select className="select select-sm select-bordered w-full md:w-24" value={year} onChange={e => setYear(Number(e.target.value))} disabled={periodeType === 'CUSTOM'}>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-base-content/40 mb-1">{t('providers:pointage_modal.target_period')}</label>
              <select className="select select-sm select-bordered w-full md:w-48" value={periodeType} onChange={e => setPeriodeType(e.target.value)}>
                <option value="MENSUELLER">{t('providers:pointage_modal.period_full')}</option>
                <optgroup label="Quinzaines">
                  <option value="QUINZAINE_1">{t('providers:pointage_modal.period_q1')}</option>
                  <option value="QUINZAINE_2">{t('providers:pointage_modal.period_q2')}</option>
                </optgroup>
                <optgroup label="Décades">
                  <option value="DECADE_1">{t('providers:pointage_modal.period_d1')}</option>
                  <option value="DECADE_2">{t('providers:pointage_modal.period_d2')}</option>
                  <option value="DECADE_3">{t('providers:pointage_modal.period_d3')}</option>
                </optgroup>
                <option value="CUSTOM">{t('providers:pointage_modal.period_custom')}</option>
              </select>
            </div>

            {periodeType === 'CUSTOM' && (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-base-content/40 mb-1">{t('providers:pointage_modal.start_label')}</label>
                  <input type="date" lang={getLocale()} className="input input-sm input-bordered" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-base-content/40 mb-1">{t('providers:pointage_modal.end_label')}</label>
                  <input type="date" lang={getLocale()} className="input input-sm input-bordered" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                </div>
              </>
            )}

              </>
            )}

            <div className="flex-1"></div>

            {data && (
               <div className="bg-base-100 px-4 py-2 rounded-lg border border-base-200 shadow-sm text-right">
                 <div className="text-[10px] font-bold uppercase text-base-content/40">{t('providers:pointage_modal.total_period')}</div>
                 <div className="text-lg font-black text-purple-600 font-mono">
                   {formatCurrency(data.montant_total_periode)}
                 </div>
               </div>
            )}
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-hidden flex flex-col p-6">
          {error && (
            <div className="alert alert-error mb-4 shrink-0">
              <span>{error}</span>
            </div>
          )}

          {loading ? (
             <div className="flex justify-center flex-1 items-center">
               <span className="loading loading-spinner loading-lg text-primary"></span>
             </div>
          ) : !selectedFournisseurId ? (
            <div className="text-center flex-1 flex flex-col justify-center items-center bg-base-200/50 rounded-xl border border-slate-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="text-lg font-bold text-base-content/80">{t('providers:pointage_modal.select_instruction')}</h3>
            </div>
          ) : !data || data.factures.length === 0 ? (
            <div className="text-center flex-1 flex flex-col justify-center items-center bg-base-200/50 rounded-xl border border-slate-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-bold text-base-content/80">{t('providers:pointage_modal.empty')}</h3>
              <p className="text-sm text-base-content/60">{t('providers:pointage_modal.empty_subtitle', { start: dateRange.start, end: dateRange.end })}</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden bg-base-100 border border-base-200 rounded-xl shadow-sm">
              {/* Pointage En Tête */}
              <div className="flex items-center justify-between p-3 border-b bg-base-200/50">
                <div className="flex items-center gap-3">
                   <div className="badge badge-primary badge-sm font-bold">{t('providers:pointage_modal.pointed_count', { count: pointedIds.size, total: data.factures.length })}</div>
                   <button className="btn btn-xs btn-outline rounded-full" onClick={toggleAll}>
                     {pointedIds.size === data.factures.length ? t('providers:pointage_modal.uncheck_all') : t('providers:pointage_modal.check_all')}
                   </button>
                </div>
                <div className="text-sm font-bold text-base-content/90">
                  {t('providers:pointage_modal.pointed_sum')} <span className="font-mono text-success bg-success/10 px-2 py-1 rounded ml-1">{formatCurrency(pointageSum)}</span>
                </div>
              </div>

              {/* Tableau avec scroll */}
              <div className="flex-1 overflow-auto">
                <table className="table table-sm table-pin-rows w-full">
                  <thead className="bg-[#f8fafc] text-[#64748b] text-[10px] uppercase">
                    <tr>
                      <th className="w-10 text-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></th>
                      <th>{t('providers:pointage_modal.table.date')}</th>
                      <th>{t('providers:pointage_modal.table.ref')}</th>
                      <th className="text-right">{t('providers:pointage_modal.table.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.factures.map((f) => {
                      const isPointed = pointedIds.has(f.id);
                      return (
                        <tr 
                          key={f.id} 
                          className={`hover transition-colors cursor-pointer border-b border-slate-100 last:border-0 ${isPointed ? 'bg-success/10/50' : 'bg-base-100'}`}
                          onClick={() => togglePointage(f.id)}
                        >
                          <td className="text-center">
                            <input 
                              type="checkbox" 
                              className="checkbox checkbox-sm checkbox-success" 
                              checked={isPointed}
                              onChange={() => {}} // Handle on TR click
                            />
                          </td>
                          <td>
                            <div className={`font-medium ${isPointed ? 'text-success' : 'text-base-content/80'}`}>
                              {new Date(f.date_cloture).toLocaleDateString(getLocale(), { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                          </td>
                          <td>
                            <div className="font-mono text-xs font-bold bg-base-200 text-base-content/90 px-2 py-0.5 rounded inline-block">
                              {f.numero_facture}
                            </div>
                          </td>
                          <td className="text-right">
                            <div className={`font-black font-mono ${isPointed ? 'text-success' : 'text-base-content/90'}`}>
                              {formatCurrency(f.montant)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t bg-base-200/50 flex justify-end">
                <button 
                  className="btn btn-primary rounded-xl px-8 shadow-lg shadow-primary/20"
                  disabled={pointedIds.size === 0}
                  onClick={() => {
                     if (selectedFournisseurId) {
                        onReglerSelection(Number(selectedFournisseurId), Array.from(pointedIds), pointageSum);
                     }
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('providers:pointage_modal.regler_btn', { amount: formatCurrency(pointageSum) })}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PremiumModal>
  );
}

