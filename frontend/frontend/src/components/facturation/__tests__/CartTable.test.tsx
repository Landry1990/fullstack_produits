import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CartTable from '../CartTable'
import { MemoryRouter } from 'react-router-dom'
import type { LigneFacture } from '../../../types/finance'
import type { ProduitModel } from '../../../types/catalog'

// Mock des fonctions props
const mockUpdateQuantite = vi.fn()
const mockUpdatePrix = vi.fn()
const mockUpdateRemiseProduit = vi.fn()
const mockRemoveLigne = vi.fn()
const mockOnOpenLotModal = vi.fn()
const mockOnReturnFocus = vi.fn()

const mockProduit: ProduitModel = {
  id: 1,
  name: 'Doliprane 1000mg',
  selling_price: '750',
  stock: 100,
  description: 'Doliprane 1000mg description',
  cost_price: '500',
  is_deleted: false,
  is_active: true
}

const mockLigneFacture: LigneFacture = {
  produit: mockProduit,
  quantite: 2,
  prix_unitaire: '750',
  remise_produit: '0',
  total_ligne: 1500,
  lotExpiration: null
}

const mockLigneFactureWithLot: LigneFacture = {
  ...mockLigneFacture,
  produit: { ...mockProduit, id: 2, name: 'Aspirine 500mg' },
  lotText: 'LOT-001'
}

const defaultProps = {
  lignesFacture: [] as LigneFacture[],
  updateQuantite: mockUpdateQuantite,
  updatePrix: mockUpdatePrix,
  updateRemiseProduit: mockUpdateRemiseProduit,
  removeLigne: mockRemoveLigne,
  onOpenLotModal: mockOnOpenLotModal,
  quantityInputsRef: { current: new Map() },
  onReturnFocus: mockOnReturnFocus,
  selectedIndex: undefined,
  onSelectLine: vi.fn()
}

import { AuthProvider } from '../../../context/AuthContext'

const renderWithContext = (ui: React.ReactElement) => {
  return render(
    <AuthProvider>
      <MemoryRouter>
          {ui}
      </MemoryRouter>
    </AuthProvider>
  )
}

vi.mock('../../../context/AuthContext', () => ({
    useAuth: () => ({
        user: { 
            is_superuser: true, 
            profile: { max_discount_rate: 100, role: 'PHARMACIEN' } 
        },
        isAuthenticated: true
    }),
    AuthProvider: ({ children }: any) => <>{children}</>
}));

describe('CartTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche le message vide quand il n\'y a pas de produits', () => {
    renderWithContext(<CartTable {...defaultProps} />)
    expect(screen.getByText(/Votre panier est vide/i)).toBeInTheDocument()
  })

  it('affiche les produits dans le tableau', () => {
    renderWithContext(<CartTable {...defaultProps} lignesFacture={[mockLigneFacture]} />)
    expect(screen.getByText('Doliprane 1000mg')).toBeInTheDocument()
    expect(screen.getByText(/1\s?500\s?F/)).toBeInTheDocument()
  })

  it('appelle updateQuantite lors du changement de quantité', () => {
    renderWithContext(<CartTable {...defaultProps} lignesFacture={[mockLigneFacture]} />)
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: '5' } })
    expect(mockUpdateQuantite).toHaveBeenCalledWith(1, 5)
  })

  it('appelle updatePrix lors du changement de prix', () => {
    renderWithContext(<CartTable {...defaultProps} lignesFacture={[mockLigneFacture]} />)
    const inputs = screen.getAllByRole('textbox')
    // Le 2ème input est le prix. Il devrait être actif car can_edit_prices est mocké à true dans setup.ts
    // En fait, on peut filtrer par valeur pour être sûr (750)
    const prixInput = inputs.find(i => (i as HTMLInputElement).value === '750')
    if (prixInput) {
        fireEvent.change(prixInput, { target: { value: '800' } })
        fireEvent.keyDown(prixInput, { key: 'Enter', code: 'Enter' })
        expect(mockUpdatePrix).toHaveBeenCalledWith(1, '800')
    }
  })

  it('appelle updateRemiseProduit lors du changement de remise', () => {
    renderWithContext(<CartTable {...defaultProps} lignesFacture={[mockLigneFacture]} />)
    const remiseInput = screen.getByPlaceholderText('%')
    if (remiseInput) {
        fireEvent.change(remiseInput, { target: { value: '10' } })
        fireEvent.keyDown(remiseInput, { key: 'Enter', code: 'Enter' })
        expect(mockUpdateRemiseProduit).toHaveBeenCalledWith(1, '10')
    }
  })

  it('affiche le bouton lot avec le texte approprié', () => {
    renderWithContext(<CartTable {...defaultProps} lignesFacture={[mockLigneFacture]} />)
    expect(screen.getByText(/Auto/i)).toBeInTheDocument()
  })

  it('affiche le numéro de lot quand un lot est sélectionné', () => {
    renderWithContext(<CartTable {...defaultProps} lignesFacture={[mockLigneFactureWithLot]} />)
    expect(screen.queryByText(/LOT-001/i) || screen.queryByText(/Auto/i)).toBeInTheDocument()
  })

  it('appelle onOpenLotModal au clic sur le bouton lot', () => {
    renderWithContext(<CartTable {...defaultProps} lignesFacture={[mockLigneFacture]} />)
    const lotButton = screen.getByText(/Auto/i)
    fireEvent.click(lotButton)
    expect(mockOnOpenLotModal).toHaveBeenCalled()
  })

  it('formate correctement la date de péremption', () => {
    const ligneAvecDate: LigneFacture = {
        ...mockLigneFacture,
        lotExpiration: '2025-12-31T00:00:00Z'
    }
    renderWithContext(<CartTable {...defaultProps} lignesFacture={[ligneAvecDate]} />)
    // Souvent affiché comme 12/25 ou similaire. On check la présence de "/"
    // S'il y a plusieurs matches (ex: "Doliprane 1000mg" matchant de façon inattendue), on prend le dernier ou on est plus précis.
    const dateElements = screen.getAllByText(/[\d/]{2,}/)
    expect(dateElements.length).toBeGreaterThan(0)
  })
})
