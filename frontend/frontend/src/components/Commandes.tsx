import { useEffect, useMemo, useState, type FormEvent, useRef, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../hooks/useConfirm'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext';
import { useSudo } from '../hooks/useSudo'
import { useCommandes, useCommandeFournisseurs, useCommandeRayons } from '../hooks/useCommandes'
import { useCommandeActions } from '../hooks/useCommandeActions'
import { useSearchNavigation } from '../hooks/useSearchNavigation'
import type { Commande, CommandeProduit, ProduitModel } from '../types'
import {  
  normalizeNumberInput
} from '../utils/formatters'
import commandeService from '../services/commandeService'
import produitService from '../services/produitService'
import api from '../services/api'
import CommandeList from './Commandes/CommandeList'
import CommandeForm from './Commandes/CommandeForm'
import CommandeDetails from './Commandes/CommandeDetails'
import SuggestionCommandeModal from './Commandes/SuggestionCommandeModal'
import ProduitFormModal from './ProduitFormModal'
import { useProductSearch } from '../hooks/useProductSearch'
import SimplePrintLabelsModal from './SimplePrintLabelsModal'
import SudoValidationModal from './common/SudoValidationModal'
import TransferCommandeModal from './Commandes/TransferCommandeModal'
import MergeCommandesModal from './Commandes/MergeCommandesModal'
// import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { usePharmacySettings } from '../hooks/usePharmacySettings';
import { useFormes } from '../hooks/useProduits';



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
  
  // Navigation directe vers les détails (ex: depuis Historique Produit)
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
          toast.error("Impossible de charger les détails de cette commande. Elle a peut-être été supprimée.");
        } finally {
          // Nettoyer l'état dans tous les cas pour éviter de réouvrir ou boucler au refresh/navigation
          navigate(location.pathname, { replace: true, state: {} });
        }
      };
      fetchAndShow();
    }
  }, [location.state, navigate, location.pathname]);

  // Champs spécifiques Commandes Directes
  const [tauxChange, setTauxChange] = useState<string>('655.957');
  const [fraisCoefficient, setFraisCoefficient] = useState<string>('1.35');

  const [viewMode, setViewMode] = useState<'LIST' | 'CREATE' | 'DETAILS' | 'EDIT'>('LIST');
  const [newCommandeFournisseurId, setNewCommandeFournisseurId] = useState<string>('')

  // Pagination State
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
  const produitsEndpoint = `${apiBaseUrl}/api/produits/for_import/`;
  const commandesEndpoint = `${apiBaseUrl}/api/commandes/`;
  const fournisseursEndpoint = `${apiBaseUrl}/api/fournisseurs/`;

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
  
  const [commandeSortBy, setCommandeSortBy] = useState<'chrono' | 'stock' | 'name' | 'qty'>('chrono');

  
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

  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [isCreateProduitModalOpen, setIsCreateProduitModalOpen] = useState(false);


  // Etats pour le modal de suggestion de commande
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);

  // Etats pour le modal de transfert vers autre fournisseur (Refactored)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Etats pour la sélection et fusion de commandes
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

  // Filter products for the search in form
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
      confirm: confirm as any, // Cast to any to match useConfirm type
      user
  });

  const { sudoState, requireSudo, closeSudo } = useSudo();

  const [saving, setSaving] = useState(false);

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
           fournisseur: newCommandeFournisseurId ? normalizeNumberInput(newCommandeFournisseurId) : undefined,
           numero_facture: numeroFacture,
           type: commandeType,
           taux_change: commandeType === 'DIR' ? tauxChange : undefined,
           frais_coefficient: commandeType === 'DIR' ? fraisCoefficient : undefined,
      };
      // viewMode is typed as string in state, cast to literal
      const mode = (viewMode === 'CREATE' ? 'CREATE' : 'EDIT') as 'CREATE' | 'EDIT';
      handleSaveCommande(cleanCommande, commandeProduits, mode, selectedCommande);
  };

   const onCloture = async () => {
      if (!selectedCommande) return;

      const confirmed = await confirm({
          title: t('orders.details.close'),
          message: t('orders.messages.close_confirm'),
          confirmText: t('common.actions.confirm')
      });

      if (confirmed) {
          requireSudo(
              (validatorId, password) => handleCloturerCommande(selectedCommande, { 
                  validated_by_id: validatorId, 
                  sudo_password: password 
              }),
              { 
                  permission: 'can_close_commande',
                  title: t('orders.messages.password_confirm_close_title'),
                  message: t('orders.messages.password_confirm_close_body')
              }
          );
      }
  }

  const onDelete = async () => {
      if (!selectedCommande) return;

      const confirmed = await confirm({
          title: t('orders.details.delete'),
          message: t('orders.messages.delete_confirm_body', { id: selectedCommande.id }),
          variant: 'danger',
          confirmText: t('orders.details.delete')
      });

      if (confirmed) {
          requireSudo(
              (validatorId, password) => handleDeleteCommande(selectedCommande, { 
                  validated_by_id: validatorId, 
                  sudo_password: password 
              }),
              { 
                  permission: 'can_delete_commande',
                  title: t('orders.messages.password_confirm_delete_title'),
                  message: t('orders.messages.password_confirm_delete_body')
              }
          );
      }
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
              title: t('orders.messages.password_confirm_cancel_title'),
              message: t('orders.messages.password_confirm_cancel_body')
          }
      );
  }

  const onImprimer = () => {
     if (selectedCommande) handleImprimerReception(selectedCommande);
  }

  const onBulkDelete = async () => {
    if (selectedOrderIds.size === 0) return;

    const confirmed = await confirm({
        title: t('orders.bulk_delete_title'),
        message: t('orders.bulk_delete_confirm', { count: selectedOrderIds.size }),
        variant: 'danger',
        confirmText: t('orders.bulk_delete_btn')
    });

    if (confirmed) {
        await handleBulkDelete(Array.from(selectedOrderIds));
        setSelectedOrderIds(new Set());
    }
  };

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
                 try {
                     const cleanCommande: Partial<Commande> = {
                        fournisseur: newCommandeFournisseurId ? normalizeNumberInput(newCommandeFournisseurId) : undefined,
                        numero_facture: numeroFacture,
                        type: commandeType,
                        taux_change: commandeType === 'DIR' ? tauxChange : undefined,
                        frais_coefficient: commandeType === 'DIR' ? fraisCoefficient : undefined,
                     };
                     
                     const mode = (viewMode === 'CREATE' ? 'CREATE' : 'EDIT') as 'CREATE' | 'EDIT';
                     
                     // Appel avec isAutoSave = true
                     await handleSaveCommande(cleanCommande, commandeProduits, mode, selectedCommande, true);
                     setLastSaved(new Date());
                 } catch (err) {
                     console.error("Auto-save error:", err);
                 } finally {
                     setSaving(false);
                 }
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
          const rate = normalizeNumberInput(tauxChange || '0');
          const coeff = normalizeNumberInput(fraisCoefficient || '0');
          
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
                          const pEuro = normalizeNumberInput(String(item.prix_euro));
                          if (!isNaN(pEuro)) {
                              // 1. Prix Achat FCFA = Euro * Taux
                              const priceFCFA = pEuro * rate;
                              // 2. Prix Revient = Prix Achat * Coeff
                              const costPrice = priceFCFA * coeff;
                              
                              // 3. Update Item - Use integer to avoid floating point comparison issues
                              const newPrice = Math.round(costPrice).toString();
                              
                              // 4. Update Selling Price
                              const currentMargin = normalizeNumberInput(String(item.marge || 1.3));
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
        
        const newLines: CommandeProduit[] = []; // Declare newLines here
        for (const p of data.products) {
          try {
            const fullProduct = await produitService.getById(p.id);
            
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
  }, [location.state, commandeType, tauxChange, fraisCoefficient]); // Added dependencies for loadProducts

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
          // handleBackToList(); // Assuming this function exists
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
                    `input[data-row="${rowIndex}"][data-field="prix_euro"]` // Use actual field name
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
                    `input[data-row="${rowIndex}"][data-field="${fieldsConfig[nextFieldIndex].name}"]` // Use actual field name
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
                    `input[data-row="${rowIndex}"][data-field="${fieldsConfig[prevFieldIndex].name}"]` // Use actual field name
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
              `input[data-row="${rowIndex + 1}"][data-field="${fieldsConfig[fieldIndex].name}"]` // Use actual field name
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
              `input[data-row="${rowIndex - 1}"][data-field="${fieldsConfig[fieldIndex].name}"]` // Use actual field name
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
            currentSupplierId = normalizeNumberInput(newCommandeFournisseurId);
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
      const currentQty = normalizeNumberInput(String(commandeProduits[existingIndex].quantity || 0));
      updateCommandeProduitField(existingIndex, 'quantity', currentQty + 1);

      // Indicateur visuel (scroll)
      setTimeout(() => {
        const row = document.querySelector(`input[data-row="${newRowIndex}"]`);
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const quantityInput = document.querySelector(
          `input[data-row="${newRowIndex}"][data-field="${fieldsConfig[0].name}"]` // Use actual field name
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
        prix_euro: commandeType === 'DIR' ? (product.cost_price ? (normalizeNumberInput(product.cost_price) / normalizeNumberInput(tauxChange)).toFixed(0) : '0') : undefined,
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
           `input[data-row="${newRowIndex}"][data-field="${fieldsConfig[0].name}"]` // Use actual field name
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
    if (selectedOrderIds.size === commandes.length && commandes.length > 0) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(commandes.map(c => c.id)));
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
               const pEuro = normalizeNumberInput(String(newItem.prix_euro || 0));
               const rate = normalizeNumberInput(tauxChange || '655.957'); 
               const coeff = normalizeNumberInput(fraisCoefficient || '1.0');

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
               const price = normalizeNumberInput(String(newItem.price || 0));
               const marge = normalizeNumberInput(String(newItem.marge || 1));
               const tva = normalizeNumberInput(String(newItem.tva || 0));
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
               const price = normalizeNumberInput(String(newItem.price || 0));
               const selling = normalizeNumberInput(String(newItem.selling_price || 0));
               const tva = normalizeNumberInput(String(newItem.tva || 0));
               if (!isNaN(price) && !isNaN(selling) && price > 0) {
                   // Reconvertir TTC en HT puis calculer la marge
                   const sellingHT = selling / (1 + tva / 100);
                   newItem.marge = (sellingHT / price).toFixed(0);
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
                const targetInput = document.querySelector(`input[data-row="${finalIndex}"][data-field="${fieldsConfig[0].name}"]`) as HTMLInputElement; // Use actual field name
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
    let allProducts: ProduitModel[] = [];
    try {
      const response = await api.get(produitsEndpoint);
      allProducts = response.data;
    } catch (err) {
      console.error("Failed to load products for import:", err);
      toast.error(t('orders.messages.import_load_error'));
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

        const qty = normalizeNumberInput(qtyStr) || 1;
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
                const currentQty = normalizeNumberInput(String(currentList[existingIndex].quantity || 0));
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
                  unites_gratuites: 0,
                  prix_euro: commandeType === 'DIR' ? (product.cost_price ? (normalizeNumberInput(product.cost_price) / normalizeNumberInput(tauxChange)).toFixed(0) : '0') : undefined,
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
      
      // If a supplier was filtered, select it for the order
      setNewCommandeFournisseurId(supplierId);
      
      setNumeroFacture(''); 
      setIsSuggestionModalOpen(false);
      setViewMode('CREATE');
  }


  const handleSortChange = useCallback((key: 'numero' | 'date' | 'fournisseur' | 'status') => {
    if (key === sortKey) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc'); // Default new sort to desc often better for dates/ids
    }
  }, [sortKey]);

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
  function handleProduitCreated(produit: ProduitModel) {
    // Products are managed by search hook, will appear automatically on next search
    selectProduct(produit); // Add directly to table
    setSearchProduitQuery(produit.name.substring(0, 3)); // Trigger search to show new product
    setIsCreateProduitModalOpen(false); // Fermer le modal après création
  }

  const handleSortProduits = useCallback((sortBy: 'chrono' | 'stock' | 'name' | 'qty') => {
    setCommandeSortBy(sortBy);
    setCommandeProduits(prev => {
      const sorted = [...prev].sort((a, b) => {
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
        if (sortBy === 'qty') {
          return (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
        }
        return 0;
      });
      return sorted;
    });
    // Clear selection since visual indexes change but selectedRows retains old ones implicitly.
    // Instead of mapping selection, we just clear it.
    setSelectedRows(new Set());
  }, [produitsList]);



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
    setNewCommandeFournisseurId(commande.fournisseur ? String(commande.fournisseur) : '');
    setNumeroFacture(commande.numero_facture || '');
    setCommandeType((commande.type as 'LOC' | 'DIR') || 'LOC');
    
    if (commande.type === 'DIR') {
        setTauxChange(commande.taux_change || '655.957');
        setFraisCoefficient(commande.frais_coefficient || pharmacySettings?.coefficient_direct_commande || '1.0');
    }
    
    // Cloner les produits et enrichir les données manquantes
    const enrichedProducts = commande.produits.map(p => {
        const produitObj = typeof p.produit === 'object' ? p.produit : null;
        const produitId = produitObj ? produitObj.id : p.produit;
        const fullProduct = produitId ? produitsList.find(prod => prod.id === produitId) : null;

        let marge = p.marge;
        const cost = normalizeNumberInput(p.price);
        const sell = normalizeNumberInput(p.selling_price || '0');
        
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
      const data = await commandeService.getById(commande.id);
      setSelectedCommande(data);
      setViewMode('DETAILS');
    } catch (err) {
      toast.error("Erreur lors du chargement des détails");
    }
  }

  function handleBackToList() {
    setViewMode('LIST');
    setSelectedCommande(null);
    setCommandeProduits([]); // Clear temp data
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-base-100">
      <div className="flex flex-col items-center pt-4 mb-4 shrink-0">
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
        <div role="alert" className="alert alert-error mb-4 shrink-0 mx-4 w-auto">
          <span>{error}</span>
        </div>
      )}

      {/* Vue conditionnelle basée sur viewMode */}
      {viewMode === 'LIST' && (
        <div className="flex-1 min-h-0 overflow-hidden">
        {/* LISTE DES COMMANDES - REFACTOR */}
        <CommandeList
          sortedCommandes={sortedCommandes}
          fournisseurs={fournisseurs}
          loading={loading}
          totalCount={totalCount}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          selectedOrderIds={selectedOrderIds}
          onToggleOrderSelection={toggleOrderSelection}
          onToggleAllOrdersSelection={toggleAllOrdersSelection}
          canMerge={canMergeSelectedOrders().canMerge}
          onOpenMergeModal={openMergeModal}
          onOpenCreateView={() => openCreateView(activeTab)}
          onOpenSuggestionModal={() => setIsSuggestionModalOpen(true)}
          onViewDetails={handleViewDetails}
          onBulkDelete={onBulkDelete}
        />
        </div>
      )}

      {viewMode === 'DETAILS' && selectedCommande && (
        <CommandeDetails
          commande={selectedCommande}
          fournisseurs={fournisseurs}
          produitsList={produitsList}
          executingAction={executingAction}
          onBack={handleBackToList}
          onEdit={openEditView}
          onMettreEnAttente={onMettreEnAttente}
          onCloture={onCloture}
          onDelete={onDelete}
          onImprimer={onImprimer}
          onAnnulerReception={onAnnulerReception}
          onCreateAvoir={handleCreateAvoirFromCommande}
          onOpenLabelsModal={() => setShowPrintLabelsModal(true)}
          selectedRows={selectedRows}
          toggleRowSelection={toggleRowSelection}
          setSelectedRows={setSelectedRows}
        />
      )}

      {(viewMode === 'CREATE' || viewMode === 'EDIT') && (
        <div className="flex-1 min-h-0 overflow-hidden">
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
            saving={saving || executingAction}
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
              commandeSortBy={commandeSortBy}
              onSortProduits={handleSortProduits}
              onCloture={viewMode === 'EDIT' ? onCloture : undefined}
              onMettreEnAttente={viewMode === 'EDIT' ? onMettreEnAttente : undefined}
              executingAction={executingAction}
            />
          </div>
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

      {/* Sudo Validation Modal */}
      <SudoValidationModal
        isOpen={sudoState.isOpen}
        onClose={closeSudo}
        onValidate={sudoState.onValidate}
        saving={false}
        title={sudoState.title || "Validation Requise"}
        message={sudoState.message || ""}
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
    </div>
  )
}
