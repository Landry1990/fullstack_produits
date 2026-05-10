import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import clientService from '../services/clientService'
import { toast } from 'react-hot-toast'
import type { Client, AyantDroit } from '../types'
import { facturationClientCreateSchema } from '../schemas/clientSchema'

export function useFacturationClients() {
    const { t } = useTranslation(['facturation', 'common'])
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedClient, setSelectedClient] = useState<number | null>(null)
    const [manualClientName, setManualClientName] = useState('')
    const [useManualClient, setUseManualClient] = useState(false)

    // Search state
    const [clientSearch, setClientSearch] = useState('')
    const [showClientDropdown, setShowClientDropdown] = useState(false)

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

    const [debouncedSearch, setDebouncedSearch] = useState('')

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(clientSearch)
        }, 300)
        return () => clearTimeout(timer)
    }, [clientSearch])

    // Load clients
    const fetchClients = useCallback(async () => {
        setLoading(true)
        try {
            const data = await clientService.getAll(debouncedSearch ? { search: debouncedSearch } : {})
            const clientsData = Array.isArray(data) ? data : data.results
            const loadedClients = clientsData || []
            setClients(loadedClients)
        } catch (error) {
            console.error('Erreur chargement clients:', error)
            toast.error('Impossible de charger la liste des clients')
        } finally {
            setLoading(false)
        }
    }, [debouncedSearch])

    useEffect(() => {
        fetchClients()
    }, [fetchClients])

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
                    console.error('Erreur lors du chargement des ayants droit:', err)
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
                toast.success(t('facturation:client.deposit_reminder', { solde }), {
                    icon: '💡',
                    duration: 4000,
                    id: `deposit-reminder-${selectedClient}`
                })
            }

            // 2. Reward reminder
            const discount = parseFloat(selectedClientData.pending_discount || '0')
            if (discount > 0) {
                toast.success(t('facturation:messages.reward_reminder', { discount }), {
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
                    toast.error(
                        `⚠️ PLAFOND ATTEINT : ${Math.round(debt).toLocaleString()} / ${Math.round(plafond).toLocaleString()} F. Ce client ne peut plus prendre de produits à crédit.`,
                        {
                            duration: 6000,
                            id: `limit-reached-${selectedClient}`,
                            style: { background: '#dc2626', color: 'white', fontWeight: 'bold' }
                        }
                    )
                } else if (debt > 0 && debt > plafond * 0.8) {
                     toast.success(
                        `⚠️ Attention : Plafond de crédit presque atteint (${Math.round(debt).toLocaleString()} / ${Math.round(plafond).toLocaleString()} F)`,
                        { icon: '⚠️', duration: 4000, id: `limit-warning-${selectedClient}` }
                    )
                }
            }
        }
    }, [selectedClient, selectedClientData, useManualClient, t])

    // Filtered clients
    const filteredClients = useMemo(() => {
        return clients.slice(0, 10)
    }, [clients])

    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsCreatingClient(true)
        try {
            const validation = facturationClientCreateSchema.safeParse(newClientForm)

            if (!validation.success) {
                const messages = validation.error.issues.map((issue) => issue.message).join(' | ')
                toast.error(messages || 'Le formulaire client contient des erreurs')
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

            setClients(prev => [...prev, createdClient].sort((a, b) => a.name.localeCompare(b.name)))
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

            toast.success(`Client "${createdClient.name}" créé et sélectionné`)
        } catch (err) {
            console.error('Erreur création client:', err)
            const errorData = (err as any)?.response?.data
            if (errorData && typeof errorData === 'object') {
                const messages = Object.entries(errorData).map(([k, v]) => `${k}: ${v}`).join(', ')
                toast.error(`Erreur: ${messages}`)
            } else {
                toast.error('Erreur lors de la création du client')
            }
        } finally {
            setIsCreatingClient(false)
        }
    }

    return {
        clients,
        loading,
        selectedClient, setSelectedClient,
        selectedClientData,
        manualClientName, setManualClientName,
        useManualClient, setUseManualClient,
        clientSearch, setClientSearch,
        filteredClients,
        showClientDropdown, setShowClientDropdown,
        showClientCreateModal, setShowClientCreateModal,
        newClientForm, setNewClientForm,
        isCreatingClient,
        handleCreateClient,
        ayantsDroitList,
        selectedAyantDroit, setSelectedAyantDroit,
        ayantDroitNom, setAyantDroitNom,
        ayantDroitMatricule, setAyantDroitMatricule,
        ayantDroitSociete, setAyantDroitSociete,
        showNewAyantDroit, setShowNewAyantDroit
    }
}
