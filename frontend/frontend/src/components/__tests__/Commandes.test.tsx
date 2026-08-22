import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Commandes from '../Commandes'
import { useCommandesStore } from '../../stores/useCommandesStore'

// Hoisted mock for handleCloturerCommande so we can spy on it in tests
const { mockHandleCloturerCommande } = vi.hoisted(() => ({
  mockHandleCloturerCommande: vi.fn(),
}))

// Mock des libs externes
vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))
// axios is mocked globally in setup.ts
vi.mock('dompurify', () => ({
  default: { sanitize: (str: string) => str }
}))

// react-i18next is mocked globally in setup.ts

// Mock des hooks (chemins relatifs depuis __tests__)
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'testuser', role: 'admin' } })
}))

vi.mock('../../hooks/usePharmacySettings', () => ({
  usePharmacySettings: () => ({ settings: { theme: 'light' } })
}))

vi.mock('../../hooks/useProduits', () => ({
  useProduits: () => ({ data: { results: [] }, isLoading: false }),
  useProduit: () => ({ data: null, isLoading: false }),
  useRayons: () => ({ data: [] }),
  useFournisseurs: () => ({ data: [] }),
  useFormes: () => ({ data: [] }),
  useGroupes: () => ({ data: [] }),
  useProducts: () => ({ data: { results: [] } }),
  useProduitAchats: () => ({ data: [], isLoading: false }),
  useProduitLots: () => ({ data: [], isLoading: false }),
  useProduitAdjustments: () => ({ data: [], isLoading: false }),
  useProduitStats: () => ({ data: [], isLoading: false }),
  useProduitHistory: () => ({ data: [], isLoading: false }),
  useUpdateProduit: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateProduit: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteProduit: () => ({ mutate: vi.fn(), isPending: false }),
  useAdjustStock: () => ({ mutate: vi.fn(), isPending: false }),
  useRecalculateRotation: () => ({ mutate: vi.fn(), isPending: false }),
  useImportCsv: () => ({ mutate: vi.fn(), isPending: false }),
  useBulkDelete: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => ({ confirm: vi.fn(), confirmWithInput: vi.fn(), alert: vi.fn() })
}))

// Mock des hooks de données
const mockCommandes = [
  { id: 1, numero_facture: 'CMD-001', fournisseur_name: 'Fournisseur A', date_commande: '2025-01-01', status: 'BROU', total_amount: 50000 },
  { id: 2, numero_facture: 'CMD-002', fournisseur_name: 'Fournisseur B', date_commande: '2025-01-02', status: 'VAL', total_amount: 75000 }
]

vi.mock('../../hooks/useCommandes', () => ({
  useCommandes: () => ({
    data: { results: mockCommandes, count: 2 },
    isLoading: false,
    error: null,
    refetch: vi.fn()
  }),
  useCommandeFournisseurs: () => ({ data: [] }),
  useCommandeRayons: () => ({ data: [] })
}))

vi.mock('../../hooks/useProductSearch', () => ({
  useProductSearch: () => ({
    produits: [],
    searchQuery: '',
    setSearchQuery: vi.fn()
  })
}))

// Mock Child Components
vi.mock('../SimplePrintLabelsModal', () => ({ default: () => <div data-testid="print-labels-modal" /> }))
vi.mock('../SuggestionCommandeModal', () => ({ default: () => <div data-testid="suggestion-modal" /> }))
vi.mock('../ProduitFormModal', () => ({ default: () => <div data-testid="produit-form-modal" /> }))
vi.mock('../PasswordConfirmModal', () => ({ default: () => <div data-testid="password-modal" /> }))
vi.mock('../Commandes/TransferCommandeModal', () => ({ default: () => <div data-testid="transfer-modal" /> }))
vi.mock('../Commandes/MergeCommandesModal', () => ({ default: () => <div data-testid="merge-modal" /> }))

vi.mock('../Commandes/CommandeList', () => ({
  default: ({ onOpenCreateView }: { onOpenCreateView: (type: string) => void }) => (
    <div>
      <div>Liste Mockée</div>
      <button onClick={() => onOpenCreateView('LOC')}>Nouvelle Commande</button>
      <button data-testid="cloturer-btn">Clôturer</button>
    </div>
  )
}))
vi.mock('../Commandes/CommandeForm', () => ({ default: () => <div data-testid="commande-form" /> }))
vi.mock('../Commandes/CommandeDetails', () => ({
  default: ({ onCloture }: { onCloture?: () => void }) => (
    <div>
      <div data-testid="commande-details">Details Mock</div>
      {onCloture && <button onClick={onCloture} data-testid="cloturer-details-btn">Clôturer</button>}
    </div>
  )
}))

