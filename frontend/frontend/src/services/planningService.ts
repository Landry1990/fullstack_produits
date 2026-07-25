import api from './api';

// ── Types ──

export interface ShiftConfig {
  id: number;
  work_days_before_rest: number;
  rest_days: number;
  rotate_shifts: boolean;
  guard_frequency_days: number;
  morning_start: string;
  morning_end: string;
  night_start: string;
  night_end: string;
  annual_leave_days: number;
}

export interface SimpleUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
}

export type ShiftType = 'MATIN' | 'NUIT' | 'GARDE' | 'REPOS' | 'CONGE';

export interface ShiftAssignment {
  id: number;
  schedule: number;
  user: number;
  user_detail?: SimpleUser;
  date: string;
  shift_type: ShiftType;
  notes: string;
}

export interface ShiftSchedule {
  id: number;
  month: string;
  is_published: boolean;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  assignments: ShiftAssignment[];
}

export type LeaveType = 'CONGE' | 'MALADIE' | 'SANS_SOLDE' | 'AUTRE';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveRequest {
  id: number;
  user: number;
  user_detail?: SimpleUser;
  start_date: string;
  end_date: string;
  leave_type: LeaveType;
  status: LeaveStatus;
  notes: string;
  approved_by: number | null;
  approved_by_name: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  days_count: number;
}

export interface LeaveBalance {
  annual_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
}

// ── Service ──

const planningService = {
  // Config
  getConfig: async (): Promise<ShiftConfig> => {
    const res = await api.get<ShiftConfig>('shift-config/');
    return res.data;
  },
  updateConfig: async (data: Partial<ShiftConfig>): Promise<ShiftConfig> => {
    const res = await api.post<ShiftConfig>('shift-config/', data);
    return res.data;
  },

  // Schedules
  getSchedules: async (): Promise<ShiftSchedule[]> => {
    const res = await api.get<unknown>('shift-schedules/');
    const data = res.data as ShiftSchedule[] | { results: ShiftSchedule[] };
    return Array.isArray(data) ? data : (data.results || []);
  },
  getSchedule: async (id: number): Promise<ShiftSchedule> => {
    const res = await api.get<ShiftSchedule>(`shift-schedules/${id}/`);
    return res.data;
  },
  getScheduleByMonth: async (month: string): Promise<ShiftSchedule | null> => {
    const res = await api.get<unknown>('shift-schedules/', { params: { month } });
    const data = res.data as ShiftSchedule[] | { results: ShiftSchedule[] };
    const list = Array.isArray(data) ? data : (data.results || []);
    return list.length > 0 ? list[0] : null;
  },
  createSchedule: async (month: string): Promise<ShiftSchedule> => {
    const res = await api.post<ShiftSchedule>('shift-schedules/', { month });
    return res.data;
  },
  generateSchedule: async (id: number, fromDay?: number): Promise<ShiftSchedule> => {
    const data = fromDay !== undefined ? { from_day: fromDay } : undefined;
    const res = await api.post<ShiftSchedule>(`shift-schedules/${id}/generate/`, data);
    return res.data;
  },
  publishSchedule: async (id: number): Promise<ShiftSchedule> => {
    const res = await api.patch<ShiftSchedule>(`shift-schedules/${id}/publish/`);
    return res.data;
  },
  sendScheduleToOperators: async (id: number): Promise<{ sent: number; month: string }> => {
    const res = await api.post<{ sent: number; month: string }>(`shift-schedules/${id}/send_to_operators/`);
    return res.data;
  },
  updateAssignment: async (
    scheduleId: number,
    data: { user_id: number; date: string; shift_type: ShiftType; notes?: string }
  ): Promise<ShiftAssignment> => {
    const res = await api.post<ShiftAssignment>(
      `shift-schedules/${scheduleId}/update_assignment/`, data
    );
    return res.data;
  },

  // Leave requests
  getLeaveRequests: async (params?: Record<string, unknown>): Promise<LeaveRequest[]> => {
    const res = await api.get<unknown>('leave-requests/', { params });
    const data = res.data as LeaveRequest[] | { results: LeaveRequest[] };
    return Array.isArray(data) ? data : (data.results || []);
  },
  createLeaveRequest: async (data: {
    start_date: string;
    end_date: string;
    leave_type: LeaveType;
    notes?: string;
  }): Promise<LeaveRequest> => {
    const res = await api.post<LeaveRequest>('leave-requests/', data);
    return res.data;
  },
  approveLeave: async (id: number): Promise<LeaveRequest> => {
    const res = await api.patch<LeaveRequest>(`leave-requests/${id}/approve/`);
    return res.data;
  },
  rejectLeave: async (id: number): Promise<LeaveRequest> => {
    const res = await api.patch<LeaveRequest>(`leave-requests/${id}/reject/`);
    return res.data;
  },
  getMyLeaves: async (): Promise<LeaveRequest[]> => {
    const res = await api.get<unknown>('leave-requests/my_leaves/');
    const data = res.data as LeaveRequest[] | { results: LeaveRequest[] };
    return Array.isArray(data) ? data : (data.results || []);
  },
  getLeaveBalance: async (): Promise<LeaveBalance> => {
    const res = await api.get<LeaveBalance>('leave-requests/balance/');
    return res.data;
  },
};

export default planningService;
