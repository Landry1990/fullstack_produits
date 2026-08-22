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
import { ConfirmProvider } from '../../hooks/useConfirm'

// Mock des modules directs
vi.mock('../../hooks/useCart')
vi.mock('../../hooks/useFacturationClients')
vi.mock('../../hooks/useProductSearch')
vi.mock('../../context/AuthContext')
vi.mock('../../hooks/usePharmacySettings')
vi.mock('../../hooks/usePendingSales')

vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn().mockReturnValue({ data: null, isLoading: false }),
    useMutation: vi.fn().mockReturnValue({ mutate: vi.fn(), isLoading: false }),
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
}));

// Mock des sous-composants
vi.mock('../LotSelectionModal', () => ({ default: () => <div data-testid="lot-modal" /> }))
vi.mock('../OrdonnanceModal', () => ({ default: () => <div data-testid="ordonnance-modal" /> }))
vi.mock('./printing/TicketTemplate', () => ({ TicketTemplate: () => <div data-testid="ticket-template" /> }))
vi.mock('react-barcode', () => ({ default: () => <div data-testid="barcode" /> }))

vi.mock('../facturation/PaymentModal', () => ({
  default: ({ isOpen, onCompleteSale }: { isOpen: boolean; onCompleteSale: () => void }) => isOpen ? (
    <div data-testid="payment-modal">
      <button onClick={onCompleteSale}>Confirmer Paiement</button>
    </div>
  ) : null
}))

vi.mock('../facturation/TicketPreviewModal', () => ({ default: () => null }))
vi.mock('../facturation/StockResolutionHandler', () => ({ StockResolutionHandler: () => null }))
vi.mock('../SubstitutionModal', () => ({ SubstitutionModal: () => null }))
vi.mock('../facturation/PrescriptionScannerModal', () => ({ default: () => null }))
vi.mock('../caisse/OpenPointDeVenteModal', () => ({ OpenPointDeVenteModal: () => null }))
vi.mock('../facturation/PendingSalesDrawer', () => ({ default: () => null }))
vi.mock('../facturation/ClientCreateModal', () => ({ default: () => null }))
vi.mock('../common/SudoValidationModal', () => ({ default: () => null }))
vi.mock('../common/PremiumModal', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock('../sales/modals/ClientNameModal', () => ({ ClientNameModal: () => null }))
vi.mock('../facturation/AlertMessageModal', () => ({ default: () => null }))
vi.mock('../facturation/DisplayAlertModal', () => ({ default: () => null }))
vi.mock('../facturation/ForceStockModal', () => ({ default: () => null }))
vi.mock('../facturation/FacturationNotifications', () => ({ default: () => null }))
vi.mock('../facturation/PosteRequisOverlay', () => ({ default: () => null }))
vi.mock('../facturation/FacturationHeader', () => ({ default: ({ hook }: { hook: { t: (k: string) => string; lignesFacture: unknown[] } }) => (
  <div data-testid="facturation-header">
    <span>{hook.t('facturation:title')}</span>
    <button data-testid="encaisser-btn" disabled={!hook.lignesFacture?.length} onClick={() => {}}>
      Encaisser Test {hook.lignesFacture?.length ? 'Valid' : 'Invalid'}
    </button>
  </div>
) }))
vi.mock('../facturation/FacturationLeftPanel', () => ({ default: () => <div data-testid="left-panel" /> }))
vi.mock('../facturation/FacturationRightPanel', () => ({ default: ({ hook }: { hook: { lignesFacture: Array<{ produit: { id: number; name: string }; quantite: number; total_ligne: number }> } }) => (
  <div data-testid="right-panel">
    <div data-testid="cart-table">
      {hook.lignesFacture?.map((l) => (
        <div key={l.produit.id}>{l.produit.name} - {l.quantite} - {l.total_ligne}</div>
      ))}
    </div>
    <div data-testid="totals-section">Total TTC</div>
  </div>
) }))

vi.mock('../facturation/CartTable', () => ({
    default: ({ lignesFacture }: { lignesFacture?: Array<{ produit: { id: number; name: string }; quantite: number; total_ligne: number }> }) => (
        <div data-testid="cart-table">
            {lignesFacture?.map((l) => (
                <div key={l.produit.id}>{l.produit.name} - {l.quantite} - {l.total_ligne}</div>
            ))}
        </div>
    )
}))

vi.mock('../facturation/TotalsSection', () => ({
    default: () => <div data-testid="totals-section">Total TTC</div>
}))

vi.mock('../facturation/ActionButtons', () => ({
  default: ({ onPayment, isValid }: { onPayment?: () => void; isValid?: boolean }) => (
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
    applyMarkupToCart: vi.fn(),
    bulkAddProduits: vi.fn(),
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
          <ConfirmProvider>
            <Facturation />
          </ConfirmProvider>
        </SidebarProvider>
      </MemoryRouter>
    )

    expect(screen.getByTestId('facturation-header')).toBeInTheDocument()
    expect(screen.getByTestId('encaisser-btn')).toBeInTheDocument()
    expect(screen.getByText(/Total TTC/i)).toBeInTheDocument()
  })

  it('affiche un panier vide au démarrage', () => {
    render(
      <MemoryRouter>
        <SidebarProvider>
          <ConfirmProvider>
            <Facturation />
          </ConfirmProvider>
        </SidebarProvider>
      </MemoryRouter>
    )

    // Le compteur de lignes affiche 0 et le panier mocké est vide
    expect(screen.getByTestId('cart-table')).toBeInTheDocument()
  })

  it('affiche les produits dans le panier quand useCart renvoie des données', async () => {
    const ligneFacture = {
      lineId: 'test-line-1',
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
          <ConfirmProvider>
            <Facturation />
          </ConfirmProvider>
        </SidebarProvider>
      </MemoryRouter>
    )

    // Utilisation de findByText pour attendre le rendu asynchrone si nécessaire
    expect(await screen.findByText(/Doliprane/)).toBeInTheDocument()
    expect(screen.getByText(/1000/)).toBeInTheDocument() // Via le mock CartTable
  })

  it.skip('ouvre la modal de paiement au clic sur Encaisser', async () => {
    const ligneFacture = {
      lineId: 'test-line-2',
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
          <ConfirmProvider>
            <Facturation />
          </ConfirmProvider>
        </SidebarProvider>
      </MemoryRouter>
    )

    const encaisserBtn = screen.getByTestId('encaisser-btn')
    fireEvent.click(encaisserBtn)

    expect(await screen.findByTestId('payment-modal')).toBeInTheDocument()
  })
})

