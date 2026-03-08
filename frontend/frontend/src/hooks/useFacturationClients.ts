import { useState, useEffect, useMemo, useCallback } from 'react'
import clientService from '../services/clientService'
import { toast } from 'react-hot-toast'
import type { Client, AyantDroit } from '../types'
import axios from 'axios'

export function useFacturationClients() {
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
        plafond: '0',
        taux_couverture: '0',
        remise_automatique: '0',
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

            // Select "CLIENTS DIVERS" by default if it exists and no client is already selected
            if (!debouncedSearch && !selectedClient) {
                const clientsDivers = loadedClients.find((c: Client) =>
                    c.name.trim().toUpperCase() === 'CLIENTS DIVERS' ||
                    c.name.trim().toUpperCase() === 'CLIENT DIVERS'
                )
                if (clientsDivers) {
                    setSelectedClient(clientsDivers.id)
                }
            }
        } catch (error) {
            console.error('Erreur chargement clients:', error)
            toast.error('Impossible de charger la liste des clients')
        } finally {
            setLoading(false)
        }
    }, [debouncedSearch, selectedClient])

    useEffect(() => {
        fetchClients()
    }, [fetchClients])

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

    // Filtered clients
    const filteredClients = useMemo(() => {
        return clients.slice(0, 10)
    }, [clients])

    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsCreatingClient(true)
        try {
            const createdClient = await clientService.create(newClientForm as Partial<Client>)

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
                plafond: '0',
                taux_couverture: '0',
                remise_automatique: '0',
                is_loyalty_member: true
            })

            toast.success(`Client "${createdClient.name}" créé et sélectionné`)
        } catch (err) {
            console.error('Erreur création client:', err)
            if (axios.isAxiosError(err)) {
                const errorData = err.response?.data
                if (typeof errorData === 'object' && errorData !== null) {
                    const messages = Object.entries(errorData).map(([k, v]) => `${k}: ${v}`).join(', ')
                    toast.error(`Erreur: ${messages}`)
                } else {
                    toast.error('Erreur lors de la création du client')
                }
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
