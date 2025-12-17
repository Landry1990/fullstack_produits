import { useState, useMemo } from 'react';
import  axios from 'axios';

interface RapportData {
  mois: string;
  ca: {
    ca_ttc: number;
    ca_ht: number;
    nb_ventes: number;
  };
  marge: {
    cout_achat: number;
    marge_brute: number;
    marge_pct: number;
  };
  encaissements: Array<{
    mode: string;
    mode_label: string;
    montant: number;
  }>;
  ventes_en_compte: number;
  ca_par_tva: Array<{
    taux: number;
    ca_ht: number;
    montant_tva: number;
    ca_ttc: number;
  }>;
}

export default function RapportMensuel() {
  const [mois, setMois] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [rapport, setRapport] = useState<RapportData | null>(null);
  const [loading, setLoading] = useState(false);

  const apiBaseUrl = useMemo(() => (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''), []);

  const fetchRapport = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/api/rapports/rapport_mensuel/`, {
        params: { mois }
      });
      setRapport(response.data);
    } catch (error) {
      console.error("Erreur lors du chargement du rapport", error);
      alert("Erreur lors du chargement du rapport");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Rapport de Clôture Mensuelle</h1>
          <p className="text-sm text-base-content/80">Synthèse du CA, marges et encaissements</p>
        </div>
        
        <div className="flex items-end gap-2 bg-base-100 p-2 rounded-lg shadow-sm border border-base-200">
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">Mois</span></label>
            <input 
              type="month" 
              className="input input-bordered input-sm" 
              value={mois}
              onChange={(e) => setMois(e.target.value)}
            />
          </div>
          <button 
            className="btn btn-primary btn-sm"
            onClick={fetchRapport}
            disabled={loading}
          >
            {loading ? <span className="loading loading-spinner loading-xs"></span> : 'Générer'}
          </button>
        </div>
      </div>

      {rapport && (
        <>
          {/* Cartes KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card bg-base-100 shadow-sm border border-base-200">
              <div className="card-body p-4">
                <p className="text-sm font-medium text-base-content/70">CA TTC</p>
                <h3 className="text-2xl font-bold text-emerald-600">
                  {Math.round(rapport.ca.ca_ttc).toLocaleString('fr-FR')} F
                </h3>
                <p className="text-xs text-base-content/60">{rapport.ca.nb_ventes} ventes</p>
              </div>
            </div>
            <div className="card bg-base-100 shadow-sm border border-base-200">
              <div className="card-body p-4">
                <p className="text-sm font-medium text-base-content/70">CA HT</p>
                <h3 className="text-2xl font-bold text-blue-600">
                  {Math.round(rapport.ca.ca_ht).toLocaleString('fr-FR')} F
                </h3>
              </div>
            </div>
            <div className="card bg-base-100 shadow-sm border border-base-200">
              <div className="card-body p-4">
                <p className="text-sm font-medium text-base-content/70">Marge Brute</p>
                <h3 className="text-2xl font-bold text-amber-600">
                  {Math.round(rapport.marge.marge_brute).toLocaleString('fr-FR')} F
                </h3>
                <p className="text-xs text-base-content/60">{rapport.marge.marge_pct.toFixed(1)}% du CA</p>
              </div>
            </div>
            <div className="card bg-base-100 shadow-sm border border-base-200">
              <div className="card-body p-4">
                <p className="text-sm font-medium text-base-content/70">Coût d'Achat</p>
                <h3 className="text-2xl font-bold text-purple-600">
                  {Math.round(rapport.marge.cout_achat).toLocaleString('fr-FR')} F
                </h3>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Encaissements réels */}
            <div className="card bg-base-100 shadow-sm border border-base-200">
              <div className="card-body p-4">
                <h2 className="card-title text-lg font-bold mb-2">Détail des Encaissements</h2>
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr className="bg-base-200">
                        <th>Mode de Paiement</th>
                        <th className="text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rapport.encaissements.map((enc, idx) => (
                        <tr key={idx}>
                          <td>{enc.mode_label}</td>
                          <td className="text-right font-bold">
                            {Math.round(Number(enc.montant)).toLocaleString('fr-FR')} F
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Ventes à crédit (En Compte) */}
            <div className="card bg-base-100 shadow-sm border border-base-200">
              <div className="card-body p-4">
                <h2 className="card-title text-lg font-bold mb-2">Ventes à Crédit (En Compte)</h2>
                <div className="flex items-center justify-between p-4 bg-warning/10 rounded-lg border border-warning/20">
                  <div>
                    <p className="text-sm text-base-content/70">Total des ventes à crédit</p>
                    <p className="text-xs text-base-content/60 mt-1">Créances à recouvrer</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-warning">
                      {Math.round(Number(rapport.ventes_en_compte || 0)).toLocaleString('fr-FR')} F
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CA par TVA */}
            <div className="card bg-base-100 shadow-sm border border-base-200">
              <div className="card-body p-4">
                <h2 className="card-title text-lg font-bold mb-2">CA par Taux de TVA</h2>
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr className="bg-base-200">
                        <th>Taux TVA</th>
                        <th className="text-right">CA HT</th>
                        <th className="text-right">Montant TVA</th>
                        <th className="text-right">CA TTC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rapport.ca_par_tva.map((tva, idx) => (
                        <tr key={idx}>
                          <td>{tva.taux}%</td>
                          <td className="text-right">
                            {Math.round(Number(tva.ca_ht)).toLocaleString('fr-FR')} F
                          </td>
                          <td className="text-right">
                            {Math.round(Number(tva.montant_tva)).toLocaleString('fr-FR')} F
                          </td>
                          <td className="text-right font-bold">
                            {Math.round(Number(tva.ca_ttc)).toLocaleString('fr-FR')} F
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Bouton Export PDF - à implémenter */}
          <div className="flex justify-end">
            <button className="btn btn-outline btn-primary" disabled>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export PDF (bientôt disponible)
            </button>
          </div>
        </>
      )}

      {!rapport && !loading && (
        <div className="flex flex-col items-center justify-center h-96 text-base-content/40">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium">Sélectionnez un mois et cliquez sur "Générer"</p>
        </div>
      )}
    </div>
  );
}
