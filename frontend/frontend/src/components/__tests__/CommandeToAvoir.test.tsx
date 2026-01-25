import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CommandeForm from '../Commandes/CommandeForm';

// Mocks simples
const mockProps = {
    viewMode: 'DETAILS' as const,
    selectedCommande: {
        id: 123,
        numero_facture: 'FAC-123',
        status: 'CLOT',
        fournisseur: 1,
        date: '2024-01-01',
        total: '1000'
    } as any,
    fournisseurs: [{ id: 1, name: 'Grossiste Test' }] as any,
    newCommandeFournisseurId: '1',
    setNewCommandeFournisseurId: vi.fn(),
    numeroFacture: 'FAC-123',
    setNumeroFacture: vi.fn(),
    commandeType: 'LOC' as const,
    tauxChange: '',
    setTauxChange: vi.fn(),
    fraisCoefficient: '',
    setFraisCoefficient: vi.fn(),
    handleBackToList: vi.fn(),
    handleSaveCommande: vi.fn(),
    handleCsvExport: vi.fn(),
    handleCsvImport: vi.fn(),
    fileInputRef: { current: null } as any,
    setIsCreateProduitModalOpen: vi.fn(),
    searchInputRef: { current: null } as any,
    fournisseurSelectRef: { current: null } as any,
    searchProduitQuery: '',
    setSearchProduitQuery: vi.fn(),
    handleSearchKeyDown: vi.fn(),
    filteredProduits: [],
    selectProduct: vi.fn(),
    getItemProps: () => ({}),
    
    commandeProduits: [],
    produitsList: [],
    selectedRows: new Set(),
    saving: false,
    lastSaved: null,
    fieldsConfig: [],
    focusedField: null,
    toggleRowSelection: vi.fn(),
    toggleAllRows: vi.fn(),
    deleteSelectedRows: vi.fn(),
    openTransferModal: vi.fn(),
    updateCommandeProduitField: vi.fn(),
    handleTableFieldKeyDown: vi.fn(),
    onRemoveProduct: vi.fn(),
    onCreateAvoir: vi.fn() // Key prop to test
};

describe('CommandeForm Avoir Button', () => {
    it('affiche le bouton "Retour / Avoir" si la commande est cloturée et onCreateAvoir est fourni', () => {
        render(<CommandeForm {...mockProps} />);
        expect(screen.getByText(/Retour \/ Avoir/)).toBeInTheDocument();
    });

    it('n\'affiche pas le bouton si la commande n\'est pas cloturée', () => {
        const props = { 
            ...mockProps, 
            selectedCommande: { ...mockProps.selectedCommande, status: 'PREP' } 
        };
        render(<CommandeForm {...props} />);
        expect(screen.queryByText(/Retour \/ Avoir/)).not.toBeInTheDocument();
    });

    it('appelle onCreateAvoir lors du clic', () => {
        render(<CommandeForm {...mockProps} />);
        fireEvent.click(screen.getByText(/Retour \/ Avoir/));
        expect(mockProps.onCreateAvoir).toHaveBeenCalled();
    });
});
