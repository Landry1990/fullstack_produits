import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ReconditionnementModal from '../ReconditionnementModal'
import type { TransformationDisponible } from '../../../services/commandeService'

// Mock the API service
vi.mock('../../../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}))

// Import the mocked api so we can configure it in tests
import api from '../../../services/api'

const mockTransformations: TransformationDisponible[] = [
  {
    relation_id: 1,
    source_id: 10,
    source_name: 'Paracetamol 500mg (boite)',
    source_cip: '123456',
    source_stock: 50,
    qty_recue: 10,
    qty_transformable: 10,
    destination_id: 20,
    destination_name: 'Paracetamol 500mg (plaquette)',
    destination_stock: 5,
    ratio: 2,
    qty_dest_obtained: 20,
  },
  {
    relation_id: 2,
    source_id: 30,
    source_name: 'Amoxicilline 1g (boite)',
    source_cip: '789012',
    source_stock: 30,
    qty_recue: 5,
    qty_transformable: 5,
    destination_id: 40,
    destination_name: 'Amoxicilline 1g (comprime)',
    destination_stock: 10,
    ratio: 1,
    qty_dest_obtained: 5,
  },
]

describe('ReconditionnementModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset api.post to default resolve
    vi.mocked(api.post).mockResolvedValue({ data: { message: 'Transformation reussie' } })
  })

  it('affiche le modal quand open=true', () => {
    render(
      <ReconditionnementModal
        open={true}
        onOpenChange={vi.fn()}
        commandeId={1}
        commandeNumero="CMD-001"
        transformations={mockTransformations}
        onDone={vi.fn()}
      />
    )

    // The modal title should be visible
    expect(screen.getByText(/Reconditionnement automatique/i)).toBeInTheDocument()
    // The subtitle should contain the commande number
    expect(screen.getByText(/CMD-001/)).toBeInTheDocument()
  })

  it('ne affiche pas le modal quand open=false', () => {
    render(
      <ReconditionnementModal
        open={false}
        onOpenChange={vi.fn()}
        commandeId={1}
        commandeNumero="CMD-001"
        transformations={mockTransformations}
        onDone={vi.fn()}
      />
    )

    // The modal content should not be rendered
    expect(screen.queryByText(/Reconditionnement automatique/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Paracetamol 500mg (boite)')).not.toBeInTheDocument()
  })

  it('affiche la liste des transformations disponibles', () => {
    render(
      <ReconditionnementModal
        open={true}
        onOpenChange={vi.fn()}
        commandeId={1}
        commandeNumero="CMD-001"
        transformations={mockTransformations}
        onDone={vi.fn()}
      />
    )

    // Both source names should be displayed
    expect(screen.getByText('Paracetamol 500mg (boite)')).toBeInTheDocument()
    expect(screen.getByText('Amoxicilline 1g (boite)')).toBeInTheDocument()

    // Both destination names should be displayed
    expect(screen.getByText('Paracetamol 500mg (plaquette)')).toBeInTheDocument()
    expect(screen.getByText('Amoxicilline 1g (comprime)')).toBeInTheDocument()

    // Stock info should be displayed for each transformation
    expect(screen.getAllByText(/Stock/i)).toHaveLength(2)
  })

  it('permet de selectionner/deselectionner une ligne via la checkbox', () => {
    render(
      <ReconditionnementModal
        open={true}
        onOpenChange={vi.fn()}
        commandeId={1}
        commandeNumero="CMD-001"
        transformations={mockTransformations}
        onDone={vi.fn()}
      />
    )

    // All items are selected by default — checkboxes should be checked
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes[0]).toHaveAttribute('aria-checked', 'true')

    // Number inputs should be visible for all selected items
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs).toHaveLength(2)

    // Click the first checkbox to deselect
    fireEvent.click(checkboxes[0])

    // The first checkbox should now be unchecked
    expect(checkboxes[0]).toHaveAttribute('aria-checked', 'false')

    // The number input for the first item should no longer be visible
    const remainingInputs = screen.getAllByRole('spinbutton')
    expect(remainingInputs).toHaveLength(1)
  })

  it('permet de modifier la quantite d une transformation', () => {
    render(
      <ReconditionnementModal
        open={true}
        onOpenChange={vi.fn()}
        commandeId={1}
        commandeNumero="CMD-001"
        transformations={mockTransformations}
        onDone={vi.fn()}
      />
    )

    // Find the first quantity input (initial value = qty_transformable = 10)
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs[0]).toHaveValue(10)

    // The destination quantity display should show +20 (10 * ratio 2)
    expect(screen.getByText(/\+20/)).toBeInTheDocument()

    // Change the quantity to 5
    fireEvent.change(inputs[0], { target: { value: '5' } })

    // The input value should be updated
    expect(inputs[0]).toHaveValue(5)

    // The destination quantity display should now show +10 (5 * ratio 2)
    expect(screen.getByText(/\+10/)).toBeInTheDocument()
  })

  it('appelle l endpoint de transformation quand on confirme', async () => {
    const onDone = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <ReconditionnementModal
        open={true}
        onOpenChange={onOpenChange}
        commandeId={1}
        commandeNumero="CMD-001"
        transformations={mockTransformations}
        onDone={onDone}
      />
    )

    // Click the "Reconditionner" button
    const confirmBtn = screen.getByRole('button', { name: /Reconditionner/i })
    fireEvent.click(confirmBtn)

    // Verify api.post was called for each transformation
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(2)
    })

    // Verify the first call has the correct endpoint and payload
    expect(api.post).toHaveBeenCalledWith(
      'relations-transformation/1/transformer/',
      expect.objectContaining({
        quantite: 10,
        notes: expect.stringContaining('CMD-001'),
      })
    )

    // Verify the second call has the correct endpoint and payload
    expect(api.post).toHaveBeenCalledWith(
      'relations-transformation/2/transformer/',
      expect.objectContaining({
        quantite: 5,
        notes: expect.stringContaining('CMD-001'),
      })
    )
  })

  it('bloque la transformation si le stock source est 0 et affiche un message d erreur', async () => {
    // Transformation with source_stock = 0 but qty_transformable > 0
    // (the frontend allows the user to try, but the backend will reject)
    const transformationsWithZeroStock: TransformationDisponible[] = [
      {
        relation_id: 3,
        source_id: 50,
        source_name: 'Ibuprofene 400mg (boite)',
        source_cip: '345678',
        source_stock: 0,
        qty_recue: 10,
        qty_transformable: 10,
        destination_id: 60,
        destination_name: 'Ibuprofene 400mg (comprime)',
        destination_stock: 0,
        ratio: 1,
        qty_dest_obtained: 10,
      },
    ]

    // Mock api.post to reject with an error (backend rejects due to insufficient stock)
    vi.mocked(api.post).mockRejectedValue({
      response: {
        data: {
          detail: 'Stock source insuffisant pour effectuer la transformation',
        },
      },
    })

    render(
      <ReconditionnementModal
        open={true}
        onOpenChange={vi.fn()}
        commandeId={1}
        commandeNumero="CMD-001"
        transformations={transformationsWithZeroStock}
        onDone={vi.fn()}
      />
    )

    // Verify the source stock is displayed as 0
    expect(screen.getByText(/Ibuprofene 400mg \(boite\)/)).toBeInTheDocument()

    // Click the "Reconditionner" button
    const confirmBtn = screen.getByRole('button', { name: /Reconditionner/i })
    fireEvent.click(confirmBtn)

    // Wait for the error message to appear in the results view
    await waitFor(() => {
      expect(screen.getByText(/Stock source insuffisant/i)).toBeInTheDocument()
    })

    // Verify api.post was called (the attempt was made)
    expect(api.post).toHaveBeenCalledWith(
      'relations-transformation/3/transformer/',
      expect.objectContaining({
        quantite: 10,
      })
    )
  })
})
