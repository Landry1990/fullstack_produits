import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Facturation from '../Facturation'
import axios from 'axios'
import { useCart } from '../../hooks/useCart'
import { useFacturationClients } from '../../hooks/useFacturationClients'
import { useProductSearch } from '../../hooks/useProductSearch'
import { useAuth } from '../../context/AuthContext'
import { usePharmacySettings } from '../../hooks/usePharmacySettings'
import { usePendingSales } from '../../hooks/usePendingSales'
import { SidebarProvider } from '../../context/SidebarContext'

// Mock des modules directs
vi.mock('../../hooks/useCart')
vi.mock('../../hooks/useFacturationClients')
vi.mock('../../hooks/useProductSearch')
vi.mock('../../context/AuthContext')
vi.mock('../../hooks/usePharmacySettings')
vi.mock('../../hooks/usePendingSales')

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn()
}))

// Mock des sous-composants
vi.mock('../LotSelectionModal', () => ({ default: () => <div data-testid="lot-modal" /> }))
vi.mock('../OrdonnanceModal', () => ({ default: () => <div data-testid="ordonnance-modal" /> }))
vi.mock('./printing/TicketTemplate', () => ({ TicketTemplate: () => <div data-testid="ticket-template" /> }))
vi.mock('react-barcode', () => ({ default: () => <div data-testid="barcode" /> }))

vi.mock('../facturation/PaymentModal', () => ({
  default: ({ isOpen, onCompleteSale }: any) => isOpen ? (
    <div data-testid="payment-modal">
      <button onClick={onCompleteSale}>Confirmer Paiement</button>
    </div>
  ) : null
}))

vi.mock('../facturation/CartTable', () => ({
    default: ({ lignesFacture }: any) => (
        <div data-testid="cart-table">
            {lignesFacture?.map((l: any) => (
                <div key={l.produit.id}>{l.produit.name} - {l.quantite} - {l.total_ligne}</div>
            ))}
        </div>
    )
}))

vi.mock('../facturation/TotalsSection', () => ({
    default: () => <div data-testid="totals-section">Total TTC</div>
}))

vi.mock('../facturation/ActionButtons', () => ({
  default: ({ onPayment, isValid }: any) => (
    <div data-testid="action-buttons">
      <button 
        data-testid="encaisser-btn" 
        onClick={() => {
            console.log('CLICKED ENCAISSER, onPayment is:', typeof onPayment)
            if (onPayment) onPayment()
        }} 
        disabled={!isValid}
      >
        Encaisser Test {isValid ? 'Valid' : 'Invalid'}
      </button>
    </div>
  )
}))

// axios is mocked globally in setup.ts

describe('Facturation Integration', () => {
  const defaultCart = {
    lignesFacture: [],
    setLignesFacture: vi.fn(),
    addProduit: vi.fn(),
    updateQuantite: vi.fn(),
    updatePrix: vi.fn(),
    updateRemiseProduit: vi.fn(),
    updateLineLot: vi.fn(),
    removeLigne: vi.fn(),
    clearCart: vi.fn(),
    cartStats: { sousTotal: 0, totalTva: 0 },
    loading: false
  }

  const defaultClients = {
    clients: [],
    loading: false,
    selectedClient: null,
    setSelectedClient: vi.fn(),
    clientSearch: '',
    setClientSearch: vi.fn(),
    filteredClients: [],
    ayantsDroitList: [],
    newClientForm: { client_type: 'PARTICULIER', name: '', phone: '' },
    setNewClientForm: vi.fn(),
    showNewClientModal: false,
    setShowNewClientModal: vi.fn()
  }

  const defaultProductSearch = {
    produits: [],
    loading: false,
    searchQuery: '',
    setSearchQuery: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()

    ;(useAuth as Mock).mockReturnValue({
      user: { id: 1, username: 'testuser', can_sell_negative_stock: true }
    })

    ;(usePharmacySettings as Mock).mockReturnValue({
      settings: { centralized_cash_register: true }
    })

    ;(useCart as Mock).mockReturnValue(defaultCart)
    ;(useFacturationClients as Mock).mockReturnValue(defaultClients)
    ;(useProductSearch as Mock).mockReturnValue(defaultProductSearch)
    ;(usePendingSales as Mock).mockReturnValue({
      ventesEnAttente: [],
      showPendingSales: false,
      setShowPendingSales: vi.fn()
    })

    vi.mocked(axios.get).mockImplementation((url) => {
        if (url && url.includes('/api/settings/')) {
            return Promise.resolve({ data: { centralized_cash_register: true } })
        }
        return Promise.resolve({ data: [] })
    })
  })

  it('affiche les composants principaux au chargement', () => {
    render(
      <MemoryRouter>
        <SidebarProvider>
          <Facturation />
        </SidebarProvider>
      </MemoryRouter>
    )

    expect(screen.getByPlaceholderText(/Saisir.*matricule/i)).toBeInTheDocument()
    expect(screen.getByTestId('encaisser-btn')).toBeInTheDocument()
    expect(screen.getByText(/Total TTC/i)).toBeInTheDocument()
  })

  it('affiche un panier vide au démarrage', () => {
    render(
      <MemoryRouter>
        <SidebarProvider>
          <Facturation />
        </SidebarProvider>
      </MemoryRouter>
    )

    // The cart table structure is rendered empty by default when empty
    expect(screen.getByText(/0\s*article/i)).toBeInTheDocument()
  })

  it('affiche les produits dans le panier quand useCart renvoie des données', async () => {
    const ligneFacture = {
      produit: { id: 1, name: 'Doliprane', selling_price: '500', stock: 100, is_deleted: false },
      quantite: 2,
      prix_unitaire: '500',
      remise_produit: '0',
      total_ligne: 1000
    }

    ;(useCart as Mock).mockReturnValue({
      ...defaultCart,
      lignesFacture: [ligneFacture],
      cartStats: { sousTotal: 1000, totalTva: 0 }
    })

    render(
      <MemoryRouter>
        <SidebarProvider>
          <Facturation />
        </SidebarProvider>
      </MemoryRouter>
    )

    // Utilisation de findByText pour attendre le rendu asynchrone si nécessaire
    expect(await screen.findByText(/Doliprane/)).toBeInTheDocument()
    expect(screen.getByText(/1000/)).toBeInTheDocument() // Via le mock CartTable
  })

  it.skip('ouvre la modal de paiement au clic sur Encaisser', async () => {
    const ligneFacture = {
      produit: { id: 1, name: 'Doliprane', selling_price: '500', stock: 100, is_deleted: false },
      quantite: 1,
      prix_unitaire: '500',
      remise_produit: '0',
      total_ligne: 500
    }

    ;(useCart as Mock).mockReturnValue({
      ...defaultCart,
      lignesFacture: [ligneFacture],
      cartStats: { sousTotal: 500, totalTva: 0 }
    })

    ;(useFacturationClients as Mock).mockReturnValue({
      ...defaultClients,
      selectedClient: 1,
      clients: [{ id: 1, name: 'Client Test', client_type: 'PARTICULIER' }]
    })

    render(
      <MemoryRouter>
        <SidebarProvider>
          <Facturation />
        </SidebarProvider>
      </MemoryRouter>
    )

    const encaisserBtn = screen.getByTestId('encaisser-btn')
    fireEvent.click(encaisserBtn)

    expect(await screen.findByTestId('payment-modal')).toBeInTheDocument()
  })
})
