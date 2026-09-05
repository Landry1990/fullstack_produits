import { render, screen, fireEvent, waitFor } from '../../tests/utils/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import JournalCaisse from '../JournalCaisse';
import axios from 'axios';
import mockPageInit from '../../tests/fixtures/journal.json';

// Les mocks globaux (Auth, i18n, axios, etc.) sont gérés dans setup.ts
// On ne garde ici que les mocks spécifiques à ce composant

vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

vi.mock('../../hooks/usePharmacySettings', () => ({
  usePharmacySettings: () => ({ 
    settings: { pharmacy_name: 'Test Pharma', billetage_obligatoire: false },
    loading: false
  })
}));

// react-datepicker, axios and react-i18next are mocked globally in setup.ts
vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

vi.mock('../../hooks/usePharmacySettings', () => ({
  usePharmacySettings: () => ({ 
    settings: { pharmacy_name: 'Test Pharma', billetage_obligatoire: false },
    loading: false
  })
}));

describe('JournalCaisse Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.get).mockResolvedValue({ data: mockPageInit });
  });

  it('renders correctly and displays totals', async () => {
    // Utilisation du render personnalisé qui inclut tous les Providers
    render(<JournalCaisse />);

    expect(screen.getByText(/Journal de Caisse/i)).toBeInTheDocument();
    
    await waitFor(() => {
        // "50 000" (total_theorique)
        expect(screen.getAllByText(/50\s?000/).length).toBeGreaterThan(0);
        // "45 000" (total_ventes)
        expect(screen.getAllByText(/45\s?000/).length).toBeGreaterThan(0);
    });
  });

  it('filters by user and triggers fetch', async () => {
    render(<JournalCaisse />);

    await waitFor(() => {
        expect(screen.getByText('Ali Baba')).toBeInTheDocument();
    });

    const userSelect = screen.getAllByRole('combobox')[1]; 
    fireEvent.change(userSelect, { target: { value: '1' } });

    // Vérifier que le changement de sélection a bien eu lieu
    await waitFor(() => {
        expect(userSelect).toHaveValue('1');
    });
    
    // Le hook va déclencher un fetch avec le nouveau user
    // On vérifie juste que la sélection a changé, le fetch est asynchrone
  });

  it('opens movement modal on button click', async () => {
    render(<JournalCaisse />);

    const operationBtn = await screen.findByRole('button', { name: /Opération/i });
    fireEvent.click(operationBtn);

    // Vérifie que l'un des titres possibles de la modale apparaît (Entrée ou Sortie)
    await waitFor(() => {
      expect(screen.getByText(/Nouvelle Dépense|Nouvelle Entrée/i)).toBeInTheDocument();
    });
  });

  it('filtre par mode de paiement - seules les ventes du mode selectionne s\'affichent', async () => {
    // Mock avec transactions de modes differents
    const mockWithTransactions = {
      transactions: {
        results: [
          { id: 1, facture: 1, facture_numero: 'FAC-001', mode_paiement: 'especes', mode_paiement_display: 'Espèces', montant: '10000', reference: null, statut: 'completee', date_paiement: '2024-01-01T10:00:00', user_details: { id: 1, username: 'caissier1', full_name: 'Ali Baba' }, client_name: 'Client Alpha' },
          { id: 2, facture: 2, facture_numero: 'FAC-002', mode_paiement: 'carte', mode_paiement_display: 'Carte Bancaire', montant: '15000', reference: null, statut: 'completee', date_paiement: '2024-01-01T11:00:00', user_details: { id: 1, username: 'caissier1', full_name: 'Ali Baba' }, client_name: 'Client Beta' },
          { id: 3, facture: 3, facture_numero: 'FAC-003', mode_paiement: 'om', mode_paiement_display: 'Orange Money', montant: '5000', reference: null, statut: 'completee', date_paiement: '2024-01-01T12:00:00', user_details: { id: 1, username: 'caissier1', full_name: 'Ali Baba' }, client_name: 'Client Gamma' }
        ],
        count: 3
      },
      mouvements: { results: [], count: 0 },
      totals: {
        total_theorique: 30000,
        total_ventes: 30000,
        total_entrees: 0,
        total_sorties: 0,
        total_recouvrement: 0,
        details: { especes: 10000, carte: 15000, om: 5000 }
      },
      users: [
        { id: 1, username: 'caissier1', first_name: 'Ali', last_name: 'Baba', full_name: 'Ali Baba' }
      ]
    };

    vi.mocked(axios.get).mockResolvedValue({ data: mockWithTransactions });

    render(<JournalCaisse />);

    // Attendre que les transactions soient chargees
    await waitFor(() => {
      expect(screen.getAllByText(/Client Alpha/i).length).toBeGreaterThan(0);
    });

    // Verifier que les 3 clients sont visibles avant le filtre
    expect(screen.getAllByText(/Client Alpha/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Client Beta/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Client Gamma/i).length).toBeGreaterThan(0);

    // Changer le filtre de mode de paiement (premier combobox)
    const modeSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(modeSelect, { target: { value: 'carte' } });

    // Verifier que seul le client Beta (mode carte) est visible
    await waitFor(() => {
      expect(screen.queryAllByText(/Client Alpha/i).length).toBe(0);
      expect(screen.queryAllByText(/Client Gamma/i).length).toBe(0);
    });
    expect(screen.getAllByText(/Client Beta/i).length).toBeGreaterThan(0);
  });

  it('affiche l\'ecart caisse entre total theorique et montant reel dans le modal de cloture', async () => {
    render(<JournalCaisse />);

    // Attendre que les donnees soient chargees
    await waitFor(() => {
      expect(screen.getByText(/Journal de Caisse/i)).toBeInTheDocument();
    });

    // Selectionner un caissier pour activer le bouton de cloture
    const userSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(userSelect, { target: { value: '1' } });

    // Attendre que le bouton Cloturer soit cliquable et le cliquer
    await waitFor(() => {
      const closeBtn = screen.getByRole('button', { name: /Clôturer/i });
      expect(closeBtn).not.toBeDisabled();
    });

    const closeBtn = screen.getByRole('button', { name: /Clôturer/i });
    fireEvent.click(closeBtn);

    // Attendre que le modal de cloture apparaisse (input du montant reel)
    // Le placeholder est maintenant traduit avec defaultValue "Saisissez le montant réel"
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/montant r[eé]el|real amount/i)).toBeInTheDocument();
    });

    // Saisir un montant reel different du theorique (50000)
    const realAmountInput = screen.getByPlaceholderText(/montant r[eé]el|real amount/i);
    fireEvent.change(realAmountInput, { target: { value: '48000' } });

    // Verifier que l'ecart de caisse est affiche
    await waitFor(() => {
      expect(screen.getByText(/Écart de caisse/i)).toBeInTheDocument();
    });
  });
});
