import { useState, useMemo } from 'react'
import axios from 'axios'

interface CashMovementModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CashMovementModal({ isOpen, onClose, onSuccess }: CashMovementModalProps) {
  const [type, setType] = useState<'ENTREE' | 'SORTIE'>('SORTIE')
  const [montant, setMontant] = useState('')
  const [motif, setMotif] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiBaseUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    return baseUrl ? String(baseUrl).replace(/\/$/, '') : ''
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!montant || isNaN(Number(montant)) || Number(montant) <= 0) {
        throw new Error("Montant invalide")
      }
      if (!motif.trim()) {
        throw new Error("Le motif est requis")
      }

      await axios.post(`${apiBaseUrl}/api/mouvements-caisse/`, {
        type,
        montant: parseFloat(montant),
        motif,
        description
      })

      // Reset form
      setMontant('')
      setMotif('')
      setDescription('')
      setType('SORTIE') // Default back to Sortie as it's most common (expenses)
      
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Erreur creation mouvement:', err)
      setError(err.response?.data?.detail || err.message || "Erreur lors de l'enregistrement")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">
          {type === 'SORTIE' ? '📤 Nouvelle Dépense (Sortie)' : '📥 Nouvelle Entrée Divers'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Type Toggle */}
          <div className="flex justify-center mb-6">
            <div className="join">
              <input 
                className="join-item btn btn-sm px-6" 
                type="radio" 
                name="options" 
                aria-label="Sortie (Dépense)"
                checked={type === 'SORTIE'}
                onChange={() => setType('SORTIE')} 
              />
              <input 
                className="join-item btn btn-sm px-6" 
                type="radio" 
                name="options" 
                aria-label="Entrée (Apport)"
                checked={type === 'ENTREE'}
                onChange={() => setType('ENTREE')} 
              />
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-bold">Montant</span>
            </label>
            <input 
              type="number" 
              placeholder="Ex: 5000" 
              className="input input-bordered w-full" 
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              required
              min="0"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-bold">Motif</span>
            </label>
            <input 
              type="text" 
              placeholder="Ex: Facture Electricité, Carburant..." 
              className="input input-bordered w-full" 
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Description / Détails (Optionnel)</span>
            </label>
            <textarea 
              className="textarea textarea-bordered h-24" 
              placeholder="Plus de détails..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            ></textarea>
          </div>

          {error && (
            <div className="alert alert-error text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{error}</span>
            </div>
          )}

          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose} disabled={loading}>
              Annuler
            </button>
            <button 
              type="submit" 
              className={`btn ${type === 'SORTIE' ? 'btn-error' : 'btn-success'} text-white`}
              disabled={loading}
            >
              {loading ? <span className="loading loading-spinner"></span> : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  )
}
