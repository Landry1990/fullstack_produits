import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import InventaireComponent from '../Inventaire';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Use vi.hoisted to define mock data that can be used in vi.mock
const mocks = vi.hoisted(() => ({
    inventaires: [
        { 
            id: 1, 
            date: '2025-01-01T12:00:00Z', 
            status: 'BROUILLON', 
            description: 'Inventaire Janvier',
            created_by_name: 'Admin',
            total_valeur_theorique: 1000,
            total_valeur_physique: 900,
            total_ecart_valeur: -100
        }
    ]
}));

vi.mock('../../hooks/inventaire/useInventaireList', () => ({
    useInventaireList: () => ({
        inventaires: mocks.inventaires,
        loading: false,
        totalCount: 1,
        currentPage: 1,
        nextPage: null,
        prevPage: null,
        fetchInventaires: vi.fn(),
        handleDelete: vi.fn(),
        filterStartDate: '',
        setFilterStartDate: vi.fn(),
        filterEndDate: '',
        setFilterEndDate: vi.fn(),
        filterSearchTerm: '',
        setFilterSearchTerm: vi.fn(),
        filterStatus: '',
        setStatusFilter: vi.fn(),
        filterCreator: '',
        setFilterCreator: vi.fn(),
        selectedInventaireIds: new Set(),
        toggleSelectInventaire: vi.fn(),
        toggleSelectAllInventaires: vi.fn(),
        deleting: false
    })
}));

vi.mock('../../hooks/inventaire/useInventaireEditor', () => ({
    useInventaireEditor: () => ({
        saving: false,
        createInventaire: vi.fn(),
    })
}));

vi.mock('../../hooks/inventaire/useInventaireMerge', () => ({
    useInventaireMerge: () => ({ 
        canMergeSelectedInventaires: () => ({ canMerge: false, reason: null }),
        showMergeModal: false,
        setShowMergeModal: vi.fn()
    })
}));

vi.mock('../../hooks/useConfirm', () => ({ useConfirm: () => (async () => true) }));
vi.mock('../../hooks/useSudo', () => ({ useSudo: () => ({ sudoState: { is_validated: true }, requireSudo: () => {}, closeSudo: () => {} }) }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, role: 'PHARMACIEN' } }) }));

describe('Inventaire.test.tsx', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient = new QueryClient();
    });

    const renderWithContext = (ui: React.ReactElement) => {
        return render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    {ui}
                </MemoryRouter>
            </QueryClientProvider>
        );
    };

    it('affiche la liste des inventaires', async () => {
        renderWithContext(<InventaireComponent />);
        
        // Titre principal
        expect(screen.getAllByText(/Inventaire/i)[0]).toBeInTheDocument();
        
        // Données du mock
        await waitFor(() => {
            expect(screen.getByText(/Janvier/i)).toBeInTheDocument();
        });
    });
});
