import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface StatsFournisseur {
  id: number;
  nom: string;
  ca_ttc: number;
  cout_achat: number;
  marge_brute: number;
  quantite_vendue: number;
}

export default function StatistiquesFournisseur() {
  // Helper pour formater les dates en YYYY-MM-DD local
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [stats, setStats] = useState<StatsFournisseur[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateDebut, setDateDebut] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1er du mois
    return formatDate(d);
  });
  const [dateFin, setDateFin] = useState(() => {
    return formatDate(new Date());
  });

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),
    [],
  );

  const fetchStats = async () => {
    try {
      setLoading(true);
      console.log(`Fetching stats from ${dateDebut} to ${dateFin}`);
      const response = await axios.get(`${apiBaseUrl}/api/statistiques/ca_par_fournisseur/`, {
        params: {
          date_debut: dateDebut,
          date_fin: dateFin
        }
      });
      console.log("Stats received:", response.data);
      setStats(response.data);
    } catch (error) {
      console.error("Erreur lors du chargement des statistiques", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []); // Charge au montage. Pour recharger au changement de date, ajouter [dateDebut, dateFin] ou utiliser le bouton.

  // Totaux
  const totaux = useMemo(() => {
    return stats.reduce((acc, curr) => ({
      ca_ttc: acc.ca_ttc + Number(curr.ca_ttc),
      cout_achat: acc.cout_achat + Number(curr.cout_achat),
      marge_brute: acc.marge_brute + Number(curr.marge_brute),
      quantite_vendue: acc.quantite_vendue + curr.quantite_vendue
    }), { ca_ttc: 0, cout_achat: 0, marge_brute: 0, quantite_vendue: 0 });
  }, [stats]);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Statistiques par Fournisseur</h1>
          <p className="text-sm text-base-content/80">Analyse du chiffre d'affaires et des marges</p>
        </div>
        
        <div className="flex items-end gap-2 bg-base-100 p-2 rounded-lg shadow-sm border border-base-200">
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">Du</span></label>
            <input 
              type="date" 
              className="input input-bordered input-sm" 
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
          </div>
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">Au</span></label>
            <input 
              type="date" 
              className="input input-bordered input-sm" 
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
            />
          </div>
          <button 
            className="btn btn-primary btn-sm"
            onClick={fetchStats}
            disabled={loading}
          >
            {loading ? <span className="loading loading-spinner loading-xs"></span> : 'Actualiser'}
          </button>
        </div>
      </div>

      {/* Info Box - FIFO Explanation */}
      <div className="alert alert-info shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <h3 className="font-bold">Méthode de calcul : FIFO (Premier Entré, Premier Sorti)</h3>
          <div className="text-sm">
            Les statistiques affichent uniquement les fournisseurs dont les produits ont été <strong>effectivement vendus</strong> durant la période. 
            Si un fournisseur n'apparaît pas, cela signifie que ses produits sont encore en stock ou que d'autres lots plus anciens ont été vendus en priorité.
          </div>
        </div>
      </div>

      {/* Cartes Résumé */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-base-100 shadow-sm border border-base-200">
          <div className="card-body p-4">
            <p className="text-sm font-medium text-base-content/70">CA Total TTC</p>
            <h3 className="text-2xl font-bold text-emerald-600">{Math.round(totaux.ca_ttc).toLocaleString('fr-FR')} F</h3>
          </div>
        </div>
        <div className="card bg-base-100 shadow-sm border border-base-200">
          <div className="card-body p-4">
            <p className="text-sm font-medium text-base-content/70">Coût d'Achat Total</p>
            <h3 className="text-2xl font-bold text-blue-600">{Math.round(totaux.cout_achat).toLocaleString('fr-FR')} F</h3>
          </div>
        </div>
        <div className="card bg-base-100 shadow-sm border border-base-200">
          <div className="card-body p-4">
            <p className="text-sm font-medium text-base-content/70">Marge Brute Totale</p>
            <h3 className="text-2xl font-bold text-amber-600">{Math.round(totaux.marge_brute).toLocaleString('fr-FR')} F</h3>
            <p className="text-xs text-base-content/60">
              {totaux.ca_ttc > 0 ? ((totaux.marge_brute / totaux.ca_ttc) * 100).toFixed(1) : 0}% du CA
            </p>
          </div>
        </div>
        <div className="card bg-base-100 shadow-sm border border-base-200">
          <div className="card-body p-4">
            <p className="text-sm font-medium text-base-content/70">Unités Vendues</p>
            <h3 className="text-2xl font-bold text-purple-600">{totaux.quantite_vendue}</h3>
          </div>
        </div>
      </div>

      {/* Graphique */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-4">
          <h2 className="card-title text-lg font-bold mb-4">Répartition du CA par Fournisseur</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nom" />
                <YAxis />
                <Tooltip formatter={(value) => `${Number(value).toLocaleString('fr-FR')} F`} />
                <Legend />
                <Bar dataKey="ca_ttc" name="Chiffre d'Affaires" fill="#10b981" />
                <Bar dataKey="marge_brute" name="Marge Brute" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tableau détaillé */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr className="bg-base-200">
                  <th>Fournisseur</th>
                  <th className="text-right">Qté Vendue</th>
                  <th className="text-right">Coût Achat</th>
                  <th className="text-right">CA TTC</th>
                  <th className="text-right">Marge Brute</th>
                  <th className="text-right">% Marge</th>
                </tr>
              </thead>
              <tbody>
                {stats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-base-content/50">
                      Aucune donnée pour la période sélectionnée
                    </td>
                  </tr>
                ) : (
                  stats.map((stat) => (
                    <tr key={stat.id}>
                      <td className="font-medium">{stat.nom}</td>
                      <td className="text-right">{stat.quantite_vendue}</td>
                      <td className="text-right">{Math.round(Number(stat.cout_achat)).toLocaleString('fr-FR')} F</td>
                      <td className="text-right font-bold">{Math.round(Number(stat.ca_ttc)).toLocaleString('fr-FR')} F</td>
                      <td className="text-right text-success">{Math.round(Number(stat.marge_brute)).toLocaleString('fr-FR')} F</td>
                      <td className="text-right text-sm">
                        {Number(stat.ca_ttc) > 0 
                          ? ((Number(stat.marge_brute) / Number(stat.ca_ttc)) * 100).toFixed(1) 
                          : 0}%
                      </td>
                    </tr>
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
