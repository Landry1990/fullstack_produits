import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/Dialog'
import { DownloadCloud } from 'lucide-react'
import api from '../services/api'

const STORAGE_KEY = 'zenith_update_reminder_date'

function getTodayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function UpdateReminderModal() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation('system_admin')
  const [open, setOpen] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')
  const [changelog, setChangelog] = useState<string[]>([])
  const [changelogMd, setChangelogMd] = useState('')

  useEffect(() => {
    if (!user?.is_superuser) return
    const lastShown = localStorage.getItem(STORAGE_KEY)
    const today = getTodayStr()
    if (lastShown !== today) {
      const timer = setTimeout(async () => {
        try {
          const res = await api.post('/system-admin/check_update/')
          if (res.data.update_available) {
            setUpdateMessage(res.data.message || '')
            setChangelog(res.data.changelog || [])
            setChangelogMd(res.data.changelog_md || '')
            setOpen(true)
          }
          localStorage.setItem(STORAGE_KEY, today)
        } catch {
          // Silencieux — retry demain
        }
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [user?.is_superuser])

  const handleClose = () => {
    setOpen(false)
    localStorage.setItem(STORAGE_KEY, getTodayStr())
  }

  const handleGoToUpdate = () => {
    handleClose()
    navigate('/app/systeme')
  }

  if (!user?.is_superuser) return null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-md" aria-labelledby="update-reminder-title">
        <DialogHeader>
          <DialogTitle id="update-reminder-title" className="flex items-center gap-2">
            <DownloadCloud className="w-5 h-5 text-indigo-600" />
            {t('reminder_title')}
          </DialogTitle>
          <DialogDescription>
            {t('reminder_subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
              <DownloadCloud className="w-4 h-4" />
              {updateMessage}
            </p>
          </div>

          {(changelogMd || changelog.length > 0) && (
            <div className="max-h-48 overflow-y-auto rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 space-y-1">
              {changelogMd && (
                <pre className="whitespace-pre-wrap font-sans">{changelogMd}</pre>
              )}
              {changelog.length > 0 && (
                <ul className="space-y-1">
                  {changelog.map((line) => (
                    <li key={line} className="flex items-start gap-1.5">
                      <span className="text-emerald-600 mt-0.5">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
            >
              {t('reminder_no')}
            </button>
            <button
              onClick={handleGoToUpdate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-all"
            >
              <DownloadCloud className="w-4 h-4" />
              {t('update_now')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

