import axios from 'axios'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import InventaireComponent from '../Inventaire'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// Mock des libs externes
vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0 }
  }
})

const renderWithContext = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
        <MemoryRouter>
            {ui}
        </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Inventaire Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Mock Axios get response
    vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('/inventaires/')) {
            return Promise.resolve({ data: mockInventaires })
        }
        return Promise.resolve({ data: [] })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('affiche la liste des inventaires', async () => {
    renderWithContext(<InventaireComponent />)
    
    // Attendre le debounce de 500ms
    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    // Vérifier titre
    expect(screen.getByText(/Inventaires/i)).toBeInTheDocument()
    
    // Attendre le chargement des données
    await waitFor(() => {
        expect(screen.getByText(/Inventaire Janvier/i)).toBeInTheDocument()
    })
    
    // Vérifier statut
    expect(screen.getByText(/EN_COURS|En cours/i)).toBeInTheDocument()
  })

  it('permet de créer un nouvel inventaire', async () => {
    renderWithContext(<InventaireComponent />)
    
    // Attendre le debounce et le chargement
    await act(async () => {
        vi.advanceTimersByTime(600)
    })
    
    // Attendre que le bouton soit disponible (fin du chargement)
    const createBtn = await screen.findByText(/\+ Nouvel Inventaire/i)
    fireEvent.click(createBtn)
    
    // Vérifier changement de vue
    expect(screen.getByText(/Nouvel Inventaire/i)).toBeInTheDocument()
    // Vérifier présence champ description
    expect(screen.getByPlaceholderText(/Ex: Inventaire Annuel/i)).toBeInTheDocument()
  })
})
