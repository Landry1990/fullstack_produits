import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { gooeyToast } from 'goey-toast';
import { useTranslation, type TFunction } from 'react-i18next';
import { Package } from 'lucide-react';
import { useCommandesStore } from '../../stores/useCommandesStore';
import { normalizeNumberInput } from '../../utils/formatters';
import { logger } from '../../utils/logger';
import commandeService from '../../services/commandeService';
import produitService from '../../services/produitService';
import type { Commande, CommandeProduit, Fournisseur, PharmacySettings, ProduitModel } from '../../types';

interface UseCommandeNavigationOptions {
  forcedType?: 'LOC' | 'DIR' | 'DIV';
  pharmacySettings: PharmacySettings | null;
  fournisseurs: Fournisseur[];
  produitsList: ProduitModel[];
  setSearchProduitQuery: (query: string) => void;
  t: TFunction;
}

interface UseCommandeNavigationReturn {
  openCreateView: (type?: 'LOC' | 'DIR' | 'DIV') => void;
  openEditView: (commande: Commande) => Promise<void>;
  handleViewDetails: (commande: Commande) => Promise<void>;
  handleBackToList: () => void;
  handleApplySuggestions: (newLines: CommandeProduit[], supplierId: string) => void;
}

function formatDateToMMYY(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[0].slice(-2)}`;
  }
  return '';
}

export function useCommandeNavigation({
  forcedType,
  pharmacySettings,
  fournisseurs,
  produitsList,
  setSearchProduitQuery,
}: UseCommandeNavigationOptions): UseCommandeNavigationReturn {
  const { t } = useTranslation(['orders', 'common']);
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = useCommandesStore((s) => s.activeTab);
  const setActiveTab = useCommandesStore((s) => s.setActiveTab);
  const commandeType = useCommandesStore((s) => s.commandeType);
  const setCommandeType = useCommandesStore((s) => s.setCommandeType);
  const setViewMode = useCommandesStore((s) => s.setViewMode);
  const setSelectedCommande = useCommandesStore((s) => s.setSelectedCommande);
  const setNewCommandeFournisseurId = useCommandesStore((s) => s.setNewCommandeFournisseurId);
  const setNumeroFacture = useCommandesStore((s) => s.setNumeroFacture);
  const setIsMiseEnPlace = useCommandesStore((s) => s.setIsMiseEnPlace);
  const setDelaiPaiementNegocieJours = useCommandesStore((s) => s.setDelaiPaiementNegocieJours);
  const setPayeALaCloture = useCommandesStore((s) => s.setPayeALaCloture);
  const tauxChange = useCommandesStore((s) => s.tauxChange);
  const setTauxChange = useCommandesStore((s) => s.setTauxChange);
  const fraisCoefficient = useCommandesStore((s) => s.fraisCoefficient);
  const setFraisCoefficient = useCommandesStore((s) => s.setFraisCoefficient);
  const setCommandeProduits = useCommandesStore((s) => s.setCommandeProduits);
  const setIsSuggestionModalOpen = useCommandesStore((s) => s.setIsSuggestionModalOpen);

  useEffect(() => {
    if (forcedType) {
      setActiveTab(forcedType);
      setCommandeType(forcedType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedType]);

  useEffect(() => {
    const openDetailsId = location.state?.openDetailsId;
    if (openDetailsId) {
      const fetchAndShow = async () => {
        try {
          const data = await commandeService.getById(Number(openDetailsId));
          setSelectedCommande(data);
          setViewMode('DETAILS');
        } catch (err) {
          logger.error('Erreur lors du chargement de la commande via navigation:', err);
          gooeyToast.error(t('orders:messages.details_load_error'));
        } finally {
          navigate(location.pathname, { replace: true, state: {} });
        }
      };
      fetchAndShow();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, navigate, t]);

  useEffect(() => {
    const viewState = (location.state as { viewState?: { mode: 'EDIT' | 'DETAILS'; commandeId: number } } | undefined)?.viewState;
    if (!viewState?.commandeId) return;
    (async () => {
      try {
        const data = await commandeService.getById(viewState.commandeId);
        if (viewState.mode === 'EDIT') {
          await openEditView(data);
        } else {
          setSelectedCommande(data);
          setViewMode('DETAILS');
        }
      } catch (err) {
        logger.error('Erreur lors de la restauration de la commande après rechargement:', err);
        gooeyToast.error(t('orders:messages.details_load_error'));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    interface CadencierProduct {
      id: number;
      name: string;
      stock: number;
      avg_daily_sales?: number;
      quantity?: number;
      price?: number;
      fournisseur_id?: number | null;
      tva?: string;
      taux_marge?: string;
    }
    interface CreateFromState {
      createFromStockAlert?: { products: CadencierProduct[] };
      createFromCadencier?: { products: CadencierProduct[]; orderType?: string };
    }
    const state = location.state as CreateFromState | null;
    if (state && (state.createFromStockAlert || state.createFromCadencier)) {
      const isCadencier = !!state.createFromCadencier;
      const data = state.createFromCadencier || state.createFromStockAlert!;
      const orderType = state.createFromCadencier?.orderType;

      setViewMode('CREATE');
      setSelectedCommande(null);
      setCommandeProduits([]);

      if (orderType) {
        const ot = orderType as 'LOC' | 'DIR' | 'DIV';
        setCommandeType(ot);
        setActiveTab(ot);
      }

      const loadProducts = async () => {
        if (!Array.isArray(data.products) || data.products.length === 0) return;

        const requestedIds = data.products.map((p) => p.id);
        let fullProducts: ProduitModel[] = [];
        try {
          fullProducts = await produitService.getByIds(requestedIds);
        } catch (err) {
          logger.error('Failed to bulk fetch products:', err);
        }
        const productById = new Map(fullProducts.map((p) => [p.id, p]));

        const newLines = data.products.map((p: CadencierProduct) => {
          const fullProduct = productById.get(p.id);
          let suggestedQty: number;

          if (isCadencier && p.quantity !== undefined && p.quantity > 0) {
            suggestedQty = p.quantity;
          } else {
            const avgSales = p.avg_daily_sales;
            const coverageDays = 30;
            const baseStock = fullProduct?.stock ?? p.stock ?? 0;
            const stockMinimum = fullProduct?.stock_minimum ?? 10;
            suggestedQty = avgSales && avgSales > 0
              ? Math.max(1, Math.ceil(avgSales * coverageDays) - baseStock)
              : Math.max(1, stockMinimum - baseStock);
          }

          if (fullProduct) {
            return {
              id: Date.now() + p.id,
              produit: fullProduct,
              quantity: suggestedQty,
              unites_gratuites: 0,
              prix_euro: orderType === 'DIR' ? (fullProduct.cost_price ? (normalizeNumberInput(fullProduct.cost_price) / normalizeNumberInput(tauxChange || '655.957')).toFixed(0) : '0') : undefined,
              price: p.price !== undefined && p.price > 0 ? String(p.price) : (fullProduct.cost_price || '0'),
              price_cost: p.price !== undefined && p.price > 0 ? String(p.price) : (fullProduct.cost_price || '0'),
              tva: p.tva || fullProduct.tva || '0',
              marge: p.taux_marge || fullProduct.taux_marge || '1.3',
              selling_price: fullProduct.selling_price || '0',
              lot: '',
              date_expiration: '',
            };
          }

          return {
            id: Date.now() + p.id,
            produit: { id: p.id, name: p.name, stock: p.stock } as ProduitModel,
            quantity: p.quantity || suggestedQty || 10,
            unites_gratuites: 0,
            prix_euro: orderType === 'DIR' ? '0' : undefined,
            price: String(p.price || '0'),
            price_cost: String(p.price || '0'),
            tva: p.tva || '0',
            marge: p.taux_marge || '1.3',
            selling_price: '0',
            lot: '',
            date_expiration: '',
          };
        });
        setCommandeProduits(newLines);

        const firstWithFournisseur = newLines.find(
          (l) => l.produit && typeof l.produit === 'object' && (l.produit as ProduitModel).fournisseur
        );
        if (firstWithFournisseur) {
          const fId = (firstWithFournisseur.produit as ProduitModel).fournisseur;
          setNewCommandeFournisseurId(String(fId));
        }

        const msgKey = isCadencier ? 'orders:messages.products_added_from_cadencier' : 'orders:messages.products_added_from_alerts';
        gooeyToast.success(t(msgKey, { count: newLines.length }), { icon: <Package className="h-4 w-4 text-emerald-600" /> });
      };

      loadProducts();
      window.history.replaceState({}, document.title);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, commandeType, tauxChange, fraisCoefficient, t]);

  function handleApplySuggestions(newLines: CommandeProduit[], supplierId: string) {
    setCommandeProduits(newLines);
    setNewCommandeFournisseurId(supplierId);
    setNumeroFacture('');
    setIsMiseEnPlace(false);
    setDelaiPaiementNegocieJours('');
    setPayeALaCloture(false);
    setIsSuggestionModalOpen(false);
    setViewMode('CREATE');
  }

  function openCreateView(type: 'LOC' | 'DIR' | 'DIV' = activeTab) {
    const fournisseursForType = type === 'DIV'
      ? fournisseurs.filter((f) => f.is_divers)
      : fournisseurs.filter((f) => !f.is_divers);

    setNewCommandeFournisseurId(fournisseursForType.length > 0 ? String(fournisseursForType[0].id) : '');
    setNumeroFacture('');
    setIsMiseEnPlace(false);
    setDelaiPaiementNegocieJours('');
    setPayeALaCloture(false);
    setCommandeProduits([]);
    setSearchProduitQuery('');
    setCommandeType(type);

    if (type === 'DIR') {
      setTauxChange(pharmacySettings?.taux_change_actif || '655.957');
      setFraisCoefficient(pharmacySettings?.coefficient_direct_commande || '1.35');
    }

    setViewMode('CREATE');
    setSelectedCommande(null);
    navigate(location.pathname, { replace: true, state: {} });
  }

  async function openEditView(commande: Commande) {
    setNewCommandeFournisseurId(commande.fournisseur ? String(commande.fournisseur) : '');
    setNumeroFacture(commande.numero_facture || '');
    setIsMiseEnPlace(commande.is_mise_en_place || false);
    setDelaiPaiementNegocieJours(commande.delai_paiement_negocie_jours != null ? String(commande.delai_paiement_negocie_jours) : '');
    setPayeALaCloture(commande.paye_a_la_cloture || false);
    setCommandeType((commande.type as 'LOC' | 'DIR') || 'LOC');

    if (commande.type === 'DIR') {
      setTauxChange(commande.taux_change || pharmacySettings?.taux_change_actif || '655.957');
      setFraisCoefficient(commande.frais_coefficient || pharmacySettings?.coefficient_direct_commande || '1.0');
    }

    let freshProduitsList = produitsList;
    try {
      const response = await produitService.getByIds(
        commande.produits
          .map((p) => (typeof p.produit === 'object' ? p.produit?.id : p.produit))
          .filter((id): id is number => id != null)
      );
      freshProduitsList = response;
    } catch {
      // Fallback sur la liste en mémoire si l'API échoue
    }

    const productById = new Map(freshProduitsList.map((p) => [p.id, p]));

    const enrichedProducts = commande.produits.map((p) => {
      const produitObj = typeof p.produit === 'object' ? p.produit : null;
      const produitId = produitObj ? produitObj.id : p.produit;
      const fullProduct = produitId ? productById.get(produitId) : null;

      let tauxMarge = p.taux_marge;
      if (!tauxMarge) {
        const cost = normalizeNumberInput(p.price);
        const sellTTC = normalizeNumberInput(p.selling_price || '0');
        const tva = normalizeNumberInput(p.tva || '0');
        if (cost > 0 && sellTTC > 0) {
          const sellHT = sellTTC / (1 + tva / 100);
          tauxMarge = (sellHT / cost).toFixed(2);
        } else {
          tauxMarge = fullProduct?.taux_marge || '1.3';
        }
      }

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
        marge: tauxMarge,
        lot: p.lot || '',
        date_expiration: formatDateToMMYY(p.date_expiration || ''),
      };
    });

    setCommandeProduits(enrichedProducts);
    setSearchProduitQuery('');
    setSelectedCommande(commande);
    setViewMode('EDIT');
    navigate(location.pathname, { replace: true, state: { viewState: { mode: 'EDIT', commandeId: commande.id } } });
  }

  async function handleViewDetails(commande: Commande) {
    try {
      const data = await commandeService.getById(commande.id);
      setSelectedCommande(data);
      setViewMode('DETAILS');
      navigate(location.pathname, { replace: true, state: { viewState: { mode: 'DETAILS', commandeId: commande.id } } });
    } catch {
      gooeyToast.error(t('orders:messages.details_load_error'));
    }
  }

  function handleBackToList() {
    navigate(location.pathname, { replace: true, state: {} });
    setViewMode('LIST');
    setSelectedCommande(null);
    setCommandeProduits([]);
  }

  return {
    openCreateView,
    openEditView,
    handleViewDetails,
    handleBackToList,
    handleApplySuggestions,
  };
}
