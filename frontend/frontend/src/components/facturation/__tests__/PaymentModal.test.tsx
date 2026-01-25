import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PaymentModal from '../PaymentModal'

// Mock des fonctions props
const mockOnClose = vi.fn()
const mockSetMontantPaye = vi.fn()
const mockSetModePaiement = vi.fn()
const mockSetPaiements = vi.fn()
const mockOnCompleteSale = vi.fn()
const mockOnRegisterPayment = vi.fn()

const createMockRef = () => ({ current: null })

const defaultTotals = {
  totalTtc: 10000,
  tauxCouverture: 0,
  partPatient: 10000,
  partAssurance: 0
}

const tierPayantTotals = {
  totalTtc: 10000,
  tauxCouverture: 70,
  partPatient: 3000,
  partAssurance: 7000
}

const totalsWithCoupon = {
  ...defaultTotals,
  couponMontant: 500
}

const defaultProps = {
  isOpen: true,
  onClose: mockOnClose,
  loading: false,
  facturePourPaiement: null,
  isNewSale: true,
  totals: defaultTotals,
  montantPaye: '',
  setMontantPaye: mockSetMontantPaye,
  modePaiement: 'especes',
  setModePaiement: mockSetModePaiement,
  paiements: [],
  setPaiements: mockSetPaiements,
  onCompleteSale: mockOnCompleteSale,
  onRegisterPayment: mockOnRegisterPayment,
  selectedClient: null,
  useManualClient: false,
  paymentInputRef: createMockRef()
}

