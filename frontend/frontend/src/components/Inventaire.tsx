import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../hooks/useConfirm';
import type { ProduitModel, Inventaire, LigneInventaire, StockLot } from '../types';
import { useSearchNavigation } from '../hooks/useSearchNavigation';
import { useProductSearch } from '../hooks/useProductSearch';
import { useSudo } from '../hooks/useSudo';
import SudoValidationModal from './common/SudoValidationModal';

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
      const endpoint = url || inventairesEndpoint;
      const res = await axios.get(endpoint);
      
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
      fetchInventaires();
    }
  }, [viewMode]);

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
      if (loadingStats) return <div className="flex justify-center p-8"><span className="loading loading-spinner loading-lg"></span></div>;
      if (!inventoryStats) return <div className="text-center p-8 opacity-50">Aucune donnée disponible.</div>;

      return (
          <div className="space-y-6 animate-fade-in">
              <div className="flex justify-end">
                  <button className="btn btn-outline gap-2" onClick={handlePrintEcartsFrontend}>
                      {t('stock.inventaire.analysis.print_ecarts')}
                  </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Top 10 Pertes */}
                  <div className="card bg-base-100 shadow border border-base-200">
                      <div className="card-body">
                          <h3 className="card-title text-error">{t('stock.inventaire.analysis.top_losses')}</h3>
                          <div className="overflow-x-auto">
                              <table className="table table-xs">
                                  <thead>
                                      <tr>
                                          <th>{t('stock.inventaire.table.product')}</th>
                                          <th className="text-right">{t('stock.inventaire.table.gap')}</th>
                                          <th className="text-right">{t('stock.inventaire.analysis.loss')}</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {inventoryStats.top_pertes.length === 0 ? (
                                          <tr><td colSpan={3} className="text-center text-gray-500 py-4">{t('stock.inventaire.analysis.no_data')}</td></tr>
                                      ) : inventoryStats.top_pertes.map((p, idx) => (
                                          <tr key={idx}>
                                              <td className="truncate max-w-[150px]" title={p.produit_nom}>{p.produit_nom}</td>
                                              <td className="text-right font-bold text-error">{p.ecart}</td>
                                              <td className="text-right font-mono text-error">{p.valeur.toLocaleString()} F</td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>

                  {/* Ecarts par Rayon */}
                  <div className="card bg-base-100 shadow border border-base-200">
                      <div className="card-body">
                          <h3 className="card-title">{t('stock.inventaire.analysis.ecarts_by_rayon')}</h3>
                          <div className="overflow-x-auto">
                              <table className="table table-xs">
                                  <thead>
                                      <tr>
                                          <th>{t('stock.inventaire.lines.rayon')}</th>
                                          <th className="text-right">{t('stock.inventaire.analysis.total_ecart')}</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {inventoryStats.par_rayon.map((r, idx) => (
                                          <tr key={idx}>
                                              <td>{r.rayon}</td>
                                              <td className={`text-right font-bold ${r.total < 0 ? 'text-error' : r.total > 0 ? 'text-success' : ''}`}>
                                                  {r.total > 0 ? '+' : ''}{r.total.toLocaleString()} F
                                              </td>
                                          </tr>
                                      ))}
                                      {inventoryStats.par_rayon.length === 0 && (
                                          <tr><td colSpan={2} className="text-center text-gray-500 py-4">{t('stock.inventaire.analysis.no_data')}</td></tr>
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  // === RENDER ===

  const renderList = () => (
          <div className="space-y-6">
              <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold">{t('stock.inventaire.title')}</h1>
                  <button className="btn btn-primary" onClick={handleCreate}>
                      {t('stock.inventaire.create_btn')}
                  </button>
              </div>

             {/* Bulk Action Bar */}
             {selectedInventaireIds.size > 0 && (
                <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <span className="font-semibold text-sm">{t('stock.inventaire.bulk_action', { count: selectedInventaireIds.size })}</span>
                    <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => setSelectedInventaireIds(new Set())}
                    >
                        {t('stock.inventaire.deselect')}
                    </button>
                    
                    <button
                        type="button"
                        className="btn btn-sm btn-secondary gap-1"
                        onClick={openMergeModalFromList}
                        disabled={!canMergeSelectedInventaires().canMerge}
                        title={canMergeSelectedInventaires().reason || ''}
                    >
                        {t('stock.inventaire.merge_btn')}
                    </button>
                </div>
              )}

              <div className="card bg-base-100 shadow">
                  <div className="overflow-x-auto">
                      <table className="table table-xs">
                          <thead>
                              <tr>
                                  <th className="w-10">
                                      <label>
                                          <input 
                                              type="checkbox" 
                                              className="checkbox checkbox-xs" 
                                              checked={inventaires.length > 0 && selectedInventaireIds.size === inventaires.length}
                                              onChange={toggleSelectAllInventaires}
                                          />
                                      </label>
                                  </th>
                                  <th>{t('stock.inventaire.list.date')}</th>
                                  <th>{t('stock.inventaire.list.desc')}</th>
                                  <th className="text-right">{t('stock.inventaire.list.val_theo')}</th>
                                  <th className="text-right">{t('stock.inventaire.list.val_phys')}</th>
                                  <th className="text-right">{t('stock.inventaire.list.ecart')}</th>
                                  <th>{t('stock.inventaire.list.status')}</th>
                                  <th>{t('stock.inventaire.list.created_by')}</th>
                                  <th>{t('stock.inventaire.list.actions')}</th>
                              </tr>
                          </thead>
                          <tbody>
                              {loading ? (
                                  <tr>
                                      <td colSpan={9} className="text-center py-4">
                                          <span className="loading loading-spinner"></span> {t('common.loading')}
                                      </td>
                                  </tr>
                              ) : inventaires.map(inv => (
                                  <tr key={inv.id} className={`hover:bg-base-200 cursor-pointer ${selectedInventaireIds.has(inv.id) ? 'bg-primary/5' : ''}`} onClick={() => handleEdit(inv)}>
                                      <td onClick={e => e.stopPropagation()}>
                                          <label>
                                              <input 
                                                  type="checkbox" 
                                                  className="checkbox checkbox-xs" 
                                                  checked={selectedInventaireIds.has(inv.id)}
                                                  onChange={() => toggleSelectInventaire(inv.id)}
                                              />
                                          </label>
                                      </td>
                                      <td>{new Date(inv.date).toLocaleDateString('fr-FR')}</td>
                                      <td>{inv.description || '-'}</td>
                                      <td className="text-right font-mono">{(inv.total_valeur_theorique || 0).toLocaleString()} F</td>
                                      <td className="text-right font-bold">{(inv.total_valeur_physique || 0).toLocaleString()} F</td>
                                      <td className={`text-right font-bold ${(inv.total_ecart_valeur || 0) < 0 ? 'text-error' : (inv.total_ecart_valeur || 0) > 0 ? 'text-success' : ''}`}>
                                          {(inv.total_ecart_valeur || 0).toLocaleString()} F
                                      </td>
                                      <td>
                                          <span className={`badge ${inv.status === 'VALIDEE' ? 'badge-success' : 'badge-warning'}`}>
                                              {inv.status}
                                          </span>
                                      </td>
                                      <td>{inv.created_by_name || '-'}</td>
                                      <td onClick={e => e.stopPropagation()}>
                                          <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(inv.id)} disabled={inv.status === 'VALIDEE'}>
                                              {t('rayons.table.delete')}
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                              {inventaires.length === 0 && (
                                  <tr>
                                      <td colSpan={9} className="text-center py-4 text-gray-500">{t('stock.inventaire.list.empty')}</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>

              
              {/* Pagination Controls */}
              <div className="flex justify-between items-center mt-4 bg-base-100 p-2 rounded-lg shadow-sm">
                  <div className="text-sm opacity-50">
                      Total: {totalCount} inventaires
                  </div>
                  <div className="join">
                      <button 
                          className="join-item btn btn-sm" 
                          disabled={!prevPage || loading}
                          onClick={() => prevPage && fetchInventaires(prevPage)}
                      >
                          « Précédent
                      </button>
                      <button className="join-item btn btn-sm btn-ghost cursor-default no-animation">
                          Page {currentPage}
                      </button>
                      <button 
                          className="join-item btn btn-sm" 
                          disabled={!nextPage || loading}
                          onClick={() => nextPage && fetchInventaires(nextPage)}
                      >
                          Suivant »
                      </button>
                  </div>
              </div>
          </div>
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
      <div className="w-full">
         {viewMode === 'LIST' ? renderList() : (
           <div className="space-y-6">
          <div className="flex justify-between items-center">
              <div className="flex gap-4 items-center">
                   <button className="btn btn-ghost" onClick={() => setViewMode('LIST')}>{t('stock.inventaire.detail.back')}</button>
                   <h1 className="text-2xl font-bold">
                       {viewMode === 'CREATE' ? t('stock.inventaire.detail.title_new') : t('stock.inventaire.detail.title_edit', { id: activeInventaire?.id })}
                   </h1>
                   {isReadOnly && <span className="badge badge-success badge-lg">{t('stock.inventaire.detail.validated')}</span>}
              </div>
              <div className="flex gap-2">
                       <div className="join mr-4">
                            <button 
                                className={`join-item btn btn-sm ${viewTab === 'DATA' ? 'btn-active btn-primary' : ''}`}
                                onClick={() => setViewTab('DATA')}
                            >
                                {t('stock.inventaire.detail.tab_data')}
                            </button>
                            <button 
                                className={`join-item btn btn-sm ${viewTab === 'ANALYSIS' ? 'btn-active btn-primary' : ''}`}
                                onClick={() => {
                                    setViewTab('ANALYSIS');
                                    if (activeInventaire) fetchStats(activeInventaire.id);
                                }}
                            >
                                {t('stock.inventaire.detail.tab_analysis')}
                            </button>
                        </div>

                       <button 
                         className="btn btn-primary" 
                         onClick={handlePrintEtatFrontend}
                         disabled={!activeInventaire?.id}
                       >
                           {t('stock.inventaire.detail.print')}
                       </button>

                  {!isReadOnly && activeInventaire && (
                       <>
                           {/* Save Button (Implicitly saved via API calls but we can add a global 'Done' or similar if needed) 
                               Actually, since we save line by line, this is mostly for the header or just status.
                               User requested SEPARATE buttons. One for Validating.
                           */}
                           {lignes.some(l => l.isLocalOnly) && (<button className="btn btn-warning animate-pulse" onClick={handleSyncLines} disabled={saving}>{saving ? <span className="loading loading-spinner loading-sm"></span> : null}{t('stock.inventaire.detail.sync_now', { count: lignes.filter(l => l.isLocalOnly).length })}</button>)}

                           <button className="btn btn-info text-white" onClick={() => setShowMergeModal(true)}>
                               {t('stock.inventaire.detail.merge_to')}
                           </button>

                           <button className="btn btn-success text-white" onClick={handleOpenValidateModal} disabled={saving || lignes.some(l => l.isLocalOnly)}>
                               {saving ? t('stock.inventaire.detail.validating') : t('stock.inventaire.detail.validate')}
                           </button>
                       </>
                  )}
              </div>
          </div>



          {/* Header Form */}
          <div className="card bg-base-100 shadow p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-control">
                      <label className="label">{t('stock.inventaire.detail.date')}</label>
                      <input 
                          type="date" 
                          className="input input-bordered" 
                          value={dateInventaire} 
                          onChange={e => setDateInventaire(e.target.value)}
                          disabled={isReadOnly}
                          onBlur={handleSaveHeader}
                      />
                  </div>
                  <div className="form-control md:col-span-2">
                      <label className="label">{t('stock.inventaire.detail.description')}</label>
                      <input 
                          type="text" 
                          className="input input-bordered" 
                          placeholder={t('stock.inventaire.detail.placeholder_desc')}
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          disabled={isReadOnly}
                          onBlur={handleSaveHeader}
                      />
                  </div>
              </div>
          </div>

          {/* Product Search */}
          {!isReadOnly && (
              <div className="card bg-base-100 shadow p-4 overflow-visible relative">
                  <div className="form-control w-full">
                       <label className="label font-bold">{t('stock.inventaire.detail.add_product_label')}</label>
                       <input 
                           ref={searchInputRef}
                           type="text" 
                           className="input input-bordered w-full" 
                           placeholder={t('stock.inventaire.detail.search_placeholder')}
                           value={searchQuery}
                           onChange={e => setSearchQuery(e.target.value)}
                           onKeyDown={handleSearchKeyDown}
                           autoFocus
                       />
                       {loadingSearch && <span className="absolute right-4 top-12 loading loading-spinner"></span>}
                  </div>
                  {/* Dropdown Results - Style similaire à ProductSearchSection de Facturation */}
                  {searchQuery && (
                      <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-base-200 max-h-[60vh] overflow-y-auto z-50">
                          {searchResults.length === 0 ? (
                              <div className="text-center py-8 text-base-content/40 text-sm">
                                  {loadingSearch ? (
                                      <span className="loading loading-spinner loading-sm"></span>
                                  ) : searchQuery.length < 1 ? (
                                      t('stock.inventaire.detail.hint_min_char')
                                  ) : (
                                      t('stock.inventaire.detail.no_result')
                                  )}
                              </div>
                          ) : (
                              <div className="max-h-96 overflow-y-auto space-y-1 p-1">
                                  {searchResults.map((p, idx) => {
                                      const itemProps = getItemProps(idx);
                                      const hasStock = (p.stock ?? 0) > 0;
                                      return (
                                          <div 
                                              key={p.id}
                                              {...itemProps}
                                              onClick={() => handleProductSelect(p)}
                                              style={itemProps.style}
                                              className={`
                                                  group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all
                                                  ${itemProps.className ? 'shadow-md bg-primary/5' : 'hover:bg-base-100'}
                                              `}
                                          >
                                              <div className="flex-1 min-w-0">
                                                  <div className="font-medium truncate text-sm">{p.name}</div>
                                                  <div className="text-xs flex gap-3 mt-0.5 opacity-80">
                                                      <span className="font-mono text-gray-500">{p.cip1}</span>
                                                      {p.rayon_name && <span className="text-gray-400">• {p.rayon_name}</span>}
                                                  </div>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                  <span className={`badge badge-sm ${hasStock ? 'badge-success' : 'badge-error'}`}>
                                                      Stock: {p.stock}
                                                  </span>
                                                  {p.use_lot_management && (
                                                      <span className="badge badge-sm badge-info">Lots</span>
                                                  )}
                                                  <button className="btn btn-ghost btn-sm btn-circle opacity-0 group-hover:opacity-100 text-primary">
                                                      +
                                                  </button>
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

          {viewTab === 'ANALYSIS' ? renderAnalysis() : ( // WRAPPED DATA VIEW
          /* Lines Table */
          <div className="card bg-base-100 shadow">
              <div className="overflow-x-auto">
                  {selectedLines.size > 0 ? (
                      <div className="bg-base-200 p-2 flex justify-between items-center px-4 border-b border-base-300">
                          <span className="text-sm font-bold">{t('stock.inventaire.lines.selected', { count: selectedLines.size })}</span>
                          <button 
                              className="btn btn-sm btn-error text-white"
                              onClick={handleBulkDelete}
                          >
                              {t('stock.inventaire.lines.delete_selection')}
                          </button>
                      </div>
                  ) : (
                    <div className="bg-base-200 p-2 flex justify-between items-center px-4 border-b border-base-300 gap-2 max-sm:flex-col">
                        <div className="relative w-full sm:w-auto mb-2 sm:mb-0">
                            <input
                                type="text"
                                placeholder={t('stock.inventaire.lines.search_placeholder', 'Rechercher un produit...')}
                                className="input input-xs input-bordered w-full sm:w-64 pl-8"
                                value={searchLignesQuery}
                                onChange={(e) => setSearchLignesQuery(e.target.value)}
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 absolute left-2.5 top-1.5 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {searchLignesQuery && (
                                <button 
                                    className="btn btn-ghost btn-xs btn-circle absolute right-1 top-0.5"
                                    onClick={() => setSearchLignesQuery('')}
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        <div className="flex items-center w-full sm:w-auto justify-end">
                            <span className="text-xs opacity-50 uppercase font-bold mr-2">{t('stock.inventaire.lines.sort_by')}</span>
                            <select 
                                className="select select-bordered select-xs" 
                                value={sortBy} 
                                onChange={(e) => setSortBy(e.target.value as SortOption)}
                            >
                                <option value="CHRONOLOGICAL">{t('stock.inventaire.lines.sort_chronological')}</option>
                                <option value="NAME">{t('stock.inventaire.lines.sort_name')}</option>
                                <option value="GAP_VALUE">{t('stock.inventaire.lines.sort_gap_value')}</option>
                                <option value="GAP_QTY">{t('stock.inventaire.lines.sort_gap_qty')}</option>
                            </select>
                            <button 
                                className="btn btn-ghost btn-xs btn-square ml-1"
                                onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
                                title={sortOrder === 'ASC' ? 'Croissant' : 'Décroissant'}
                            >
                                {sortOrder === 'ASC' ? '⬆️' : '⬇️'}
                            </button>
                        </div>
                    </div>
                  )}
                  <table className="table table-zebra w-full table-xs">
                      <thead>
                          <tr>
                              {!isReadOnly && (
                                  <th className="w-10">
                                      <label>
                                          <input 
                                              type="checkbox" 
                                              className="checkbox checkbox-xs" 
                                              checked={lignes.length > 0 && selectedLines.size === lignes.length}
                                              onChange={toggleSelectAll}
                                          />
                                      </label>
                                  </th>
                              )}

                              <th>{t('stock.inventaire.lines.product')}</th>
                              <th>{t('stock.inventaire.lines.rayon')}</th>
                              <th className="text-right">{t('stock.inventaire.lines.buy_price')}</th>
                              <th className="text-center">{t('stock.inventaire.lines.stock_theo')}</th>
                              <th className="text-center">{t('stock.inventaire.lines.qty_saisie')}</th>
                              <th className="text-center">{t('stock.inventaire.lines.ecart_qty')}</th>
                              <th className="text-right">{t('stock.inventaire.lines.ecart_val')}</th>
                              {!isReadOnly && <th>{t('stock.inventaire.list.actions')}</th>}
                          </tr>
                      </thead>
                      <tbody>
                          {/* Apply Sorting before map */}
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
                                      // Calculate absolute gap value for sorting by magnitude? Or just raw? 
                                      // User asked "Ecart valorise", usually means magnitude of loss/gain.
                                      // But let's stick to signed value (Loss vs Gain). 
                                      // Wait, "prioriser les pertes/gains importants".
                                      // Often finance wants to see biggest LOSS first.
                                      // Let's sort by raw value. 
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
                                      // Default by ID (insertion order)
                                      comparison = a.id - b.id;
                                      break;
                              }
                              return sortOrder === 'ASC' ? comparison : -comparison;
                          }).map((ligne, _index) => {
                              const price = parseFloat(ligne.produit_cost_price || ligne.pmp_snapshot || '0');
                              const ecartValeur = ligne.ecart * price;
                              const isSelected = selectedLines.has(ligne.id);
                              return (
                              <tr key={ligne.id} className={isSelected ? "bg-primary/10" : ""}>
                                  {!isReadOnly && (
                                      <td>
                                          <label>
                                              <input 
                                                  type="checkbox" 
                                                  className="checkbox checkbox-xs" 
                                                  checked={isSelected}
                                                  onChange={() => toggleSelectLine(ligne.id)}
                                              />
                                          </label>
                                      </td>
                                  )}
                                  <td>
                                      <div className="font-bold">
                                          {typeof ligne.produit === 'object' ? ligne.produit.name : ligne.produit_nom} {ligne.isLocalOnly && <span className="badge badge-warning badge-xs">Local</span>}
                                      </div>
                                      <div className="text-xs opacity-50">
                                          {typeof ligne.produit === 'object' ? ligne.produit.cip1 : ligne.produit_cip}
                                      </div>
                                      {ligne.lot_numero && (
                                           <div className="text-xs text-blue-600 font-mono mt-1">
                                               LOT: {ligne.lot_numero} (Exp: {ligne.lot_expiration})
                                           </div>
                                      )}
                                  </td>
                                  <td className="text-xs">{typeof ligne.produit === 'object' ? ligne.produit.rayon_name : ligne.produit_rayon}</td>
                                  <td className="text-right text-xs">{price.toLocaleString()} F</td>
                                  <td className="text-center font-bold opacity-70">{ligne.stock_theorique}</td>
                                  
                                  <td className="text-center p-1">
                                      {isReadOnly ? (
                                          <span className="font-bold">{ligne.quantite_physique}</span>
                                      ) : (
                                          <input 
                                              id={`qty-input-${lignes.indexOf(ligne)}`}
                                              type="text" 
                                              inputMode="numeric"
                                              className="input input-bordered input-xs w-24 text-center font-bold"
                                              value={ligne.quantite_physique}
                                              onChange={(e) => {
                                                  const val = e.target.value;
                                                  if (/^\d*$/.test(val)) {
                                                      handleUpdateQuantity(ligne.id, val === '' ? 0 : parseInt(val));
                                                  }
                                              }}
                                              onFocus={(e) => e.target.select()}
                                              onKeyDown={(e) => handleKeyDown(e, lignes.indexOf(ligne))}
                                          />
                                      )}
                                  </td>
                                  
                                  <td className="text-center">
                                      <span className={`badge ${ligne.ecart < 0 ? 'badge-error' : ligne.ecart > 0 ? 'badge-success' : 'badge-ghost'} badge-sm`}>
                                          {ligne.ecart > 0 ? '+' : ''}{ligne.ecart}
                                      </span>
                                  </td>
                                  <td className={`text-right font-bold text-xs ${ecartValeur < 0 ? 'text-error' : ecartValeur > 0 ? 'text-success' : ''}`}>
                                      {ecartValeur.toLocaleString()} F
                                  </td>
                                  {!isReadOnly && (
                                      <td>
                                          <button 
                                            className="btn btn-ghost btn-xs text-error h-6 min-h-0"
                                            onClick={() => handleDeleteLine(ligne.id)}
                                            tabIndex={-1}
                                          >
                                            🗑️
                                          </button>
                                      </td>
                                  )}
                              </tr>
                              );
                          })}
                          {lignes.length === 0 && (
                              <tr>
                              <td colSpan={!isReadOnly ? 9 : 8} className="text-center py-8 opacity-50">
                                      {t('stock.inventaire.lines.empty_hint')}
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
              <div className="p-4 bg-base-200 border-t flex justify-end gap-8">
                  <div className="text-right">
                      <div className="text-sm opacity-50">{t('stock.inventaire.lines.total_theo')}</div>
                      <div className="text-xl font-bold">{totalValeurTheorique.toLocaleString()} F</div>
                  </div>
                  <div className="text-right">
                      <div className="text-sm opacity-50">{t('stock.inventaire.lines.total_phys')}</div>
                      <div className="text-xl font-bold">{totalValeurPhysique.toLocaleString()} F</div>
                  </div>
                  <div className="text-right">
                      <div className="text-sm opacity-50">{t('stock.inventaire.lines.total_gap')}</div>
                      <div className={`text-xl font-bold ${totalEcartValeur < 0 ? 'text-error' : totalEcartValeur > 0 ? 'text-success' : ''}`}>
                          {totalEcartValeur > 0 ? '+' : ''}{totalEcartValeur.toLocaleString()} F
                      </div>
                  </div>
              </div>
          </div>
          )} {/* End Data View */}

          {showLotModal && (
              <dialog className="modal modal-open">
                  <div className="modal-box" onKeyDown={handleLotModalKeyDown} tabIndex={0} autoFocus>
                      <h3 className="font-bold text-lg">{t('stock.inventaire.modals.lot_title')}</h3>
                      <p className="py-2 text-sm text-gray-500">{t('stock.inventaire.modals.lot_for', { name: selectedProductForLot?.name })}</p>
                      <p className="text-xs text-info mb-2">{t('stock.inventaire.modals.lot_hint')}</p>
                      
                      <div className="py-4">
                          {loadingLots ? (
                              <div className="flex justify-center"><span className="loading loading-spinner"></span></div>
                          ) : availableLots.length === 0 ? (
                              <div className="text-center text-gray-500">
                                  {t('stock.inventaire.modals.lot_none')} 
                                  <br/>
                                  <button 
                                      className="btn btn-sm btn-outline mt-2" 
                                      onClick={() => handleAddProduct(selectedProductForLot!)}
                                  >
                                      {t('stock.inventaire.modals.add_global')}
                                  </button>
                              </div>
                          ) : (
                              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                                  {availableLots.map((lot, index) => (
                                      <button 
                                          key={lot.id} 
                                          className={`btn btn-outline justify-between h-auto py-2 ${index === focusedLotIndex ? 'btn-active ring-2 ring-primary ring-offset-1' : ''}`}
                                          onClick={() => handleLotSelection(lot.id)}
                                          onMouseEnter={() => setFocusedLotIndex(index)}
                                      >
                                          <div className="text-left">
                                              <div className="font-bold">Lot: {lot.lot || 'N/A'}</div>
                                              <div className="text-xs">Exp: {lot.date_expiration || 'N/A'}</div>
                                          </div>
                                          <div className="text-right">
                                              <div className="badge badge-ghost">Reste: {lot.quantity_remaining}</div>
                                          </div>
                                      </button>
                                  ))}
                              </div>
                          )}
                      </div>

                      <div className="modal-action justify-between">
                          <button 
                              className="btn btn-ghost" 
                              onClick={() => { setShowLotModal(false); setSelectedProductForLot(null); }}
                          >
                              {t('stock.inventaire.modals.cancel')}
                          </button>
                          {availableLots.length > 0 && (
                             <button 
                                 className="btn btn-ghost btn-xs"
                                 onClick={() => handleAddProduct(selectedProductForLot!)}
                             >
                                 {t('stock.inventaire.modals.add_global')}
                             </button>
                          )}
                      </div>
                  </div>
              </dialog>
          )}

      </div>
    )}
          {/* Merge Modal */}
          {showMergeModal && (
              <dialog className="modal modal-open">
                  <div className="modal-box max-w-2xl">
                    {viewMode === 'LIST' ? (
                        /* MODE LISTE : Fusionner la SÉLECTION */
                        <>
                             <h3 className="font-bold text-lg mb-4">{t('stock.inventaire.modals.merge_title_list', { count: selectedInventaireIds.size })}</h3>
                              <div className="alert alert-warning mb-4 text-xs shadow-sm">
                                  <span dangerouslySetInnerHTML={{ __html: t('stock.inventaire.modals.merge_warning_list') }}></span>
                              </div>
                              
                              <p className="mb-2 font-semibold text-sm">{t('stock.inventaire.modals.merge_target_select')}</p>
                              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto mb-4">
                                   {inventaires.filter(i => selectedInventaireIds.has(i.id)).map(inv => (
                                       <button 
                                           key={inv.id} 
                                           className={`btn justify-between h-auto py-3 no-animation border-2 ${selectedMergeSource === inv.id ? 'btn-primary border-primary' : 'btn-outline border-base-200 hover:border-primary/50'}`}
                                           onClick={() => setSelectedMergeSource(inv.id)}
                                       >
                                           <div className="text-left flex-1">
                                               <div className="font-bold flex items-center gap-2">
                                                   Inventaire #{inv.id}
                                                   {selectedMergeSource === inv.id && <span className="badge badge-sm badge-white text-primary">{t('stock.inventaire.modals.merge_target_badge')}</span>}
                                               </div>
                                               <div className="text-xs opacity-80">{new Date(inv.date).toLocaleDateString('fr-FR')} - {inv.description || 'Sans description'}</div>
                                           </div>
                                            <div className="badge badge-ghost font-mono">{(inv.total_valeur_physique || 0).toLocaleString()} F</div>
                                       </button>
                                   ))}
                              </div>
                        </>
                    ) : ( 
                        /* MODE DETAILS : Fusionner UN EXTERNE VERS ICI */
                        <>
                          <h3 className="font-bold text-lg mb-4">{t('stock.inventaire.modals.merge_title_external')}</h3>
                          <div className="alert alert-warning mb-4 text-xs shadow-sm">
                              <span dangerouslySetInnerHTML={{ __html: t('stock.inventaire.modals.merge_warning_external', { id: activeInventaire?.id }) }}></span>
                          </div>
                          
                          <p className="py-2 text-sm text-gray-500 mb-2">
                              {t('stock.inventaire.modals.merge_current_target')} <strong>#{activeInventaire?.id}</strong>
                          </p>

                          <div className="py-2">
                               {loadingMergeCandidates ? (
                                   <div className="flex justify-center py-8"><span className="loading loading-spinner"></span></div>
                               ) : mergeCandidates.length === 0 ? (
                                   <div className="text-center text-gray-500 py-8 italic border rounded-lg bg-base-200">
                                       {t('stock.inventaire.modals.merge_no_candidate')}
                                   </div>
                               ) : (
                                   <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                                       {mergeCandidates.map(candidate => (
                                           <button 
                                               key={candidate.id} 
                                               className={`btn justify-between h-auto py-3 no-animation ${selectedMergeSource === candidate.id ? 'btn-primary' : 'btn-outline bg-base-100'}`}
                                               onClick={() => setSelectedMergeSource(candidate.id)}
                                           >
                                               <div className="text-left">
                                                   <div className="font-bold">Inventaire #{candidate.id}</div>
                                                   <div className="text-xs opacity-80">{new Date(candidate.date).toLocaleDateString()} - {candidate.description || 'Sans description'}</div>
                                                   <div className="text-xs opacity-60">Par: {candidate.created_by_name || 'Inconnu'}</div>
                                               </div>
                                                <div className="badge badge-sm badge-ghost">{(candidate.total_valeur_physique || 0).toLocaleString()} F</div>
                                           </button>
                                       ))}
                                   </div>
                               )}
                          </div>
                        </>
                    )}

                      <div className="modal-action">
                          <button className="btn btn-ghost" onClick={() => { setShowMergeModal(false); setSelectedMergeSource(null); }}>{t('stock.inventaire.modals.cancel')}</button>
                          <button  
                              className="btn btn-primary" 
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
        title={sudoState.title || "Validation Requise"}
        message={sudoState.message || ""}
      />

  </div>
  );
}
