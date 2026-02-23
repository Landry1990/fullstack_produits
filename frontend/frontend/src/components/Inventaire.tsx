import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { 
    Search, Calendar, Filter, Plus, Trash2, 
    ChevronLeft, Download, BarChart3, 
    Database, Save, CheckCircle2,
    AlertCircle, History, Package, ArrowUpDown, 
    FileText, ClipboardList, TrendingDown, Layers, 
    Info, LayoutGrid, X, ChevronRight, PieChart
} from 'lucide-react';
import { useConfirm } from '../hooks/useConfirm';
import type { ProduitModel, Inventaire, LigneInventaire, StockLot } from '../types';
import { useSearchNavigation } from '../hooks/useSearchNavigation';
import { useProductSearch } from '../hooks/useProductSearch';
import { useSudo } from '../hooks/useSudo';
import SudoValidationModal from './common/SudoValidationModal';
import { InventaireFilters } from './inventaire/InventaireFilters';
import { InventaireQuickStats } from './inventaire/InventaireQuickStats';
import { InventaireListTable } from './inventaire/InventaireListTable';

type SortOption = 'CHRONOLOGICAL' | 'NAME' | 'GAP_VALUE' | 'GAP_QTY';
type SortOrder = 'ASC' | 'DESC';



interface InventoryStats {
    top_pertes: Array<{
        produit_nom: string;
        ecart: number;
        valeur: number;
    }>;
    par_rayon: Array<{
        rayon: string;
        total: number;
    }>;
}


