import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import PremiumModal from './common/PremiumModal';

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

  // Set initial fournisseur when modal opens if provided
  useEffect(() => {
    if (isOpen) {
       if (initialFournisseurId) {
          setSelectedFournisseurId(initialFournisseurId);
       } else {
          setSelectedFournisseurId('');
       }
       setPointedIds(new Set());
    }
  }, [isOpen, initialFournisseurId]);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

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

  useEffect(() => {
    if (isOpen && selectedFournisseurId && dateRange.start && dateRange.end) {
      if (periodeType === 'CUSTOM' && (!customStart || !customEnd)) {
        return; // Wait for full custom range
      }
      fetchReleve(selectedFournisseurId, dateRange.start, dateRange.end);
    } else if (isOpen && !selectedFournisseurId) {
      setData(null);
      setPointedIds(new Set());
    }
  }, [isOpen, selectedFournisseurId, dateRange]);

  // Réinitialiser les coches quand on ouvre avec un nouveau id
  useEffect(() => {
    if (isOpen) {
      setPointedIds(new Set());
    }
  }, [isOpen, selectedFournisseurId]);

  async function fetchReleve(fId: number | string, start: string, end: string) {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${apiBaseUrl}/api/fournisseurs/${fId}/releve_factures/`, {
        params: {
          start_date: start,
          end_date: end
        }
      });
      setData(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erreur lors du calcul du relevé');
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
      title="Pointage du Relevé Fournisseur"
      subtitle="Validez et réglez vos factures groupées"
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      }
      maxWidth="max-w-5xl"
    >
      <div className="flex flex-col h-[75vh]">
        {/* En-tête / Filtres */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Fournisseur</label>
              <select 
                className="select select-sm select-bordered w-full md:w-48 font-bold text-slate-700" 
                value={selectedFournisseurId} 
                onChange={e => setSelectedFournisseurId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">-- Choisir --</option>
                {fournisseurs.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            {selectedFournisseurId && (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Mois</label>
                  <select className="select select-sm select-bordered w-full md:w-32" value={month} onChange={e => setMonth(Number(e.target.value))} disabled={periodeType === 'CUSTOM'}>
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('fr-FR', { month: 'long' })}</option>
                    ))}
                  </select>
                </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Année</label>
              <select className="select select-sm select-bordered w-full md:w-24" value={year} onChange={e => setYear(Number(e.target.value))} disabled={periodeType === 'CUSTOM'}>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Période cible</label>
              <select className="select select-sm select-bordered w-full md:w-48" value={periodeType} onChange={e => setPeriodeType(e.target.value)}>
                <option value="MENSUELLER">Mois Complet</option>
                <optgroup label="Quinzaines">
                  <option value="QUINZAINE_1">1ère Quinzaine (1-15)</option>
                  <option value="QUINZAINE_2">2ème Quinzaine (16-fin)</option>
                </optgroup>
                <optgroup label="Décades">
                  <option value="DECADE_1">1ère Décade (1-10)</option>
                  <option value="DECADE_2">2ème Décade (11-20)</option>
                  <option value="DECADE_3">3ème Décade (21-fin)</option>
                </optgroup>
                <option value="CUSTOM">Dates personnalisées</option>
              </select>
            </div>

            {periodeType === 'CUSTOM' && (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Début</label>
                  <input type="date" className="input input-sm input-bordered" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Fin</label>
                  <input type="date" className="input input-sm input-bordered" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                </div>
              </>
            )}

              </>
            )}

            <div className="flex-1"></div>

            {data && (
               <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm text-right">
                 <div className="text-[10px] font-bold uppercase text-slate-400">Total Période</div>
                 <div className="text-lg font-black text-purple-600 font-mono">
                   {data.montant_total_periode.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} F
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
            <div className="text-center flex-1 flex flex-col justify-center items-center bg-slate-50 rounded-xl border border-slate-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="text-lg font-bold text-slate-600">Sélectionnez un Fournisseur</h3>
            </div>
          ) : !data || data.factures.length === 0 ? (
            <div className="text-center flex-1 flex flex-col justify-center items-center bg-slate-50 rounded-xl border border-slate-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-bold text-slate-600">Aucune facture trouvée</h3>
              <p className="text-sm text-slate-500">Il n'y a aucune commande clôturée sur la période du {dateRange.start} au {dateRange.end}.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm">
              {/* Pointage En Tête */}
              <div className="flex items-center justify-between p-3 border-b bg-slate-50">
                <div className="flex items-center gap-3">
                   <div className="badge badge-primary badge-sm font-bold">{pointedIds.size} / {data.factures.length} pointées</div>
                   <button className="btn btn-xs btn-outline rounded-full" onClick={toggleAll}>
                     {pointedIds.size === data.factures.length ? 'Tout décocher' : 'Tout cocher'}
                   </button>
                </div>
                <div className="text-sm font-bold text-slate-700">
                  Somme Pointée : <span className="font-mono text-emerald-600 bg-emerald-50 px-2 py-1 rounded ml-1">{pointageSum.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} F</span>
                </div>
              </div>

              {/* Tableau avec scroll */}
              <div className="flex-1 overflow-auto">
                <table className="table table-sm table-pin-rows w-full">
                  <thead className="bg-[#f8fafc] text-[#64748b] text-[10px] uppercase">
                    <tr>
                      <th className="w-10 text-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></th>
                      <th>Date Clôture</th>
                      <th>Référence Facture</th>
                      <th className="text-right">Montant TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.factures.map((f) => {
                      const isPointed = pointedIds.has(f.id);
                      return (
                        <tr 
                          key={f.id} 
                          className={`hover transition-colors cursor-pointer border-b border-slate-100 last:border-0 ${isPointed ? 'bg-emerald-50/50' : 'bg-white'}`}
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
                            <div className={`font-medium ${isPointed ? 'text-emerald-700' : 'text-slate-600'}`}>
                              {new Date(f.date_cloture).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                          </td>
                          <td>
                            <div className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded inline-block">
                              {f.numero_facture}
                            </div>
                          </td>
                          <td className="text-right">
                            <div className={`font-black font-mono ${isPointed ? 'text-emerald-700' : 'text-slate-700'}`}>
                              {f.montant.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} F
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t bg-slate-50 flex justify-end">
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
                  Régler la sélection ({pointageSum.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} F)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PremiumModal>
  );
}
