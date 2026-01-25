import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ActionButtons from '../ActionButtons'

// Mock des fonctions props
const mockOnPayment = vi.fn()
const mockOnProforma = vi.fn()
const mockOnSuspend = vi.fn()
const mockOnCancel = vi.fn()
const mockOnViewPending = vi.fn()

const defaultProps = {
  onPayment: mockOnPayment,
  onProforma: mockOnProforma,
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
    
    expect(screen.getByText('Annuler')).toBeInTheDocument()
    expect(screen.getByText('Proforma')).toBeInTheDocument()
    expect(screen.getByText(/Encaisser/i)).toBeInTheDocument()
    // Le bouton "Mettre en attente" a deux versions (desktop et mobile)
    expect(screen.getByText(/Mettre en attente/i)).toBeInTheDocument()
  })

  it('appelle onCancel au clic sur Annuler', () => {
    render(<ActionButtons {...defaultProps} />)
    
    fireEvent.click(screen.getByText('Annuler'))
    
    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('appelle onPayment au clic sur Encaisser', () => {
    render(<ActionButtons {...defaultProps} />)
    
    fireEvent.click(screen.getByText(/Encaisser/i))
    
    expect(mockOnPayment).toHaveBeenCalled()
  })

  it('appelle onProforma au clic sur Proforma', () => {
    render(<ActionButtons {...defaultProps} />)
    
    fireEvent.click(screen.getByText('Proforma'))
    
    expect(mockOnProforma).toHaveBeenCalled()
  })

  it('appelle onSuspend au clic sur Mettre en attente', () => {
    render(<ActionButtons {...defaultProps} />)
    
    fireEvent.click(screen.getByText(/Mettre en attente/i))
    
    expect(mockOnSuspend).toHaveBeenCalled()
  })

  it('désactive les boutons quand isValid est false', () => {
    render(<ActionButtons {...defaultProps} isValid={false} />)
    
    // Le bouton Annuler n'est jamais désactivé
    expect(screen.getByText('Annuler').closest('button')).not.toBeDisabled()
    
    // Les autres boutons doivent être désactivés
    expect(screen.getByText('Proforma').closest('button')).toBeDisabled()
    expect(screen.getByText(/Encaisser/i).closest('button')).toBeDisabled()
    expect(screen.getByText(/Mettre en attente/i).closest('button')).toBeDisabled()
  })

  it('n\'affiche pas le bouton En attente quand pendingCount est 0', () => {
    render(<ActionButtons {...defaultProps} pendingCount={0} onViewPending={mockOnViewPending} />)
    
    // Le badge "En attente" ne doit pas apparaître
    expect(screen.queryByText('En attente')).not.toBeInTheDocument()
  })

  it('affiche le bouton En attente avec le badge quand pendingCount > 0', () => {
    render(<ActionButtons {...defaultProps} pendingCount={3} onViewPending={mockOnViewPending} />)
    
    expect(screen.getByText('En attente')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('appelle onViewPending au clic sur le bouton En attente', () => {
    render(<ActionButtons {...defaultProps} pendingCount={2} onViewPending={mockOnViewPending} />)
    
    fireEvent.click(screen.getByText('En attente'))
    
    expect(mockOnViewPending).toHaveBeenCalled()
  })

  it('affiche les raccourcis clavier dans les titres', () => {
    render(<ActionButtons {...defaultProps} />)
    
    // Vérifier que le title contient le raccourci clavier
    const encaisserButton = screen.getByText(/Encaisser/i).closest('button')
    expect(encaisserButton).toHaveAttribute('title', 'Valider et encaisser (F1)')
    
    const annulerButton = screen.getByText('Annuler').closest('button')
    expect(annulerButton).toHaveAttribute('title', 'Réinitialiser la facture (Esc)')
  })
})