export default function InventaireComponent() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  // Modes: LIST, CREATE, EDIT
  const [viewMode, setViewMode] = useState<'LIST' | 'CREATE' | 'EDIT'>('LIST');
  // Tabs in EDIT/DETAIL mode: DATA (Saisie) | ANALYSIS (Analyse)
  const [viewTab, setViewTab] = useState<'DATA' | 'ANALYSIS'>('DATA');

  // Data
  const [inventaires, setInventaires] = useState<Inventaire[]>([]);
  const [activeInventaire, setActiveInventaire] = useState<Inventaire | null>(null);
  const [lignes, setLignes] = useState<LigneInventaire[]>([]);
  const [searchLignesQuery, setSearchLignesQuery] = useState('');
  // Filters for List Mode
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSearchTerm, setFilterSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCreator, setFilterCreator] = useState('');

  // Form Data (Header)
  const [description, setDescription] = useState('');
  const [dateInventaire, setDateInventaire] = useState(new Date().toISOString().split('T')[0]);

  // Product Search using hook
  const { 
    produits: searchResults, 
    loading: loadingSearch,
    searchQuery, 
    setSearchQuery 
  } = useProductSearch({ minSearchLength: 1, debounceMs: 300 })
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lot Selection State
  const [showLotModal, setShowLotModal] = useState(false);
  const [selectedProductForLot, setSelectedProductForLot] = useState<ProduitModel | null>(null);
  const [availableLots, setAvailableLots] = useState<StockLot[]>([]);
  const [focusedLotIndex, setFocusedLotIndex] = useState(0);
  const [loadingLots, setLoadingLots] = useState(false);

  // Selection State
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());

  // Merge State
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeCandidates, setMergeCandidates] = useState<Inventaire[]>([]);
  const [loadingMergeCandidates, setLoadingMergeCandidates] = useState(false);
  const [selectedMergeSource, setSelectedMergeSource] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);

  // Sorting State
  const [sortBy, setSortBy] = useState<SortOption>('CHRONOLOGICAL');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');
  
  // Analysis State
  const [inventoryStats, setInventoryStats] = useState<InventoryStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Pagination State
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [prevPage, setPrevPage] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Focus management
  const focusInput = (index: number) => {
      setTimeout(() => {
          const el = document.getElementById(`qty-input-${index}`);
          if (el) {
              (el as HTMLInputElement).focus();
              (el as HTMLInputElement).select();
          } else if (searchInputRef.current) {
              searchInputRef.current.focus();
          }
      }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          // Always focus Search after Enter on Quantity (User Request)
          searchInputRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
          if (index < lignes.length - 1) focusInput(index + 1);
      } else if (e.key === 'ArrowUp') {
          if (index > 0) focusInput(index - 1);
          else searchInputRef.current?.focus();
      }
  };




  // API Base URL
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
  const inventairesEndpoint = `${String(apiBaseUrl).replace(/\/$/, '')}/api/inventaires/`;
  const lignesEndpoint = `${String(apiBaseUrl).replace(/\/$/, '')}/api/lignes-inventaire/`;
  // produitsEndpoint removed - products are loaded via useProductSearch hook

  const { sudoState, requireSudo, closeSudo } = useSudo();

  const fetchInventaires = async (url?: string) => {
    try {
      setLoading(true);
      
      // Build query string based on filters
      const params = new URLSearchParams();
      if (filterStartDate) params.append('date_after', filterStartDate);
      if (filterEndDate) params.append('date_before', filterEndDate);
      if (filterSearchTerm) params.append('search', filterSearchTerm);
      if (filterStatus) params.append('status', filterStatus);
      if (filterCreator) params.append('created_by', filterCreator);
      
      const paramString = params.toString();
      const finalUrl = url || `${inventairesEndpoint}${paramString ? `?${paramString}` : ''}`;

      const res = await axios.get(finalUrl);
      
      if (Array.isArray(res.data)) {
          // No pagination fallback
          setInventaires(res.data);
          setNextPage(null);
          setPrevPage(null);
          setTotalCount(res.data.length);
      } else {
          // DRF Pagination
          setInventaires(res.data.results);
          setNextPage(res.data.next);
          setPrevPage(res.data.previous);
          setTotalCount(res.data.count);
          
          // Calculate page number logic if needed, or simple tracking
          if (url) {
              const urlObj = new URL(url);
              const pageParam = urlObj.searchParams.get('page');
              setCurrentPage(pageParam ? parseInt(pageParam) : 1);
          } else {
              setCurrentPage(1);
          }
      }
    } catch (err) {
      console.error("Erreur fetch inventaires", err);
    } finally {
      setLoading(false);
    }
  };

  // === FETCH LIST ===
  useEffect(() => {
    if (viewMode === 'LIST') {
      // Small debounce for search term could be added, but calling directly is fine for simplicity
      const timer = setTimeout(() => {
          fetchInventaires();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [viewMode, filterStartDate, filterEndDate, filterSearchTerm, filterStatus, filterCreator]);

  const fetchStats = async (id: number) => {
      setLoadingStats(true);
      try {
          const res = await axios.get(`${inventairesEndpoint}${id}/stats/`);
          setInventoryStats(res.data);
      } catch (err) {
          console.error("Erreur stats", err);
          toast.error("Impossible de charger les statistiques");
      } finally {
          setLoadingStats(false);
      }
  };

  // === SELECTION (LIST MODE) ===
  const [selectedInventaireIds, setSelectedInventaireIds] = useState<Set<number>>(new Set());

  const toggleSelectInventaire = (id: number) => {
    const newSet = new Set(selectedInventaireIds);
    if (newSet.has(id)) {
        newSet.delete(id);
    } else {
        newSet.add(id);
    }
    setSelectedInventaireIds(newSet);
  };

  const toggleSelectAllInventaires = () => {
      if (selectedInventaireIds.size === inventaires.length) {
          setSelectedInventaireIds(new Set());
      } else {
          setSelectedInventaireIds(new Set(inventaires.map(i => i.id)));
      }
  };

  const canMergeSelectedInventaires = () => {
      if (selectedInventaireIds.size < 2) return { canMerge: false, reason: "Sélectionnez au moins 2 inventaires" };
      // Check status
      const selectedInvs = inventaires.filter(i => selectedInventaireIds.has(i.id));
      const hasValidated = selectedInvs.some(i => i.status === 'VALIDEE');
      if (hasValidated) return { canMerge: false, reason: "Impossible de fusionner des inventaires validés" };
      
      return { canMerge: true };
  };

  // Open merge modal from list
  const openMergeModalFromList = () => {
      const { canMerge, reason } = canMergeSelectedInventaires();
      if (!canMerge) {
          toast.error(reason || "Fusion impossible");
          return;
      }
      setShowMergeModal(true);
  };

  // === ACTIONS ===

  const handleCreate = () => {
      setActiveInventaire(null);
      setLignes([]);
      setSearchLignesQuery('');
      setDescription('');
      setDateInventaire(new Date().toISOString().split('T')[0]);
      setViewMode('CREATE');
  };

  const handleEdit = async (inv: Inventaire) => {
      setActiveInventaire(inv);
      setDescription(inv.description);
      setDateInventaire(inv.date.split('T')[0]);
      setSearchLignesQuery('');
      setViewMode('EDIT');
      setViewTab('DATA'); // Reset tab
      setInventoryStats(null); // Reset stats
      
      // Fetch lines
      try {
          const res = await axios.get(`${lignesEndpoint}?inventaire=${inv.id}`);
          setLignes(res.data.results || res.data);
      } catch(err) {
          console.error("Erreur chargement lignes", err);
      }
  };

  const handleDelete = async (id: number) => {
      const confirmed = await confirm({
        title: 'Supprimer l\'inventaire',
        message: t('stock.inventaire.delete_confirm'),
        variant: 'danger',
        confirmText: 'Supprimer'
      })
      if (!confirmed) return;
      try {
          await axios.delete(`${inventairesEndpoint}${id}/`);
          fetchInventaires();
      } catch (err) {
          toast.error("Erreur lors de la suppression");
      }
  };

  const fetchAvailableLots = async (productId: number) => {
      setLoadingLots(true);
      try {
          // Include empty lots to see all history if needed, but for inventory we usually want what exists. 
          // However, for counting, we might tap into an empty lot to refill it if we find stock?
          // Let's stick to include_empty=true just in case they find a lost item.
          const res = await axios.get(`${String(apiBaseUrl).replace(/\/$/, '')}/api/stock-lots/?produit=${productId}&include_empty=true`);
          setAvailableLots(res.data.results || res.data);
          setFocusedLotIndex(0); // Reset focus to first item
      } catch (err) {
          console.error("Error fetching lots", err);
          toast.error("Impossible de charger les lots");
      } finally {
          setLoadingLots(false);
      }
  };

  const handleProductSelect = async (product: ProduitModel) => {
      // Fetch full details because search results use ProduitListSerializer (missing cost_price, etc.)
      setLoading(true);
      try {
          const produitsEndpoint = `${apiBaseUrl ? String(apiBaseUrl).replace(/\/$/, '') : ''}/api/produits/`;
          const { data: fullProduct } = await axios.get<ProduitModel>(`${produitsEndpoint}${product.id}/`);
          
          // Wrapper to check for lot management
          if (fullProduct.use_lot_management) {
              setSelectedProductForLot(fullProduct);
              setAvailableLots([]);
              setShowLotModal(true);
              fetchAvailableLots(fullProduct.id);
          } else {
              handleAddProduct(fullProduct);
          }
      } catch (err) {
          console.error("Erreur chargement détails produit", err);
          toast.error("Impossible de charger les détails complets du produit");
      } finally {
          setLoading(false);
      }
  };

  const handleLotSelection = async (lotId: number) => {
      if (selectedProductForLot) {
          await handleAddProduct(selectedProductForLot, lotId);
          setShowLotModal(false);
          setSelectedProductForLot(null);
      }
  };

  const handleLotModalKeyDown = (e: React.KeyboardEvent) => {
      if (loadingLots || availableLots.length === 0) return;

      if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedLotIndex(prev => Math.min(prev + 1, availableLots.length - 1));
      } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedLotIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
          e.preventDefault();
          if (focusedLotIndex >= 0 && focusedLotIndex < availableLots.length) {
              handleLotSelection(availableLots[focusedLotIndex].id);
          }
      }
  };

  const handleAddProduct = async (product: ProduitModel, stockLotId?: number) => {
      // Check if line exists locally
      // If adding a specific lot, check if THAT lot is already added.
      // If adding generic product, check if generic product is added.
      
      const exists = lignes.find(l => {
          const sameProduct = (l.produit === ((typeof product === 'object') ? product.id as any : product) ||  (l.produit && (l.produit as any).id === product.id));
          if (!sameProduct) return false;
          
          if (stockLotId) {
             // We need to know the lot ID of the existing line. 
             // The current local state 'lignes' might strictly be LigneInventaire interface which doesn't explicitly show 'stock_lot' ID at top level easily unless we check how backend returns it.
             // Backend serializer has `stock_lot` as ID? No, checking serializer...
             // LigneInventaireSerializer fields: `stock_lot` is PK. 
             // In `lignes` state (which comes from API), l.stock_lot is number (FK).
             return l.stock_lot === stockLotId;
          } else {
             // Generic add: check if any line with this product exists AND has NO lot? 
             // Or just if any line exists? 
             // If I have Lot A added, can I add "Generic" product too? Probably yes, for "Loose items".
             // So check strict equality on stock_lot being null/undefined.
             return !l.stock_lot; // Only clash if existing line has NO lot.
          }
      });
      
      if (exists) {
          toast(t('stock.inventaire.product_exists'), { icon: '⚠️' });
          setSearchQuery('');
          return;
      }
      
      // CREATE MODE logic: If no ID, create draft header first if it doesn't exist.
      let invId: number;
      if (!activeInventaire?.id) {
          try {
              const res = await axios.post(inventairesEndpoint, {
                  date: dateInventaire,
                  description: description || t('stock.inventaire.create_btn'),
                  status: 'EN_COURS'
              });
              invId = res.data.id;
              setActiveInventaire(res.data);
              setInventaires(prev => [res.data, ...prev]);
          } catch(err) {
              console.error("Erreur création inventaire", err);
              toast.error("Impossible de créer l'inventaire automatiquement.");
              return;
          }
      } else {
          invId = activeInventaire.id;
      }

      // AJOUT LOCAL (Mode Saisie Groupée)
      const cost = product.cost_price || '0';
      const pmp = product.pmp || '0';
      
      const newLine: LigneInventaire = {
          id: -Date.now(), // ID temporaire négatif
          inventaire: invId,
          produit: product, 
          produit_nom: product.name,
          produit_cip: product.cip1 || undefined,
          produit_rayon: product.rayon_name,
          produit_description: product.description,
          produit_cost_price: cost,
          produit_pmp: pmp || undefined,
          stock_lot: stockLotId,
          stock_theorique: product.stock, 
          quantite_physique: product.stock,
          ecart: 0,
          pmp_snapshot: cost,
          isLocalOnly: true 
      };

      const newLignes = [...lignes, newLine];
      setLignes(newLignes);
      toast.success("Produit ajouté (en attente de sauvegarde)");
      setSearchQuery('');
      setTimeout(() => focusInput(newLignes.length - 1), 100);
  };

  const handleSyncLines = async () => {
      if (!activeInventaire) return;
      const localLines = lignes.filter(l => l.isLocalOnly);
      if (localLines.length === 0) {
          toast.success("Tout est synchronisé");
          return;
      }

      setSaving(true);
      try {
          const payload = localLines.map(l => ({
              produit: typeof l.produit === 'object' ? l.produit.id : l.produit,
              stock_lot: l.stock_lot,
              quantite_physique: l.quantite_physique,
              // lot_numero if needed for new lots? usually stock_lot is enough
          }));

          const res = await axios.post(`${inventairesEndpoint}${activeInventaire.id}/lignes/bulk/`, { lignes: payload });
          
          if (res.status === 201) {
              toast.success(`${res.data.imported} lignes synchronisées`);
              // Re-fetch clean lines from server to get real IDs and theoretical stocks
              const resLines = await axios.get(`${lignesEndpoint}?inventaire=${activeInventaire.id}`);
              setLignes(resLines.data.results || resLines.data);
          }
      } catch (err) {
          console.error("Erreur synchronisation", err);
          toast.error("Échec de la synchronisation");
      } finally {
          setSaving(false);
      }
  };

  // Use search navigation hook (must be after handleAddProduct is declared)
  const { handleKeyDown: handleSearchKeyDown, getItemProps } = useSearchNavigation(
    searchResults,
    handleProductSelect, // Changed from handleAddProduct to handleProductSelect
    { resetOnSelect: true, searchInputRef }
  );

  const handleUpdateQuantity = async (lineId: number, newQty: number) => {
      // Optimistic update
      const updatedLignes = lignes.map(l => l.id === lineId ? { ...l, quantite_physique: newQty, ecart: newQty - l.stock_theorique } : l);
      setLignes(updatedLignes);

      // Debounced save could be better, but direct save for now
      try {
          await axios.patch(`${lignesEndpoint}${lineId}/`, { quantite_physique: newQty });
      } catch (err) {
          console.error("Erreur update quantite", err);
      }
  };

  const handleDeleteLine = async (lineId: number) => {
      const confirmed = await confirm({
        title: 'Retirer le produit',
        message: 'Retirer ce produit de l\'inventaire ?',
        variant: 'warning',
        confirmText: 'Retirer'
      })
      if (!confirmed) return;
      try {
          await axios.delete(`${lignesEndpoint}${lineId}/`);
          setLignes(prev => prev.filter(l => l.id !== lineId));
      } catch (err) {
          console.error("Erreur suppression ligne", err);
          toast.error(t('stock.inventaire.lines.delete_error'));
      }
  };

  const handleOpenValidateModal = () => {
      if (!activeInventaire) return;
      
      requireSudo(
          async (validatorId, password) => {
              await handleValidateConfirm({ validated_by_id: validatorId, sudo_password: password });
          },
          {
              title: t('stock.inventaire.validation.title'),
              message: t('stock.inventaire.validation.message')
          }
      );
  };

  const handleValidateConfirm = async (creds: { validated_by_id: number; sudo_password: string }) => {
      if (!activeInventaire) return;

      try {
          setSaving(true);
          await axios.post(`${inventairesEndpoint}${activeInventaire.id}/validate/`, creds);
          toast.success(t('stock.inventaire.validation.success'));
          setViewMode('LIST');
          fetchInventaires();
      } catch (err: any) {
          toast.error(t('stock.inventaire.validation.error'));
          console.error(err);
      } finally {
          setSaving(false);
      }
  };

  const handleSaveHeader = async () => {
      // Just update description/date
      if (!activeInventaire) return;
      try {
           await axios.patch(`${inventairesEndpoint}${activeInventaire.id}/`, {
               date: dateInventaire,
               description
           });
           toast.success(t('stock.inventaire.detail.header_saved'));
      } catch(err) {
          toast.error(t('stock.inventaire.detail.save_error'));
      }
  };



  const fetchMergeCandidates = async () => {
      // ... (existing code, keeping context clean)
      if (!activeInventaire) return;
      setLoadingMergeCandidates(true);
      try {
          const res = await axios.get(`${inventairesEndpoint}?status=EN_COURS`);
          const candidates = (Array.isArray(res.data) ? res.data : res.data.results)
              .filter((inv: Inventaire) => inv.id !== activeInventaire.id);
          setMergeCandidates(candidates);
      } catch(err) {
          console.error("Erreur candidats fusion", err);
      } finally {
          setLoadingMergeCandidates(false);
      }
  };

  const toggleSelectLine = (id: number) => {
      const newSet = new Set(selectedLines);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedLines(newSet);
  };

  const toggleSelectAll = () => {
      if (selectedLines.size === lignes.length) {
          setSelectedLines(new Set());
      } else {
          setSelectedLines(new Set(lignes.map(l => l.id)));
      }
  };

  const handleBulkDelete = async () => {
      if (selectedLines.size === 0) return;
      
      const confirmed = await confirm({
          title: t('stock.inventaire.detail.bulk_delete_title'),
          message: t('stock.inventaire.detail.bulk_delete_message', { count: selectedLines.size }),
          variant: 'danger',
          confirmText: t('stock.inventaire.detail.bulk_delete_confirm')
      });
      if (!confirmed) return;

      try {
          // Promise.all for parallel deletion (or bulk endpoint if available, but loop is fine for <50 items)
          // Ideally use a loop to avoid overloading if many items
          const idsToDelete = Array.from(selectedLines);
          for (const id of idsToDelete) {
             await axios.delete(`${lignesEndpoint}${id}/`);
          }
          
          setLignes(prev => prev.filter(l => !selectedLines.has(l.id)));
          setSelectedLines(new Set());
          toast.success(t('stock.inventaire.detail.bulk_delete_success', { count: idsToDelete.length }));

      } catch (err) {
          console.error("Erreur suppression bulk", err);
          toast.error(t('stock.inventaire.detail.save_error')); // Reuse save error or generic
      }
  };

  useEffect(() => {
      if (showMergeModal) {
          fetchMergeCandidates();
      }
  }, [showMergeModal]);

  const handleMerge = async () => {
      if (!selectedMergeSource) return;
      
      const isListMode = viewMode === 'LIST';
      const targetId = isListMode ? selectedMergeSource : activeInventaire?.id;

      if (!targetId) return;
      
      const confirmed = await confirm({
          title: t('stock.inventaire.merge.modal_title'),
          message: isListMode 
            ? t('stock.inventaire.modals.merge_warning_list_plain') // Need plain text for confirm
            : t('stock.inventaire.merge.confirm_msg'),
          variant: 'warning',
          confirmText: t('stock.inventaire.merge.btn')
      });
      if (!confirmed) return;

      setMerging(true);
      try {
          if (isListMode) {
              // List Mode: Merge multiple sources into selected target
              const sources = Array.from(selectedInventaireIds).filter(id => id !== targetId);
              let successCount = 0;
              
              // It's safer to merge one by one to avoid concurrent modification issues on the same target
              for (const sourceId of sources) {
                  await axios.post(`${inventairesEndpoint}${targetId}/merge/`, {
                      source_inventaire_id: sourceId
                  });
                  successCount++;
              }
              
              toast.success(t('stock.inventaire.merge.success_count', { count: successCount }));
              setSelectedInventaireIds(new Set());
              fetchInventaires();
          } else {
              // Detail Mode: Merge single external source into active inventory
              await axios.post(`${inventairesEndpoint}${activeInventaire?.id}/merge/`, {
                  source_inventaire_id: selectedMergeSource
              });
              toast.success(t('stock.inventaire.merge.success'));
              if (activeInventaire) handleEdit(activeInventaire);
          }
          
          setShowMergeModal(false);
          setSelectedMergeSource(null);
      } catch (err: any) {
          console.error("Erreur fusion", err);
          toast.error(err.response?.data?.error || t('stock.inventaire.merge.error'));
      } finally {
          setMerging(false);
      }
  };





  // Frontend PDF Generation
  const handlePrintEtatFrontend = () => {
    if (!activeInventaire || !lignes.length) return;

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(14);
    doc.text(t('stock.inventaire.pdf.title_etat', { id: activeInventaire.id }), 14, 15);
    doc.setFontSize(10);
    doc.text(t('stock.inventaire.pdf.date', { date: new Date(activeInventaire.date).toLocaleDateString('fr-FR') }), 14, 22);
    if (activeInventaire.description) {
        doc.text(t('stock.inventaire.pdf.desc', { desc: activeInventaire.description }), 14, 27);
    }

    // Group by Rayon
    const grouped: Record<string, LigneInventaire[]> = {};
    lignes.forEach(l => {
        // Try to get rayon name from nested or flat property
        const rayon = (l.produit as any).rayon_name || l.produit_rayon || "AUTRES";
        if (!grouped[rayon]) grouped[rayon] = [];
        grouped[rayon].push(l);
    });

    const sortedRayons = Object.keys(grouped).sort();
    let currentY = 35;

    let totalGlobal = 0;

    sortedRayons.forEach(rayon => {
        // Title Rayon
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(t('stock.inventaire.pdf.rayon', { name: rayon }), 14, currentY);
        currentY += 2;

        // Sort items alphabetically by name within Rayon
        const rayonItems = grouped[rayon].sort((a, b) => {
             const nameA = (a.produit as any).name || a.produit_nom || '';
             const nameB = (b.produit as any).name || b.produit_nom || '';
             return nameA.localeCompare(nameB);
        });

        const tableBody = rayonItems.map(l => {
            // Priority: PMP Snapshot > Produit Cost Price (flat) > Produit Cost Price (nested)
            let pmpVal = parseFloat(l.pmp_snapshot || '0');
            if (pmpVal === 0) {
                 pmpVal = parseFloat(l.produit_cost_price || '0');
            }
            if (pmpVal === 0 && (l.produit as any).cost_price) {
                 pmpVal = parseFloat((l.produit as any).cost_price || '0');
            }

            const val = l.ecart * pmpVal;
            totalGlobal += val;

            const prodName = (l.produit as any).name || l.produit_nom || 'Produit';
            
            return [
                (l.produit as any).id?.toString() || l.produit.toString(),
                prodName.substring(0, 50),
                pmpVal.toFixed(0),
                l.stock_theorique.toString(),
                l.quantite_physique.toString(),
                l.ecart > 0 ? `+${l.ecart}` : l.ecart.toString(),
                val > 0 ? `+${val.toFixed(0)}` : val.toFixed(0)
            ];
        });

        // Total Rayon
        const totalRayon = grouped[rayon].reduce((acc, l) => {
             const pmpVal = parseFloat(l.pmp_snapshot) > 0 ? parseFloat(l.pmp_snapshot) : parseFloat((l.produit as any).cost_price || '0');
             return acc + (l.ecart * pmpVal);
        }, 0);
        
        tableBody.push(['', '', '', '', '', t('stock.inventaire.pdf.total_rayon'), totalRayon > 0 ? `+${totalRayon.toFixed(0)}` : totalRayon.toFixed(0)]);

        autoTable(doc, {
            startY: currentY,
            head: [[
                t('stock.inventaire.pdf.col_id'),
                t('stock.inventaire.pdf.col_product'),
                t('stock.inventaire.pdf.col_pmp'),
                t('stock.inventaire.pdf.col_theo'),
                t('stock.inventaire.pdf.col_phys'),
                t('stock.inventaire.pdf.col_gap'),
                t('stock.inventaire.pdf.col_val')
            ]],
            body: tableBody,
            theme: 'plain', 
            styles: {
                fontSize: 8,
                cellPadding: 1,
                overflow: 'linebreak',
                lineWidth: 0.1,
                lineColor: [0, 0, 0]
            },
            headStyles: {
                fontStyle: 'bold',
                fillColor: false,
                textColor: [0, 0, 0],
                lineWidth: 0.1,
                lineColor: [0, 0, 0]
            },
            columnStyles: {
                0: { cellWidth: 15 }, 
                1: { cellWidth: 80 }, 
                2: { cellWidth: 20, halign: 'right' }, 
                3: { cellWidth: 15, halign: 'right' },
                4: { cellWidth: 15, halign: 'right' },
                5: { cellWidth: 15, halign: 'right' },
                6: { cellWidth: 25, halign: 'right' } 
            },
            didDrawPage: (data) => {
               // Nothing strictly needed here as autoTable handles pagination
            }
        });
        
        currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(t('stock.inventaire.pdf.total_global', { 
        sign: totalGlobal > 0 ? '+' : '',
        amount: totalGlobal.toFixed(0)
    }), 14, currentY);

    doc.save(`inventaire_${activeInventaire.id}_etat.pdf`);
  };

  const handlePrintEcartsFrontend = () => {
    if (!activeInventaire || !lignes.length) return;

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(14);
    doc.text(t('stock.inventaire.pdf.title_ecarts', { id: activeInventaire.id }), 14, 15);
    doc.setFontSize(10);
    doc.text(t('stock.inventaire.pdf.date', { date: new Date(activeInventaire.date).toLocaleDateString('fr-FR') }), 14, 22);

    // Filter lines with discrepancies
    const linesWithGaps = lignes.filter(l => l.ecart !== 0);
    
    if (linesWithGaps.length === 0) {
        doc.text(t('stock.inventaire.pdf.no_gaps'), 14, 35);
        doc.save(`inventaire_${activeInventaire.id}_ecarts.pdf`);
        return;
    }

    // Group by Rayon
    const grouped: Record<string, LigneInventaire[]> = {};
    linesWithGaps.forEach(l => {
        const rayon = (l.produit as any).rayon_name || l.produit_rayon || "AUTRES";
        if (!grouped[rayon]) grouped[rayon] = [];
        grouped[rayon].push(l);
    });

    const sortedRayons = Object.keys(grouped).sort();
    let currentY = 35;
    let totalGlobal = 0;

    sortedRayons.forEach(rayon => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(t('stock.inventaire.pdf.rayon', { name: rayon }), 14, currentY);
        currentY += 2;

        // Sort items alphabetically within Rayon
        const rayonItems = grouped[rayon].sort((a, b) => {
             const nameA = (a.produit as any).name || a.produit_nom || '';
             const nameB = (b.produit as any).name || b.produit_nom || '';
             return nameA.localeCompare(nameB);
        });

        const tableBody = rayonItems.map(l => {
            // Priority: PMP Snapshot > Produit Cost Price (flat) > Produit Cost Price (nested)
            let pmpVal = parseFloat(l.pmp_snapshot || '0');
            if (pmpVal === 0) {
                 pmpVal = parseFloat(l.produit_cost_price || '0');
            }
            if (pmpVal === 0 && (l.produit as any).cost_price) {
                 pmpVal = parseFloat((l.produit as any).cost_price || '0');
            }

            const val = l.ecart * pmpVal;
            totalGlobal += val;

            const prodName = (l.produit as any).name || l.produit_nom || 'Produit';
            
            return [
                (l.produit as any).id?.toString() || l.produit.toString(),
                prodName.substring(0, 50),
                pmpVal.toFixed(0),
                l.stock_theorique.toString(),
                l.quantite_physique.toString(),
                l.ecart > 0 ? `+${l.ecart}` : l.ecart.toString(),
                val > 0 ? `+${val.toFixed(0)}` : val.toFixed(0)
            ];
        });

        // Total Rayon
        const totalRayon = grouped[rayon].reduce((acc, l) => {
             const pmpVal = parseFloat(l.pmp_snapshot) > 0 ? parseFloat(l.pmp_snapshot) : parseFloat((l.produit as any).cost_price || '0');
             return acc + (l.ecart * pmpVal);
        }, 0);
        
        tableBody.push(['', '', '', '', '', t('stock.inventaire.pdf.total_rayon'), totalRayon > 0 ? `+${totalRayon.toFixed(0)}` : totalRayon.toFixed(0)]);

        autoTable(doc, {
            startY: currentY,
            head: [[
                t('stock.inventaire.pdf.col_id'),
                t('stock.inventaire.pdf.col_product'),
                t('stock.inventaire.pdf.col_pmp'),
                t('stock.inventaire.pdf.col_theo'),
                t('stock.inventaire.pdf.col_phys'),
                t('stock.inventaire.pdf.col_gap'),
                t('stock.inventaire.pdf.col_val')
            ]],
            body: tableBody,
            theme: 'plain', 
            styles: {
                fontSize: 8,
                cellPadding: 1,
                overflow: 'linebreak',
                lineWidth: 0.1,
                lineColor: [0, 0, 0]
            },
            headStyles: {
                fontStyle: 'bold',
                fillColor: false,
                textColor: [0, 0, 0],
                lineWidth: 0.1,
                lineColor: [0, 0, 0]
            },
            columnStyles: {
                0: { cellWidth: 15 }, 
                1: { cellWidth: 80 }, 
                2: { cellWidth: 20, halign: 'right' }, 
                3: { cellWidth: 15, halign: 'right' },
                4: { cellWidth: 15, halign: 'right' },
                5: { cellWidth: 15, halign: 'right' },
                6: { cellWidth: 25, halign: 'right' } 
            },
            didDrawPage: (data) => {
               if (data.cursor) {
                   currentY = data.cursor.y + 10;
               }
            }
        });
        
        currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(t('stock.inventaire.pdf.total_global', { 
        sign: totalGlobal > 0 ? '+' : '',
        amount: totalGlobal.toFixed(0)
    }), 14, currentY);

    doc.save(`inventaire_${activeInventaire.id}_ecarts.pdf`);

  };

  const renderAnalysis = () => {
    if (loadingStats) return (
        <div className="flex flex-col items-center justify-center p-20 gap-4 bg-base-100 rounded-2xl border border-base-300">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="text-sm font-medium text-base-content/40">{t('common.loading', { defaultValue: 'Chargement des analyses...' })}</p>
        </div>
    );
    
    if (!inventoryStats) return (
        <div className="flex flex-col items-center justify-center p-20 gap-4 bg-base-100 rounded-2xl border border-base-300">
            <BarChart3 className="h-12 w-12 opacity-10" />
            <p className="text-sm font-medium text-base-content/40">{t('stock.inventaire.analysis.no_data')}</p>
        </div>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
            {/* Top Losses Card */}
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col">
                <div className="p-5 border-b border-base-200 bg-base-50/50 flex items-center justify-between">
                    <h3 className="font-bold text-base-content flex items-center gap-3">
                        <div className="p-2 bg-error/10 rounded-xl">
                            <TrendingDown className="h-5 w-5 text-error" />
                        </div>
                        {t('stock.inventaire.analysis.top_losses')}
                    </h3>
                    <span className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">{t('common.top_10', { defaultValue: 'Top 10' })}</span>
                </div>
                <div className="p-5 space-y-4">
                    {inventoryStats.top_pertes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-20">
                            <BarChart3 className="h-10 w-10" />
                            <p className="text-sm font-medium">{t('stock.inventaire.analysis.no_data')}</p>
                        </div>
                    ) : (
                        inventoryStats.top_pertes.map((p, i) => (
                            <div key={i} className="flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center text-xs font-bold text-base-content/40 group-hover:bg-error/10 group-hover:text-error transition-colors">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-base-content group-hover:text-primary transition-colors">{p.produit_nom}</div>
                                        <div className="text-[10px] font-bold text-error/60 uppercase tracking-tight mt-0.5">
                                            {p.ecart} {t('common.units', { defaultValue: 'unités' })}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-mono font-bold text-error">{p.valeur.toLocaleString()} F</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Discrepancies by Rayon Card */}
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden flex flex-col">
                <div className="p-5 border-b border-base-200 bg-base-50/50 flex items-center justify-between">
                    <h3 className="font-bold text-base-content flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Layers className="h-5 w-5 text-primary" />
                        </div>
                        {t('stock.inventaire.analysis.gap_by_rayon')}
                    </h3>
                </div>
                <div className="p-5 space-y-3">
                    {inventoryStats.par_rayon.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-20">
                            <PieChart className="h-10 w-10" />
                            <p className="text-sm font-medium">{t('stock.inventaire.analysis.no_data')}</p>
                        </div>
                    ) : (
                        inventoryStats.par_rayon.map((r, i) => {
                            const isNegative = r.total < 0;
                            return (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-base-200/50 transition-all border border-transparent hover:border-base-300">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${isNegative ? 'bg-error' : 'bg-success'}`} />
                                        <span className="font-bold text-sm text-base-content/80">{r.rayon}</span>
                                    </div>
                                    <div className={`font-mono font-bold ${isNegative ? 'text-error' : r.total > 0 ? 'text-success' : 'text-base-content/40'}`}>
                                        {r.total > 0 ? '+' : ''}{r.total.toLocaleString()} F
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                {inventoryStats.par_rayon.length > 0 && (
                    <div className="p-5 mt-auto border-t border-base-200 bg-base-50/30">
                        <button 
                            className="btn btn-ghost btn-sm w-full rounded-xl gap-2 text-base-content/40 hover:text-primary transition-all"
                            onClick={handlePrintEcartsFrontend}
                        >
                            <Download className="h-4 w-4" />
                            {t('stock.inventaire.analysis.print_report', { defaultValue: 'Imprimer le rapport d\'écarts' })}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
  };

  // === RENDER ===

  const renderList = () => (
    <>
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                {/* Title & Filters & QuickStats */}
                <div className="w-full space-y-4">
                    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col">
                        <div className="p-6 border-b border-base-200">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h1 className="text-2xl font-bold text-base-content tracking-tight flex items-center gap-2">
                                        <ClipboardList className="h-6 w-6 text-primary" />
                                        {t('stock.inventaire.title')}
                                    </h1>
                                    <p className="text-base-content/60 text-sm mt-1">
                                        {t('stock.inventaire.subtitle', { defaultValue: "Gérez et validez vos inventaires de stock" })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        type="button"
                                        className="btn btn-secondary rounded-xl gap-2 shadow-lg shadow-secondary/20"
                                        onClick={openMergeModalFromList}
                                        disabled={!canMergeSelectedInventaires().canMerge}
                                        title={canMergeSelectedInventaires().reason || ''}
                                    >
                                        <Database className="h-4 w-4" />
                                        {t('stock.inventaire.merge_btn')}
                                    </button>
                                    <button 
                                        className="btn btn-primary rounded-xl px-6 shadow-lg shadow-primary/20 gap-2" 
                                        onClick={handleCreate}
                                    >
                                        <Plus className="h-5 w-5" />
                                        {t('stock.inventaire.create_btn')}
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <InventaireFilters 
                            filters={{
                                startDate: filterStartDate,
                                setStartDate: setFilterStartDate,
                                endDate: filterEndDate,
                                setEndDate: setFilterEndDate,
                                searchTerm: filterSearchTerm,
                                setSearchTerm: setFilterSearchTerm,
                                statusFilter: filterStatus,
                                setStatusFilter: setFilterStatus,
                                creatorFilter: filterCreator,
                                setCreatorFilter: setFilterCreator
                            }}
                            onRefresh={() => fetchInventaires()}
                        />
                    </div>
                </div>
                
                 {/* Quick Stats Dashboard */}
                 <InventaireQuickStats />
            </div>

            {/* Main Content: Table */}
            <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden mt-6">
                <InventaireListTable 
                    inventaires={inventaires}
                    loading={loading}
                    selectedIds={selectedInventaireIds}
                    onSelectAll={toggleSelectAllInventaires}
                    onSelect={toggleSelectInventaire}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
                
                {/* Pagination Controls */}
                <div className="p-4 border-t border-base-200 flex items-center justify-between">
                    <div className="text-sm text-base-content/60 font-medium">
                        Page {currentPage} - Total: <span className="text-base-content font-bold">{totalCount}</span> {t('stock.inventaire.list.title_short', { defaultValue: 'inventaires' })}
                    </div>
                    <div className="flex gap-2">
                        <button 
                            className="btn btn-sm btn-outline rounded-xl px-4 gap-1 transform active:scale-95 transition-all" 
                            disabled={!prevPage || loading}
                            onClick={() => prevPage && fetchInventaires(prevPage)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            {t('common.pagination.prev', { defaultValue: 'Précédent' })}
                        </button>
                        <button 
                            className="btn btn-sm btn-outline rounded-xl px-4 gap-1 transform active:scale-95 transition-all" 
                            disabled={!nextPage || loading}
                            onClick={() => nextPage && fetchInventaires(nextPage)}
                        >
                            {t('common.pagination.next', { defaultValue: 'Suivant' })}
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
    </div>
    </>
  );


  

  // Create / Edit View Variables
  const isReadOnly = activeInventaire?.status === 'VALIDEE';
  const totalEcartValeur = lignes.reduce((sum, l) => {
      const price = parseFloat(l.produit_cost_price || l.pmp_snapshot || '0');
      return sum + (l.ecart * price);
  }, 0);
  const totalValeurPhysique = lignes.reduce((sum, l) => {
      const price = parseFloat(l.produit_cost_price || l.pmp_snapshot || '0');
      return sum + (l.quantite_physique * price);
  }, 0);
  const totalValeurTheorique = lignes.reduce((sum, l) => {
      const price = parseFloat(l.produit_cost_price || l.pmp_snapshot || '0');
      return sum + (l.stock_theorique * price);
  }, 0);

  return (
    <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans">
      {viewMode === 'LIST' ? renderList() : (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          
          {/* Header Card (Editor Mode) */}
          <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-base-200">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                  <button 
                    className="btn btn-ghost btn-circle rounded-xl hover:bg-base-200" 
                    onClick={() => setViewMode('LIST')}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <div>
                    <h1 className="text-2xl font-bold text-base-content tracking-tight flex items-center gap-2">
                       {viewMode === 'CREATE' ? (
                         <>
                           <Plus className="h-6 w-6 text-primary" />
                           {t('stock.inventaire.detail.title_new')}
                         </>
                       ) : (
                         <>
                           <FileText className="h-6 w-6 text-primary" />
                           {t('stock.inventaire.detail.title_edit', { id: activeInventaire?.id })}
                         </>
                       )}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        {isReadOnly ? (
                            <span className="badge badge-success rounded-full text-[10px] font-bold uppercase tracking-wider gap-1 px-3 border-none">
                                <CheckCircle2 className="h-3 w-3" />
                                {t('stock.inventaire.detail.validated')}
                            </span>
                        ) : (
                            <span className="badge badge-warning rounded-full text-[10px] font-bold uppercase tracking-wider gap-1 px-3 border-none">
                                <History className="h-3 w-3" />
                                {t('common.status.draft', { defaultValue: 'Brouillon' })}
                            </span>
                        )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-base-200 p-1 rounded-xl border border-base-300 flex">
                    <button 
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all gap-2 flex items-center
                            ${viewTab === 'DATA' ? 'bg-primary text-primary-content shadow-md' : 'text-base-content/60 hover:bg-base-100'}`}
                        onClick={() => setViewTab('DATA')}
                    >
                        <Database className="h-3.5 w-3.5" />
                        {t('stock.inventaire.detail.tab_data')}
                    </button>
                    <button 
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all gap-2 flex items-center
                            ${viewTab === 'ANALYSIS' ? 'bg-primary text-primary-content shadow-md' : 'text-base-content/60 hover:bg-base-100'}`}
                        onClick={() => {
                            setViewTab('ANALYSIS');
                            if (activeInventaire) fetchStats(activeInventaire.id);
                        }}
                    >
                        <BarChart3 className="h-3.5 w-3.5" />
                        {t('stock.inventaire.detail.tab_analysis')}
                    </button>
                  </div>

                  <button 
                    className="btn btn-primary rounded-xl px-6 gap-2 shadow-lg shadow-primary/20" 
                    onClick={handlePrintEtatFrontend}
                    disabled={!activeInventaire?.id}
                  >
                    <Download className="h-5 w-5" />
                    {t('stock.inventaire.detail.print')}
                  </button>

                  {!isReadOnly && activeInventaire && (
                    <div className="flex gap-2">
                        {lignes.some(l => l.isLocalOnly) && (
                            <button 
                                className="btn btn-warning rounded-xl gap-2 animate-pulse" 
                                onClick={handleSyncLines} 
                                disabled={saving}
                            >
                                {saving ? <span className="loading loading-spinner loading-sm"></span> : <Save className="h-5 w-5" />}
                                {t('stock.inventaire.detail.sync_now', { count: lignes.filter(l => l.isLocalOnly).length })}
                            </button>
                        )}
                        <button 
                            className="btn btn-info rounded-xl text-white gap-2" 
                            onClick={() => setShowMergeModal(true)}
                        >
                            <ArrowUpDown className="h-5 w-5" />
                            {t('stock.inventaire.detail.merge_to')}
                        </button>
                        <button 
                            className="btn btn-success rounded-xl text-white gap-2 shadow-lg shadow-success/20" 
                            onClick={handleOpenValidateModal} 
                            disabled={saving || lignes.some(l => l.isLocalOnly)}
                        >
                            {saving ? (
                                <span className="loading loading-spinner"></span>
                            ) : (
                                <CheckCircle2 className="h-5 w-5" />
                            )}
                            {t('stock.inventaire.detail.validate')}
                        </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Header Form Area */}
            <div className="p-6 bg-base-50/50 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">{t('stock.inventaire.detail.date')}</label>
                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/30" />
                        <input 
                            type="date" 
                            className="input input-bordered w-full pl-11 rounded-xl border-base-300 focus:border-primary focus:ring-1 focus:ring-primary" 
                            value={dateInventaire} 
                            onChange={e => setDateInventaire(e.target.value)}
                            disabled={isReadOnly}
                            onBlur={handleSaveHeader}
                        />
                    </div>
                </div>
                <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">{t('stock.inventaire.detail.description')}</label>
                    <div className="relative">
                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/30" />
                        <input 
                            type="text" 
                            className="input input-bordered w-full pl-11 rounded-xl border-base-300 focus:border-primary focus:ring-1 focus:ring-primary" 
                            placeholder={t('stock.inventaire.detail.placeholder_desc')}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            disabled={isReadOnly}
                            onBlur={handleSaveHeader}
                        />
                    </div>
                </div>
            </div>
          </div>

          {/* Work Area */}
          <div className="grid grid-cols-1 gap-6">
            
            {/* Product Search Card */}
            {!isReadOnly && (
              <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-1 overflow-visible relative">
                <div className="relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-base-content/30" />
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        className="input input-ghost w-full h-16 pl-14 pr-16 text-lg focus:bg-base-200/50 rounded-2xl focus:outline-none" 
                        placeholder={t('stock.inventaire.detail.search_placeholder')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        autoFocus
                    />
                    {loadingSearch && (
                        <div className="absolute right-6 top-1/2 -translate-y-1/2">
                            <span className="loading loading-spinner text-primary"></span>
                        </div>
                    )}
                </div>

                {/* Search Results Dropdown */}
                {searchQuery && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-base-100 rounded-2xl shadow-2xl border border-base-300 max-h-[60vh] overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-200">
                    {searchResults.length === 0 ? (
                      <div className="text-center py-10 text-base-content/40">
                        {loadingSearch ? (
                            <span className="loading loading-spinner text-primary"></span>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <Search className="h-8 w-8 opacity-20" />
                                <p className="text-sm">{t('stock.inventaire.detail.no_result')}</p>
                            </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {searchResults.map((p, idx) => {
                          const itemProps = getItemProps(idx);
                          return (
                            <div 
                              key={p.id}
                              {...itemProps}
                              onClick={() => handleProductSelect(p)}
                              className={`
                                group flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all
                                ${itemProps.className ? 'bg-primary text-primary-content shadow-lg shadow-primary/20 scale-[1.01]' : 'hover:bg-base-200'}
                              `}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-bold truncate">{p.name}</div>
                                <div className={`text-xs flex gap-3 mt-1 opacity-70 ${itemProps.className ? 'text-primary-content/80' : 'text-base-content/60'}`}>
                                  <span className="font-mono">{p.cip1}</span>
                                  {p.rayon_name && <span className="opacity-50">• {p.rayon_name}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${itemProps.className ? 'bg-white/20 border-white/20' : (p.stock ?? 0) > 0 ? 'bg-success/10 text-success border-success/20' : 'bg-error/10 text-error border-error/20'}`}>
                                  Stock: {p.stock}
                                </span>
                                {p.use_lot_management && (
                                  <div className={`p-1 rounded-lg ${itemProps.className ? 'bg-white/20' : 'bg-info/10'}`}>
                                    <Database className={`h-4 w-4 ${itemProps.className ? 'text-white' : 'text-info'}`} />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {viewTab === 'ANALYSIS' ? renderAnalysis() : (
              <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden">
                {/* Table Filters & Bulk Actions */}
                <div className="p-4 border-b border-base-200 bg-base-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                  {selectedLines.size > 0 ? (
                    <div className="flex items-center gap-3 w-full animate-in slide-in-from-left-2 transition-all">
                       <div className="bg-error text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md">
                        {selectedLines.size}
                      </div>
                      <span className="font-bold text-error">{t('stock.inventaire.lines.selected', { count: selectedLines.size })}</span>
                      <div className="flex gap-2 ml-auto">
                        <button 
                            className="btn btn-sm btn-ghost rounded-lg"
                            onClick={() => setSelectedLines(new Set())}
                        >
                            {t('stock.inventaire.deselect')}
                        </button>
                        <button 
                            className="btn btn-sm btn-error text-white rounded-lg gap-2 px-4"
                            onClick={handleBulkDelete}
                        >
                            <Trash2 className="h-4 w-4" />
                            {t('stock.inventaire.lines.delete_selection')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-base-content/30" />
                            <input
                                type="text"
                                placeholder={t('stock.inventaire.lines.search_placeholder')}
                                className="input input-bordered input-sm w-full pl-9 rounded-xl"
                                value={searchLignesQuery}
                                onChange={(e) => setSearchLignesQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="flex items-center gap-2">
                                <ArrowUpDown className="h-4 w-4 text-base-content/30" />
                                <select 
                                    className="select select-bordered select-sm rounded-xl" 
                                    value={sortBy} 
                                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                                >
                                    <option value="CHRONOLOGICAL">{t('stock.inventaire.lines.sort_chronological')}</option>
                                    <option value="NAME">{t('stock.inventaire.lines.sort_name')}</option>
                                    <option value="GAP_VALUE">{t('stock.inventaire.lines.sort_gap_value')}</option>
                                    <option value="GAP_QTY">{t('stock.inventaire.lines.sort_gap_qty')}</option>
                                </select>
                            </div>
                            <button 
                                className="btn btn-ghost btn-sm btn-circle rounded-xl hover:bg-base-200"
                                onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
                            >
                                <ArrowUpDown className={`h-4 w-4 transition-transform ${sortOrder === 'ASC' ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                    </>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-base-200/50 border-b border-base-300 text-left text-[10px] font-bold text-base-content/40 uppercase tracking-widest">
                        {!isReadOnly && (
                          <th className="px-4 py-4 w-10">
                            <input 
                                type="checkbox" 
                                className="checkbox checkbox-xs checkbox-primary" 
                                checked={lignes.length > 0 && selectedLines.size === lignes.length}
                                onChange={toggleSelectAll}
                            />
                          </th>
                        )}
                        <th className="px-6 py-4">{t('stock.inventaire.lines.product')}</th>
                        <th className="px-6 py-4">{t('stock.inventaire.lines.rayon')}</th>
                        <th className="px-6 py-4 text-right">{t('stock.inventaire.lines.buy_price')}</th>
                        <th className="px-6 py-4 text-center">{t('stock.inventaire.lines.stock_theo')}</th>
                        <th className="px-6 py-4 text-center">{t('stock.inventaire.lines.qty_saisie')}</th>
                        <th className="px-6 py-4 text-center">{t('stock.inventaire.lines.ecart_qty')}</th>
                        <th className="px-6 py-4 text-right">{t('stock.inventaire.lines.ecart_val')}</th>
                        {!isReadOnly && <th className="px-6 py-4 text-right"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-200">
                      {[...lignes].filter(l => {
                          if (!searchLignesQuery) return true;
                          const q = searchLignesQuery.toLowerCase();
                          const name = (typeof l.produit === 'object' ? l.produit.name : l.produit_nom) || '';
                          const cip = (typeof l.produit === 'object' ? l.produit.cip1 : l.produit_cip) || '';
                          return name.toLowerCase().includes(q) || cip.toLowerCase().includes(q);
                      }).sort((a, b) => {
                          let comparison = 0;
                          switch (sortBy) {
                              case 'NAME':
                                  const nameA = (typeof a.produit === 'object' ? a.produit.name : a.produit_nom) || '';
                                  const nameB = (typeof b.produit === 'object' ? b.produit.name : b.produit_nom) || '';
                                  comparison = nameA.localeCompare(nameB);
                                  break;
                              case 'GAP_VALUE':
                                  const priceA = parseFloat(a.produit_cost_price || '0');
                                  const valA = a.ecart * priceA;
                                  const priceB = parseFloat(b.produit_cost_price || '0');
                                  const valB = b.ecart * priceB;
                                  comparison = valA - valB; 
                                  break;
                              case 'GAP_QTY':
                                  comparison = a.ecart - b.ecart;
                                  break;
                              case 'CHRONOLOGICAL':
                              default:
                                  comparison = a.id - b.id;
                                  break;
                          }
                          return sortOrder === 'ASC' ? comparison : -comparison;
                      }).map((ligne, index) => {
                          const price = parseFloat(ligne.produit_cost_price || ligne.pmp_snapshot || '0');
                          const ecartValeur = ligne.ecart * price;
                          const isSelected = selectedLines.has(ligne.id);
                          return (
                            <tr key={ligne.id} className={`group hover:bg-base-200/50 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                                {!isReadOnly && (
                                    <td className="px-4 py-4">
                                        <input 
                                            type="checkbox" 
                                            className="checkbox checkbox-xs checkbox-primary" 
                                            checked={isSelected}
                                            onChange={() => toggleSelectLine(ligne.id)}
                                        />
                                    </td>
                                )}
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-base-content flex items-center gap-2">
                                            {typeof ligne.produit === 'object' ? ligne.produit.name : ligne.produit_nom}
                                            {ligne.isLocalOnly && <span className="badge badge-warning text-[8px] font-bold uppercase px-1.5 h-4 border-none">Local</span>}
                                        </span>
                                        <div className="text-xs text-base-content/40 flex items-center gap-2 mt-0.5">
                                            <span className="font-mono bg-base-200 px-1 rounded">{typeof ligne.produit === 'object' ? ligne.produit.cip1 : ligne.produit_cip}</span>
                                            {ligne.lot_numero && (
                                                <span className="text-info flex items-center gap-1 font-medium">
                                                    <Database className="h-3 w-3" />
                                                    {ligne.lot_numero}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-xs font-semibold text-base-content/60 bg-base-200/50 px-2 py-1 rounded-lg border border-base-300">
                                        {typeof ligne.produit === 'object' ? ligne.produit.rayon_name : ligne.produit_rayon}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-base-content/60">
                                    {price.toLocaleString()} F
                                </td>
                                <td className="px-6 py-4 text-center font-bold text-base-content/40">
                                    {ligne.stock_theorique}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {isReadOnly ? (
                                        <div className="w-24 mx-auto py-1 bg-base-200 rounded-lg font-bold text-base-content">
                                            {ligne.quantite_physique}
                                        </div>
                                    ) : (
                                        <input 
                                            id={`qty-input-${index}`}
                                            type="text" 
                                            inputMode="numeric"
                                            className="input input-bordered input-sm w-24 text-center font-bold rounded-xl focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                                            value={ligne.quantite_physique}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (/^\d*$/.test(val)) {
                                                    handleUpdateQuantity(ligne.id, val === '' ? 0 : parseInt(val));
                                                }
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={(e) => handleKeyDown(e, index)}
                                        />
                                    )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border shadow-xs
                                        ${ligne.ecart < 0 ? 'bg-error/10 text-error border-error/20' : 
                                          ligne.ecart > 0 ? 'bg-success/10 text-success border-success/20' : 
                                          'bg-base-200 text-base-content/40 border-base-300'}`}
                                    >
                                        {ligne.ecart > 0 ? '+' : ''}{ligne.ecart}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span className={`font-mono font-bold text-sm
                                        ${ecartValeur < 0 ? 'text-error' : ecartValeur > 0 ? 'text-success' : 'text-base-content/40'}`}>
                                        {ecartValeur > 0 ? '+' : ''}{ecartValeur.toLocaleString()} F
                                    </span>
                                </td>
                                {!isReadOnly && (
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            className="p-2 text-base-content/20 hover:text-error hover:bg-error/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            onClick={() => handleDeleteLine(ligne.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                )}
                            </tr>
                          );
                      })}
                      {lignes.length === 0 && (
                        <tr>
                          <td colSpan={!isReadOnly ? 9 : 8} className="py-20 text-center">
                            <div className="flex flex-col items-center gap-2 opacity-20">
                                <Package className="h-10 w-10" />
                                <p className="text-sm font-medium">{t('stock.inventaire.lines.empty_hint')}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer Totals area */}
                <div className="p-6 bg-base-50 border-t border-base-200 flex flex-wrap justify-end gap-10">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">{t('stock.inventaire.lines.total_theo')}</span>
                        <span className="text-xl font-mono text-base-content/60">{totalValeurTheorique.toLocaleString()} F</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">{t('stock.inventaire.lines.total_phys')}</span>
                        <span className="text-xl font-bold text-base-content">{totalValeurPhysique.toLocaleString()} F</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">{t('stock.inventaire.lines.total_gap')}</span>
                        <span className={`text-2xl font-black font-mono shadow-xs px-3 rounded-xl border
                            ${totalEcartValeur < 0 ? 'bg-error/5 text-error border-error/10' : 
                              totalEcartValeur > 0 ? 'bg-success/5 text-success border-success/10' : 
                              'bg-base-200/50 text-base-content/40 border-base-200'}`}
                        >
                            {totalEcartValeur > 0 ? '+' : ''}{totalEcartValeur.toLocaleString()} F
                        </span>
                    </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}{showLotModal && (
        <dialog className="modal modal-open">
          <div className="modal-box rounded-2xl shadow-2xl border border-base-300 p-0 overflow-hidden max-w-md" onKeyDown={handleLotModalKeyDown} tabIndex={0} autoFocus>
            <div className="p-6 border-b border-base-200 bg-base-50 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                    <Database className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h3 className="font-bold text-lg text-base-content">{t('stock.inventaire.modals.lot_title')}</h3>
                    <p className="text-xs text-base-content/60 mt-0.5">{t('stock.inventaire.modals.lot_for', { name: selectedProductForLot?.name })}</p>
                </div>
            </div>
            
            <div className="p-6">
                <div className="alert alert-info border-none bg-info/10 text-info text-xs font-bold mb-4 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    {t('stock.inventaire.modals.lot_hint')}
                </div>
                
                <div className="space-y-2">
                    {loadingLots ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <span className="loading loading-spinner text-primary"></span>
                            <span className="text-xs font-medium text-base-content/40">{t('common.loading')}</span>
                        </div>
                    ) : availableLots.length === 0 ? (
                        <div className="text-center py-10 bg-base-200/50 rounded-2xl border border-dashed border-base-300">
                            <p className="text-sm text-base-content/40 italic mb-4">{t('stock.inventaire.modals.lot_none')}</p>
                            <button 
                                className="btn btn-primary btn-sm rounded-xl px-4" 
                                onClick={() => handleAddProduct(selectedProductForLot!)}
                            >
                                <Plus className="h-4 w-4" />
                                {t('stock.inventaire.modals.add_global')}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                            {availableLots.map((lot, index) => (
                                <button 
                                    key={lot.id} 
                                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left group
                                        ${index === focusedLotIndex ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'border-base-200 hover:border-primary/30 bg-base-100'}`}
                                    onClick={() => handleLotSelection(lot.id)}
                                    onMouseEnter={() => setFocusedLotIndex(index)}
                                >
                                    <div className="flex flex-col gap-1">
                                        <div className="font-bold text-base-content">Lot: {lot.lot || 'N/A'}</div>
                                        <div className="text-[10px] font-bold text-base-content/40 uppercase flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {lot.date_expiration ? new Date(lot.date_expiration).toLocaleDateString() : 'N/A'}
                                        </div>
                                    </div>
                                    <div className="badge badge-outline border-base-300 text-[10px] font-bold group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                                        {lot.quantity_remaining} {t('common.left', { defaultValue: 'restants' })}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 bg-base-50 border-t border-base-200 flex items-center justify-between">
                <button 
                    className="btn btn-ghost rounded-xl px-6" 
                    onClick={() => { setShowLotModal(false); setSelectedProductForLot(null); }}
                >
                    {t('common.cancel', { defaultValue: 'Annuler' })}
                </button>
                {availableLots.length > 0 && (
                   <button 
                       className="btn btn-ghost btn-sm text-primary/60 hover:text-primary rounded-xl"
                       onClick={() => handleAddProduct(selectedProductForLot!)}
                   >
                       {t('stock.inventaire.modals.add_global')}
                   </button>
                )}
            </div>
          </div>
        </dialog>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <dialog className="modal modal-open">
          <div className="modal-box rounded-2xl shadow-2xl border border-base-300 p-0 overflow-hidden max-w-2xl">
            <div className="p-6 border-b border-base-200 bg-base-50 flex items-center gap-4">
                <div className="p-3 bg-secondary/10 rounded-xl">
                    <LayoutGrid className="h-6 w-6 text-secondary" />
                </div>
                <div>
                    <h3 className="font-bold text-lg text-base-content">{t('stock.inventaire.modals.merge_title')}</h3>
                    <p className="text-xs text-base-content/60 mt-0.5">
                        {viewMode === 'LIST' 
                            ? t('stock.inventaire.modals.merge_subtitle_list', { count: selectedInventaireIds.size })
                            : t('stock.inventaire.modals.merge_subtitle_details')}
                    </p>
                </div>
                <button 
                  className="btn btn-ghost btn-circle btn-sm ml-auto"
                  onClick={() => { setShowMergeModal(false); setSelectedMergeSource(null); }}
                >
                  <X className="h-5 w-5" />
                </button>
            </div>

            <div className="p-6 space-y-6">
                <div className="flex items-start gap-4 p-4 bg-warning/10 rounded-2xl border border-warning/20">
                    <AlertCircle className="h-6 w-6 text-warning shrink-0" />
                    <div className="text-xs text-warning-content font-medium leading-relaxed">
                        {viewMode === 'LIST' 
                            ? t('stock.inventaire.modals.merge_warning_list')
                            : t('stock.inventaire.modals.merge_warning_external', { id: activeInventaire?.id })}
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">
                        {viewMode === 'LIST' ? t('stock.inventaire.modals.merge_target_select') : t('stock.inventaire.modals.merge_source_select')}
                    </label>
                    <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                        {viewMode === 'LIST' ? (
                            inventaires.filter(i => selectedInventaireIds.has(i.id)).map(inv => (
                                <button 
                                    key={inv.id} 
                                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left
                                        ${selectedMergeSource === inv.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-base-200 hover:border-primary/20 bg-base-100'}`}
                                    onClick={() => setSelectedMergeSource(inv.id)}
                                >
                                    <div className="flex flex-col">
                                        <div className="font-bold text-base-content flex items-center gap-2">
                                            Inventaire #{inv.id}
                                            {selectedMergeSource === inv.id && (
                                                <span className="badge badge-primary badge-xs py-2 px-2 text-[8px] font-bold uppercase tracking-widest">Cible</span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-base-content/40 font-bold uppercase mt-0.5">
                                            {new Date(inv.date).toLocaleDateString()} — {inv.description || 'Sans description'}
                                        </div>
                                    </div>
                                    <div className="font-mono font-bold text-sm text-base-content/60">{(inv.total_valeur_physique || 0).toLocaleString()} F</div>
                                </button>
                            ))
                        ) : (
                            loadingMergeCandidates ? (
                                <div className="flex flex-col items-center justify-center py-10 gap-3">
                                    <span className="loading loading-spinner text-primary"></span>
                                    <span className="text-xs font-medium text-base-content/40">{t('common.loading')}</span>
                                </div>
                            ) : mergeCandidates.length === 0 ? (
                                <div className="text-center py-10 bg-base-200/50 rounded-2xl border border-dashed border-base-300">
                                    <p className="text-sm text-base-content/40 italic">{t('stock.inventaire.modals.merge_no_candidate')}</p>
                                </div>
                            ) : (
                                mergeCandidates.map(candidate => (
                                    <button 
                                        key={candidate.id} 
                                        className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left
                                            ${selectedMergeSource === candidate.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-base-200 hover:border-primary/20 bg-base-100'}`}
                                        onClick={() => setSelectedMergeSource(candidate.id)}
                                    >
                                        <div className="flex flex-col">
                                            <div className="font-bold text-base-content">Inventaire #{candidate.id}</div>
                                            <div className="text-[10px] text-base-content/40 font-bold uppercase mt-0.5">
                                                {new Date(candidate.date).toLocaleDateString()} — {candidate.description || 'Sans description'}
                                            </div>
                                            <div className="text-[10px] text-primary/60 font-medium uppercase mt-1">Par: {candidate.created_by_name}</div>
                                        </div>
                                        <div className="font-mono font-bold text-sm text-base-content/60">{(candidate.total_valeur_physique || 0).toLocaleString()} F</div>
                                    </button>
                                ))
                            )
                        )}
                    </div>
                </div>
            </div>

            <div className="p-4 bg-base-50 border-t border-base-200 flex items-center justify-end gap-3">
                <button 
                    className="btn btn-ghost rounded-xl px-6" 
                    onClick={() => { setShowMergeModal(false); setSelectedMergeSource(null); }}
                >
                    {t('common.cancel')}
                </button>
                <button  
                    className="btn btn-primary rounded-xl px-8 shadow-lg shadow-primary/20" 
                    disabled={!selectedMergeSource || merging}
                    onClick={handleMerge}
                >
                    {merging ? <span className="loading loading-spinner"></span> : t('stock.inventaire.modals.merge_confirm_btn')}
                </button>
            </div>
          </div>
        </dialog>
      )}

      {/* Sudo Validation Modal */}
      <SudoValidationModal
        isOpen={sudoState.isOpen}
        onClose={closeSudo}
        onValidate={sudoState.onValidate}
        saving={saving}
        title={sudoState.title || t('common.auth_required')}
        message={sudoState.message || ""}
      />
    </div>
  );
}
