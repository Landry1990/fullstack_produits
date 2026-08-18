import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDebounce } from 'use-debounce'
import { isCancel } from 'axios'
import clientService from '../services/clientService'
import { gooeyToast } from 'goey-toast'
import type { Client, AyantDroit } from '../types'
import { facturationClientCreateSchema } from '../schemas/clientSchema'
import { logger } from '../utils/logger'

export function useFacturationClients() {
    const { t } = useTranslation(['facturation', 'common'])
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedClient, setSelectedClient] = useState<number | null>(null)
    const [manualClientName, setManualClientName] = useState('')
    const [useManualClient, setUseManualClient] = useState(false)

    // Search state
    const [clientSearch, setClientSearch] = useState('')
    const [debouncedSearch] = useDebounce(clientSearch, 200)
    const [showClientDropdown, setShowClientDropdown] = useState(false)
    const [ayantDroitSearchResults, setAyantDroitSearchResults] = useState<AyantDroit[]>([])
    const [ayantDroitSearchLoading, setAyantDroitSearchLoading] = useState(false)

    // Create Client Modal State
    const [showClientCreateModal, setShowClientCreateModal] = useState(false)
    const [isCreatingClient, setIsCreatingClient] = useState(false)
    const [newClientForm, setNewClientForm] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        client_type: 'PARTICULIER' as 'PARTICULIER' | 'PROFESSIONNEL',
        plafond: '-1',
        taux_couverture: '0',
        remise_automatique: '0',
        majoration_pro_pourcentage: '0',
        is_loyalty_member: true
    })

    // Ayants Droit State
    const [ayantsDroitList, setAyantsDroitList] = useState<AyantDroit[]>([])
    const [selectedAyantDroit, setSelectedAyantDroit] = useState<number | null>(null)
    const [ayantDroitNom, setAyantDroitNom] = useState('')
    const [ayantDroitMatricule, setAyantDroitMatricule] = useState('')
    const [ayantDroitSociete, setAyantDroitSociete] = useState('')
    const [showNewAyantDroit, setShowNewAyantDroit] = useState(false)

    // Load clients
    const fetchClients = useCallback(async (signal?: AbortSignal) => {
        const query = debouncedSearch.trim()
        if (query.length === 1) {
            return
        }
        setLoading(true)
        try {
            const filters = query ? { search: query, page_size: 25 } : {}
            const data = await clientService.getAll(filters, false, signal) as unknown as Client[] | { results?: Client[] }
            const clientsData = Array.isArray(data) ? data : (data.results || [])
            const loadedClients = clientsData || []
            setClients(loadedClients)
        } catch (error) {
            if (isCancel(error)) return
            logger.error('Erreur chargement clients:', error)
            gooeyToast.error(t('messages.client_load_error'))
        } finally {
            setLoading(false)
        }
    }, [debouncedSearch, t])

    useEffect(() => {
        const controller = new AbortController()
        fetchClients(controller.signal)
        return () => controller.abort()
    }, [fetchClients])

    // Recherche globale d'ayants droit dans le même champ client
    useEffect(() => {
        const query = debouncedSearch.trim()
        if (query.length < 2) {
            setAyantDroitSearchResults([])
            setAyantDroitSearchLoading(false)
            return
        }

        setAyantDroitSearchLoading(true)
        const controller = new AbortController()
        const searchAyants = async () => {
            try {
                const data = await clientService.searchAyantsDroit(query, controller.signal)
                setAyantDroitSearchResults(data)
            } catch (error) {
                if (isCancel(error)) return
                setAyantDroitSearchResults([])
            } finally {
                setAyantDroitSearchLoading(false)
            }
        }
        searchAyants()
        return () => controller.abort()
    }, [debouncedSearch])

    const [hasInitialAutoSelect, setHasInitialAutoSelect] = useState(false)

    // Select "CLIENTS DIVERS" by default on initial load only
    useEffect(() => {
        if (clients.length > 0 && !selectedClient && !clientSearch && !hasInitialAutoSelect) {
            const clientsDivers = clients.find((c: Client) =>
                c.name.trim().toUpperCase() === 'CLIENTS DIVERS' ||
                c.name.trim().toUpperCase() === 'CLIENT DIVERS'
            )
            if (clientsDivers) {
                setSelectedClient(clientsDivers.id)
                setHasInitialAutoSelect(true)
            }
        }
    }, [clients, selectedClient, clientSearch, hasInitialAutoSelect])

    // Load Ayants Droit when client changes
    useEffect(() => {
        const fetchAyantsDroit = async () => {
            if (!selectedClient || useManualClient) {
                setAyantsDroitList([])
                setSelectedAyantDroit(null)
                setShowNewAyantDroit(false)
                return
            }

            const client = clients.find(c => c.id === selectedClient)
            if (client?.client_type === 'PROFESSIONNEL') {
                try {
                    const data = await clientService.getAyantsDroit(selectedClient)
                    setAyantsDroitList(data)
                } catch (err) {
                    logger.error('Erreur lors du chargement des ayants droit:', err)
                    setAyantsDroitList([])
                }
            } else {
                setAyantsDroitList([])
                setSelectedAyantDroit(null)
                setShowNewAyantDroit(false)
            }
        }
        fetchAyantsDroit()
    }, [selectedClient, clients, useManualClient])
    
    const selectedClientData = useMemo(() => {
        if (selectedClient === null) return null
        return clients.find(c => c.id === selectedClient) || null
    }, [clients, selectedClient])
    // Reminders when client is selected
    useEffect(() => {
        if (selectedClient && !useManualClient && selectedClientData) {
            // 1. Deposit reminder
            const solde = parseFloat(selectedClientData.solde_depot || '0')
            if (solde > 0) {
                gooeyToast.success(t('facturation:client.deposit_reminder', { solde }), {
                    icon: '💡',
                    duration: 4000,
                    id: `deposit-reminder-${selectedClient}`
                })
            }

            // 2. Reward reminder
            const discount = parseFloat(selectedClientData.pending_discount || '0')
            if (discount > 0) {
                gooeyToast.success(t('facturation:messages.reward_reminder', { discount }), {
                    icon: '⭐',
                    duration: 5000,
                    id: `reward-reminder-${selectedClient}`
                })
            }

            // 3. Credit limit reminder
            const plafond = Number(selectedClientData.plafond || 0)
            const debt = Number(selectedClientData.current_debt || 0)
            const isPro = selectedClientData.client_type === 'PROFESSIONNEL'
            
            if (isPro && plafond !== -1) {
                if (debt > 0 && debt >= plafond) {
                    gooeyToast.error(
                        `⚠️ PLAFOND ATTEINT : ${Math.round(debt).toLocaleString()} / ${Math.round(plafond).toLocaleString()} F. Ce client ne peut plus prendre de produits à crédit.`,
                        {
                            duration: 6000,
                            id: `limit-reached-${selectedClient}`,
                            style: { background: '#dc2626', color: 'white', fontWeight: 'bold' }
                        }
                    )
                } else if (debt > 0 && debt > plafond * 0.8) {
                     gooeyToast.success(
                        `⚠️ Attention : Plafond de crédit presque atteint (${Math.round(debt).toLocaleString()} / ${Math.round(plafond).toLocaleString()} F)`,
                        { icon: '⚠️', duration: 4000, id: `limit-warning-${selectedClient}` }
                    )
                }
            }
        }
    }, [selectedClient, selectedClientData, useManualClient, t])

    // Filtered clients
    const filteredClients = useMemo(() => {
        const query = clientSearch.trim().toLowerCase()
        if (!query || clients.length === 0) {
            return clients.slice().sort((a, b) => a.name.localeCompare(b.name)).slice(0, 10)
        }
        const scored = clients.map(client => {
            const name = client.name.toLowerCase()
            const phone = (client.phone || '').toLowerCase()
            let score = 0
            if (name.startsWith(query)) score = 3
            else if (name.includes(query)) score = 2
            if (phone.includes(query)) score = Math.max(score, 1)
            return { client, score }
        }).filter(item => item.score > 0)
        scored.sort((a, b) => b.score - a.score || a.client.name.localeCompare(b.client.name))
        return scored.map(item => item.client).slice(0, 10)
    }, [clients, clientSearch])

    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsCreatingClient(true)
        try {
            const validation = facturationClientCreateSchema.safeParse(newClientForm)

            if (!validation.success) {
                const messages = validation.error.issues.map((issue) => issue.message).join(' | ')
                gooeyToast.error(messages || 'Le formulaire client contient des erreurs')
                return
            }

            const payload: Partial<Client> = {
                ...validation.data,
                address: validation.data.address ?? undefined,
                phone: validation.data.phone ?? undefined,
                email: validation.data.email ?? undefined,
                plafond: String(validation.data.plafond),
                taux_couverture: String(validation.data.taux_couverture),
                remise_automatique: String(validation.data.remise_automatique),
                majoration_pro_pourcentage: String(validation.data.majoration_pro_pourcentage),
            };
            const createdClient = await clientService.create(payload)

            const updatedClients = [...clients, createdClient].slice().sort((a, b) => a.name.localeCompare(b.name))
            setClients(updatedClients)
            setSelectedClient(createdClient.id)
            setShowClientCreateModal(false)
            setClientSearch('')

            setNewClientForm({
                name: '',
                phone: '',
                email: '',
                address: '',
                client_type: 'PARTICULIER',
                plafond: '-1',
                taux_couverture: '0',
                remise_automatique: '0',
                majoration_pro_pourcentage: '0',
                is_loyalty_member: true
            })

            gooeyToast.success(t('messages.client_created_selected', { name: createdClient.name }))
        } catch (err) {
            logger.error('Erreur création client:', err)
            const errorData = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
            if (errorData && typeof errorData === 'object') {
                const messages = Object.entries(errorData).map(([k, v]) => `${k}: ${v}`).join(', ')
                gooeyToast.error(t('messages.client_create_field_error', { message: messages }))
            } else {
                gooeyToast.error(t('messages.client_create_error'))
            }
        } finally {
            setIsCreatingClient(false)
        }
    }

    const handleSelectAyantDroit = useCallback(async (ad: AyantDroit) => {
        const clientId = ad.client
        if (!clientId) return

        try {
            const clientExists = clients.some(c => c.id === clientId)
            if (!clientExists) {
                const client = await clientService.getById(clientId)
                setClients(prev => [...prev, client].slice().sort((a, b) => a.name.localeCompare(b.name)))
            }

            setSelectedClient(clientId)
            setClientSearch('')
            setShowClientDropdown(false)

            setSelectedAyantDroit(ad.id ?? null)
            setAyantDroitNom(ad.nom)
            setAyantDroitMatricule(ad.matricule)
            setAyantDroitSociete(ad.societe || '')
            setShowNewAyantDroit(false)
        } catch (err) {
            logger.error('Erreur chargement client ayant droit:', err)
            gooeyToast.error(t('messages.client_load_error'))
        }
    }, [clients, t])

    return {
        clients,
        loading,
        selectedClient, setSelectedClient,
        selectedClientData,
        manualClientName, setManualClientName,
        useManualClient, setUseManualClient,
        clientSearch, setClientSearch,
        filteredClients,
        ayantDroitSearchResults,
        ayantDroitSearchLoading,
        showClientDropdown, setShowClientDropdown,
        showClientCreateModal, setShowClientCreateModal,
        newClientForm, setNewClientForm,
        isCreatingClient,
        handleCreateClient,
        handleSelectAyantDroit,
        ayantsDroitList,
        selectedAyantDroit, setSelectedAyantDroit,
        ayantDroitNom, setAyantDroitNom,
        ayantDroitMatricule, setAyantDroitMatricule,
        ayantDroitSociete, setAyantDroitSociete,
        showNewAyantDroit, setShowNewAyantDroit
    }
}
