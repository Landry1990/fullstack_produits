import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import { 
  Database, 
  Download, 
  RotateCcw, 
  Calendar, 
  Clock, 
  HardDrive,
  AlertTriangle,
  CheckCircle,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  Trash2
} from 'lucide-react'
import api from '../../services/api'
import PremiumModal from '../common/PremiumModal'

interface BackupInfo {
  filename: string
  timestamp: string
  date_formatted: string
  size_bytes: number
  size_formatted: string
  type: 'full' | 'incremental'
  tables?: string[]
}

interface RestoreStatus {
  status: 'idle' | 'running' | 'success' | 'error'
  message?: string
  progress?: number
}

export const BackupManager: React.FC = () => {
  const { t } = useTranslation('backup')
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null)
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [restoreStatus, setRestoreStatus] = useState<RestoreStatus>({ status: 'idle' })
  const [expandedBackup, setExpandedBackup] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'incremental' | 'full'>('incremental')

  // Charger la liste des backups
  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get('backups/')
      setBackups(response.data.backups || [])
    } catch (err) {
      console.error('Erreur chargement backups:', err)
      toast.error(t('errors.load_failed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchBackups()
    // Rafraîchissement auto toutes les 2 minutes
    const interval = setInterval(fetchBackups, 120000)
    return () => clearInterval(interval)
  }, [fetchBackups])

  // Créer un backup manuel
  const handleCreateBackup = async () => {
    try {
      setLoading(true)
      toast.success(t('messages.backup_started'))
      
      const response = await api.post('backups/create/')
      
      if (response.data.success) {
        toast.success(t('messages.backup_success', { 
          count: response.data.tables_backed_up 
        }))
        fetchBackups()
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('errors.backup_failed'))
    } finally {
      setLoading(false)
    }
  }

  // Lancer une restauration
  const handleRestore = async () => {
    if (!selectedBackup) return

    try {
      setRestoreStatus({ status: 'running', progress: 0 })
      
      const response = await api.post('backups/restore/', {
        filename: selectedBackup.filename,
        type: selectedBackup.type
      })

      if (response.data.success) {
        setRestoreStatus({ 
          status: 'success', 
          message: t('messages.restore_success', {
            factures: response.data.stats?.factures_restored,
            date: response.data.stats?.last_transaction
          })
        })
        toast.success(t('messages.restore_complete'))
        fetchBackups()
      }
    } catch (err: any) {
      setRestoreStatus({ 
        status: 'error', 
        message: err.response?.data?.error || t('errors.restore_failed')
      })
      toast.error(t('errors.restore_failed'))
    }
  }

  // Supprimer un backup
  const handleDelete = async (filename: string) => {
    if (!window.confirm(t('confirm.delete'))) return

    try {
      await api.delete(`backups/${encodeURIComponent(filename)}/`)
      toast.success(t('messages.delete_success'))
      fetchBackups()
    } catch (err) {
      toast.error(t('errors.delete_failed'))
    }
  }

  // Formater la date relative
  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / 3600000)
    
    if (hours < 1) return t('time.just_now')
    if (hours < 24) return t('time.hours_ago', { count: hours })
    return t('time.days_ago', { count: Math.floor(hours / 24) })
  }

  const filteredBackups = backups.filter(b => b.type === activeTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="size-6 text-primary" />
            {t('title')}
          </h2>
          <p className="text-base-content/60 mt-1">{t('subtitle')}</p>
        </div>
        
        <button
          onClick={handleCreateBackup}
          disabled={loading}
          className="btn btn-primary gap-2"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {t('buttons.backup_now')}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-base-100 p-4 rounded-xl border border-base-300">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="size-5 text-primary" />
            </div>
            <div>
              <div className="text-sm text-base-content/60">{t('stats.last_backup')}</div>
              <div className="font-semibold">
                {backups[0] ? formatRelativeTime(backups[0].timestamp) : t('stats.never')}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-base-100 p-4 rounded-xl border border-base-300">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle className="size-5 text-success" />
            </div>
            <div>
              <div className="text-sm text-base-content/60">{t('stats.backups_count')}</div>
              <div className="font-semibold">{backups.length} {t('stats.backups')}</div>
            </div>
          </div>
        </div>

        <div className="bg-base-100 p-4 rounded-xl border border-base-300">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-info/10 flex items-center justify-center">
              <HardDrive className="size-5 text-info" />
            </div>
            <div>
              <div className="text-sm text-base-content/60">{t('stats.total_size')}</div>
              <div className="font-semibold">
                {(() => {
                  const total = backups.reduce((acc, b) => acc + b.size_bytes, 0)
                  if (total < 1024) return `${total} B`
                  if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} KB`
                  return `${(total / (1024 * 1024)).toFixed(1)} MB`
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alertes */}
      {backups.length === 0 && (
        <div className="alert alert-warning">
          <AlertTriangle className="size-5" />
          <span>{t('alerts.no_backups')}</span>
        </div>
      )}

      {backups.length > 0 && (
        <div className="alert alert-info">
          <CheckCircle className="size-5" />
          <span>{t('alerts.auto_backup', { count: filteredBackups.length })}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs tabs-boxed bg-base-200">
        <button
          className={`tab ${activeTab === 'incremental' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('incremental')}
        >
          {t('tabs.incremental')} 
          <span className="badge badge-sm ml-2">
            {backups.filter(b => b.type === 'incremental').length}
          </span>
        </button>
        <button
          className={`tab ${activeTab === 'full' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('full')}
        >
          {t('tabs.full')}
          <span className="badge badge-sm ml-2">
            {backups.filter(b => b.type === 'full').length}
          </span>
        </button>
      </div>

      {/* Liste des backups */}
      <div className="bg-base-100 rounded-xl border border-base-300 overflow-hidden">
        {loading && backups.length === 0 ? (
          <div className="p-8 text-center">
            <Loader2 className="size-8 animate-spin mx-auto mb-4" />
            <p>{t('loading')}</p>
          </div>
        ) : filteredBackups.length === 0 ? (
          <div className="p-8 text-center text-base-content/60">
            <Database className="size-12 mx-auto mb-4 opacity-50" />
            <p>{t('empty.' + activeTab)}</p>
          </div>
        ) : (
          <div className="divide-y divide-base-200">
            {filteredBackups.map((backup) => (
              <div 
                key={backup.filename}
                className={`p-4 hover:bg-base-200/50 transition-colors ${
                  selectedBackup?.filename === backup.filename ? 'bg-primary/5' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setExpandedBackup(
                        expandedBackup === backup.filename ? null : backup.filename
                      )}
                      className="btn btn-ghost btn-circle btn-sm"
                    >
                      {expandedBackup === backup.filename ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </button>
                    
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <FileText className="size-4 text-primary" />
                        {backup.date_formatted}
                        <span className="badge badge-sm badge-ghost">
                          {backup.type === 'full' ? t('badges.full') : t('badges.incremental')}
                        </span>
                      </div>
                      <div className="text-sm text-base-content/60 flex items-center gap-2 mt-1">
                        <span>{backup.size_formatted}</span>
                        <span>•</span>
                        <span>{formatRelativeTime(backup.timestamp)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedBackup(backup)
                        setShowRestoreModal(true)
                        setRestoreStatus({ status: 'idle' })
                      }}
                      className="btn btn-sm btn-outline gap-1"
                    >
                      <RotateCcw className="size-4" />
                      {t('buttons.restore')}
                    </button>
                    
                    <button
                      onClick={() => handleDelete(backup.filename)}
                      className="btn btn-sm btn-ghost btn-circle text-error"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Détails expandables */}
                {expandedBackup === backup.filename && backup.tables && (
                  <div className="mt-3 ml-14 p-3 bg-base-200 rounded-lg">
                    <div className="text-sm font-medium mb-2">{t('details.tables')}:</div>
                    <div className="flex flex-wrap gap-2">
                      {backup.tables.map(table => (
                        <span key={table} className="badge badge-ghost badge-sm">
                          {table}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de restauration */}
      <PremiumModal
        isOpen={showRestoreModal}
        onClose={() => {
          if (restoreStatus.status !== 'running') {
            setShowRestoreModal(false)
            setRestoreStatus({ status: 'idle' })
          }
        }}
        title={t('restore_modal.title')}
        icon={<RotateCcw className="size-6 text-warning" />}
        maxWidth="md"
        footer={
          <div className="flex gap-2">
            {restoreStatus.status !== 'running' && (
              <button
                onClick={() => setShowRestoreModal(false)}
                className="btn btn-ghost"
              >
                {t('buttons.cancel')}
              </button>
            )}
            
            {restoreStatus.status === 'idle' && (
              <button
                onClick={handleRestore}
                className="btn btn-warning gap-2"
              >
                <RotateCcw className="size-4" />
                {t('buttons.confirm_restore')}
              </button>
            )}
          </div>
        }
      >
        {restoreStatus.status === 'idle' && (
          <div className="space-y-4">
            <div className="alert alert-warning">
              <AlertTriangle className="size-5" />
              <div>
                <div className="font-bold">{t('restore_modal.warning_title')}</div>
                <div className="text-sm">{t('restore_modal.warning_desc')}</div>
              </div>
            </div>

            {selectedBackup && (
              <div className="bg-base-200 p-4 rounded-lg">
                <div className="text-sm text-base-content/60 mb-1">{t('restore_modal.selected')}:</div>
                <div className="font-medium">{selectedBackup.date_formatted}</div>
                <div className="text-sm text-base-content/60">
                  {selectedBackup.size_formatted} • {selectedBackup.type === 'full' ? t('badges.full') : t('badges.incremental')}
                </div>
              </div>
            )}

            <p className="text-sm text-base-content/60">
              {t('restore_modal.explanation')}
            </p>
          </div>
        )}

        {restoreStatus.status === 'running' && (
          <div className="text-center py-8">
            <Loader2 className="size-12 animate-spin mx-auto mb-4 text-primary" />
            <div className="font-medium">{t('restore_modal.restoring')}</div>
            <div className="text-sm text-base-content/60 mt-2">
              {t('restore_modal.please_wait')}
            </div>
            {restoreStatus.progress !== undefined && (
              <div className="w-full bg-base-200 rounded-full h-2 mt-4">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${restoreStatus.progress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {restoreStatus.status === 'success' && (
          <div className="text-center py-8">
            <CheckCircle className="size-12 mx-auto mb-4 text-success" />
            <div className="font-medium text-success">{t('restore_modal.success')}</div>
            {restoreStatus.message && (
              <div className="text-sm text-base-content/60 mt-2">
                {restoreStatus.message}
              </div>
            )}
            <button
              onClick={() => setShowRestoreModal(false)}
              className="btn btn-primary mt-4"
            >
              {t('buttons.close')}
            </button>
          </div>
        )}

        {restoreStatus.status === 'error' && (
          <div className="text-center py-8">
            <X className="size-12 mx-auto mb-4 text-error" />
            <div className="font-medium text-error">{t('restore_modal.error')}</div>
            {restoreStatus.message && (
              <div className="text-sm text-base-content/60 mt-2">
                {restoreStatus.message}
              </div>
            )}
          </div>
        )}
      </PremiumModal>
    </div>
  )
}

export default BackupManager
