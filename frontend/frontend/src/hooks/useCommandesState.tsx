import { useEffect, useMemo, useRef, useCallback } from 'react';
import { gooeyToast } from 'goey-toast';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useConfirm } from './useConfirm';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSudo } from './useSudo';
import { useCommandes, useCommandeFournisseurs, useCommandeRayons } from './useCommandes';
import { useCommandeActions } from './useCommandeActions';
import { useSearchNavigation } from './useSearchNavigation';
import type { Commande, ProduitModel } from '../types';
import { normalizeNumberInput } from '../utils/formatters';
import { useProductSearch } from './useProductSearch';
import { usePharmacySettings } from './usePharmacySettings';
import { useFormes } from './useProduits';
import { useCommandesStore } from '../stores/useCommandesStore';

import { useCommandeTotals } from './commandes/useCommandeTotals';
import { useCommandeListSelection } from './commandes/useCommandeListSelection';
import { useCommandeCsv } from './commandes/useCommandeCsv';
import { useCommandeProductLines } from './commandes/useCommandeProductLines';
import { useCommandeNavigation } from './commandes/useCommandeNavigation';
import { useCommandeAutosave } from './commandes/useCommandeAutosave';
import { useCommandeHandlers } from './commandes/useCommandeHandlers';
import { useCommandeRecalc } from './commandes/useCommandeRecalc';
import { useCommandeKeyboard } from './commandes/useCommandeKeyboard';

const statusOrder: Record<string, number> = { 'PREP': 1, 'ATT': 2, 'CLOT': 3 };

