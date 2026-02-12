
import { useEffect, useMemo, useState, type FormEvent, useRef, useCallback } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../hooks/useConfirm'
import { useAuth } from '../context/AuthContext';
import type { ProduitModel, Commande, CommandeProduit } from '../types'
import ProduitFormModal from './ProduitFormModal'
import { useSearchNavigation } from '../hooks/useSearchNavigation'
import { useProductSearch } from '../hooks/useProductSearch'
import SimplePrintLabelsModal from './SimplePrintLabelsModal'
import SuggestionCommandeModal from './SuggestionCommandeModal'
import PasswordConfirmModal from './PasswordConfirmModal'
import CommandeList from './Commandes/CommandeList'
import CommandeForm from './Commandes/CommandeForm'
import TransferCommandeModal from './Commandes/TransferCommandeModal'
import MergeCommandesModal from './Commandes/MergeCommandesModal'
import { useCommandeActions } from '../hooks/useCommandeActions';
// import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { usePharmacySettings } from '../hooks/usePharmacySettings';
import { useCommandes, useCommandeFournisseurs, useCommandeRayons } from '../hooks/useCommandes';
import { useFormes } from '../hooks/useProduits';
import { useNavigate, useLocation } from 'react-router-dom';



// Helper functions for Date format MM/YY
// parseMMYYToDate removed as it is now in useCommandeActions

function formatDateToMMYY(isoDate: string | null | undefined): string {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
        return `${parts[1]}/${parts[0].slice(-2)}`;
    }
    return '';
}

interface CommandesProps {
    forcedType?: 'LOC' | 'DIR';
}

