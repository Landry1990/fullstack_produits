import { useState, useMemo } from 'react'
import axios from 'axios'
import { useTranslation } from 'react-i18next'
import { normalizeNumberInput } from '../utils/formatters'
import PremiumModal from './common/PremiumModal'

interface CashMovementModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CashMovementModal({ isOpen, onClose, onSuccess }: CashMovementModalProps) {
  const { t } = useTranslation(['cash_journal', 'common'])
  const currentLocale = t('common:locale', { defaultValue: 'fr-FR' })
  const currencySymbol = t('common.currency_symbol', 'F')
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
      const val = normalizeNumberInput(montant)
      if (!montant || isNaN(val) || val <= 0) {
        throw new Error(t('movement_modal.invalid_amount'))
      }
      if (!motif.trim()) {
        throw new Error(t('movement_modal.reason_required'))
      }

      await axios.post(`${apiBaseUrl}/api/mouvements-caisse/`, {
        type,
        montant: normalizeNumberInput(montant),
        motif,
        description
      })

      // Reset form
      setMontant('')
      setMotif('')
      setDescription('')
      setType('SORTIE')
      
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Erreur creation mouvement:', err)
      setError(err.response?.data?.detail || err.message || t('movement_modal.save_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={type === 'SORTIE' ? `📤 ${t('movement_modal.title_out')}` : `📥 ${t('movement_modal.title_in')}`}
      subtitle={t('movement_modal.subtitle')}
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${type === 'SORTIE' ? 'text-error' : 'text-success'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      }
      gradientFrom={type === 'SORTIE' ? 'error/10' : 'success/10'}
      gradientTo={type === 'SORTIE' ? 'warning/10' : 'emerald-500/10'}
      disableClose={loading}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        
        {/* Type Toggle */}
        <div className="flex justify-center mb-2">
          <div className="join">
            <input 
              className="join-item btn btn-sm px-6" 
              type="radio" 
              name="options" 
              aria-label={t('movement_modal.type_out')}
              checked={type === 'SORTIE'}
              onChange={() => setType('SORTIE')} 
            />
            <input 
              className="join-item btn btn-sm px-6" 
              type="radio" 
              name="options" 
              aria-label={t('movement_modal.type_in')}
              checked={type === 'ENTREE'}
              onChange={() => setType('ENTREE')} 
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('movement_modal.amount')}</label>
          <input 
            type="number" 
            placeholder={t('movement_modal.amount_placeholder')} 
            className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-bold" 
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            required
            min="0"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('movement_modal.reason')}</label>
          <input 
            type="text" 
            placeholder={t('movement_modal.reason_placeholder')} 
            className="input input-bordered w-full h-12 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{t('movement_modal.description')}</label>
          <textarea 
            className="textarea textarea-bordered w-full h-24 rounded-xl resize-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
            placeholder={t('movement_modal.description_placeholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          ></textarea>
        </div>

        {error && (
          <div className="alert alert-error text-sm rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn btn-ghost px-6 rounded-xl" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </button>
          <button 
            type="submit" 
            className={`btn ${type === 'SORTIE' ? 'btn-error shadow-lg shadow-error/20' : 'btn-success shadow-lg shadow-success/20'} text-white px-8 rounded-xl`}
            disabled={loading}
          >
            {loading ? <span className="loading loading-spinner"></span> : t('movement_modal.save')}
          </button>
        </div>
      </form>
    </PremiumModal>
  )
}

