import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'
import { toast } from 'react-hot-toast'
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { logger } from '../../utils/logger'

interface ImportProductsModalProps {
  onClose: () => void
  onSuccess: () => void
}

interface ImportResult {
  created: number
  updated: number
  errors: number
  message: string
  rapport_xlsx?: string | null
  rapport_txt?: string | null
}

export default function ImportProductsModal({ onClose, onSuccess }: ImportProductsModalProps) {
  const { t } = useTranslation(['products', 'common'])
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const jobIdRef = useRef<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
      setResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    setProgress(0)
    setStatusMessage(t('products:import.sending_file'))
    setResult(null)

    try {
      const res = await api.post('maintenance/import_produits/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      })
      const jobId = res.data.job_id
      jobIdRef.current = jobId
      setStatusMessage(t('products:import.background_started'))

      const poll = setInterval(async () => {
        try {
          const status = await api.get(`maintenance/import_status/?job_id=${jobId}`)
          const d = status.data
          setProgress(d.progress || 0)
          setStatusMessage(d.message || '')

          if (d.status === 'done') {
            clearInterval(poll)
            setUploading(false)
            setResult(d)
            jobIdRef.current = null
            toast.success(d.message || t('products:import.done'))
            onSuccess()
          } else if (d.status === 'error') {
            clearInterval(poll)
            setUploading(false)
            jobIdRef.current = null
            toast.error(d.message || t('products:import.import_error'))
            setResult({ created: 0, updated: 0, errors: 1, message: d.message || t('common:error') })
          }
        } catch {
          clearInterval(poll)
          setUploading(false)
          jobIdRef.current = null
          toast.error(t('products:import.comm_error'))
        }
      }, 2000)

    } catch (error: unknown) {
      logger.error('Import error:', error)
      const errData = (error as { response?: { data?: { detail?: string } } })?.response?.data
      const message = errData?.detail || t('products:import.error_toast')
      toast.error(message)
      setResult({ created: 0, updated: 0, errors: 1, message })
    } finally {
      if (!jobIdRef.current) setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !uploading && onClose()} />
      <div className="relative bg-base-100 rounded-xl shadow-2xl border border-base-200 w-full max-w-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-base-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Upload className="size-5 text-primary" />
            </div>
            <h3 className="text-base font-bold text-base-content">{t('products:import.title')}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-base-content/50 hover:bg-base-200 rounded-lg transition-colors"
            disabled={uploading}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-6">
        {!result ? (
          <div className="space-y-4">
            <div
              className={`
                border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                ${file ? 'border-indigo-300 bg-primary/10/30' : 'border-base-300 hover:border-indigo-200 hover:bg-base-200/50'}
              `}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
              />

              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="size-10 text-indigo-500" />
                  <span className="font-medium text-base-content truncate max-w-xs">{file.name}</span>
                  <span className="text-xs text-base-content/50">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-base-content/50">
                  <Upload className="size-10" />
                  <span className="font-medium text-base-content/60">{t('products:import.drag_drop')}</span>
                  <span className="text-xs">{t('products:import.support')}</span>
                  <div className="mt-3 text-xs bg-base-200 p-3 rounded-lg text-left border border-base-200">
                     <strong className="text-base-content/70">{t('products:import.expected_columns')}</strong>
                     <ul className="list-disc list-inside mt-1 text-base-content/60">
                       <li>{t('products:import.col_name')}</li>
                       <li>{t('products:import.col_public')}</li>
                       <li>{t('products:import.col_cession')}</li>
                       <li>{t('products:import.col_cip')}</li>
                       <li>{t('products:import.col_tva')}</li>
                       <li>{t('products:import.col_stock')}</li>
                       <li>{t('products:import.col_fournisseur')}</li>
                       <li>{t('products:import.col_forme')}</li>
                       <li>{t('products:import.col_groupe')}</li>
                     </ul>
                     <p className="mt-2 text-base-content/50">{t('products:import.col_extras')}</p>
                  </div>
                </div>
              )}
            </div>

            {uploading && (
              <div className="space-y-2">
                 <div className="flex justify-between text-xs">
                   <span className="text-base-content/60 flex items-center gap-1.5">
                     <Loader2 className="size-3.5 animate-spin" />
                     {statusMessage || t('products:import.uploading')}
                   </span>
                   <span className="font-semibold text-base-content">{progress}%</span>
                 </div>
                 <div className="w-full bg-base-200 rounded-full h-2 overflow-hidden">
                   <div className="bg-indigo-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                 </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button className="px-6 py-2 text-sm font-medium text-base-content bg-base-100 border border-base-300 rounded-lg hover:bg-base-200 transition-colors" onClick={onClose} disabled={uploading}>{t('common:cancel')}</button>
              <button
                className="px-6 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-focus transition-colors shadow-sm disabled:text-base-content/50"
                onClick={handleUpload}
                disabled={!file || uploading}
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('products:import.processing')}
                  </span>
                ) : (
                  <>{t('products:actions.create')}</>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
             <div className={`flex items-start gap-3 p-4 rounded-xl ${result.errors > 0 ? 'bg-warning/10 border border-amber-100' : 'bg-success/10 border border-emerald-100'}`}>
                {result.errors > 0 ? (
                  <AlertCircle className="size-6 text-warning shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="size-6 text-success shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="font-semibold text-base-content">{t('products:import.success_title')}</h3>
                  <div className="text-sm text-base-content/70 mt-1">
                    <p>{t('products:import.created', { count: result.created })}</p>
                    <p>{t('products:import.updated', { count: result.updated })}</p>
                    {result.errors > 0 && <p className="text-error">{t('products:import.errors_count', { count: result.errors })}</p>}
                  </div>
                </div>
             </div>

             {result.rapport_xlsx && (
               <div className="flex justify-end">
                 <button
                   className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                   onClick={() => {
                     window.open(`/api/maintenance/download_rapport/?file=${result.rapport_xlsx}`, '_blank')
                   }}
                 >
                   📊 {t('products:import.download_report')}
                 </button>
               </div>
             )}

             <div className="flex justify-end">
               <button className="px-6 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-focus transition-colors" onClick={onClose}>{t('common:close')}</button>
             </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
