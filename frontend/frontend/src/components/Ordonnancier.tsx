import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { Ordonnancier } from '../types';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import { Button } from './shadcn/button';
import { Badge } from './shadcn/badge';
import { cn } from '../lib/utils';
import { FileText, RefreshCw, Search, CalendarDays, Pill, User, Stethoscope, ClipboardList, FileDown, ShieldAlert } from 'lucide-react';

const OrdonnancierPage: React.FC = () => {
    const { t } = useTranslation(['prescriptions', 'common']);
    
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
    
    // Force URL absolue
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
            
            const response = await api.get(`ordonnancier/?${params.toString()}`);
            const data = response.data.results || response.data;
            setOrdonnancier(Array.isArray(data) ? data : []);
        } catch (error: any) {
            console.error('Erreur chargement ordonnancier:', error);
            toast.error(t('common:messages.error_loading'));
        } finally {
            setLoading(false);
        }
    };
    
    const fetchStats = async () => {
        try {
            const response = await api.get('ordonnancier/stats/');
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
        
        const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
        window.open(`${baseUrl}/api/ordonnancier/export_pdf/?${params.toString()}`, '_blank');
    };

    return (
        <div className="min-h-screen bg-slate-50 p-3 sm:p-6 space-y-4 sm:space-y-6 font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('title')}</h1>
                  <p className="text-slate-500 text-sm mt-1">{t('subtitle')}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPDF}>
                        <FileDown className="size-4" />
                        {t('export_pdf')}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { fetchOrdonnancier(); fetchStats(); }} title={t('common:refresh')}>
                         <RefreshCw className="size-4" />
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('stats.total_entries')}</h3>
                                <p className="text-2xl font-bold mt-1 text-emerald-600">{stats.total_entries}</p>
                                <p className="text-xs text-slate-500 mt-1">{t('stats.total_entries_desc')}</p>
                            </div>
                            <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600">
                                <ClipboardList className="size-6" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('stats.delivered_meds')}</h3>
                                <p className="text-2xl font-bold mt-1 text-blue-600">{stats.total_medicaments}</p>
                                <p className="text-xs text-slate-500 mt-1">{t('stats.delivered_meds_desc')}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                                <Pill className="size-6" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('stats.under_surveillance')}</h3>
                                <p className="text-2xl font-bold mt-1 text-amber-600">{stats.surveillance_count}</p>
                                <p className="text-xs text-slate-500 mt-1">{t('stats.under_surveillance_desc')}</p>
                            </div>
                            <div className="p-3 bg-amber-100 rounded-lg text-amber-600">
                                <ShieldAlert className="size-6" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">{t('filters.date_start')}</label>
                        <div className="relative">
                            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                            <input
                                type="date"
                                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                value={dateDebut}
                                onChange={e => setDateDebut(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">{t('filters.date_end')}</label>
                        <div className="relative">
                            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                            <input
                                type="date"
                                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                value={dateFin}
                                onChange={e => setDateFin(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">{t('filters.patient')}</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                            <input
                                type="text"
                                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                placeholder={t('filters.patient_placeholder')}
                                value={searchPatient}
                                onChange={e => setSearchPatient(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">{t('filters.prescriber')}</label>
                        <div className="relative">
                            <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                            <input
                                type="text"
                                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                placeholder={t('filters.prescriber_placeholder')}
                                value={searchPrescripteur}
                                onChange={e => setSearchPrescripteur(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">{t('filters.product')}</label>
                        <div className="relative">
                            <Pill className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                            <input
                                type="text"
                                className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                placeholder={t('filters.product_placeholder')}
                                value={searchProduit}
                                onChange={e => setSearchProduit(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">{t('filters.surveillance')}</label>
                        <select
                            className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            value={filterSurveillance}
                            onChange={e => setFilterSurveillance(e.target.value)}
                        >
                            <option value="NONE">{t('filters.surveillance_options.none')}</option>
                            <option value="STANDARD">{t('filters.surveillance_options.standard')}</option>
                            <option value="RENFORCEE">{t('filters.surveillance_options.renforcee')}</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden">
                <div className="overflow-x-auto h-full">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-100 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('table.order_num')}</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('table.date')}</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('table.patient')}</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('table.prescriber')}</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('table.meds')}</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">{t('table.action')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="h-64 text-center">
                                        <div className="animate-spin rounded-full size-10 border-b-2 border-emerald-600 mx-auto"></div>
                                    </td>
                                </tr>
                            ) : ordonnancier.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="h-64 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <FileText className="size-12 text-slate-300" />
                                            <p className="text-lg font-medium">{t('table.empty')}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                ordonnancier.map((entry) => (
                                    <tr key={entry.numero_ordre} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <Badge variant="outline" className="font-mono text-slate-600 border-slate-200">
                                                #{entry.numero_ordre.toString().padStart(5, '0')}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                                            {formatDate(entry.date_delivrance)}
                                            <div className="text-xs text-slate-400 mt-0.5">
                                                {formatDateTime(entry.date_delivrance).split(' ').slice(1).join(' ')}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-700">{entry.patient_nom}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{entry.prescripteur_nom}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex flex-col gap-1.5">
                                                {entry.lignes.map(ligne => (
                                                    <div key={ligne.id} className="text-sm flex items-center gap-1.5">
                                                        <span className="font-semibold text-slate-700">{ligne.produit_nom}</span>
                                                        <span className="text-slate-500">x{ligne.quantite}</span>
                                                        {ligne.surveillance_category !== 'NONE' && (
                                                            <Badge variant="destructive" className={cn(ligne.surveillance_category !== 'RENFORCEE' && 'bg-amber-100 text-amber-700 border-transparent shadow-none text-[10px] h-5 px-1.5')}>
                                                                {ligne.surveillance_category === 'RENFORCEE' ? t('table.surveillance_badges.renf') : t('table.surveillance_badges.std')}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-center">
                                            <div className="inline-flex items-center justify-center size-8 rounded-full bg-slate-100 text-slate-600 text-xs font-bold" title={t('table.recorded_by') + ': ' + (entry.enregistre_par_nom || '?')}>
                                                {entry.enregistre_par_nom?.substring(0, 2).toUpperCase() || '?'}
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
