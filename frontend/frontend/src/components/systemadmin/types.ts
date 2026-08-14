export type TabId = 'sante' | 'sauvegardes' | 'mise_a_jour';

export interface DockerContainer {
  name: string;
  running: boolean;
  restart_policy: string;
  started_at: string | null;
  auto_restart: boolean;
  error?: string;
}

export interface BackupInfo {
  filename: string;
  size_mb: number;
  created_at: string;
  has_checksum: boolean;
  checksum: string | null;
  age_hours: number;
}

export interface LastBackup {
  filename: string;
  size_mb: number;
  age_hours: number;
  has_checksum: boolean;
  status: 'ok' | 'warning' | 'critical';
}

export interface SystemStatus {
  docker: DockerContainer[];
  backup: {
    last: LastBackup | null;
    count: number;
    directory: string;
  };
}

export interface BackupListData {
  backups: BackupInfo[];
  total: number;
}

export interface WalStatus {
  archive_active: boolean;
  wal_count: number;
  wal_size_mb: number;
  oldest_wal: string | null;
  newest_wal: string | null;
  wal_directory: string;
  base_backups: BaseBackup[];
  base_backups_count: number;
}

export interface BaseBackup {
  name: string;
  size_mb: number;
  created_at: string;
}

export interface BackupSettings {
  backup_enabled: boolean;
  backup_time: string;
  backup_interval_minutes: number;
  backup_retention_count: number;
  secondary_backup_path: string;
  external_backup_path_1: string;
  external_backup_path_2: string;
  external_backup_path_3: string;
  cloud_backup_enabled: boolean;
  cloud_backup_endpoint: string;
  cloud_backup_bucket: string;
  cloud_backup_access_key: string;
  cloud_backup_secret_key: string;
  cloud_backup_region: string;
  cloud_backup_path_prefix: string;
}

export interface UpdateStatus {
  update_available: boolean;
  current_version?: string;
  latest_version?: string;
  message: string;
  error?: string;
}

export const backupStatusColor = (status: string) => {
  if (status === 'ok') return 'text-emerald-600 bg-emerald-50';
  if (status === 'warning') return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
};