describe('PaymentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ne s\'affiche pas quand isOpen est false', () => {
    render(<PaymentModal {...defaultProps} isOpen={false} />)
    
    // Le dialog existe mais n'a pas la classe modal-open
    const dialog = document.querySelector('dialog')
    expect(dialog).not.toHaveClass('modal-open')
  })

  it('s\'affiche quand isOpen est true', () => {
    render(<PaymentModal {...defaultProps} />)
    
    const dialog = document.querySelector('dialog')
    expect(dialog).toHaveClass('modal-open')
    expect(screen.getByText('Paiement')).toBeInTheDocument()
  })

  it('affiche le total à payer pour une nouvelle vente', () => {
    render(<PaymentModal {...defaultProps} />)
    
    expect(screen.getByText('Total à payer')).toBeInTheDocument()
    // Peut apparaître plusieurs fois
    expect(screen.getAllByText(/10\s?000\s?F/).length).toBeGreaterThanOrEqual(1)
  })

  it('affiche le montant du coupon quand applicable', () => {
    render(<PaymentModal {...defaultProps} totals={totalsWithCoupon} />)
    
    expect(screen.getByText(/Dont coupon : -500 F/)).toBeInTheDocument()
  })

  it('affiche l\'info Tiers Payant quand tauxCouverture > 0', () => {
    render(<PaymentModal {...defaultProps} totals={tierPayantTotals} />)
    
    expect(screen.getByText(/Tiers Payant 70% actif/)).toBeInTheDocument()
    expect(screen.getByText('Reste à charge (Part Patient)')).toBeInTheDocument()
    expect(screen.getAllByText(/3\s?000\s?F/).length).toBeGreaterThanOrEqual(1)
  })

  it('affiche les parts Patient et Assurance en mode Tiers Payant', () => {
    render(<PaymentModal {...defaultProps} totals={tierPayantTotals} />)
    
    expect(screen.getByText('Part Patient (30%)')).toBeInTheDocument()
    expect(screen.getByText('Part Assurance (70%)')).toBeInTheDocument()
    expect(screen.getAllByText(/7\s?000\s?F/).length).toBeGreaterThanOrEqual(1)
  })

  it('appelle onClose au clic sur le bouton fermer', () => {
    render(<PaymentModal {...defaultProps} />)
    
    fireEvent.click(screen.getByText('✕'))
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('appelle onClose au clic sur Annuler', () => {
    render(<PaymentModal {...defaultProps} />)
    
    fireEvent.click(screen.getByText('Annuler (Esc)'))
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('appelle onCompleteSale à la soumission pour une nouvelle vente', () => {
    render(<PaymentModal {...defaultProps} />)
    
    fireEvent.click(screen.getByText('Caisse Centrale'))
    
    expect(mockOnCompleteSale).toHaveBeenCalled()
  })

  it('appelle onRegisterPayment à la soumission pour une facture existante', () => {
    const mockFacture = {
      id: 1,
      numero_facture: 'FAC-001',
      client: 1,
      date: '2025-01-25',
      status: 'VAL',
      status_display: 'Validée',
      remise: '0',
      tva: '0',
      total_ht: '10000',
      total_tva: '0',
      total_ttc: '10000',
      produits: []
    }
    
    render(<PaymentModal {...defaultProps} isNewSale={false} facturePourPaiement={mockFacture} />)
    
    fireEvent.click(screen.getByText('Caisse Centrale'))
    
    expect(mockOnRegisterPayment).toHaveBeenCalled()
  })

  it('désactive le bouton de soumission quand loading est true', () => {
    const { container } = render(<PaymentModal {...defaultProps} loading={true} />)
    
    const submitButton = container.querySelector('button[type="submit"]')
    expect(submitButton).toBeDisabled()
  })

  it('affiche le total versé', () => {
    render(<PaymentModal {...defaultProps} />)
    
    expect(screen.getByText('Total versé:')).toBeInTheDocument()
  })

  it('affiche les paiements ajoutés comme Espèces', () => {
    render(<PaymentModal {...defaultProps} paiements={[{ mode: 'especes', montant: 5000 }]} />)
    
    expect(screen.getAllByText('Espèces').length).toBeGreaterThanOrEqual(1)
    // Le montant peut apparaître dans la liste et dans le total
    expect(screen.getAllByText(/5000\s?F/).length).toBeGreaterThanOrEqual(1)
  })

  it.skip('affiche la monnaie à rendre quand versé > total (via montantPaye)', () => {
    // Cas où on n'a pas encore validé le paiement dans la liste, mais on a saisi un montant
    render(<PaymentModal {...defaultProps} montantPaye="12000" paiements={[]} />)
    
    // 1. Le titre
    expect(screen.getByText('Paiement')).toBeInTheDocument()
    
    // 2. Le total versé devrait être le montant saisi
    expect(screen.getByText('Total versé:')).toBeInTheDocument()
    const amounts = screen.getAllByText(/12\s?000\s?F/)
    expect(amounts.length).toBeGreaterThanOrEqual(1)

    // 3. La monnaie à rendre
    expect(screen.getByText('Monnaie à rendre')).toBeInTheDocument()
    expect(screen.getByText(/2000\s?F/)).toBeInTheDocument()
  })

  it('appelle setMontantPaye lors de la saisie du montant', () => {
    render(<PaymentModal {...defaultProps} />)
    
    const input = screen.getByPlaceholderText('Saisir montant...')
    fireEvent.change(input, { target: { value: '5000' } })
    
    expect(mockSetMontantPaye).toHaveBeenCalledWith('5000')
  })

  it('ajoute un paiement au clic sur le bouton Ajouter', () => {
    render(<PaymentModal {...defaultProps} montantPaye="5000" />)
    
    fireEvent.click(screen.getByText('Ajouter'))
    
    expect(mockSetPaiements).toHaveBeenCalled()
  })

  it('permet de supprimer un paiement ajouté', () => {
    render(<PaymentModal {...defaultProps} paiements={[{ mode: 'especes', montant: 5000 }]} />)
    
    // Trouver le bouton de suppression (✕) dans la liste des paiements
    const deleteButtons = screen.getAllByText('✕')
    fireEvent.click(deleteButtons[1]) // Le premier est le bouton fermer du modal
    
    expect(mockSetPaiements).toHaveBeenCalledWith([])
  })
})
