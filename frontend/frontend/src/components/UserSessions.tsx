import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
    LogOut, Monitor 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getLocale } from '../utils/dateUtils';

interface UserSession {
    id: number;
    user: number;
    username: string;
    full_name: string;
    date: string;
    first_login: string;
    last_logout: string | null;
    duration_display: string;
    workstation: string | null;
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
    const { t, i18n } = useTranslation(['users', 'common']);
    const { user, getServerDate } = useAuth();
    const [sessions, setSessions] = useState<UserSession[]>([]);
    const [recapData, setRecapData] = useState<RecapStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');
    const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
    
    // Daily filters
    const [startDate, setStartDate] = useState(() => format(getServerDate(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(() => format(getServerDate(), 'yyyy-MM-dd'));
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [operators, setOperators] = useState<{id: number, username: string}[]>([]);

    // Monthly recap filters
    const [recapMonth, setRecapMonth] = useState<string>(() => format(getServerDate(), 'MM'));
    const [recapYear, setRecapYear] = useState<string>(() => format(getServerDate(), 'yyyy'));

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
            const response = await api.get('users/operators/');
            setOperators(response.data);
        } catch (err) {
            console.error("Error fetching operators:", err);
        }
    };

    const fetchSessions = async () => {
        setLoading(true);
        try {
            let url = `user-sessions/?ordering=-date,-first_login`;
            if (startDate) url += `&date_after=${startDate}`;
            if (endDate) url += `&date_before=${endDate}`; 
            if (startDate === endDate) {
                url = `user-sessions/?date=${startDate}&ordering=-first_login`;
            }
            
            if (selectedUser) url += `&user=${selectedUser}`;
            
            const response = await api.get(url);
            const sessionData = Array.isArray(response.data) ? response.data : response.data.results;
            setSessions(sessionData || []);
        } catch (err) {
            console.error("Error fetching sessions:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchRecap = async () => {
        setLoading(true);
        try {
            const response = await api.get(`user-sessions/recap_mensuel/?month=${recapMonth}&year=${recapYear}`);
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

    const handleForceLogout = async (sessionId: number, username: string) => {
        if (!window.confirm(t('sessions.force_logout_confirm', { username }))) {
            return;
        }

        setDisconnectingId(sessionId);
        try {
            await api.post(`user-sessions/${sessionId}/force_logout/`);
            toast.success(t('sessions.force_logout_success', { username }));
            fetchSessions();
        } catch (err) {
            console.error("Error during force logout:", err);
            toast.error(t('sessions.force_logout_error'));
        } finally {
            setDisconnectingId(null);
        }
    };

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return '---';
        return format(new Date(dateStr), 'HH:mm:ss');
    };

    const formatDate = (dateStr: string) => {
        return format(new Date(dateStr), 'dd MMMM yyyy', { 
            locale: i18n.language === 'en' ? undefined : fr 
        });
    };

    const getMonthName = (monthValue: string) => {
        const months = [
            'january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'
        ];
        const monthKey = months[parseInt(monthValue) - 1];
        return t(`common:months.${monthKey}`);
    };

    return (
        <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans">
            
            <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-base-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-2xl font-bold text-base-content tracking-tight">{t('sessions.title')}</h1>
                        <p className="text-base-content/60 text-sm mt-1">{t('sessions.subtitle')}</p>
                    </div>

                    <div className="tabs tabs-boxed bg-base-200 gap-1 p-1 self-start md:self-center">
                        <button 
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'daily' ? 'tab-active !bg-primary !text-primary-content font-bold shadow-sm' : 'hover:bg-base-300'}`}
                            onClick={() => setActiveTab('daily')}
                        >
                            {t('sessions.tabs.daily')}
                        </button>
                        <button 
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'monthly' ? 'tab-active !bg-primary !text-primary-content font-bold shadow-sm' : 'hover:bg-base-300'}`}
                            onClick={() => setActiveTab('monthly')}
                        >
                            {t('sessions.tabs.monthly')}
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {activeTab === 'daily' ? (
                        <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="flex flex-col gap-0.5 py-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/60 font-mono">{t('sessions.date')}</span>
                                </label>
                                <input 
                                    type="date"
                                    lang={getLocale()} 
                                    className="w-full md:w-44 rounded-lg border border-base-300 bg-base-100 h-10 px-3 text-sm font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        setEndDate(e.target.value);
                                    }}
                                />
                            </div>

                            {user?.is_superuser && (
                                <div className="flex flex-col gap-1">
                                    <label className="flex flex-col gap-0.5 py-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/60 font-mono">{t('sessions.operator')}</span>
                                    </label>
                                    <select 
                                        className="w-full md:w-56 rounded-lg border border-base-300 bg-base-100 h-10 px-3 text-sm font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                        value={selectedUser}
                                        onChange={(e) => setSelectedUser(e.target.value)}
                                    >
                                        <option value="">{t('sessions.all_operators')}</option>
                                        {operators.map(op => (
                                            <option key={op.id} value={op.id}>{op.username}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <button type="submit" className="inline-flex items-center justify-center h-10 px-8 bg-primary text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-primary-focus transition-all" disabled={loading}>
                                {loading ? <span className="inline-block size-4 border-2 border-base-300 border-t-indigo-600 rounded-full animate-spin"></span> : t('common:filter')}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleRecapFilter} className="flex flex-wrap items-end gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="flex flex-col gap-0.5 py-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/60 font-mono">{t('sessions.recap.month')}</span>
                                </label>
                                <select 
                                    className="w-full md:w-44 rounded-lg border border-base-300 bg-base-100 h-10 px-3 text-sm font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                    value={recapMonth}
                                    onChange={(e) => setRecapMonth(e.target.value)}
                                >
                                    {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                                        <option key={m} value={m}>{getMonthName(m)}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="flex flex-col gap-0.5 py-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/60 font-mono">{t('sessions.recap.year')}</span>
                                </label>
                                <select 
                                    className="w-full md:w-32 rounded-lg border border-base-300 bg-base-100 h-10 px-3 text-sm font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                                    value={recapYear}
                                    onChange={(e) => setRecapYear(e.target.value)}
                                >
                                    {[2023, 2024, 2025, 2026, 2027].map(y => (
                                        <option key={y} value={y.toString()}>{y}</option>
                                    ))}
                                </select>
                            </div>

                            <button type="submit" className="inline-flex items-center justify-center h-10 px-8 bg-primary text-white text-sm font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-primary-focus transition-all" disabled={loading}>
                                {loading ? <span className="inline-block size-4 border-2 border-base-300 border-t-indigo-600 rounded-full animate-spin"></span> : t('common:filter')}
                            </button>
                        </form>
                    )}
                </div>
            </div>

            <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 overflow-hidden">
                <div className="overflow-x-auto">
                    {activeTab === 'daily' ? (
                        <table className="w-full text-sm border-separate border-spacing-0">
                            <thead>
                                <tr className="bg-base-200/50">
                                    <th className="text-xs uppercase font-bold text-base-content/60 py-4 px-6">{t('sessions.operator')}</th>
                                    <th className="text-xs uppercase font-bold text-base-content/60 py-4 px-6">{t('sessions.date')}</th>
                                    <th className="text-xs uppercase font-bold text-base-content/60 py-4 px-6">{t('sessions.workstation')}</th>
                                    <th className="text-xs uppercase font-bold text-base-content/60 py-4 px-6">{t('sessions.first_login')}</th>
                                    <th className="text-xs uppercase font-bold text-base-content/60 py-4 px-6">{t('sessions.last_logout')}</th>
                                    <th className="text-xs uppercase font-bold text-base-content/60 py-4 px-6">{t('sessions.duration')}</th>
                                    <th className="text-xs uppercase font-bold text-base-content/60 py-4 px-6 text-right">{t('sessions.status')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-base-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-20">
                                            <span className="loading loading-spinner loading-lg text-primary"></span>
                                            <p className="mt-4 text-base-content/50 font-medium">{t('common:loading')}</p>
                                        </td>
                                    </tr>
                                ) : sessions.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-20 text-base-content/50 italic">
                                            {t('common:no_result')}
                                        </td>
                                    </tr>
                                ) : (
                                    sessions.map(session => (
                                        <tr key={session.id} className="hover:bg-base-200/50 transition-colors group">
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="inline-flex items-center justify-center">
                                                        <div className="bg-primary/10 text-primary rounded-xl size-10 flex items-center justify-center font-bold border border-indigo-200">
                                                            <span>{session.username.charAt(0).toUpperCase()}</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-base-content">{session.full_name}</div>
                                                        <div className="text-xs text-base-content/50">@{session.username}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-base-content/60 font-medium">{formatDate(session.date)}</td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="size-8 rounded-lg bg-base-200 flex items-center justify-center text-base-content/50">
                                                        <Monitor size={14} />
                                                    </div>
                                                    <span className="text-sm font-medium text-base-content/60">
                                                        {session.workstation || '---'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 font-mono font-bold text-success">{formatTime(session.first_login)}</td>
                                            <td className="py-4 px-6 font-mono font-bold text-warning">{formatTime(session.last_logout)}</td>
                                            <td className="py-4 px-6 font-semibold text-primary">
                                                {session.duration_display ? session.duration_display : t('sessions.not_closed')}
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {session.last_logout ? (
                                                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-success/10 text-success border border-emerald-200">
                                                            <div className="size-1.5 rounded-full bg-emerald-700 text-base-content/50"></div>
                                                            {t('sessions.closed')}
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {format(getServerDate(), 'yyyy-MM-dd') === session.date ? (
                                                                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-info/10 text-info border border-blue-200 animate-pulse">
                                                                    <div className="size-1.5 rounded-full bg-blue-700"></div>
                                                                    {t('sessions.ongoing')}
                                                                </div>
                                                            ) : (
                                                                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-base-200 text-base-content/50 border border-base-300 text-base-content/50">
                                                                    <div className="size-1.5 rounded-full bg-gray-500 text-base-content/30"></div>
                                                                    {t('sessions.not_closed')}
                                                                </div>
                                                            )}
                                                            
                                                            {user?.is_superuser && (
                                                                <button 
                                                                    className={`btn btn-circle btn-ghost btn-xs text-error hover:bg-error/10 ${disconnectingId === session.id ? 'loading' : ''}`}
                                                                    title={t('sessions.force_logout')}
                                                                    onClick={() => handleForceLogout(session.id, session.username)}
                                                                    disabled={!!disconnectingId}
                                                                >
                                                                    {disconnectingId !== session.id && <LogOut size={16} />}
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-sm border-separate border-spacing-0">
                            <thead>
                                <tr className="bg-base-200/50">
                                    <th className="text-xs uppercase font-bold text-base-content/60 py-4 px-6">{t('sessions.operator')}</th>
                                    <th className="text-xs uppercase font-bold text-base-content/60 py-4 px-6 text-center">{t('sessions.recap.days_present')}</th>
                                    <th className="text-xs uppercase font-bold text-base-content/60 py-4 px-6 text-right">{t('sessions.recap.total_hours')}</th>
                                    <th className="text-xs uppercase font-bold text-base-content/60 py-4 px-6 text-right">{t('sessions.recap.avg_hours')}</th>
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
                                        <td colSpan={4} className="text-center py-20 text-base-content/50 italic">
                                            {t('common:no_result')}
                                        </td>
                                    </tr>
                                ) : (
                                    recapData.map(stat => (
                                        <tr key={stat.user_id} className="hover:bg-base-200/50 transition-colors">
                                            <td className="py-5 px-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="inline-flex items-center justify-center">
                                                        <div className="bg-secondary/10 text-purple-600 rounded-xl size-12 flex items-center justify-center font-bold border border-purple-200">
                                                            <span>{stat.username.charAt(0).toUpperCase()}</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-lg text-base-content">{stat.full_name}</div>
                                                        <div className="text-sm text-base-content/50">@{stat.username}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-5 px-6 text-center">
                                                <div className="badge badge-lg bg-base-200 text-base-content font-bold border-none h-10 px-6">
                                                    {stat.days_count} {t('sessions.recap.days_present')}
                                                </div>
                                            </td>
                                            <td className="py-5 px-6 text-right">
                                                <div className="text-xl font-black text-primary tracking-tight">
                                                    {stat.total_duration_display}
                                                </div>
                                            </td>
                                            <td className="py-5 px-6 text-right">
                                                <div className="text-sm font-medium text-base-content/60">
                                                    <span className="text-xs uppercase opacity-40 mr-1">{t('sessions.recap.avg')}</span> {stat.avg_duration_display}
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
