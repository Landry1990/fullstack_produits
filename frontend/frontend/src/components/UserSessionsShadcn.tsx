import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LogOut, Monitor, Users, Clock, CalendarDays, Search, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getLocale } from '../utils/dateUtils';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './shadcn/card';
import { Button } from './shadcn/button';
import { Input } from './shadcn/input';
import { Badge } from './shadcn/badge';
import { Tabs, TabsList, TabsTrigger } from './shadcn/tabs';

import { Label } from './ui/Label';
import { Select } from './ui/Select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/Table';

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

const UserSessionsShadcn: React.FC = () => {
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
  const [operators, setOperators] = useState<{ id: number; username: string }[]>([]);

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
      console.error('Error fetching operators:', err);
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
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecap = async () => {
    setLoading(true);
    try {
      const response = await api.get(
        `user-sessions/recap_mensuel/?month=${recapMonth}&year=${recapYear}`
      );
      setRecapData(response.data);
    } catch (err) {
      console.error('Error fetching recap:', err);
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
      console.error('Error during force logout:', err);
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
      locale: i18n.language === 'en' ? undefined : fr,
    });
  };

  const getMonthName = (monthValue: string) => {
    const months = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
    ];
    const monthKey = months[parseInt(monthValue) - 1];
    return t(`common:months.${monthKey}`);
  };

  return (
    <div className="min-h-screen bg-base-200 p-4 lg:p-6 space-y-6">
      {/* Header + Tabs */}
      <Card className="overflow-hidden">
        <CardHeader className="p-5 lg:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Users className="size-6 text-primary" />
              {t('sessions.title')}
            </CardTitle>
            <CardDescription>{t('sessions.subtitle')}</CardDescription>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'daily' | 'monthly')}
          >
            <TabsList className="grid w-full md:w-auto grid-cols-2">
              <TabsTrigger value="daily">{t('sessions.tabs.daily')}</TabsTrigger>
              <TabsTrigger value="monthly">{t('sessions.tabs.monthly')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent className="p-5 lg:p-6 bg-base-100">
          {activeTab === 'daily' ? (
            <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="session-date">{t('sessions.date')}</Label>
                <Input
                  id="session-date"
                  type="date"
                  lang={getLocale()}
                  className="w-full md:w-44"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setEndDate(e.target.value);
                  }}
                />
              </div>

              {user?.is_superuser && (
                <div className="space-y-1.5">
                  <Label htmlFor="session-operator">{t('sessions.operator')}</Label>
                  <Select
                    id="session-operator"
                    containerClassName="w-full md:w-56"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                  >
                    <option value="">{t('sessions.all_operators')}</option>
                    {operators.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.username}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                {t('common:filter')}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRecapFilter} className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="recap-month">{t('sessions.recap.month')}</Label>
                <Select
                  id="recap-month"
                  containerClassName="w-full md:w-44"
                  value={recapMonth}
                  onChange={(e) => setRecapMonth(e.target.value)}
                >
                  {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(
                    (m) => (
                      <option key={m} value={m}>
                        {getMonthName(m)}
                      </option>
                    )
                  )}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="recap-year">{t('sessions.recap.year')}</Label>
                <Select
                  id="recap-year"
                  containerClassName="w-full md:w-32"
                  value={recapYear}
                  onChange={(e) => setRecapYear(e.target.value)}
                >
                  {[2023, 2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y.toString()}>
                      {y}
                    </option>
                  ))}
                </Select>
              </div>

              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                {t('common:filter')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'daily' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('sessions.operator')}</TableHead>
                  <TableHead>{t('sessions.date')}</TableHead>
                  <TableHead>{t('sessions.workstation')}</TableHead>
                  <TableHead>{t('sessions.first_login')}</TableHead>
                  <TableHead>{t('sessions.last_logout')}</TableHead>
                  <TableHead>{t('sessions.duration')}</TableHead>
                  <TableHead className="text-right">{t('sessions.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="size-8 text-primary animate-spin" />
                        <p className="text-base-content/50 font-medium text-sm">{t('common:loading')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-base-content/50 italic">
                      {t('common:no_result')}
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 text-primary rounded-xl size-10 flex items-center justify-center font-bold text-sm border border-primary/20 shrink-0">
                            {session.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-base-content">{session.full_name}</div>
                            <div className="text-xs text-base-content/50">@{session.username}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-base-content/70 font-medium text-sm">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="size-3.5 text-base-content/40" />
                          {formatDate(session.date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-lg bg-base-200 flex items-center justify-center text-base-content/50">
                            <Monitor size={14} />
                          </div>
                          <span className="text-sm font-medium text-base-content/70">
                            {session.workstation || '---'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-emerald-600 text-sm">
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3.5 text-emerald-400" />
                          {formatTime(session.first_login)}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-amber-600 text-sm">
                        {formatTime(session.last_logout)}
                      </TableCell>
                      <TableCell className="font-semibold text-primary text-sm">
                        {session.duration_display || t('sessions.not_closed')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {session.last_logout ? (
                            <Badge variant="default">{t('sessions.closed')}</Badge>
                          ) : (
                            <>
                              {format(getServerDate(), 'yyyy-MM-dd') === session.date ? (
                                <Badge variant="default" className="animate-pulse">
                                  {t('sessions.ongoing')}
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  {t('sessions.not_closed')}
                                </Badge>
                              )}

                              {user?.is_superuser && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleForceLogout(session.id, session.username)}
                                  disabled={!!disconnectingId}
                                  className="text-error hover:bg-red-50"
                                  title={t('sessions.force_logout')}
                                >
                                  {disconnectingId === session.id ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <LogOut size={16} />
                                  )}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('sessions.operator')}</TableHead>
                  <TableHead className="text-center">{t('sessions.recap.days_present')}</TableHead>
                  <TableHead className="text-right">{t('sessions.recap.total_hours')}</TableHead>
                  <TableHead className="text-right">{t('sessions.recap.avg_hours')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="size-8 text-primary animate-spin" />
                        <p className="text-base-content/50 font-medium text-sm">{t('common:loading')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : recapData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-16 text-base-content/50 italic">
                      {t('common:no_result')}
                    </TableCell>
                  </TableRow>
                ) : (
                  recapData.map((stat) => (
                    <TableRow key={stat.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="bg-secondary/10 text-purple-600 rounded-xl size-11 flex items-center justify-center font-bold text-sm border border-purple-200 shrink-0">
                            {stat.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-base text-base-content">{stat.full_name}</div>
                            <div className="text-sm text-base-content/50">@{stat.username}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {stat.days_count} {t('sessions.recap.days_present')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-xl font-black text-primary tracking-tight">
                          {stat.total_duration_display}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm font-medium text-base-content/60">
                          <span className="text-xs uppercase opacity-40 mr-1">{t('sessions.recap.avg')}</span>
                          {stat.avg_duration_display}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
};

export default UserSessionsShadcn;
