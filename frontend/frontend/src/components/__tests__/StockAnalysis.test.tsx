import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StockAnalysis from '../StockAnalysis';
import axios from 'axios';

// Mock axios
vi.mock('axios');

describe('StockAnalysis', () => {
    const mockFournisseurs = [
        { id: 1, name: 'FOURNISSEUR A' },
        { id: 2, name: 'FOURNISSEUR B' }
    ];

    const mockUnsoldData = {
        type: 'unsold',
        fournisseur: 'Tous les fournisseurs',
        total_items: 2,
        total_value: 15000,
        items: [
            {
                id: 101,
                name: 'PRODUIT A',
                stock: 10,
                value: 5000,
                cost_price: 500,
                selling_price: 1000,
                fournisseur_name: 'FOURNISSEUR A',
                created_at: '2025-01-01T10:00:00Z'
            },
            {
                id: 102,
                name: 'PRODUIT B',
                stock: 5,
                value: 10000,
                cost_price: 2000,
                selling_price: 3000,
                fournisseur_name: 'FOURNISSEUR B',
                created_at: '2025-01-02T10:00:00Z'
            }
        ]
    };

    const mockOverstockData = {
        type: 'overstock',
        fournisseur: 'Tous les fournisseurs',
        total_items: 1,
        total_value: 50000,
        items: [
            {
                id: 201,
                name: 'PRODUIT C',
                stock: 100,
                rotation: 10,
                threshold: 17,
                excess_qty: 83,
                value: 50000,
                cost_price: 600, // approx
                selling_price: 1000,
                fournisseur_name: 'FOURNISSEUR A'
            }
        ]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Default mocks
        (axios.get as any).mockImplementation((url: string) => {
            if (url.includes('/api/fournisseurs/')) {
                return Promise.resolve({ data: mockFournisseurs });
            }
            if (url.includes('/api/stock-analysis/unsold/')) {
                return Promise.resolve({ data: mockUnsoldData });
            }
            if (url.includes('/api/stock-analysis/overstock/')) {
                return Promise.resolve({ data: mockOverstockData });
            }
            return Promise.resolve({ data: [] });
        });
    });

    it('renders the title', async () => {
        render(<StockAnalysis />);
        expect(screen.getByText(/Analyse des Stocks/i)).toBeInTheDocument();
    });

    it('displays unsold products by default', async () => {
        render(<StockAnalysis />);
        
        await waitFor(() => {
            expect(screen.getByText('PRODUIT A')).toBeInTheDocument();
            expect(screen.getByText('PRODUIT B')).toBeInTheDocument();
        });
        
        // Use simplified matching for numbers due to locale
        const values = screen.getAllByText((content, element) => {
             // Match "5 000 F" loosely
             return element?.tagName.toLowerCase() === 'td' && content.replace(/\s/g, '').includes('5000F');
        });
        expect(values.length).toBeGreaterThan(0);
    });

    it('switches to overstock tab', async () => {
        render(<StockAnalysis />);
        
        // Wait for initial load
        await waitFor(() => expect(screen.getByText('PRODUIT A')).toBeInTheDocument());
        
        // Click Overstock Tab
        const overstockTab = screen.getByText(/Surstock/i);
        fireEvent.click(overstockTab);
        
        await waitFor(() => {
            expect(screen.getByText('PRODUIT C')).toBeInTheDocument();
            expect(screen.queryByText('PRODUIT A')).not.toBeInTheDocument();
        });
        
        // Verify specific columns for overstock (Rotation, Excess)
        expect(screen.getByText(/Rotation Moy/i)).toBeInTheDocument();
        expect(screen.getByText('+83')).toBeInTheDocument(); // Excess Qty
    });

    it('filters by supplier', async () => {
        render(<StockAnalysis />);
        await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());

        // Verify options are loaded
        await waitFor(() => {
            expect(screen.getByRole('option', { name: 'FOURNISSEUR A' })).toBeInTheDocument();
        });

        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: '1' } }); // ID 1 (Fournisseur A)
        
        // Expect refetch with params
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(
                expect.stringContaining('/api/stock-analysis/unsold/'),
                expect.objectContaining({ params: { fournisseur: '1' } })
            );
        });
    });

    it('handles empty state', async () => {
        (axios.get as any).mockImplementation((url: string) => {
             if (url.includes('/api/fournisseurs/')) return Promise.resolve({ data: [] });
             return Promise.resolve({ data: { items: [], total_items: 0, total_value: 0 } });
        });

        render(<StockAnalysis />);
        
        await waitFor(() => {
            expect(screen.getByText(/Aucun produit invendu/i)).toBeInTheDocument();
            expect(screen.getByText(/Tout semble en ordre !/i)).toBeInTheDocument();
        });
    });
});
