
import { useEffect, useMemo, useState, type FormEvent, useRef, useCallback } from 'react'
import axios from 'axios'
import type { Fournisseur, ProduitModel, Commande, CommandeProduit, Rayon } from '../types'
import ProduitFormModal from './ProduitFormModal'

export default function Commandes() {
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCommande, setSelectedCommande] = useState<Commande | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false)
  const [isAddProductsModalOpen, setIsAddProductsModalOpen] = useState<boolean>(false)
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [rayons, setRayons] = useState<Rayon[]>([])
  const [newCommandeFournisseurId, setNewCommandeFournisseurId] = useState<string>('')

  // State for editing commande
  const [editCommandeFournisseurId, setEditCommandeFournisseurId] = useState<string>('')
  const [editNumeroFacture, setEditNumeroFacture] = useState<string>('')
  
  // State for creating commande (single modal)
  const [numeroFacture, setNumeroFacture] = useState('');
  const [commandeProduits, setCommandeProduits] = useState<CommandeProduit[]>([]);
  
  // State for adding products to existing commande
  const [productsToAdd, setProductsToAdd] = useState<CommandeProduit[]>([]);
  
  // State for the product search/addition form
  const [produitsList, setProduitsList] = useState<ProduitModel[]>([]); // To hold all products for searching
  const [searchProduitQuery, setSearchProduitQuery] = useState('');
  const [selectedProduitToAdd, setSelectedProduitToAdd] = useState<ProduitModel | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fournisseurSelectRef = useRef<HTMLSelectElement>(null);
  const [lineItem, setLineItem] = useState({
    quantity: '1',
    price: '', // prix achat
    selling_price: '',
    lot: '',
    date_expiration: '',
  });

  // States for table navigation and selection
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [focusedField, setFocusedField] = useState<{row: number, field: number} | null>(null);

  const [sortKey, setSortKey] = useState<'numero' | 'date' | 'fournisseur'>('date');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');

  // Tri pour les produits dans la vue détails
  const [detailSortKey, setDetailSortKey] = useState<'name' | 'quantity' | 'price'>('name');
  const [detailSortOrder, setDetailSortOrder] = useState<'asc' | 'desc'>('asc');

  const [isCreateProduitModalOpen, setIsCreateProduitModalOpen] = useState(false);

  // Fonction utilitaire pour valider les champs obligatoires
  const validateProductFields = useCallback((quantity: string, price: string, selling_price: string) => {
    if (!quantity || !price || !selling_price) {
      return "Veuillez remplir tous les champs obligatoires (quantité, prix d'achat, prix de vente).";
    }
    if (parseInt(quantity, 10) <= 0) {
      return "La quantité doit être supérieure à 0.";
    }
    if (parseFloat(price) <= 0) {
      return "Le prix d'achat doit être supérieur à 0.";
    }
    if (parseFloat(selling_price) <= 0) {
      return "Le prix de vente doit être supérieur à 0.";
    }
    return null;
  }, []);

  // Fonction utilitaire pour créer un objet CommandeProduit
  const createCommandeProduit = useCallback((produit: ProduitModel, lineItem: any) => ({
    id: Date.now(), // ID temporaire
    produit,
    quantity: parseInt(lineItem.quantity, 10),
    price: lineItem.price,
    selling_price: lineItem.selling_price,
    lot: lineItem.lot,
    date_expiration: lineItem.date_expiration,
  }), []);

  // Fonction utilitaire pour reset le formulaire de produit
  const resetProductForm = useCallback(() => {
    setSelectedProduitToAdd(null);
    setLineItem({
      quantity: '1',
      price: '',
      selling_price: '',
      lot: '',
      date_expiration: '',
    });
  }, []);

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

  // Filtrer les produits selon la recherche
  const filteredProduits = useMemo(() => {
    if (!searchProduitQuery.trim()) return [];
    
    const query = searchProduitQuery.toLowerCase();
    return produitsList.filter(p => 
      p.name.toLowerCase().includes(query) ||
      [p.cip1, p.cip2, p.cip3].some(cip => (cip || '').toLowerCase().includes(query))
    );
  }, [produitsList, searchProduitQuery]);


  useEffect(() => {
    const controller = new AbortController()
    async function fetchInitialData() {
      setLoading(true)
      setError(null)
      try {
        // On récupère les commandes et les fournisseurs en parallèle
        const [commandesResponse, fournisseursResponse, produitsResponse, rayonsResponse] = await Promise.all([
          axios.get(commandesEndpoint, { signal: controller.signal }),
          axios.get(fournisseursEndpoint, { signal: controller.signal }),
          axios.get(produitsEndpoint, { signal: controller.signal }),
          axios.get(rayonsEndpoint, { signal: controller.signal }),
        ])
        // Handle paginated responses
        const commandesData: any = commandesResponse.data;
        const fournisseursData: any = fournisseursResponse.data;
        const produitsData: any = produitsResponse.data;
        const rayonsData: any = rayonsResponse.data;
        setCommandes(Array.isArray(commandesData) ? commandesData : (commandesData.results || []))
        setFournisseurs(Array.isArray(fournisseursData) ? fournisseursData : (fournisseursData.results || []))
        setProduitsList(Array.isArray(produitsData) ? produitsData : (produitsData.results || []))
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
  }, [commandesEndpoint, fournisseursEndpoint, produitsEndpoint, rayonsEndpoint]) // Dépendances de l'effet

  useEffect(() => {
    if (selectedCommande && !commandes.some(c => c.id === selectedCommande.id)) {
      setSelectedCommande(null)
    }
  }, [commandes, selectedCommande])

  // Définir les fonctions de fermeture avant le useEffect qui les utilise
  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false)
    setSearchProduitQuery('')
    setHighlightedIndex(-1)
    setCommandeProduits([])
    setSelectedRows(new Set())
    setFocusedField(null)
    resetProductForm()
  }, [resetProductForm])

  const closeAddProductsModal = useCallback(() => {
    setIsAddProductsModalOpen(false)
    setProductsToAdd([])
    setSearchProduitQuery('')
    setHighlightedIndex(-1)
    resetProductForm()
  }, [resetProductForm])

  // Raccourcis clavier globaux
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignorer si on est dans un input/textarea ou si modal n'est pas ouvert
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
      if (!isAddModalOpen && !isAddProductsModalOpen) return;
      
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
        if (isAddModalOpen) {
          closeAddModal();
        } else if (isAddProductsModalOpen) {
          closeAddProductsModal();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isAddModalOpen, isAddProductsModalOpen, commandeProduits, selectedRows, closeAddModal, closeAddProductsModal])

  function openAddModal() {
    setNewCommandeFournisseurId(fournisseurs.length > 0 ? String(fournisseurs[0].id) : '')
    setNumeroFacture('')
    setCommandeProduits([])
    setSearchProduitQuery('')
    setHighlightedIndex(-1)
    resetProductForm()
    setIsAddModalOpen(true)
  }

  function openEditModal() {
    if (!selectedCommande) return
    setEditCommandeFournisseurId(String(selectedCommande.fournisseur))
    setEditNumeroFacture(selectedCommande.numero_facture || '')
    setIsEditModalOpen(true)
  }

  function closeEditModal() {
    setIsEditModalOpen(false)
    setEditCommandeFournisseurId('')
    setEditNumeroFacture('')
  }

  function openAddProductsModal() {
    if (!selectedCommande) return
    setProductsToAdd([])
    setSearchProduitQuery('')
    setHighlightedIndex(-1)
    resetProductForm()
    setIsAddProductsModalOpen(true)
  }

  // Fonctions de navigation au clavier pour la recherche
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!searchProduitQuery) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredProduits.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredProduits.length) {
          const selectedProduct = filteredProduits[highlightedIndex];
          selectProduct(selectedProduct);
        }
        break;
      case 'Escape':
        setSearchProduitQuery('');
        setHighlightedIndex(-1);
        break;
    }
  }

  // Navigation clavier dans le tableau
  function handleTableFieldKeyDown(
    e: React.KeyboardEvent,
    rowIndex: number,
    fieldIndex: number
  ) {
    const fieldsPerRow = 5; // Quantité (0), Prix achat (1), Prix vente (2), Lot (3), Date exp (4)
    
    switch (e.key) {
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (fieldIndex < fieldsPerRow - 1) {
          // Passer au champ suivant
          setFocusedField({ row: rowIndex, field: fieldIndex + 1 });
          // Focus sur le champ suivant après le rendu
          setTimeout(() => {
            const nextInput = document.querySelector(
              `input[data-row="${rowIndex}"][data-field="${fieldIndex + 1}"]`
            ) as HTMLInputElement;
            nextInput?.focus();
          }, 0);
        } else {
          // Dernier champ : vérifier si ligne complète et passer à la suivante
          const row = commandeProduits[rowIndex];
          const isComplete = row && 
            row.quantity > 0 && 
            row.price && 
            parseFloat(String(row.price)) > 0 &&
            row.selling_price && 
            parseFloat(String(row.selling_price)) > 0;
          
          if (isComplete && rowIndex < commandeProduits.length - 1) {
            // Passer à la ligne suivante, premier champ
            setFocusedField({ row: rowIndex + 1, field: 0 });
            setTimeout(() => {
              const nextInput = document.querySelector(
                `input[data-row="${rowIndex + 1}"][data-field="0"]`
              ) as HTMLInputElement;
              nextInput?.focus();
            }, 0);
          } else if (isComplete) {
            // Dernière ligne complète : retourner à la recherche
            setFocusedField(null);
            setTimeout(() => {
              searchInputRef.current?.focus();
            }, 0);
          }
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
        e.preventDefault();
        if (fieldIndex < fieldsPerRow - 1) {
          setFocusedField({ row: rowIndex, field: fieldIndex + 1 });
          setTimeout(() => {
            const nextInput = document.querySelector(
              `input[data-row="${rowIndex}"][data-field="${fieldIndex + 1}"]`
            ) as HTMLInputElement;
            nextInput?.focus();
          }, 0);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (fieldIndex > 0) {
          setFocusedField({ row: rowIndex, field: fieldIndex - 1 });
          setTimeout(() => {
            const nextInput = document.querySelector(
              `input[data-row="${rowIndex}"][data-field="${fieldIndex - 1}"]`
            ) as HTMLInputElement;
            nextInput?.focus();
          }, 0);
        }
        break;
    }
  }

  function selectProduct(product: ProduitModel) {
    // Ajouter directement au tableau avec valeurs par défaut
    const newCommandeProduit: CommandeProduit = {
      id: Date.now(), // ID temporaire
      produit: product,
      quantity: 1,
      price: product.cost_price || '0',
      selling_price: product.selling_price || '0',
      lot: '',
      date_expiration: '',
    };
    
    setCommandeProduits(prev => [...prev, newCommandeProduit]);
    
    // Focus sur le champ quantité de la nouvelle ligne
    const newRowIndex = commandeProduits.length;
    setFocusedField({ row: newRowIndex, field: 0 }); // 0 = quantité
    
    // Reset recherche
    setSearchProduitQuery('');
    setHighlightedIndex(-1);
    setSelectedProduitToAdd(null);
    
    // Remettre focus sur recherche pour ajouter rapidement un autre produit
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  }

  async function addProductToCommande() {
    if (!selectedProduitToAdd) {
      setError("Aucun produit sélectionné.");
      return;
    }

    // Validation des champs obligatoires
    const validationError = validateProductFields(lineItem.quantity, lineItem.price, lineItem.selling_price);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      // Créer un objet CommandeProduit temporaire pour l'affichage
      const tempCommandeProduit = createCommandeProduit(selectedProduitToAdd, lineItem);

      // Ajouter à la liste des produits de la commande
      setCommandeProduits(prev => [...prev, tempCommandeProduit]);

      // Reset form
      resetProductForm();
    } catch (err) {
      handleApiError(err, "Erreur lors de l'ajout du produit.");
    }
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
    field: 'quantity' | 'price' | 'selling_price' | 'lot' | 'date_expiration',
    value: string | number
  ) {
    setCommandeProduits(prev => prev.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  }

  function addProductToExistingCommande() {
    if (!selectedProduitToAdd) {
      setError("Aucun produit sélectionné.");
      return;
    }

    // Validation des champs obligatoires
    const validationError = validateProductFields(lineItem.quantity, lineItem.price, lineItem.selling_price);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      // Créer un objet CommandeProduit temporaire pour l'affichage
      const tempCommandeProduit = createCommandeProduit(selectedProduitToAdd, lineItem);

      // Ajouter à la liste des produits à ajouter
      setProductsToAdd(prev => [...prev, tempCommandeProduit]);

      // Reset form
      resetProductForm();
    } catch (err) {
      handleApiError(err, "Erreur lors de l'ajout du produit.");
    }
  }

  function removeProductFromProductsToAdd(index: number) {
    setProductsToAdd(prev => prev.filter((_, i) => i !== index));
  }

  async function handleAddProductsToCommande() {
    if (!selectedCommande) {
      setError('Aucune commande sélectionnée.');
      return;
    }
    if (productsToAdd.length === 0) {
      setError('Aucun produit à ajouter.');
      return;
    }

    try {
      const commandeProduitsEndpoint = apiBaseUrl
        ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/commande-produits/` 
        : '/api/commande-produits/'

      // Ajouter tous les produits à la commande
      for (const produit of productsToAdd) {
        const produitPayload = {
          commande: selectedCommande.id,
          produit: produit.produit.id,
          quantity: produit.quantity,
          price: produit.price,
          price_cost: produit.price,
          selling_price: produit.selling_price,
          lot: produit.lot || null,
          date_expiration: produit.date_expiration || null,
        };
        await axios.post(commandeProduitsEndpoint, produitPayload);
      }

      // Rafraîchir la liste des commandes
      const { data: updatedCommandesData } = await axios.get(commandesEndpoint)
      const updatedCommandes: any = updatedCommandesData;
      const updatedCommandesArray = Array.isArray(updatedCommandes) ? updatedCommandes : (updatedCommandes.results || []);
      setCommandes(updatedCommandesArray)
      
      // Mettre à jour la commande sélectionnée
      const updatedCommande = updatedCommandesArray.find((c: Commande) => c.id === selectedCommande.id)
      setSelectedCommande(updatedCommande || null)
      
      // Fermer le modal
      closeAddProductsModal()
    } catch (err) {
      handleApiError(err, 'Erreur lors de l\'ajout des produits')
    }
  }

  async function handleAddCommande(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!newCommandeFournisseurId) {
      setError('Veuillez sélectionner un fournisseur.')
      return
    }
    if (commandeProduits.length === 0) {
      setError('Veuillez ajouter au moins un produit à la commande.')
      return
    }
    
    try {
      // Créer la commande
      const commandePayload = { 
        fournisseur: parseInt(newCommandeFournisseurId, 10),
        numero_facture: numeroFacture,
      }
      const { data: createdCommande } = await axios.post<Commande>(commandesEndpoint, commandePayload)
      
      // Ajouter tous les produits à la commande
      const commandeProduitsEndpoint = apiBaseUrl
        ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/commande-produits/` 
        : '/api/commande-produits/'

      for (const produit of commandeProduits) {
        const produitPayload = {
          commande: createdCommande.id,
          produit: produit.produit.id,
          quantity: produit.quantity,
          price: produit.price,
          price_cost: produit.price,
          selling_price: produit.selling_price,
          lot: produit.lot || null,
          date_expiration: produit.date_expiration || null,
        };
        await axios.post(commandeProduitsEndpoint, produitPayload);
      }

      // Rafraîchir la liste des commandes
      const { data: updatedCommandesData } = await axios.get(commandesEndpoint)
      const updatedCommandes: any = updatedCommandesData;
      const updatedCommandesArray = Array.isArray(updatedCommandes) ? updatedCommandes : (updatedCommandes.results || []);
      setCommandes(updatedCommandesArray)
      
      // Sélectionner la nouvelle commande
      const newCommandeWithProducts = updatedCommandesArray.find((c: Commande) => c.id === createdCommande.id)
      setSelectedCommande(newCommandeWithProducts || null)
      
      // Fermer le modal
      closeAddModal()
    } catch (err) {
      handleApiError(err, 'Erreur lors de la création de la commande')
    }
  }

  async function handleEditCommande(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedCommande) {
      setError('Aucune commande sélectionnée.')
      return
    }
    if (!editCommandeFournisseurId) {
      setError('Veuillez sélectionner un fournisseur.')
      return
    }
    try {
      const payload = { 
        fournisseur: parseInt(editCommandeFournisseurId, 10),
        numero_facture: editNumeroFacture,
      }
      const { data: updatedCommande } = await axios.patch<Commande>(
        `${commandesEndpoint}${selectedCommande.id}/`,
        payload
      )
      setCommandes(prev => 
        prev.map(c => (c.id === updatedCommande.id ? updatedCommande : c))
      )
      setSelectedCommande(updatedCommande)
      closeEditModal()
    } catch (err) {
      handleApiError(err, 'Erreur lors de la modification de la commande')
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

      // Refresh the data to get updated stock and status
      const controller = new AbortController()
      const [commandesResponse, produitsResponse] = await Promise.all([
        axios.get(commandesEndpoint, { signal: controller.signal }),
        axios.get(produitsEndpoint, { signal: controller.signal }),
      ])
      // Handle paginated responses
      const commandesData: any = commandesResponse.data;
      const produitsData: any = produitsResponse.data;
      const commandesArray = Array.isArray(commandesData) ? commandesData : (commandesData.results || []);
      const produitsArray = Array.isArray(produitsData) ? produitsData : (produitsData.results || []);
      setCommandes(commandesArray)
      setProduitsList(produitsArray)
      setSelectedCommande(commandesArray.find((c: Commande) => c.id === selectedCommande.id) ?? null)

    } catch (err) {
      handleApiError(err, "Erreur lors de la clôture de la commande")
    }
  }

  async function handleDeleteCommande() {
    if (!selectedCommande) {
      setError("Aucune commande sélectionnée.");
      return;
    }

    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la commande #${selectedCommande.id} ?`)) {
      try {
        await axios.delete(`${commandesEndpoint}${selectedCommande.id}/`);
        setCommandes(prev => prev.filter(c => c.id !== selectedCommande.id));
        setSelectedCommande(null);
      } catch (err) {
        handleApiError(err, "Erreur lors de la suppression de la commande")
      }
    }
  }

  async function handleGenerateReplenishment() {
    setLoading(true);
    setError(null);
    try {
      const replenishmentEndpoint = `${commandesEndpoint}generate_replenishment/`;
      const response = await axios.post(replenishmentEndpoint);
      
      if (response.data.commandes && response.data.commandes.length > 0) {
        alert(response.data.detail);
        // Refresh commandes
        const { data: updatedCommandesData } = await axios.get(commandesEndpoint);
        const updatedCommandes: any = updatedCommandesData;
        setCommandes(Array.isArray(updatedCommandes) ? updatedCommandes : (updatedCommandes.results || []));
      } else {
        alert(response.data.detail || "Aucune commande générée.");
      }
    } catch (err) {
      handleApiError(err, "Erreur lors de la génération du réapprovisionnement");
    } finally {
      setLoading(false);
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


  const sortedCommandes = useMemo(() => {
    const sorted = [...commandes].sort((a, b) => {
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
      }
      if (valA! < valB!) return sortOrder === 'asc' ? -1 : 1;
      if (valA! > valB!) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [commandes, sortKey, sortOrder, fournisseurs]);


  // Ajoutez ce callback pour ajouter le produit créé à la liste et le sélectionner
  function handleProduitCreated(produit: ProduitModel) {
    setProduitsList(prev => [...prev, produit]);
    setSelectedProduitToAdd(produit);
    setSearchProduitQuery('');
    setHighlightedIndex(-1);
    setIsCreateProduitModalOpen(false); // Fermer le modal après création
  }


  return (
    <>
      <h1 className="text-3xl font-bold mb-4 text-center">Gestion des Commandes</h1>

      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}


      {/* Vue conditionnelle: Liste OU Détails */}
      {!selectedCommande ? (
        /* LISTE DES COMMANDES */
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title">Liste des commandes</h2>
              <div className="card-actions">
                {loading && <span className="loading loading-spinner loading-sm" />}
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={handleGenerateReplenishment}
                  disabled={loading}
                >
                  {loading && <span className="loading loading-spinner loading-sm" />}
                  Générer Réapprovisionnement
                </button>
                <button className="btn btn-primary btn-sm" onClick={openAddModal}>+ Créer</button>
              </div>
            </div>
            
            {/* Tri */}
            <div className="flex gap-2 mb-4">
              <button 
                className={`btn btn-xs ${sortKey === 'numero' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSortKey('numero')}
              >
                Trier par N°
              </button>
              <button 
                className={`btn btn-xs ${sortKey === 'date' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSortKey('date')}
              >
                Trier par Date
              </button>
              <button 
                className={`btn btn-xs ${sortKey === 'fournisseur' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSortKey('fournisseur')}
              >
                Trier par Fournisseur
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>N° Facture</th>
                    <th>Date</th>
                    <th>Fournisseur</th>
                    <th>Statut</th>
                    <th>Total (F)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCommandes.map(commande => (
                    <tr key={commande.id} className="hover">
                      <td>{commande.numero_facture || commande.id}</td>
                      <td>{new Date(commande.date).toLocaleDateString('fr-FR')}</td>
                      <td>{fournisseurs.find(f => f.id === commande.fournisseur)?.name ?? `ID: ${commande.fournisseur}`}</td>
                      <td><span className="badge badge-ghost">{commande.status_display}</span></td>
                      <td className="font-semibold">{commande.total} F</td>
                      <td>
                        <button 
                          className="btn btn-ghost btn-xs"
                          onClick={() => setSelectedCommande(commande)}
                        >
                          👁️ Voir détails
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* DÉTAILS DE LA COMMANDE */
        <div className="space-y-4">
          {/* Bouton retour */}
          <button 
            onClick={() => setSelectedCommande(null)}
            className="btn btn-outline btn-sm gap-2"
          >
            ⬅️ Retour à la liste
          </button>

          {/* Informations de la commande */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <h2 className="card-title">Détails de la commande #{selectedCommande.numero_facture || selectedCommande.id}</h2>
                <div className="flex flex-wrap gap-2">
                  <button 
                    className="btn btn-info btn-sm"
                    onClick={openAddProductsModal}
                    disabled={selectedCommande.status === 'CLOT'}
                  >
                    ➕ Ajouter produits
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={openEditModal}
                    disabled={selectedCommande.status === 'CLOT'}
                  >
                    ✏️ Modifier
                  </button>
                  <button 
                    className="btn btn-success btn-sm"
                    onClick={handleCloturerCommande}
                    disabled={selectedCommande.status === 'CLOT'}
                  >
                    ✅ Clôturer
                  </button>
                  <button 
                    className="btn btn-error btn-sm"
                    onClick={handleDeleteCommande}
                  >
                    🗑️ Supprimer
                  </button>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={handleImprimerReception}
                    disabled={selectedCommande.status !== 'CLOT'}
                  >
                    🖨️ Imprimer
                  </button>
                </div>
              </div>

              {/* Informations générales */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-base-200 rounded-lg mb-4">
                <div>
                  <span className="font-semibold text-xs">ID Commande</span>
                  <p className="text-lg">{selectedCommande.id}</p>
                </div>
                <div>
                  <span className="font-semibold text-xs">N° Facture</span>
                  <p className="text-lg">{selectedCommande.numero_facture || 'N/A'}</p>
                </div>
                <div>
                  <span className="font-semibold text-xs">Fournisseur</span>
                  <p className="text-lg">{fournisseurs.find(f => f.id === selectedCommande.fournisseur)?.name ?? `ID: ${selectedCommande.fournisseur}`}</p>
                </div>
                <div>
                  <span className="font-semibold text-xs">Date</span>
                  <p className="text-lg">{new Date(selectedCommande.date).toLocaleDateString('fr-FR')}</p>
                </div>
                <div>
                  <span className="font-semibold text-xs">Statut</span>
                  <p className="text-lg"><span className="badge badge-ghost">{selectedCommande.status_display}</span></p>
                </div>
                <div>
                  <span className="font-semibold text-xs">Total</span>
                  <p className="text-2xl font-bold text-primary">{selectedCommande.total} F</p>
                </div>
              </div>

              {/* Liste des produits */}
              <div>
                <h3 className="font-semibold mb-3">Produits commandés</h3>
                {selectedCommande.produits.length === 0 ? (
                  <p className="text-base-content/70 text-center py-8">Aucun produit dans cette commande.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th 
                            className="cursor-pointer hover:bg-base-200"
                            onClick={() => {
                              if (detailSortKey === 'name') {
                                setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc');
                              } else {
                                setDetailSortKey('name');
                                setDetailSortOrder('asc');
                              }
                            }}
                          >
                            Produit {detailSortKey === 'name' && (detailSortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th 
                            className="cursor-pointer hover:bg-base-200"
                            onClick={() => {
                              if (detailSortKey === 'quantity') {
                                setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc');
                              } else {
                                setDetailSortKey('quantity');
                                setDetailSortOrder('desc');
                              }
                            }}
                          >
                            Quantité {detailSortKey === 'quantity' && (detailSortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th 
                            className="cursor-pointer hover:bg-base-200"
                            onClick={() => {
                              if (detailSortKey === 'price') {
                                setDetailSortOrder(detailSortOrder === 'asc' ? 'desc' : 'asc');
                              } else {
                                setDetailSortKey('price');
                                setDetailSortOrder('desc');
                              }
                            }}
                          >
                            Prix Unitaire {detailSortKey === 'price' && (detailSortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th>Sous-total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...selectedCommande.produits]
                          .map(p => {
                            // Find product name from produitsList
                            const produitName = typeof p.produit === 'object' 
                              ? p.produit.name 
                              : produitsList.find(prod => prod.id === p.produit)?.name || `Produit #${p.produit}`;
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
                          .map(p => (
                            <tr key={p.id}>
                              <td>{p.produitName}</td>
                              <td>{p.quantity}</td>
                              <td>{p.price} F</td>
                              <td className="font-semibold">{Number(p.quantity) * Number(p.price)} F</td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'ajout de commande */} 
      <dialog className={`modal ${isAddModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-7xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div>
              <h3 className="font-bold text-xl">Créer une nouvelle commande</h3>
              <div className="flex gap-4 text-xs text-base-content/50 mt-1">
                <span className="flex items-center gap-1"><kbd className="kbd kbd-xs font-sans">F2</kbd> Recherche</span>
                <span className="flex items-center gap-1"><kbd className="kbd kbd-xs font-sans">F4</kbd> Fournisseur</span>
                <span className="flex items-center gap-1"><kbd className="kbd kbd-xs font-sans">Ctrl+A</kbd> Tout sélectionner</span>
                <span className="flex items-center gap-1"><kbd className="kbd kbd-xs font-sans">Suppr</kbd> Supprimer</span>
              </div>
            </div>
            <button 
              type="button" 
              className="btn btn-sm btn-circle btn-ghost" 
              onClick={closeAddModal}
            >
              ✕
            </button>
          </div>
          
          <form className="flex-1 flex flex-col min-h-0" onSubmit={handleAddCommande}> 
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

                  <div className="flex items-end justify-end">
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
                    onChange={(e) => {
                      setSearchProduitQuery(e.target.value);
                      setHighlightedIndex(-1);
                    }}
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
                        {filteredProduits.map((p, idx) => (
                          <div 
                            key={p.id} 
                            onClick={() => selectProduct(p)}
                            className={`
                              group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all
                              ${idx === highlightedIndex ? 'bg-primary text-primary-content shadow-md ring-2 ring-primary ring-offset-1' : 'hover:bg-base-100 text-base-content'}
                            `}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate text-sm">{p.name}</div>
                              <div className={`text-xs flex gap-3 mt-0.5 ${idx === highlightedIndex ? 'text-primary-content/80' : 'text-base-content/60'}`}>
                                <span>Stock: {p.stock}</span>
                                <span>Prix: {p.selling_price} F</span>
                                {(p.cip1 || p.cip2 || p.cip3) && (
                                  <span>CIP: {p.cip1 || p.cip2 || p.cip3}</span>
                                )}
                              </div>
                            </div>
                            <div className={`opacity-0 group-hover:opacity-100 ${idx === highlightedIndex ? 'opacity-100' : ''}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                              </svg>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tableau des produits avec édition inline */}
            <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl shadow-sm border border-base-200">
              <div className="p-4 border-b border-base-100 flex justify-between items-center shrink-0">
                <h2 className="font-bold text-lg text-base-content">
                  Produits ({commandeProduits.length})
                </h2>
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
                        <th className="bg-base-50 pl-4">Produit</th>
                        <th className="bg-base-50 text-right w-24">Qté</th>
                        <th className="bg-base-50 text-right w-28">Prix Achat</th>
                        <th className="bg-base-50 text-right w-28">Prix Vente</th>
                        <th className="bg-base-50 text-left w-32">Lot</th>
                        <th className="bg-base-50 text-left w-36">Date Exp</th>
                        <th className="bg-base-50 w-10"></th>
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
                            <div className="font-medium text-xs md:text-sm">{p.produit.name}</div>
                          </td>
                          <td className="text-right py-2 md:py-3">
                            <input
                              type="number"
                              min="1"
                              data-row={index}
                              data-field={0}
                              value={p.quantity}
                              onChange={(e) => updateCommandeProduitField(index, 'quantity', parseInt(e.target.value) || 1)}
                              onKeyDown={(e) => handleTableFieldKeyDown(e, index, 0)}
                              className="input input-ghost input-xs w-full text-right font-medium focus:bg-base-100 focus:text-primary"
                              autoFocus={focusedField?.row === index && focusedField?.field === 0}
                            />
                          </td>
                          <td className="text-right py-2 md:py-3">
                            <input
                              type="number"
                              step="0.01"
                              data-row={index}
                              data-field={1}
                              value={p.price}
                              onChange={(e) => updateCommandeProduitField(index, 'price', e.target.value)}
                              onKeyDown={(e) => handleTableFieldKeyDown(e, index, 1)}
                              className="input input-ghost input-xs w-full text-right focus:bg-base-100 focus:text-primary"
                              autoFocus={focusedField?.row === index && focusedField?.field === 1}
                            />
                          </td>
                          <td className="text-right py-2 md:py-3">
                            <input
                              type="number"
                              step="0.01"
                              data-row={index}
                              data-field={2}
                              value={p.selling_price}
                              onChange={(e) => updateCommandeProduitField(index, 'selling_price', e.target.value)}
                              onKeyDown={(e) => handleTableFieldKeyDown(e, index, 2)}
                              className="input input-ghost input-xs w-full text-right focus:bg-base-100 focus:text-primary"
                              autoFocus={focusedField?.row === index && focusedField?.field === 2}
                            />
                          </td>
                          <td className="text-left py-2 md:py-3">
                            <input
                              type="text"
                              data-row={index}
                              data-field={3}
                              value={p.lot || ''}
                              onChange={(e) => updateCommandeProduitField(index, 'lot', e.target.value)}
                              onKeyDown={(e) => handleTableFieldKeyDown(e, index, 3)}
                              className="input input-ghost input-xs w-full focus:bg-base-100 focus:text-primary"
                              placeholder="Lot"
                              autoFocus={focusedField?.row === index && focusedField?.field === 3}
                            />
                          </td>
                          <td className="text-left py-2 md:py-3">
                            <input
                              type="date"
                              data-row={index}
                              data-field={4}
                              value={p.date_expiration || ''}
                              onChange={(e) => updateCommandeProduitField(index, 'date_expiration', e.target.value)}
                              onKeyDown={(e) => handleTableFieldKeyDown(e, index, 4)}
                              className="input input-ghost input-xs w-full focus:bg-base-100 focus:text-primary"
                              autoFocus={focusedField?.row === index && focusedField?.field === 4}
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
                onClick={closeAddModal}
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
                Créer la commande
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop" onSubmit={closeAddModal}>
          <button>close</button>
        </form>
      </dialog>

      {/* Modal de modification de commande */} 
      <dialog className={`modal ${isEditModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-xl">Modifier la commande #{selectedCommande?.id}</h3>
            <button 
              type="button" 
              className="btn btn-sm btn-circle btn-ghost" 
              onClick={closeEditModal}
            >
              ✕
            </button>
          </div>
          
          <form className="space-y-6" onSubmit={handleEditCommande}> 
            {/* Informations de la commande */} 
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-base-content/80 border-b border-base-300 pb-2">
                Informations de la commande
              </h4>
              
              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text font-medium">Fournisseur *</span>
                </div>
                <select
                  className="select select-bordered w-full"
                  value={editCommandeFournisseurId}
                  onChange={(e) => setEditCommandeFournisseurId(e.target.value)}
                  required
                >
                  <option value="" disabled>Sélectionnez un fournisseur</option>
                  {fournisseurs.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </label>
              
              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text font-medium">Numéro de facture</span>
                </div>
                <input 
                  type="text"
                  placeholder="Ex: FAC-2024-001"
                  className="input input-bordered w-full"
                  value={editNumeroFacture}
                  onChange={(e) => setEditNumeroFacture(e.target.value)}
                />
              </label>
            </div>

            {/* Informations de la commande actuelle */} 
            {selectedCommande && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-base-content/80 border-b border-base-300 pb-2">
                  Informations actuelles
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control">
                    <div className="label">
                      <span className="label-text font-medium">Statut</span>
                    </div>
                    <div className="p-3 bg-base-200 rounded-lg">
                      <span className="badge badge-ghost">{selectedCommande.status_display}</span>
                    </div>
                  </div>
                  
                  <div className="form-control">
                    <div className="label">
                      <span className="label-text font-medium">Date de création</span>
                    </div>
                    <div className="p-3 bg-base-200 rounded-lg">
                      {new Date(selectedCommande.date).toLocaleString('fr-FR')}
                    </div>
                  </div>
                </div>
                
                <div className="form-control">
                  <div className="label">
                    <span className="label-text font-medium">Total actuel</span>
                  </div>
                  <div className="p-3 bg-base-200 rounded-lg font-bold">
                    {selectedCommande.total} F
                  </div>
                </div>
              </div>
            )}

            {/* Actions */} 
            <div className="modal-action pt-4">
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={closeEditModal}
              >
                Annuler
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Enregistrer les modifications
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop" onSubmit={closeEditModal}>
          <button>close</button>
        </form>
      </dialog>

      {/* Modal d'ajout de produits à une commande existante */} 
      <dialog className={`modal ${isAddProductsModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-6xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-xl">Ajouter des produits à la commande #{selectedCommande?.id}</h3>
            <button 
              type="button" 
              className="btn btn-sm btn-circle btn-ghost" 
              onClick={closeAddProductsModal}
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-6">
            {/* Informations de la commande */} 
            {selectedCommande && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-base-content/80 border-b border-base-300 pb-2">
                  Informations de la commande
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-control">
                    <div className="label">
                      <span className="label-text font-medium">Fournisseur</span>
                    </div>
                    <div className="p-3 bg-base-200 rounded-lg">
                      {fournisseurs.find(f => f.id === selectedCommande.fournisseur)?.name ?? `ID: ${selectedCommande.fournisseur}`}
                    </div>
                  </div>
                  
                  <div className="form-control">
                    <div className="label">
                      <span className="label-text font-medium">Statut</span>
                    </div>
                    <div className="p-3 bg-base-200 rounded-lg">
                      <span className="badge badge-ghost">{selectedCommande.status_display}</span>
                    </div>
                  </div>
                  
                  <div className="form-control">
                    <div className="label">
                      <span className="label-text font-medium">Total actuel</span>
                    </div>
                    <div className="p-3 bg-base-200 rounded-lg font-bold">
                      {selectedCommande.total} F
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Ajout de produits */} 
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-base-content/80 border-b border-base-300 pb-2">
                Ajouter des produits
              </h4>
              {/* Bouton pour ouvrir le modal de création de produit */} 
              <div className="flex justify-end mb-2">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setIsCreateProduitModalOpen(true)}
                >
                  + Créer un nouveau produit
                </button>
              </div>
              
              <div className="p-4 border rounded-lg bg-base-50">
                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text font-medium">Rechercher un produit</span>
                  </label>
                  <input 
                    ref={searchInputRef}
                    type="text" 
                    placeholder="Taper pour rechercher... (utilisez ↑↓ pour naviguer, Entrée pour sélectionner)"
                    className="input input-bordered w-full"
                    value={searchProduitQuery}
                    onChange={(e) => {
                      setSearchProduitQuery(e.target.value);
                      setHighlightedIndex(-1);
                    }}
                    onKeyDown={handleSearchKeyDown}
                  />
                  {searchProduitQuery && filteredProduits.length > 0 && (
                    <div className="relative">
                      <ul className="menu bg-base-200 w-full rounded-box mt-1 max-h-60 overflow-y-auto">
                        {filteredProduits.map((p, index) => (
                          <li 
                            key={p.id} 
                            className={highlightedIndex === index ? 'bg-primary text-primary-content' : ''}
                            onClick={() => selectProduct(p)}
                          >
                            <a className="cursor-pointer">
                              <div>
                                <div className="font-medium">{p.name}</div>
                                <div className="text-sm opacity-70">
                                  Stock: {p.stock} | Prix: {p.selling_price} F
                                </div>
                              </div>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {searchProduitQuery && filteredProduits.length === 0 && (
                    <div className="text-center text-base-content/70 py-4">
                      Aucun produit trouvé
                    </div>
                  )}
                </div>

                {selectedProduitToAdd && (
                  <div className="space-y-4 p-4 bg-base-100 rounded-lg">
                    <h5 className="font-bold text-base">Produit sélectionné: {selectedProduitToAdd.name}</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <label className="form-control w-full">
                        <div className="label">
                          <span className="label-text">Quantité *</span>
                        </div>
                        <input 
                          type="number" 
                          min="1"
                          value={lineItem.quantity} 
                          onChange={e => setLineItem(p => ({...p, quantity: e.target.value}))} 
                          className="input input-bordered" 
                          required 
                        />
                      </label>
                      <label className="form-control w-full">
                        <div className="label">
                          <span className="label-text">Prix d\'achat *</span>
                        </div>
                        <input 
                          type="number" 
                          step="0.01" 
                          value={lineItem.price} 
                          onChange={e => setLineItem(p => ({...p, price: e.target.value}))} 
                          className="input input-bordered" 
                          required 
                        />
                      </label>
                      <label className="form-control w-full">
                        <div className="label">
                          <span className="label-text">Prix de vente *</span>
                        </div>
                        <input 
                          type="number" 
                          step="0.01" 
                          value={lineItem.selling_price} 
                          onChange={e => setLineItem(p => ({...p, selling_price: e.target.value}))} 
                          className="input input-bordered" 
                          required 
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="form-control w-full">
                        <div className="label">
                          <span className="label-text">Lot</span>
                        </div>
                        <input 
                          type="text" 
                          value={lineItem.lot} 
                          onChange={e => setLineItem(p => ({...p, lot: e.target.value}))} 
                          className="input input-bordered" 
                        />
                      </label>
                      <label className="form-control w-full">
                        <div className="label">
                          <span className="label-text">Date d\'expiration</span>
                        </div>
                        <input 
                          type="date" 
                          value={lineItem.date_expiration} 
                          onChange={e => setLineItem(p => ({...p, date_expiration: e.target.value}))} 
                          className="input input-bordered" 
                        />
                      </label>
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={addProductToExistingCommande}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Ajouter le produit
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Liste des produits à ajouter */} 
            {productsToAdd.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-base-content/80 border-b border-base-300 pb-2">
                  Produits à ajouter ({productsToAdd.length})
                </h4>
                
                <div className="overflow-x-auto">
                  <table className="table table-zebra">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th>Quantité</th>
                        <th>Prix d\'achat</th>
                        <th>Prix de vente</th>
                        <th>Lot</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productsToAdd.map((p, index) => (
                        <tr key={p.id}>
                          <td className="font-medium">{p.produit.name}</td>
                          <td>{p.quantity}</td>
                          <td>{p.price} F</td>
                          <td>{p.selling_price} F</td>
                          <td>{p.lot || '-'}</td>
                          <td>
                            <button 
                              type="button"
                              className="btn btn-error btn-xs"
                              onClick={() => removeProductFromProductsToAdd(index)}
                            >
                              Supprimer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */} 
            <div className="modal-action pt-4">
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={closeAddProductsModal}
              >
                Annuler
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleAddProductsToCommande}
                disabled={productsToAdd.length === 0}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Ajouter les produits
              </button>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop" onSubmit={closeAddProductsModal}>
          <button>close</button>
        </form>
      </dialog>

      {/* Modal de création de produit réutilisable */} 
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
    </>
  )
}
