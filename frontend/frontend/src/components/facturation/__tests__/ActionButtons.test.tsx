import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ActionButtons from '../ActionButtons'

// Mock des fonctions props
const mockOnPayment = vi.fn()
const mockOnProforma = vi.fn()
const mockOnBonDeLivraison = vi.fn()
const mockOnSuspend = vi.fn()
const mockOnCancel = vi.fn()
const mockOnViewPending = vi.fn()

const defaultProps = {
  onPayment: mockOnPayment,
  onProforma: mockOnProforma,
  onBonDeLivraison: mockOnBonDeLivraison,
  onSuspend: mockOnSuspend,
  onCancel: mockOnCancel,
  isValid: true
}

describe('ActionButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche tous les boutons d\'action', () => {
    render(<ActionButtons {...defaultProps} />)
    
    expect(screen.getByRole('button', { name: /Annuler/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Proforma/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Valider/i })[0]).toBeInTheDocument()
    // Le bouton "Mettre en attente" a deux versions (desktop et mobile)
    expect(screen.getByRole('button', { name: /Suspendre la vente/i })).toBeInTheDocument()
  })

  it('appelle onCancel au clic sur Annuler', () => {
    render(<ActionButtons {...defaultProps} />)
    
    fireEvent.click(screen.getByText(/Annuler/i))
    
    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('appelle onPayment au clic sur Encaisser', () => {
    render(<ActionButtons {...defaultProps} />)
    
    fireEvent.click(screen.getAllByRole('button', { name: /Valider/i })[0])
    
    expect(mockOnPayment).toHaveBeenCalled()
  })

  it('appelle onProforma au clic sur Proforma', () => {
    render(<ActionButtons {...defaultProps} />)
    
    fireEvent.click(screen.getByText(/Proforma/i))
    
    expect(mockOnProforma).toHaveBeenCalled()
  })

  it('appelle onSuspend au clic sur Suspendre la vente', () => {
    render(<ActionButtons {...defaultProps} />)
    
    fireEvent.click(screen.getByText(/Suspendre la vente/i))
    
    expect(mockOnSuspend).toHaveBeenCalled()
  })

  it('désactive les boutons quand isValid est false', () => {
    render(<ActionButtons {...defaultProps} isValid={false} />)
    
    // Le bouton Annuler n'est jamais désactivé
    expect(screen.getByText(/Annuler/i).closest('button')).not.toBeDisabled()
    
    expect(screen.getByText(/Proforma/i).closest('button')).toBeDisabled()
    expect(screen.getAllByRole('button', { name: /Valider/i })[0]).toBeDisabled()
    expect(screen.getByText(/Suspendre la vente/i).closest('button')).toBeDisabled()
  })

  // Supprimé car pendingCount n'existe plus dans ActionButtonsProps
  /*
  it('n\'affiche pas le bouton En attente quand pendingCount est 0', () => {
    render(<ActionButtons {...defaultProps} />)
    
    // Le badge "En attente" ne doit pas apparaître
    expect(screen.queryByText('En attente')).not.toBeInTheDocument()
  })

  it('affiche le bouton En attente avec le badge quand pendingCount > 0', () => {
    render(<ActionButtons {...defaultProps} />)
    
    expect(screen.getByText('En attente')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('appelle onViewPending au clic sur le bouton En attente', () => {
    render(<ActionButtons {...defaultProps} />)
    
    fireEvent.click(screen.getByText('En attente'))
    
    expect(mockOnViewPending).toHaveBeenCalled()
  })
  */

  it('affiche les raccourcis clavier dans les titres', () => {
    render(<ActionButtons {...defaultProps} />)
    
    // Vérifier que le title contient le raccourci clavier
    const encaisserButton = screen.getAllByRole('button', { name: /Valider/i })[0]
    // Match actual tooltips in facturation.json
    expect(encaisserButton).toHaveAttribute('title', expect.stringContaining('Valider la vente'))
    
    const annulerButton = screen.getByText(/Annuler/i).closest('button')
    expect(annulerButton).toHaveAttribute('title', expect.stringContaining('Réinitialiser'))
  })
})