export function useCommandesState(forcedType?: 'LOC' | 'DIR' | 'DIV') {
  const confirm = useConfirm()
  const { t } = useTranslation(['orders', 'common', 'products']);
  const { user } = useAuth();
  const navigate = useNavigate();
  const selectedCommande = useCommandesStore((s) => s.selectedCommande);
  const setSelectedCommande = useCommandesStore((s) => s.setSelectedCommande);

  const { settings: pharmacySettings } = usePharmacySettings();
  const activeTab = useCommandesStore((s) => s.activeTab);
  const setActiveTab = useCommandesStore((s) => s.setActiveTab);
  const commandeType = useCommandesStore((s) => s.commandeType);
  const setCommandeType = useCommandesStore((s) => s.setCommandeType);

  
  const viewMode = useCommandesStore((s) => s.viewMode);
  const setViewMode = useCommandesStore((s) => s.setViewMode);

  const isSchedulingModalOpen = useCommandesStore((s) => s.isSchedulingModalOpen);
  const setIsSchedulingModalOpen = useCommandesStore((s) => s.setIsSchedulingModalOpen);


  const tauxChange = useCommandesStore((s) => s.tauxChange);
  const setTauxChange = useCommandesStore((s) => s.setTauxChange);
  const fraisCoefficient = useCommandesStore((s) => s.fraisCoefficient);
  const setFraisCoefficient = useCommandesStore((s) => s.setFraisCoefficient);

  const newCommandeFournisseurId = useCommandesStore((s) => s.newCommandeFournisseurId);
  const setNewCommandeFournisseurId = useCommandesStore((s) => s.setNewCommandeFournisseurId);

  const page = useCommandesStore((s) => s.page);
  const setPage = useCommandesStore((s) => s.setPage);
  const filterStatus = useCommandesStore((s) => s.filterStatus);
  const setFilterStatus = useCommandesStore((s) => s.setFilterStatus);

  const produitsEndpoint = 'produits/for_import/';
  const commandesEndpoint = 'commandes/';
  const fournisseursEndpoint = 'fournisseurs/';
  const queryClient = useQueryClient();

  const { 
    data: commandesData, 
    isLoading: loading, 
    error: loadError,
    refetch: _refetchCommandes 
  } = useCommandes({ page, type: activeTab, status: filterStatus, page_size: 20 });

  const { data: fournisseurs = [] } = useCommandeFournisseurs();
  const { data: rayons = [] } = useCommandeRayons();
  const { data: formes = [] } = useFormes();

  // Filtrer les fournisseurs selon le type de commande
  // LOC/DIR: exclure les fournisseurs "divers"
  // DIV: uniquement les fournisseurs "divers"
  const filteredFournisseurs = useMemo(() => {
    if (activeTab === 'DIV') {
      return fournisseurs.filter(f => f.is_divers);
    } else {
      return fournisseurs.filter(f => !f.is_divers);
    }
  }, [fournisseurs, activeTab]);

  const commandes = useMemo(() => commandesData?.results || [], [commandesData]);
  const totalCount = commandesData?.count || 0;

  const {
    selectedOrderIds,
    setSelectedOrderIds,
    toggleOrderSelection,
    toggleAllOrdersSelection,
    canMergeSelectedOrders,
    openMergeModal,
    handleMergeSuccess,
  } = useCommandeListSelection(commandes);
  const statusCounts = useMemo(() => commandesData?.status_counts || {}, [commandesData]);
  const pageSize = 20;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const error = loadError ? (loadError as Error).message : null;

  const numeroFacture = useCommandesStore((s) => s.numeroFacture);
  const setNumeroFacture = useCommandesStore((s) => s.setNumeroFacture);
  const isMiseEnPlace = useCommandesStore((s) => s.isMiseEnPlace);
  const setIsMiseEnPlace = useCommandesStore((s) => s.setIsMiseEnPlace);
  const delaiPaiementNegocieJours = useCommandesStore((s) => s.delaiPaiementNegocieJours);
  const setDelaiPaiementNegocieJours = useCommandesStore((s) => s.setDelaiPaiementNegocieJours);
  const payeALaCloture = useCommandesStore((s) => s.payeALaCloture);
  const setPayeALaCloture = useCommandesStore((s) => s.setPayeALaCloture);
  const setCommandeProduits = useCommandesStore((s) => s.setCommandeProduits);
  const commandeSortBy = useCommandesStore((s) => s.commandeSortBy);

  // Ref pour briser la dépendance circulaire : useProductSearch a besoin de selectProduct (onBarcodeMatch)
  // mais selectProduct vient de useCommandeProductLines qui a besoin de produitsList (de useProductSearch)
  const selectProductRef = useRef<(product: ProduitModel) => Promise<void>>(async () => {});

  const {
    produits: produitsList,
    loading: searchLoading,
    searchQuery: searchProduitQuery,
    setSearchQuery: setSearchProduitQuery,
    refetch: _refetchProduits
  } = useProductSearch({
    minSearchLength: 2,
    debounceMs: 400,
    pageSize: 100,
    onBarcodeMatch: (product) => selectProductRef.current(product),
  })

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fournisseurSelectRef = useRef<HTMLSelectElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    commandeProduits,
    selectedRows,
    pendingDuplicateProduct,
    setPendingDuplicateProduct,
    fieldsConfig,
    selectProduct,
    handleDuplicateAddNewLine,
    handleDuplicateIncrementExisting,
    removeProductFromCommande,
    toggleRowSelection,
    toggleAllRows,
    deleteSelectedRows,
    openTransferModal,
    updateCommandeProduitField,
    handleSellingPriceBlur,
    handleTableFieldKeyDown,
    handleSortProduits,
    handleTransferSuccess,
  } = useCommandeProductLines({
    commandeType,
    tauxChange,
    fraisCoefficient,
    viewMode,
    selectedCommande,
    newCommandeFournisseurId,
    searchInputRef,
    setSearchProduitQuery,
    produitsList,
    t,
  });

  // Connecter le ref maintenant que selectProduct est défini
  selectProductRef.current = selectProduct;

  const {
    openCreateView,
    openEditView,
    handleViewDetails,
    handleBackToList,
    handleApplySuggestions,
  } = useCommandeNavigation({
    forcedType,
    pharmacySettings,
    fournisseurs,
    produitsList,
    setSearchProduitQuery,
    t,
  });

  const setSelectedRows = useCommandesStore((s) => s.setSelectedRows);
  const focusedField = useCommandesStore((s) => s.focusedField);

  const sortKey = useCommandesStore((s) => s.sortKey);
  const setSortKey = useCommandesStore((s) => s.setSortKey);
  const sortOrder = useCommandesStore((s) => s.sortOrder);
  const setSortOrder = useCommandesStore((s) => s.setSortOrder);
  const searchQuery = useCommandesStore((s) => s.searchQuery);
  const setSearchQuery = useCommandesStore((s) => s.setSearchQuery);
  const showPrintLabelsModal = useCommandesStore((s) => s.showPrintLabelsModal);
  const setShowPrintLabelsModal = useCommandesStore((s) => s.setShowPrintLabelsModal);

  const isImporting = useCommandesStore((s) => s.isImporting);
  const setIsImporting = useCommandesStore((s) => s.setIsImporting);

  const { handleCsvImport, handleCsvExport } = useCommandeCsv({
    commandeProduits,
    setCommandeProduits,
    commandeType,
    tauxChange,
    produitsList,
    fileInputRef,
    setIsImporting,
  });
  const isCreateProduitModalOpen = useCommandesStore((s) => s.isCreateProduitModalOpen);
  const setIsCreateProduitModalOpen = useCommandesStore((s) => s.setIsCreateProduitModalOpen);

  const isSuggestionModalOpen = useCommandesStore((s) => s.isSuggestionModalOpen);
  const setIsSuggestionModalOpen = useCommandesStore((s) => s.setIsSuggestionModalOpen);
  const isTransferModalOpen = useCommandesStore((s) => s.isTransferModalOpen);
  const setIsTransferModalOpen = useCommandesStore((s) => s.setIsTransferModalOpen);

  const isMergeModalOpen = useCommandesStore((s) => s.isMergeModalOpen);
  const setIsMergeModalOpen = useCommandesStore((s) => s.setIsMergeModalOpen);

  // Les produits sont déjà filtrés et triés par l'index local (useProductSearch)
  // Pas besoin de re-filtrer — l'index fait un scoring par pertinence
  const filteredProduits = produitsList;

  const {
      handleSaveCommande,
      handleDeleteCommande,
      handleCloturerCommande,
      handleMettreEnAttente,
      handleAnnulerReception,
      handleImprimerReception,
      handleBulkDelete,
      executingAction,
      reconditionnement,
  } = useCommandeActions({
      fetchCommandes: async () => { queryClient.invalidateQueries({ queryKey: ['commandes'] }); },
      setSelectedCommande,
      setViewMode,
      confirm,
      user
  });

  const { sudoState, requireSudo, closeSudo } = useSudo();
  const saving = useCommandesStore((s) => s.saving);
  const setSaving = useCommandesStore((s) => s.setSaving);

  useEffect(() => {
      setSelectedRows(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCommande]);

  // Removed useEffect that sets selectedCommande to null if not in list.
  // This caused 'messages.no_selection' after an autosave because the newly created command
  // was not yet in the 'commandes' page array, forcing selectedCommande to null while in EDIT mode.

  const onSave = () => {
      if (commandeProduits.length === 0) {
          gooeyToast.error(t('orders:messages.add_at_least_one'));
          return;
      }
      if (isMiseEnPlace && !payeALaCloture && !delaiPaiementNegocieJours.trim()) {
          gooeyToast.error(t('orders:messages.mise_en_place_delai_required'));
          return;
      }
      const cleanCommande: Partial<Commande> = {
           fournisseur: newCommandeFournisseurId ? normalizeNumberInput(newCommandeFournisseurId) : undefined,
           numero_facture: numeroFacture,
           type: commandeType,
           taux_change: commandeType === 'DIR' ? tauxChange : undefined,
           frais_coefficient: commandeType === 'DIR' ? fraisCoefficient : undefined,
           is_mise_en_place: isMiseEnPlace,
           delai_paiement_negocie_jours: isMiseEnPlace && delaiPaiementNegocieJours.trim()
             ? Number(delaiPaiementNegocieJours)
             : null,
           paye_a_la_cloture: isMiseEnPlace && payeALaCloture,
      };
      const mode = (viewMode === 'CREATE' ? 'CREATE' : 'EDIT') as 'CREATE' | 'EDIT';
      handleSaveCommande(cleanCommande, commandeProduits, mode, selectedCommande);
  };

  const {
      onCloture,
      onDelete,
      onMettreEnAttente,
      onAnnulerReception,
      onImprimer,
      onBulkDelete,
      handleCreateAvoirFromCommande,
  } = useCommandeHandlers({
      selectedCommande,
      commandeProduits,
      selectedRows,
      viewMode,
      newCommandeFournisseurId,
      numeroFacture,
      commandeType,
      tauxChange,
      fraisCoefficient,
      commandes,
      selectedOrderIds,
      setSelectedOrderIds,
      setSelectedRows,
      setCommandeProduits,
      handleSaveCommande,
      handleCloturerCommande,
      handleDeleteCommande,
      handleMettreEnAttente,
      handleAnnulerReception,
      handleImprimerReception,
      handleBulkDelete,
      queryClient,
      confirm,
      requireSudo,
      navigate,
      t,
  });

  // Calcul des totaux de la commande (Edition ou Consultation)
  const orderTotals = useCommandeTotals(commandeProduits, selectedCommande);

  useCommandeAutosave({
    state: {
      commandeProduits,
      newCommandeFournisseurId,
      numeroFacture,
      isMiseEnPlace,
      delaiPaiementNegocieJours,
      payeALaCloture,
      commandeType,
      tauxChange,
      fraisCoefficient,
      selectedCommande,
      viewMode,
      isImporting,
    },
    setSaving,
    handleSaveCommande,
  });

  useCommandeRecalc({
      commandeType,
      viewMode,
      tauxChange,
      fraisCoefficient,
      setCommandeProduits,
  });

  useCommandeKeyboard({
      viewMode,
      commandeProduits,
      selectedRows,
      setCommandeProduits,
      setSelectedRows,
  });

  const { handleKeyDown: handleSearchKeyDown, getItemProps } = useSearchNavigation(
    filteredProduits,
    selectProduct,
    { resetOnSelect: true, searchInputRef }
  );


  function handleProduitCreated(produit: ProduitModel) {
    selectProduct(produit);
    setSearchProduitQuery(produit.name.substring(0, 3));
    setIsCreateProduitModalOpen(false);
  }

  const handleSortChange = useCallback((key: 'numero' | 'date' | 'fournisseur' | 'status') => {
    if (key === sortKey) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortOrder('desc'); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey]);

  // Map mémoïsé pour éviter les fournisseurs.find() répétés dans le tri (O(1) au lieu de O(n) par comparaison)
  const fournisseurNameMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const f of fournisseurs) map.set(f.id, f.name);
    return map;
  }, [fournisseurs]);

  const sortedCommandes = useMemo(() => {
    let filtered = commandes;
    if (filterStatus !== 'ALL') filtered = filtered.filter(c => c.status === filterStatus);

    // Recherche par numero_facture ou ID
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(c => {
        const numFact = (c.numero_facture || '').toLowerCase();
        const idStr = String(c.id);
        return numFact.includes(q) || idStr.includes(q);
      });
    }

    return filtered.slice().sort((a, b) => {
      let valA, valB;
      if (sortKey === 'numero') { valA = a.numero_facture || a.id; valB = b.numero_facture || b.id; }
      else if (sortKey === 'date') { valA = a.date; valB = b.date; }
      else if (sortKey === 'fournisseur') {
        const fA = fournisseurNameMap.get(a.fournisseur) || '';
        const fB = fournisseurNameMap.get(b.fournisseur) || '';
        valA = fA.toLowerCase(); valB = fB.toLowerCase();
      } else if (sortKey === 'status') {
        valA = statusOrder[a.status] || 99; valB = statusOrder[b.status] || 99;
      }
      if (valA! < valB!) return sortOrder === 'asc' ? -1 : 1;
      if (valA! > valB!) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [commandes, sortKey, sortOrder, fournisseurNameMap, filterStatus, searchQuery]);




  return {
    state: {
      activeTab, setActiveTab,
      commandeType, setCommandeType,
      forcedType,
      error,
      viewMode,
      selectedCommande,
      isSuggestionModalOpen, setIsSuggestionModalOpen,
      isCreateProduitModalOpen, setIsCreateProduitModalOpen,
      showPrintLabelsModal, setShowPrintLabelsModal,
      sudoState, closeSudo,
      isTransferModalOpen, setIsTransferModalOpen,
      isMergeModalOpen, setIsMergeModalOpen,
      isSchedulingModalOpen, setIsSchedulingModalOpen,
      t
    },
    listProps: {
      sortedCommandes,
      fournisseurs: filteredFournisseurs,
      loading,
      totalCount,
      statusCounts,
      page,
      totalPages,
      onPageChange: setPage,
      sortKey,
      sortOrder,
      onSortChange: handleSortChange,
      filterStatus,
      onFilterStatusChange: setFilterStatus,
      searchQuery,
      onSearchQueryChange: setSearchQuery,
      selectedOrderIds,
      onToggleOrderSelection: toggleOrderSelection,
      onToggleAllOrdersSelection: toggleAllOrdersSelection,
      canMerge: canMergeSelectedOrders().canMerge,
      onOpenMergeModal: openMergeModal,
      onOpenCreateView: () => openCreateView(activeTab),
      onOpenSuggestionModal: () => {
        console.log('onOpenSuggestionModal called, setting isSuggestionModalOpen to true');
        setIsSuggestionModalOpen(true);
      },
      onViewDetails: handleViewDetails,
      onBulkDelete,
    },
    detailsProps: {
      commande: selectedCommande,
      fournisseurs: filteredFournisseurs,
      produitsList,
      executingAction,
      onBack: handleBackToList,
      onEdit: openEditView,
      onMettreEnAttente: (viewMode === 'EDIT' || viewMode === 'DETAILS') ? onMettreEnAttente : undefined,
      onCloture: (viewMode === 'EDIT' || viewMode === 'DETAILS') ? onCloture : undefined,
      onDelete,
      onImprimer,
      onAnnulerReception,
      onCreateAvoir: handleCreateAvoirFromCommande,
      onOpenLabelsModal: () => setShowPrintLabelsModal(true),
      selectedRows,
      toggleRowSelection,
      setSelectedRows,
      orderTotals,
    },
    formProps: {
      viewMode: viewMode as 'CREATE' | 'EDIT' | 'DETAILS',
      selectedCommande,
      fournisseurs: filteredFournisseurs,
      newCommandeFournisseurId,
      setNewCommandeFournisseurId,
      numeroFacture,
      setNumeroFacture,
      isMiseEnPlace,
      setIsMiseEnPlace,
      delaiPaiementNegocieJours,
      setDelaiPaiementNegocieJours,
      payeALaCloture,
      setPayeALaCloture,
      commandeType,
      tauxChange,
      setTauxChange,
      fraisCoefficient,
      setFraisCoefficient,
      handleBackToList,
      handleSaveCommande: onSave,
      handleCsvExport,
      handleCsvImport,
      fileInputRef,
      setIsCreateProduitModalOpen,
      searchInputRef,
      fournisseurSelectRef,
      searchProduitQuery,
      setSearchProduitQuery,
      handleSearchKeyDown,
      filteredProduits,
      searchLoading,
      selectProduct,
      getItemProps,
      commandeProduits,
      pendingDuplicateProduct,
      setPendingDuplicateProduct,
      handleDuplicateAddNewLine,
      handleDuplicateIncrementExisting,
      produitsList,
      selectedRows,
      orderTotals,
      saving: saving || executingAction,
      fieldsConfig,
      focusedField,
      toggleRowSelection,
      toggleAllRows,
      deleteSelectedRows,
      openTransferModal,
      updateCommandeProduitField,
      handleSellingPriceBlur,
      handleTableFieldKeyDown,
      onRemoveProduct: removeProductFromCommande,
      onCreateAvoir: handleCreateAvoirFromCommande,
      commandeSortBy,
      onSortProduits: handleSortProduits,
      onCloture: (viewMode === 'EDIT' || viewMode === 'DETAILS') ? onCloture : undefined,
      onMettreEnAttente: (viewMode === 'EDIT' || viewMode === 'DETAILS') ? onMettreEnAttente : undefined,
      executingAction,
    },
    modals: {
      handleApplySuggestions,
      fournisseurs: filteredFournisseurs,
      produitsList,
      produitsEndpoint,
      handleProduitCreated,
      rayons,
      formes,
      t,
      commandeProduits,
      selectedRows,
      newCommandeFournisseurId,
      commandesEndpoint,
      fournisseursEndpoint,
      handleTransferSuccess,
      selectedOrderIds,
      handleMergeSuccess,
    },
    reconditionnement,
  };
}
