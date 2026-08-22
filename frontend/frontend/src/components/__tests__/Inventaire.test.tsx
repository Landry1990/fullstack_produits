import { render, screen, waitFor, fireEvent, act, renderHook, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import InventaireComponent from '../Inventaire';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InventaireDataTab } from '../inventaire/editor/InventaireDataTab';
import InventaireCreateModal from '../inventaire/modals/InventaireCreateModal';
import { InventaireMergeModal } from '../inventaire/modals/InventaireMergeModal';
import type { LigneInventaire } from '../../types';

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

// Mock api instance used by the real hooks (loaded via vi.importActual below).
const { apiMock } = vi.hoisted(() => ({
    apiMock: {
        get: vi.fn(() => Promise.resolve({ data: {} })),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        patch: vi.fn(() => Promise.resolve({ data: {} })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    }
}));

vi.mock('../../hooks/inventaire/useInventaireList', () => ({
    useInventaireList: () => ({
        inventaires: mocks.inventaires,
        loading: false,
        totalCount: 1,
        currentPage: 1,
        totalPages: 1,
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
        filterOrdering: '',
        setFilterOrdering: vi.fn(),
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
vi.mock('../../context/PharmacySettingsContext', () => ({
    usePharmacySettings: () => ({
        settings: { pharmacy_name: 'Test', currency_symbol: 'F', locale: 'fr-FR' },
        loading: false, error: null, updateSettings: vi.fn(), refetch: vi.fn()
    })
}));

// Mocks for the real-hook tests (useInventaireEditor / useInventaireMerge loaded via importActual)
vi.mock('goey-toast', () => ({
    gooeyToast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }
}));
vi.mock('../../services/api', () => ({ default: apiMock }));
vi.mock('../../hooks/useProduits', () => ({
    useRayons: () => ({ data: [{ id: 1, name: 'Rayon A' }], isPending: false }),
    useFormes: () => ({ data: [{ id: 1, nom: 'Comprime' }], isPending: false }),
    useGroupes: () => ({ data: [{ id: 1, nom: 'Antalgiques' }], isPending: false }),
}));

// Real hook implementations (bypass the per-file vi.mock factories above).
let realUseInventaireEditor: typeof import('../../hooks/inventaire/useInventaireEditor')['useInventaireEditor'];
let realUseInventaireMerge: typeof import('../../hooks/inventaire/useInventaireMerge')['useInventaireMerge'];

beforeAll(async () => {
    const editorMod = await vi.importActual<typeof import('../../hooks/inventaire/useInventaireEditor')>(
        '../../hooks/inventaire/useInventaireEditor'
    );
    const mergeMod = await vi.importActual<typeof import('../../hooks/inventaire/useInventaireMerge')>(
        '../../hooks/inventaire/useInventaireMerge'
    );
    realUseInventaireEditor = editorMod.useInventaireEditor;
    realUseInventaireMerge = mergeMod.useInventaireMerge;
});

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

        // Donnees du mock
        await waitFor(() => {
            expect(screen.getByText(/Janvier/i)).toBeInTheDocument();
        });
    });
});

// ---------------------------------------------------------------------------
// Cration d'un inventaire : le bouton "Nouvel inventaire" ouvre le formulaire
// ---------------------------------------------------------------------------
describe('Inventaire - creation (bouton Nouvel inventaire)', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    });

    const renderWithContext = (ui: React.ReactElement) => render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>{ui}</MemoryRouter>
        </QueryClientProvider>
    );

    it('ouvre le formulaire de creation au clic sur le bouton "Nouvel inventaire"', async () => {
        renderWithContext(<InventaireComponent />);

        const createBtn = screen.getByRole('button', { name: /Nouvel Inventaire/i });
        await act(async () => { fireEvent.click(createBtn); });

        const dialog = await screen.findByRole('dialog');
        expect(dialog).toBeInTheDocument();
        // Le titre du formulaire de creation est "Nouvel Inventaire"
        expect(within(dialog).getByText('Nouvel Inventaire')).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// InventaireCreateModal : validation du wizard et emission des options
// ---------------------------------------------------------------------------
describe('InventaireCreateModal - wizard de creation', () => {
    it('emet les options de creation apres parcours du wizard (VERIFY / RAYON)', async () => {
        const onConfirm = vi.fn();
        render(
            <MemoryRouter>
                <InventaireCreateModal isOpen={true} onClose={vi.fn()} onConfirm={onConfirm} isSaving={false} />
            </MemoryRouter>
        );

        // Etape 1 : "Contrôle partiel" (VERIFY) est selectionne par defaut
        expect(screen.getByText('Contrôle partiel')).toBeInTheDocument();

        // Passer a l'etape 2
        const nextBtn = screen.getByRole('button', { name: /Suivant/i });
        await act(async () => { fireEvent.click(nextBtn); });

        // Etape 2 : choix du type de stock (RAYON par defaut) + recap
        await waitFor(() => {
            expect(screen.getByText(/Type de stock/i)).toBeInTheDocument();
        });

        // Confirmer
        const confirmBtn = screen.getByRole('button', { name: /Confirmer/i });
        await act(async () => { fireEvent.click(confirmBtn); });

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            action: 'VERIFY',
            stockType: 'RAYON',
        }));
    });

    it('emet une action ENTRY (Inventaire complet) quand cette option est choisie', async () => {
        const onConfirm = vi.fn();
        render(
            <MemoryRouter>
                <InventaireCreateModal isOpen={true} onClose={vi.fn()} onConfirm={onConfirm} isSaving={false} />
            </MemoryRouter>
        );

        // Choisir "Inventaire complet" (ENTRY) via le radio associe
        const entryRadio = screen.getByRole('radio', { name: /Inventaire complet/i });
        await act(async () => { fireEvent.click(entryRadio); });

        // Passer a l'etape 2
        const nextBtn = screen.getByRole('button', { name: /Suivant/i });
        await act(async () => { fireEvent.click(nextBtn); });

        // Confirmer
        const confirmBtn = await screen.findByRole('button', { name: /Confirmer/i });
        await act(async () => { fireEvent.click(confirmBtn); });

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
            action: 'ENTRY',
        }));
    });
});

