import { useEffect, useMemo, type FormEvent, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useConfirm } from './useConfirm';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSudo } from './useSudo';
import { useCommandes, useCommandeFournisseurs, useCommandeRayons } from './useCommandes';
import { useCommandeActions } from './useCommandeActions';
import { useSearchNavigation } from './useSearchNavigation';
import type { Commande, CommandeProduit, ProduitModel } from '../types';
import { normalizeNumberInput } from '../utils/formatters';
import commandeService from '../services/commandeService';
import produitService from '../services/produitService';
import api from '../services/api';
import { useProductSearch } from './useProductSearch';
import { usePharmacySettings } from './usePharmacySettings';
import { useFormes } from './useProduits';
import { useCommandesStore } from '../stores/useCommandesStore';

function formatDateToMMYY(isoDate: string | null | undefined): string {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
        return `${parts[1]}/${parts[0].slice(-2)}`;
    }
    return '';
}

// Parse et formate le prix du CSV : "1988.0", "1988.0000", "1 988,50" → "1988" ou "1988.50"
function parseCsvPrice(value: string | undefined): string | null {
    if (!value || value.trim() === '') return null;
    
    // Nettoyer : enlever espaces, remplacer virgule par point
    const cleaned = value.trim()
        .replace(/\s/g, '')           // Enlever espaces
        .replace(/,/g, '.');          // Remplacer virgule par point
    
    const num = parseFloat(cleaned);
    if (isNaN(num)) return null;
    
    // Formater : si entier, pas de décimale; sinon max 2 décimales
    if (Number.isInteger(num)) {
        return num.toString();
    }
    return num.toFixed(2).replace(/\.00$/, '');  // "1988.00" → "1988"
}

// Normalise le texte pour comparaison fuzzy (enlève accents, passe en minuscules)
function normalizeText(value: string | null | undefined): string {
    if (!value) return '';
    return value
        .normalize('NFD')                    // Décompose les accents
        .replace(/[\u0300-\u036f]/g, '')    // Enlève les accents
        .toLowerCase()                      // Minuscules
        .trim();                            // Espaces
}

// Calcule le score de similarité entre deux noms (0-100%)
// Basé sur les tokens/mots communs avec vérification stricte
function calculateNameScore(csvName: string, dbName: string): number {
    // Ignorer les codes/numéros (CIP, dosage, etc.)
    const csvTokens = normalizeText(csvName)
        .split(/\s+/)
        .filter(t => t.length >= 3 && !/^\d/.test(t) && !/^(mg|ml|g|mcg|ui|cp|cpr|inj|sol)$/.test(t));
    const dbTokens = normalizeText(dbName)
        .split(/\s+/)
        .filter(t => t.length >= 3 && !/^\d/.test(t) && !/^(mg|ml|g|mcg|ui|cp|cpr|inj|sol)$/.test(t));
    
    if (csvTokens.length === 0 || dbTokens.length === 0) return 0;
    
    let exactMatches = 0;     // Match exact (prioritaire)
    let partialMatches = 0;   // Match partiel (début de mot)
    const usedDbTokens = new Set<number>();
    
    for (const csvToken of csvTokens) {
        let found = false;
        
        for (let i = 0; i < dbTokens.length; i++) {
            if (usedDbTokens.has(i)) continue;
            const dbToken = dbTokens[i];
            
            // Correspondance EXACTE (poids fort) : "loolip" = "loolip"
            if (csvToken === dbToken) {
                exactMatches++;
                usedDbTokens.add(i);
                found = true;
                break;
            }
        }
        
        if (found) continue;
        
        // Correspondance PARTIELLE (poids faible) : "lool" dans "loolip"
        for (let i = 0; i < dbTokens.length; i++) {
            if (usedDbTokens.has(i)) continue;
            const dbToken = dbTokens[i];
            
            // Minimum 4 caractères pour un match partiel (évite "cp" qui match tout)
            if (csvToken.length >= 4 && dbToken.startsWith(csvToken)) {
                partialMatches += 0.5;  // Demi-point pour partiel
                usedDbTokens.add(i);
                break;
            }
            if (dbToken.length >= 4 && csvToken.startsWith(dbToken)) {
                partialMatches += 0.5;
                usedDbTokens.add(i);
                break;
            }
        }
    }
    
    // Score pondéré : exact = 1.0, partiel = 0.5
    const totalScore = exactMatches + partialMatches;
    const maxPossible = csvTokens.length;
    const percentage = (totalScore / maxPossible) * 100;
    
    // Pénalité si peu de tokens CSV (risque de faux positif)
    if (csvTokens.length === 1 && exactMatches < 1) return 0;      // 1 token doit être exact
    if (csvTokens.length === 2 && exactMatches < 1) return 0;        // 2 tokens : au moins 1 exact
    
    return percentage;
}

