import axios from 'axios'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Avoirs from '../Avoirs'

// Mock libs externes
vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))
vi.mock('axios') 
vi.mock('use-debounce', () => ({
  useDebounce: (val: any) => [val]
}))

// Mock hooks
vi.mock('../../hooks/useProductSearch', () => ({
  useProductSearch: () => ({
    produits: [],
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

const mockAvoirs = [
  {
    id: 1,
    numero: 'AV-001',
    created_at: '2025-02-01T10:00:00',
    fournisseur_name: 'Laborex',
    type_avoir: 'PERIME',
    total_ht: 15000,
    status: 'BROUILLON'
  }
]

describe('Avoirs Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(axios.get).mockImplementation((url: string) => {
        if (url.includes('/avoirs/')) {
            return Promise.resolve({ data: mockAvoirs })
        }
        if (url.includes('/fournisseurs/')) {
            return Promise.resolve({ data: [] })
        }
        return Promise.resolve({ data: [] })
    })
  })

  it('affiche la liste des avoirs', async () => {
    render(<Avoirs />)
    
    expect(screen.getByText('Avoirs Fournisseurs (Retours)')).toBeInTheDocument()
    
    await waitFor(() => {
        expect(screen.getByText('AV-001')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Laborex')).toBeInTheDocument()
    expect(screen.getByText('PERIME')).toBeInTheDocument()
  })

  it('permet de créer un nouvel avoir', async () => {
    render(<Avoirs />)
    
    const newBtn = screen.getByText('+ Nouvel Avoir')
    fireEvent.click(newBtn)
    
    expect(screen.getByText('Nouvel Avoir (Retour Stock)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Rechercher fournisseur...')).toBeInTheDocument()
  })
})
