import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import type { Ordonnancier } from '../types';

const OrdonnancierPage: React.FC = () => {
    const [ordonnancier, setOrdonnancier] = useState<Ordonnancier[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // Filtres
    const [dateDebut, setDateDebut] = useState('');
    const [dateFin, setDateFin] = useState('');
    const [searchPatient, setSearchPatient] = useState('');
    const [searchPrescripteur, setSearchPrescripteur] = useState('');
    const [searchProduit, setSearchProduit] = useState('');
    const [filterSurveillance, setFilterSurveillance] = useState('NONE');
    
    // Force URL absolue pour éviter les problèmes de proxy/env temporairement
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

    useEffect(() => {
        fetchOrdonnancier();
        fetchStats();
    }, [dateDebut, dateFin, filterSurveillance]);
    
    // Debounce search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchOrdonnancier();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchPatient, searchPrescripteur, searchProduit]);

    const fetchOrdonnancier = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (dateDebut) params.append('date_debut', dateDebut);
            if (dateFin) params.append('date_fin', dateFin);
            if (searchPatient) params.append('patient', searchPatient);
            if (searchPrescripteur) params.append('prescripteur', searchPrescripteur);
            if (searchProduit) params.append('produit', searchProduit);
            if (filterSurveillance !== 'NONE') params.append('surveillance', filterSurveillance);
            
            const response = await axios.get(`${apiBaseUrl}/api/ordonnancier/?${params.toString()}`);
            
            // Handle both paginated and non-paginated responses
            const data = response.data.results || response.data;
            setOrdonnancier(Array.isArray(data) ? data : []);
        } catch (error: any) {
            console.error('Erreur chargement ordonnancier:', error);
            toast.error('Erreur lors du chargement de l\'ordonnancier');
        } finally {
            setLoading(false);
        }
    };
    
    const fetchStats = async () => {
        try {
            const response = await axios.get(`${apiBaseUrl}/api/ordonnancier/stats/`);
            setStats(response.data);
        } catch (error) {
            console.error('Erreur chargement stats:', error);
        }
    };

    const handleExportPDF = () => {
        const params = new URLSearchParams();
        if (dateDebut) params.append('date_debut', dateDebut);
        if (dateFin) params.append('date_fin', dateFin);
        if (searchPatient) params.append('patient', searchPatient);
        if (searchPrescripteur) params.append('prescripteur', searchPrescripteur);
        
        window.open(`${apiBaseUrl}/api/ordonnancier/export_pdf/?${params.toString()}`, '_blank');
    };

    return (
        <div className="flex flex-col h-full gap-6 p-4 md:p-6 bg-base-100 overflow-y-auto w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                    📋 Ordonnancier
                </h1>
                
                <div className="flex gap-2">
                    <button onClick={handleExportPDF} className="btn btn-primary gap-2">
                        <span className="text-xl">📄</span> Exporter PDF
                    </button>
                    <button onClick={() => { fetchOrdonnancier(); fetchStats(); }} className="btn btn-ghost btn-circle">
                         🔄
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="stats shadow bg-white">
                        <div className="stat">
                            <div className="stat-title">Total Entrées</div>
                            <div className="stat-value text-primary">{stats.total_entries}</div>
                            <div className="stat-desc">Ordonnances enregistrées</div>
                        </div>
                    </div>
                    <div className="stats shadow bg-white">
                        <div className="stat">
                            <div className="stat-title">Médicaments délivrés</div>
                            <div className="stat-value text-secondary">{stats.total_medicaments}</div>
                            <div className="stat-desc">Boîtes totales</div>
                        </div>
                    </div>
                    <div className="stats shadow bg-white">
                        <div className="stat">
                            <div className="stat-title">Sous Surveillance</div>
                            <div className="stat-value text-warning">{stats.surveillance_count}</div>
                            <div className="stat-desc">Médicaments sensibles</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="card bg-white shadow-sm border border-base-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="form-control">
                        <label className="label text-xs">Date début</label>
                        <input 
                            type="date" 
                            className="input input-bordered input-sm" 
                            value={dateDebut}
                            onChange={e => setDateDebut(e.target.value)}
                        />
                    </div>
                    <div className="form-control">
                        <label className="label text-xs">Date fin</label>
                        <input 
                            type="date" 
                            className="input input-bordered input-sm" 
                            value={dateFin}
                            onChange={e => setDateFin(e.target.value)}
                        />
                    </div>
                    <div className="form-control">
                        <label className="label text-xs">Patient</label>
                        <input 
                            type="text" 
                            className="input input-bordered input-sm" 
                            placeholder="Nom..." 
                            value={searchPatient}
                            onChange={e => setSearchPatient(e.target.value)}
                        />
                    </div>
                    <div className="form-control">
                        <label className="label text-xs">Prescripteur</label>
                        <input 
                            type="text" 
                            className="input input-bordered input-sm" 
                            placeholder="Médecin..." 
                            value={searchPrescripteur}
                            onChange={e => setSearchPrescripteur(e.target.value)}
                        />
                    </div>
                    <div className="form-control">
                        <label className="label text-xs">Produit</label>
                        <input 
                            type="text" 
                            className="input input-bordered input-sm" 
                            placeholder="Médicament..." 
                            value={searchProduit}
                            onChange={e => setSearchProduit(e.target.value)}
                        />
                    </div>
                    <div className="form-control">
                        <label className="label text-xs">Surveillance</label>
                        <select 
                            className="select select-bordered select-sm"
                            value={filterSurveillance}
                            onChange={e => setFilterSurveillance(e.target.value)}
                        >
                            <option value="NONE">Tous</option>
                            <option value="STANDARD">Standard</option>
                            <option value="RENFORCEE">Renforcée</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card bg-white shadow-xl border border-base-200 flex-1 overflow-hidden">
                <div className="overflow-x-auto h-full">
                    <table className="table table-pin-rows">
                        <thead>
                            <tr>
                                <th>N° Ordre</th>
                                <th>Date</th>
                                <th>Patient</th>
                                <th>Prescripteur</th>
                                <th>Médicaments</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8">
                                        <span className="loading loading-spinner loading-lg text-primary"></span>
                                    </td>
                                </tr>
                            ) : ordonnancier.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-base-content/50">
                                        Aucune entrée trouvée
                                    </td>
                                </tr>
                            ) : (
                                ordonnancier.map((entry) => (
                                    <tr key={entry.numero_ordre} className="hover">
                                        <td>
                                            <div className="badge badge-outline font-mono">
                                                #{entry.numero_ordre.toString().padStart(5, '0')}
                                            </div>
                                        </td>
                                        <td>
                                            {new Date(entry.date_delivrance).toLocaleDateString('fr-FR')}
                                            <div className="text-xs opacity-50">
                                                {new Date(entry.date_delivrance).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        </td>
                                        <td className="font-medium">{entry.patient_nom}</td>
                                        <td>{entry.prescripteur_nom}</td>
                                        <td>
                                            <div className="flex flex-col gap-1">
                                                {entry.lignes.map(ligne => (
                                                    <div key={ligne.id} className="text-sm">
                                                        <span className="font-semibold">{ligne.produit_nom}</span>
                                                        <span className="opacity-70 mx-1">x{ligne.quantite}</span>
                                                        {ligne.surveillance_category !== 'NONE' && (
                                                            <span className={`badge badge-xs ${ligne.surveillance_category === 'RENFORCEE' ? 'badge-error' : 'badge-warning'}`}>
                                                                {ligne.surveillance_category === 'RENFORCEE' ? 'RENF.' : 'STD.'}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="tooltip" data-tip="Enregistré par">
                                                <div className="avatar placeholder">
                                                    <div className="bg-neutral-focus text-neutral-content rounded-full w-8">
                                                        <span className="text-xs">{entry.enregistre_par_nom?.substring(0, 2).toUpperCase() || '?'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default OrdonnancierPage;
