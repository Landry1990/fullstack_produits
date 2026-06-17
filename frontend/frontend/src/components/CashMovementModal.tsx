import { useState } from 'react'
import api from '../services/api'
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
  const [type, setType] = useState<'ENTREE' | 'SORTIE'>('SORTIE')
  const [montant, setMontant] = useState('')
  const [motif, setMotif] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)


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

      await api.post('mouvements-caisse/', {
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
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${type === 'SORTIE' ? 'text-red-600' : 'text-emerald-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      }
      gradientFrom={type === 'SORTIE' ? 'red-50' : 'emerald-50'}
      gradientTo={type === 'SORTIE' ? 'amber-50' : 'emerald-50'}
      disableClose={loading}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5">

        {/* Type Toggle */}
        <div className="flex justify-center mb-2">
          <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-white">
            <button
              type="button"
              className={`px-6 py-1.5 rounded-md text-sm font-medium transition-colors ${type === 'SORTIE' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              onClick={() => setType('SORTIE')}
            >
              {t('movement_modal.type_out')}
            </button>
            <button
              type="button"
              className={`px-6 py-1.5 rounded-md text-sm font-medium transition-colors ${type === 'ENTREE' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              onClick={() => setType('ENTREE')}
            >
              {t('movement_modal.type_in')}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('movement_modal.amount')}</label>
          <input
            type="number"
            placeholder={t('movement_modal.amount_placeholder')}
            className="w-full h-12 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all font-bold"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            required
            min="0"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('movement_modal.reason')}</label>
          <input
            type="text"
            placeholder={t('movement_modal.reason_placeholder')}
            className="w-full h-12 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{t('movement_modal.description')}</label>
          <textarea
            className="w-full h-24 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 resize-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            placeholder={t('movement_modal.description_placeholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          ></textarea>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="inline-flex items-center justify-center h-9 px-6 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors" onClick={onClose} disabled={loading}>
            {t('common:cancel')}
          </button>
          <button
            type="submit"
            className={`inline-flex items-center justify-center h-9 px-8 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${type === 'SORTIE' ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20'}`}
            disabled={loading}
          >
            {loading ? <div className="animate-spin rounded-full size-4 border-b-2 border-white"></div> : t('movement_modal.save')}
          </button>
        </div>
      </form>
    </PremiumModal>
  )
}

