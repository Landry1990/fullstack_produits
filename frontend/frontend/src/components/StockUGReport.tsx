import React, { useState, useEffect } from 'react';
import { PackageOpen, Calendar, Download, RefreshCw, IndianRupee } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import toast, { Toaster } from 'react-hot-toast';

interface UGDetail {
  lot_id: number;
  lot_numero: string;
  produit_nom: string;
  date_reception: string | null;
  commande_numero: string;
  facture_numero: string;
  quantity_free: number;
  quantity_free_remaining: number;
  valeur_estimee: number;
  valeur_restante: number;
  prix_vente: number;
}

interface FournisseurUGStat {
  fournisseur_id: number;
  fournisseur_nom: string;
  total_ug: number;
  total_ug_restantes: number;
  total_valeur: number;
  total_valeur_restante: number;
  lots_count: number;
  details: UGDetail[];
}

interface UGReportData {
  global_total_ug: number;
  global_total_ug_restantes: number;
  global_total_valeur: number;
  global_total_valeur_restante: number;
  fournisseurs: FournisseurUGStat[];
}

export default function StockUGReport() {
  const [data, setData] = useState<UGReportData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Date filers
  const [dateDebut, setDateDebut] = useState<string>('');
  const [dateFin, setDateFin] = useState<string>('');
  
  const [expandedSupplierIds, setExpandedSupplierIds] = useState<Set<number>>(new Set());

  const toggleRow = (id: number) => {
    const newSet = new Set(expandedSupplierIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedSupplierIds(newSet);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      
      const params = new URLSearchParams();
      if (dateDebut) params.append('date_debut', dateDebut);
      if (dateFin) params.append('date_fin', dateFin);
      
      const response = await axios.get(
        `http://127.0.0.1:8000/api/stock-lots/rapport_ug/?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setData(response.data);
    } catch (error) {
      console.error('Error fetching UG report:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateDebut, dateFin]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCSV = () => {
    if (!data?.fournisseurs.length) return;
    
    const headers = ['Fournisseur', 'Nombre de Lots avec UG', 'Total Unités Gratuites (UG)', 'Valeur Estimée (FCFA)'];
    const rows = data.fournisseurs.map(f => [
      f.fournisseur_nom,
      f.lots_count,
      f.total_ug,
      f.total_valeur
    ]);
    
    // Add total row
    rows.push(['TOTAL GÉNÉRAL', '', data.global_total_ug, data.global_total_valeur]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(';') + '\n' 
      + rows.map(e => e.join(';')).join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rapport_ug_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 lg:p-8">
      <Toaster position="top-right" />
      
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <PackageOpen className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-800">
                  Rapport des <span className="text-indigo-500 italic">Unités Gratuites</span>
                </h1>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mt-1">
                  Suivi des entrées promotionnelles (UG) par fournisseur
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={exportCSV}
              className="btn bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm"
              disabled={loading || !data?.fournisseurs.length}
            >
              <Download className="w-4 h-4" />
              Exporter CSV
            </button>
            <button 
              onClick={fetchData}
              className="btn btn-primary shadow-sm"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-center">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                 <PackageOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Historique UG Reçues</p>
                <p className="text-2xl font-black text-slate-800 tracking-tight">
                  {loading ? '...' : data?.global_total_ug.toLocaleString('fr-FR')}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-center">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
                 <PackageOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Stock UG Actuel (Restant)</p>
                <p className="text-2xl font-black text-emerald-600 tracking-tight">
                  {loading ? '...' : data?.global_total_ug_restantes.toLocaleString('fr-FR')}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-center">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                 <IndianRupee className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Valeur Reçue Estimée</p>
                <p className="text-2xl font-black text-slate-600 tracking-tight">
                  {loading ? '...' : `${data?.global_total_valeur.toLocaleString('fr-FR')} FCFA`}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-center border-l-4 border-l-blue-500">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
                 <IndianRupee className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-400 tracking-wider uppercase">Trésorerie Latente UG</p>
                <p className="text-2xl font-black text-slate-800 tracking-tight">
                  {loading ? '...' : `${data?.global_total_valeur_restante.toLocaleString('fr-FR')} FCFA`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* List Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              Répartition par Fournisseur
              {data && <span className="badge badge-primary badge-sm ml-2">{data.fournisseurs.length}</span>}
            </h2>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all shadow-sm w-full sm:w-auto">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input 
                  type="date" 
                  className="bg-transparent border-none outline-none text-sm text-slate-700 w-full"
                  value={dateDebut}
                  onChange={e => setDateDebut(e.target.value)}
                  placeholder="Début"
                />
              </div>
              <span className="text-slate-400 font-medium whitespace-nowrap">au</span>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all shadow-sm w-full sm:w-auto">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input 
                  type="date" 
                  className="bg-transparent border-none outline-none text-sm text-slate-700 w-full"
                  value={dateFin}
                  onChange={e => setDateFin(e.target.value)}
                  placeholder="Fin"
                />
              </div>
              
              {(dateDebut || dateFin) && (
                <button 
                  className="btn btn-ghost btn-sm btn-circle text-slate-400 hover:text-red-500"
                  onClick={() => { setDateDebut(''); setDateFin(''); }}
                  title="Effacer les dates"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          {/* Table */}
          <div className="overflow-x-auto w-full">
            <table className="table table-zebra w-full whitespace-nowrap">
              <thead className="bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10 text-slate-500 text-xs uppercase font-extrabold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Fournisseur</th>
                  <th className="px-6 py-4 text-right">Nb Réceptions (Lots)</th>
                  <th className="px-6 py-4 text-right">UG Reçues (Histo.)</th>
                  <th className="px-6 py-4 text-right text-emerald-600 bg-emerald-50/50">Stock UG Restant</th>
                  <th className="px-6 py-4 text-right text-blue-600 bg-blue-50/50">Valeur Restante (FCFA)</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium text-slate-600">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-48"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16 ml-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-20 ml-auto"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24 ml-auto"></div></td>
                    </tr>
                  ))
                ) : data?.fournisseurs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      <PackageOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="font-medium text-slate-500">Aucune unité gratuite trouvée sur cette période</p>
                    </td>
                  </tr>
                ) : (
                  data?.fournisseurs.map((stat, idx) => (
                    <React.Fragment key={stat.fournisseur_id || idx}>
                    <tr 
                      className={`hover hover:bg-slate-50/50 transition-colors cursor-pointer ${expandedSupplierIds.has(stat.fournisseur_id) ? 'bg-indigo-50/30' : ''}`}
                      onClick={() => toggleRow(stat.fournisseur_id)}
                    >
                      <td className="px-6 py-3 font-semibold text-slate-700 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-400 transition-transform ${expandedSupplierIds.has(stat.fournisseur_id) ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        {stat.fournisseur_nom}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="badge badge-sm badge-ghost font-bold text-slate-500">
                          {stat.lots_count} lots
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="font-medium text-slate-400">
                          {stat.total_ug.toLocaleString('fr-FR')}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right bg-emerald-50/30">
                        <span className="font-bold text-emerald-600 px-3 py-1 rounded-lg">
                          {stat.total_ug_restantes.toLocaleString('fr-FR')} UG
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right font-black text-slate-800 bg-blue-50/30">
                        {stat.total_valeur_restante.toLocaleString('fr-FR')} 
                      </td>
                    </tr>
                    {expandedSupplierIds.has(stat.fournisseur_id) && (
                      <tr>
                        <td colSpan={4} className="px-0 py-0 bg-slate-50/50 border-b border-slate-200">
                           <div className="px-10 py-4">
                             <table className="table table-sm w-full bg-white rounded-xl shadow-sm border border-slate-200">
                               <thead className="bg-slate-100 text-slate-500">
                                 <tr>
                                   <th>Produit</th>
                                   <th>N° Lot</th>
                                   <th>Date Réception</th>
                                   <th>N° Commande</th>
                                   <th>N° Facture</th>
                                   <th className="text-right">Prix Vente</th>
                                   <th className="text-right">Reçues</th>
                                   <th className="text-right text-emerald-600">Restantes</th>
                                   <th className="text-right text-blue-600">Valeur Rest.</th>
                                 </tr>
                               </thead>
                               <tbody>
                                 {stat.details.map(detail => (
                                   <tr key={detail.lot_id} className={detail.quantity_free_remaining === 0 ? 'opacity-50' : ''}>
                                     <td className="font-medium text-slate-700">{detail.produit_nom}</td>
                                     <td className="text-slate-500 font-mono text-xs">{detail.lot_numero}</td>
                                     <td className="text-slate-600">
                                        {detail.date_reception ? format(new Date(detail.date_reception), 'dd/MM/yyyy HH:mm') : 'N/A'}
                                     </td>
                                     <td className="text-slate-500 font-mono text-xs">{detail.commande_numero}</td>
                                     <td className="text-slate-500 font-mono text-xs">{detail.facture_numero}</td>
                                     <td className="text-right text-slate-600">{detail.prix_vente.toLocaleString('fr-FR')}</td>
                                     <td className="text-right text-slate-400">{detail.quantity_free}</td>
                                     <td className="text-right font-bold text-emerald-600">{detail.quantity_free_remaining}</td>
                                     <td className="text-right font-bold text-blue-600">{detail.valeur_restante.toLocaleString('fr-FR')}</td>
                                   </tr>
                                 ))}
                               </tbody>
                             </table>
                           </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
