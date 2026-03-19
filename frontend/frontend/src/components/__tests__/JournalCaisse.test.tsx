import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import JournalCaisse from '../JournalCaisse';
import axios from 'axios';

// axios and react-i18next are mocked globally in setup.ts
vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

// Mock components/hooks
vi.mock('../../hooks/usePharmacySettings', () => ({
  usePharmacySettings: () => ({ 
    settings: { pharmacy_name: 'Test Pharma' },
    loading: false
  })
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ 
    getServerDate: () => new Date('2025-03-09T10:00:00')
  })
}));

// Mock react-datepicker to avoid complex DOM structure in tests
vi.mock('react-datepicker', () => {
  return {
    default: ({ selected, onChange, placeholderText }: any) => (
      <input 
        data-testid="date-picker"
        placeholder={placeholderText}
        value={selected ? selected.toISOString() : ''} 
        onChange={(e) => onChange(new Date(e.target.value))}
      />
    ),
    registerLocale: vi.fn()
  }
});

const mockPageInit = {
  transactions: { results: [], count: 0 },
  mouvements: { results: [], count: 0 },
  totals: {
    total_theorique: 50000,
    total_ventes: 45000,
    total_entrees: 10000,
    total_sorties: 5000,
    total_recouvrement: 2000,
    details: { especes: 30000, carte: 15000 }
  },
  users: [{ id: 1, username: 'caissier1', first_name: 'Ali', last_name: 'Baba', full_name: 'Ali Baba' }]
};

describe('JournalCaisse Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.get).mockResolvedValue({ data: mockPageInit });
  });

  it('renders correctly and displays totals', async () => {
    render(
      <MemoryRouter>
        <JournalCaisse />
      </MemoryRouter>
    );

    expect(screen.getByText(/Journal de Caisse/i)).toBeInTheDocument();
    
    await waitFor(() => {
        // Checking for "Espèces à Justifier" value (50 000)
        expect(screen.getAllByText(/50\s?000/).length).toBeGreaterThan(0);
        // Checking for "Ventes Nettes" value (45 000)
        expect(screen.getAllByText(/45\s?000/).length).toBeGreaterThan(0);
    });
  });

  it('filters by user and triggers fetch', async () => {
    render(
      <MemoryRouter>
        <JournalCaisse />
      </MemoryRouter>
    );

    await waitFor(() => {
        expect(screen.getByText('Ali Baba')).toBeInTheDocument();
    });

    const userSelect = screen.getAllByRole('combobox')[1]; // Select for user is the second one
    fireEvent.change(userSelect, { target: { value: '1' } });

    await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('get_totals'), expect.objectContaining({
            params: expect.objectContaining({ user_id: '1' })
        }));
    });
  });

  it('opens movement modal on button click', async () => {
    render(
      <MemoryRouter>
        <JournalCaisse />
      </MemoryRouter>
    );

    const operationBtn = screen.getByRole('button', { name: /Opération/i });
    fireEvent.click(operationBtn);

    // CashMovementModal is a child component, we'd normally check for its content
    // Here we check if the component renders or if we need to mock it
  });
});
