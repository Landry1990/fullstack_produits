import { useEffect, useState, useMemo, useCallback, type FormEvent, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { useConfirm } from './useConfirm';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { getApiErrorDetail } from '../utils/errorHandling';
import type { Fournisseur, PaginatedResponse } from '../types';
import { useSudo } from './useSudo';

export interface CatalogueItem {
  produit_id: number;
  produit_nom: string;
  cip: string;
  dernier_prix_achat: number;
  derniere_commande: string | null;
  prix_vente: number;
  marge: number;
  marge_pourcent: number;
  qte_totale: number;
  stock_actuel: number;
}

export interface CatalogueResponse {
  fournisseur_id: number;
  fournisseur_nom: string;
  total_produits: number;
  produits: CatalogueItem[];
}

export const emptyForm: Omit<Fournisseur, 'id'> = {
  name: '',
  address: '',
  phone: '',
  email: '',
  type_reglement: 'FACTURE',
  delai_paiement_jours: 0,
  periode_releve_jours: 10,
};

export function useFournisseurs() {
  const { t } = useTranslation(['providers', 'common']);
  const location = useLocation();
  const confirm = useConfirm()
  const { user } = useAuth();
  
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [selectedFournisseur, setSelectedFournisseur] = useState<Fournisseur | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 50;

  // Sudo Mode State
  const { sudoState, requireSudo, closeSudo } = useSudo();
  
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [newFournisseur, setNewFournisseur] = useState(emptyForm);
  const [editingFournisseur, setEditingFournisseur] = useState<Fournisseur | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Catalogue state
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState<boolean>(false);
  const [catalogueSearch, setCatalogueSearch] = useState<string>('');
  const [showCatalogue, setShowCatalogue] = useState<boolean>(true);
  const [showInactive, setShowInactive] = useState<boolean>(false);
  
  const [financeModalState, setFinanceModalState] = useState<{
    isOpen: boolean;
    prefilledMontant?: number;
    commandeIds?: number[];
  }>({ isOpen: false });
  const [isEcheancierModalOpen, setIsEcheancierModalOpen] = useState(false);
  const [isPointageModalOpen, setIsPointageModalOpen] = useState(false);

  // Debounce search term to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Auto-refresh selectedFournisseur when list changes
  useEffect(() => {
    if (selectedFournisseur) {
      const updated = fournisseurs.find(f => f.id === selectedFournisseur.id);
      if (updated && updated !== selectedFournisseur) {
        setSelectedFournisseur(updated);
      }
    }
  }, [fournisseurs]); // ✅ Retiré selectedFournisseur des dépendances

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  const filteredCatalogue = useMemo(() => {
    if (!catalogueSearch.trim()) return catalogue;
    const term = catalogueSearch.toLowerCase();
    return catalogue.filter((item: CatalogueItem) => 
      item.produit_nom.toLowerCase().includes(term) ||
      item.cip.toLowerCase().includes(term)
    );
  }, [catalogue, catalogueSearch]);

  const catalogueControllerRef = useRef<AbortController | null>(null);

  const fetchCatalogue = useCallback(async (fournisseurId: number) => {
    catalogueControllerRef.current?.abort();
    const controller = new AbortController();
    catalogueControllerRef.current = controller;

    setCatalogueLoading(true);
    try {
      const response = await api.get<CatalogueResponse>(
        `fournisseurs/${fournisseurId}/catalogue/`,
        { signal: controller.signal }
      );
      setCatalogue(response.data.produits || []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Erreur lors du chargement du catalogue:', err);
      setCatalogue([]);
    } finally {
      setCatalogueLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedFournisseur) {
      fetchCatalogue(selectedFournisseur.id as number);
      setCatalogueSearch('');
    } else {
      setCatalogue([]);
    }
    return () => catalogueControllerRef.current?.abort();
  }, [selectedFournisseur?.id, fetchCatalogue]);

  const fournisseursControllerRef = useRef<AbortController | null>(null);

  const fetchFournisseurs = useCallback(async () => {
    fournisseursControllerRef.current?.abort();
    const controller = new AbortController();
    fournisseursControllerRef.current = controller;

    setError(null);
    try {
      const response = await api.get('fournisseurs/', {
        params: { 
          include_inactive: showInactive,
          page: currentPage,
          search: debouncedSearch
        },
        signal: controller.signal,
      });
      const data = response.data as PaginatedResponse<Fournisseur> | Fournisseur[];
      if (Array.isArray(data)) {
         setFournisseurs(data);
         setTotalCount(data.length);
      } else if ('results' in data) {
         setFournisseurs(data.results);
         setTotalCount(data.count || 0);
      } else {
         setFournisseurs([]);
         setTotalCount(0);
      }
    } catch (err: unknown) {
      const axiosErr = err as { code?: string; response?: { data?: { message?: string } }; message?: string };
      if (axiosErr?.code === 'ERR_CANCELED') return;
      if (axiosErr?.response) {
        setError(axiosErr.response?.data?.message ?? axiosErr.message ?? 'Erreur réseau');
      } else {
        setError(t('providers:messages.load_error') || 'Erreur inconnue lors du chargement des fournisseurs');
      }
    }
  }, [showInactive, currentPage, debouncedSearch, t]);

  useEffect(() => {
    fetchFournisseurs();
    return () => fournisseursControllerRef.current?.abort();
  }, [showInactive, currentPage, debouncedSearch]); // ✅ Dépendances directes au lieu de la fonction

  useEffect(() => {
    if (selectedFournisseur && !fournisseurs.some(f => f.id === selectedFournisseur.id)) {
      setSelectedFournisseur(null);
    }
  }, [fournisseurs]); // ✅ Retiré selectedFournisseur des dépendances

  useEffect(() => {
    if (location.state?.selectedSupplierId && fournisseurs.length > 0) {
      const supplier = fournisseurs.find(f => f.id === location.state.selectedSupplierId);
      if (supplier) {
        setSelectedFournisseur(supplier);
        if (location.state.openFinance) {
          setFinanceModalState({ isOpen: true });
        }
        window.history.replaceState({}, document.title);
      }
    }
  }, [fournisseurs]);

  function openAddModal() {
    setNewFournisseur(emptyForm);
    setIsAddModalOpen(true);
  }

  function closeAddModal() {
    setIsAddModalOpen(false);
    setError(null);
    setNewFournisseur(emptyForm);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!searchTerm) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => prev < fournisseurs.length - 1 ? prev + 1 : prev);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < fournisseurs.length) {
          selectFournisseur(fournisseurs[highlightedIndex]);
        }
        break;
      case 'Escape':
        setSearchTerm('');
        setHighlightedIndex(-1);
        break;
    }
  }

  function selectFournisseur(fournisseur: Fournisseur) {
    setSelectedFournisseur(fournisseur);
    setSearchTerm('');
    setHighlightedIndex(-1);
  }

  function openEditModal() {
    if (!selectedFournisseur) return;
    setEditingFournisseur(selectedFournisseur);
    setIsEditModalOpen(true);
  }

  function closeEditModal() {
    setIsEditModalOpen(false);
  }

  function formatBackendErrors(data: unknown): string {
    if (data == null) return t('common:unknown_error') || 'Erreur inconnue du serveur';
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
      try {
        const entries = Object.entries(data as Record<string, unknown>);
        const parts = entries.map(([field, messages]) => {
          if (Array.isArray(messages)) return `${field}: ${messages.join(', ')}`;
          if (typeof messages === 'string') return `${field}: ${messages}`;
          return `${field}: ${JSON.stringify(messages)}`;
        });
        return parts.join(' | ');
      } catch {
        return JSON.stringify(data);
      }
    }
    return String(data);
  }

  async function handleAddFournisseur(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { data: addedFournisseur } = await api.post<Fournisseur>('fournisseurs/', newFournisseur);
      setFournisseurs(prev => [addedFournisseur, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedFournisseur(addedFournisseur);
      setNewFournisseur(emptyForm);
      closeAddModal();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown }; message?: string };
      if (axiosErr?.response) {
        const detail = axiosErr.response?.data ?? axiosErr.message;
        setError(typeof detail === 'string' ? detail : formatBackendErrors(detail));
      } else {
        setError(t('providers:messages.save_error') || "Erreur inconnue lors de l'ajout du fournisseur");
      }
      console.error("Erreur lors de l'ajout du fournisseur:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEditFournisseur(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingFournisseur) return;
    try {
      const { data: updatedFournisseur } = await api.patch<Fournisseur>(
        `fournisseurs/${editingFournisseur.id}/`,
        editingFournisseur
      );
      setFournisseurs(prev => prev.map(f => (f.id === updatedFournisseur.id ? updatedFournisseur : f)));
      setSelectedFournisseur(updatedFournisseur);
      closeEditModal();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown }; message?: string };
      if (axiosErr?.response) {
        const detail = axiosErr.response?.data ?? axiosErr.message;
        setError(typeof detail === 'string' ? detail : formatBackendErrors(detail));
      } else {
        setError(t('providers:messages.save_error') || "Erreur inconnue lors de la modification du fournisseur");
      }
      console.error('Erreur lors de la modification du fournisseur:', err);
    }
  }

  const executeDeleteFournisseur = async (id: number) => {
    try {
      await api.delete(`fournisseurs/${id}/`);
      setFournisseurs(prev => prev.filter(f => f.id !== id));
      setSelectedFournisseur(null);
      toast.success(t('providers:messages.delete_success'));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string; message?: string; error?: string } }; message?: string };
      if (axiosErr?.response) {
        if (axiosErr.response?.status === 500 || (axiosErr.response?.data?.detail && String(axiosErr.response.data.detail).includes('protected'))) {
             toast.error(t('providers:messages.delete_protected'));
        } else {
             const msg = axiosErr.response?.data?.message ?? axiosErr.message ?? t('common:network_error');
             toast.error(`${t('common:error')}: ${msg}`);
        }
      } else {
        toast.error(t('providers:messages.delete_error'));
      }
      console.error('Erreur lors de la suppression du fournisseur:', err);
    }
  }

  const executeBulkDeleteFournisseurs = async () => {
    try {
      await api.post('fournisseurs/bulk_delete/', { ids: selectedIds });
      setFournisseurs(prev => prev.filter(f => !selectedIds.includes(f.id!)));
      setSelectedIds([]);
      if (selectedFournisseur && selectedIds.includes(selectedFournisseur.id!)) {
        setSelectedFournisseur(null);
      }
      toast.success(t('providers:messages.bulk_delete_success', { count: selectedIds.length }));
    } catch (err) {
      toast.error(getApiErrorDetail(err, t('providers:messages.bulk_delete_error')));
      console.error(err);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    if (!user?.is_superuser && !user?.can_delete_fournisseur) {
        toast.error(t('providers:messages.access_denied_delete'))
        return;
    }
    const confirmMessage = selectedIds.length === 1 
      ? t('providers:messages.delete_confirm_message', { name: fournisseurs.find(f => f.id === selectedIds[0])?.name })
      : `Êtes-vous sûr de vouloir supprimer ${selectedIds.length} fournisseurs ?`;

    const confirmed = await confirm({
      title: t('providers:messages.delete_confirm_title'),
      message: confirmMessage,
      variant: 'danger',
      confirmText: t('providers:messages.delete_btn')
    });
    
    if (confirmed) {
        requireSudo(async () => {
            await executeBulkDeleteFournisseurs();
        }, {
            title: t('providers:messages.sudo_title'),
            message: t('providers:messages.sudo_message'),
            permission: 'can_delete_fournisseur'
        });
    }
  }

  function toggleSelectAll() {
    if (selectedIds.length === fournisseurs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(fournisseurs.map(f => f.id!));
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  async function handleDeleteFournisseur() {
    if (!selectedFournisseur) return;
    if (!user?.is_superuser && !user?.can_delete_fournisseur) {
        toast.error(t('providers:messages.access_denied_delete'));
        return;
    }
    const confirmed = await confirm({
      title: t('providers:messages.delete_confirm_title'),
      message: t('providers:messages.delete_confirm_message', { name: selectedFournisseur.name }),
      variant: 'danger',
      confirmText: t('providers:messages.delete_btn')
    });
    
    if (confirmed) {
        requireSudo(async () => {
            await executeDeleteFournisseur(selectedFournisseur.id as number);
        }, {
            title: t('providers:messages.sudo_title'),
            message: t('providers:messages.sudo_message'),
            permission: 'can_delete_fournisseur'
        });
    }
  }

  async function handleToggleActive() {
    if (!selectedFournisseur) return;
    try {
      const response = await api.post(`fournisseurs/${selectedFournisseur.id}/toggle_active/`);
      const isActive = response.data.is_active;
      toast.success(isActive ? t('providers:messages.reactivated') : t('providers:messages.hidden'));
      setSelectedFournisseur(prev => prev ? ({ ...prev, is_active: isActive }) : null);
      fetchFournisseurs();
    } catch (err) {
      toast.error(t('providers:messages.status_change_error'));
      console.error(err);
    }
  }

  return {
    state: {
      t,
      fournisseurs,
      selectedFournisseur, setSelectedFournisseur,
      selectedIds, setSelectedIds,
      currentPage, setCurrentPage,
      totalCount,
      itemsPerPage, totalPages,
      error, setError,
      isAddModalOpen, setIsAddModalOpen,
      isEditModalOpen, setIsEditModalOpen,
      newFournisseur, setNewFournisseur,
      editingFournisseur, setEditingFournisseur,
      isSubmitting, setIsSubmitting,
      searchTerm, setSearchTerm,
      debouncedSearch,
      highlightedIndex, setHighlightedIndex,
      searchInputRef,
      catalogue,
      catalogueLoading,
      catalogueSearch, setCatalogueSearch,
      showCatalogue, setShowCatalogue,
      showInactive, setShowInactive,
      financeModalState, setFinanceModalState,
      isEcheancierModalOpen, setIsEcheancierModalOpen,
      isPointageModalOpen, setIsPointageModalOpen,
      sudoState,
    },
    derived: {
      filteredCatalogue
    },
    actions: {
      fetchFournisseurs,
      openAddModal, closeAddModal, handleAddFournisseur,
      handleKeyDown, selectFournisseur,
      openEditModal, closeEditModal, handleEditFournisseur,
      handleBulkDelete, toggleSelectAll, toggleSelect,
      handleDeleteFournisseur, handleToggleActive,
      closeSudo,
    }
  };
}
