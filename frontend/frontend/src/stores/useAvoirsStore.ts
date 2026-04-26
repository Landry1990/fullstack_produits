import { create } from 'zustand';
import type { Avoir, Fournisseur, LigneAvoir, ProduitModel, StockLot } from '../types';

type ViewMode = 'LIST' | 'CREATE' | 'EDIT' | 'DETAILS';

interface AvoirsStoreState {
  viewMode: ViewMode;
  avoirs: Avoir[];
  loading: boolean;
  selectedAvoir: Avoir | null;
  listSearchQuery: string;
  editingAvoirId: number | null;
  selectedFournisseurId: string;
  typeAvoir: string;
  observations: string;
  lignes: LigneAvoir[];
  fournisseurSearch: string;
  filteredFournisseurs: Fournisseur[];
  isSearchingFournisseur: boolean;
  showFournisseurList: boolean;
  lotModal: { open: boolean; lineIndex: number | null; produitId: number | null };
  availableLots: StockLot[];
  loadingLots: boolean;
  savingValidation: boolean;
  selectedIds: Set<number>;
  bulkLoading: boolean;
}

interface AvoirsStoreActions {
  setViewMode: (value: ViewMode) => void;
  setAvoirs: (value: Avoir[] | ((prev: Avoir[]) => Avoir[])) => void;
  setLoading: (value: boolean) => void;
  setSelectedAvoir: (value: Avoir | null | ((prev: Avoir | null) => Avoir | null)) => void;
  setListSearchQuery: (value: string) => void;
  setEditingAvoirId: (value: number | null) => void;
  setSelectedFournisseurId: (value: string) => void;
  setTypeAvoir: (value: string) => void;
  setObservations: (value: string) => void;
  setLignes: (value: LigneAvoir[] | ((prev: LigneAvoir[]) => LigneAvoir[])) => void;
  setFournisseurSearch: (value: string) => void;
  setFilteredFournisseurs: (value: Fournisseur[]) => void;
  setIsSearchingFournisseur: (value: boolean) => void;
  setShowFournisseurList: (value: boolean) => void;
  setLotModal: (value: { open: boolean; lineIndex: number | null; produitId: number | null } | ((prev: { open: boolean; lineIndex: number | null; produitId: number | null }) => { open: boolean; lineIndex: number | null; produitId: number | null })) => void;
  setAvailableLots: (value: StockLot[]) => void;
  setLoadingLots: (value: boolean) => void;
  setSavingValidation: (value: boolean) => void;
  setSelectedIds: (value: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
  setBulkLoading: (value: boolean) => void;
  resetForm: () => void;
}

type AvoirsStore = AvoirsStoreState & AvoirsStoreActions;

const initialState: AvoirsStoreState = {
  viewMode: 'LIST',
  avoirs: [],
  loading: true,
  selectedAvoir: null,
  listSearchQuery: '',
  editingAvoirId: null,
  selectedFournisseurId: '',
  typeAvoir: 'PERIME',
  observations: '',
  lignes: [],
  fournisseurSearch: '',
  filteredFournisseurs: [],
  isSearchingFournisseur: false,
  showFournisseurList: false,
  lotModal: { open: false, lineIndex: null, produitId: null },
  availableLots: [],
  loadingLots: false,
  savingValidation: false,
  selectedIds: new Set<number>(),
  bulkLoading: false,
};

export const useAvoirsStore = create<AvoirsStore>((set) => ({
  ...initialState,
  setViewMode: (value) => set({ viewMode: value }),
  setAvoirs: (value) => set((state) => ({ avoirs: typeof value === 'function' ? value(state.avoirs) : value })),
  setLoading: (value) => set({ loading: value }),
  setSelectedAvoir: (value) => set((state) => ({ selectedAvoir: typeof value === 'function' ? value(state.selectedAvoir) : value })),
  setListSearchQuery: (value) => set({ listSearchQuery: value }),
  setEditingAvoirId: (value) => set({ editingAvoirId: value }),
  setSelectedFournisseurId: (value) => set({ selectedFournisseurId: value }),
  setTypeAvoir: (value) => set({ typeAvoir: value }),
  setObservations: (value) => set({ observations: value }),
  setLignes: (value) => set((state) => ({ lignes: typeof value === 'function' ? value(state.lignes) : value })),
  setFournisseurSearch: (value) => set({ fournisseurSearch: value }),
  setFilteredFournisseurs: (value) => set({ filteredFournisseurs: value }),
  setIsSearchingFournisseur: (value) => set({ isSearchingFournisseur: value }),
  setShowFournisseurList: (value) => set({ showFournisseurList: value }),
  setLotModal: (value) => set((state) => ({ lotModal: typeof value === 'function' ? value(state.lotModal) : value })),
  setAvailableLots: (value) => set({ availableLots: value }),
  setLoadingLots: (value) => set({ loadingLots: value }),
  setSavingValidation: (value) => set({ savingValidation: value }),
  setSelectedIds: (value) => set((state) => ({ selectedIds: typeof value === 'function' ? value(state.selectedIds) : value })),
  setBulkLoading: (value) => set({ bulkLoading: value }),
  resetForm: () =>
    set({
      viewMode: 'CREATE',
      selectedAvoir: null,
      editingAvoirId: null,
      selectedFournisseurId: '',
      fournisseurSearch: '',
      typeAvoir: 'PERIME',
      observations: '',
      lignes: [],
    }),
}));

export type { ViewMode };
export type AvoirsSetLineValue = string | number | boolean | ProduitModel | undefined;
