import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { staggerContainer, fadeInUp } from '../../lib/motion'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'
import { gooeyToast } from 'goey-toast'
import { getApiErrorDetail } from '../../utils/errorHandling'
import { History, Search } from 'lucide-react'
import type { StockLot } from '../../types'
import { formatCurrency } from '../../utils/formatters'
import { formatDate, formatDateTime } from '../../utils/dateUtils'
import { isLotExpired } from '../../utils/expiry'
import { usePharmacySettings } from '../../hooks/usePharmacySettings'
import { Badge } from '../shadcn/badge'
import { Input } from '../shadcn/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../shadcn/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../shadcn/dialog'
import { EmptyState } from '../ui/EmptyState'
import SkeletonTable from '../ui/SkeletonTable'
import { PageContainer } from '../ui/PageContainer'
import { cn } from '../../lib/utils'
import { logger } from '../../utils/logger'

interface LotMouvement {
    date: string
    type: 'ENTREE' | 'VENTE' | 'AJUSTEMENT' | 'AVOIR_FOURNISSEUR' | 'RETOUR_CLIENT' | 'RESOLUTION'
    quantite: number
    solde_apres: number
    reference: string | null
    detail: string
    user: string | null
}

interface LotMouvementsResponse {
    lot: {
        id: number
        lot: string | null
        produit_id: number | null
        produit_nom: string
        fournisseur_nom: string
        date_reception: string
        date_expiration: string | null
        quantity_initial: number
        quantity_remaining: number
        quantity_reserved: number
        price_cost: string
    }
    mouvements: LotMouvement[]
}

interface PaginatedLots {
    count: number
    results: StockLot[]
}

const MIN_SEARCH_LENGTH = 2
const MAX_RESULTS = 50

const TYPE_BADGE_CLASS: Record<LotMouvement['type'], string> = {
    ENTREE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    VENTE: 'bg-blue-100 text-blue-700 border-blue-200',
    AJUSTEMENT: 'bg-amber-100 text-amber-700 border-amber-200',
    AVOIR_FOURNISSEUR: 'bg-red-100 text-red-700 border-red-200',
    RETOUR_CLIENT: 'bg-violet-100 text-violet-700 border-violet-200',
    RESOLUTION: 'bg-slate-200 text-slate-700 border-slate-300',
}

