import axios from 'axios'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import InventaireComponent from '../Inventaire'

// Mock des libs externes
vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))
vi.mock('axios')

// Mock des hooks
vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => ({ confirm: vi.fn() })
}))

vi.mock('../../hooks/useProductSearch', () => ({
  useProductSearch: () => ({
    produits: [],
    loading: false,
    searchQuery: '',
    setSearchQuery: vi.fn()
  })
}))

vi.mock('../../hooks/useSearchNavigation', () => ({
  useSearchNavigation: () => ({
    handleKeyDown: vi.fn(),
    getItemProps: () => ({})
  })
}))

// Mock des données API
const mockInventaires = [
  { 
    id: 1, 
    date: '2025-01-15T10:00:00', 
    description: 'Inventaire Janvier', 
    status: 'EN_COURS',
    total_valeur_theorique: 100000,
    total_valeur_physique: 95000,
    total_ecart_valeur: -5000,
    created_by_name: 'Admin'
  }
]

describe('Inventaire Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock Axios get response
    vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('/inventaires/')) {
            return Promise.resolve({ data: mockInventaires })
        }
        return Promise.resolve({ data: [] })
    })
  })

  it('affiche la liste des inventaires', async () => {
    render(<InventaireComponent />)

    // Vérifier titre
    expect(screen.getByText('Inventaires')).toBeInTheDocument()
    
    // Attendre le chargement des données
    await waitFor(() => {
        expect(screen.getByText('Inventaire Janvier')).toBeInTheDocument()
    })
    
    // Vérifier statut
    expect(screen.getByText('EN_COURS')).toBeInTheDocument()
  })

  it('permet de créer un nouvel inventaire', async () => {
    render(<InventaireComponent />)
    
    const createBtn = screen.getByText('+ Nouvel Inventaire')
    fireEvent.click(createBtn)
    
    // Vérifier changement de vue
    expect(screen.getByText('Nouvel Inventaire')).toBeInTheDocument()
    // Vérifier présence champ description
    expect(screen.getByPlaceholderText(/Ex: Inventaire Annuel/i)).toBeInTheDocument()
  })
})
