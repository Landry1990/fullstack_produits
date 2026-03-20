import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Produit from '../Produit';

// Mock context/hooks simply
vi.mock('../../hooks/useConfirm', () => ({
    useConfirm: () => vi.fn().mockResolvedValue(true)
}));

vi.mock('react-hot-toast', () => ({
    toast: { success: vi.fn(), error: vi.fn() }
}));

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ user: { id: 1, role: 'PHARMACIEN', is_superuser: true }, isAuthenticated: true }),
    AuthProvider: ({ children }: any) => <>{children}</>
}));

// Mock costly sub-components
vi.mock('./ProduitFormModal', () => ({
    default: () => <div data-testid="produit-create-modal">Modal Create</div>
}));

// Mock the Domain Hooks directly!
vi.mock('../../hooks/useProduits', () => ({
    useProduits: vi.fn().mockReturnValue({
        data: { 
            results: [
                { id: 1, name: 'DOLIPRANE', cip1: '123456', stock: 10, selling_price: 1000 },
                { id: 2, name: 'EFFERALGAN', cip1: '789012', stock: 5, selling_price: 2000 }
            ], 
            count: 2 
        },
        isLoading: false,
        error: null,
        refetch: vi.fn()
    }),
    useRayons: () => ({ data: [] }),
    useFournisseurs: () => ({ data: [] }),
    useFormes: () => ({ data: [] }),
    useGroupes: () => ({ data: [] }),
    useProduitAchats: () => ({ data: [] }),
    useProduitLots: () => ({ data: [] }),
    useProduitStats: () => ({ data: [] }),
    useProduitHistory: () => ({ data: [] }),
    useUpdateProduit: () => ({ mutate: vi.fn() }),
    useAdjustStock: () => ({ mutate: vi.fn() }),
    useDeleteProduit: () => ({ mutate: vi.fn() }),
    useRecalculateRotation: () => ({ mutate: vi.fn() })
}));

vi.mock('../../hooks/useTVA', () => ({
    useTVA: () => ({ tvaList: [], loading: false })
}));

import { useProduits } from '../../hooks/useProduits';

describe('Produit Component (Integration)', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false, gcTime: 0 } },
        });
    });

    it('displays products from hook', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <Produit />
                </MemoryRouter>
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(screen.getByText(/DOLIPRANE/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/EFFERALGAN/i)).toBeInTheDocument();
    });

    it('triggers search by calling the hook with new filters', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <Produit />
                </MemoryRouter>
            </QueryClientProvider>
        );

        const searchInput = screen.getByPlaceholderText(/Nom ou CIP/i);
        fireEvent.change(searchInput, { target: { value: 'DOLI' } });

        await waitFor(() => {
            expect(useProduits).toHaveBeenCalledWith(
                expect.objectContaining({ search: 'DOLI' })
            );
        }, { timeout: 3000 });
    });
});
