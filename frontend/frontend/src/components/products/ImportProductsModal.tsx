
import { useState, useRef } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'

interface ImportProductsModalProps {
  onClose: () => void
  onSuccess: () => void
}

export default function ImportProductsModal({ onClose, onSuccess }: ImportProductsModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ imported: number; updated: number; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
      const response = await axios.post(`${apiBaseUrl}/import/products/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) { // Check if total is defined
             const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
             setProgress(percent)
          }
        },
      })

      setResult(response.data)
      toast.success('Importation terminée avec succès')
      onSuccess()
    } catch (error: any) {
      console.error('Import error:', error)
      const message = error.response?.data?.error || "Erreur lors de l'importation"
      toast.error(message)
      setResult({ imported: 0, updated: 0, errors: [message] })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box relative max-w-lg">
        <button 
          onClick={onClose} 
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          disabled={uploading}
        >
          ✕
        </button>
        
        <h3 className="font-bold text-lg mb-4">Importer des Produits</h3>
        
        {!result ? (
          <div className="space-y-4">
            <div 
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${file ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/50'}
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium truncate max-w-xs">{file.name}</span>
                  <span className="text-xs text-base-content/60">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-base-content/60">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="font-medium">Cliquez ou glissez un fichier ici</span>
                  <span className="text-xs">Supporte CSV et Excel (.xlsx)</span>
                  <div className="mt-2 text-xs bg-base-200 p-2 rounded text-left">
                     <strong>Colonnes attendues:</strong>
                     <ul className="list-disc list-inside mt-1">
                       <li>LIBELLE / nom (requis)</li>
                       <li>PUBLIC / prix_public (requis)</li>
                       <li>CESSION / prix_cession (optionnel)</li>
                       <li>CIP1, CIP2, CIP3 (optionnel)</li>
                       <li>TVCODE (0=sans TVA, 2=avec TVA)</li>
                       <li>stock (optionnel)</li>
                     </ul>
                  </div>
                </div>
              )}
            </div>

            {uploading && (
              <div className="space-y-2">
                 <div className="flex justify-between text-xs">
                   <span>Importation en cours...</span>
                   <span>{progress}%</span>
                 </div>
                 <progress className="progress progress-primary w-full" value={progress} max="100"></progress>
              </div>
            )}

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={onClose} disabled={uploading}>Annuler</button>
              <button 
                className="btn btn-primary" 
                onClick={handleUpload} 
                disabled={!file || uploading}
              >
                {uploading ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    Traitement...
                  </>
                ) : (
                  <>Importer</>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
             <div className={`alert ${result.errors && result.errors.length > 0 ? 'alert-warning' : 'alert-success'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div>
                  <h3 className="font-bold">Import terminé !</h3>
                  <div className="text-xs">
                    <p>Produits créés: {result.imported}</p>
                    <p>Produits mis à jour: {result.updated}</p>
                  </div>
                </div>
             </div>

             {result.errors && result.errors.length > 0 && (
               <div className="bg-base-200 p-4 rounded-lg max-h-40 overflow-y-auto">
                 <h4 className="font-bold text-xs mb-2 text-error">Erreurs / Avertissements:</h4>
                 <ul className="list-disc list-inside text-xs space-y-1 text-base-content/80">
                   {result.errors.slice(0, 10).map((err, idx) => (
                     <li key={idx}>{err}</li>
                   ))}
                   {result.errors.length > 10 && (
                     <li className="italic">... et {result.errors.length - 10} autres erreurs.</li>
                   )}
                 </ul>
               </div>
             )}

             <div className="modal-action">
               <button className="btn btn-primary" onClick={onClose}>Fermer</button>
             </div>
          </div>
        )}
      </div>
    </div>
  )
}
