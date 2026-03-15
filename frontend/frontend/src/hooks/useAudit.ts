import { useQuery } from '@tanstack/react-query';
import axios from '../config/axios';
import type { AuditLogResponse, Statistics, AuditFilters } from '../types/audit';
import type { User } from '../types/auth';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

// Fetch Logs Function
const fetchLogs = async (filters: AuditFilters): Promise<AuditLogResponse> => {
    let endpoint = apiBaseUrl
        ? `${apiBaseUrl}/api/audit-logs/?page=${filters.page}`
        : `/api/audit-logs/?page=${filters.page}`;

    const params = new URLSearchParams();
    if (filters.action) params.append('action', filters.action);
    if (filters.user) params.append('user', filters.user);
    if (filters.model_name) params.append('model_name', filters.model_name);
    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);

    if (params.toString()) {
        endpoint += `&${params.toString()}`;
    }

    const response = await axios.get<AuditLogResponse>(endpoint);

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
    let endpoint = apiBaseUrl
        ? `${apiBaseUrl}/api/audit-logs/statistics/`
        : `/api/audit-logs/statistics/`;

    const params = new URLSearchParams();
    if (filters.action) params.append('action', filters.action);
    if (filters.user) params.append('user', filters.user);
    if (filters.model_name) params.append('model_name', filters.model_name);
    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);

    if (params.toString()) {
        endpoint += `?${params.toString()}`;
    }

    const response = await axios.get<Statistics>(endpoint);
    return response.data;
};

// Fetch Users Function
const fetchUsers = async (): Promise<User[]> => {
    const endpoint = apiBaseUrl ? `${apiBaseUrl}/api/users/` : `/api/users/`;
    const response = await axios.get<AuditLogResponse | User[]>(endpoint);
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
