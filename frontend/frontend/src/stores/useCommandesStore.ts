import { create } from 'zustand';
import type { Commande, CommandeProduit } from '../types';

type ViewMode = 'LIST' | 'CREATE' | 'DETAILS' | 'EDIT';
type CommandeType = 'LOC' | 'DIR' | 'DIV';

interface CommandesStoreState {
  selectedCommande: Commande | null;
  activeTab: CommandeType;
  commandeType: CommandeType;
  viewMode: ViewMode;
  tauxChange: string;
  fraisCoefficient: string;
  newCommandeFournisseurId: string;
  page: number;
  filterStatus: string;
  numeroFacture: string;
  commandeProduits: CommandeProduit[];
  commandeSortBy: 'chrono' | 'stock' | 'name' | 'qty';
  selectedRows: Set<number>;
  focusedField: { row: number; field: number } | null;
  sortKey: 'numero' | 'date' | 'fournisseur' | 'status';
  sortOrder: 'asc' | 'desc';
  showPrintLabelsModal: boolean;
  isImporting: boolean;
  isCreateProduitModalOpen: boolean;
  isSuggestionModalOpen: boolean;
  isSchedulingModalOpen: boolean;
  isTransferModalOpen: boolean;
  selectedOrderIds: Set<number>;
  isMergeModalOpen: boolean;
  saving: boolean;
}

interface CommandesStoreActions {
  setSelectedCommande: (value: Commande | null) => void;
  setActiveTab: (value: CommandeType) => void;
  setCommandeType: (value: CommandeType) => void;
  setViewMode: (value: ViewMode) => void;
  setTauxChange: (value: string) => void;
  setFraisCoefficient: (value: string) => void;
  setNewCommandeFournisseurId: (value: string) => void;
  setPage: (value: number) => void;
  setFilterStatus: (value: string) => void;
  setNumeroFacture: (value: string) => void;
  setCommandeProduits: (updater: CommandeProduit[] | ((prev: CommandeProduit[]) => CommandeProduit[])) => void;
  setCommandeSortBy: (value: 'chrono' | 'stock' | 'name' | 'qty') => void;
  setSelectedRows: (updater: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
  setFocusedField: (value: { row: number; field: number } | null) => void;
  setSortKey: (value: 'numero' | 'date' | 'fournisseur' | 'status') => void;
  setSortOrder: (value: 'asc' | 'desc' | ((prev: 'asc' | 'desc') => 'asc' | 'desc')) => void;
  setShowPrintLabelsModal: (value: boolean) => void;
  setIsImporting: (value: boolean) => void;
  setIsCreateProduitModalOpen: (value: boolean) => void;
  setIsSuggestionModalOpen: (value: boolean) => void;
  setIsSchedulingModalOpen: (value: boolean) => void;
  setIsTransferModalOpen: (value: boolean) => void;
  setSelectedOrderIds: (updater: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
  setIsMergeModalOpen: (value: boolean) => void;
  setSaving: (value: boolean) => void;
  resetCreateForm: (type: CommandeType, defaultCoeff: string) => void;
}

type CommandesStore = CommandesStoreState & CommandesStoreActions;

const createInitialState = (): CommandesStoreState => ({
  selectedCommande: null,
  activeTab: 'LOC',
  commandeType: 'LOC',
  viewMode: 'LIST',
  tauxChange: '655.957',
  fraisCoefficient: '1.35',
  newCommandeFournisseurId: '',
  page: 1,
  filterStatus: 'ALL',
  numeroFacture: '',
  commandeProduits: [],
  commandeSortBy: 'chrono',
  selectedRows: new Set<number>(),
  focusedField: null,
  sortKey: 'date',
  sortOrder: 'desc',
  showPrintLabelsModal: false,
  isImporting: false,
  isCreateProduitModalOpen: false,
  isSuggestionModalOpen: false,
  isSchedulingModalOpen: false,
  isTransferModalOpen: false,
  selectedOrderIds: new Set<number>(),
  isMergeModalOpen: false,
  saving: false,
});

export const useCommandesStore = create<CommandesStore>((set) => ({
  ...createInitialState(),
  setSelectedCommande: (value) => set({ selectedCommande: value }),
  setActiveTab: (value) => set({ activeTab: value }),
  setCommandeType: (value) => set({ commandeType: value }),
  setViewMode: (value) => set({ viewMode: value }),
  setTauxChange: (value) => set({ tauxChange: value }),
  setFraisCoefficient: (value) => set({ fraisCoefficient: value }),
  setNewCommandeFournisseurId: (value) => set({ newCommandeFournisseurId: value }),
  setPage: (value) => set({ page: value }),
  setFilterStatus: (value) => set({ filterStatus: value }),
  setNumeroFacture: (value) => set({ numeroFacture: value }),
  setCommandeProduits: (updater) =>
    set((state) => ({
      commandeProduits: typeof updater === 'function' ? updater(state.commandeProduits) : updater,
    })),
  setCommandeSortBy: (value) => set({ commandeSortBy: value }),
  setSelectedRows: (updater) =>
    set((state) => ({
      selectedRows: typeof updater === 'function' ? updater(state.selectedRows) : updater,
    })),
  setFocusedField: (value) => set({ focusedField: value }),
  setSortKey: (value) => set({ sortKey: value }),
  setSortOrder: (value) =>
    set((state) => ({
      sortOrder: typeof value === 'function' ? value(state.sortOrder) : value,
    })),
  setShowPrintLabelsModal: (value) => set({ showPrintLabelsModal: value }),
  setIsImporting: (value) => set({ isImporting: value }),
  setIsCreateProduitModalOpen: (value) => set({ isCreateProduitModalOpen: value }),
  setIsSuggestionModalOpen: (value) => set({ isSuggestionModalOpen: value }),
  setIsSchedulingModalOpen: (value) => set({ isSchedulingModalOpen: value }),
  setIsTransferModalOpen: (value) => set({ isTransferModalOpen: value }),
  setSelectedOrderIds: (updater) =>
    set((state) => ({
      selectedOrderIds: typeof updater === 'function' ? updater(state.selectedOrderIds) : updater,
    })),
  setIsMergeModalOpen: (value) => set({ isMergeModalOpen: value }),
  setSaving: (value) => set({ saving: value }),
  resetCreateForm: (type, defaultCoeff) =>
    set({
      viewMode: 'CREATE',
      selectedCommande: null,
      commandeType: type,
      numeroFacture: '',
      commandeProduits: [],
      selectedRows: new Set<number>(),
      newCommandeFournisseurId: '',
      tauxChange: '655.957',
      fraisCoefficient: type === 'DIR' ? defaultCoeff : '1.35',
    }),
}));