export default function TraceurLots() {
    const { t } = useTranslation(['stock', 'common'])
    const navigate = useNavigate()
    const { settings: pharmacySettings } = usePharmacySettings()

    const [lots, setLots] = useState<StockLot[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)

    const [searchInput, setSearchInput] = useState('')
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const [selectedLotId, setSelectedLotId] = useState<number | null>(null)
    const [mouvementsData, setMouvementsData] = useState<LotMouvementsResponse | null>(null)
    const [loadingMouvements, setLoadingMouvements] = useState(false)

    // Aucun chargement initial : la recherche déclenche seule la requête
    // (n° lot, produit ou fournisseur — lots épuisés inclus).
    const searchLots = useCallback(async (term: string) => {
        if (term.length < MIN_SEARCH_LENGTH) {
            setLots([])
            setSearched(false)
            return
        }
        setLoading(true)
        try {
            const response = await api.get<PaginatedLots | StockLot[]>('stock-lots/', {
                params: {
                    search: term,
                    include_empty: 'true',
                    page_size: MAX_RESULTS,
                    ordering: '-date_reception',
                },
            })
            const data = response.data
            setLots(Array.isArray(data) ? data : (data.results || []))
            setSearched(true)
        } catch (err) {
            logger.error('Erreur recherche lots:', err)
            gooeyToast.error(getApiErrorDetail(err, t('common:messages.error_generic')))
        } finally {
            setLoading(false)
        }
    }, [t])

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        const term = searchInput.trim()
        debounceRef.current = setTimeout(() => searchLots(term), 350)
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    }, [searchInput, searchLots])

    const openMouvements = async (lotId: number) => {
        setSelectedLotId(lotId)
        setMouvementsData(null)
        setLoadingMouvements(true)
        try {
            const response = await api.get<LotMouvementsResponse>(`stock-lots/${lotId}/mouvements/`)
            setMouvementsData(response.data)
        } catch (err) {
            logger.error('Erreur chargement mouvements:', err)
            gooeyToast.error(getApiErrorDetail(err, t('stock:lot_tracer.mouvements.load_error')))
            setSelectedLotId(null)
        } finally {
            setLoadingMouvements(false)
        }
    }

    const openProduct = (productId: number | null | undefined) => {
        if (productId) navigate('/app/produits', { state: { searchProduitId: productId } })
    }

    return (
        <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="h-full min-h-0 bg-slate-100 p-2 sm:p-3 lg:p-4 flex flex-col overflow-hidden"
        >
            <PageContainer className="flex flex-col h-full gap-2 lg:gap-4 p-0 sm:p-0">
                {/* Header */}
                <motion.div variants={fadeInUp} className="flex items-center gap-2 lg:gap-3 shrink-0">
                    <div className="size-8 lg:size-10 rounded-xl lg:rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                        <History className="size-4 lg:size-5" />
                    </div>
                    <div>
                        <h1 className="text-lg lg:text-2xl font-black tracking-tight text-slate-800">
                            {t('stock:lot_tracer.title')}
                        </h1>
                        <p className="text-caption lg:text-xs font-semibold text-slate-400 uppercase tracking-widest hidden lg:block">
                            {t('stock:lot_tracer.subtitle')}
                        </p>
                    </div>
                </motion.div>

                {/* Recherche uniquement — rien n'est chargé tant qu'on ne tape pas */}
                <motion.div variants={fadeInUp} className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-slate-200 p-3 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                        <Input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder={t('stock:lot_tracer.search_placeholder')}
                            className="pl-9"
                            autoFocus
                        />
                    </div>
                </motion.div>

                {/* Résultats */}
                <motion.div variants={fadeInUp} className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-0">
                    <div className="overflow-auto flex-1 min-h-0">
                        {loading ? (
                            <SkeletonTable rows={6} columns={8} />
                        ) : !searched ? (
                            <EmptyState
                                title={t('stock:lot_tracer.hint')}
                                icon={<Search className="size-8" />}
                            />
                        ) : lots.length === 0 ? (
                            <EmptyState title={t('stock:lot_tracer.empty')} />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('stock:lot_tracer.col_product')}</TableHead>
                                        <TableHead>{t('stock:lot_tracer.col_lot')}</TableHead>
                                        <TableHead>{t('stock:lot_tracer.col_supplier')}</TableHead>
                                        <TableHead>{t('stock:lot_tracer.col_entry_date')}</TableHead>
                                        <TableHead className="text-right">{t('stock:lot_tracer.col_entry_qty')}</TableHead>
                                        <TableHead className="text-right">{t('stock:lot_tracer.col_remaining')}</TableHead>
                                        <TableHead>{t('stock:lot_tracer.col_expiration')}</TableHead>
                                        <TableHead className="text-right">{t('stock:lot_tracer.col_value')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lots.map((lot) => {
                                        const expired = !!lot.date_expiration && isLotExpired(lot.date_expiration, pharmacySettings.expiry_cutoff)
                                        const depleted = lot.quantity_remaining <= 0
                                        return (
                                            <TableRow key={lot.id} className="cursor-pointer" onClick={() => openMouvements(lot.id)}>
                                                <TableCell>
                                                    <button
                                                        className="font-medium text-slate-800 hover:text-emerald-600 hover:underline text-left"
                                                        onClick={(e) => { e.stopPropagation(); openProduct(lot.produit) }}
                                                    >
                                                        {lot.produit_nom}
                                                    </button>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">{lot.lot ?? '—'}</TableCell>
                                                <TableCell className="text-slate-600">{lot.fournisseur_nom || '—'}</TableCell>
                                                <TableCell>{formatDate(lot.date_reception)}</TableCell>
                                                <TableCell className="text-right">{lot.quantity_initial}</TableCell>
                                                <TableCell className="text-right">
                                                    <span className={cn('font-semibold', depleted ? 'text-slate-400' : 'text-emerald-700')}>
                                                        {lot.quantity_remaining}
                                                    </span>
                                                    {depleted && (
                                                        <Badge variant="secondary" className="ml-2">{t('stock:lot_tracer.depleted_badge')}</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {lot.date_expiration ? (
                                                        <span className={cn(expired && 'text-red-600 font-semibold')}>
                                                            {formatDate(lot.date_expiration)}
                                                            {expired && <Badge variant="destructive" className="ml-2">{t('stock:lot_tracer.expired_badge')}</Badge>}
                                                        </span>
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(Math.round(Number(lot.price_cost || 0) * lot.quantity_remaining))}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </motion.div>
            </PageContainer>

            {/* Dialog timeline des mouvements */}
            <Dialog open={selectedLotId !== null} onOpenChange={(open) => { if (!open) setSelectedLotId(null) }}>
                <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>
                            {mouvementsData
                                ? t('stock:lot_tracer.mouvements.title', { lot: mouvementsData.lot.lot ?? mouvementsData.lot.id })
                                : t('stock:lot_tracer.mouvements.title', { lot: '' })}
                        </DialogTitle>
                        {mouvementsData && (
                            <p className="text-sm text-slate-500">
                                {t('stock:lot_tracer.mouvements.subtitle', {
                                    product: mouvementsData.lot.produit_nom,
                                    date: formatDate(mouvementsData.lot.date_reception),
                                })}
                                {' · '}
                                {mouvementsData.lot.quantity_remaining}/{mouvementsData.lot.quantity_initial}
                            </p>
                        )}
                    </DialogHeader>
                    <div className="overflow-auto flex-1 min-h-0">
                        {loadingMouvements ? (
                            <SkeletonTable rows={6} columns={6} />
                        ) : mouvementsData && mouvementsData.mouvements.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="whitespace-nowrap">{t('stock:lot_tracer.mouvements.col_date')}</TableHead>
                                        <TableHead className="whitespace-nowrap">{t('stock:lot_tracer.mouvements.col_type')}</TableHead>
                                        <TableHead className="text-right whitespace-nowrap">{t('stock:lot_tracer.mouvements.col_qty')}</TableHead>
                                        <TableHead className="text-right whitespace-nowrap">{t('stock:lot_tracer.mouvements.col_balance')}</TableHead>
                                        <TableHead className="whitespace-nowrap">{t('stock:lot_tracer.mouvements.col_ref')}</TableHead>
                                        <TableHead>{t('stock:lot_tracer.mouvements.col_detail')}</TableHead>
                                        <TableHead className="whitespace-nowrap">{t('stock:lot_tracer.mouvements.col_user')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mouvementsData.mouvements.map((mvt, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="whitespace-nowrap">{formatDateTime(mvt.date)}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn('whitespace-nowrap', TYPE_BADGE_CLASS[mvt.type])}>
                                                    {t(`stock:lot_tracer.mouvements.types.${mvt.type}`)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className={cn('text-right font-semibold', mvt.quantite > 0 ? 'text-emerald-700' : 'text-red-600')}>
                                                {mvt.quantite > 0 ? `+${mvt.quantite}` : mvt.quantite}
                                            </TableCell>
                                            <TableCell className="text-right">{mvt.solde_apres}</TableCell>
                                            <TableCell className="font-mono text-xs">{mvt.reference || '—'}</TableCell>
                                            <TableCell className="text-slate-600">{mvt.detail || '—'}</TableCell>
                                            <TableCell className="text-slate-600">{mvt.user || '—'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <EmptyState title={t('stock:lot_tracer.mouvements.empty')} />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </motion.div>
    )
}
