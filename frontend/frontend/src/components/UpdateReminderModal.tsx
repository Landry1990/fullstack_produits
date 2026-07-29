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
import { DownloadCloud, CheckCircle2 } from 'lucide-react'
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
  const [checking, setChecking] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState<boolean | null>(null)
  const [updateMessage, setUpdateMessage] = useState('')

  useEffect(() => {
    if (!user?.is_superuser) return
    const lastShown = localStorage.getItem(STORAGE_KEY)
    const today = getTodayStr()
    if (lastShown !== today) {
      const timer = setTimeout(() => {
        setOpen(true)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [user?.is_superuser])

  const handleCheckUpdate = async () => {
    setChecking(true)
    setUpdateAvailable(null)
    try {
      const res = await api.post('/system-admin/check_update/')
      setUpdateAvailable(res.data.update_available)
      setUpdateMessage(res.data.message || '')
    } catch {
      setUpdateAvailable(false)
      setUpdateMessage(t('update_check_error'))
    } finally {
      setChecking(false)
    }
  }

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
          {updateAvailable === null && !checking && (
            <p className="text-sm text-gray-600">
              {t('reminder_question')}
            </p>
          )}

          {checking && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <DownloadCloud className="w-4 h-4 animate-pulse" />
              {t('update_checking_github')}
            </div>
          )}

          {updateAvailable === true && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                <DownloadCloud className="w-4 h-4" />
                {updateMessage}
              </p>
            </div>
          )}

          {updateAvailable === false && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-sm text-emerald-800 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {updateMessage}
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            {updateAvailable === null && !checking && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
                >
                  {t('reminder_no')}
                </button>
                <button
                  onClick={handleCheckUpdate}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all"
                >
                  <DownloadCloud className="w-4 h-4" />
                  {t('reminder_yes')}
                </button>
              </>
            )}

            {checking && (
              <button
                disabled
                className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed"
              >
                {t('update_checking')}
              </button>
            )}

            {updateAvailable === true && (
              <button
                onClick={handleGoToUpdate}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-all"
              >
                <DownloadCloud className="w-4 h-4" />
                {t('update_now')}
              </button>
            )}

            {updateAvailable === false && (
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
              >
                {t('reminder_ok')}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
