import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface UserSession {
    id: number;
    user: number;
    username: string;
    full_name: string;
    date: string;
    first_login: string;
    last_logout: string | null;
    duration_display: string;
}

const UserSessions: React.FC = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [sessions, setSessions] = useState<UserSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [operators, setOperators] = useState<{id: number, username: string}[]>([]);

    useEffect(() => {
        fetchOperators();
        fetchSessions();
    }, []);

    const fetchOperators = async () => {
        try {
            const response = await axios.get('/api/users/operators/');
            setOperators(response.data);
        } catch (err) {
            console.error("Error fetching operators:", err);
        }
    };

    const fetchSessions = async () => {
        setLoading(true);
        try {
            let url = `/api/user-sessions/?ordering=-date,-first_login`;
            if (startDate) url += `&date_after=${startDate}`;
            if (endDate) url += `&date_before=${endDate}`; 
            if (startDate === endDate) {
                url = `/api/user-sessions/?date=${startDate}&ordering=-first_login`;
            }
            
            if (selectedUser) url += `&user=${selectedUser}`;
            
            const response = await axios.get(url);
            setSessions(response.data);
        } catch (err) {
            console.error("Error fetching sessions:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleFilter = (e: React.FormEvent) => {
        e.preventDefault();
        fetchSessions();
    };

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return '---';
        return format(new Date(dateStr), 'HH:mm:ss');
    };

    const formatDate = (dateStr: string) => {
        return format(new Date(dateStr), 'dd MMMM yyyy', { locale: fr });
    };

    return (
        <div className="flex-1 flex flex-col p-4 md:p-6 space-y-6 overflow-hidden bg-base-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-primary">{t('user_sessions.title')}</h1>
                    <p className="text-base-content/60">{t('user_sessions.subtitle')}</p>
                </div>

                <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-3 bg-base-200 p-4 rounded-xl shadow-sm border border-base-300">
                    <div className="form-control">
                        <label className="label py-1">
                            <span className="label-text text-xs font-bold uppercase opacity-70">{t('user_sessions.date')}</span>
                        </label>
                        <input 
                            type="date" 
                            className="input input-sm input-bordered focus:input-primary" 
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setEndDate(e.target.value);
                            }}
                        />
                    </div>

                    {user?.is_superuser && (
                        <div className="form-control">
                            <label className="label py-1">
                                <span className="label-text text-xs font-bold uppercase opacity-70">{t('user_sessions.operator')}</span>
                            </label>
                            <select 
                                className="select select-sm select-bordered focus:select-primary"
                                value={selectedUser}
                                onChange={(e) => setSelectedUser(e.target.value)}
                            >
                                <option value="">{t('user_sessions.all_operators')}</option>
                                {operators.map(op => (
                                    <option key={op.id} value={op.id}>{op.username}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button type="submit" className="btn btn-sm btn-primary px-6" disabled={loading}>
                        {loading ? <span className="loading loading-spinner loading-xs"></span> : t('user_sessions.filter')}
                    </button>
                </form>
            </div>

            <div className="flex-1 bg-base-200 rounded-2xl border border-base-300 shadow-xl overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="table table-zebra w-full">
                        <thead className="bg-base-300/50 sticky top-0 z-10">
                            <tr>
                                <th className="text-xs uppercase opacity-70">{t('user_sessions.operator')}</th>
                                <th className="text-xs uppercase opacity-70">{t('user_sessions.date')}</th>
                                <th className="text-xs uppercase opacity-70">{t('user_sessions.first_login')}</th>
                                <th className="text-xs uppercase opacity-70">{t('user_sessions.last_logout')}</th>
                                <th className="text-xs uppercase opacity-70">{t('user_sessions.duration')}</th>
                                <th className="text-xs uppercase opacity-70 text-right">{t('user_sessions.status')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-20">
                                        <span className="loading loading-spinner loading-lg text-primary"></span>
                                        <p className="mt-4 opacity-50">{t('user_sessions.loading')}</p>
                                    </td>
                                </tr>
                            ) : sessions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-20 opacity-50 italic">
                                        {t('user_sessions.no_result')}
                                    </td>
                                </tr>
                            ) : (
                                sessions.map(session => (
                                    <tr key={session.id} className="hover:bg-base-300/30 transition-colors group">
                                        <td className="font-bold">
                                            <div className="flex items-center gap-3">
                                                <div className="avatar placeholder">
                                                    <div className="bg-primary text-primary-content rounded-full w-8">
                                                        <span>{session.username.charAt(0).toUpperCase()}</span>
                                                    </div>
                                                </div>
                                                <span>{session.full_name}</span>
                                            </div>
                                        </td>
                                        <td>{formatDate(session.date)}</td>
                                        <td className="font-mono text-success">{formatTime(session.first_login)}</td>
                                        <td className="font-mono text-warning">{formatTime(session.last_logout)}</td>
                                        <td className="font-medium">{session.duration_display}</td>
                                        <td className="text-right">
                                            {session.last_logout ? (
                                                <span className="badge badge-sm badge-success py-3 px-4">{t('user_sessions.closed')}</span>
                                            ) : (
                                                <span className="badge badge-sm badge-info py-3 px-4 animate-pulse">{t('user_sessions.ongoing')}</span>
                                            )}
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

export default UserSessions;
