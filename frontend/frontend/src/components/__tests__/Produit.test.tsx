import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import Produit from '../Produit';
import { ConfirmProvider } from '../../hooks/useConfirm';
import { AuthProvider } from '../../context/AuthContext';

// axios is mocked globally in setup.ts
const mockedAxios = axios as any;

// Mock context/hooks
const mockConfirm = vi.fn();
vi.mock('../../hooks/useConfirm', () => ({
    useConfirm: () => mockConfirm
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

// Mock costly sub-components
vi.mock('./ProduitFormModal', () => ({
    default: () => <div data-testid="produit-create-modal">Modal Create</div>
}));

describe('Produit Component (Integration)', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                    gcTime: 0, 
                },
            },
        });

        // Setup default mocks
        mockedAxios.get.mockImplementation((url: string, _config: any) => {
            if (/\/api\/produits\/?|produits\/?/.test(url)) {
                return Promise.resolve({
                    data: {
                        count: 2,
                        results: [
                            { id: 1, name: 'DOLIPRANE', cip1: '123456', stock: 10, selling_price: 1000 },
                            { id: 2, name: 'EFFERALGAN', cip1: '789012', stock: 5, selling_price: 2000 }
                        ]
                    }
                });
            }
            if (/\/api\/categories\/?|categories\/?/.test(url)) {
                return Promise.resolve({ data: { results: [{ id: 1, name: 'MEDICAMENTS' }] } });
            }
            if (/\/api\/fournisseurs\/?|fournisseurs\/?/.test(url)) {
                return Promise.resolve({ data: { results: [{ id: 1, name: 'PHARMA' }] } });
            }
            if (/\/api\/formes\/?|formes\/?/.test(url)) {
                return Promise.resolve({ data: { results: [] } });
            }
            if (/\/api\/groupes\/?|groupes\/?/.test(url)) {
                return Promise.resolve({ data: { results: [] } });
            }
            return Promise.resolve({ data: [] });
        });
    });

    it('fetches and displays products via axios', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <ConfirmProvider>
                        <MemoryRouter>
                            <Produit />
                        </MemoryRouter>
                    </ConfirmProvider>
                </AuthProvider>
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(screen.getByText(/DOLIPRANE/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/EFFERALGAN/i)).toBeInTheDocument();
        expect(screen.getByText('123456')).toBeInTheDocument();
    });

    it('searches for products by triggering new API call', async () => {
        vi.useFakeTimers();
        render(
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <ConfirmProvider>
                        <MemoryRouter>
                            <Produit />
                        </MemoryRouter>
                    </ConfirmProvider>
                </AuthProvider>
            </QueryClientProvider>
        );

        await waitFor(() => expect(screen.getByText(/DOLIPRANE/i)).toBeInTheDocument());

        const searchInput = screen.getByPlaceholderText(/Nom ou CIP/i);
        fireEvent.change(searchInput, { target: { value: 'DOLI' } });

        // Debounce 500ms
        await act(async () => {
            vi.advanceTimersByTime(600);
        });

        await waitFor(() => {
            expect(mockedAxios.get).toHaveBeenCalledWith(
                expect.stringContaining('produits/'),
                expect.objectContaining({
                    params: expect.objectContaining({ search: 'DOLI' })
                })
            );
        });

        vi.useRealTimers();
    });

    it('handles delete integration flow', async () => {
        mockedAxios.delete.mockResolvedValue({});
        mockConfirm.mockResolvedValue(true);

        render(
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <ConfirmProvider>
                        <MemoryRouter>
                            <Produit />
                        </MemoryRouter>
                    </ConfirmProvider>
                </AuthProvider>
            </QueryClientProvider>
        );

        await waitFor(() => expect(screen.getByText(/DOLIPRANE/i)).toBeInTheDocument());

        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[1]); 

        const deleteBtn = screen.getByText(/Supprimer/i);
        fireEvent.click(deleteBtn);

        await waitFor(() => {
            expect(mockedAxios.delete).toHaveBeenCalledWith(
                expect.stringContaining('produits/1/'),
                expect.any(Object)
            );
        });
    });
});