export function useCommandesState(forcedType?: 'LOC' | 'DIR' | 'DIV') {
  const confirm = useConfirm()
  const { t } = useTranslation(['orders', 'common', 'products']);
  const { user } = useAuth();
  const navigate = useNavigate(); 
  const location = useLocation(); 
  const selectedCommande = useCommandesStore((s) => s.selectedCommande);
  const setSelectedCommande = useCommandesStore((s) => s.setSelectedCommande);

  const { settings: pharmacySettings } = usePharmacySettings();
  const activeTab = useCommandesStore((s) => s.activeTab);
  const setActiveTab = useCommandesStore((s) => s.setActiveTab);
  const commandeType = useCommandesStore((s) => s.commandeType);
  const setCommandeType = useCommandesStore((s) => s.setCommandeType);

  useEffect(() => {
    if (forcedType) {
        setActiveTab(forcedType);
        setCommandeType(forcedType);
    }
  }, [forcedType]);
  
  const viewMode = useCommandesStore((s) => s.viewMode);
  const setViewMode = useCommandesStore((s) => s.setViewMode);

  const isSchedulingModalOpen = useCommandesStore((s) => s.isSchedulingModalOpen);
  const setIsSchedulingModalOpen = useCommandesStore((s) => s.setIsSchedulingModalOpen);

  useEffect(() => {
    const openDetailsId = location.state?.openDetailsId;
    if (openDetailsId) {
      const fetchAndShow = async () => {
        try {
          const data = await commandeService.getById(Number(openDetailsId));
          setSelectedCommande(data);
          setViewMode('DETAILS');
        } catch (err) {
          console.error("Erreur lors du chargement de la commande via navigation:", err);
          toast.error(t('orders:messages.details_load_error'));
        } finally {
          navigate(location.pathname, { replace: true, state: {} });
        }
      };
      fetchAndShow();
    }
  }, [location.state, navigate, t]);

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

  const { 
    data: commandesData, 
    isLoading: loading, 
    error: loadError,
    refetch: refetchCommandes 
  } = useCommandes({ page, type: activeTab, status: filterStatus });
  
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
  const pageSize = commandesData?.results?.length || 20;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const error = loadError ? (loadError as Error).message : null;

  const numeroFacture = useCommandesStore((s) => s.numeroFacture);
  const setNumeroFacture = useCommandesStore((s) => s.setNumeroFacture);
  const commandeProduits = useCommandesStore((s) => s.commandeProduits);
  const setCommandeProduits = useCommandesStore((s) => s.setCommandeProduits);
  const commandeSortBy = useCommandesStore((s) => s.commandeSortBy);
  const setCommandeSortBy = useCommandesStore((s) => s.setCommandeSortBy);

  const { 
    produits: produitsList, 
    searchQuery: searchProduitQuery,
    setSearchQuery: setSearchProduitQuery,
    refetch: refetchProduits
  } = useProductSearch({ minSearchLength: 2, debounceMs: 200 })
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fournisseurSelectRef = useRef<HTMLSelectElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); 

  const selectedRows = useCommandesStore((s) => s.selectedRows);
  const setSelectedRows = useCommandesStore((s) => s.setSelectedRows);
  const focusedField = useCommandesStore((s) => s.focusedField);
  const setFocusedField = useCommandesStore((s) => s.setFocusedField);

  const sortKey = useCommandesStore((s) => s.sortKey);
  const setSortKey = useCommandesStore((s) => s.setSortKey);
  const sortOrder = useCommandesStore((s) => s.sortOrder);
  const setSortOrder = useCommandesStore((s) => s.setSortOrder);
  const showPrintLabelsModal = useCommandesStore((s) => s.showPrintLabelsModal);
  const setShowPrintLabelsModal = useCommandesStore((s) => s.setShowPrintLabelsModal);

  const isImporting = useCommandesStore((s) => s.isImporting);
  const setIsImporting = useCommandesStore((s) => s.setIsImporting);
  const isCreateProduitModalOpen = useCommandesStore((s) => s.isCreateProduitModalOpen);
  const setIsCreateProduitModalOpen = useCommandesStore((s) => s.setIsCreateProduitModalOpen);

  const isSuggestionModalOpen = useCommandesStore((s) => s.isSuggestionModalOpen);
  const setIsSuggestionModalOpen = useCommandesStore((s) => s.setIsSuggestionModalOpen);
  const isTransferModalOpen = useCommandesStore((s) => s.isTransferModalOpen);
  const setIsTransferModalOpen = useCommandesStore((s) => s.setIsTransferModalOpen);

  const selectedOrderIds = useCommandesStore((s) => s.selectedOrderIds);
  const setSelectedOrderIds = useCommandesStore((s) => s.setSelectedOrderIds);
  const isMergeModalOpen = useCommandesStore((s) => s.isMergeModalOpen);
  const setIsMergeModalOpen = useCommandesStore((s) => s.setIsMergeModalOpen);

  const filteredProduits = useMemo(() => {
    if (!searchProduitQuery) return [];
    const q = searchProduitQuery.toLowerCase();
    return produitsList.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.cip1 && p.cip1.includes(q)) || 
      (p.cip2 && p.cip2.includes(q))
    ).slice(0, 10);
  }, [produitsList, searchProduitQuery]);

  const {
      handleSaveCommande,
      handleDeleteCommande,
      handleCloturerCommande,
      handleMettreEnAttente,
      handleAnnulerReception,
      handleImprimerReception,
      handleBulkDelete,
      executingAction,
  } = useCommandeActions({
      fetchCommandes: async () => { await refetchCommandes(); },
      setSelectedCommande,
      setViewMode,
      confirm: confirm as any, 
      user
  });

  const { sudoState, requireSudo, closeSudo } = useSudo();
  const saving = useCommandesStore((s) => s.saving);
  const setSaving = useCommandesStore((s) => s.setSaving);

  useEffect(() => {
      setSelectedRows(new Set());
  }, [selectedCommande]);

  // Removed useEffect that sets selectedCommande to null if not in list.
  // This caused 'messages.no_selection' after an autosave because the newly created command
  // was not yet in the 'commandes' page array, forcing selectedCommande to null while in EDIT mode.

  const onSave = (e: FormEvent) => {
      e.preventDefault();
      if (commandeProduits.length === 0) {
          toast.error(t('orders:messages.add_at_least_one'));
          return;
      }
      const cleanCommande: Partial<Commande> = {
           fournisseur: newCommandeFournisseurId ? normalizeNumberInput(newCommandeFournisseurId) : undefined,
           numero_facture: numeroFacture,
           type: commandeType,
           taux_change: commandeType === 'DIR' ? tauxChange : undefined,
           frais_coefficient: commandeType === 'DIR' ? fraisCoefficient : undefined,
      };
      const mode = (viewMode === 'CREATE' ? 'CREATE' : 'EDIT') as 'CREATE' | 'EDIT';
      handleSaveCommande(cleanCommande, commandeProduits, mode, selectedCommande);
  };

   const onCloture = async () => {
      if (!selectedCommande) return;

      const confirmed = await confirm({
          title: t('orders:details.close'),
          message: t('orders:messages.close_confirm', { defaultValue: 'Voulez-vous vraiment clôturer cette commande ?' }),
          confirmText: t('common:confirm')
      });

      if (confirmed) {
          requireSudo(
              async (validatorId, password) => {
                  await handleCloturerCommande(selectedCommande, { 
                      validated_by_id: validatorId, 
                      sudo_password: password 
                  });
                  refetchProduits();
              },
              { 
                  permission: 'can_close_commande',
                  title: t('orders:messages.confirm_sudo_title'),
                  message: t('orders:messages.confirm_sudo_message')
              }
          );
      }
  }

  const onDelete = () => {
      if (!selectedCommande) return;

      requireSudo(
          (validatorId, password) => handleDeleteCommande(selectedCommande, { 
              validated_by_id: validatorId, 
              sudo_password: password 
          }),
          { 
              permission: 'can_delete_commande',
              title: t('orders:messages.confirm_sudo_title'),
              message: t('orders:messages.confirm_sudo_message')
          }
      );
  };

  const onMettreEnAttente = () => {
      if (selectedCommande) handleMettreEnAttente(selectedCommande);
  }

  const onAnnulerReception = () => {
      if (!selectedCommande) return;
      requireSudo(
          (validatorId, password) => handleAnnulerReception(selectedCommande, { 
              validated_by_id: validatorId, 
              sudo_password: password 
          }),
          { 
              permission: 'can_close_commande',
              title: t('orders:messages.confirm_sudo_title'),
              message: t('orders:messages.confirm_sudo_message')
          }
      );
  }

  const onImprimer = (fournisseurName: string) => {
     if (selectedCommande) handleImprimerReception(selectedCommande, fournisseurName);
  }

  // Calcul des totaux de la commande (Edition ou Consultation)
  const orderTotals = useMemo(() => {
    let totalTVA = 0;
    let totalTTC = 0;
    let totalBuyHT = 0;
    let totalSellHT = 0;
    
    // On prend soit la liste éditable, soit les produits de la commande sélectionnée
    const productsToCalc = (commandeProduits.length > 0) 
      ? commandeProduits 
      : (selectedCommande?.produits || []);

    productsToCalc.forEach(item => {
      const qty = normalizeNumberInput(String(item.quantity || 0));
      const buyPriceHT = normalizeNumberInput(String(item.price || 0));
      const sellPriceTTC = normalizeNumberInput(String(item.selling_price || 0));
      const tvaRate = normalizeNumberInput(String(item.tva || 0));

      const lineBuyHT = qty * buyPriceHT;
      const lineSellTTC = qty * sellPriceTTC;
      const lineSellHT = lineSellTTC / (1 + tvaRate / 100);
      const lineTVA = lineSellTTC - lineSellHT;

      totalBuyHT += lineBuyHT;
      totalSellHT += lineSellHT;
      totalTVA += lineTVA;
      totalTTC += lineSellTTC;
    });

    const globalMargin = totalBuyHT > 0 ? (totalSellHT / totalBuyHT) : 0;
    const globalMarginPercent = totalSellHT > 0 ? ((totalSellHT - totalBuyHT) / totalSellHT * 100) : 0;
    const totalMarginValue = totalSellHT - totalBuyHT;

    return {
      totalHT: totalSellHT,
      totalTVA,
      totalTTC,
      totalBuyHT,
      totalMarginValue,
      globalMargin: globalMargin.toFixed(4),
      globalMarginPercent: globalMarginPercent.toFixed(2)
    };
  }, [commandeProduits, selectedCommande]);

  const onBulkDelete = () => {
    if (selectedOrderIds.size === 0) return;

    const selectedIds = Array.from(selectedOrderIds);
    // Filtrer les commandes qui ne sont pas clôturées
    const deletableIds = selectedIds.filter(id => {
        const cmd = commandes.find(c => c.id === id);
        return cmd && cmd.status !== 'CLOT';
    });

    if (deletableIds.length === 0) {
        toast.error(t('orders:messages.no_deletable_orders'));
        return;
    }

    if (deletableIds.length < selectedIds.length) {
        toast.error(t('orders:messages.some_orders_closed_warning'));
    }

    requireSudo(
        async (validatorId, password) => {
            await handleBulkDelete(deletableIds, {
                validated_by_id: validatorId,
                sudo_password: password
            });
            setSelectedOrderIds(new Set());
        },
        {
            permission: 'can_delete_commande',
            title: t('orders:messages.confirm_sudo_title'),
            message: t('orders:messages.confirm_sudo_message')
        }
    );
  };

  const handleCreateAvoirFromCommande = () => {
    if (!selectedCommande) return;
    
    const produitsSource = selectedCommande.produits || [];
    const produitsAvoir = (selectedRows.size > 0 
        ? produitsSource.filter((_, idx) => selectedRows.has(idx))
        : produitsSource
    ).map(p => ({
            id: typeof p.produit === 'object' ? (p.produit as any).id : p.produit,
            name: (p as any).produit_nom,
            cip: (typeof p.produit === 'object' ? (p.produit as any).cip1 : (p as any).produit_cip) || '',
            purchase_price: p.price, 
            quantity: 0, 
            received_qty: p.quantity,
            lot: p.lot,
            expiration: p.date_expiration
        }));

    const avoirData = {
        fournisseur: selectedCommande.fournisseur,
        fournisseur_nom: selectedCommande.fournisseur_nom, 
        source_commande: selectedCommande.id,
        produits: produitsAvoir
    };

    navigate('/app/avoirs', { state: { createFromCommande: avoirData } });
  }

  const autoSaveStateRef = useRef({
    commandeProduits,
    newCommandeFournisseurId,
    numeroFacture,
    commandeType,
    tauxChange,
    fraisCoefficient,
    selectedCommande,
    viewMode,
    isImporting,
  });

  useEffect(() => {
    autoSaveStateRef.current = {
      commandeProduits,
      newCommandeFournisseurId,
      numeroFacture,
      commandeType,
      tauxChange,
      fraisCoefficient,
      selectedCommande,
      viewMode,
      isImporting,
    };
  });

  useEffect(() => {
    const interval = setInterval(async () => {
      const s = autoSaveStateRef.current;
      if (s.isImporting) return;
      if (s.viewMode !== 'CREATE' && s.viewMode !== 'EDIT') return;
      if (s.commandeProduits.length === 0 || !s.newCommandeFournisseurId) return;

      setSaving(true);
      try {
        const cleanCommande: Partial<Commande> = {
          fournisseur: normalizeNumberInput(s.newCommandeFournisseurId),
          numero_facture: s.numeroFacture,
          type: s.commandeType,
          taux_change: s.commandeType === 'DIR' ? s.tauxChange : undefined,
          frais_coefficient: s.commandeType === 'DIR' ? s.fraisCoefficient : undefined,
        };
        const mode = (s.viewMode === 'CREATE' ? 'CREATE' : 'EDIT') as 'CREATE' | 'EDIT';
        await handleSaveCommande(cleanCommande, s.commandeProduits, mode, s.selectedCommande, true);
      } catch (err) {
        console.error("Auto-save error:", err);
      } finally {
        setSaving(false);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [handleSaveCommande]);

  const lastRecalcRef = useRef<{ taux: string; coeff: string }>({ taux: '', coeff: '' });
  const recalcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
      if (commandeType === 'DIR' && viewMode === 'CREATE') {
          const rate = normalizeNumberInput(tauxChange || '0');
          const coeff = normalizeNumberInput(fraisCoefficient || '0');
          
          if (!rate || !coeff) return;
          
          if (lastRecalcRef.current.taux === tauxChange && lastRecalcRef.current.coeff === fraisCoefficient) {
              return;
          }
          
          if (recalcTimeoutRef.current) clearTimeout(recalcTimeoutRef.current);
          
          recalcTimeoutRef.current = setTimeout(() => {
              lastRecalcRef.current = { taux: tauxChange, coeff: fraisCoefficient };
              
              setCommandeProduits(prev => {
                  if (!prev.some(item => item.prix_euro)) return prev;
                  
                  let hasChanges = false;
                  const updated = prev.map(item => {
                      if (item.prix_euro) {
                          const pEuro = normalizeNumberInput(String(item.prix_euro));
                          if (!isNaN(pEuro)) {
                              const priceFCFA = pEuro * rate;
                              const costPrice = priceFCFA * coeff;
                              const newPrice = Math.round(costPrice).toString();
                              
                              const currentMargin = normalizeNumberInput(String(item.marge || 1.3));
                              const newSelling = Math.round(costPrice * currentMargin).toString();

                              if (item.price !== newPrice || item.selling_price !== newSelling) {
                                  hasChanges = true;
                                  return { ...item, price: newPrice, selling_price: newSelling };
                              }
                          }
                      }
                      return item;
                  });
                  return hasChanges ? updated : prev;
              });
          }, 500); 
      }
      
      return () => {
          if (recalcTimeoutRef.current) clearTimeout(recalcTimeoutRef.current);
      };
  }, [tauxChange, fraisCoefficient, commandeType, viewMode]);

  useEffect(() => {
    if (location.state && (location.state as any).createFromStockAlert) {
      const data = (location.state as any).createFromStockAlert;
      setViewMode('CREATE');
      setSelectedCommande(null);
      setCommandeProduits([]);
      
      const loadProducts = async () => {
        if (!Array.isArray(data.products) || data.products.length === 0) return;

        const newLines = await Promise.all(
          data.products.map(async (p: { id: number; name: string; stock: number; avg_daily_sales?: number }) => {
            try {
              const fullProduct = await produitService.getById(p.id);
              const avgSales = (p as any).avg_daily_sales;
              const coverageDays = 30;
              const suggestedQty = avgSales && avgSales > 0
                ? Math.max(1, Math.ceil(avgSales * coverageDays) - (fullProduct.stock || 0))
                : Math.max(1, (fullProduct.stock_minimum || 10) - (fullProduct.stock || 0));

              return {
                id: Date.now() + p.id,
                produit: fullProduct,
                quantity: suggestedQty,
                unites_gratuites: 0,
                price: fullProduct.cost_price || '0',
                tva: fullProduct.tva || '0',
                marge: fullProduct.taux_marge || '1.3',
                selling_price: fullProduct.selling_price || '0',
                lot: '',
                date_expiration: '',
              };
            } catch (err) {
              console.error(`Failed to fetch product ${p.id}:`, err);
              return {
                id: Date.now() + p.id,
                produit: { id: p.id, name: p.name, stock: p.stock } as any,
                quantity: 10,
                unites_gratuites: 0,
                price: '0',
                tva: '0',
                marge: '1.3',
                selling_price: '0',
                lot: '',
                date_expiration: '',
              };
            }
          })
        );
        setCommandeProduits(newLines);

        // Pré-sélectionner le fournisseur du premier produit qui en a un
        const firstWithFournisseur = newLines.find(
          l => l.produit && typeof l.produit === 'object' && (l.produit as any).fournisseur
        );
        if (firstWithFournisseur) {
          const fId = (firstWithFournisseur.produit as any).fournisseur;
          setNewCommandeFournisseurId(String(fId));
        }

        toast.success(t('orders:messages.products_added_from_alerts', { count: newLines.length }), { icon: '📦' });
      };
      
      loadProducts();
      window.history.replaceState({}, document.title);
    }
  }, [location.state, commandeType, tauxChange, fraisCoefficient, t]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
      if (e.key === 'Delete' && !isInput && selectedRows.size > 0) {
        e.preventDefault();
        setCommandeProduits(prev => prev.filter((_, i) => !selectedRows.has(i)));
        setSelectedRows(new Set());
        return;
      }
      
      if (e.key === 'Escape' && !isInput) {
        if (viewMode === 'CREATE' || viewMode === 'EDIT') {
          // handleBackToList();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [viewMode, commandeProduits, selectedRows])

  const { handleKeyDown: handleSearchKeyDown, getItemProps } = useSearchNavigation(
    filteredProduits,
    selectProduct,
    { resetOnSelect: true, searchInputRef }
  );

  const fieldsConfig = [
    { name: 'quantity', editable: true },
    { name: 'unites_gratuites', editable: true }, 
    ...(commandeType === 'DIR' ? [{ name: 'prix_euro', editable: true }] : []),
    { name: 'price', editable: true },
    { name: 'tva', editable: true },
    { name: 'marge', editable: true },
    { name: 'selling_price', editable: true }, 
    { name: 'lot', editable: true },
    { name: 'date_expiration', editable: true },
  ];

  function handleTableFieldKeyDown(e: React.KeyboardEvent, rowIndex: number, fieldIndex: number) {
    const moveToNextField = () => {
        if (commandeType === 'DIR' && fieldIndex === 1) {
            setTimeout(() => {
                const euroInput = document.querySelector(`input[data-row="${rowIndex}"][data-field="prix_euro"]`) as HTMLInputElement;
                euroInput?.focus();
                euroInput?.select();
            }, 0);
            return;
        }

        let nextFieldIndex = fieldIndex + 1;
        while (nextFieldIndex < fieldsConfig.length && !fieldsConfig[nextFieldIndex].editable) nextFieldIndex++;

        if (nextFieldIndex < fieldsConfig.length) {
            setFocusedField({ row: rowIndex, field: nextFieldIndex });
            setTimeout(() => {
                const nextInput = document.querySelector(`input[data-row="${rowIndex}"][data-field="${fieldsConfig[nextFieldIndex].name}"]`) as HTMLInputElement;
                nextInput?.focus();
                nextInput?.select(); 
            }, 0);
        } else {
             setFocusedField(null);
             setTimeout(() => {
                 searchInputRef.current?.focus();
             }, 0);
        }
    };

    const moveToPreviousField = () => {
        let prevFieldIndex = fieldIndex - 1;
        while (prevFieldIndex >= 0 && !fieldsConfig[prevFieldIndex].editable) prevFieldIndex--;

        if (prevFieldIndex >= 0) {
            setFocusedField({ row: rowIndex, field: prevFieldIndex });
            setTimeout(() => {
                const prevInput = document.querySelector(`input[data-row="${rowIndex}"][data-field="${fieldsConfig[prevFieldIndex].name}"]`) as HTMLInputElement;
                prevInput?.focus();
                prevInput?.select(); 
            }, 0);
        }
    };

    switch (e.key) {
      case 'Enter': e.preventDefault(); moveToNextField(); break;
      case 'Tab': e.preventDefault(); if (e.shiftKey) moveToPreviousField(); else moveToNextField(); break;
      case 'ArrowDown':
        e.preventDefault();
        if (rowIndex < commandeProduits.length - 1) {
          const nextRow = rowIndex + 1;
          const fieldName = fieldsConfig[fieldIndex]?.name;
          if (fieldName) {
            setFocusedField({ row: nextRow, field: fieldIndex });
            setTimeout(() => {
                const query = `input[data-row="${nextRow}"][data-field="${fieldName}"]`;
                const nextInput = document.querySelector(query) as HTMLInputElement;
                if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                }
            }, 10);
          }
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (rowIndex > 0) {
          const prevRow = rowIndex - 1;
          const fieldName = fieldsConfig[fieldIndex]?.name;
          if (fieldName) {
            setFocusedField({ row: prevRow, field: fieldIndex });
            setTimeout(() => {
                const query = `input[data-row="${prevRow}"][data-field="${fieldName}"]`;
                const prevInput = document.querySelector(query) as HTMLInputElement;
                if (prevInput) {
                    prevInput.focus();
                    prevInput.select();
                }
            }, 10);
          }
        }
        break;
      case 'Delete':
        const input = e.target as HTMLInputElement;
        const isFullySelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;
        const isEmpty = input.value === '';
        
        if (e.ctrlKey || isFullySelected || isEmpty) {
            e.preventDefault();
            removeProductFromCommande(rowIndex);
            toast.success(t('products:messages.delete_success', { defaultValue: 'Produit retiré' }), { icon: '🗑️', duration: 1000 });
            
            setTimeout(() => {
                const nextRow = Math.min(rowIndex, commandeProduits.length - 1);
                if (nextRow >= 0) {
                    const fieldName = fieldsConfig[fieldIndex]?.name;
                    const nextInput = document.querySelector(`input[data-row="${nextRow}"][data-field="${fieldName}"]`) as HTMLInputElement;
                    nextInput?.focus();
                    nextInput?.select();
                } else {
                    searchInputRef.current?.focus();
                }
            }, 50);
        }
        break;
      case 'ArrowRight': if (e.ctrlKey) { e.preventDefault(); moveToNextField(); } break;
      case 'ArrowLeft': if (e.ctrlKey) { e.preventDefault(); moveToPreviousField(); } break;
    }
  }

  async function selectProduct(product: ProduitModel) {
    if (product.is_supplier_exclusive) {
        let currentSupplierId: number | null = null;
        if (viewMode === 'CREATE' && newCommandeFournisseurId) {
            currentSupplierId = normalizeNumberInput(newCommandeFournisseurId);
        } else if ((viewMode === 'EDIT' || viewMode === 'DETAILS') && selectedCommande?.fournisseur) {
            currentSupplierId = selectedCommande.fournisseur;
        }

        if (currentSupplierId && product.fournisseur && currentSupplierId !== product.fournisseur) {
             const confirmed = await confirm({
                 title: t('orders:messages.exclusive_product_title'),
                 message: t('orders:messages.exclusive_product_message', { supplier: product.fournisseur_name }),
                 confirmText: t('orders:messages.exclusive_product_confirm'),
                 cancelText: t('common:cancel'),
                 variant: 'warning'
             });
             if (!confirmed) return;
        }
    }

    const existingIndex = commandeProduits.findIndex(
      p => (typeof p.produit === 'object' ? p.produit.id : p.produit) === product.id
    );

    if (existingIndex !== -1) {
      const newRowIndex = existingIndex;
      setFocusedField({ row: newRowIndex, field: 0 });
      const currentQty = normalizeNumberInput(String(commandeProduits[existingIndex].quantity || 0));
      updateCommandeProduitField(existingIndex, 'quantity', currentQty + 1);

      setTimeout(() => {
        const row = document.querySelector(`input[data-row="${newRowIndex}"]`);
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const quantityInput = document.querySelector(`input[data-row="${newRowIndex}"][data-field="${fieldsConfig[0].name}"]`) as HTMLInputElement;
        quantityInput?.focus();
      }, 50);

    } else {
      const newCommandeProduit: CommandeProduit = {
        id: Date.now(), 
        produit: product,
        quantity: 1,
        unites_gratuites: 0,  
        prix_euro: commandeType === 'DIR' ? (product.cost_price ? (normalizeNumberInput(product.cost_price) / normalizeNumberInput(tauxChange)).toFixed(0) : '0') : undefined,
        price: product.cost_price || '0',
        price_cost: product.cost_price || '0',
        tva: product.tva || '0',
        marge: product.taux_marge || '1.3',
        selling_price: product.selling_price || '0',
        lot: '',
        date_expiration: '',
      };
      
      setCommandeProduits(prev => [...prev, newCommandeProduit]);
      
      const newRowIndex = commandeProduits.length;
      setFocusedField({ row: newRowIndex, field: 0 });
      
      setTimeout(() => {
         const quantityInput = document.querySelector(`input[data-row="${newRowIndex}"][data-field="${fieldsConfig[0].name}"]`) as HTMLInputElement;
         quantityInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
         quantityInput?.focus();
         quantityInput?.select();
      }, 100);
    }
    setSearchProduitQuery('');
  }

  function removeProductFromCommande(index: number) {
    setCommandeProduits(prev => prev.filter((_, i) => i !== index));
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.delete(index);
      const adjusted = new Set<number>();
      next.forEach(idx => {
        if (idx < index) adjusted.add(idx);
        else if (idx > index) adjusted.add(idx - 1);
      });
      return adjusted;
    });
  }

  function toggleRowSelection(index: number) {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAllRows() {
    if (selectedRows.size === commandeProduits.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(commandeProduits.map((_, i) => i)));
  }

  function deleteSelectedRows() {
    setCommandeProduits(prev => prev.filter((_, i) => !selectedRows.has(i)));
    setSelectedRows(new Set());
  }

  function openTransferModal() {
    if (selectedRows.size === 0) {
      toast.error(t('orders:messages.transfer_select_products'));
      return;
    }
    setIsTransferModalOpen(true);
  }

  function handleTransferSuccess(_transferredCount: number, _supplierName: string, _newCommandeId: number) {
      setCommandeProduits(prev => prev.filter((_, idx) => !selectedRows.has(idx)));
      setSelectedRows(new Set());
      refetchCommandes();
      setIsTransferModalOpen(false);
  }

  function toggleOrderSelection(orderId: number) {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function toggleAllOrdersSelection() {
    if (selectedOrderIds.size === commandes.length && commandes.length > 0) setSelectedOrderIds(new Set());
    else setSelectedOrderIds(new Set(commandes.map(c => c.id)));
  }

  function canMergeSelectedOrders(): { canMerge: boolean; reason?: string; status?: string } {
    if (selectedOrderIds.size < 2) return { canMerge: false, reason: t('orders:messages.merge_select_two') };
    
    const selectedOrders = commandes.filter(c => selectedOrderIds.has(c.id));
    const statuses = new Set(selectedOrders.map(c => c.status));
    
    if (statuses.size > 1) return { canMerge: false, reason: t('orders:messages.merge_same_status') };
    
    const status = selectedOrders[0]?.status;
    if (status !== 'PREP') return { canMerge: false, reason: t('orders:messages.merge_only_prep', { defaultValue: 'Seules les commandes en préparation peuvent être fusionnées.' }) };
    
    return { canMerge: true, status };
  }

  function openMergeModal() {
    const { canMerge, reason } = canMergeSelectedOrders();
    if (!canMerge) {
      toast.error(reason || t('orders:messages.merge_impossible'));
      return;
    }
    setIsMergeModalOpen(true);
  }

  function handleMergeSuccess(mergedCount: number, targetOrderId: number) {
      setIsMergeModalOpen(false);
      setSelectedOrderIds(new Set());
      toast.success(t('orders:messages.merge_success_detailed', { count: mergedCount, id: targetOrderId }), { icon: '🤝' });
      refetchCommandes();
  }

  function updateCommandeProduitField(
    index: number,
    field: 'quantity' | 'unites_gratuites' | 'price' | 'tva' | 'marge' | 'selling_price' | 'lot' | 'date_expiration' | 'prix_euro',
    value: string | number
  ) {
    setCommandeProduits(prev => {
      const updatedList = prev.map((item, i) => {
        if (i === index) {
            const newItem = { ...item, [field]: value };
            
          if (commandeType === 'DIR' && field === 'prix_euro') {
               const pEuro = normalizeNumberInput(String(newItem.prix_euro || 0));
               const rate = normalizeNumberInput(tauxChange || '655.957'); 
               const coeff = normalizeNumberInput(fraisCoefficient || '1.0');

               if (!isNaN(pEuro) && !isNaN(rate)) {
                   let priceFCFA = pEuro * rate;
                   if (!isNaN(coeff)) priceFCFA = priceFCFA * coeff;
                   newItem.price = Math.round(priceFCFA).toString();
               }
          }

          if (field === 'price' || field === 'marge' || field === 'tva') {
               const price = normalizeNumberInput(String(newItem.price || 0));
               const marge = normalizeNumberInput(String(newItem.marge || 1));
               const tva = normalizeNumberInput(String(newItem.tva || 0));
               if (!isNaN(price) && !isNaN(marge) && price > 0) {
                   const sellingHT = price * marge;
                   const sellingTTC = sellingHT * (1 + tva / 100);
                   newItem.selling_price = Math.round(sellingTTC).toString();
               }
          }
          if (field === 'selling_price') {
               const price = normalizeNumberInput(String(newItem.price || 0));
               const selling = normalizeNumberInput(String(newItem.selling_price || 0));
               const tva = normalizeNumberInput(String(newItem.tva || 0));
               if (!isNaN(price) && !isNaN(selling) && price > 0) {
                   const sellingHT = selling / (1 + tva / 100);
                   newItem.marge = (sellingHT / price).toFixed(4); // Plus de précision
               }
          }
            return newItem;
        }
        return item;
      });

      const currentItem = updatedList[index];
      const currentProduitId = typeof currentItem.produit === 'object' ? currentItem.produit.id : currentItem.produit;
      const currentLot = (currentItem.lot || '').trim();

      if (field === 'lot' && currentLot !== '') {
          const targetIndex = updatedList.findIndex((item, i) => {
              if (i === index) return false;
              const pId = typeof item.produit === 'object' ? item.produit.id : item.produit;
              return pId === currentProduitId && (item.lot || '').trim() === currentLot;
          });

          if (targetIndex !== -1) {
              const targetItem = updatedList[targetIndex];
              const mergedQty = (targetItem.quantity || 0) + (currentItem.quantity || 0);
              const mergedUG = (targetItem.unites_gratuites || 0) + (currentItem.unites_gratuites || 0);
              
              const newList = updatedList.filter((_, i) => i !== index);
              const finalIndex = targetIndex > index ? targetIndex - 1 : targetIndex;
              newList[finalIndex] = {
                  ...newList[finalIndex],
                  quantity: mergedQty,
                  unites_gratuites: mergedUG
              };

              toast.success(t('orders:messages.lots_merged', { product: typeof currentItem.produit === 'object' ? currentItem.produit.name : 'produit' }), { icon: '🔄' });
              
              setTimeout(() => {
                const targetInput = document.querySelector(`input[data-row="${finalIndex}"][data-field="${fieldsConfig[0].name}"]`) as HTMLInputElement; 
                targetInput?.focus();
              }, 50);

              return newList;
          }
      }
      return updatedList;
    });
  }

  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    let allProducts: ProduitModel[] = [];
    try {
      const response = await api.get(produitsEndpoint);
      allProducts = response.data;
    } catch (err) {
      console.error("Failed to load products for import:", err);
      toast.error(t('orders:messages.import_load_error'));
      setIsImporting(false);
      return;
    }

    const normalizeCip = (cip: string | null | undefined): string => {
      if (!cip) return '';
      let normalized = cip.trim().replace(/[\s\-\.]/g, '');
      return normalized.toUpperCase();
    };

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setIsImporting(false);
        return;
      }

      const lines = text.split(/\r\n|\n/);
      let currentList = [...commandeProduits];
      let productsFound = 0;
      let productsNotFound = 0;
      const notFoundItems: { cip: string; qty: number }[] = [];

      let isFirstLine = true;
      lines.forEach(line => {
        if (!line.trim()) return;
        
        // Ignorer la ligne d'en-tête (contient "CIP/EAN13" ou "Libellé")
        if (isFirstLine) {
          isFirstLine = false;
          if (line.toLowerCase().includes('cip') || line.toLowerCase().includes('libell') || line.toLowerCase().includes('ean')) {
            return; // Skip header line
          }
        }
        
        // Parser les colonnes : CIP;Libellé;Qté commandée;UG;Qté livrée;Prix cession;Prix public
        const cols = line.split(';');
        const cip = cols[0];
        if (!cip) return;

        const qty = normalizeNumberInput(cols[4]) || 1;              // Colonne 5: Qté livrée (Qté commandée ignorée)
        const ug = normalizeNumberInput(cols[3]) || 0;              // Colonne 4: Qté UG
        const prixCession = parseCsvPrice(cols[5]);                    // Colonne 6: Prix cession
        const prixPublic = parseCsvPrice(cols[6]);                   // Colonne 7: Prix public

        const cleanCip = cip.trim();
        const normalizedSearchCip = normalizeCip(cleanCip);
        const libelle = cols[1] ? cols[1].trim() : '';  // Colonne 2: Libellé du produit
        const normalizedLibelle = normalizeText(libelle);

        // 1. Chercher par CIP
        let product = allProducts.find(p => {
          const norm1 = normalizeCip(p.cip1);
          const norm2 = normalizeCip(p.cip2);
          const norm3 = normalizeCip(p.cip3);
          
          if (norm1 === normalizedSearchCip || norm2 === normalizedSearchCip || norm3 === normalizedSearchCip) return true;
          
          const numericSearch = normalizedSearchCip.replace(/^0+/, '');
          if (numericSearch && (
            norm1.replace(/^0+/, '') === numericSearch ||
            norm2.replace(/^0+/, '') === numericSearch ||
            norm3.replace(/^0+/, '') === numericSearch
          )) return true;
          
          return false;
        });

        // 2. Si pas trouvé par CIP, chercher par nom avec scoring fuzzy
        if (!product && normalizedLibelle) {
          let bestMatch: ProduitModel | undefined = undefined;
          let bestScore = 0;
          const MIN_SCORE = 60; // Seuil minimum 60% de correspondance
          
          for (const p of allProducts) {
            const score = calculateNameScore(libelle, p.name);
            if (score > bestScore && score >= MIN_SCORE) {
              bestScore = score;
              bestMatch = p;
            }
          }
          
          if (bestMatch) {
            product = bestMatch;
            console.log(`[CSV Import] Produit trouvé par nom (${bestScore.toFixed(0)}%): "${libelle}" → "${product.name}"`);
          }
        }

        if (product) {
            productsFound++;
            const existingIndex = currentList.findIndex(
               p => (typeof p.produit === 'object' ? p.produit.id : p.produit) === product.id
            );

            // Prix : utiliser CSV si présent (déjà formaté en string), sinon système
            const priceFromSystem = product.cost_price || '0';
            
            const finalPrice = prixCession || priceFromSystem;
            const finalPriceCost = prixCession || priceFromSystem;
            
            // Prix public : utiliser CSV si présent, sinon système
            const finalSellingPrice = prixPublic || product.selling_price || '0';

            if (existingIndex !== -1) {
                const currentQty = normalizeNumberInput(String(currentList[existingIndex].quantity || 0));
                const currentUg = normalizeNumberInput(String(currentList[existingIndex].unites_gratuites || 0));
                currentList[existingIndex] = {
                    ...currentList[existingIndex],
                    quantity: currentQty + qty,
                    unites_gratuites: currentUg + ug,
                    // Mettre à jour les prix si fournis dans CSV
                    ...(prixCession && { price: finalPrice, price_cost: finalPriceCost }),
                    ...(prixPublic && { selling_price: finalSellingPrice }),
                };
            } else {
                const newCommandeProduit: CommandeProduit = {
                  id: Date.now() + Math.random(), 
                  produit: product,
                  quantity: qty,
                  unites_gratuites: ug,
                  prix_euro: commandeType === 'DIR' ? (finalPrice ? (normalizeNumberInput(finalPrice) / normalizeNumberInput(tauxChange)).toFixed(0) : '0') : undefined,
                  price: finalPrice,
                  price_cost: finalPriceCost,
                  tva: product.tva || '0',
                  marge: product.taux_marge || '1.3',
                  selling_price: finalSellingPrice,
                  lot: '',
                  date_expiration: '',
                };
                currentList.push(newCommandeProduit);
            }
        } else {
            console.warn(`[CSV Import] CIP non trouvé: "${cleanCip}" (normalisé: "${normalizeCip(cleanCip)}")`);
            notFoundItems.push({ cip: cleanCip, qty });
            productsNotFound++;
        }
      });

      setCommandeProduits(currentList);
      
      if (productsNotFound > 0) {
        const txtContent = notFoundItems.map(item => `${item.cip};${item.qty}`).join('\n');
        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        link.href = URL.createObjectURL(blob);
        link.download = `produits_non_reconnus_${dateStr}.txt`;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.error(t('orders:messages.csv_partial_import', { found: productsFound, notFound: productsNotFound }));
      } else {
        toast.success(t('orders:messages.csv_import_success', { count: productsFound }));
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsImporting(false);
    };
    reader.readAsText(file);
  };

  const handleCsvExport = (wholesaler: 'UBIPHARM' | 'LABOREX') => {
    if (commandeProduits.length === 0) {
      toast(t('orders:messages.csv_empty_order'), { icon: '⚠️' });
      return;
    }

    let csvContent = ""; 
    let exportedCount = 0;
    let skippedCount = 0;

    commandeProduits.forEach(item => {
        const product = typeof item.produit === 'object' ? item.produit : produitsList.find(p => p.id === item.produit);
        if (!product) {
            skippedCount++;
            return;
        }

        let code = '';
        if (wholesaler === 'UBIPHARM') code = product.cip1 || '';
        else if (wholesaler === 'LABOREX') code = product.cip2 || '';

        if (code) {
            const qty = item.quantity || 0;
            csvContent += `${code};${qty}\n`;
            exportedCount++;
        } else {
            skippedCount++;
        }
    });

    if (exportedCount === 0) {
        toast.error(t('orders:messages.csv_no_code', { wholesaler }));
        return;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        const dateStr = new Date().toISOString().slice(0,10);
        link.setAttribute("href", url);
        link.setAttribute("download", `commande_${wholesaler}_${dateStr}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    if (skippedCount > 0) {
        alert(t('orders:messages.csv_export_skipped', { exported: exportedCount, skipped: skippedCount, wholesaler }));
    }
  };

  function handleApplySuggestions(newLines: CommandeProduit[], supplierId: string) {
      setCommandeProduits(newLines);
      setNewCommandeFournisseurId(supplierId);
      setNumeroFacture(''); 
      setIsSuggestionModalOpen(false);
      setViewMode('CREATE');
  }

  const handleSortChange = useCallback((key: 'numero' | 'date' | 'fournisseur' | 'status') => {
    if (key === sortKey) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortOrder('desc'); }
  }, [sortKey]);

  const statusOrder: Record<string, number> = { 'PREP': 1, 'ATT': 2, 'CLOT': 3 };

  const sortedCommandes = useMemo(() => {
    let filtered = commandes;
    if (filterStatus !== 'ALL') filtered = filtered.filter(c => c.status === filterStatus);
    
    return filtered.toSorted((a, b) => {
      let valA, valB;
      if (sortKey === 'numero') { valA = a.numero_facture || a.id; valB = b.numero_facture || b.id; }
      else if (sortKey === 'date') { valA = a.date; valB = b.date; }
      else if (sortKey === 'fournisseur') {
        const fA = fournisseurs.find(f => f.id === a.fournisseur)?.name || '';
        const fB = fournisseurs.find(f => f.id === b.fournisseur)?.name || '';
        valA = fA.toLowerCase(); valB = fB.toLowerCase();
      } else if (sortKey === 'status') {
        valA = statusOrder[a.status] || 99; valB = statusOrder[b.status] || 99;
      }
      if (valA! < valB!) return sortOrder === 'asc' ? -1 : 1;
      if (valA! > valB!) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [commandes, sortKey, sortOrder, fournisseurs, filterStatus, statusOrder]);

  function handleProduitCreated(produit: ProduitModel) {
    selectProduct(produit); 
    setSearchProduitQuery(produit.name.substring(0, 3)); 
    setIsCreateProduitModalOpen(false); 
  }

  const handleSortProduits = useCallback((sortBy: 'chrono' | 'stock' | 'name' | 'qty') => {
    setCommandeSortBy(sortBy);
    setCommandeProduits(prev => {
      const sorted = prev.toSorted((a: any, b: any) => {
        if (sortBy === 'chrono') return (a.id || 0) - (b.id || 0);

        const prodA = typeof a.produit === 'object' ? a.produit : produitsList.find(p => p.id === a.produit);
        const prodB = typeof b.produit === 'object' ? b.produit : produitsList.find(p => p.id === b.produit);

        if (sortBy === 'name') {
          const nameA = prodA?.name || (a as any).produit_nom || '';
          const nameB = prodB?.name || (b as any).produit_nom || '';
          return nameA.localeCompare(nameB);
        }
        if (sortBy === 'stock') {
          const stockA = prodA?.stock ?? (a as any).produit_stock ?? 0;
          const stockB = prodB?.stock ?? (b as any).produit_stock ?? 0;
          return stockB - stockA;
        }
        if (sortBy === 'qty') return (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
        return 0;
      });
      return sorted;
    });
    setSelectedRows(new Set());
  }, [produitsList]);

  function openCreateView(type: 'LOC' | 'DIR' | 'DIV' = activeTab) {
    // Filtrer les fournisseurs selon le type de commande
    const fournisseursForType = type === 'DIV' 
      ? fournisseurs.filter(f => f.is_divers)
      : fournisseurs.filter(f => !f.is_divers);
    
    // Pré-sélectionner le premier fournisseur approprié, ou vider si aucun
    setNewCommandeFournisseurId(fournisseursForType.length > 0 ? String(fournisseursForType[0].id) : '')
    setNumeroFacture('')
    setCommandeProduits([])
    setSearchProduitQuery('')
    setCommandeType(type);
    
    if (type === 'DIR') {
        setTauxChange('655.957');
        setFraisCoefficient(pharmacySettings?.coefficient_direct_commande || '1.35');
    }

    setViewMode('CREATE');
    setSelectedCommande(null);
  }

  function openEditView(commande: Commande) {
    setNewCommandeFournisseurId(commande.fournisseur ? String(commande.fournisseur) : '');
    setNumeroFacture(commande.numero_facture || '');
    setCommandeType((commande.type as 'LOC' | 'DIR') || 'LOC');
    
    if (commande.type === 'DIR') {
        setTauxChange(commande.taux_change || '655.957');
        setFraisCoefficient(commande.frais_coefficient || pharmacySettings?.coefficient_direct_commande || '1.0');
    }
    
    const enrichedProducts = commande.produits.map(p => {
        const produitObj = typeof p.produit === 'object' ? p.produit : null;
        const produitId = produitObj ? produitObj.id : p.produit;
        const fullProduct = produitId ? produitsList.find(prod => prod.id === produitId) : null;

        let marge = p.marge;
        const cost = normalizeNumberInput(p.price);
        const sell = normalizeNumberInput(p.selling_price || '0');
        
        if (!marge && cost > 0 && sell > 0) marge = (sell / cost).toFixed(2);

        return {
            ...p,
            id: p.id,
            produit: fullProduct || p.produit,
            quantity: p.quantity,
            unites_gratuites: p.unites_gratuites || 0,  
            prix_euro: p.prix_euro,
            price: p.price || (fullProduct?.cost_price || '0'),
            selling_price: p.selling_price || (fullProduct?.selling_price || '0'),
            tva: p.tva || (fullProduct?.tva || '0'),
            marge: marge || (fullProduct?.taux_marge || '1.3'),
            lot: p.lot || '',
            date_expiration: formatDateToMMYY(p.date_expiration || '')
        };
    });
    
    setCommandeProduits(enrichedProducts); 
    setSearchProduitQuery('')
    setSelectedCommande(commande);
    setViewMode('EDIT');
  }

  async function handleViewDetails(commande: Commande) {
    try {
      const data = await commandeService.getById(commande.id);
      setSelectedCommande(data);
      setViewMode('DETAILS');
    } catch (err) {
      toast.error(t('orders:messages.details_load_error'));
    }
  }

  function handleBackToList() {
    setViewMode('LIST');
    setSelectedCommande(null);
    setCommandeProduits([]); 
  }

  return {
    state: {
      activeTab, setActiveTab,
      commandeType,
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
      page,
      totalPages,
      onPageChange: setPage,
      sortKey,
      sortOrder,
      onSortChange: handleSortChange,
      filterStatus,
      onFilterStatusChange: setFilterStatus,
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
      viewMode: viewMode as any, // Typed internally, let compiler infer or force
      selectedCommande,
      fournisseurs: filteredFournisseurs,
      newCommandeFournisseurId,
      setNewCommandeFournisseurId,
      numeroFacture,
      setNumeroFacture,
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
      selectProduct,
      getItemProps,
      commandeProduits,
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
    }
  };
}
