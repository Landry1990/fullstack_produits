import { useEffect, useMemo, useState, type FormEvent, useRef, useCallback } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { useConfirm } from '../hooks/useConfirm'
import type { Fournisseur, ProduitModel, Commande, CommandeProduit, Rayon } from '../types'
import ProduitFormModal from './ProduitFormModal'
import { useSearchNavigation } from '../hooks/useSearchNavigation'
import { useProductSearch } from '../hooks/useProductSearch'
import SimplePrintLabelsModal from './SimplePrintLabelsModal'


export default function Commandes() {
  const confirm = useConfirm()
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCommande, setSelectedCommande] = useState<Commande | null>(null)


  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [rayons, setRayons] = useState<Rayon[]>([])
  const [newCommandeFournisseurId, setNewCommandeFournisseurId] = useState<string>('')


  
  // State for creating commande (single modal)
  const [numeroFacture, setNumeroFacture] = useState('');
  const [commandeProduits, setCommandeProduits] = useState<CommandeProduit[]>([]);
  

  
  // Use product search hook for optimized searching
  const { 
    produits: produitsList, 
    searchQuery: searchProduitQuery,
    setSearchQuery: setSearchProduitQuery
  } = useProductSearch({ minSearchLength: 2, debounceMs: 200 })
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref pour l'input file
  const fournisseurSelectRef = useRef<HTMLSelectElement>(null);


  // States for table navigation and selection
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [focusedField, setFocusedField] = useState<{row: number, field: number} | null>(null);

  const [sortKey, setSortKey] = useState<'numero' | 'date' | 'fournisseur' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showPrintLabelsModal, setShowPrintLabelsModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Tri pour les produits dans la vue détails
  const [detailSortKey, setDetailSortKey] = useState<'name' | 'quantity' | 'price'>('name');
  const [detailSortOrder, setDetailSortOrder] = useState<'asc' | 'desc'>('asc');

  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);



  const [isCreateProduitModalOpen, setIsCreateProduitModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'LIST' | 'CREATE' | 'DETAILS' | 'EDIT'>('LIST');

  // Etats pour le modal de suggestion de commande
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [suggestionParams, setSuggestionParams] = useState({
      periode: 30,
      fournisseurId: '',
      mode: 'optimise' // 'simple' | 'optimise'
  });
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [stepSuggestion, setStepSuggestion] = useState<1 | 2>(1); // 1 = Config, 2 = Résultats
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set()); // Indices sélectionnés





  // Fonction utilitaire pour gérer les erreurs
  const handleApiError = useCallback((err: unknown, defaultMessage: string) => {
    if (axios.isAxiosError(err)) {
      const errorMessage = err.response?.data?.message || err.message || defaultMessage;
      setError(errorMessage);
    } else {
      setError(defaultMessage);
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
  const fournisseursEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/fournisseurs/`
    : '/api/fournisseurs/'
  const rayonsEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/rayons/`
    : '/api/rayons/'
  const produitsEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/produits/`
    : '/api/produits/'

  // Products are already filtered by the hook
  const filteredProduits = produitsList


  useEffect(() => {
    const controller = new AbortController()
    async function fetchInitialData() {
      setLoading(true)
      setError(null)
      try {
        // On récupère les commandes, fournisseurs et rayons (pas les produits - géré par le hook)
        const [commandesResponse, fournisseursResponse, rayonsResponse] = await Promise.all([
          axios.get(commandesEndpoint, { signal: controller.signal }),
          axios.get(fournisseursEndpoint, { signal: controller.signal }),
          axios.get(rayonsEndpoint, { signal: controller.signal }),
        ])
        // Handle paginated responses
        const commandesData: any = commandesResponse.data;
        const fournisseursData: any = fournisseursResponse.data;
        const rayonsData: any = rayonsResponse.data;
        setCommandes(Array.isArray(commandesData) ? commandesData : (commandesData.results || []))
        setFournisseurs(Array.isArray(fournisseursData) ? fournisseursData : (fournisseursData.results || []))
        setRayons(Array.isArray(rayonsData) ? rayonsData : (rayonsData.results || []))
      } catch (err: unknown) {
        if (axios.isCancel(err)) return
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.message ?? err.message ?? 'Erreur réseau')
        } else {
          setError('Erreur inconnue lors du chargement des commandes')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchInitialData()

    return () => controller.abort()
  }, [commandesEndpoint, fournisseursEndpoint, rayonsEndpoint]) // Removed produitsEndpoint

  useEffect(() => {
    if (selectedCommande && !commandes.some(c => c.id === selectedCommande.id)) {
      setSelectedCommande(null)
    }
  }, [commandes, selectedCommande])



  useEffect(() => {
    if (viewMode === 'CREATE' || viewMode === 'EDIT') {
        const timer = setTimeout(() => {
            if (commandeProduits.length > 0) {
                 setSaving(true);
                 setTimeout(() => {
                     setSaving(false);
                     setLastSaved(new Date());
                 }, 600);
            }
        }, 1000);
        return () => clearTimeout(timer);
    }
  }, [commandeProduits, viewMode]);

  // Raccourcis clavier globaux
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignorer si on est dans un input/textarea ou si modal n'est pas ouvert
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
      if (viewMode !== 'CREATE' && viewMode !== 'EDIT') return;
      
      // F2 : Focus recherche produit
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      
      // F4 : Focus fournisseur
      if (e.key === 'F4') {
        e.preventDefault();
        fournisseurSelectRef.current?.focus();
        return;
      }
      
      // Ctrl+A : Sélectionner toutes les lignes
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        setSelectedRows(new Set(commandeProduits.map((_, i) => i)));
        return;
      }
      
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
    { name: 'price', editable: true },
    { name: 'tva', editable: true },
    { name: 'marge', editable: true },
    { name: 'selling_price', editable: true }, 
    { name: 'lot', editable: true },
    { name: 'date_expiration', editable: true },
  ];

  // Navigation clavier dans le tableau
  function handleTableFieldKeyDown(
    e: React.KeyboardEvent,
    rowIndex: number,
    fieldIndex: number
  ) {
    
    const moveToNextField = () => {
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
            }, 0);
        } else {
             // Fin de ligne : vérifier si ligne complète et passer à la suivante
             const row = commandeProduits[rowIndex];
             const isComplete = row && 
               row.quantity > 0 && 
               row.price && 
               parseFloat(String(row.price)) > 0;
               // Lot and Date are optional now

             if (isComplete) {
                if (rowIndex < commandeProduits.length - 1) {
                     // Passer à la ligne suivante, premier champ editable
                     let firstEditableField = 0;
                     while (firstEditableField < fieldsConfig.length && !fieldsConfig[firstEditableField].editable) {
                         firstEditableField++;
                     }
                     
                     setFocusedField({ row: rowIndex + 1, field: firstEditableField });
                     setTimeout(() => {
                       const nextInput = document.querySelector(
                         `input[data-row="${rowIndex + 1}"][data-field="${firstEditableField}"]`
                       ) as HTMLInputElement;
                       nextInput?.focus();
                       nextInput?.select(); // Sélectionner le contenu
                     }, 0);
                } else {
                    // Dernière ligne complète : retourner à la recherche pour ajouter une nouvelle ligne
                    setFocusedField(null);
                    setTimeout(() => {
                        searchInputRef.current?.focus();
                    }, 0);
                }
             }
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

  function selectProduct(product: ProduitModel) {
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
        price: product.cost_price || '0',
        tva: product.tva || '18',
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

  // Fonction pour mettre à jour un champ dans une ligne
  function updateCommandeProduitField(
    index: number,
    field: 'quantity' | 'unites_gratuites' | 'price' | 'tva' | 'marge' | 'selling_price' | 'lot' | 'date_expiration',
    value: string | number
  ) {
    setCommandeProduits(prev => prev.map((item, i) => {
      if (i === index) {
        const newItem = { ...item, [field]: value };
        
        // Recalculer selling_price si price ou marge change
        if (field === 'price' || field === 'marge') {
             const price = parseFloat(String(newItem.price || 0));
             const marge = parseFloat(String(newItem.marge || 1));
             if (!isNaN(price) && !isNaN(marge) && price > 0) {
                 newItem.selling_price = (price * marge).toString();
             }
        }
        // Recalculer marge si selling_price change
        if (field === 'selling_price') {
             const price = parseFloat(String(newItem.price || 0));
             const selling = parseFloat(String(newItem.selling_price || 0));
             if (!isNaN(price) && !isNaN(selling) && price > 0) {
                 newItem.marge = (selling / price).toString();
             }
        }
        return newItem;
      }
      return item;
    }));
  }





  const handleCsvImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/);
      let currentList = [...commandeProduits];
      let productsFound = 0;
      let productsNotFound = 0;

      lines.forEach(line => {
        if (!line.trim()) return;
        const [cip, qtyStr] = line.split(';');
        if (!cip) return;

        const qty = parseInt(qtyStr) || 1;
        const cleanCip = cip.trim();

        // Recherche par CIP (1, 2 ou 3)
        const product = produitsList.find(p => 
          p.cip1 === cleanCip || p.cip2 === cleanCip || p.cip3 === cleanCip
        );

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
                  price: product.cost_price || '0',
                  tva: product.tva || '18',
                  marge: product.taux_marge || '1.3',
                  selling_price: product.selling_price || '0',
                  lot: '',
                  date_expiration: '',
                };
                currentList.push(newCommandeProduit);
            }
        } else {
            console.warn(`Produit avec CIP ${cleanCip} non trouvé.`);
            productsNotFound++;
        }
      });

      setCommandeProduits(currentList);
      
      const message = productsNotFound > 0 
        ? `${productsFound} produits ajoutés. ${productsNotFound} CIPs introuvables.`
        : `${productsFound} produits importés avec succès.`;
      
      toast.success(message);
      
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };





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


  // --- Logique de suggestion ---
  
  async function fetchSuggestions() {
      setLoadingSuggestions(true);
      setError(null);
      try {
          const payload = {
              mode: suggestionParams.mode,
              periode: Number(suggestionParams.periode),
              fournisseur_id: suggestionParams.fournisseurId ? parseInt(suggestionParams.fournisseurId) : null
          };
          
          const response = await axios.post(`${apiBaseUrl ? apiBaseUrl.replace(/\/$/, '') : ''}/api/generer-suggestions/`, payload);
          setSuggestions(response.data.suggestions || []);
          
          // Par défaut, tout sélectionner
          const allIndices = new Set(response.data.suggestions.map((_: any, i: number) => i));
          setSelectedSuggestions(allIndices as Set<number>);
          
          setStepSuggestion(2); // Passer à l'étape résultats
      } catch (err) {
          handleApiError(err, "Erreur lors de la génération des suggestions");
      } finally {
          setLoadingSuggestions(false);
      }
  }

  function handleApplySuggestions() {
      // 1. Filtrer les suggestions sélectionnées
      const selectedItems = suggestions.filter((_, i) => selectedSuggestions.has(i));
      
      if (selectedItems.length === 0) {
          toast('Aucun produit sélectionné.', { icon: '⚠️' });
          return;
      }

      // 2. Convertir en lignes de commande
      const newLines: CommandeProduit[] = selectedItems.map((item: any, index) => {
           // Retrouver l'objet produit complet via la liste chargée (optimisation) ou créer un stub
           // Idéalement on utilise le produit de la liste produitsList si dispo pour avoir toutes les infos (TVA etc)
           const realProduct = produitsList.find(p => p.id === item.produit_id);
           
           let productStub: ProduitModel;
           
           if (realProduct) {
               productStub = realProduct;
           } else {
               productStub = {
                  id: item.produit_id,
                  name: item.produit_nom,
                  cip1: item.produit_ref,
                  stock: item.stock_actuel,
                  cost_price: String(item.prix_achat),
                  selling_price: String(item.prix_achat * 1.3),
                  tva: '18',
                  taux_marge: '1.3'
              } as any;
           }

          return {
              id: Date.now() + index, // Temp ID
              produit: productStub,
              quantity: item.quantite_suggeree,
              unites_gratuites: 0,
              price: String(item.prix_achat || productStub.cost_price || 0),
              tva: productStub.tva || '18',
              marge: productStub.taux_marge || '1.3',
              selling_price: productStub.selling_price || String((item.prix_achat || 0) * 1.3),
              lot: '',
              date_expiration: ''
          };
      });

      // 3. Configurer le mode CREATE
      setCommandeProduits(newLines);
      
      // Si un fournisseur était filtré, le sélectionner pour la commande
      if (suggestionParams.fournisseurId) {
          setNewCommandeFournisseurId(suggestionParams.fournisseurId);
      } else if (selectedItems.length > 0 && selectedItems[0].fournisseur_id) {
          setNewCommandeFournisseurId(String(selectedItems[0].fournisseur_id));
      } else {
        setNewCommandeFournisseurId('');
      }
      
      setNumeroFacture(''); 
      setIsSuggestionModalOpen(false);
      setViewMode('CREATE');
  }

  function toggleSuggestionSelection(index: number) {
      setSelectedSuggestions(prev => {
          const next = new Set(prev);
          if (next.has(index)) next.delete(index);
          else next.add(index);
          return next;
      });
  }


  async function handleSaveCommande(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // Allow empty fournisseur for REASSORT_AUTO orders
    // if (!newCommandeFournisseurId) {
    //   setError('Veuillez sélectionner un fournisseur.')
    //   return
    // }
    if (commandeProduits.length === 0) {
      setError('Veuillez ajouter au moins un produit à la commande.')
      return
    }
    
    try {
      let activeCommandeId: number;

      if (viewMode === 'EDIT' && selectedCommande) {
          // --- MODE MODIFICATION ---
          activeCommandeId = selectedCommande.id;
          
          // 1. Mise à jour de l'en-tête
          await axios.patch<Commande>(`${commandesEndpoint}${activeCommandeId}/`, {
             fournisseur: newCommandeFournisseurId ? parseInt(newCommandeFournisseurId, 10) : null,
             numero_facture: numeroFacture,
          });

          // 2. Synchronisation des produits
          const initialProducts = selectedCommande.produits;
          const currentProducts = commandeProduits;
          const commandeProduitsEndpointBase = apiBaseUrl
             ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/commande-produits/` 
             : '/api/commande-produits/';

          // A. Suppressions (Produits présents initialement mais absents de la liste actuelle)
          // On compare par ID. Les nouveaux produits ont des ID temporels (grands) ou non trouvés.
          const currentIds = new Set(currentProducts.map(p => p.id));
          const toDelete = initialProducts.filter(initP => !currentIds.has(initP.id));
          
          for (const p of toDelete) {
             await axios.delete(`${commandeProduitsEndpointBase}${p.id}/`);
          }

          // B. Ajouts et Modifications
          for (const p of currentProducts) {
             const payload = {
                commande: activeCommandeId,
                produit: typeof p.produit === 'object' ? p.produit.id : p.produit,
                quantity: parseInt(String(p.quantity || 1)),
                unites_gratuites: parseInt(String(p.unites_gratuites || 0)),
                price: parseFloat(String(p.price || 0)).toFixed(2),
                price_cost: parseFloat(String(p.price || 0)).toFixed(2), // Required field
                selling_price: parseFloat(String(p.selling_price || 0)).toFixed(2),
                tva: parseFloat(String(p.tva || 18)).toFixed(2),
                marge: parseFloat(String(p.marge || 1.3)).toFixed(4),
                lot: p.lot || null,
                date_expiration: p.date_expiration || null,
             };

             // Si l'ID existe dans les produits initiaux, c'est une modification
             if (initialProducts.find(initP => initP.id === p.id)) {
                 await axios.patch(`${commandeProduitsEndpointBase}${p.id}/`, payload);
             } else {
                 // Sinon c'est un ajout (POST)
                 await axios.post(commandeProduitsEndpointBase, payload);
             }
          }

      } else {
          // --- MODE CRÉATION ---
          const commandePayload = { 
            fournisseur: newCommandeFournisseurId ? parseInt(newCommandeFournisseurId, 10) : null,
            numero_facture: numeroFacture,
          }
          const { data: createdCommande } = await axios.post<Commande>(commandesEndpoint, commandePayload)
          activeCommandeId = createdCommande.id;
          
          const commandeProduitsEndpoint = apiBaseUrl
            ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/commande-produits/` 
            : '/api/commande-produits/'

          for (const produit of commandeProduits) {
            const produitPayload = {
              commande: activeCommandeId,
              produit: typeof produit.produit === 'object' ? produit.produit.id : produit.produit,
              quantity: parseInt(String(produit.quantity || 1)),
              unites_gratuites: parseInt(String(produit.unites_gratuites || 0)),
              price: parseFloat(String(produit.price || 0)).toFixed(2),
              price_cost: parseFloat(String(produit.price || 0)).toFixed(2), // Required field
              selling_price: parseFloat(String(produit.selling_price || 0)).toFixed(2),
              tva: parseFloat(String(produit.tva || 18)).toFixed(2),
              marge: parseFloat(String(produit.marge || 1.3)).toFixed(4),
              lot: produit.lot || null,
              date_expiration: produit.date_expiration || null,
            };
            await axios.post(commandeProduitsEndpoint, produitPayload);
          }
      }

      // Rafraîchir
      const { data: updatedCommandesData } = await axios.get(commandesEndpoint)
      const updatedCommandes: any = updatedCommandesData;
      const updatedCommandesArray = Array.isArray(updatedCommandes) ? updatedCommandes : (updatedCommandes.results || []);
      setCommandes(updatedCommandesArray)
      
      // Sélectionner la commande (mise à jour ou nouvelle)
      const finalCommande = updatedCommandesArray.find((c: Commande) => c.id === activeCommandeId);
      setSelectedCommande(finalCommande || null);
      
      // Transition vers DETAILS
      setViewMode('DETAILS');

    } catch (err: any) {
      console.error("Erreur lors de l'enregistrement:", err.response?.data);
      handleApiError(err, viewMode === 'EDIT' ? 'Erreur lors de la modification' : 'Erreur lors de la création')
    }
  }



  async function handleMettreEnAttente() {
      if (!selectedCommande) return;
      try {
          // Mise à jour partielle (PATCH) pour changer le statut
          const { data: updated } = await axios.patch<Commande>(`${commandesEndpoint}${selectedCommande.id}/`, { status: selectedCommande.status === 'ATT' ? 'PREP' : 'ATT' });
          
          // Refresh list locally for background
          setCommandes(prev => prev.map(c => c.id === updated.id ? { ...c, status: updated.status, status_display: updated.status_display } : c));
          
          // Maintain products from current selection if full object not returned
          setSelectedCommande({ ...selectedCommande, ...updated });
          
      } catch (err) {
          handleApiError(err, "Erreur lors de la mise en attente");
      }
  }

  async function handleCloturerCommande() {
    if (!selectedCommande) {
      setError("Aucune commande sélectionnée.");
      return;
    }
    if (selectedCommande.status === 'CLOT') {
        setError("Cette commande est déjà clôturée.");
        return;
    }

      try {
        const cloturerEndpoint = `${commandesEndpoint}${selectedCommande.id}/cloturer/`;
        await axios.post(cloturerEndpoint);

        // Fetch full updated details
        const response = await axios.get<Commande>(`${commandesEndpoint}${selectedCommande.id}/`);
        const updated = response.data;
        
        // Refresh list
        setCommandes(prev => prev.map(c => c.id === updated.id ? { ...c, status: updated.status, status_display: updated.status_display } : c));
        setSelectedCommande(updated);

      } catch (err) {
      handleApiError(err, "Erreur lors de la clôture de la commande")
    }
  }

  async function handleDeleteCommande() {
    if (!selectedCommande) {
      setError("Aucune commande sélectionnée.");
      return;
    }

    const confirmed = await confirm({
      title: 'Supprimer la commande',
      message: `Êtes-vous sûr de vouloir supprimer la commande #${selectedCommande.id} ?`,
      variant: 'danger',
      confirmText: 'Supprimer'
    })
    if (confirmed) {
      try {
        await axios.delete(`${commandesEndpoint}${selectedCommande.id}/`);
        setCommandes(prev => prev.filter(c => c.id !== selectedCommande.id));
        setSelectedCommande(null);
      } catch (err) {
        handleApiError(err, "Erreur lors de la suppression de la commande")
      }
    }
  }

  async function handleImprimerReception() {
    if (!selectedCommande) {
      setError("Aucune commande sélectionnée.");
      return;
    }

    try {
      const imprimerEndpoint = `${commandesEndpoint}${selectedCommande.id}/imprimer_reception/`;
      const response = await axios.get(imprimerEndpoint, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reception_commande_${selectedCommande.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      handleApiError(err, "Erreur lors de l\'impression du bon de réception")
    }
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
  function openCreateView() {
    setNewCommandeFournisseurId(fournisseurs.length > 0 ? String(fournisseurs[0].id) : '')
    setNumeroFacture('')
    setCommandeProduits([])
    setSearchProduitQuery('')

    
    // Switch view
    setViewMode('CREATE');
    setSelectedCommande(null);
  }

  function openEditView(commande: Commande) {
    // Initialiser le formulaire avec les données de la commande
    setNewCommandeFournisseurId(String(commande.fournisseur));
    setNumeroFacture(commande.numero_facture || '');
    
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
            price: p.price || (fullProduct?.cost_price || '0'),
            selling_price: p.selling_price || (fullProduct?.selling_price || '0'),
            tva: p.tva || (fullProduct?.tva || '18'),
            marge: marge || (fullProduct?.taux_marge || '1.3'),
            lot: '',
            date_expiration: ''
        };
    });
    
    setCommandeProduits(enrichedProducts); 
    
    setSearchProduitQuery('')

    setViewMode('EDIT');
    // setSelectedCommande restera la commande active
  }

  async function handleViewDetails(commande: Commande) {
    setLoading(true);
    try {
      const response = await axios.get<Commande>(`${commandesEndpoint}${commande.id}/`);
      setSelectedCommande(response.data);
      setViewMode('DETAILS');
    } catch (err) {
      handleApiError(err, "Erreur lors du chargement des détails de la commande");
    } finally {
      setLoading(false);
    }
  }

  function handleBackToList() {
    setViewMode('LIST');
    setSelectedCommande(null);
    setCommandeProduits([]); // Clear temp data
  }

  return (
    <>
      <h1 className="text-3xl font-bold mb-4 text-center">Gestion des Commandes</h1>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {/* Vue conditionnelle basée sur viewMode */}
      {viewMode === 'LIST' && (
        /* LISTE DES COMMANDES */
        <div className="flex flex-col h-full p-4 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h1 className="text-2xl font-bold">Liste des Commandes</h1>
            <div className="flex gap-2 w-full md:w-auto">
                <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => { 
                        setIsSuggestionModalOpen(true); 
                        setStepSuggestion(1); 
                        setSuggestions([]);
                        setSelectedSuggestions(new Set());
                    }}
                >
                    ✨ Suggestions
                </button>
                <button className="btn btn-primary btn-sm" onClick={openCreateView}>+ Créer</button>
            </div>
          </div>
            
            {/* Tri et Filtres */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Trier par:</span>
              <button 
                className={`btn btn-xs ${sortKey === 'numero' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setSortKey('numero'); setSortOrder(prev => sortKey === 'numero' ? (prev === 'asc' ? 'desc' : 'asc') : 'desc'); }}
              >
                N° {sortKey === 'numero' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button 
                className={`btn btn-xs ${sortKey === 'date' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setSortKey('date'); setSortOrder(prev => sortKey === 'date' ? (prev === 'asc' ? 'desc' : 'asc') : 'desc'); }}
              >
                Date {sortKey === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button 
                className={`btn btn-xs ${sortKey === 'fournisseur' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setSortKey('fournisseur'); setSortOrder(prev => sortKey === 'fournisseur' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'); }}
              >
                Fournisseur {sortKey === 'fournisseur' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button 
                className={`btn btn-xs ${sortKey === 'status' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setSortKey('status'); setSortOrder(prev => sortKey === 'status' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'); }}
              >
                Statut {sortKey === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              
              <div className="divider divider-horizontal mx-2"></div>
              
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filtrer:</span>
              <button 
                className={`btn btn-xs ${filterStatus === 'ALL' ? 'btn-neutral' : 'btn-ghost'}`}
                onClick={() => setFilterStatus('ALL')}
              >
                Tous ({commandes.length})
              </button>
              <button 
                className={`btn btn-xs gap-1 ${filterStatus === 'PREP' ? 'btn-info' : 'btn-ghost'}`}
                onClick={() => setFilterStatus('PREP')}
              >
                <span className="w-2 h-2 rounded-full bg-info"></span>
                En prép. ({commandes.filter(c => c.status === 'PREP').length})
              </button>
              <button 
                className={`btn btn-xs gap-1 ${filterStatus === 'ATT' ? 'btn-warning' : 'btn-ghost'}`}
                onClick={() => setFilterStatus('ATT')}
              >
                <span className="w-2 h-2 rounded-full bg-warning"></span>
                En attente ({commandes.filter(c => c.status === 'ATT').length})
              </button>
              <button 
                className={`btn btn-xs gap-1 ${filterStatus === 'CLOT' ? 'btn-success' : 'btn-ghost'}`}
                onClick={() => setFilterStatus('CLOT')}
              >
                <span className="w-2 h-2 rounded-full bg-success"></span>
                Clôturées ({commandes.filter(c => c.status === 'CLOT').length})
              </button>
            </div>

            {loading && <div className="flex justify-center p-8"><span className="loading loading-spinner"></span></div>}

            <div className="overflow-x-auto bg-white rounded-lg shadow">
              <table className="table table-zebra w-full">
                <thead className="bg-base-200">
                  <tr>
                    <th>ID</th>
                    <th>N° Facture</th>
                    <th>Date</th>
                    <th>Fournisseur</th>
                    <th>Statut</th>
                    <th className="text-right">Total (F)</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCommandes.map(commande => (
                    <tr key={commande.id} className="hover">
                      <td className="font-mono font-bold text-xs opacity-50">#{commande.id}</td>
                      <td className="font-mono">{commande.numero_facture || '-'}</td>
                      <td>{new Date(commande.date).toLocaleDateString('fr-FR')}</td>
                      <td className="font-bold">{fournisseurs.find(f => f.id === commande.fournisseur)?.name ?? `ID: ${commande.fournisseur}`}</td>
                      <td><span className={getStatusBadgeClass(commande.status)}>{commande.status_display}</span></td>
                      <td className="font-bold text-right text-primary">{commande.total} F</td>
                      <td className="text-center">
                        {/* Actions groupées si nécessaire ou simple bouton voir */}
                        <button 
                          className="btn btn-ghost btn-xs"
                          onClick={() => handleViewDetails(commande)}
                        >
                          Voir Détails
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sortedCommandes.length === 0 && (
                      <tr>
                          <td colSpan={7} className="text-center py-8 text-gray-400">Aucune commande trouvée</td>
                      </tr>
                  )}
                </tbody>
              </table>
            </div>
        </div>
      )}

      {viewMode === 'DETAILS' && selectedCommande && (
        /* DÉTAILS DE LA COMMANDE */
        <div className="flex flex-col h-full p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-4">
             <button onClick={handleBackToList} className="btn btn-circle btn-sm btn-ghost">←</button>
             <h2 className="text-xl font-bold">Commande #{selectedCommande.numero_facture || selectedCommande.id}</h2>
             <div className="ml-auto flex flex-wrap gap-2">
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => openEditView(selectedCommande)}
                    disabled={selectedCommande.status === 'CLOT'}
                  >
                    Modifier
                  </button>
                  <button 
                    className={`btn btn-sm ${selectedCommande.status === 'ATT' ? 'btn-info' : 'btn-warning'}`}
                    onClick={handleMettreEnAttente}
                    disabled={selectedCommande.status === 'CLOT'}
                  >
                    {selectedCommande.status === 'ATT' ? 'Reprendre' : 'Mettre en attente'}
                  </button>
                  <button 
                    className="btn btn-success btn-sm text-white"
                    onClick={handleCloturerCommande}
                    disabled={selectedCommande.status === 'CLOT'}
                  >
                    Clôturer
                  </button>
                  <button
                    onClick={() => setShowPrintLabelsModal(true)}
                    className="btn btn-primary btn-sm"
                  >
                    Étiquettes
                  </button>
                  
                  <button 
                    className="btn btn-error btn-outline btn-sm"
                    onClick={() => {
                        handleDeleteCommande().then(() => setViewMode('LIST'));
                    }}
                  >
                    Supprimer
                  </button>
                  <button 
                    className="btn btn-primary btn-outline btn-sm"
                    onClick={handleImprimerReception}
                    disabled={selectedCommande.status !== 'CLOT'}
                  >
                    Imprimer Bon
                  </button>
             </div>
          </div>

          {/* Grid Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded-lg shadow-sm">
            <div>
                <div className="text-xs text-gray-500 uppercase">ID Commande</div>
                <div className="font-bold">{selectedCommande.id}</div>
            </div>
            <div>
                <div className="text-xs text-gray-500 uppercase">N° Facture</div>
                <div className="font-bold">{selectedCommande.numero_facture || 'N/A'}</div>
            </div>
            <div>
                <div className="text-xs text-gray-500 uppercase">Fournisseur</div>
                <div className="font-bold">{fournisseurs.find(f => f.id === selectedCommande.fournisseur)?.name ?? `ID: ${selectedCommande.fournisseur}`}</div>
            </div>
            <div>
                 <div className="text-xs text-gray-500 uppercase">Date</div>
                 <div className="font-bold">{new Date(selectedCommande.date).toLocaleDateString('fr-FR')}</div>
            </div>
            <div>
                 <div className="text-xs text-gray-500 uppercase">Statut</div>
                 <div><span className={getStatusBadgeClass(selectedCommande.status)}>{selectedCommande.status_display}</span></div>
            </div>
            <div>
                 <div className="text-xs text-gray-500 uppercase">Total</div>
                 <div className="font-bold text-lg text-primary">
                    {(selectedCommande.produits || []).reduce((acc, p) => acc + (Number(p.quantity) * Number(p.price)), 0).toLocaleString()} F
                 </div>
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
                      <h4 className="font-semibold text-success text-sm">Unités Gratuites (UG)</h4>
                      <p className="text-xs text-base-content/70">
                        Cette commande contient <span className="font-bold text-success">{totalUG}</span> unité{totalUG > 1 ? 's' : ''} gratuite{totalUG > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}



          {/* Liste des produits (Read Only) */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {(!selectedCommande.produits || selectedCommande.produits.length === 0) ? (
              <p className="text-base-content/70 text-center py-8 text-sm">Aucun produit dans cette commande.</p>
            ) : (
                <table className="table table-zebra">
                  <thead className="bg-base-200">
                    <tr>
                      <th className="cursor-pointer" onClick={() => { if (detailSortKey === 'name') { setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc'); } else { setDetailSortKey('name'); setDetailSortOrder('asc'); } }}>
                        Produit {detailSortKey === 'name' && (detailSortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-center">Stock</th>
                      <th className="text-center">Rot.</th>
                      <th className="text-right cursor-pointer" onClick={() => { if (detailSortKey === 'quantity') { setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc'); } else { setDetailSortKey('quantity'); setDetailSortOrder('desc'); } }}>
                        Qté {detailSortKey === 'quantity' && (detailSortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-center bg-success/5">UG</th>
                      <th className="text-right cursor-pointer" onClick={() => { if (detailSortKey === 'price') { setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc'); } else { setDetailSortKey('price'); setDetailSortOrder('desc'); } }}>
                        P.U. {detailSortKey === 'price' && (detailSortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th>Lot</th>
                      <th>Expiration</th>
                      <th className="text-right">Sous-total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(selectedCommande.produits || [])]
                      .map(p => {
                        // Use produit_nom from backend if available, otherwise fallback to resolving from produitsList
                        const produitName = (p as any).produit_nom || (typeof p.produit === 'object' 
                          ? p.produit.name 
                          : produitsList.find(prod => prod.id === p.produit)?.name || `Produit #${p.produit}`);
                        return { ...p, produitName };
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
                      .map(p => {
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
                        
                        return (
                        <tr key={p.id} className="hover">
                          <td className="font-bold">{p.produitName}</td>
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
                          <td className="text-xs text-gray-400">{p.date_expiration ? new Date(p.date_expiration).toLocaleDateString() : ''}</td>
                          <td className="text-right font-bold text-primary">{(Number(p.quantity) * Number(p.price)).toLocaleString()} F</td>
                        </tr>
                       );
                     })}
                  </tbody>
                </table>
            )}
          </div>
        </div>
      )}

      {(viewMode === 'CREATE' || viewMode === 'EDIT') && (
        /* VUE CRÉATION (Full Page) */
        <div className="flex flex-col h-[calc(100vh-100px)]">
          <div className="flex items-center justify-between mb-4 shrink-0">
             <div className="flex items-center gap-4">
                <button 
                  onClick={handleBackToList}
                  className="btn btn-circle btn-ghost btn-sm"
                  title="Retour à la liste"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <h3 className="font-bold text-xl">
                      {viewMode === 'EDIT' && selectedCommande 
                        ? `Modifier Commande #${selectedCommande.numero_facture || selectedCommande.id}` 
                        : 'Nouvelle Commande'}
                  </h3>
                  <div className="flex gap-4 text-xs text-base-content/50 mt-1">
                    <span className="flex items-center gap-1"><kbd className="kbd kbd-xs font-sans">F2</kbd> Recherche</span>
                    <span className="flex items-center gap-1"><kbd className="kbd kbd-xs font-sans">F4</kbd> Fournisseur</span>
                    <span className="flex items-center gap-1"><kbd className="kbd kbd-xs font-sans">Ctrl+A</kbd> Select All</span>
                  </div>
                </div>
            </div>
          </div>
          
          
          <form 
            className="flex-1 flex flex-col min-h-0" 
            onSubmit={handleSaveCommande}
          > 
 
            {/* Section supérieure : Informations et Recherche */}
            <div className="shrink-0 space-y-4 mb-4">
              {/* Informations de la commande */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-base-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="form-control w-full">
                    <div className="label py-1">
                      <span className="label-text text-xs font-bold text-base-content/50 uppercase tracking-wider">Fournisseur (F4) *</span>
                    </div>
                    <select
                      ref={fournisseurSelectRef}
                      className="select select-bordered w-full select-sm bg-base-50 focus:bg-white"
                      value={newCommandeFournisseurId}
                      onChange={(e) => setNewCommandeFournisseurId(e.target.value)}
                      required
                    >
                      <option value="" disabled>Sélectionnez un fournisseur</option>
                      {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </label>
                  
                  <label className="form-control w-full">
                    <div className="label py-1">
                      <span className="label-text text-xs font-bold text-base-content/50 uppercase tracking-wider">Numéro de facture</span>
                    </div>
                    <input 
                      type="text"
                      placeholder="Ex: FAC-2024-001"
                      className="input input-bordered w-full input-sm bg-base-50 focus:bg-white"
                      value={numeroFacture}
                      onChange={(e) => setNumeroFacture(e.target.value)}
                    />
                  </label>

                  <div className="flex items-end justify-end gap-2">
                    {/* Export Dropdown */}
                    <div className="dropdown dropdown-end">
                      <div tabIndex={0} role="button" className="btn btn-sm btn-ghost border-base-300">
                        📤 Exporter CSV
                      </div>
                      <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 border border-base-200">
                        <li><a onClick={() => handleCsvExport('UBIPHARM')}>Ubipharm (CIP1)</a></li>
                        <li><a onClick={() => handleCsvExport('LABOREX')}>Laborex (CIP2)</a></li>
                      </ul>
                    </div>

                    <input 
                        type="file" 
                        accept=".csv"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleCsvImport}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      📂 Importer CSV
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setIsCreateProduitModalOpen(true)}
                    >
                      + Nouveau produit
                    </button>
                  </div>
                </div>
              </div>

              {/* Recherche produit */}
              <div className="bg-white rounded-xl shadow-sm border border-base-200 p-4 relative">
                <label className="label py-1 mb-2">
                  <span className="label-text text-xs font-bold text-base-content/50 uppercase tracking-wider">Rechercher un produit (F2)</span>
                </label>
                <div className="relative">
                  <input 
                    ref={searchInputRef}
                    type="text" 
                    placeholder="Tapez pour rechercher par nom ou CIP..."
                    className="input input-bordered w-full pl-12 text-base h-12 bg-base-50 focus:bg-white focus:ring-2 focus:ring-primary/20"
                    value={searchProduitQuery}
                      onChange={(e) => setSearchProduitQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                
                {/* Dropdown résultats */}
                {searchProduitQuery && (
                  <div className="absolute left-4 right-4 top-full mt-2 bg-white rounded-xl shadow-xl border border-base-200 max-h-96 overflow-y-auto z-50">
                    {filteredProduits.length === 0 ? (
                      <div className="text-center py-8 text-base-content/40 text-sm">
                        Aucun produit trouvé
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {filteredProduits.map((p, idx) => {
                          const itemProps = getItemProps(idx);
                          return (
                          <div 
                            key={p.id}
                            {...itemProps}
                            onClick={() => selectProduct(p)}
                            style={itemProps.style}
                            className={`
                              group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all
                              ${itemProps.className ? 'shadow-md' : 'hover:bg-base-100'}
                            `}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate text-sm">{p.name}</div>
                              <div className="text-xs flex gap-3 mt-0.5 opacity-80">
                                <span>Stock: {p.stock}</span>
                                <span>Prix: {p.selling_price} F</span>
                                {(p.cip1 || p.cip2 || p.cip3) && (
                                  <span>CIP: {p.cip1 || p.cip2 || p.cip3}</span>
                                )}
                              </div>
                            </div>
                            <div className={`opacity-0 group-hover:opacity-100 ${itemProps.className ? 'opacity-100' : ''}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                              </svg>
                            </div>
                          </div>
                        )})}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tableau des produits avec édition inline */}
            <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl shadow-sm border border-base-200">
              <div className="p-4 border-b border-base-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                  <h2 className="font-bold text-lg text-base-content">
                    Produits ({commandeProduits.length})
                  </h2>
                  <div className="flex items-center gap-4">
                      {saving && <span className="text-sm text-warning animate-pulse">Sauvegarde...</span>}
                      {!saving && lastSaved && <span className="text-xs text-success">Enregistré à {lastSaved.toLocaleTimeString()}</span>}
                      <div className="text-xl md:text-2xl font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg">
                        Total : {commandeProduits.reduce((acc, p) => acc + (Number(p.price || 0) * Number(p.quantity || 0)), 0).toLocaleString('fr-FR')} F
                      </div>
                  </div>
                </div>
                {selectedRows.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-base-content/70">{selectedRows.size} sélectionné(s)</span>
                    <button
                      type="button"
                      className="btn btn-error btn-xs"
                      onClick={deleteSelectedRows}
                    >
                      Supprimer sélection
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-x-auto overflow-y-auto">
                {commandeProduits.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-base-content/30 gap-4 py-12">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="font-light">Commencez par rechercher et ajouter des produits (F2)</p>
                  </div>
                ) : (
                  <table className="table table-pin-rows w-full">
                    <thead>
                      <tr className="bg-base-50 text-xs uppercase tracking-wider text-base-content/60 font-semibold border-b border-base-200">
                        <th className="bg-base-50 w-12">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs"
                            checked={selectedRows.size === commandeProduits.length && commandeProduits.length > 0}
                            onChange={toggleAllRows}
                          />
                        </th>
                        <th className="bg-base-200 pl-4 font-semibold text-xs uppercase">Produit</th>
                        <th className="bg-base-200 text-right w-24 font-semibold text-xs uppercase">Qté</th>
                        <th className="bg-base-200 text-center w-20 bg-success/10 font-semibold text-xs uppercase text-success">UG</th>
                        <th className="bg-base-200 text-right w-32 font-semibold text-xs uppercase">Prix Achat HT</th>
                        <th className="bg-base-200 text-right w-24 font-semibold text-xs uppercase">TVA</th>
                        <th className="bg-base-200 text-right w-24 font-semibold text-xs uppercase">Marge</th>
                        <th className="bg-base-200 text-right w-32 font-semibold text-xs uppercase">Prix Vente</th>
                        <th className="bg-base-200 text-left w-32 font-semibold text-xs uppercase">Lot</th>
                        <th className="bg-base-200 text-left w-36 font-semibold text-xs uppercase">Date Exp</th>
                        <th className="bg-base-200 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {commandeProduits.map((p, index) => (
                        <tr 
                          key={p.id} 
                          className={`hover:bg-base-50/50 group border-b border-base-100 last:border-0 ${selectedRows.has(index) ? 'bg-primary/5' : ''}`}
                        >
                          <td>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-xs"
                              checked={selectedRows.has(index)}
                              onChange={() => toggleRowSelection(index)}
                            />
                          </td>
                          <td className="pl-4 py-2 md:py-3">
                            <div className="font-medium text-base">
                              {(() => {
                                // Try to get product name from different sources
                                if (typeof p.produit === 'object' && p.produit.name) {
                                  return p.produit.name;
                                }
                                // Check if there's a produit_nom field from API
                                if ((p as any).produit_nom) {
                                  return (p as any).produit_nom;
                                }
                                // Try to find in produitsList
                                const produitId = typeof p.produit === 'object' ? p.produit.id : p.produit;
                                const found = produitsList.find(prod => prod.id === produitId);
                                if (found) {
                                  return found.name;
                                }
                                // Last resort: show ID
                                return `Produit #${produitId}`;
                              })()}
                            </div>
                          </td>
                          {/* Quantity (0) */}
                          <td className="text-right py-2 md:py-3">
                            <input
                              type="text"
                              data-row={index}
                              data-field={0}
                              value={p.quantity}
                              onChange={(e) => updateCommandeProduitField(index, 'quantity', e.target.value)}
                              onKeyDown={(e) => handleTableFieldKeyDown(e, index, 0)}
                              className={`input input-ghost input-sm text-base w-full text-right font-medium focus:bg-base-100 focus:text-primary ${!fieldsConfig[0].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                              autoFocus={focusedField?.row === index && focusedField?.field === 0}
                              readOnly={!fieldsConfig[0].editable}
                              tabIndex={!fieldsConfig[0].editable ? -1 : 0}
                            />
                          </td>
                          {/* Unites Gratuites (1) - NEW */}
                          <td className="text-center py-2 md:py-3">
                            <input
                              type="text"
                              inputMode="numeric"
                              data-row={index}
                              data-field={1}
                              value={p.unites_gratuites || 0}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (/^\d*$/.test(val)) {
                                  updateCommandeProduitField(index, 'unites_gratuites', val === '' ? 0 : parseInt(val));
                                }
                              }}
                              onKeyDown={(e) => handleTableFieldKeyDown(e, index, 1)}
                              className={`input input-ghost input-sm text-sm w-full text-center font-medium bg-success/10 focus:bg-success/20 focus:text-success ${!fieldsConfig[1].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                              placeholder="0"
                              autoFocus={focusedField?.row === index && focusedField?.field === 1}
                              readOnly={!fieldsConfig[1].editable}
                              tabIndex={!fieldsConfig[1].editable ? -1 : 0}
                            />
                          </td>
                          {/* Price (2) - Index updated */}
                          <td className="text-right py-2 md:py-3">
                            <input
                              type="text"
                              data-row={index}
                              data-field={2}
                              value={p.price}
                              onChange={(e) => updateCommandeProduitField(index, 'price', e.target.value)}
                              onKeyDown={(e) => handleTableFieldKeyDown(e, index, 2)}
                              className={`input input-ghost input-sm text-base w-full text-right focus:bg-base-100 focus:text-primary ${!fieldsConfig[2].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                              autoFocus={focusedField?.row === index && focusedField?.field === 2}
                              readOnly={!fieldsConfig[2].editable}
                              tabIndex={!fieldsConfig[2].editable ? -1 : 0}
                            />
                          </td>
                          {/* TVA (3) - Index updated */}
                          <td className="text-right py-2 md:py-3">
                            <input
                              type="text"
                              data-row={index}
                              data-field={3}
                              value={p.tva || ''}
                              onChange={(e) => updateCommandeProduitField(index, 'tva', e.target.value)}
                              onKeyDown={(e) => handleTableFieldKeyDown(e, index, 3)}
                              className={`input input-ghost input-sm text-base w-full text-right focus:bg-base-100 focus:text-primary ${!fieldsConfig[3].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                              autoFocus={focusedField?.row === index && focusedField?.field === 3}
                              readOnly={!fieldsConfig[3].editable}
                              tabIndex={!fieldsConfig[3].editable ? -1 : 0}
                            />
                          </td>
                          {/* Marge (4) - Index updated */}
                          <td className="text-right py-2 md:py-3">
                            <input
                              type="text"
                              data-row={index}
                              data-field={4}
                              value={p.marge || ''}
                              onChange={(e) => updateCommandeProduitField(index, 'marge', e.target.value)}
                              onKeyDown={(e) => handleTableFieldKeyDown(e, index, 4)}
                              className={`input input-ghost input-sm text-base w-full text-right focus:bg-base-100 focus:text-primary ${!fieldsConfig[4].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                              autoFocus={focusedField?.row === index && focusedField?.field === 4}
                              readOnly={!fieldsConfig[4].editable}
                              tabIndex={!fieldsConfig[4].editable ? -1 : 0}
                            />
                          </td>
                          {/* Selling Price (5) - Index updated */}
                          <td className="text-right py-2 md:py-3">
                            <input
                              type="text"
                              data-row={index}
                              data-field={5}
                              value={p.selling_price}
                              onChange={(e) => updateCommandeProduitField(index, 'selling_price', e.target.value)}
                              onKeyDown={(e) => handleTableFieldKeyDown(e, index, 5)}
                              className={`input input-ghost input-sm text-base w-full text-right focus:bg-base-100 focus:text-primary ${!fieldsConfig[5].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                              autoFocus={focusedField?.row === index && focusedField?.field === 5}
                              readOnly={!fieldsConfig[5].editable}
                              tabIndex={!fieldsConfig[5].editable ? -1 : 0}
                            />
                          </td>
                          {/* Lot (6) - Index updated */}
                          <td className="text-left py-2 md:py-3">
                            <input
                              type="text"
                              data-row={index}
                              data-field={6}
                              value={p.lot || ''}
                              onChange={(e) => updateCommandeProduitField(index, 'lot', e.target.value)}
                              onKeyDown={(e) => handleTableFieldKeyDown(e, index, 6)}
                              className={`input input-ghost input-sm text-base w-full focus:bg-base-100 focus:text-primary ${!fieldsConfig[6].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                              placeholder="Lot"
                              autoFocus={focusedField?.row === index && focusedField?.field === 6}
                              readOnly={!fieldsConfig[6].editable}
                              tabIndex={!fieldsConfig[6].editable ? -1 : 0}
                            />
                          </td>
                          {/* Expiration (7) - Index updated */}
                          <td className="text-left py-2 md:py-3">
                            <input
                              type="date"
                              data-row={index}
                              data-field={7}
                              value={p.date_expiration || ''}
                              onChange={(e) => updateCommandeProduitField(index, 'date_expiration', e.target.value)}
                              onKeyDown={(e) => handleTableFieldKeyDown(e, index, 7)}
                              className={`input input-ghost input-sm text-base w-full focus:bg-base-100 focus:text-primary ${!fieldsConfig[7].editable ? 'bg-base-200 cursor-not-allowed' : ''}`}
                              autoFocus={focusedField?.row === index && focusedField?.field === 7}
                              readOnly={!fieldsConfig[7].editable}
                              tabIndex={!fieldsConfig[7].editable ? -1 : 0}
                            />
                          </td>
                          <td className="text-center py-3">
                            <button
                              type="button"
                              onClick={() => removeProductFromCommande(index)}
                              className="btn btn-ghost btn-xs text-error/50 hover:text-error btn-square opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Actions */} 
            <div className="modal-action pt-4">
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={handleBackToList}
              >
                Annuler
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={commandeProduits.length === 0}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {viewMode === 'EDIT' ? 'Enregistrer les modifications' : 'Créer la commande'}
              </button>
            </div>
          </form>
        </div>
      )}



      {/* Modal de Suggestion de Commande */}
      {isSuggestionModalOpen && (
          <div className="modal modal-open">
              <div className="modal-box w-11/12 max-w-5xl h-[80vh] flex flex-col p-0 overflow-hidden">
                  <div className="p-4 border-b bg-base-100 shrink-0 flex justify-between items-center">
                      <h3 className="font-bold text-lg">Générateur de commande intelligent</h3>
                      <button className="btn btn-sm btn-circle btn-ghost" onClick={() => setIsSuggestionModalOpen(false)}>✕</button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 bg-base-200/50">
                      {stepSuggestion === 1 ? (
                          <div className="card bg-base-100 shadow-sm max-w-2xl mx-auto">
                              <div className="card-body">
                                  <h4 className="card-title text-base mb-4">Paramètres de l'analyse</h4>
                                  
                                  <div className="form-control mb-4">
                                      <label className="label font-medium">Fournisseur</label>
                                      <select 
                                          className="select select-bordered w-full"
                                          value={suggestionParams.fournisseurId}
                                          onChange={(e) => setSuggestionParams(prev => ({ ...prev, fournisseurId: e.target.value }))}
                                      >
                                          <option value="">Tous les fournisseurs</option>
                                          {fournisseurs.map(f => (
                                              <option key={f.id} value={f.id}>{f.name}</option>
                                          ))}
                                      </select>
                                      <label className="label text-xs text-base-content/60">
                                          Si sélectionné, seuls les produits de ce fournisseur seront analysés.
                                      </label>
                                  </div>

                                  <div className="form-control mb-4">
                                      <label className="label font-medium">Période d'analyse (jours)</label>
                                      <input 
                                          type="number" 
                                          className="input input-bordered w-full"
                                          value={suggestionParams.periode}
                                          onChange={(e) => setSuggestionParams(prev => ({ ...prev, periode: parseInt(e.target.value) || 30 }))}
                                      />
                                      <label className="label text-xs text-base-content/60">
                                          Base de calcul pour la moyenne des ventes (ex: 30 derniers jours).
                                      </label>
                                  </div>

                                  <div className="form-control mb-6">
                                      <label className="label font-medium">Mode de calcul</label>
                                      <div className="flex gap-4">
                                          <label className="label cursor-pointer justify-start gap-3 border p-3 rounded-lg flex-1 bg-base-50 hover:bg-base-100 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                              <input 
                                                  type="radio" 
                                                  name="mode" 
                                                  className="radio radio-primary" 
                                                  checked={suggestionParams.mode === 'simple'}
                                                  onChange={() => setSuggestionParams(prev => ({ ...prev, mode: 'simple' }))}
                                              />
                                              <div>
                                                  <span className="font-semibold block">Réassort Simple</span>
                                                  <span className="text-xs opacity-75">Commande ce qui a été vendu (Ventes - Stock)</span>
                                              </div>
                                          </label>
                                          <label className="label cursor-pointer justify-start gap-3 border p-3 rounded-lg flex-1 bg-base-50 hover:bg-base-100 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                              <input 
                                                  type="radio" 
                                                  name="mode" 
                                                  className="radio radio-primary" 
                                                  checked={suggestionParams.mode === 'optimise'}
                                                  onChange={() => setSuggestionParams(prev => ({ ...prev, mode: 'optimise' }))}
                                              />
                                              <div>
                                                  <span className="font-semibold block">Analyse Intelligente</span>
                                                  <span className="text-xs opacity-75">Basé sur rotation, couverture et stock de sécurité.</span>
                                              </div>
                                          </label>
                                      </div>
                                  </div>

                                  <div className="card-actions justify-end mt-4">
                                      <button 
                                          className="btn btn-primary w-full md:w-auto"
                                          onClick={fetchSuggestions}
                                          disabled={loadingSuggestions}
                                      >
                                          {loadingSuggestions ? <span className="loading loading-spinner"></span> : '🔍 Lancer l\'analyse'}
                                      </button>
                                  </div>
                              </div>
                          </div>
                      ) : (
                          /* STEP 2 : RÉSULTATS */
                          <div className="flex flex-col h-full gap-4">
                              <div className="alert alert-info shadow-sm text-sm py-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                  <div>
                                      <span className="font-bold">{suggestions.length} produits suggérés.</span> 
                                      {suggestions.length === 0 ? " Aucun produit à commander selon les critères." : " Vérifiez les quantités avant de valider."}
                                  </div>
                              </div>

                              {suggestions.length > 0 && (
                                  <div className="flex-1 overflow-auto border rounded-box bg-base-100">
                                      <table className="table table-pin-rows">
                                          <thead>
                                              <tr>
                                                  <th>
                                                      <label>
                                                          <input 
                                                              type="checkbox" 
                                                              className="checkbox" 
                                                              checked={selectedSuggestions.size === suggestions.length && suggestions.length > 0}
                                                              onChange={() => {
                                                                  if (selectedSuggestions.size === suggestions.length) {
                                                                      setSelectedSuggestions(new Set());
                                                                  } else {
                                                                      const all = new Set(suggestions.map((_, i) => i));
                                                                      setSelectedSuggestions(all);
                                                                  }
                                                              }}
                                                          />
                                                      </label>
                                                  </th>
                                                  <th>Produit</th>
                                                  <th className="text-center">Stock</th>
                                                  <th className="text-center">Ventes (Période)</th>
                                                  {suggestionParams.mode === 'optimise' && <th className="text-center">Note</th>}
                                                  <th className="text-right">Proposition</th>
                                                  <th className="text-right">Prix Achat</th>
                                                  <th>Raison</th>
                                              </tr>
                                          </thead>
                                          <tbody>
                                              {suggestions.map((item, index) => (
                                                  <tr key={index} className="hover:bg-base-50" onClick={() => toggleSuggestionSelection(index)}>
                                                      <td>
                                                          <label>
                                                              <input 
                                                                  type="checkbox" 
                                                                  className="checkbox" 
                                                                  checked={selectedSuggestions.has(index)}
                                                                  onChange={() => toggleSuggestionSelection(index)}
                                                              />
                                                          </label>
                                                      </td>
                                                      <td>
                                                          <div className="font-bold">{item.produit_nom}</div>
                                                          <div className="text-xs opacity-50">{item.produit_ref}</div>
                                                      </td>
                                                      <td className="text-center font-mono">{item.stock_actuel}</td>
                                                      <td className="text-center font-mono">{item.ventes_periode}</td>
                                                      {suggestionParams.mode === 'optimise' && (
                                                          <td className="text-center">
                                                              {item.score_urgence > 50 && <span className="badge badge-error badge-xs">Critique</span>}
                                                          </td>
                                                      )}
                                                      <td className="text-right font-bold text-primary text-lg">
                                                          {item.quantite_suggeree}
                                                      </td>
                                                      <td className="text-right opacity-70">
                                                          {item.prix_achat} F
                                                      </td>
                                                      <td className="text-xs max-w-xs truncate" title={item.raison}>
                                                          {item.raison}
                                                      </td>
                                                  </tr>
                                              ))}
                                          </tbody>
                                      </table>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>

                  <div className="p-4 border-t bg-base-100 shrink-0 flex justify-between">
                      {stepSuggestion === 2 ? (
                          <button className="btn btn-ghost" onClick={() => setStepSuggestion(1)}>⬅️ Paramètres</button>
                      ) : (
                         <div></div>
                      )}
                      
                      {stepSuggestion === 2 && (
                          <div className="flex gap-2">
                              <button className="btn btn-ghost" onClick={() => setIsSuggestionModalOpen(false)}>Annuler</button>
                              <button 
                                  className="btn btn-primary" 
                                  onClick={handleApplySuggestions}
                                  disabled={selectedSuggestions.size === 0}
                              >
                                  Créer Commande ({selectedSuggestions.size})
                              </button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
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
    </>
  )
}
