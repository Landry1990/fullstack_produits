export interface PurgeTable {
  key: string;
  label: string;
  children: string[];
}

export interface PreviewResult {
  key: string;
  label: string;
  count: number;
  children: { label: string; count: number }[];
}

export interface PurgeResult {
  key: string;
  label: string;
  deleted: number;
}

export interface ImportResult {
  created: number;
  updated: number;
  errors: number;
  rapport_xlsx?: string;
  rapport_txt?: string;
}

export interface ProductPurgeResult {
  deleted: number;
  conserves: number;
}

export interface PharmacySettings {
  backup_enabled?: boolean;
  backup_time?: string;
  secondary_backup_path?: string;
  retention_enabled?: boolean;
  retention_audit_days?: number;
  retention_activity_days?: number;
  retention_message_log_days?: number;
  retention_session_days?: number;
  retention_trash_days?: number;
  retention_draft_invoice_days?: number;
  retention_mouvement_stock_days?: number;
}

export interface RetentionCategory {
  key: string;
  label: string;
  count: number;
  cutoff_date: string | null;
  deferred?: boolean;
}

export interface RetentionPreview {
  enabled: boolean;
  categories: RetentionCategory[];
}

export interface TableCategory {
  label: string;
  icon: string;
  keys: string[];
}

export type MaintenanceRightTab = 'nettoyage' | 'sauvegardes';

export const RETENTION_DAY_FIELDS = [
  'retention_audit_days',
  'retention_activity_days',
  'retention_message_log_days',
  'retention_session_days',
  'retention_trash_days',
  'retention_draft_invoice_days',
  'retention_mouvement_stock_days',
] as const;
