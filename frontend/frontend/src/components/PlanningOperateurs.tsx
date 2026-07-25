import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays, Settings, FileText, Sparkles, Send, ChevronLeft, ChevronRight,
  Plane, Check, X, Clock, User, Loader2, RefreshCw, MessageSquare, Printer, Calendar,
} from 'lucide-react';
import planningService, {
  type ShiftConfig, type ShiftSchedule, type ShiftAssignment, type ShiftType,
  type LeaveRequest, type LeaveType, type LeaveBalance,
} from '../services/planningService';
import userService, { type SimpleUser } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './shadcn/tabs';
import { Badge } from './shadcn/badge';
import { Button } from './shadcn/button';
import { Input } from './shadcn/input';
import { Select } from './shadcn/select';
import { Textarea } from './shadcn/textarea';
import { Checkbox } from './shadcn/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './shadcn/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from './shadcn/dialog';
import {
  SHIFT_STYLES, LEAVE_STATUS_VARIANTS, LEAVE_TYPES,
  formatDateISO, getMonthName, getDaysInMonth, getWeekdayShort,
  getWeekDays, getWeekLabel, startOfWeek,
} from '../lib/planningHelpers';

// ── Config Tab ──

function ConfigTab() {
  const { t } = useTranslation('planning');
  const qc = useQueryClient();
  const { data: config, isLoading } = useQuery<ShiftConfig>({
    queryKey: ['shift-config'],
    queryFn: planningService.getConfig,
  });

  const [form, setForm] = useState<Partial<ShiftConfig>>({});

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<ShiftConfig>) => planningService.updateConfig(data),
    onSuccess: () => {
      toast.success(t('toast.config_saved'));
      qc.invalidateQueries({ queryKey: ['shift-config'] });
    },
    onError: () => toast.error(t('toast.config_error')),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="size-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  const update = (field: keyof ShiftConfig, value: string | number | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-lg">{t('config.title')}</CardTitle>
        <CardDescription>{t('config.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('config.work_days_before_rest')}</label>
          <Input
            type="number" min={1} max={14}
            value={form.work_days_before_rest ?? 5}
            onChange={e => update('work_days_before_rest', parseInt(e.target.value) || 5)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('config.rest_days')}</label>
          <Input
            type="number" min={1} max={14}
            value={form.rest_days ?? 2}
            onChange={e => update('rest_days', parseInt(e.target.value) || 2)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('config.guard_frequency')}</label>
          <Input
            type="number" min={1} max={30}
            value={form.guard_frequency_days ?? 7}
            onChange={e => update('guard_frequency_days', parseInt(e.target.value) || 7)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('config.annual_leave_days')}</label>
          <Input
            type="number" min={0} max={60}
            value={form.annual_leave_days ?? 26}
            onChange={e => update('annual_leave_days', parseInt(e.target.value) || 26)}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('config.shift_hours')}</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('config.morning_start')}</label>
            <Input type="time" value={form.morning_start ?? '08:00'} onChange={e => update('morning_start', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('config.morning_end')}</label>
            <Input type="time" value={form.morning_end ?? '16:00'} onChange={e => update('morning_end', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('config.night_start')}</label>
            <Input type="time" value={form.night_start ?? '16:00'} onChange={e => update('night_start', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('config.night_end')}</label>
            <Input type="time" value={form.night_end ?? '22:00'} onChange={e => update('night_end', e.target.value)} />
          </div>
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <Checkbox
          checked={form.rotate_shifts ?? true}
          onCheckedChange={(checked) => update('rotate_shifts', checked === true)}
        />
        <span className="text-sm text-slate-700 dark:text-slate-300">{t('config.rotate_shifts')}</span>
      </label>

        <Button
          className="w-full"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate(form)}
        >
          {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Settings size={18} />}
          {t('config.save')}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Planning Calendar Tab ──

function PlanningTab({ isAdmin }: { isAdmin: boolean }) {
  const { t, i18n } = useTranslation('planning');
  const qc = useQueryClient();
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR';
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date()));
  const effectiveMonth = useMemo(() => viewMode === 'week'
    ? new Date(currentWeek.getFullYear(), currentWeek.getMonth(), 1)
    : currentMonth,
  [viewMode, currentWeek, currentMonth]);
  const effectiveMonthISO = formatDateISO(effectiveMonth);
  const [editingCell, setEditingCell] = useState<{ userId: number; date: string } | null>(null);

  const { data: operators } = useQuery<SimpleUser[]>({
    queryKey: ['operators'],
    queryFn: userService.getAll,
  });

  const { data: schedule, isLoading } = useQuery<ShiftSchedule | null>({
    queryKey: ['shift-schedule', effectiveMonthISO],
    queryFn: () => planningService.getScheduleByMonth(effectiveMonthISO),
  });

  const createScheduleMutation = useMutation({
    mutationFn: () => planningService.createSchedule(effectiveMonthISO),
    onSuccess: () => {
      toast.success(t('toast.schedule_created'));
      qc.invalidateQueries({ queryKey: ['shift-schedule', effectiveMonthISO] });
    },
    onError: () => toast.error(t('toast.schedule_error')),
  });

  const generateMutation = useMutation({
    mutationFn: (id: number) => planningService.generateSchedule(id),
    onSuccess: () => {
      toast.success(t('toast.generated'));
      qc.invalidateQueries({ queryKey: ['shift-schedule', effectiveMonthISO] });
    },
    onError: () => toast.error(t('toast.generate_error')),
  });

  const generateFullMutation = useMutation({
    mutationFn: (id: number) => planningService.generateSchedule(id, 1),
    onSuccess: () => {
      toast.success(t('toast.generated_full'));
      qc.invalidateQueries({ queryKey: ['shift-schedule', effectiveMonthISO] });
    },
    onError: () => toast.error(t('toast.generate_error')),
  });

  const publishMutation = useMutation({
    mutationFn: (id: number) => planningService.publishSchedule(id),
    onSuccess: () => {
      toast.success(t('toast.published'));
      qc.invalidateQueries({ queryKey: ['shift-schedule', effectiveMonthISO] });
    },
    onError: () => toast.error(t('toast.publish_error')),
  });

  const sendToOperatorsMutation = useMutation({
    mutationFn: (id: number) => planningService.sendScheduleToOperators(id),
    onSuccess: (data) => {
      toast.success(t('toast.schedule_sent', { count: data.sent, month: data.month }));
    },
    onError: () => toast.error(t('toast.schedule_send_error')),
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: ({ scheduleId, data }: { scheduleId: number; data: { user_id: number; date: string; shift_type: ShiftType } }) =>
      planningService.updateAssignment(scheduleId, data),
    onSuccess: () => {
      toast.success(t('toast.assignment_updated'));
      qc.invalidateQueries({ queryKey: ['shift-schedule', effectiveMonthISO] });
      setEditingCell(null);
    },
    onError: () => toast.error(t('toast.assignment_error')),
  });

  const days = useMemo(() => viewMode === 'month'
    ? getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth())
    : getWeekDays(currentWeek),
  [viewMode, currentMonth, currentWeek]);

  const assignmentMap = useMemo(() => {
    const map: Record<string, ShiftAssignment> = {};
    if (schedule?.assignments) {
      for (const a of schedule.assignments) {
        map[`${a.user}_${a.date}`] = a;
      }
    }
    return map;
  }, [schedule]);

  const prevMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const prevWeek = () => setCurrentWeek(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
  const nextWeek = () => setCurrentWeek(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));

  const handleCellClick = (userId: number, date: string) => {
    if (!isAdmin || !schedule) return;
    setEditingCell({ userId, date });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShiftChange = (shiftType: ShiftType) => {
    if (!editingCell || !schedule) return;
    updateAssignmentMutation.mutate({
      scheduleId: schedule.id,
      data: { user_id: editingCell.userId, date: editingCell.date, shift_type: shiftType },
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          {viewMode === 'month' ? (
            <>
              <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft size={18} /></Button>
              <h3 className="text-lg font-semibold capitalize text-slate-800 dark:text-slate-200 min-w-[180px] text-center">
                {getMonthName(currentMonth, locale)}
              </h3>
              <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight size={18} /></Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon" onClick={prevWeek}><ChevronLeft size={18} /></Button>
              <h3 className="text-lg font-semibold capitalize text-slate-800 dark:text-slate-200 min-w-[180px] text-center">
                {getWeekLabel(days[0], days[6], locale)}
              </h3>
              <Button variant="ghost" size="icon" onClick={nextWeek}><ChevronRight size={18} /></Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('month')}
          >
            <Calendar size={16} className="mr-1" /> {t('planning.month_view')}
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('week')}
          >
            <CalendarDays size={16} className="mr-1" /> {t('planning.week_view')}
          </Button>
          {!schedule && isAdmin && (
            <Button
              size="sm"
              disabled={createScheduleMutation.isPending}
              onClick={() => createScheduleMutation.mutate()}
            >
              {createScheduleMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <CalendarDays size={16} />}
              {t('planning.create')}
            </Button>
          )}
          {schedule && isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={generateMutation.isPending}
                onClick={() => generateMutation.mutate(schedule.id)}
              >
                {generateMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles size={16} />}
                {t('planning.generate')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={generateFullMutation.isPending}
                onClick={() => generateFullMutation.mutate(schedule.id)}
              >
                {generateFullMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw size={16} />}
                {t('planning.generate_full')}
              </Button>
              {!schedule.is_published && (
                <Button
                  size="sm"
                  disabled={publishMutation.isPending}
                  onClick={() => publishMutation.mutate(schedule.id)}
                >
                  {publishMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send size={16} />}
                  {t('planning.publish')}
                </Button>
              )}
              {schedule.is_published && (
                <Badge variant="default" className="gap-1">
                  <Check size={12} /> {t('planning.published')}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={sendToOperatorsMutation.isPending}
                onClick={() => sendToOperatorsMutation.mutate(schedule.id)}
              >
                {sendToOperatorsMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare size={16} />}
                {t('planning.send_to_operators')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
              >
                <Printer size={16} /> {t('planning.print')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {(Object.keys(SHIFT_STYLES) as ShiftType[]).map(type => {
          const { Icon } = SHIFT_STYLES[type];
          return (
          <div key={type} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${SHIFT_STYLES[type].bg} ${SHIFT_STYLES[type].text}`}>
            <Icon size={14} />
            {t(SHIFT_STYLES[type].labelKey)}
          </div>
          );
        })}
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="size-8 text-emerald-600 animate-spin" /></div>
      ) : !schedule ? (
        <div className="text-center py-12 text-slate-400">
          <CalendarDays size={48} className="mx-auto mb-3 opacity-50" />
          <p>{t('planning.no_schedule')}{isAdmin ? t('planning.no_schedule_admin') : ''}</p>
        </div>
      ) : (
        <div id="planning-print-area" className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 print:border print:border-black print:bg-white">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300 min-w-[140px]">
                  {t('planning.operator')}
                </th>
                {days.map(day => {
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <th
                      key={day.toISOString()}
                      className={`px-1 py-2 text-center font-medium min-w-[40px] ${isWeekend ? 'text-red-400' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      <div className="text-[10px] uppercase">{getWeekdayShort(day, locale)}</div>
                      <div className="text-sm">{day.getDate()}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(operators || []).map(op => (
                <tr key={op.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-3 py-2 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {op.first_name || op.last_name ? `${op.first_name} ${op.last_name}`.trim() : op.username}
                  </td>
                  {days.map(day => {
                    const dateStr = formatDateISO(day);
                    const assignment = assignmentMap[`${op.id}_${dateStr}`];
                    const shiftType = assignment?.shift_type;
                    const style = shiftType ? SHIFT_STYLES[shiftType] : null;
                    return (
                      <td
                        key={dateStr}
                        className={`px-1 py-1 text-center cursor-${isAdmin ? 'pointer' : 'default'} ${isAdmin && schedule ? 'hover:ring-2 hover:ring-emerald-500/30' : ''}`}
                        onClick={() => handleCellClick(op.id, dateStr)}
                      >
                        {style && (
                          <div className={`inline-flex items-center justify-center w-7 h-7 rounded-md ${style.bg} ${style.text}`} title={t(style.labelKey)}>
                            <style.Icon size={14} />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Assignment Dialog */}
      <Dialog open={!!editingCell} onOpenChange={(open) => !open && setEditingCell(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('planning.edit_assignment')}</DialogTitle>
            <DialogDescription>
              {editingCell && (() => {
                const op = (operators || []).find(o => o.id === editingCell.userId);
                const name = op ? (op.first_name || op.last_name ? `${op.first_name} ${op.last_name}`.trim() : op.username) : '';
                return `${name} — ${t('planning.date_label')}: ${editingCell.date}`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(SHIFT_STYLES) as ShiftType[]).map(type => {
              const { Icon } = SHIFT_STYLES[type];
              return (
              <button
                key={type}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-emerald-500 transition-colors ${SHIFT_STYLES[type].bg} ${SHIFT_STYLES[type].text}`}
                onClick={() => handleShiftChange(type)}
                disabled={updateAssignmentMutation.isPending}
              >
                <Icon size={14} />
                <span className="text-sm font-medium">{t(SHIFT_STYLES[type].labelKey)}</span>
              </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Leave Requests Tab ──

function LeavesTab({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation('planning');
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    leave_type: 'CONGE' as LeaveType,
    notes: '',
  });

  const { data: leaves, isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ['leave-requests', isAdmin],
    queryFn: () => planningService.getLeaveRequests({}),
  });

  const { data: balance } = useQuery<LeaveBalance>({
    queryKey: ['leave-balance'],
    queryFn: planningService.getLeaveBalance,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => planningService.createLeaveRequest(data),
    onSuccess: () => {
      toast.success(t('toast.leave_created'));
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
      setShowForm(false);
      setFormData({ start_date: '', end_date: '', leave_type: 'CONGE', notes: '' });
    },
    onError: () => toast.error(t('toast.leave_error')),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => planningService.approveLeave(id),
    onSuccess: () => {
      toast.success(t('toast.leave_approved'));
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
    },
    onError: () => toast.error(t('toast.leave_error')),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => planningService.rejectLeave(id),
    onSuccess: () => {
      toast.success(t('toast.leave_rejected'));
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
    },
    onError: () => toast.error(t('toast.leave_error')),
  });

  return (
    <div className="space-y-4">
      {/* Balance card */}
      {balance && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-xs text-slate-500 mb-1">{t('leaves.annual_days')}</div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{balance.annual_days}{t('leaves.days_count')}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-slate-500 mb-1">{t('leaves.used_days')}</div>
            <div className="text-2xl font-bold text-amber-600">{balance.used_days}{t('leaves.days_count')}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-slate-500 mb-1">{t('leaves.pending_days')}</div>
            <div className="text-2xl font-bold text-blue-600">{balance.pending_days}{t('leaves.days_count')}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-slate-500 mb-1">{t('leaves.remaining_days')}</div>
            <div className="text-2xl font-bold text-emerald-600">{balance.remaining_days}{t('leaves.days_count')}</div>
          </Card>
        </div>
      )}

      {/* New leave button */}
      {!isAdmin && (
        <Button size="sm" onClick={() => setShowForm(true)}>
          <FileText size={16} /> {t('leaves.new_request')}
        </Button>
      )}

      {/* Leave form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('leaves.new_request_title')}</DialogTitle>
            <DialogDescription>{t('leaves.new_request_desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('leaves.start_date')}</label>
                <Input type="date" value={formData.start_date} onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('leaves.end_date')}</label>
                <Input type="date" value={formData.end_date} onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('leaves.type')}</label>
              <Select value={formData.leave_type} onChange={e => setFormData(prev => ({ ...prev, leave_type: e.target.value as LeaveType }))}>
                {LEAVE_TYPES.map(lt => (
                  <option key={lt} value={lt}>{t(`leaves.leave_types.${lt}`)}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('leaves.notes')}</label>
              <Textarea rows={2} value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowForm(false)}>{t('leaves.cancel')}</Button>
            <Button
              disabled={createMutation.isPending || !formData.start_date || !formData.end_date}
              onClick={() => createMutation.mutate(formData)}
            >
              {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check size={16} />}
              {t('leaves.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave requests list */}
      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="size-8 text-emerald-600 animate-spin" /></div>
      ) : !leaves || leaves.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Plane size={48} className="mx-auto mb-3 opacity-50" />
          <p>{t('leaves.no_leaves')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaves.map(leave => {
            const statusVariant = LEAVE_STATUS_VARIANTS[leave.status] || LEAVE_STATUS_VARIANTS.PENDING;
            return (
              <Card key={leave.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <User size={18} className="text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {leave.user_detail?.full_name || leave.user_detail?.username || t('planning.operator')}
                    </div>
                    <div className="text-sm text-slate-500 flex items-center gap-2">
                      <Clock size={12} />
                      {leave.start_date} → {leave.end_date}
                      <span className="text-xs">({leave.days_count}{t('leaves.days_count')})</span>
                    </div>
                    {leave.notes && <div className="text-xs text-slate-400 mt-0.5 truncate">{leave.notes}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className="text-xs">{t(`leaves.leave_types.${leave.leave_type}`)}</Badge>
                  <Badge variant={statusVariant} className="text-xs">{t(`leaves.status.${leave.status}`)}</Badge>
                  {isAdmin && leave.status === 'PENDING' && (
                    <div className="flex gap-1">
                      <Button variant="default" size="sm" className="h-7 w-7 p-0" onClick={() => approveMutation.mutate(leave.id)}>
                        <Check size={14} />
                      </Button>
                      <Button variant="destructive" size="sm" className="h-7 w-7 p-0" onClick={() => rejectMutation.mutate(leave.id)}>
                        <X size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

export default function PlanningOperateurs() {
  const { t } = useTranslation('planning');
  const { user } = useAuth();
  const isAdmin = !!user?.is_superuser;
  const [activeTab, setActiveTab] = useState<'planning' | 'conges' | 'config'>('planning');

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 gap-4 font-sans">
      <Card className="flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{t('title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('subtitle')}
          </p>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList>
              <TabsTrigger value="planning" className="gap-1.5">
                <CalendarDays size={16} /> {t('tabs.planning')}
              </TabsTrigger>
              <TabsTrigger value="conges" className="gap-1.5">
                <Plane size={16} /> {t('tabs.leaves')}
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="config" className="gap-1.5">
                  <Settings size={16} /> {t('tabs.config')}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="planning" className="p-6 overflow-auto">
              <PlanningTab isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="conges" className="p-6 overflow-auto">
              <LeavesTab isAdmin={isAdmin} />
            </TabsContent>
            {isAdmin && (
              <TabsContent value="config" className="p-6 overflow-auto">
                <ConfigTab />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </Card>
    </div>
  );
}