export default function Commandes({ forcedType }: CommandesProps) {
  const confirm = useConfirm()
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate(); // For navigation to Avoirs
  const location = useLocation(); // For receiving state from Dashboard
  const [selectedCommande, setSelectedCommande] = useState<Commande | null>(null)

  const { settings: pharmacySettings } = usePharmacySettings();
  const [activeTab, setActiveTab] = useState<'LOC' | 'DIR'>(forcedType || 'LOC'); // Onglet actif (List)
  const [commandeType, setCommandeType] = useState<'LOC' | 'DIR'>(forcedType || 'LOC'); // Type de la commande en cours (Form)

  // Sync state if forcedType changes
  useEffect(() => {
    if (forcedType) {
        setActiveTab(forcedType);
        setCommandeType(forcedType);
    }
  }, [forcedType]);
  
  // Champs spécifiques Commandes Directes
  const [tauxChange, setTauxChange] = useState<string>('655.957');
  const [fraisCoefficient, setFraisCoefficient] = useState<string>('1.35');

  const [viewMode, setViewMode] = useState<'LIST' | 'CREATE' | 'DETAILS' | 'EDIT'>('LIST');
  const [newCommandeFournisseurId, setNewCommandeFournisseurId] = useState<string>('')

  // Pagination State
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // React Query Hooks for data fetching
  const { 
    data: commandesData, 
    isLoading: loading, 
    error: loadError,
    refetch: refetchCommandes 
  } = useCommandes({ page, type: activeTab, status: filterStatus });
  
  const { data: fournisseurs = [] } = useCommandeFournisseurs();
  const { data: rayons = [] } = useCommandeRayons();
  const { data: formes = [] } = useFormes();

  // Derived state from React Query
  const commandes = useMemo(() => commandesData?.results || [], [commandesData]);
  const totalCount = commandesData?.count || 0;
  const totalPages = Math.ceil(totalCount / 50) || 1;
  const error = loadError ? (loadError as Error).message : null;


  
  // State for creating commande (single modal)
  const [numeroFacture, setNumeroFacture] = useState('');


  const [commandeProduits, setCommandeProduits] = useState<CommandeProduit[]>([]);
  

  
  // Use product search hook for optimized searching
  const { 
    produits: produitsList, 
    searchQuery: searchProduitQuery,
    setSearchQuery: setSearchProduitQuery
  } = useProductSearch({ minSearchLength: 2, debounceMs: 200 })
  

  
  // Initialize Keyboard Navigation Hook (Removed invalid usage, defining refs manually)
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fournisseurSelectRef = useRef<HTMLSelectElement>(null);
  // const { searchInputRef, fournisseurSelectRef } = useKeyboardNavigation({ viewMode });

  const fileInputRef = useRef<HTMLInputElement>(null); // Ref pour l'input file


  // States for table navigation and selection
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [focusedField, setFocusedField] = useState<{row: number, field: number} | null>(null);

  const [sortKey, setSortKey] = useState<'numero' | 'date' | 'fournisseur' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showPrintLabelsModal, setShowPrintLabelsModal] = useState(false);
  // filterStatus is declared above with React Query hooks

  // Tri pour les produits dans la vue détails
  const [detailSortKey, setDetailSortKey] = useState<'name' | 'quantity' | 'price'>('name');
  const [detailSortOrder, setDetailSortOrder] = useState<'asc' | 'desc'>('asc');

  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isImporting, setIsImporting] = useState(false); // Flag pour désactiver auto-save pendant l'import CSV



  const [isCreateProduitModalOpen, setIsCreateProduitModalOpen] = useState(false);


  // Etats pour le modal de suggestion de commande
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);

  // Etats pour le modal de transfert vers autre fournisseur (Refactored)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Etats pour la sélection et fusion de commandes
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);



  // Fonction utilitaire pour gérer les erreurs
  const handleApiError = useCallback((err: unknown, defaultMessage: string) => {
    if (axios.isAxiosError(err)) {
      const errorMessage = err.response?.data?.message || err.message || defaultMessage;
      toast.error(errorMessage);
    } else {
      toast.error(defaultMessage);
    }
    console.error('Erreur API:', err);
  }, []);

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL ?? ''),
    [],
  )
  const commandesEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/commandes/`
    : '/api/commandes/'
  // Endpoints for reference
  const produitsEndpoint = `${apiBaseUrl}/api/produits/`
  const rayonsEndpoint = `${apiBaseUrl}/api/rayons/`
  const fournisseursEndpoint = `${apiBaseUrl}/api/fournisseurs/`


  const filteredProduits = produitsList


  // Data fetching is now handled by React Query hooks above

  // Initialize Actions Hook
  const {
      handleSaveCommande,
      handleDeleteCommande,
      handleCloturerCommande,
      handleMettreEnAttente,
      handleAnnulerReception,
      handleImprimerReception,
      isPasswordModalOpen,
      setIsPasswordModalOpen,
      passwordModalConfig,
      handlePasswordConfirmed
  } = useCommandeActions({
      apiBaseUrl,
      commandesEndpoint,
      fetchCommandes: async () => { await refetchCommandes(); },
      setSelectedCommande,
      setViewMode,
      confirm,
      user
  });

  // Reset selection when selectedCommande changes
  useEffect(() => {
      setSelectedRows(new Set());
  }, [selectedCommande]);

  // Sync selected commande with list
  useEffect(() => {
    if (selectedCommande && !commandes.some(c => c.id === selectedCommande.id)) {
      setSelectedCommande(null)
    }
  }, [commandes, selectedCommande])

  /**
   * Sauvegarde la commande en cours (création ou modification).
   * Valide que la commande contient au moins un produit avant de sauvegarder.
   * @param e - Événement de soumission du formulaire
   */
  const onSave = (e: FormEvent) => {
      e.preventDefault();
      if (commandeProduits.length === 0) {
          toast.error('Veuillez ajouter au moins un produit à la commande.');
          return;
      }
      const cleanCommande: Partial<Commande> = {
           fournisseur: newCommandeFournisseurId ? parseInt(newCommandeFournisseurId, 10) : undefined,
           numero_facture: numeroFacture,
           type: commandeType,
           taux_change: commandeType === 'DIR' ? tauxChange : undefined,
           frais_coefficient: commandeType === 'DIR' ? fraisCoefficient : undefined,
      };
      // viewMode is typed as string in state, cast to literal
      const mode = (viewMode === 'CREATE' ? 'CREATE' : 'EDIT') as 'CREATE' | 'EDIT';
      handleSaveCommande(cleanCommande, commandeProduits, mode, selectedCommande);
  };

  const onDelete = () => {
      if (selectedCommande) handleDeleteCommande(selectedCommande);
  };

  const onCloture = () => {
      if (selectedCommande) handleCloturerCommande(selectedCommande);
  }

  const onMettreEnAttente = () => {
      if (selectedCommande) handleMettreEnAttente(selectedCommande);
  }

  const onAnnulerReception = () => {
      if (selectedCommande) handleAnnulerReception(selectedCommande);
  }

  const onImprimer = () => {
     if (selectedCommande) handleImprimerReception(selectedCommande);
  }

  const handleCreateAvoirFromCommande = () => {
    if (!selectedCommande) return;
    
    // Preparer les donnees pour Avoirs.tsx
    // Filtrer les produits si une sélection existe
    const produitsSource = selectedCommande.produits || [];
    const produitsAvoir = (selectedRows.size > 0 
        ? produitsSource.filter((_, idx) => selectedRows.has(idx))
        : produitsSource
    ).map(p => ({
            id: typeof p.produit === 'object' ? p.produit.id : p.produit,
            name: (p as any).produit_nom,
            cip: (p.produit as any)?.cip1 || (p as any).produit_cip || '',
            purchase_price: p.price, // Cost price
            quantity: 0, // Default to 0 to force user to input returned qty
            received_qty: p.quantity,
            lot: p.lot,
            expiration: p.date_expiration
        }));

    const avoirData = {
        fournisseur: selectedCommande.fournisseur,
        fournisseur_nom: selectedCommande.fournisseur_nom, // Assuming this exists or fetch from list
        source_commande: selectedCommande.id,
        produits: produitsAvoir
    };

    navigate('/app/avoirs', { state: { createFromCommande: avoirData } });
  }

  useEffect(() => {
    // Skip auto-save si import CSV en cours
    if (isImporting) return;
    
    if (viewMode === 'CREATE' || viewMode === 'EDIT') {
        // Auto-save toutes les 5 minutes (300000ms) au lieu de 1.5s
        const timer = setTimeout(async () => {
             // Conditions pour sauvegarde automatique:
             // 1. Avoir des produits
             // 2. Avoir un fournisseur (obligatoire pour créer)
             if (commandeProduits.length > 0 && newCommandeFournisseurId) {
                 setSaving(true);
                 
                 const cleanCommande: Partial<Commande> = {
                    fournisseur: newCommandeFournisseurId ? parseInt(newCommandeFournisseurId, 10) : undefined,
                    numero_facture: numeroFacture,
                    type: commandeType,
                    taux_change: commandeType === 'DIR' ? tauxChange : undefined,
                    frais_coefficient: commandeType === 'DIR' ? fraisCoefficient : undefined,
                 };
                 
                 const mode = (viewMode === 'CREATE' ? 'CREATE' : 'EDIT') as 'CREATE' | 'EDIT';
                 
                 // Appel avec isAutoSave = true
                 await handleSaveCommande(cleanCommande, commandeProduits, mode, selectedCommande, true);
                 
                 setSaving(false);
                 setLastSaved(new Date());
             }
        }, 60000); // 1 minute
        return () => clearTimeout(timer);
    }
  }, [
      commandeProduits, 
      viewMode, 
      newCommandeFournisseurId, 
      numeroFacture, 
      commandeType, 
      tauxChange, 
      fraisCoefficient, 
      selectedCommande,
      handleSaveCommande 
  ]);

  // Debounced recalculation of prices when taux/coeff changes (to prevent loops)
  const lastRecalcRef = useRef<{ taux: string; coeff: string }>({ taux: '', coeff: '' });
  const recalcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Auto-recalculate prices when Global Rate/Coeff changes (with debounce to prevent infinite loops)
  useEffect(() => {
      if (commandeType === 'DIR' && viewMode === 'CREATE') {
          const rate = parseFloat(tauxChange || '0');
          const coeff = parseFloat(fraisCoefficient || '0');
          
          if (!rate || !coeff) return;
          
          // Prevent recalculation if values haven't actually changed
          if (lastRecalcRef.current.taux === tauxChange && lastRecalcRef.current.coeff === fraisCoefficient) {
              return;
          }
          
          // Clear any pending recalculation
          if (recalcTimeoutRef.current) {
              clearTimeout(recalcTimeoutRef.current);
          }
          
          // Debounce the recalculation to prevent rapid consecutive updates
          recalcTimeoutRef.current = setTimeout(() => {
              lastRecalcRef.current = { taux: tauxChange, coeff: fraisCoefficient };
              
              setCommandeProduits(prev => {
                  // Skip if no products with Euro price
                  if (!prev.some(item => item.prix_euro)) {
                      return prev;
                  }
                  
                  let hasChanges = false;
                  const updated = prev.map(item => {
                      // Only update if item has Euro price
                      if (item.prix_euro) {
                          const pEuro = parseFloat(String(item.prix_euro));
                          if (!isNaN(pEuro)) {
                              // 1. Prix Achat FCFA = Euro * Taux
                              const priceFCFA = pEuro * rate;
                              // 2. Prix Revient = Prix Achat * Coeff
                              const costPrice = priceFCFA * coeff;
                              
                              // 3. Update Item - Use integer to avoid floating point comparison issues
                              const newPrice = Math.round(costPrice).toString();
                              
                              // 4. Update Selling Price
                              const currentMargin = parseFloat(String(item.marge || 1.3));
                              const newSelling = Math.round(costPrice * currentMargin).toString();

                              // Only mark as changed if values are actually different
                              if (item.price !== newPrice || item.selling_price !== newSelling) {
                                  hasChanges = true;
                                  return {
                                      ...item,
                                      price: newPrice,
                                      selling_price: newSelling
                                  };
                              }
                          }
                      }
                      return item;
                  });
                  
                  // Return prev if no changes to avoid unnecessary re-renders
                  return hasChanges ? updated : prev;
              });
          }, 500); // 500ms debounce
      }
      
      return () => {
          if (recalcTimeoutRef.current) {
              clearTimeout(recalcTimeoutRef.current);
          }
      };
  }, [tauxChange, fraisCoefficient, commandeType, viewMode]);

  // Handle Navigation State (Create from Stock Alerts in Dashboard)
  useEffect(() => {
    if (location.state && (location.state as any).createFromStockAlert) {
      const data = (location.state as any).createFromStockAlert;
      
      // Switch to CREATE mode
      setViewMode('CREATE');
      setSelectedCommande(null);
      setCommandeProduits([]);
      
      // Fetch full product details and pre-fill
      const loadProducts = async () => {
        if (!Array.isArray(data.products) || data.products.length === 0) return;
        
        const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
        const produitsEndpoint = apiBase ? `${apiBase}/api/produits/` : '/api/produits/';
        
        const newLines: CommandeProduit[] = [];
        
        for (const p of data.products) {
          try {
            // Fetch full product data
            const { data: fullProduct } = await axios.get<ProduitModel>(`${produitsEndpoint}${p.id}/`);
            
            // Smart suggested quantity:
            // If avg_daily_sales is available (from shortage prediction), order enough for 30 days of coverage
            // Otherwise, fall back to stock_minimum - stock
            const avgSales = (p as any).avg_daily_sales;
            const coverageDays = 30;
            const suggestedQty = avgSales && avgSales > 0
              ? Math.max(1, Math.ceil(avgSales * coverageDays) - (fullProduct.stock || 0))
              : Math.max(1, (fullProduct.stock_minimum || 10) - (fullProduct.stock || 0));
            
            newLines.push({
              id: Date.now() + p.id, // Temp ID
              produit: fullProduct,
              quantity: suggestedQty,
              unites_gratuites: 0,
              price: fullProduct.cost_price || '0',
              tva: fullProduct.tva || '0',
              marge: fullProduct.taux_marge || '1.3',
              selling_price: fullProduct.selling_price || '0',
              lot: '',
              date_expiration: '',
            });
          } catch (err) {
            console.error(`Failed to fetch product ${p.id}:`, err);
            // Use basic data if fetch fails
            newLines.push({
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
            });
          }
        }
        
        setCommandeProduits(newLines);
        toast.success(`${newLines.length} produit(s) ajouté(s) depuis les alertes stock`, { icon: '📦' });
      };
      
      loadProducts();
      
      // Clear state to avoid re-triggering on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Raccourcis clavier globaux (Delete, Escape, Ctrl+A)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignorer si on est dans un input/textarea ou si modal n'est pas ouvert
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
      // Delete : Supprimer lignes sélectionnées
      if (e.key === 'Delete' && !isInput && selectedRows.size > 0) {
        e.preventDefault();
        setCommandeProduits(prev => prev.filter((_, i) => !selectedRows.has(i)));
        setSelectedRows(new Set());
        return;
      }
      
      // Escape : Fermer modals
      if (e.key === 'Escape' && !isInput) {
        if (viewMode === 'CREATE' || viewMode === 'EDIT') {
          handleBackToList();

        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [viewMode, commandeProduits, selectedRows])


  // Use search navigation hook
  const { handleKeyDown: handleSearchKeyDown, getItemProps } = useSearchNavigation(
    filteredProduits,
    selectProduct,
    { resetOnSelect: true, searchInputRef }
  );

  // Configuration des champs
  const fieldsConfig = [
    { name: 'quantity', editable: true },
    { name: 'unites_gratuites', editable: true }, // NEW
    ...(commandeType === 'DIR' ? [{ name: 'prix_euro', editable: true }] : []),
    { name: 'price', editable: true },
    { name: 'tva', editable: true },
    { name: 'marge', editable: true },
    { name: 'selling_price', editable: true }, 
    { name: 'lot', editable: true },
    { name: 'date_expiration', editable: true },
  ];

  /**
   * Gère la navigation clavier dans le tableau de produits de la commande.
   * Supporte : Enter/Tab (champ suivant), Shift+Tab (champ précédent),
   * Flèches haut/bas (lignes), Ctrl+Flèches (navigation rapide).
   * @param e - Événement clavier React
   * @param rowIndex - Index de la ligne actuelle
   * @param fieldIndex - Index du champ actuel dans la ligne
   */
  function handleTableFieldKeyDown(
    e: React.KeyboardEvent,
    rowIndex: number,
    fieldIndex: number
  ) {
    
    const moveToNextField = () => {
        // Special case: In DIR mode, after UG (field 1), go to euro field
        if (commandeType === 'DIR' && fieldIndex === 1) {
            setTimeout(() => {
                const euroInput = document.querySelector(
                    `input[data-row="${rowIndex}"][data-field="euro"]`
                ) as HTMLInputElement;
                euroInput?.focus();
                euroInput?.select();
            }, 0);
            return;
        }

        let nextFieldIndex = fieldIndex + 1;
        while (nextFieldIndex < fieldsConfig.length && !fieldsConfig[nextFieldIndex].editable) {
            nextFieldIndex++;
        }

        if (nextFieldIndex < fieldsConfig.length) {
            // Passer au champ suivant (editable)
            setFocusedField({ row: rowIndex, field: nextFieldIndex });
            setTimeout(() => {
                const nextInput = document.querySelector(
                    `input[data-row="${rowIndex}"][data-field="${nextFieldIndex}"]`
                ) as HTMLInputElement;
                nextInput?.focus();
                nextInput?.select(); // Sélectionner le contenu pour saisie directe
            }, 0);
        } else {
             // Fin de ligne (date d'expiration) : retourner à la recherche produit
             setFocusedField(null);
             setTimeout(() => {
                 searchInputRef.current?.focus();
             }, 0);
        }
    };

    const moveToPreviousField = () => {
        let prevFieldIndex = fieldIndex - 1;
        while (prevFieldIndex >= 0 && !fieldsConfig[prevFieldIndex].editable) {
            prevFieldIndex--;
        }

        if (prevFieldIndex >= 0) {
            setFocusedField({ row: rowIndex, field: prevFieldIndex });
            setTimeout(() => {
                const prevInput = document.querySelector(
                    `input[data-row="${rowIndex}"][data-field="${prevFieldIndex}"]`
                ) as HTMLInputElement;
                prevInput?.focus();
                prevInput?.select(); // Sélectionner le contenu pour saisie directe
            }, 0);
        }
    };

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        moveToNextField();
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
            moveToPreviousField();
        } else {
            moveToNextField();
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (rowIndex < commandeProduits.length - 1) {
          setFocusedField({ row: rowIndex + 1, field: fieldIndex });
          setTimeout(() => {
            const nextInput = document.querySelector(
              `input[data-row="${rowIndex + 1}"][data-field="${fieldIndex}"]`
            ) as HTMLInputElement;
            nextInput?.focus();
            nextInput?.select();
          }, 0);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (rowIndex > 0) {
          setFocusedField({ row: rowIndex - 1, field: fieldIndex });
          setTimeout(() => {
            const nextInput = document.querySelector(
              `input[data-row="${rowIndex - 1}"][data-field="${fieldIndex}"]`
            ) as HTMLInputElement;
            nextInput?.focus();
            nextInput?.select();
          }, 0);
        }
        break;
      case 'ArrowRight':
        // Uniquement si curseur à la fin ou si on veut naviguer entre champs ? 
        // Pour l'instant, garder comportement standard input sauf si Ctrl
        if (e.ctrlKey) {
             e.preventDefault();
             moveToNextField();
        }
        break;
      case 'ArrowLeft':
         if (e.ctrlKey) {
             e.preventDefault();
             moveToPreviousField();
         }
        break;
    }
  }

  /**
   * Ajoute un produit à la commande en cours.
   * - Vérifie l'exclusivité fournisseur et demande confirmation si nécessaire
   * - Si le produit existe déjà, incrémente la quantité
   * - Sinon, crée une nouvelle ligne avec les valeurs par défaut du produit
   * @param product - Le produit à ajouter à la commande
   */
  async function selectProduct(product: ProduitModel) {
    // Vérification Exclusivité Fournisseur
    if (product.is_supplier_exclusive) {
        let currentSupplierId: number | null = null;
        
        if (viewMode === 'CREATE' && newCommandeFournisseurId) {
            currentSupplierId = parseInt(newCommandeFournisseurId, 10);
        } else if ((viewMode === 'EDIT' || viewMode === 'DETAILS') && selectedCommande?.fournisseur) {
            currentSupplierId = selectedCommande.fournisseur;
        }

        if (currentSupplierId && product.fournisseur && currentSupplierId !== product.fournisseur) {
             const confirmed = await confirm({
                 title: '⚠️ Produit Exclusif',
                 message: `Ce produit est marqué comme exclusif au fournisseur "${product.fournisseur_name}".\n\nÊtes-vous sûr de vouloir le commander chez un autre fournisseur ?`,
                 confirmText: 'Oui, ajouter quand même',
                 cancelText: 'Annuler',
                 variant: 'warning'
             });

             if (!confirmed) {
                 return;
             }
        }
    }

    // Vérifier si le produit existe déjà
    const existingIndex = commandeProduits.findIndex(
      p => (typeof p.produit === 'object' ? p.produit.id : p.produit) === product.id
    );

    if (existingIndex !== -1) {
      // Produit existant : Focus sur cette ligne et incrémenter quantité ?
      // Pour l'instant on met juste le focus
      const newRowIndex = existingIndex;
      setFocusedField({ row: newRowIndex, field: 0 });
      
      // Update quantity (+1)
      const currentQty = parseInt(String(commandeProduits[existingIndex].quantity || 0));
      updateCommandeProduitField(existingIndex, 'quantity', currentQty + 1);

      // Indicateur visuel (scroll)
      setTimeout(() => {
        const row = document.querySelector(`input[data-row="${newRowIndex}"]`);
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const quantityInput = document.querySelector(
          `input[data-row="${newRowIndex}"][data-field="0"]`
        ) as HTMLInputElement;
        quantityInput?.focus();
      }, 50);

    } else {
      // Nouveau produit
      const newCommandeProduit: CommandeProduit = {
        id: Date.now(), // ID temporaire
        produit: product,
        quantity: 1,
        unites_gratuites: 0,  // NEW: Initialize UG
        prix_euro: commandeType === 'DIR' ? (product.cost_price ? (parseFloat(product.cost_price) / parseFloat(tauxChange)).toFixed(2) : '0') : undefined,
        price: product.cost_price || '0',
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
         const quantityInput = document.querySelector(
           `input[data-row="${newRowIndex}"][data-field="0"]`
         ) as HTMLInputElement;
         quantityInput?.focus();
         quantityInput?.select();
      }, 50);
    }
    
    // Reset recherche
    setSearchProduitQuery('');
  }



  /**
   * Supprime un produit de la commande par son index.
   * Met à jour également les indices de sélection.
   * @param index - Index du produit à supprimer dans la liste
   */
  function removeProductFromCommande(index: number) {
    setCommandeProduits(prev => prev.filter((_, i) => i !== index));
    // Retirer aussi de la sélection si présent
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.delete(index);
      // Ajuster les indices des éléments suivants
      const adjusted = new Set<number>();
      next.forEach(idx => {
        if (idx < index) adjusted.add(idx);
        else if (idx > index) adjusted.add(idx - 1);
      });
      return adjusted;
    });
  }

  // Gestion des checkboxes
  function toggleRowSelection(index: number) {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function toggleAllRows() {
    if (selectedRows.size === commandeProduits.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(commandeProduits.map((_, i) => i)));
    }
  }

  function deleteSelectedRows() {
    setCommandeProduits(prev => prev.filter((_, i) => !selectedRows.has(i)));
    setSelectedRows(new Set());
  }

  // Ouvrir le modal de transfert
  function openTransferModal() {
    if (selectedRows.size === 0) {
      toast.error('Veuillez sélectionner au moins un produit à transférer.');
      return;
    }
    setIsTransferModalOpen(true);
  }

  // Callback après succès du transfert
  function handleTransferSuccess(_transferredCount: number, _supplierName: string, _newCommandeId: number) {
      // Retirer les produits transférés de la liste actuelle
      setCommandeProduits(prev => prev.filter((_, idx) => !selectedRows.has(idx)));
      setSelectedRows(new Set());
      
      // La notification est gérée par le modal
      // toast.success(...) 
      
      // Rafraîchir la liste des commandes et fermer le modal
      refetchCommandes();
      setIsTransferModalOpen(false);
  }

  // ============== FUSION DE COMMANDES ==============

  // Toggle la sélection d'une commande dans la liste
  function toggleOrderSelection(orderId: number) {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }

  // Sélectionner/Désélectionner toutes les commandes filtrées
  function toggleAllOrdersSelection() {
    if (selectedOrderIds.size === sortedCommandes.length && sortedCommandes.length > 0) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(sortedCommandes.map(c => c.id)));
    }
  }

  // Vérifier si la fusion est possible (même statut et au moins 2 sélectionnées)
  function canMergeSelectedOrders(): { canMerge: boolean; reason?: string; status?: string } {
    if (selectedOrderIds.size < 2) {
      return { canMerge: false, reason: 'Sélectionnez au moins 2 commandes' };
    }
    
    const selectedOrders = commandes.filter(c => selectedOrderIds.has(c.id));
    const statuses = new Set(selectedOrders.map(c => c.status));
    
    if (statuses.size > 1) {
      return { canMerge: false, reason: 'Les commandes doivent avoir le même statut' };
    }
    
    const status = selectedOrders[0]?.status;
    if (status === 'CLOT') {
      return { canMerge: false, reason: 'Impossible de fusionner des commandes clôturées' };
    }
    
    return { canMerge: true, status };
  }

  // Ouvrir le modal de fusion
  function openMergeModal() {
    const { canMerge, reason } = canMergeSelectedOrders();
    if (!canMerge) {
      toast.error(reason || 'Fusion impossible');
      return;
    }
    setIsMergeModalOpen(true);
  }

  // Callback après succès de la fusion
  function handleMergeSuccess(mergedCount: number, targetOrderId: number) {
      setIsMergeModalOpen(false);
      setSelectedOrderIds(new Set());
      toast.success(`${mergedCount} commande(s) fusionnée(s) dans la commande #${targetOrderId}`);
      refetchCommandes();
  }


  /**
   * Met à jour un champ d'un produit dans la commande et recalcule les valeurs liées.
   * 
   * Calculs automatiques :
   * - prix_euro → price (conversion Euro→FCFA avec taux de change et coefficient)
   * - price/marge/tva → selling_price (prix de vente TTC arrondi)
   * - selling_price → marge (marge recalculée en tenant compte de la TVA)
   * 
   * Gère aussi la fusion automatique des lignes avec le même produit et lot.
   * 
   * @param index - Index de la ligne à modifier
   * @param field - Nom du champ à modifier
   * @param value - Nouvelle valeur du champ
   */
  function updateCommandeProduitField(
    index: number,
    field: 'quantity' | 'unites_gratuites' | 'price' | 'tva' | 'marge' | 'selling_price' | 'lot' | 'date_expiration' | 'prix_euro',
    value: string | number
  ) {
    setCommandeProduits(prev => {
      // 1. Appliquer la modification à la ligne cible
      const updatedList = prev.map((item, i) => {
        if (i === index) {
            const newItem = { ...item, [field]: value };
            
            // AUTO-CALCUL: Euro -> FCFA (avec arrondi à l'entier)
          if (commandeType === 'DIR' && field === 'prix_euro') {
               const pEuro = parseFloat(String(newItem.prix_euro || 0));
               const rate = parseFloat(tauxChange || '655.957'); 
               const coeff = parseFloat(fraisCoefficient || '1.0');

               if (!isNaN(pEuro) && !isNaN(rate)) {
                   let priceFCFA = pEuro * rate;
                   if (!isNaN(coeff)) {
                       priceFCFA = priceFCFA * coeff;
                   }
                   // Arrondir à l'entier le plus proche
                   newItem.price = Math.round(priceFCFA).toString();
               }
          }

          // Recalculer selling_price si price, marge ou tva change (avec arrondi)
          if (field === 'price' || field === 'marge' || field === 'tva') {
               const price = parseFloat(String(newItem.price || 0));
               const marge = parseFloat(String(newItem.marge || 1));
               const tva = parseFloat(String(newItem.tva || 0));
               if (!isNaN(price) && !isNaN(marge) && price > 0) {
                   // Prix de vente HT = prix d'achat * marge
                   const sellingHT = price * marge;
                   // Prix de vente TTC = prix HT * (1 + TVA/100)
                   const sellingTTC = sellingHT * (1 + tva / 100);
                   // Arrondir à l'entier le plus proche
                   newItem.selling_price = Math.round(sellingTTC).toString();
               }
          }
          // Recalculer marge si selling_price change (avec arrondi de la marge à 2 décimales)
          if (field === 'selling_price') {
               const price = parseFloat(String(newItem.price || 0));
               const selling = parseFloat(String(newItem.selling_price || 0));
               const tva = parseFloat(String(newItem.tva || 0));
               if (!isNaN(price) && !isNaN(selling) && price > 0) {
                   // Reconvertir TTC en HT puis calculer la marge
                   const sellingHT = selling / (1 + tva / 100);
                   newItem.marge = (sellingHT / price).toFixed(2);
               }
          }
            return newItem;
        }
        return item;
      });

      // 2. Détection de doublons (Produit + Lot)
      // On ne fusionne que si la modification portait sur 'lot' ou 'quantity' (pour être réactif)
      // et uniquement si le lot n'est pas vide (pour permettre plusieurs lignes sans lot au début)
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
              // Fusionner !
              const targetItem = updatedList[targetIndex];
              const mergedQty = (targetItem.quantity || 0) + (currentItem.quantity || 0);
              const mergedUG = (targetItem.unites_gratuites || 0) + (currentItem.unites_gratuites || 0);
              
              const newList = updatedList.filter((_, i) => i !== index);
              // Mettre à jour la ligne cible (on garde les prix de la ligne cible pour l'instant)
              const finalIndex = targetIndex > index ? targetIndex - 1 : targetIndex;
              newList[finalIndex] = {
                  ...newList[finalIndex],
                  quantity: mergedQty,
                  unites_gratuites: mergedUG
              };

              toast.success(`Lots fusionnés pour ${typeof currentItem.produit === 'object' ? currentItem.produit.name : 'le produit'}`, { icon: '🔄' });
              
              // Déplacer le focus vers la ligne fusionnée
              setTimeout(() => {
                const targetInput = document.querySelector(`input[data-row="${finalIndex}"][data-field="0"]`) as HTMLInputElement;
                targetInput?.focus();
              }, 50);

              return newList;
          }
      }

      return updatedList;
    });
  }





  /**
   * Importe des produits depuis un fichier CSV.
   * 
   * Formats supportés :
   * - CSV standard avec colonnes : CIP, Désignation, Quantité, Prix Achat, Prix Vente, etc.
   * - Fichiers grossistes (UBIPHARM, LABOREX) avec formats spécifiques
   * 
   * Fonctionnalités :
   * - Recherche automatique des produits par CIP ou nom
   * - Mise à jour des prix si le produit existe
   * - Création de nouvelles lignes pour les produits trouvés
   * - Rapport des produits non trouvés
   * 
   * @param event - Événement de changement du champ fichier
   */
  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Désactiver l'auto-save pendant l'import
    setIsImporting(true);

    // Charger TOUS les produits depuis l'endpoint optimisé pour l'import CSV
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const produitsEndpoint = apiBaseUrl
      ? `${apiBaseUrl}/api/produits/for_import/`
      : '/api/produits/for_import/';

    let allProducts: ProduitModel[] = [];
    try {
      const response = await axios.get(produitsEndpoint);
      const data = response.data as any;
      allProducts = Array.isArray(data) ? data : (data.results || []);
    } catch (err) {
      toast.error("Erreur lors du chargement des produits pour l'import CSV");
      console.error(err);
      setIsImporting(false);
      return;
    }

    // Fonction helper pour normaliser un CIP (supprime les zéros inutiles, espaces, caractères spéciaux)
    const normalizeCip = (cip: string | null | undefined): string => {
      if (!cip) return '';
      // Supprimer espaces, tirets, points
      let normalized = cip.trim().replace(/[\s\-\.]/g, '');
      // Optionnel: supprimer les zéros en tête pour les codes purement numériques
      // Si le code est numérique, on compare aussi sans les zéros en tête
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

      // Debug: Afficher quelques produits pour vérifier les CIP disponibles


      lines.forEach(line => {
        if (!line.trim()) return;
        const [cip, qtyStr] = line.split(';');
        if (!cip) return;

        const qty = parseInt(qtyStr) || 1;
        const cleanCip = cip.trim();
        const normalizedSearchCip = normalizeCip(cleanCip);

        // Recherche par CIP (1, 2 ou 3) - comparaison normalisée et flexible
        const product = allProducts.find(p => {
          const norm1 = normalizeCip(p.cip1);
          const norm2 = normalizeCip(p.cip2);
          const norm3 = normalizeCip(p.cip3);
          
          // Comparaison exacte normalisée
          if (norm1 === normalizedSearchCip || norm2 === normalizedSearchCip || norm3 === normalizedSearchCip) {
            return true;
          }
          
          // Comparaison sans les zéros en tête pour les codes numériques
          const numericSearch = normalizedSearchCip.replace(/^0+/, '');
          if (numericSearch && (
            norm1.replace(/^0+/, '') === numericSearch ||
            norm2.replace(/^0+/, '') === numericSearch ||
            norm3.replace(/^0+/, '') === numericSearch
          )) {
            return true;
          }
          
          return false;
        });

        if (product) {
            productsFound++;
            // Check duplicates
            const existingIndex = currentList.findIndex(
               p => (typeof p.produit === 'object' ? p.produit.id : p.produit) === product.id
            );

            if (existingIndex !== -1) {
                // Update existing quantity
                const currentQty = parseInt(String(currentList[existingIndex].quantity || 0));
                currentList[existingIndex] = {
                    ...currentList[existingIndex],
                    quantity: currentQty + qty
                };
            } else {
                // Add new line
                const newCommandeProduit: CommandeProduit = {
                  id: Date.now() + Math.random(), // Unique temp ID
                  produit: product,
                  quantity: qty,
                  prix_euro: commandeType === 'DIR' ? (product.cost_price ? (parseFloat(product.cost_price) / parseFloat(tauxChange)).toFixed(2) : '0') : undefined,
                  price: product.cost_price || '0',
                  tva: product.tva || '0',
                  marge: product.taux_marge || '1.3',
                  selling_price: product.selling_price || '0',
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
        // Générer et télécharger le fichier txt des produits non reconnus
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
        
        toast.error(`${productsFound} produits ajoutés. ${productsNotFound} CIPs introuvables - fichier téléchargé.`);
      } else {
        toast.success(`${productsFound} produits importés avec succès.`);
      }
      
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Réactiver l'auto-save après l'import
      setIsImporting(false);
    };
    reader.readAsText(file);
  };





  /**
   * Exporte la commande en cours au format CSV pour envoi aux grossistes.
   * 
   * Formats supportés :
   * - UBIPHARM : format spécifique avec colonnes CIP, Désignation, Quantité
   * - LABOREX : format spécifique adapté au système LABOREX
   * 
   * @param wholesaler - Identifiant du grossiste ('UBIPHARM' ou 'LABOREX')
   */
  const handleCsvExport = (wholesaler: 'UBIPHARM' | 'LABOREX') => {
    if (commandeProduits.length === 0) {
      toast('La commande est vide.', { icon: '⚠️' });
      return;
    }

    let csvContent = ""; // Pas d'en-tête, juste Code;Quantité
    let exportedCount = 0;
    let skippedCount = 0;

    commandeProduits.forEach(item => {
        const product = typeof item.produit === 'object' ? item.produit : produitsList.find(p => p.id === item.produit);
        if (!product) {
            skippedCount++;
            return;
        }

        let code = '';
        if (wholesaler === 'UBIPHARM') {
            code = product.cip1 || '';
        } else if (wholesaler === 'LABOREX') {
            code = product.cip2 || '';
        }

        if (code) {
            const qty = item.quantity || 0;
            // Format: Code;Quantité
            csvContent += `${code};${qty}\n`;
            exportedCount++;
        } else {
            skippedCount++;
        }
    });

    if (exportedCount === 0) {
        toast.error(`Aucun produit n'a de code pour ${wholesaler}. (CIP manquants)`);
        return;
    }

    // Créer et télécharger le fichier
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
        alert(`${exportedCount} lignes exportées.\n${skippedCount} lignes ignorées (Code CIP manquant pour ${wholesaler}).`);
    }
  };


  function handleApplySuggestions(newLines: CommandeProduit[], supplierId: string) {
      // 3. Configurer le mode CREATE
      setCommandeProduits(newLines);
      
      // Si un fournisseur était filtré, le sélectionner pour la commande
      setNewCommandeFournisseurId(supplierId);
      
      setNumeroFacture(''); 
      setIsSuggestionModalOpen(false);
      setViewMode('CREATE');
  }









  // Fonction pour obtenir la classe CSS du badge de statut
  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PREP':
        return 'badge badge-info'; // Bleu - En préparation
      case 'ATT':
        return 'badge badge-warning'; // Orange - En attente
      case 'CLOT':
        return 'badge badge-success'; // Vert - Clôturée
      default:
        return 'badge badge-ghost';
    }
  }

  // Ordre de priorité pour le tri par statut
  const statusOrder: Record<string, number> = { 'PREP': 1, 'ATT': 2, 'CLOT': 3 };

  const sortedCommandes = useMemo(() => {
    // D'abord filtrer par statut si nécessaire
    let filtered = [...commandes];
    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(c => c.status === filterStatus);
    }
    
    // Ensuite trier
    const sorted = filtered.sort((a, b) => {
      let valA, valB;
      if (sortKey === 'numero') {
        // Tri par numéro de facture (ou id si vide)
        valA = a.numero_facture || a.id;
        valB = b.numero_facture || b.id;
      } else if (sortKey === 'date') {
        valA = a.date;
        valB = b.date;
      } else if (sortKey === 'fournisseur') {
        // Cherche le nom du fournisseur
        const fA = fournisseurs.find(f => f.id === a.fournisseur)?.name || '';
        const fB = fournisseurs.find(f => f.id === b.fournisseur)?.name || '';
        valA = fA.toLowerCase();
        valB = fB.toLowerCase();
      } else if (sortKey === 'status') {
        valA = statusOrder[a.status] || 99;
        valB = statusOrder[b.status] || 99;
      }
      if (valA! < valB!) return sortOrder === 'asc' ? -1 : 1;
      if (valA! > valB!) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [commandes, sortKey, sortOrder, fournisseurs, filterStatus]);



  // Ajoutez ce callback pour ajouter le produit créé à la liste et le sélectionner
  // Ajoutez ce callback pour ajouter le produit créé à la liste et le sélectionner
  function handleProduitCreated(produit: ProduitModel) {
    // Products are managed by search hook, will appear automatically on next search
    selectProduct(produit); // Add directly to table
    setSearchProduitQuery(produit.name.substring(0, 3)); // Trigger search to show new product
    setIsCreateProduitModalOpen(false); // Fermer le modal après création
  }



  // Remplacer openAddModal
  function openCreateView(type: 'LOC' | 'DIR' = activeTab) {
    setNewCommandeFournisseurId(fournisseurs.length > 0 ? String(fournisseurs[0].id) : '')
    setNumeroFacture('')
    setCommandeProduits([])
    setSearchProduitQuery('')

    setCommandeType(type);
    
    // Init Euro params
    if (type === 'DIR') {
        setTauxChange('655.957');
        setFraisCoefficient(pharmacySettings?.coefficient_direct_commande || '1.35');
    }

    // Switch view
    setViewMode('CREATE');
    setSelectedCommande(null);
  }

  function openEditView(commande: Commande) {
    // Initialiser le formulaire avec les données de la commande
    setNewCommandeFournisseurId(String(commande.fournisseur));
    setNumeroFacture(commande.numero_facture || '');
    setCommandeType((commande.type as 'LOC' | 'DIR') || 'LOC');
    
    if (commande.type === 'DIR') {
        setTauxChange(commande.taux_change || '655.957');
        setFraisCoefficient(commande.frais_coefficient || pharmacySettings?.coefficient_direct_commande || '1.0');
    }
    
    // Cloner les produits et enrichir les données manquantes
    const enrichedProducts = commande.produits.map(p => {
        const produitId = typeof p.produit === 'object' ? p.produit.id : p.produit;
        const fullProduct = produitsList.find(prod => prod.id === produitId);

        let marge = p.marge;
        const cost = parseFloat(p.price);
        const sell = parseFloat(p.selling_price || '0');
        
        if (!marge && cost > 0 && sell > 0) {
            marge = (sell / cost).toFixed(2);
        }

        return {
            ...p,
            id: p.id,
            produit: fullProduct || p.produit,
            quantity: p.quantity,
            unites_gratuites: p.unites_gratuites || 0,  // NEW: Preserve UG
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

    setViewMode('EDIT');
    // setSelectedCommande restera la commande active
  }

  async function handleViewDetails(commande: Commande) {
    try {
      const response = await axios.get<Commande>(`${commandesEndpoint}${commande.id}/`);
      setSelectedCommande(response.data);
      setViewMode('DETAILS');
    } catch (err) {
      handleApiError(err, "Erreur lors du chargement des détails de la commande");
    }
  }

  function handleBackToList() {
    setViewMode('LIST');
    setSelectedCommande(null);
    setCommandeProduits([]); // Clear temp data
  }

  return (
    <>
      <div className="flex flex-col items-center mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-center mb-4">
              {activeTab === 'DIR' ? t('orders.title_direct') : t('orders.title')}
          </h1>
          
          {!forcedType && (
            <div className="tabs tabs-boxed">
                <a 
                className={`tab ${activeTab === 'LOC' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('LOC')}
                >
                {t('orders.tabs.local')}
                </a> 
                <a 
                className={`tab ${activeTab === 'DIR' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('DIR')}
                >
                {t('orders.tabs.direct')}
                </a>
            </div>
          )}
      </div>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {/* Vue conditionnelle basée sur viewMode */}
      {viewMode === 'LIST' && (
        /* LISTE DES COMMANDES - REFACTOR */
        <CommandeList
          commandes={commandes}
          sortedCommandes={sortedCommandes}
          fournisseurs={fournisseurs}
          loading={loading}
          totalCount={totalCount}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSortChange={(key) => {
            if (key === sortKey) {
              setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
            } else {
              setSortKey(key);
              setSortOrder('desc'); // Default new sort to desc often better for dates/ids
            }
          }}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          selectedOrderIds={selectedOrderIds}
          onToggleOrderSelection={toggleOrderSelection}
          onToggleAllOrdersSelection={toggleAllOrdersSelection}
          canMerge={canMergeSelectedOrders().canMerge}
          mergeReason={canMergeSelectedOrders().reason}
          onOpenMergeModal={openMergeModal}
          onOpenCreateView={() => openCreateView(activeTab)}
          onOpenSuggestionModal={() => setIsSuggestionModalOpen(true)}
          onViewDetails={handleViewDetails}
        />
      )}

      {viewMode === 'DETAILS' && selectedCommande && (
        /* DÉTAILS DE LA COMMANDE */
        <div className="flex flex-col h-full p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-4">
             <button onClick={handleBackToList} className="btn btn-circle btn-sm btn-ghost">←</button>
             <h2 className="text-lg md:text-xl font-bold">Commande #{selectedCommande.numero_facture || selectedCommande.id}</h2>
             <div className="ml-auto flex flex-wrap gap-2">
                  <button 
                    className="btn btn-secondary btn-sm"
                     onClick={() => openEditView(selectedCommande)}
                    disabled={selectedCommande.status === 'CLOT'}
                  >
                    {t('orders.details.edit')}
                  </button>
                  <button 
                    className={`btn btn-sm ${selectedCommande.status === 'ATT' ? 'btn-info' : 'btn-warning'}`}
                    onClick={onMettreEnAttente}
                    disabled={selectedCommande.status === 'CLOT'}
                  >
                    {selectedCommande.status === 'ATT' ? t('orders.details.resume') : t('orders.details.suspend')}
                  </button>
                  <button 
                    className="btn btn-success btn-sm text-white"
                    onClick={onCloture}
                    disabled={selectedCommande.status === 'CLOT'}
                  >
                    {t('orders.details.close')}
                  </button>
                  <button
                    onClick={() => setShowPrintLabelsModal(true)}
                    className="btn btn-primary btn-sm"
                  >
                    {t('orders.details.labels')}
                  </button>
                  
                  <button 
                    className="btn btn-error btn-outline btn-sm"
                    onClick={onDelete}
                  >
                    {t('orders.details.delete')}
                  </button>
                  <button 
                    className="btn btn-primary btn-outline btn-sm"
                    onClick={onImprimer}
                    disabled={selectedCommande.status !== 'CLOT'}
                  >
                    {t('orders.details.print_receipt')}
                  </button>
                  {/* Bouton Annuler Réception - visible uniquement pour commandes clôturées */}
                  {selectedCommande.status === 'CLOT' && (
                    <button 
                      className="btn btn-warning btn-outline btn-sm gap-1"
                      onClick={onAnnulerReception}
                      title={t('orders.details.cancel_reception')}
                    >
                      ↩️ {t('orders.details.cancel_reception')}
                    </button>
                  )}
                  {/* Bouton Créer Avoir (Visible uniquement si commande clôturée) */}
                  {selectedCommande.status === 'CLOT' && (
                       <button
                          type="button"
                          className="btn btn-warning btn-sm btn-outline gap-1"
                          onClick={handleCreateAvoirFromCommande}
                          title={t('orders.details.return')}
                       >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          {selectedRows.size > 0 ? `${t('orders.details.return')} (${selectedRows.size})` : t('orders.details.return')}
                       </button>
                  )}
             </div>
          </div>

          {/* Grid Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded-lg shadow-sm">
            <div>
                <div className="text-xs text-gray-500 uppercase">{t('orders.details.id')}</div>
                <div className="font-bold">{selectedCommande.id}</div>
            </div>
            <div>
                <div className="text-xs text-gray-500 uppercase">{t('orders.details.invoice')}</div>
                <div className="font-bold">{selectedCommande.numero_facture || 'N/A'}</div>
            </div>
            <div>
                <div className="text-xs text-gray-500 uppercase">{t('orders.details.provider')}</div>
                <div className="font-bold">{fournisseurs.find(f => f.id === selectedCommande.fournisseur)?.name ?? `ID: ${selectedCommande.fournisseur}`}</div>
            </div>
            <div>
                 <div className="text-xs text-gray-500 uppercase">{t('orders.details.date')}</div>
                 <div className="font-bold">{new Date(selectedCommande.date).toLocaleDateString('fr-FR')}</div>
            </div>
            <div>
                 <div className="text-xs text-gray-500 uppercase">{t('orders.details.status')}</div>
                 <div><span className={getStatusBadgeClass(selectedCommande.status)}>{selectedCommande.status_display}</span></div>
            </div>
            {selectedCommande.status === 'CLOT' && selectedCommande.closed_by_name && (
                <div>
                    <div className="text-xs text-gray-500 uppercase">{t('orders.details.closed_by')}</div>
                    <div className="font-bold">{selectedCommande.closed_by_name}</div>
                </div>
            )}
            <div className="col-span-2 md:col-span-1 border-l pl-4 border-base-200">
                 <div className="text-xs text-gray-500 uppercase mb-1">{t('orders.details.financial_summary')}</div>
                 {(() => {
                    const stats = (selectedCommande.produits || []).reduce((acc, p) => {
                        const qty = Number(p.quantity || 0);
                        const price = Number(p.price || 0);
                        const tvaRate = Number(p.tva || 0);
                        
                        const lineHT = qty * price;
                        const lineTVA = lineHT * (tvaRate / 100);
                        
                        return { ht: acc.ht + lineHT, tva: acc.tva + lineTVA };
                    }, { ht: 0, tva: 0 });
                    const totalTTC = stats.ht + stats.tva;
                    
                    return (
                        <div className="flex flex-col gap-0.5 text-xs">
                           <div className="flex justify-between">
                                <span className="text-base-content/60">HT:</span> 
                                <span className="font-semibold">{stats.ht.toLocaleString()} F</span>
                           </div>
                           <div className="flex justify-between">
                                <span className="text-base-content/60">TVA:</span> 
                                <span className="font-semibold">{stats.tva.toLocaleString()} F</span>
                           </div>
                           <div className="flex justify-between border-t border-base-200 pt-0.5 mt-0.5">
                                <span className="font-bold text-primary">TTC:</span> 
                                <span className="font-bold text-primary text-sm">{totalTTC.toLocaleString()} F</span>
                           </div>
                        </div>
                    );
                 })()}
            </div>
          </div>

          {/* Récapitulatif UG */}
          {(() => {
            const totalUG = (selectedCommande.produits || []).reduce((sum, p) => sum + (p.unites_gratuites || 0), 0);
            if (totalUG > 0) {
              return (
                <div className="p-4 bg-success/10 border border-success/20 rounded-lg mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                       <span className="text-success font-bold">UG</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-success text-sm">{t('orders.details.ug_title')}</h4>
                      <p className="text-xs text-base-content/70">
                        {t('orders.details.ug_message', { count: totalUG })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}



          {/* Liste des produits (Read Only) */}
          <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col max-h-[calc(100vh-350px)]">
            <div className="overflow-y-auto flex-1">
            {(!selectedCommande.produits || selectedCommande.produits.length === 0) ? (
              <p className="text-base-content/70 text-center py-8 text-sm">{t('orders.details.empty_products')}</p>
            ) : (
                <table className="table table-zebra table-pin-rows">
                  <thead className="bg-base-200">
                    <tr>
                      <th className="w-10">
                        <input 
                            type="checkbox" 
                            className="checkbox checkbox-xs"
                            checked={selectedRows.size === selectedCommande.produits.length && selectedCommande.produits.length > 0}
                            onChange={() => {
                                if (selectedRows.size === selectedCommande.produits.length) {
                                    setSelectedRows(new Set());
                                } else {
                                    setSelectedRows(new Set(selectedCommande.produits.map((_, i) => i)));
                                }
                            }}
                        />
                      </th>
                      <th className="cursor-pointer" onClick={() => { if (detailSortKey === 'name') { setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc'); } else { setDetailSortKey('name'); setDetailSortOrder('asc'); } }}>
                        {t('orders.product_table.headers.product')} {detailSortKey === 'name' && (detailSortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th>{t('orders.product_table.headers.cip')}</th>
                      <th className="text-center">{t('products.table.stock')}</th>
                      <th className="text-center">Rot.</th>
                      <th className="text-right cursor-pointer" onClick={() => { if (detailSortKey === 'quantity') { setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc'); } else { setDetailSortKey('quantity'); setDetailSortOrder('desc'); } }}>
                        {t('orders.product_table.headers.qty')} {detailSortKey === 'quantity' && (detailSortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-center bg-success/5">{t('orders.product_table.headers.ug')}</th>
                      <th className="text-right cursor-pointer" onClick={() => { if (detailSortKey === 'price') { setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc'); } else { setDetailSortKey('price'); setDetailSortOrder('desc'); } }}>
                        {t('orders.details.price_unit')} {detailSortKey === 'price' && (detailSortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th>{t('orders.product_table.headers.lot')}</th>
                      <th>{t('orders.product_table.headers.exp_date')}</th>
                      <th className="text-right">{t('orders.product_table.total_ht')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(selectedCommande.produits || [])]
                      .map((p, originalIndex) => {
                        const produitData = (typeof p.produit === 'object') 
                          ? p.produit 
                          : produitsList.find(prod => prod.id === p.produit);
                        
                        const produitName = (p as any).produit_nom || (produitData?.name || `Produit #${p.produit}`);
                        const cip = (p as any).produit_cip || produitData?.cip1 || '-';
                        
                        return { ...p, produitName, cip, originalIndex };
                      })
                      .sort((a, b) => {
                        let comparison = 0;
                        if (detailSortKey === 'name') {
                          comparison = a.produitName.localeCompare(b.produitName);
                        } else if (detailSortKey === 'quantity') {
                          comparison = Number(a.quantity) - Number(b.quantity);
                        } else if (detailSortKey === 'price') {
                          comparison = Number(a.price) - Number(b.price);
                        }
                        return detailSortOrder === 'asc' ? comparison : -comparison;
                      })
                      .map((p) => {
                        // First check if produit is already an object from backend
                        let produitData: ProduitModel | undefined;
                        if (typeof p.produit === 'object') {
                          produitData = p.produit;
                        } else {
                          produitData = produitsList.find(prod => prod.id === p.produit);
                        }
                        
                        const stock = produitData?.stock ?? ((p as any).produit_stock ?? '-');
                        const stockNum = typeof stock === 'number' ? stock : 0;
                        const rotation = produitData?.rotation_moyenne ?? (p as any).produit_rotation_moyenne;
                        const rotationDisplay = rotation ? parseFloat(String(rotation)).toFixed(1) : '-';
                        
                        const isDeleted = p.produit === null;

                        return (
                        <tr key={p.id} className="hover" onClick={() => toggleRowSelection(p.originalIndex)}>
                          <td>
                            <input 
                                type="checkbox" 
                                className="checkbox checkbox-xs"
                                checked={selectedRows.has(p.originalIndex)}
                                onChange={() => toggleRowSelection(p.originalIndex)}
                                onClick={(e) => e.stopPropagation()} 
                            />
                          </td>
                          <td className={`font-bold ${isDeleted ? 'italic' : ''}`}>
                              {p.produitName}
                              {isDeleted && <span className="text-xs ml-2 opacity-75">(Supprimé)</span>}
                          </td>
                          <td className="font-mono text-xs">{p.cip}</td>
                          <td className="text-center">
                            <span className={`font-mono ${stockNum === 0 ? 'text-error font-bold' : stockNum < 0 ? 'text-error' : 'text-success'}`}>
                              {stock}
                            </span>
                          </td>
                          <td className="text-center font-mono opacity-70">{rotationDisplay}</td>
                          <td className="text-right font-bold">{p.quantity}</td>
                          <td className="text-center bg-success/5">
                            <span className={`font-bold ${(p.unites_gratuites || 0) > 0 ? 'text-success' : 'text-base-content/20'}`}>
                              {p.unites_gratuites || 0}
                            </span>
                          </td>
                          <td className="text-right font-mono">{Number(p.price).toLocaleString()} F</td>
                          <td className="text-xs font-mono">{p.lot || '-'}</td>
                          <td className="text-xs text-gray-400">{p.date_expiration ? (() => { const d = new Date(p.date_expiration); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`; })() : ''}</td>
                          <td className="text-right font-bold text-primary">{(Number(p.quantity) * Number(p.price)).toLocaleString()} F</td>
                        </tr>
                       );
                     })}
                  </tbody>
                </table>
            )}
            </div>
          </div>
        </div>
      )}

      {(viewMode === 'CREATE' || viewMode === 'EDIT') && (
        <CommandeForm
            viewMode={viewMode === 'CREATE' ? 'CREATE' : 'EDIT'}
            selectedCommande={selectedCommande}
            fournisseurs={fournisseurs}
            newCommandeFournisseurId={newCommandeFournisseurId}
            setNewCommandeFournisseurId={setNewCommandeFournisseurId}
            numeroFacture={numeroFacture}
            setNumeroFacture={setNumeroFacture}
            commandeType={commandeType}
            tauxChange={tauxChange}
            setTauxChange={setTauxChange}
            fraisCoefficient={fraisCoefficient}
            setFraisCoefficient={setFraisCoefficient}
            handleBackToList={handleBackToList}
            handleSaveCommande={onSave}
            handleCsvExport={handleCsvExport}
            handleCsvImport={handleCsvImport}
            fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
            setIsCreateProduitModalOpen={setIsCreateProduitModalOpen}
            searchInputRef={searchInputRef as React.RefObject<HTMLInputElement>}
            fournisseurSelectRef={fournisseurSelectRef as React.RefObject<HTMLSelectElement>}
            searchProduitQuery={searchProduitQuery}
            setSearchProduitQuery={setSearchProduitQuery}
            handleSearchKeyDown={handleSearchKeyDown}
            filteredProduits={filteredProduits}
            selectProduct={selectProduct}
            getItemProps={getItemProps}
            
            // Table Props
            commandeProduits={commandeProduits}
            produitsList={produitsList}
            selectedRows={selectedRows}
            saving={saving}
            lastSaved={lastSaved}
            fieldsConfig={fieldsConfig}
            focusedField={focusedField}
            
            toggleRowSelection={toggleRowSelection}
            toggleAllRows={toggleAllRows}
            deleteSelectedRows={deleteSelectedRows}
            openTransferModal={openTransferModal}
            updateCommandeProduitField={updateCommandeProduitField}
            handleTableFieldKeyDown={handleTableFieldKeyDown}
            onRemoveProduct={removeProductFromCommande}
            onCreateAvoir={handleCreateAvoirFromCommande}
        />
      )}




      {/* Modal de Suggestion de Commande (Refactored) */}
      {isSuggestionModalOpen && (
        <SuggestionCommandeModal 
          onClose={() => setIsSuggestionModalOpen(false)}
          onApply={handleApplySuggestions}
          fournisseurs={fournisseurs}
          produitsList={produitsList}
        />
      )}

      <ProduitFormModal
        open={isCreateProduitModalOpen}
        onClose={() => setIsCreateProduitModalOpen(false)}
        produitsEndpoint={produitsEndpoint}
        rayonsEndpoint={rayonsEndpoint}
        fournisseursEndpoint={fournisseursEndpoint}
        onCreated={handleProduitCreated}
        rayons={rayons}
        fournisseurs={fournisseurs}
        formes={formes}
        title="Créer un nouveau produit"
      />

      {/* Print Labels Modal */}
      {showPrintLabelsModal && selectedCommande && (
        <SimplePrintLabelsModal
          commandeId={selectedCommande.id}
          commandeNumero={selectedCommande.numero_facture || `#${selectedCommande.id}`}
          onClose={() => setShowPrintLabelsModal(false)}
        />
      )}

      {/* Password Confirmation Modal */}
      <PasswordConfirmModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={handlePasswordConfirmed}
        title={passwordModalConfig.title}
        message={passwordModalConfig.message}
      />

      {/* Modal de Transfert vers autre Fournisseur (Refactored) */}
      {isTransferModalOpen && (
        <TransferCommandeModal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          selectedProducts={commandeProduits.filter((_, idx) => selectedRows.has(idx))}
          fournisseurs={fournisseurs}
          currentSupplierId={newCommandeFournisseurId}
          produitsList={produitsList}
          apiBaseUrl={apiBaseUrl}
          commandesEndpoint={commandesEndpoint}
          fournisseursEndpoint={fournisseursEndpoint}
          onTransferSuccess={handleTransferSuccess}
        />
      )}

      {/* Modal de Fusion de Commandes (Refactored) */}
      {isMergeModalOpen && (
        <MergeCommandesModal
          isOpen={isMergeModalOpen}
          onClose={() => setIsMergeModalOpen(false)}
          selectedOrderIds={selectedOrderIds}
          fournisseurs={fournisseurs}
          commandesEndpoint={commandesEndpoint}
          apiBaseUrl={apiBaseUrl}
          onMergeSuccess={handleMergeSuccess}
        />
      )}
    </>
  )
}
