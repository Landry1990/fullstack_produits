import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MessageCircle, Search, RefreshCcw, CheckCircle2, XCircle, Clock, FileText, User, Phone } from 'lucide-react';

interface WhatsAppLog {
    id: number;
    recipient_number: string;
    recipient_name: string;
    message: string;
    type: string;
    type_display: string;
    status: string;
    status_display: string;
    has_attachment: boolean;
    created_at: string;
    sent_at: string;
    sent_by_name: string;
    facture_numero: string;
}

const WhatsAppHistory: React.FC = () => {
    const { } = useTranslation();
    const [logs, setLogs] = useState<WhatsAppLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('ALL');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (filterType !== 'ALL') params.type = filterType;
            
            const response = await api.get('whatsapp-logs/', { params });
            setLogs(Array.isArray(response.data) ? response.data : response.data.results || []);
        } catch (error) {
            console.error('Erreur lors du chargement de l\'historique WhatsApp:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [filterType]);

    const filteredLogs = logs.filter(log => 
        log.recipient_number.includes(searchTerm) || 
        log.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.facture_numero?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'SENT': return <CheckCircle2 className="w-4 h-4 text-success" />;
            case 'FAILED': return <XCircle className="w-4 h-4 text-error" />;
            case 'READ': return <CheckCircle2 className="w-4 h-4 text-info fill-info/20" />;
            default: return <Clock className="w-4 h-4 text-warning" />;
        }
    };

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'SENT': return 'badge-success';
            case 'FAILED': return 'badge-error';
            case 'READ': return 'badge-info';
            default: return 'badge-warning';
        }
    };

    return (
        <div className="min-h-screen bg-base-200 p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-base-100 p-6 rounded-2xl shadow-sm border border-base-200">
                <div>
                    <h1 className="text-2xl font-black text-base-content flex items-center gap-3">
                        <div className="p-2 bg-success/10 rounded-lg">
                            <MessageCircle className="w-6 h-6 text-success" />
                        </div>
                        Historique WhatsApp
                    </h1>
                    <p className="text-base-content/60 text-sm mt-1">
                        Consultez tous les messages envoyés depuis le système (factures, rappels promis, etc.)
                    </p>
                </div>
                <button 
                    onClick={fetchLogs} 
                    className="btn btn-outline btn-sm gap-2 rounded-xl"
                    disabled={loading}
                >
                    <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Actualiser
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/40" />
                    <input 
                        type="text" 
                        placeholder="Rechercher par numéro, nom ou message..." 
                        className="input input-bordered w-full pl-12 rounded-xl bg-base-100 shadow-sm border-base-200"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select 
                    className="select select-bordered w-full rounded-xl bg-base-100 shadow-sm border-base-200"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                >
                    <option value="ALL">Tous les types</option>
                    <option value="FACTURE">Factures</option>
                    <option value="PROMIS">Rappels Promis</option>
                    <option value="MANUEL">Envois Manuels</option>
                </select>
            </div>

            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table w-full">
                        <thead>
                            <tr className="bg-base-200/50">
                                <th>Date & Expéditeur</th>
                                <th>Destinataire</th>
                                <th>Message</th>
                                <th>Type</th>
                                <th>Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-10">
                                        <span className="loading loading-spinner loading-lg text-primary"></span>
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-10 text-base-content/50">
                                        Aucun log trouvé
                                    </td>
                                </tr>
                            ) : filteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-base-200/30 transition-colors">
                                    <td>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-bold text-sm">
                                                {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                                            </span>
                                            <span className="text-xs flex items-center gap-1 text-base-content/60">
                                                <User className="w-3 h-3" /> {log.sent_by_name || 'Système'}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-bold text-sm">{log.recipient_name || 'Inconnu'}</span>
                                            <span className="text-xs flex items-center gap-1 font-mono text-base-content/70">
                                                <Phone className="w-3 h-3 text-success" /> {log.recipient_number}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="max-w-md">
                                            <p className="text-sm line-clamp-2" title={log.message}>{log.message}</p>
                                            {log.facture_numero && (
                                                <span className="badge badge-ghost badge-sm gap-1 mt-1 font-mono whitespace-nowrap">
                                                    <FileText className="w-2 h-2" /> {log.facture_numero}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <span className="badge badge-ghost badge-sm font-semibold">{log.type_display}</span>
                                    </td>
                                    <td>
                                        <div className={`badge ${getStatusClass(log.status)} badge-sm gap-1 font-bold text-[10px]`}>
                                            {getStatusIcon(log.status)}
                                            {log.status_display}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppHistory;
