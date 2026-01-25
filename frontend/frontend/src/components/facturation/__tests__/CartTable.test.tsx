import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CartTable from '../CartTable'
import type { LigneFacture } from '../../../types'

// Mock des fonctions props
const mockUpdateQuantite = vi.fn()
const mockUpdatePrix = vi.fn()
const mockUpdateRemiseProduit = vi.fn()
const mockRemoveLigne = vi.fn()
const mockOnOpenLotModal = vi.fn()
const mockOnReturnFocus = vi.fn()

const createMockRef = () => {
  const map = new Map<number, HTMLInputElement>()
  return { current: map }
}

const mockLigneFacture: LigneFacture = {
  produit: {
    id: 1,
    name: 'Doliprane 1000mg',
    description: 'Paracetamol',
    stock: 100,
    cost_price: '500',
    selling_price: '750',
    stock_alert: 10,
    stock_minimum: 5,
    stock_maximum: 200,
    rayon_name: 'Antalgiques',
    fournisseur_name: 'Sanofi',
    expire_date: '2025-12-31',
    is_deleted: false
  },
  quantite: 2,
  prix_unitaire: '750',
  remise_produit: '0',
  total_ligne: 1500
}

const mockLigneFactureWithLot: LigneFacture = {
  ...mockLigneFacture,
  produit: { ...mockLigneFacture.produit, id: 2, name: 'Aspirine 500mg' },
  lotId: 'LOT-001',
  lotText: 'LOT-001',
  lotExpiration: '2025-06-15'
}

const defaultProps = {
  lignesFacture: [] as LigneFacture[],
  updateQuantite: mockUpdateQuantite,
  updatePrix: mockUpdatePrix,
  updateRemiseProduit: mockUpdateRemiseProduit,
  removeLigne: mockRemoveLigne,
  onOpenLotModal: mockOnOpenLotModal,
  quantityInputsRef: createMockRef(),
  onReturnFocus: mockOnReturnFocus
}

