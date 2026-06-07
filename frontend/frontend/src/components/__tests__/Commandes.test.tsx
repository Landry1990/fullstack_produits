import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Commandes from '../Commandes'

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
  default: ({ onOpenCreateView }: any) => (
    <div>
      <div>Liste Mockée</div>
      <button onClick={() => onOpenCreateView('LOC')}>Nouvelle Commande</button>
    </div>
  )
}))
vi.mock('../Commandes/CommandeForm', () => ({ default: () => <div data-testid="commande-form" /> }))

vi.mock('../../hooks/useCommandeActions', () => ({
  useCommandeActions: () => ({
    handleSaveCommande: vi.fn(),
    handleDeleteCommande: vi.fn(),
    handleCloturerCommande: vi.fn(),
    handleMettreEnAttente: vi.fn(),
    handleAnnulerReception: vi.fn(),
    handleImprimerReception: vi.fn(),
    isPasswordModalOpen: false,
    setIsPasswordModalOpen: vi.fn(),
    passwordModalConfig: {},
    handlePasswordConfirmed: vi.fn()
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

describe('Commandes Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correctly and displays command list', () => {
    render(
      <MemoryRouter>
        <Commandes />
      </MemoryRouter>
    )

    // Vérifier que le titre est affiché
    expect(screen.getByText(/Gestion des Commandes/i)).toBeInTheDocument()

    // Vérifier que la liste mockée est affichée
    expect(screen.getByText('Liste Mockée')).toBeInTheDocument()
  })
  
  it('shows "Nouvelle Commande" button', () => {
    render(
      <MemoryRouter>
        <Commandes />
      </MemoryRouter>
    )
    
    const newBtn = screen.getByRole('button', { name: /Nouvelle Commande/i })
    expect(newBtn).toBeInTheDocument()
  })
})
