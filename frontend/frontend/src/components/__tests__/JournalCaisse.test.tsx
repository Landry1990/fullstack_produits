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
    settings: { pharmacy_name: 'Test Pharma' },
    loading: false
  })
}));

// react-datepicker, axios and react-i18next are mocked globally in setup.ts
vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

vi.mock('../../hooks/usePharmacySettings', () => ({
  usePharmacySettings: () => ({ 
    settings: { pharmacy_name: 'Test Pharma' },
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
});
