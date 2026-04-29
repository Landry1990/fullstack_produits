import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { AuditLogResponse, Statistics, AuditFilters } from '../types/audit';
import type { User } from '../types/auth';

// Fetch Logs Function
const fetchLogs = async (filters: AuditFilters): Promise<AuditLogResponse> => {
    const params: Record<string, string | number> = { page: filters.page };
    if (filters.action) params['action'] = filters.action;
    if (filters.user) params['user'] = filters.user;
    if (filters.model_name) params['model_name'] = filters.model_name;
    if (filters.date_from) params['date_from'] = filters.date_from;
    if (filters.date_to) params['date_to'] = filters.date_to;

    const response = await api.get<AuditLogResponse>('audit-logs/', { params });

    // Safe parsing like we did before
    const safeData = {
        ...response.data,
        results: (response.data.results || []).map(log => {
            let details = log.details;
            if (typeof details === 'string') {
                try {
                    details = JSON.parse(details);
                } catch (e) {
                    console.warn('Failed to parse details:', e);
                    details = {};
                }
            }
            return { ...log, details };
        })
    };

    return safeData;
};

// Fetch Statistics Function
const fetchStatistics = async (filters: Omit<AuditFilters, 'page'>): Promise<Statistics> => {
    const params: Record<string, string> = {};
    if (filters.action) params['action'] = filters.action;
    if (filters.user) params['user'] = filters.user;
    if (filters.model_name) params['model_name'] = filters.model_name;
    if (filters.date_from) params['date_from'] = filters.date_from;
    if (filters.date_to) params['date_to'] = filters.date_to;

    const response = await api.get<Statistics>('audit-logs/statistics/', { params });
    return response.data;
};

// Fetch Users Function
const fetchUsers = async (): Promise<User[]> => {
    const response = await api.get<AuditLogResponse | User[]>('users/');
    const data = response.data;
    if (Array.isArray(data)) return data;
    return ((data as unknown) as { results: User[] }).results || [];
};

export const useAuditLogs = (filters: AuditFilters) => {
    return useQuery<AuditLogResponse>({
        queryKey: ['audit-logs', filters],
        queryFn: () => fetchLogs(filters),
        placeholderData: (previousData) => previousData, // Keep previous data while fetching new page
    });
};

export const useAuditStats = (filters: Omit<AuditFilters, 'page'>) => {
    return useQuery<Statistics>({
        queryKey: ['audit-stats', filters],
        queryFn: () => fetchStatistics(filters),
    });
};

export const useUsers = () => {
    return useQuery<User[]>({
        queryKey: ['users'],
        queryFn: fetchUsers,
        staleTime: 1000 * 60 * 60, // Cache users for 1 hour
    });
};
