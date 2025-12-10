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
  const [lineItem, setLineItem] = useState({
    quantity: '1',
    price: '', // prix achat
    selling_price: '',
    lot: '',
    date_expiration: '',
  });

  const [sortKey, setSortKey] = useState<'numero' | 'date' | 'fournisseur'>('date');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');

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
          axios.get<Commande[]>(commandesEndpoint, { signal: controller.signal }),
          axios.get<Fournisseur[]>(fournisseursEndpoint, { signal: controller.signal }),
          axios.get<ProduitModel[]>(produitsEndpoint, { signal: controller.signal }),
          axios.get<Rayon[]>(rayonsEndpoint, { signal: controller.signal }),
        ])
        setCommandes(commandesResponse.data)
        setFournisseurs(fournisseursResponse.data)
        setProduitsList(produitsResponse.data)
        setRayons(rayonsResponse.data)
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

  function openAddModal() {
    setNewCommandeFournisseurId(fournisseurs.length > 0 ? String(fournisseurs[0].id) : '')
    setNumeroFacture('')
    setCommandeProduits([])
    setSearchProduitQuery('')
    setHighlightedIndex(-1)
    resetProductForm()
    setIsAddModalOpen(true)
  }

  function closeAddModal() {
    setIsAddModalOpen(false)
    setSearchProduitQuery('')
    setHighlightedIndex(-1)
    setCommandeProduits([])
    resetProductForm()
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

  function closeAddProductsModal() {
    setIsAddProductsModalOpen(false)
    setProductsToAdd([])
    setSearchProduitQuery('')
    setHighlightedIndex(-1)
    resetProductForm()
  }

  // Fonctions de navigation au clavier
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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
          setSelectedProduitToAdd(selectedProduct);
          setSearchProduitQuery('');
          setHighlightedIndex(-1);
        }
        break;
      case 'Escape':
        setSearchProduitQuery('');
        setHighlightedIndex(-1);
        break;
    }
  }

  function selectProduct(product: ProduitModel) {
    setSelectedProduitToAdd(product);
    setLineItem(prev => ({
      ...prev,
      price: product.cost_price || '',
      selling_price: product.selling_price || '',
    }));
    setSearchProduitQuery('');
    setHighlightedIndex(-1);
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
      const { data: updatedCommandes } = await axios.get<Commande[]>(commandesEndpoint)
      setCommandes(updatedCommandes)
      
      // Mettre à jour la commande sélectionnée
      const updatedCommande = updatedCommandes.find(c => c.id === selectedCommande.id)
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
      const { data: updatedCommandes } = await axios.get<Commande[]>(commandesEndpoint)
      setCommandes(updatedCommandes)
      
      // Sélectionner la nouvelle commande
      const newCommandeWithProducts = updatedCommandes.find(c => c.id === createdCommande.id)
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
        axios.get<Commande[]>(commandesEndpoint, { signal: controller.signal }),
        axios.get<ProduitModel[]>(produitsEndpoint, { signal: controller.signal }),
      ])
      setCommandes(commandesResponse.data)
      setProduitsList(produitsResponse.data)
      setSelectedCommande(commandesResponse.data.find(c => c.id === selectedCommande.id) ?? null)

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
        const { data: updatedCommandes } = await axios.get<Commande[]>(commandesEndpoint);
        setCommandes(updatedCommandes);
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <h2 className="card-title">Liste des commandes</h2>
            <div className="card-actions">
              {loading && <span className="loading loading-spinner loading-sm" />}
              <button 
                className="btn btn-secondary mr-2" 
                onClick={handleGenerateReplenishment}
                disabled={loading}
              >
                {loading && <span className="loading loading-spinner loading-sm" />}
                Générer Réapprovisionnement
              </button>
              <button className="btn btn-primary" onClick={openAddModal}>Créer</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th onClick={() => setSortKey('numero')}>N° Facture</th>
                  <th onClick={() => setSortKey('date')}>Date</th>
                  <th onClick={() => setSortKey('fournisseur')}>Fournisseur</th>
                  <th>Statut</th>
                  <th>Total (F)</th>
                </tr>
              </thead>
              <tbody>
                {sortedCommandes.map(commande => (
                  <tr key={commande.id} className="hover" onClick={() => setSelectedCommande(commande)}>
                    <td className={selectedCommande?.id === commande.id ? 'bg-base-300' : ''}>{commande.numero_facture || commande.id}</td>
                    <td>{new Date(commande.date).toLocaleString('fr-FR')}</td>
                    <td>{fournisseurs.find(f => f.id === commande.fournisseur)?.name ?? `ID: ${commande.fournisseur}`}</td>
                    <td><span className="badge badge-ghost">{commande.status_display}</span></td>
                    <td>{commande.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

        {/* Section des détails de la commande */} 
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
                                    <div className="flex justify-between items-center">
              <h2 className="card-title">Détails de la commande</h2>
              <div className="card-actions">
                <button 
                  className="btn btn-info btn-sm"
                  onClick={openAddProductsModal}
                  disabled={!selectedCommande || selectedCommande.status === 'CLOT'}
                >
                  Ajouter des produits
                </button>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={openEditModal}
                  disabled={!selectedCommande || selectedCommande.status === 'CLOT'}
                >
                  Modifier
                </button>
                <button 
                  className="btn btn-success btn-sm"
                  onClick={handleCloturerCommande}
                  disabled={!selectedCommande || selectedCommande.status === 'CLOT'}
                >
                  Clôturer
                </button>
                <button 
                  className="btn btn-error btn-sm"
                  onClick={handleDeleteCommande}
                  disabled={!selectedCommande}
                >
                  Supprimer
                </button>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={handleImprimerReception}
                  disabled={!selectedCommande || selectedCommande.status !== 'CLOT'}
                >
                  Imprimer le bon
                </button>
              </div>
            </div>
            {!selectedCommande ? (
              <p className="text-base-content/70">Sélectionnez une commande dans la liste.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold col-span-1">ID Commande</span>
                  <span className="col-span-2">{selectedCommande.id}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold col-span-1">Fournisseur</span>
                  <span className="col-span-2">{fournisseurs.find(f => f.id === selectedCommande.fournisseur)?.name ?? `ID: ${selectedCommande.fournisseur}`}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold col-span-1">N° Facture</span>
                  <span className="col-span-2">{selectedCommande.numero_facture || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold col-span-1">Date</span>
                  <span className="col-span-2">{new Date(selectedCommande.date).toLocaleString('fr-FR')}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold col-span-1">Statut</span>
                  <span className="col-span-2"><span className="badge badge-ghost">{selectedCommande.status_display}</span></span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold col-span-1">Total</span>
                  <span className="col-span-2 font-bold">{selectedCommande.total} F</span>
                </div>

                <div>
                  <h3 className="font-semibold mt-4 mb-2">Produits commandés</h3>
                  {selectedCommande.produits.length === 0 ? (
                    <p className="text-base-content/70">Aucun produit dans cette commande.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Produit</th>
                            <th>Quantité</th>
                            <th>Prix Unitaire (F)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCommande.produits.map(p => (
                            <tr key={p.id}>
                              <td>{p.produit.name}</td>
                              <td>{p.quantity}</td>
                              <td>{p.price}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal d'ajout de commande */} 
      <dialog className={`modal ${isAddModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-6xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-xl">Créer une nouvelle commande</h3>
            <button 
              type="button" 
              className="btn btn-sm btn-circle btn-ghost" 
              onClick={closeAddModal}
            >
              ✕
            </button>
          </div>
          
          <form className="space-y-6" onSubmit={handleAddCommande}> 
            {/* Informations de la commande */} 
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-base-content/80 border-b border-base-300 pb-2">
                Informations de la commande
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-medium">Fournisseur *</span>
                  </div>
                  <select
                    className="select select-bordered w-full"
                    value={newCommandeFournisseurId}
                    onChange={(e) => setNewCommandeFournisseurId(e.target.value)}
                    required
                  >
                    <option value="" disabled>Sélectionnez un fournisseur</option>
                    {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
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
                    value={numeroFacture}
                    onChange={(e) => setNumeroFacture(e.target.value)}
                  />
                </label>
              </div>
            </div>

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
                    onKeyDown={handleKeyDown}
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
                      onClick={addProductToCommande}
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

            {/* Liste des produits ajoutés */} 
            {commandeProduits.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-base-content/80 border-b border-base-300 pb-2">
                  Produits dans cette commande ({commandeProduits.length})
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
                      {commandeProduits.map((p, index) => (
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
                              onClick={() => removeProductFromCommande(index)}
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
                    onKeyDown={handleKeyDown}
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

      {/* ...existing code... */} 
    </>
  )
}
