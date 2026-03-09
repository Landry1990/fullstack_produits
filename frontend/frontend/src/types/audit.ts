export interface AuditLog {
    id: number;
    user_name: string;
    action: string;
    action_display: string;
    model_name: string;
    object_id: string;
    description: string;
    details: Record<string, unknown> | null;
    ip_address: string;
    timestamp: string;
}


export interface Statistics {
    total_logs: number;
    actions_stats: Array<{ action: string; action_label: string; count: number }>;
    top_users: Array<{ user_id: number; username: string; display_name: string; count: number }>;
    recent_activity: {
        last_24h: number;
        last_7d: number;
        last_30d: number;
    };
}

export interface AuditLogResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: AuditLog[];
}

export interface AuditFilters {
    page: number;
    action?: string;
    user?: string;
    model_name?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
}