vi.mock('../../hooks/useCommandeActions', () => ({
  useCommandeActions: () => ({
    handleSaveCommande: vi.fn(),
    handleDeleteCommande: vi.fn(),
    handleCloturerCommande: mockHandleCloturerCommande,
    handleMettreEnAttente: vi.fn(),
    handleAnnulerReception: vi.fn(),
    handleImprimerReception: vi.fn(),
    handleBulkDelete: vi.fn(),
    executingAction: false,
    isPasswordModalOpen: false,
    setIsPasswordModalOpen: vi.fn(),
    passwordModalConfig: {},
    handlePasswordConfirmed: vi.fn(),
    reconditionnement: {
      modal: { open: false, commandeId: 0, commandeNumero: '', transformations: [] },
      setModal: vi.fn(),
      onDone: vi.fn(),
    },
  })
}))

// Mock useCommandeHandlers to wire onCloture directly to handleCloturerCommande
vi.mock('../../hooks/commandes/useCommandeHandlers', () => ({
  useCommandeHandlers: () => ({
    onCloture: mockHandleCloturerCommande,
    onDelete: vi.fn(),
    onMettreEnAttente: vi.fn(),
    onAnnulerReception: vi.fn(),
    onImprimer: vi.fn(),
    onBulkDelete: vi.fn(),
    handleCreateAvoirFromCommande: vi.fn(),
  })
}))

vi.mock('../../hooks/useKeyboardNavigation', () => ({
  useKeyboardNavigation: () => ({
    searchInputRef: { current: null },
    fournisseurSelectRef: { current: null }
  })
}))

vi.mock('../../hooks/useSearchNavigation', () => ({
  useSearchNavigation: () => ({
    handleKeyDown: vi.fn(),
    getItemProps: () => ({})
  })
}))

const renderWithContext = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                {ui}
            </MemoryRouter>
        </QueryClientProvider>
    );
};

describe('Commandes Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store to default LIST view
    useCommandesStore.setState({
      viewMode: 'LIST',
      selectedCommande: null,
      activeTab: 'LOC',
      commandeType: 'LOC',
    })
  })

  it('renders correctly and displays command list', () => {
    renderWithContext(<Commandes />)

    // Vérifier que le titre est affiché
    expect(screen.getByText(/Gestion des Commandes/i)).toBeInTheDocument()

    // Vérifier que la liste mockée est affichée
    expect(screen.getByText('Liste Mockée')).toBeInTheDocument()
  })
  
  it('shows "Nouvelle Commande" button', () => {
    renderWithContext(<Commandes />)
    
    const newBtn = screen.getByRole('button', { name: /Nouvelle Commande/i })
    expect(newBtn).toBeInTheDocument()
  })

  it('displays "Clôturer" button in the mocked command list', () => {
    renderWithContext(<Commandes />)

    const cloturerBtn = screen.getByTestId('cloturer-btn')
    expect(cloturerBtn).toBeInTheDocument()
    expect(cloturerBtn.textContent).toMatch(/Clôturer/i)
  })

  it('calls handleCloturerCommande when "Clôturer" is clicked in details view (PREP to CLOT transition)', () => {
    // Set store to DETAILS view with a PREP commande
    useCommandesStore.setState({
      viewMode: 'DETAILS',
      selectedCommande: {
        id: 1,
        numero_facture: 'CMD-001',
        fournisseur: 1,
        date: '2025-01-01',
        status: 'PREP',
        produits: [],
      } as never,
    })

    renderWithContext(<Commandes />)

    // Verify CommandeDetails mock is rendered
    expect(screen.getByTestId('commande-details')).toBeInTheDocument()

    // Click the "Clôturer" button in the details view
    const cloturerBtn = screen.getByTestId('cloturer-details-btn')
    fireEvent.click(cloturerBtn)

    // Verify handleCloturerCommande was called
    expect(mockHandleCloturerCommande).toHaveBeenCalledTimes(1)
  })

  it('does not render the reconditionnement modal by default (modal.open = false)', () => {
    renderWithContext(<Commandes />)

    // The reconditionnement modal should not be rendered when modal.open is false
    // The modal title contains "Reconditionnement" — verify it is absent
    expect(screen.queryByText(/Reconditionnement/i)).not.toBeInTheDocument()
  })

  it('renders CommandeForm when viewMode is EDIT', () => {
    // Set store to EDIT view
    useCommandesStore.setState({
      viewMode: 'EDIT',
      selectedCommande: {
        id: 1,
        numero_facture: 'CMD-001',
        fournisseur: 1,
        date: '2025-01-01',
        status: 'PREP',
        produits: [],
      } as never,
    })

    renderWithContext(<Commandes />)

    // CommandeForm mock renders with data-testid="commande-form"
    expect(screen.getByTestId('commande-form')).toBeInTheDocument()
  })
})
