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

interface RecapStats {
    user_id: number;
    username: string;
    full_name: string;
    days_count: number;
    total_hours: number;
    total_minutes: number;
    total_duration_display: string;
    avg_duration_display: string;
}

const UserSessions: React.FC = () => {
    const { t } = useTranslation();
    const { user, getServerDate } = useAuth();
    const [sessions, setSessions] = useState<UserSession[]>([]);
    const [recapData, setRecapData] = useState<RecapStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');
    
    // Daily filters
    const [startDate, setStartDate] = useState(format(getServerDate(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(getServerDate(), 'yyyy-MM-dd'));
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [operators, setOperators] = useState<{id: number, username: string}[]>([]);

    // Monthly recap filters
    const [recapMonth, setRecapMonth] = useState<string>(format(getServerDate(), 'MM'));
    const [recapYear, setRecapYear] = useState<string>(format(getServerDate(), 'yyyy'));

    useEffect(() => {
        fetchOperators();
        if (activeTab === 'daily') {
            fetchSessions();
        } else {
            fetchRecap();
        }
    }, [activeTab]);

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

    const fetchRecap = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`/api/user-sessions/recap_mensuel/?month=${recapMonth}&year=${recapYear}`);
            setRecapData(response.data);
        } catch (err) {
            console.error("Error fetching recap:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleFilter = (e: React.FormEvent) => {
        e.preventDefault();
        fetchSessions();
    };

    const handleRecapFilter = (e: React.FormEvent) => {
        e.preventDefault();
        fetchRecap();
    };

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return '---';
        return format(new Date(dateStr), 'HH:mm:ss');
    };

    const formatDate = (dateStr: string) => {
        return format(new Date(dateStr), 'dd MMMM yyyy', { locale: fr });
    };

    return (
        <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans">
            
            {/* Header section with title and tabs */}
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-base-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-2xl font-bold text-base-content tracking-tight">{t('user_sessions.title')}</h1>
                        <p className="text-base-content/60 text-sm mt-1">{t('user_sessions.subtitle')}</p>
                    </div>

                    <div className="tabs tabs-boxed bg-base-200 gap-1 p-1 self-start md:self-center">
                        <button 
                            className={`tab tab-sm md:tab-md transition-all duration-200 ${activeTab === 'daily' ? 'tab-active !bg-primary !text-primary-content font-bold shadow-sm' : 'hover:bg-base-300'}`}
                            onClick={() => setActiveTab('daily')}
                        >
                            {t('user_sessions.tabs.daily')}
                        </button>
                        <button 
                            className={`tab tab-sm md:tab-md transition-all duration-200 ${activeTab === 'monthly' ? 'tab-active !bg-primary !text-primary-content font-bold shadow-sm' : 'hover:bg-base-300'}`}
                            onClick={() => setActiveTab('monthly')}
                        >
                            {t('user_sessions.tabs.monthly')}
                        </button>
                    </div>
                </div>

                {/* Filters section */}
                <div className="p-6">
                    {activeTab === 'daily' ? (
                        <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-4">
                            <div className="form-control">
                                <label className="label py-1">
                                    <span className="label-text text-xs font-bold uppercase opacity-60 tracking-wider font-mono">{t('user_sessions.date')}</span>
                                </label>
                                <input 
                                    type="date" 
                                    className="input input-bordered input-sm focus:input-primary h-10 w-full md:w-44" 
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
                                        <span className="label-text text-xs font-bold uppercase opacity-60 tracking-wider font-mono">{t('user_sessions.operator')}</span>
                                    </label>
                                    <select 
                                        className="select select-bordered select-sm focus:select-primary h-10 w-full md:w-56"
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

                            <button type="submit" className="btn btn-primary btn-sm h-10 px-8 font-bold shadow-md hover:shadow-lg transition-all" disabled={loading}>
                                {loading ? <span className="loading loading-spinner loading-xs"></span> : t('user_sessions.filter')}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleRecapFilter} className="flex flex-wrap items-end gap-4">
                            <div className="form-control">
                                <label className="label py-1">
                                    <span className="label-text text-xs font-bold uppercase opacity-60 tracking-wider font-mono">{t('user_sessions.recap.month')}</span>
                                </label>
                                <select 
                                    className="select select-bordered select-sm focus:select-primary h-10 w-full md:w-44"
                                    value={recapMonth}
                                    onChange={(e) => setRecapMonth(e.target.value)}
                                >
                                    <option value="01">Janvier</option>
                                    <option value="02">Février</option>
                                    <option value="03">Mars</option>
                                    <option value="04">Avril</option>
                                    <option value="05">Mai</option>
                                    <option value="06">Juin</option>
                                    <option value="07">Juillet</option>
                                    <option value="08">Août</option>
                                    <option value="09">Septembre</option>
                                    <option value="10">Octobre</option>
                                    <option value="11">Novembre</option>
                                    <option value="12">Décembre</option>
                                </select>
                            </div>

                            <div className="form-control">
                                <label className="label py-1">
                                    <span className="label-text text-xs font-bold uppercase opacity-60 tracking-wider font-mono">{t('user_sessions.recap.year')}</span>
                                </label>
                                <select 
                                    className="select select-bordered select-sm focus:select-primary h-10 w-full md:w-32"
                                    value={recapYear}
                                    onChange={(e) => setRecapYear(e.target.value)}
                                >
                                    {[2023, 2024, 2025, 2026, 2027].map(y => (
                                        <option key={y} value={y.toString()}>{y}</option>
                                    ))}
                                </select>
                            </div>

                            <button type="submit" className="btn btn-primary btn-sm h-10 px-8 font-bold shadow-md hover:shadow-lg transition-all" disabled={loading}>
                                {loading ? <span className="loading loading-spinner loading-xs"></span> : t('user_sessions.filter')}
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {/* Main Content: Table section */}
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden">
                <div className="overflow-x-auto">
                    {activeTab === 'daily' ? (
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-base-200/50">
                                    <th className="text-xs uppercase font-bold text-base-content/50 py-4 px-6">{t('user_sessions.operator')}</th>
                                    <th className="text-xs uppercase font-bold text-base-content/50 py-4 px-6">{t('user_sessions.date')}</th>
                                    <th className="text-xs uppercase font-bold text-base-content/50 py-4 px-6">{t('user_sessions.first_login')}</th>
                                    <th className="text-xs uppercase font-bold text-base-content/50 py-4 px-6">{t('user_sessions.last_logout')}</th>
                                    <th className="text-xs uppercase font-bold text-base-content/50 py-4 px-6">{t('user_sessions.duration')}</th>
                                    <th className="text-xs uppercase font-bold text-base-content/50 py-4 px-6 text-right">{t('user_sessions.status')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-base-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-20">
                                            <span className="loading loading-spinner loading-lg text-primary"></span>
                                            <p className="mt-4 text-base-content/40 font-medium">{t('user_sessions.loading')}</p>
                                        </td>
                                    </tr>
                                ) : sessions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-20 text-base-content/40 italic">
                                            {t('user_sessions.no_result')}
                                        </td>
                                    </tr>
                                ) : (
                                    sessions.map(session => (
                                        <tr key={session.id} className="hover:bg-base-200/50 transition-colors group">
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="avatar placeholder">
                                                        <div className="bg-primary/10 text-primary rounded-xl w-10 h-10 flex items-center justify-center font-bold border border-primary/20">
                                                            <span>{session.username.charAt(0).toUpperCase()}</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-base-content">{session.full_name}</div>
                                                        <div className="text-xs text-base-content/40">@{session.username}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-base-content/70 font-medium">{formatDate(session.date)}</td>
                                            <td className="py-4 px-6 font-mono font-bold text-success">{formatTime(session.first_login)}</td>
                                            <td className="py-4 px-6 font-mono font-bold text-warning">{formatTime(session.last_logout)}</td>
                                            <td className="py-4 px-6 font-semibold text-primary">{session.duration_display}</td>
                                            <td className="py-4 px-6 text-right">
                                                {session.last_logout ? (
                                                    <div className="badge badge-success badge-sm gap-1 py-3 px-3">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-success-content opacity-50"></div>
                                                        {t('user_sessions.closed')}
                                                    </div>
                                                ) : (
                                                    format(getServerDate(), 'yyyy-MM-dd') === session.date ? (
                                                        <div className="badge badge-info badge-sm gap-1 py-3 px-4 animate-pulse">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-info-content"></div>
                                                            {t('user_sessions.ongoing')}
                                                        </div>
                                                    ) : (
                                                        <div className="badge badge-ghost badge-sm gap-1 py-3 px-4 opacity-50 border border-base-content/20">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-base-content opacity-30"></div>
                                                            {t('user_sessions.not_closed')}
                                                        </div>
                                                    )
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr className="bg-base-200/50">
                                    <th className="text-xs uppercase font-bold text-base-content/50 py-4 px-6">{t('user_sessions.operator')}</th>
                                    <th className="text-xs uppercase font-bold text-base-content/50 py-4 px-6 text-center">{t('user_sessions.recap.days_present')}</th>
                                    <th className="text-xs uppercase font-bold text-base-content/50 py-4 px-6 text-right">{t('user_sessions.recap.total_hours')}</th>
                                    <th className="text-xs uppercase font-bold text-base-content/50 py-4 px-6 text-right">{t('user_sessions.recap.avg_hours')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-base-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-20">
                                            <span className="loading loading-spinner loading-lg text-primary"></span>
                                        </td>
                                    </tr>
                                ) : recapData.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-20 text-base-content/40 italic">
                                            {t('user_sessions.no_result')}
                                        </td>
                                    </tr>
                                ) : (
                                    recapData.map(stat => (
                                        <tr key={stat.user_id} className="hover:bg-base-200/50 transition-colors">
                                            <td className="py-5 px-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="avatar placeholder">
                                                        <div className="bg-secondary/10 text-secondary rounded-xl w-12 h-12 flex items-center justify-center font-bold border border-secondary/20">
                                                            <span>{stat.username.charAt(0).toUpperCase()}</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-lg text-base-content">{stat.full_name}</div>
                                                        <div className="text-sm text-base-content/40">@{stat.username}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-5 px-6 text-center">
                                                <div className="badge badge-lg bg-base-200 text-base-content font-bold border-none h-10 px-6">
                                                    {stat.days_count} jours
                                                </div>
                                            </td>
                                            <td className="py-5 px-6 text-right">
                                                <div className="text-xl font-black text-primary tracking-tight">
                                                    {stat.total_duration_display}
                                                </div>
                                            </td>
                                            <td className="py-5 px-6 text-right">
                                                <div className="text-sm font-medium text-base-content/60">
                                                    <span className="text-xs uppercase opacity-40 mr-1">Moy:</span> {stat.avg_duration_display}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserSessions;