describe('CartTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche le message vide quand il n\'y a pas de produits', () => {
    render(<CartTable {...defaultProps} />)
    
    expect(screen.getByText(/Commencez par ajouter des produits \(F2\)/i)).toBeInTheDocument()
  })

  it('affiche les produits dans le tableau', () => {
    render(<CartTable {...defaultProps} lignesFacture={[mockLigneFacture]} />)
    
    // Vérifier le nom du produit
    expect(screen.getByText('Doliprane 1000mg')).toBeInTheDocument()
    
    // Vérifier que le total est affiché
    expect(screen.getByText('1500')).toBeInTheDocument()
    
    // Vérifier les en-têtes du tableau
    expect(screen.getByText('Produit')).toBeInTheDocument()
    expect(screen.getByText('Qté')).toBeInTheDocument()
    expect(screen.getByText('Prix')).toBeInTheDocument()
  })

  it('affiche plusieurs lignes de produits', () => {
    render(<CartTable {...defaultProps} lignesFacture={[mockLigneFacture, mockLigneFactureWithLot]} />)
    
    expect(screen.getByText('Doliprane 1000mg')).toBeInTheDocument()
    expect(screen.getByText('Aspirine 500mg')).toBeInTheDocument()
  })

  it('appelle updateQuantite lors du changement de quantité', () => {
    render(<CartTable {...defaultProps} lignesFacture={[mockLigneFacture]} />)
    
    const quantiteInputs = screen.getAllByDisplayValue('2')
    fireEvent.change(quantiteInputs[0], { target: { value: '5' } })
    
    expect(mockUpdateQuantite).toHaveBeenCalledWith(1, 5)
  })

  it('appelle updatePrix lors du changement de prix', () => {
    render(<CartTable {...defaultProps} lignesFacture={[mockLigneFacture]} />)
    
    const prixInputs = screen.getAllByDisplayValue('750')
    fireEvent.change(prixInputs[0], { target: { value: '800' } })
    
    expect(mockUpdatePrix).toHaveBeenCalledWith(1, '800')
  })

  it('appelle updateRemiseProduit lors du changement de remise', () => {
    render(<CartTable {...defaultProps} lignesFacture={[mockLigneFacture]} />)
    
    const remiseInputs = screen.getAllByDisplayValue('0')
    fireEvent.change(remiseInputs[0], { target: { value: '10' } })
    
    expect(mockUpdateRemiseProduit).toHaveBeenCalledWith(1, '10')
  })

  it('appelle onReturnFocus quand Enter est pressé dans le champ quantité', () => {
    render(<CartTable {...defaultProps} lignesFacture={[mockLigneFacture]} />)
    
    const quantiteInputs = screen.getAllByDisplayValue('2')
    fireEvent.keyDown(quantiteInputs[0], { key: 'Enter' })
    
    expect(mockOnReturnFocus).toHaveBeenCalled()
  })

  it('affiche le bouton lot avec le texte approprié', () => {
    render(<CartTable {...defaultProps} lignesFacture={[mockLigneFacture]} />)
    
    // Pour un produit sans lot spécifique, affiche "Auto"
    expect(screen.getByText('Auto')).toBeInTheDocument()
  })

  it('affiche le numéro de lot quand un lot est sélectionné', () => {
    render(<CartTable {...defaultProps} lignesFacture={[mockLigneFactureWithLot]} />)
    
    expect(screen.getByText('LOT-001')).toBeInTheDocument()
  })

  it('appelle onOpenLotModal au clic sur le bouton lot', () => {
    render(<CartTable {...defaultProps} lignesFacture={[mockLigneFacture]} />)
    
    const lotButton = screen.getByText('Auto')
    fireEvent.click(lotButton)
    
    expect(mockOnOpenLotModal).toHaveBeenCalledWith(mockLigneFacture.produit, null)
  })

  it('affiche le marqueur supprimé pour les produits supprimés', () => {
    const ligneAvecProduitSupprime: LigneFacture = {
      ...mockLigneFacture,
      produit: { ...mockLigneFacture.produit, is_deleted: true }
    }
    
    render(<CartTable {...defaultProps} lignesFacture={[ligneAvecProduitSupprime]} />)
    
    expect(screen.getByText('(Supprimé)')).toBeInTheDocument()
  })

  it('formate correctement la date de péremption', () => {
    // Date saine > 90 jours
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 100)
    const futureDateStr = futureDate.toISOString().split('T')[0]
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const ligneSafe = { ...mockLigneFacture, produit: { ...mockLigneFacture.produit, expire_date: futureDateStr } }
    
    // On garde le test original simple
    render(<CartTable {...defaultProps} lignesFacture={[mockLigneFacture]} />)
    expect(screen.getByText('12/25')).toBeInTheDocument()
  })

  it('affiche l\'alerte de péremption proche (warning)', () => {
    const nearDate = new Date()
    nearDate.setDate(nearDate.getDate() + 10) // Dans 10 jours
    const nearDateStr = nearDate.toISOString().split('T')[0]
    
    const ligneWarning = { 
        ...mockLigneFacture, 
        produit: { ...mockLigneFacture.produit, id: 99, expire_date: nearDateStr } 
    }
    
    render(<CartTable {...defaultProps} lignesFacture={[ligneWarning]} />)
    
    // Chercher l'icone sablier
    expect(screen.getByTitle('Bientôt périmé')).toBeInTheDocument()
  })

  it('affiche l\'alerte de produit périmé (critical)', () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 10) // Il y a 10 jours
    const pastDateStr = pastDate.toISOString().split('T')[0]
    
    const ligneExpired = { 
        ...mockLigneFacture, 
        produit: { ...mockLigneFacture.produit, id: 100, expire_date: pastDateStr } 
    }
    
    render(<CartTable {...defaultProps} lignesFacture={[ligneExpired]} />)
    
    // Chercher l'icone warning
    expect(screen.getByTitle('Périmé')).toBeInTheDocument()
  })
})
