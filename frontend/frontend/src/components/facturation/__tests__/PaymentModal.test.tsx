import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PaymentModal from '../PaymentModal'
import { MemoryRouter } from 'react-router-dom'

// Mock des fonctions props
const mockOnClose = vi.fn()
const mockOnCompleteSale = vi.fn()
const mockOnRegisterPayment = vi.fn()
const mockSetMontantPaye = vi.fn()
const mockSetPaiements = vi.fn()
const mockSetModePaiement = vi.fn()

const defaultProps = {
  isOpen: true,
  onClose: mockOnClose,
  loading: false,
  facturePourPaiement: null,
  isNewSale: true,
  totals: {
    totalTtc: 5000,
    tauxCouverture: 0,
    partPatient: 5000,
    partAssurance: 0,
    couponMontant: 0,
    loyaltyDeduction: 0
  },
  montantPaye: '5000',
  setMontantPaye: mockSetMontantPaye,
  modePaiement: 'especes',
  setModePaiement: mockSetModePaiement,
  paiements: [],
  setPaiements: mockSetPaiements,
  onCompleteSale: mockOnCompleteSale,
  onRegisterPayment: mockOnRegisterPayment,
  selectedClient: null,
  useManualClient: false,
  paymentInputRef: { current: null }
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

describe('PaymentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("ne s'affiche pas quand isOpen est false", () => {
    renderWithContext(<PaymentModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByRole('heading', { level: 3, name: /Paiement/i })).not.toBeInTheDocument()
  })

  it("s'affiche quand isOpen est true", () => {
    renderWithContext(<PaymentModal {...defaultProps} />)
    expect(screen.getByRole('heading', { level: 3, name: /Paiement/i })).toBeInTheDocument()
  })

  it('affiche le total à payer pour une nouvelle vente', () => {
    renderWithContext(<PaymentModal {...defaultProps} />)
    // Check le label 'Reste à payer' et le montant (le 1er occurrence dans le header de résumé)
    expect(screen.getByText(/Reste à payer/i)).toBeInTheDocument()
    // Utiliser getAllByText et prendre le premier ou être plus spécifique
    const amounts = screen.getAllByText(/5\s?000\s?F/)
    expect(amounts.length).toBeGreaterThan(0)
  })

  it('affiche le montant du coupon quand applicable', () => {
    const props = {
        ...defaultProps,
        totals: { ...defaultProps.totals, couponMontant: 500 }
    }
    renderWithContext(<PaymentModal {...props} />)
    // On cherche spécifiquement le texte "500 F" qui doit être présent dans le détail du coupon
    expect(screen.getByText(/Coupon/i)).toBeInTheDocument()
    const couponAmounts = screen.getAllByText(/500\s?F/)
    expect(couponAmounts.length).toBeGreaterThan(0)
  })

  it('affiche l\'info Tiers Payant quand tauxCouverture > 0', () => {
    const props = {
        ...defaultProps,
        totals: { ...defaultProps.totals, tauxCouverture: 70, partAssurance: 3500, partPatient: 1500 }
    }
    renderWithContext(<PaymentModal {...props} />)
    expect(screen.getByText(/Tiers Payant 70%/i)).toBeInTheDocument()
  })

  it('affiche les parts Patient et Assurance en mode Tiers Payant', () => {
    const props = {
        ...defaultProps,
        totals: { ...defaultProps.totals, tauxCouverture: 70, partPatient: 1500, partAssurance: 3500 }
    }
    renderWithContext(<PaymentModal {...props} />)
    expect(screen.getAllByText(/1\s?500\s?F/)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/3\s?500\s?F/)[0]).toBeInTheDocument()
  })

  it('appelle onCompleteSale à la soumission pour une nouvelle vente', async () => {
    renderWithContext(<PaymentModal {...defaultProps} />)
    const submitButton = screen.getByRole('button', { name: /Valider|Vendre/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
        expect(mockOnCompleteSale).toHaveBeenCalled()
    })
  })

  it('appelle onRegisterPayment à la soumission pour une facture existante', async () => {
    const props = {
        ...defaultProps,
        isNewSale: false,
        facturePourPaiement: { id: 1, total_ttc: 5000 } as any
    }
    renderWithContext(<PaymentModal {...props} />)
    const submitButton = screen.getByRole('button', { name: /Enregistrer|Payer/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
        expect(mockOnRegisterPayment).toHaveBeenCalled()
    })
  })

  it('affiche le total versé', () => {
    const paiementsMock = [{ mode: 'especes', montant: 5000 }]
    renderWithContext(<PaymentModal {...defaultProps} paiements={paiementsMock} />)
    expect(screen.getByText(/5\s?000\s?F\s?\/\s?5\s?000\s?F/)).toBeInTheDocument()
  })

  it('appelle setMontantPaye lors de la saisie du montant', () => {
    renderWithContext(<PaymentModal {...defaultProps} />)
    // On cherche par placeholder qui est plus fiable dans ce cas que le label mal associé
    const input = screen.getByPlaceholderText(/Montant/i)
    fireEvent.change(input, { target: { value: '4000' } })
    expect(mockSetMontantPaye).toHaveBeenCalledWith('4000')
  })

  it('ajoute un paiement au clic sur le bouton Ajouter', () => {
    renderWithContext(<PaymentModal {...defaultProps} />)
    // Le bouton utilise le symbole ＋ ou le texte 'Ajouter' selon i18n
    const addButton = screen.getByRole('button', { name: /Ajouter|＋/i })
    fireEvent.click(addButton)
    expect(mockSetPaiements).toHaveBeenCalled()
  })
})
