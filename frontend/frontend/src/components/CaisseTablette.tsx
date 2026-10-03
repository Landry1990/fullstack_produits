import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, ShoppingCart } from 'lucide-react'
import { gooeyToast } from 'goey-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useCaisseSession } from '../hooks/caisse/useCaisseSession'
import { useCaisseRealtime } from '../hooks/caisse/useCaisseRealtime'
import { useCaissePayment } from '../hooks/useCaissePayment'
import { PaymentModal } from './caisse/PaymentModal'
import type { Facture, TicketCaisse } from '../types'
import { getApiErrorDetail } from '../utils/errorHandling'

const formatAmount = (value: string | number | undefined) =>
  Number(value ?? 0).toLocaleString('fr-FR')

export default function CaisseTablette() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { selectedPosteCaisseId, myActivePoste, fetchSessionRecap } = useCaisseSession()
  const [factures, setFactures] = useState<Facture[]>([])
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [, setTicketCaisse] = useState<TicketCaisse | null>(null)

  const fetchFacturesEnAttente = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const params: Record<string, string | boolean> = {
        status__in: 'BROU,VAL,PROF',
        include_pending: true,
        include_details: true,
      }
      if (selectedPosteCaisseId !== 'all') params.poste_caisse = selectedPosteCaisseId
      const response = await api.get('factures/', { params })
      setFactures(response.data.results || response.data || [])
    } catch (error) {
      gooeyToast.error(getApiErrorDetail(error, 'Erreur lors du chargement des factures en attente'))
    } finally {
      setIsRefreshing(false)
    }
  }, [selectedPosteCaisseId])

  const fetchCoupons = useCallback(async () => {}, [])
  useCaisseRealtime({ selectedPosteCaisseId, fetchFacturesEnAttente, fetchCoupons })

  const { loading: paymentLoading, enregistrerPaiement } = useCaissePayment({
    selectedFacture,
    couponsParFacture: {},
    setCouponsParFacture: () => {},
    setTicketCaisse,
    setIsPaymentModalOpen,
    setShowTicketPreview: () => {},
    fetchFacturesEnAttente,
    fetchSessionRecap,
    fetchCoupons,
    utiliserCouponApresEncaissement: async () => {},
    onSuccess: () => setSelectedFacture(null),
  })

  const openPayment = (facture: Facture) => {
    setSelectedFacture(facture)
    setIsPaymentModalOpen(true)
  }

  if (!myActivePoste) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 p-6">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <ShoppingCart className="mx-auto mb-6 size-16 text-emerald-600" />
          <h1 className="text-3xl font-bold text-slate-800">Aucune session de caisse</h1>
          <p className="mt-4 text-xl text-slate-600">Ouvrez une session de caisse depuis la caisse centrale</p>
          <button type="button" onClick={() => navigate('/app/caisse-centralisee')} className="mt-8 min-h-16 w-full rounded-2xl bg-emerald-600 px-6 text-xl font-semibold text-white hover:bg-emerald-700">
            Retour à la caisse centrale
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50 p-4 pb-28 sm:p-6 sm:pb-28">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Caisse tablette</h1>
          <p className="mt-1 text-lg text-slate-500">{factures.length} facture{factures.length === 1 ? '' : 's'} en attente</p>
        </div>
        <div className="rounded-2xl bg-emerald-600 px-6 py-3 text-xl font-bold text-white">{factures.length}</div>
      </header>

      {factures.length === 0 && !isRefreshing ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-xl text-slate-500">Aucune facture en attente</div>
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {factures.map((facture) => (
            <button key={facture.id} type="button" onClick={() => openPayment(facture)} className="min-h-44 rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-emerald-400 hover:shadow-md active:scale-[0.99]">
              <div className="flex items-start justify-between gap-3">
                <span className="text-xl font-bold text-slate-800">{facture.numero_facture || `#${facture.id}`}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{facture.status}</span>
              </div>
              <p className="mt-4 truncate text-lg text-slate-600">{facture.client_name || facture.client_name_override || 'Client de passage'}</p>
              <p className="mt-5 text-4xl font-bold text-emerald-600">{formatAmount(facture.total_ttc)} F</p>
            </button>
          ))}
        </section>
      )}

      <button type="button" onClick={fetchFacturesEnAttente} disabled={isRefreshing} className="fixed bottom-6 right-6 flex min-h-16 items-center gap-3 rounded-2xl bg-emerald-600 px-7 text-lg font-semibold text-white shadow-xl hover:bg-emerald-700 disabled:opacity-60">
        <RefreshCw className={`size-6 ${isRefreshing ? 'animate-spin' : ''}`} />
        Rafraîchir
      </button>

      {selectedFacture && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          facture={selectedFacture}
          loading={paymentLoading}
          onConfirm={(paiements) => enregistrerPaiement(paiements, user, 'Paiement enregistré')}
        />
      )}
    </main>
  )
}