// ---------------------------------------------------------------------------
// Pre-remplissage : VERIFY declenche pre_populate + chargement des lignes
// ---------------------------------------------------------------------------
describe('Inventaire - pre-remplissage (hook reel useInventaireEditor)', () => {
    beforeEach(() => {
        apiMock.get.mockReset();
        apiMock.post.mockReset();
        apiMock.patch.mockReset();
        apiMock.delete.mockReset();
    });

    it('pre-remplit les lignes avec les produits et stocks actuels en mode VERIFY', async () => {
        apiMock.post.mockImplementation((url: string) => {
            if (url === 'inventaires/') {
                return Promise.resolve({ data: { id: 42, date: '2025-01-01', description: 'desc', status: 'EN_COURS' } });
            }
            return Promise.resolve({ data: {} });
        });
        apiMock.get.mockImplementation((url: string) => {
            if (url.includes('/lignes/')) {
                return Promise.resolve({
                    data: [{
                        id: 1, inventaire: 42, produit: 1, produit_nom: 'Doliprane',
                        stock_theorique: 10, quantite_physique: 10, ecart: 0, pmp_snapshot: '0'
                    }]
                });
            }
            return Promise.resolve({ data: {} });
        });

        const fetchInventaires = vi.fn();
        const setViewMode = vi.fn();
        const requireSudo = vi.fn();
        const confirm = vi.fn(async () => true);

        const { result } = renderHook(
            () => realUseInventaireEditor(fetchInventaires, setViewMode, requireSudo, confirm),
            { wrapper: MemoryRouter }
        );

        await act(async () => {
            await result.current.handleCreateWithOptions({ action: 'VERIFY', stockType: 'RAYON', rayonId: 1 });
        });

        // 1. Creation de l'en-tete
        expect(apiMock.post).toHaveBeenCalledWith('inventaires/', expect.objectContaining({ inventory_type: 'RAYON' }));
        // 2. Pre-population avec le perimetre choisi
        expect(apiMock.post).toHaveBeenCalledWith('inventaires/42/pre_populate/', expect.objectContaining({ rayon_id: 1 }));
        // 3. Rechargement des lignes pre-remplies
        expect(apiMock.get).toHaveBeenCalledWith('inventaires/42/lignes/');
        // Les lignes sont chargees en local
        expect(result.current.lignes).toHaveLength(1);
        expect(result.current.lignes[0].produit_nom).toBe('Doliprane');
        expect(result.current.lignes[0].stock_theorique).toBe(10);
    });

    it('ne pre-remplit pas en mode ENTRY (saisie a partir de zero)', async () => {
        apiMock.post.mockImplementation((url: string) => {
            if (url === 'inventaires/') {
                return Promise.resolve({ data: { id: 43, date: '2025-01-01', description: 'desc', status: 'EN_COURS' } });
            }
            return Promise.resolve({ data: {} });
        });

        const { result } = renderHook(
            () => realUseInventaireEditor(vi.fn(), vi.fn(), vi.fn(), vi.fn(async () => true)),
            { wrapper: MemoryRouter }
        );

        await act(async () => {
            await result.current.handleCreateWithOptions({ action: 'ENTRY', stockType: 'GLOBAL' });
        });

        // Aucun appel pre_populate ni get lignes en mode ENTRY
        expect(apiMock.post).not.toHaveBeenCalledWith('inventaires/43/pre_populate/', expect.anything());
        expect(apiMock.get).not.toHaveBeenCalledWith('inventaires/43/lignes/');
        expect(result.current.lignes).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Calcul des ecarts dans InventaireDataTab
// ---------------------------------------------------------------------------
describe('Inventaire - calcul des ecarts (InventaireDataTab)', () => {
    const baseLine = (over: Partial<LigneInventaire> = {}): LigneInventaire => ({
        id: 1,
        inventaire: 1,
        produit: 1,
        produit_nom: 'Doliprane',
        produit_cip: 'CIP1',
        stock_theorique: 10,
        quantite_physique: 10,
        ecart: 0,
        pmp_snapshot: '0',
        ...over,
    });

    const Harness = ({ initial }: { initial: LigneInventaire[] }) => {
        const [lignes, setLignes] = useState(initial);
        const handleUpdateQuantity = (id: number, qty: number) => {
            setLignes(prev => prev.map(l =>
                l.id === id ? { ...l, quantite_physique: qty, ecart: qty - l.stock_theorique } : l
            ));
        };
        return (
            <InventaireDataTab
                lignes={lignes}
                isReadOnly={false}
                saving={false}
                selectedLines={new Set()}
                toggleSelectAll={vi.fn()}
                toggleSelectLine={vi.fn()}
                handleUpdateQuantity={handleUpdateQuantity}
                handleDeleteLine={vi.fn()}
                handleBulkDelete={vi.fn()}
            />
        );
    };

    it('calcule un ecart positif quand la quantite physique depasse le stock theorique', () => {
        render(<Harness initial={[baseLine({ id: 1, quantite_physique: 15, ecart: 5 })]} />);
        const ecartCell = screen.getByText('+5');
        expect(ecartCell).toBeInTheDocument();
        expect(ecartCell.className).toContain('text-emerald-600');
    });

    it('calcule un ecart negatif quand la quantite physique est inferieure au stock theorique', () => {
        render(<Harness initial={[baseLine({ id: 2, quantite_physique: 7, ecart: -3 })]} />);
        const ecartCell = screen.getByText('-3');
        expect(ecartCell).toBeInTheDocument();
        expect(ecartCell.className).toContain('text-red-500');
    });

    it('recalcule l\'ecart apres saisie d\'une quantite physique differente du stock theorique', async () => {
        render(<Harness initial={[baseLine({ id: 3, quantite_physique: 10, ecart: 0 })]} />);
        // Stock theorique = 10, quantite physique = 10 -> ecart 0
        expect(screen.getByText('0')).toBeInTheDocument();
        const input = screen.getByDisplayValue('10');
        await act(async () => { fireEvent.change(input, { target: { value: '14' } }); });
        // 14 - 10 = +4
        await waitFor(() => {
            expect(screen.getByText('+4')).toBeInTheDocument();
        });
    });
});

// ---------------------------------------------------------------------------
// Validation : declenche l'endpoint API inventaires/:id/validate/
// ---------------------------------------------------------------------------
describe('Inventaire - validation (hook reel useInventaireEditor)', () => {
    beforeEach(() => {
        apiMock.get.mockReset();
        apiMock.post.mockReset();
        apiMock.patch.mockReset();
        apiMock.delete.mockReset();
    });

    it('appelle l\'endpoint de validation apres confirmation sudo', async () => {
        apiMock.post.mockImplementation((url: string) => {
            if (url === 'inventaires/') {
                return Promise.resolve({ data: { id: 7, date: '2025-01-01', description: 'desc', status: 'EN_COURS' } });
            }
            return Promise.resolve({ data: {} });
        });
        apiMock.get.mockResolvedValue({ data: [] });

        const fetchInventaires = vi.fn();
        const setViewMode = vi.fn();
        let sudoAction: ((validatorId: number, password?: string) => Promise<void>) | null = null;
        const requireSudo = vi.fn((action: (validatorId: number, password?: string) => Promise<void>) => {
            sudoAction = action;
        });
        const confirm = vi.fn(async () => true);

        const { result } = renderHook(
            () => realUseInventaireEditor(fetchInventaires, setViewMode, requireSudo, confirm),
            { wrapper: MemoryRouter }
        );

        // Creer un inventaire (mode ENTRY) pour definir activeInventaire
        await act(async () => {
            await result.current.handleCreateWithOptions({ action: 'ENTRY', stockType: 'GLOBAL' });
        });

        // Ouvrir la validation -> declenche requireSudo
        await act(async () => {
            await result.current.handleOpenValidateModal();
        });
        expect(requireSudo).toHaveBeenCalled();

        // Simuler la confirmation sudo
        await act(async () => {
            await sudoAction!(1, 'password');
        });

        expect(apiMock.post).toHaveBeenCalledWith(
            'inventaires/7/validate/',
            expect.objectContaining({ validated_by_id: 1, sudo_password: 'password' })
        );
    });
});

// ---------------------------------------------------------------------------
// Fusion des doublons : inventaires/:id/merge/ (somme des lignes cote backend)
// ---------------------------------------------------------------------------
describe('Inventaire - fusion des doublons (hook reel useInventaireMerge)', () => {
    beforeEach(() => {
        apiMock.get.mockReset();
        apiMock.post.mockReset();
        apiMock.patch.mockReset();
        apiMock.delete.mockReset();
    });

    it('appelle l\'endpoint de fusion pour chaque inventaire source selectionne', async () => {
        apiMock.post.mockResolvedValue({ data: {} });

        const inventaires = [
            { id: 1, date: '2025-01-01', status: 'EN_COURS', description: 'Inv 1' },
            { id: 2, date: '2025-01-02', status: 'EN_COURS', description: 'Inv 2' },
        ];

        const { result } = renderHook(
            () => realUseInventaireMerge({
                viewMode: 'LIST',
                selectedInventaireIds: new Set([1, 2]),
                inventaires,
                setSelectedInventaireIds: vi.fn(),
                fetchInventaires: vi.fn(),
                activeInventaire: null,
                handleEdit: vi.fn(),
                confirm: vi.fn(async () => true),
            }),
            { wrapper: MemoryRouter }
        );

        // Choisir la cible de fusion = inventaire 2
        await act(async () => { result.current.setSelectedMergeSource(2); });

        // Lancer la fusion (le backend dedoublonne et somme les quantites)
        await act(async () => { await result.current.handleMerge(); });

        // La source 1 est fusionnee vers la cible 2
        expect(apiMock.post).toHaveBeenCalledWith(
            'inventaires/2/merge/',
            expect.objectContaining({ source_inventaire_id: 1 })
        );
    });
});

// ---------------------------------------------------------------------------
// InventaireMergeModal : le bouton de fusion declenche handleMerge
// ---------------------------------------------------------------------------
describe('InventaireMergeModal - declenchement', () => {
    it('appelle handleMerge au clic sur le bouton de fusion (mode LIST)', async () => {
        const handleMerge = vi.fn();
        const setSelectedMergeSource = vi.fn();
        render(
            <MemoryRouter>
                <InventaireMergeModal
                    showMergeModal={true}
                    setShowMergeModal={vi.fn()}
                    viewMode="LIST"
                    selectedMergeSource={2}
                    setSelectedMergeSource={setSelectedMergeSource}
                    mergeCandidates={[]}
                    loadingMergeCandidates={false}
                    merging={false}
                    handleMerge={handleMerge}
                    selectedInventaireIds={new Set([1, 2])}
                    inventaires={[
                        { id: 1, date: '2025-01-01', status: 'EN_COURS', description: 'Inv 1' },
                        { id: 2, date: '2025-01-02', status: 'EN_COURS', description: 'Inv 2' },
                    ]}
                />
            </MemoryRouter>
        );

        const mergeBtn = screen.getByRole('button', { name: /Fusionner/i });
        await act(async () => { fireEvent.click(mergeBtn); });
        expect(handleMerge).toHaveBeenCalled();
    });
});
