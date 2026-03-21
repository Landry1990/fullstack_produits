import { useState } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import PremiumModal from './common/PremiumModal'

interface SimplePrintLabelsModalProps {
  commandeId: number
  commandeNumero: string
  onClose: () => void
}

export default function SimplePrintLabelsModal({ 
  commandeId, 
  commandeNumero,
  onClose 
}: SimplePrintLabelsModalProps) {
  const [printing, setPrinting] = useState(false)
  const [labelFormat, setLabelFormat] = useState<'40x20' | '30x15'>('40x20')
  const [debugMode, setDebugMode] = useState(false)

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

  const handlePrint = async () => {
    setPrinting(true)
    try {
      const endpoint = `${apiBaseUrl}/api/commandes/${commandeId}/imprimer_etiquettes/?label_format=${labelFormat}&debug_mode=${debugMode}`
      const response = await axios.get(endpoint, {
        responseType: 'blob'
      })
      
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
      
      setTimeout(() => window.URL.revokeObjectURL(url), 10000)
      onClose()
    } catch (err: any) {
      console.error('Erreur impression étiquettes:', err)
      toast.error('Erreur lors de l\'impression des étiquettes')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <PremiumModal
      isOpen={true}
      onClose={onClose}
      title="Impression d'Étiquettes"
      subtitle={`Commande: ${commandeNumero}`}
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      }
      gradientFrom="primary/10"
      gradientTo="info/10"
      disableClose={printing}
    >
      <div className="p-6 space-y-5">
        {/* Format Selection */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-3">Format des étiquettes</label>
          <div className="flex gap-4">
            <label className="label cursor-pointer gap-2 border rounded-xl p-4 flex-1 hover:bg-base-200 transition-colors">
              <input
                type="radio"
                name="format"
                className="radio radio-primary"
                checked={labelFormat === '40x20'}
                onChange={() => setLabelFormat('40x20')}
              />
              <div className="flex-1">
                <span className="label-text font-semibold">40mm × 20mm</span>
                <p className="text-xs text-base-content/60">Format standard</p>
              </div>
            </label>
            <label className="label cursor-pointer gap-2 border rounded-xl p-4 flex-1 hover:bg-base-200 transition-colors">
              <input
                type="radio"
                name="format"
                className="radio radio-primary"
                checked={labelFormat === '30x15'}
                onChange={() => setLabelFormat('30x15')}
              />
              <div className="flex-1">
                <span className="label-text font-semibold">30mm × 15mm</span>
                <p className="text-xs text-base-content/60">Format compact</p>
              </div>
            </label>
          </div>
        </div>

        {/* Info */}
        <div className="alert alert-info rounded-xl">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div className="text-sm">
            <p><strong>Contenu des étiquettes:</strong></p>
            <ul className="list-disc list-inside mt-1 text-xs">
              <li>Nom du produit</li>
              <li>Code-barres (CIP1/CIP2/CIP3)</li>
              <li>Numéro de lot</li>
              <li>Fournisseur</li>
              <li>Date d'entrée</li>
              <li>Prix de vente</li>
            </ul>
          </div>
        </div>

        {/* Debug Mode */}
        <div>
          <label className="label cursor-pointer justify-start gap-3 rounded-xl border p-3">
            <input
              type="checkbox"
              className="checkbox checkbox-warning checkbox-sm"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
            />
            <div>
              <span className="label-text font-semibold">Mode Debug</span>
              <p className="text-xs text-base-content/60">Affiche les bordures et la grille pour tester les positions</p>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn btn-ghost px-6 rounded-xl">
            Annuler
          </button>
          <button
            onClick={handlePrint}
            className="btn btn-primary px-8 rounded-xl shadow-lg shadow-primary/20 gap-2"
            disabled={printing}
          >
            {printing ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Génération en cours...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Générer PDF
              </>
            )}
          </button>
        </div>
      </div>
    </PremiumModal>
  )
}

