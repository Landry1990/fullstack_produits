import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator,
  Platform, ScrollView, useWindowDimensions, Keyboard,
} from 'react-native';
import { Search, Send, Trash2, User, ArrowLeft, ScanBarcode, ShieldCheck, Store, History, Pause, Clock, ShoppingCart } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCartStore } from '../stores/useCartStore';
import { useAuthStore } from '../stores/useAuthStore';
import { usePendingStore } from '../stores/usePendingStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import {
  searchProducts, searchClients, sendSaleToCaisse, getProductByBarcode,
  getProductById, getLotByDatamatrix, getLots, createClient, createAyantDroit,
  ensurePosteVente, activerPosteVente, getPostesDisponibles, PosteChoiceRequired, isPosteMobile,
} from '../services/api';
import { addHistoriqueItem } from '../services/historique';
import { ensureClientDivers } from '../services/clientDivers';
import { parseGS1Datamatrix } from '../utils/gs1Parser';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import { useSudo } from '../hooks/useSudo';
import { ProductRow } from '../components/ProductRow';
import { CartItemRow } from '../components/CartItemRow';
import { LotModal } from '../components/LotModal';
import { ScanBarcodeModal } from '../components/ScanBarcodeModal';
import { SudoModal } from '../components/SudoModal';
import { LineEditModal } from '../components/LineEditModal';
import { PendingSalesModal } from '../components/PendingSalesModal';
import { PostePickerModal } from '../components/PostePickerModal';
import type { Product, StockLot, Client, CartLine, AyantDroit, ScanResult, PendingSale, PosteVente } from '../types';

const PHONE_REGEX = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/;

// Extrait le 1er message d'erreur d'une réponse DRF (detail ou champ)
function drfError(data: unknown, fallback: string): string {
  const d = data as Record<string, unknown> | undefined;
  if (d?.detail && typeof d.detail === 'string') return d.detail;
  if (d) {
    for (const v of Object.values(d)) {
      if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
      if (typeof v === 'string') return v;
    }
  }
  return fallback;
}

export function FacturationScreen({ onLogout, navigation }: { onLogout: () => void; navigation?: { navigate: (screen: string) => void } }) {
  const cart = useCartStore();
  const pendingCount = usePendingStore((s) => s.sales.length);
  const { username, logout, maxDiscountRate, posteVente, setPosteVente } = useAuthStore();
  const { sudoState, requireSudo, closeSudo } = useSudo();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  const [lotModalVisible, setLotModalVisible] = useState(false);
  const [lotModalProduct, setLotModalProduct] = useState<Product | null>(null);
  const [lotModalCurrentId, setLotModalCurrentId] = useState<number | null>(null);

  const [lineEditModalVisible, setLineEditModalVisible] = useState(false);
  const [lineEdit, setLineEdit] = useState<CartLine | null>(null);

  const [clientModalVisible, setClientModalVisible] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [clientFormVisible, setClientFormVisible] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [clientFormError, setClientFormError] = useState<string | null>(null);
  const [creatingClient, setCreatingClient] = useState(false);

  const [adFormVisible, setAdFormVisible] = useState(false);
  const [adNom, setAdNom] = useState('');
  const [adMatricule, setAdMatricule] = useState('');

  const [remiseInput, setRemiseInput] = useState('');

  const [sending, setSending] = useState(false);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [pendingModalVisible, setPendingModalVisible] = useState(false);
  const [ensuringPoste, setEnsuringPoste] = useState(false);
  // Sélecteur de poste : rempli quand ensurePosteVente lève
  // PosteChoiceRequired (1er démarrage ou poste pris par un autre vendeur).
  const [posteChoices, setPosteChoices] = useState<PosteVente[] | null>(null);
  const [activatingPoste, setActivatingPoste] = useState(false);

  // Recherche produits
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setSearching(true);
        try {
          const data = await searchProducts(searchQuery);
          setResults(data);
        } catch {}
        setSearching(false);
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Hauteur du clavier logiciel : le panneau de résultats flotte juste
  // au-dessus (le clavier ne redimensionne pas la fenêtre — adjustPan).
  const [kbHeight, setKbHeight] = useState(0);
  const [mainBoxY, setMainBoxY] = useState(0);
  const fullHeightRef = useRef(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Recherche clients
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (clientSearch.length >= 2) {
        setClientSearching(true);
        try {
          const data = await searchClients(clientSearch);
          setClientResults(data);
        } catch {}
        setClientSearching(false);
      } else {
        setClientResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  // Resynchronise le champ remise quand la valeur du store change
  // (application via Sudo, annulation, clear).
  useEffect(() => {
    setRemiseInput(cart.remiseGlobale > 0 ? String(cart.remiseGlobale) : '');
  }, [cart.remiseGlobale, cart.remiseMode]);

  // Au premier accès sans poste actif : résolution silencieuse — ouvre le
  // sélecteur si aucun poste n'est déterminable automatiquement.
  useEffect(() => {
    if (!useAuthStore.getState().posteVente) {
      void retryEnsurePoste(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddProduct = (product: Product) => {
    cart.addProduct(product);
    setSearchQuery('');
    setResults([]);
    // Referme le clavier : le panier complet réapparaît (les sections
    // basses étaient masquées pendant la recherche).
    Keyboard.dismiss();
    // Le serializer liste (recherche) ne renvoie pas stock_lots → chargés
    // à la demande pour l'aperçu FEFO du badge lot (parité avec le scan).
    if (!product.stock_lots) {
      getLots(product.id)
        .then((lots) => useCartStore.getState().setProductLots(product.id, lots))
        .catch(() => {});
    }
  };

  const handleOpenLot = (productId: number) => {
    const line = cart.lines.find((l) => l.product.id === productId);
    if (line) {
      setLotModalProduct(line.product);
      setLotModalCurrentId(line.lotId);
      setLotModalVisible(true);
    }
  };

  const handleSelectLot = (lot: StockLot | null) => {
    if (lotModalProduct) {
      cart.setLot(lotModalProduct.id, lot);
    }
  };

  // ─── Opérations sécurisées (validation superviseur) ─────

  const secureUpdatePrix = (productId: number, newPrice: number, after?: () => void) => {
    const line = cart.lines.find((l) => l.product.id === productId);
    if (!line) return;
    if (newPrice === line.prix_unitaire) { after?.(); return; }
    if (cart.prixSudoCreds) {
      cart.updatePrix(productId, newPrice);
      after?.();
      return;
    }
    requireSudo(async (validatorId, password) => {
      cart.setPrixSudoCreds({ validatorId, password });
      cart.updatePrix(productId, newPrice);
      after?.();
    }, {
      title: 'Validation requise',
      message: `Modifier le prix de ${line.product.name} : ${line.prix_unitaire.toLocaleString('fr-FR')} F → ${newPrice.toLocaleString('fr-FR')} F ?`,
      permission: 'can_modify_price',
    });
  };

  const secureUpdateRemise = (productId: number, pct: number) => {
    const line = cart.lines.find((l) => l.product.id === productId);
    if (!line) return;
    const value = Math.min(100, Math.max(0, pct));
    if (value <= 0) { cart.updateRemise(productId, 0); return; }
    if (cart.remiseSudoCreds) {
      cart.updateRemise(productId, value);
      return;
    }
    requireSudo(async (validatorId, password) => {
      cart.setRemiseSudoCreds({ validatorId, password });
      cart.updateRemise(productId, value);
    }, {
      title: 'Validation requise',
      message: `Appliquer une remise de ${value}% sur ${line.product.name} ?`,
      permission: 'can_do_remise',
    });
  };

  const secureSetRemiseGlobale = (value: number, mode: 'taux' | 'montant') => {
    if (value <= 0) {
      cart.setRemiseGlobale(0, mode);
      return;
    }
    const sousTotal = cart.sousTotal();
    const tauxEffectif = mode === 'taux' ? value : (sousTotal > 0 ? (value / sousTotal) * 100 : 0);
    let applied = value;
    if (maxDiscountRate > 0 && tauxEffectif > maxDiscountRate) {
      Alert.alert('Remise plafonnée', `Remise maximale autorisée : ${maxDiscountRate}%`);
      applied = mode === 'taux' ? maxDiscountRate : Math.round((sousTotal * maxDiscountRate) / 100);
    }
    if (cart.remiseSudoCreds) {
      cart.setRemiseGlobale(applied, mode);
      return;
    }
    requireSudo(async (validatorId, password) => {
      cart.setRemiseSudoCreds({ validatorId, password });
      cart.setRemiseGlobale(applied, mode);
    }, {
      title: 'Validation requise',
      message: `Appliquer une remise globale de ${mode === 'taux' ? `${applied}%` : `${applied.toLocaleString('fr-FR')} F`} ?`,
      permission: 'can_do_remise',
      onCancel: () => {
        cart.setRemiseGlobale(0, mode);
        setRemiseInput('');
      },
    });
  };

  const commitRemiseInput = () => {
    const num = parseFloat(remiseInput.replace(',', '.')) || 0;
    if (num <= 0) setRemiseInput('');
    secureSetRemiseGlobale(num, cart.remiseMode);
  };

  const toggleRemiseMode = (mode: 'taux' | 'montant') => {
    if (mode === cart.remiseMode) return;
    // Changement d'unité : on repart à 0 pour éviter une remise aberrante
    cart.setRemiseGlobale(0, mode);
    setRemiseInput('');
  };

  const handleApplyLineEdit = (prix: number, remise: number) => {
    const line = lineEdit;
    setLineEditModalVisible(false);
    setLineEdit(null);
    if (!line) return;
    // Prix d'abord, remise ensuite — si les deux validations Sudo sont
    // requises, la 2e est enchaînée dans le callback de la 1re.
    if (prix !== line.prix_unitaire) {
      secureUpdatePrix(line.product.id, prix, () => {
        if (remise !== line.remise) secureUpdateRemise(line.product.id, remise);
      });
    } else if (remise !== line.remise) {
      secureUpdateRemise(line.product.id, remise);
    }
  };

  // ─── Client ─────────────────────────────────────────────

  const handleSelectClient = (client: Client | null) => {
    cart.setClient(client);
    setClientModalVisible(false);
    setClientSearch('');
    setClientResults([]);
    setClientFormVisible(false);
    setClientFormError(null);
    setAdFormVisible(client?.client_type === 'PROFESSIONNEL' && (client.ayants_droit ?? []).length === 0);
    setAdNom('');
    setAdMatricule('');
  };

  const handleCreateClient = async () => {
    const name = newClientName.trim();
    const phone = newClientPhone.trim();
    if (name.length < 2) {
      setClientFormError('Le nom doit contenir au moins 2 caractères');
      return;
    }
    if (phone && (!PHONE_REGEX.test(phone) || phone.replace(/\D/g, '').length < 8)) {
      setClientFormError('Numéro de téléphone invalide');
      return;
    }
    setCreatingClient(true);
    setClientFormError(null);
    try {
      const created = await createClient({ name, phone: phone || null });
      handleSelectClient(created);
    } catch (err: unknown) {
      setClientFormError(drfError((err as { response?: { data?: unknown } })?.response?.data, 'Impossible de créer le client'));
    } finally {
      setCreatingClient(false);
    }
  };

  // Résout un code scanné (caméra ou douchette) SANS toucher au panier :
  // - Datamatrix GS1 (médicament sérialisé) : résout produit + lot exact
  //   via /stock-lots/by-datamatrix/ comme la facturation web.
  // - Code linéaire (CIP/EAN) : GET /produits/by-cip/<code>/.
  // Retourne le ScanResult à ajouter, null si inconnu.
  const resolveBarcode = async (code: string): Promise<ScanResult | null> => {
    try {
      const parsed = parseGS1Datamatrix(code);

      if (parsed.cip && parsed.lot) {
        const dm = await getLotByDatamatrix(parsed.cip, parsed.lot);
        // Le payload by-datamatrix n'inclut pas la TVA → détail complet.
        const full = await getProductById(dm.produit.id).catch(() => null);
        const product: Product = full ?? {
          id: dm.produit.id,
          name: dm.produit.name,
          cip1: dm.produit.cip1,
          selling_price: dm.selling_price,
          stock: dm.produit.stock,
          tva: '0',
        };
        return {
          product,
          lot: {
            id: dm.lot_id,
            produit: product.id,
            lot: dm.lot_numero,
            quantity_remaining: dm.quantity_remaining,
            date_expiration: dm.date_expiration,
          },
          prix: parseFloat(dm.selling_price),
          label: `${product.name} — Lot ${dm.lot_numero}`,
        };
      }

      const product = await getProductByBarcode(parsed.cip ?? code);
      if (!product) return null;
      return {
        product,
        lot: null,
        prix: parseFloat(product.selling_price),
        label: product.name,
      };
    } catch (err) {
      // 404 = produit/lot inconnu → feedback « Code inconnu » dans le modal.
      // Tout le reste (réseau, 401, 5xx) mérite une alerte explicite.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 404) {
        Alert.alert('Erreur', 'Impossible de joindre le serveur');
      }
      return null;
    }
  };

  // Ajoute un produit résolu au panier (lot + prix de lot si datamatrix).
  // updatePrix reste « brut » ici : le prix de lot n'est pas une
  // modification manuelle, pas de validation Sudo.
  const addScanResult = (result: ScanResult, qty: number) => {
    cart.addProduct(result.product, qty);
    if (result.lot) {
      cart.setLot(result.product.id, result.lot);
      cart.updatePrix(result.product.id, result.prix);
    }
  };

  // Douchette / scanner clavier : Enter déclenche le même traitement que la
  // caméra (datamatrix ou CIP), en ajout direct ×1 (pas de carte de
  // confirmation : la douchette n'a pas d'écran). Si trouvé → ajout +
  // reset ; sinon la recherche texte reste affichée.
  const handleSearchSubmit = async () => {
    const code = searchQuery.trim();
    if (!code) return;
    const result = await resolveBarcode(code);
    if (result) {
      addScanResult(result, 1);
      setSearchQuery('');
      setResults([]);
    }
  };

  // Ayant droit obligatoire pour client PRO : sélection existante, ou
  // création/matching sur le matricule avant l'envoi.
  const resolveAyantDroit = async (): Promise<boolean> => {
    const client = cart.client;
    if (client?.client_type !== 'PROFESSIONNEL') return true;
    if (cart.ayantDroit) return true;

    const nom = adNom.trim();
    const matricule = adMatricule.trim();
    if (!nom || !matricule) {
      Alert.alert('Ayant droit requis', "Renseignez le nom et le matricule de l'ayant droit");
      return false;
    }
    const existing = (client.ayants_droit ?? []).find(
      (ad) => ad.matricule.trim().toLowerCase() === matricule.toLowerCase()
    );
    if (existing) {
      cart.setAyantDroit(existing);
      return true;
    }
    try {
      const created = await createAyantDroit({ client: client.id, nom, matricule });
      cart.setAyantDroit(created);
      return true;
    } catch (err: unknown) {
      Alert.alert('Erreur', drfError((err as { response?: { data?: unknown } })?.response?.data, "Impossible de créer l'ayant droit"));
      return false;
    }
  };

  // (Ré)ouvre un point de vente : badge en-tête + envoi. Retourne le poste
  // ou null — les alertes sont les mêmes qu'au login. Si aucun poste n'est
  // déterminable automatiquement → sélecteur (PostePickerModal), même en
  // mode silencieux (c'est un choix utilisateur, pas une erreur).
  const retryEnsurePoste = async (silent = false) => {
    setEnsuringPoste(true);
    try {
      const p = await ensurePosteVente();
      setPosteVente(p);
      setPosteChoices(null);
      return p;
    } catch (err: unknown) {
      if (err instanceof PosteChoiceRequired) {
        setPosteChoices(err.disponibles);
      } else if (!silent) {
        if ((err as Error)?.message === 'NO_POSTE_DISPONIBLE') {
          Alert.alert('Aucun point de vente', "Aucun poste « Mobile » n'est disponible. Demandez à l'administrateur d'en créer un (nom commençant par « Mobile ») dans Paramètres → Points de vente.");
        } else {
          const detail = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
            || (err as Error)?.message || '';
          Alert.alert('Point de vente', `Impossible d'ouvrir un point de vente : ${detail}`);
        }
      }
      return null;
    } finally {
      setEnsuringPoste(false);
    }
  };

  // Poste choisi dans le sélecteur → épinglé à l'appareil puis activé.
  const handlePickPoste = async (poste: PosteVente) => {
    setActivatingPoste(true);
    try {
      const actif = await activerPosteVente(poste.id);
      useSettingsStore.getState().setPosteVenteId(actif.id);
      setPosteVente(actif);
      setPosteChoices(null);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 400) {
        // Pris par un autre vendeur entre-temps → rafraîchir la liste
        // (postes « Mobile » uniquement, comme le sélecteur initial).
        try {
          const dispo = (await getPostesDisponibles()).filter(isPosteMobile);
          if (dispo.length === 0) {
            setPosteChoices(null);
            Alert.alert('Aucun point de vente', "Aucun poste « Mobile » n'est disponible. Demandez à l'administrateur d'en créer un (nom commençant par « Mobile ») dans Paramètres → Points de vente.");
          } else {
            setPosteChoices(dispo);
          }
        } catch {
          setPosteChoices(null);
        }
        Alert.alert('Point de vente', 'Ce point de vente vient d\u2019être pris — choisissez-en un autre.');
      } else {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        Alert.alert('Point de vente', detail || "Impossible d'activer ce point de vente");
      }
    } finally {
      setActivatingPoste(false);
    }
  };

  // Brouillon restauré : le panier peut contenir une remise ou un prix
  // modifié alors que les creds Sudo n'ont jamais été persistés →
  // revalidation superviseur avant l'envoi. Même ordre que
  // handleApplyLineEdit : prix d'abord, remise dans le callback.
  const ensureSudoCreds = (after: () => void) => {
    const needsPrix = cart.lines.some(
      (l) => l.lotId === null && l.prix_unitaire !== parseFloat(l.product.selling_price)
    );
    const needsRemise =
      cart.lines.some((l) => l.remise > 0) || cart.remiseGlobaleMontant() > 0;

    const askRemise = () => {
      if (!needsRemise || cart.remiseSudoCreds) { after(); return; }
      requireSudo(async (validatorId, password) => {
        cart.setRemiseSudoCreds({ validatorId, password });
        after();
      }, {
        title: 'Validation requise',
        message: "Confirmez la remise pour l'envoi",
        permission: 'can_do_remise',
      });
    };

    if (!needsPrix || cart.prixSudoCreds) { askRemise(); return; }
    requireSudo(async (validatorId, password) => {
      cart.setPrixSudoCreds({ validatorId, password });
      askRemise();
    }, {
      title: 'Validation requise',
      message: "Confirmez la modification de prix pour l'envoi",
      permission: 'can_modify_price',
    });
  };

  // ─── Mise en attente (stockage local, comme le web) ─────
  // Une vente en attente garde lignes/client/AD/remise — jamais les creds
  // Sudo → la revalidation à l'envoi (ensureSudoCreds) couvre la reprise.

  const handlePark = () => {
    if (cart.lines.length === 0) {
      Alert.alert('Panier vide', 'Rien à mettre en attente');
      return;
    }
    usePendingStore.getState().park({
      lines: cart.lines,
      client: cart.client,
      ayantDroit: cart.ayantDroit,
      remiseGlobale: cart.remiseGlobale,
      remiseMode: cart.remiseMode,
    });
    cart.clear();
  };

  const restorePending = (sale: PendingSale) => {
    // PendingSale ⊃ CartDraft → hydrate recalcule les totaux et remet les
    // creds Sudo à null.
    cart.hydrate(sale);
    usePendingStore.getState().remove(sale.id);
    setPendingModalVisible(false);
  };

  const mergePending = (sale: PendingSale) => {
    // Fusion simple par produit : quantité ajoutée si le produit est déjà
    // dans le panier (prix/remise/lot du panier conservés), sinon ligne
    // ajoutée telle quelle. Client/AD/remise du panier actuel conservés.
    for (const l of sale.lines) {
      const existing = useCartStore.getState().lines.find((x) => x.product.id === l.product.id);
      if (existing) {
        cart.updateQty(l.product.id, existing.quantite + l.quantite);
      } else {
        cart.addLine(l);
      }
    }
    usePendingStore.getState().remove(sale.id);
    setPendingModalVisible(false);
  };

  const handleRestorePress = (sale: PendingSale) => {
    if (cart.lines.length === 0) {
      restorePending(sale);
      return;
    }
    Alert.alert(
      'Panier non vide',
      'Le panier actuel contient déjà des articles.',
      [
        { text: 'Remplacer', onPress: () => restorePending(sale) },
        { text: 'Fusionner', onPress: () => mergePending(sale) },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  // Forçage de stock : une ligne dépasse le stock connu (récupéré à
  // l'ajout) → validation superviseur avant l'envoi, comme l'ajout
  // « hors stock » du web (can_sell_negative_stock). Le backend reste
  // source de vérité : un stock devenu insuffisant entre-temps est
  // rattrapé par le retry 403 dans sendToCashier.
  const ensureStockSudo = (after: () => void) => {
    if (cart.stockSudoCreds) { after(); return; }
    const over = cart.lines.filter((l) => l.quantite > 0 && l.quantite > l.product.stock);
    if (over.length === 0) { after(); return; }
    const names = over
      .slice(0, 3)
      .map((l) => `${l.product.name} (stock : ${l.product.stock})`)
      .join(', ');
    requireSudo(async (validatorId, password) => {
      cart.setStockSudoCreds({ validatorId, password });
      after();
    }, {
      title: 'Vente hors stock',
      message: `Stock insuffisant : ${names}${over.length > 3 ? `, +${over.length - 3} autre(s)` : ''}. Confirmez l'identité d'un superviseur pour forcer la vente.`,
      permission: 'can_sell_negative_stock',
    });
  };

  const handleSendToCashier = () => {
    if (cart.lines.length === 0) {
      Alert.alert('Panier vide', 'Ajoutez des produits avant d\'envoyer');
      return;
    }
    ensureSudoCreds(() => ensureStockSudo(() => { void sendToCashier(); }));
  };

  const sendToCashier = async () => {
    setSending(true);
    try {
      // L'AD est créé AVANT l'appel finaliser : si l'envoi échoue ensuite,
      // l'AD reste sélectionné et le matching matricule évite le doublon.
      if (!(await resolveAyantDroit())) return;

      let poste = posteVente ?? (await retryEnsurePoste(true));
      if (!poste) {
        Alert.alert('Point de vente requis', "Aucun point de vente actif. Touchez le nom du poste affiché en haut pour réessayer ou demandez à l'administrateur d'en créer un.");
        return;
      }

      let facture;
      try {
        facture = await sendSaleToCaisse(cart, poste.id);
      } catch (err: unknown) {
        // Poste fermé entre-temps (caisse web) → une seule réouverture + renvoi.
        const detail = (err as { response?: { status?: number; data?: { detail?: string } } })
          ?.response?.data?.detail;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 400 && detail?.toLowerCase().includes('point de vente')) {
          setPosteVente(null);
          poste = await retryEnsurePoste(true);
          if (!poste) {
            Alert.alert('Point de vente requis', "Aucun point de vente actif. Touchez le nom du poste affiché en haut pour réessayer ou demandez à l'administrateur d'en créer un.");
            return;
          }
          facture = await sendSaleToCaisse(cart, poste.id);
        } else if (status === 403 && detail?.includes('can_sell_negative_stock') && !cart.stockSudoCreds) {
          // Stock insuffisant non anticipé (stock local périmé) →
          // validation superviseur puis ré-envoi complet avec les creds
          // dans le bloc sudo du payload.
          requireSudo(async (validatorId, password) => {
            cart.setStockSudoCreds({ validatorId, password });
            void sendToCashier();
          }, {
            title: 'Vente hors stock',
            message: "Stock insuffisant sur au moins un produit. Confirmez l'identité d'un superviseur pour forcer la vente.",
            permission: 'can_sell_negative_stock',
          });
          return;
        } else {
          throw err;
        }
      }
      // Historique local AVANT le clear (totaux + client + lignes du panier).
      void addHistoriqueItem({
        numero_facture: facture?.numero_facture ?? null,
        articles_count: cart.totalArticles(),
        total_estime: cart.totalTTC(),
        client: cart.client?.name ?? null,
        lignes: cart.lines.map((l) => ({
          name: l.product.name,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
          remise: l.remise,
          total_ttc: l.total_ttc,
        })),
      });
      Alert.alert('Envoyé', `Facture ${facture?.numero_facture ?? ''} envoyée en caisse`);
      cart.clear();
      // Comme le web (_resetSaleDataOnly) : le client « comptoir » est
      // re-sélectionné pour la vente suivante (cache session).
      void ensureClientDivers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
      const detail = axiosErr.response?.data?.detail;
      const msg = detail
        || (axiosErr.message?.includes('timeout') ? 'Délai dépassé — vérifiez la connexion au serveur' : 'Échec de l\'envoi');
      Alert.alert('Erreur', msg);
    } finally {
      setSending(false);
    }
  };

  const handleLogout = () => {
    logout();
    onLogout();
  };

  // « Annuler » = vider le panier — confirmation demandée (un tap
  // accidentel ne doit pas perdre toute la vente en cours).
  const handleClearCart = () => {
    if (cart.lines.length === 0) return;
    Alert.alert(
      'Vider le panier ?',
      `${cart.totalArticles()} article(s) seront retirés de la vente en cours.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Vider', style: 'destructive', onPress: () => cart.clear() },
      ]
    );
  };

  const remiseMontant = cart.remiseGlobaleMontant();
  const isPro = cart.client?.client_type === 'PROFESSIONNEL';
  const ayantsDroit = cart.client?.ayants_droit ?? [];
  // En-tête compact : sur petits écrans le bouton « Annuler » devient icône seule.
  const compactHeader = useWindowDimensions().width < 560;
  // Densité verticale compacte : sous ~720dp de hauteur, les sections
  // fixes (header, recherche, client, remise, footer) sont resserrées
  // pour laisser un maximum de hauteur à la liste du panier.
  const winHeight = useWindowDimensions().height;
  const compactVert = winHeight < 720;
  const isSearching = searchQuery.length >= 2;

  // Offset bas du panneau résultats = hauteur clavier, corrigée de ce
  // que le système a déjà retiré à la fenêtre (adjustResize) — sinon le
  // panneau flotterait trop haut. Sous adjustPan/nothing : correction 0.
  useEffect(() => {
    fullHeightRef.current = Math.max(fullHeightRef.current, winHeight);
  }, [winHeight]);
  const kbOffset = Math.max(0, kbHeight - Math.max(0, fullHeightRef.current - winHeight));

  return (
    <View style={[styles.container, {
      paddingBottom: Math.min(insets.bottom, 24),
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}>
      {/* Header — disposition « Vente tablette » : titre + sous-titre
          (poste touchable = retry ensurePosteVente, ex-badge) à gauche,
          actions à droite dont « Annuler » = vider le panier. */}
      <View style={[styles.header, compactVert && styles.headerCompact, { paddingTop: (compactVert ? ms(8) : ms(12)) + (Platform.OS === 'web' ? 0 : insets.top) }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Vente</Text>
            <Text style={styles.headerUser} numberOfLines={1}> · {username}</Text>
          </View>
          <TouchableOpacity style={styles.headerSubtitle} onPress={() => retryEnsurePoste()} disabled={ensuringPoste}>
            {ensuringPoste ? (
              <ActivityIndicator size="small" color={theme.textMuted} />
            ) : (
              <Store size={ms(13)} color={posteVente ? theme.primary : theme.textMuted} />
            )}
            <Text style={[styles.headerSubtitleText, !posteVente && { color: theme.textMuted }]} numberOfLines={1}>
              {posteVente?.nom ?? 'Aucun point de vente'} • {cart.totalArticles()} article(s)
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setPendingModalVisible(true)} style={styles.iconBtn}>
            <Clock size={ms(20)} color={theme.textMuted} />
            {pendingCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation?.navigate('Historique')} style={styles.iconBtn}>
            <History size={ms(20)} color={theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePark}
            style={[styles.iconBtn, cart.lines.length === 0 && { opacity: 0.4 }]}
            disabled={cart.lines.length === 0}
          >
            <Pause size={ms(20)} color={theme.warning} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleClearCart}
            style={[styles.cancelBtn, cart.lines.length === 0 && { opacity: 0.4 }]}
            disabled={cart.lines.length === 0}
          >
            <Trash2 size={ms(15)} color={theme.danger} />
            {!compactHeader && <Text style={styles.cancelBtnText}>Annuler</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn}>
            <ArrowLeft size={ms(20)} color={theme.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Recherche produit — pleine largeur, scan conservé */}
      <View style={[styles.searchBar, compactVert && styles.searchBarCompact]}>
        <Search size={ms(18)} color={theme.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un produit..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearchSubmit}
          blurOnSubmit={false}
          autoCorrect={false}
          autoCapitalize="none"
          autoFocus
        />
        {Platform.OS !== 'web' && (
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={() => setScanModalVisible(true)}
          >
            <ScanBarcode size={ms(20)} color={theme.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Zone principale : lignes du panier (cadre pointillé façon
          « Vente tablette »). Les résultats de recherche s'affichent en
          overlay flottant ancré au-dessus du clavier (voir plus bas). */}
      <View
        style={styles.mainBox}
        onLayout={(e) => setMainBoxY(e.nativeEvent.layout.y)}
      >
        <FlatList
          data={cart.lines}
          keyExtractor={(l) => String(l.product.id)}
          renderItem={({ item }) => (
            <CartItemRow
              line={item}
              onIncrement={() => cart.updateQty(item.product.id, item.quantite + 1)}
              onDecrement={() => cart.updateQty(item.product.id, item.quantite - 1)}
              onRemove={() => cart.removeLine(item.product.id)}
              onOpenLot={() => handleOpenLot(item.product.id)}
              onEditLine={() => { setLineEdit(item); setLineEditModalVisible(true); }}
            />
          )}
          contentContainerStyle={styles.mainList}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <ShoppingCart size={ms(40)} color={theme.borderStrong} />
              <Text style={styles.emptyStateText}>Ajoutez des produits pour commencer</Text>
            </View>
          }
        />
      </View>

      {/* Sections basses masquées pendant la recherche : l'overlay des
          résultats les recouvre et flotte au-dessus du clavier */}
      {!isSearching && (<>
      {/* Client — carte compacte façon « Vente tablette » ; « Modifier »
          ouvre le même modal (déselection via « Client de passage »). */}
      <View style={[styles.clientCard, compactVert && styles.clientCardCompact]}>
        <View style={styles.clientCardLeft}>
          <User size={ms(16)} color={theme.textMuted} />
          <View style={styles.clientCardText}>
            <Text style={styles.clientLabel}>Client</Text>
            <Text style={styles.clientName} numberOfLines={1}>
              {cart.client ? cart.client.name : 'Client de passage'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setClientModalVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.clientEdit}>Modifier</Text>
        </TouchableOpacity>
      </View>

      {/* Ayant droit (client professionnel uniquement) */}
      {isPro && (
        <View style={[styles.adBlock, compactVert && styles.adBlockCompact]}>
          <Text style={styles.adLabel}>Ayant droit</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.adChips}>
              {ayantsDroit.map((ad: AyantDroit) => {
                const selected = cart.ayantDroit?.id === ad.id;
                return (
                  <TouchableOpacity
                    key={ad.id}
                    style={[styles.adChip, selected && styles.adChipSelected]}
                    onPress={() => {
                      cart.setAyantDroit(ad);
                      setAdFormVisible(false);
                      setAdNom('');
                      setAdMatricule('');
                    }}
                  >
                    <Text style={[styles.adChipText, selected && styles.adChipTextSelected]}>
                      {ad.nom} — {ad.matricule}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.adChip, adFormVisible && styles.adChipSelected]}
                onPress={() => {
                  setAdFormVisible(true);
                  cart.setAyantDroit(null);
                }}
              >
                <Text style={[styles.adChipText, adFormVisible && styles.adChipTextSelected]}>+ Nouveau</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          {adFormVisible && (
            <View style={styles.adForm}>
              <TextInput
                style={styles.adInput}
                placeholder="Nom"
                placeholderTextColor={theme.textMuted}
                value={adNom}
                onChangeText={setAdNom}
                autoCapitalize="characters"
              />
              <TextInput
                style={styles.adInput}
                placeholder="Matricule"
                placeholderTextColor={theme.textMuted}
                value={adMatricule}
                onChangeText={setAdMatricule}
                autoCapitalize="characters"
              />
            </View>
          )}
        </View>
      )}

      {/* Remise globale */}
      <View style={[styles.remiseRow, compactVert && styles.remiseRowCompact]}>
        <Text style={styles.remiseLabel}>Remise globale</Text>
        <View style={styles.remiseControls}>
          <TextInput
            style={styles.remiseInput}
            value={remiseInput}
            onChangeText={setRemiseInput}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={theme.textMuted}
            onBlur={commitRemiseInput}
            onSubmitEditing={commitRemiseInput}
          />
          <View style={styles.remiseToggle}>
            <TouchableOpacity
              style={[styles.remiseModeBtn, cart.remiseMode === 'taux' && styles.remiseModeBtnActive]}
              onPress={() => toggleRemiseMode('taux')}
            >
              <Text style={[styles.remiseModeText, cart.remiseMode === 'taux' && styles.remiseModeTextActive]}>%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.remiseModeBtn, cart.remiseMode === 'montant' && styles.remiseModeBtnActive]}
              onPress={() => toggleRemiseMode('montant')}
            >
              <Text style={[styles.remiseModeText, cart.remiseMode === 'montant' && styles.remiseModeTextActive]}>F</Text>
            </TouchableOpacity>
          </View>
          {remiseMontant > 0 && (
            <Text style={styles.remiseAmount}>−{remiseMontant.toLocaleString('fr-FR')} F</Text>
          )}
        </View>
      </View>

      {/* Footer : total + envoi en caisse */}
      <View style={[styles.footerRow, compactVert && styles.footerRowCompact]}>
        <View style={[styles.totalBox, compactVert && styles.totalBoxCompact]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{cart.totalTTC().toLocaleString('fr-FR')} F</Text>
          {remiseMontant > 0 && (
            <Text style={styles.sousTotal}>Sous-total : {cart.sousTotal().toLocaleString('fr-FR')} F</Text>
          )}
          {(cart.remiseSudoCreds || cart.prixSudoCreds) && (
            <View style={styles.sudoBadge}>
              <ShieldCheck size={ms(12)} color={theme.primary} />
              <Text style={styles.sudoBadgeText}>Validé par superviseur</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, compactVert && styles.sendBtnCompact, (sending || cart.lines.length === 0) && styles.sendBtnDisabled]}
          onPress={handleSendToCashier}
          disabled={sending || cart.lines.length === 0}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Send size={ms(18)} color="#fff" />
              <Text style={styles.sendBtnText}>Envoyer en caisse</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      </>)}

      {/* Résultats de recherche : panneau flottant qui occupe tout
          l'espace entre la barre de recherche et le haut du clavier —
          visible que le clavier soit ouvert ou non. */}
      {isSearching && (
        <View style={[styles.resultsOverlay, { top: mainBoxY, bottom: kbOffset }]}>
          {searching ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: ms(20) }} />
          ) : results.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Aucun résultat</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(i) => String(i.id)}
              renderItem={({ item }) => <ProductRow product={item} onPress={handleAddProduct} />}
              contentContainerStyle={styles.mainList}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      )}

      {/* Modal scan caméra */}
      <ScanBarcodeModal
        visible={scanModalVisible}
        onResolve={resolveBarcode}
        onAdd={addScanResult}
        onClose={() => setScanModalVisible(false)}
      />

      {/* Modal Lot */}
      <LotModal
        visible={lotModalVisible}
        product={lotModalProduct}
        currentLotId={lotModalCurrentId}
        onSelect={handleSelectLot}
        onClose={() => setLotModalVisible(false)}
      />

      {/* Modal ventes en attente */}
      <PendingSalesModal
        visible={pendingModalVisible}
        cartEmpty={cart.lines.length === 0}
        onRestore={handleRestorePress}
        onMerge={mergePending}
        onDelete={(id) => usePendingStore.getState().remove(id)}
        onClose={() => setPendingModalVisible(false)}
      />

      {/* Sélecteur de point de vente (poste épinglé à l'appareil) */}
      <PostePickerModal
        visible={posteChoices !== null}
        postes={posteChoices ?? []}
        busy={activatingPoste}
        onPick={handlePickPoste}
        onClose={() => setPosteChoices(null)}
      />

      {/* Modal édition ligne (prix + remise) */}
      <LineEditModal
        visible={lineEditModalVisible}
        line={lineEdit}
        onApply={handleApplyLineEdit}
        onClose={() => { setLineEditModalVisible(false); setLineEdit(null); }}
      />

      {/* Modal validation superviseur — key = requestId : remonte le champ
          à vide quand une requête Sudo en remplace une autre (prix → remise) */}
      <SudoModal
        key={sudoState.requestId}
        visible={sudoState.visible}
        title={sudoState.title}
        message={sudoState.message}
        permission={sudoState.permission}
        onValidate={sudoState.onValidate}
        onClose={closeSudo}
      />

      {/* Modal Client */}
      {clientModalVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner client</Text>
              <TouchableOpacity onPress={() => { setClientModalVisible(false); setClientFormVisible(false); setClientFormError(null); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {clientFormVisible ? (
              <View>
                <Text style={styles.formLabel}>Nom *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Nom du client"
                  placeholderTextColor={theme.textMuted}
                  value={newClientName}
                  onChangeText={(t) => { setNewClientName(t); setClientFormError(null); }}
                  autoFocus
                />
                <Text style={styles.formLabel}>Téléphone</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Optionnel"
                  placeholderTextColor={theme.textMuted}
                  value={newClientPhone}
                  onChangeText={(t) => { setNewClientPhone(t); setClientFormError(null); }}
                  keyboardType="phone-pad"
                />
                {clientFormError ? <Text style={styles.formError}>{clientFormError}</Text> : null}
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={styles.formBackBtn}
                    onPress={() => { setClientFormVisible(false); setClientFormError(null); }}
                    disabled={creatingClient}
                  >
                    <Text style={styles.formBackText}>Retour</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.formCreateBtn, creatingClient && { opacity: 0.6 }]}
                    onPress={handleCreateClient}
                    disabled={creatingClient}
                  >
                    {creatingClient ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.formCreateText}>Créer</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Rechercher client..."
                  placeholderTextColor={theme.textMuted}
                  value={clientSearch}
                  onChangeText={setClientSearch}
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.newClientBtn}
                  onPress={() => setClientFormVisible(true)}
                >
                  <Text style={styles.newClientText}>+ Nouveau client</Text>
                </TouchableOpacity>
                {clientSearching ? (
                  <ActivityIndicator color={theme.primary} style={{ marginVertical: 20 }} />
                ) : (
                  <FlatList
                    data={[{ id: 0, name: 'Client de passage' } as Client, ...clientResults]}
                    keyExtractor={(c) => String(c.id)}
                    renderItem={({ item }) => (
                      item.id === 0 ? (
                        <TouchableOpacity
                          style={styles.clientItem}
                          onPress={() => handleSelectClient(null)}
                        >
                          <Text style={styles.clientItemName}>Client de passage</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.clientItem}
                          onPress={() => handleSelectClient(item)}
                        >
                          <Text style={styles.clientItemName}>{item.name}</Text>
                          {item.phone ? <Text style={styles.clientItemPhone}>{item.phone}</Text> : null}
                        </TouchableOpacity>
                      )
                    )}
                    contentContainerStyle={styles.modalList}
                  />
                )}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ms(16),
    paddingVertical: ms(12),
    backgroundColor: theme.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  headerTitle: { fontSize: ms(18), fontWeight: '800', color: theme.text },
  headerUser: { fontSize: ms(12), color: theme.textMuted, flexShrink: 1 },
  headerSubtitle: { flexDirection: 'row', alignItems: 'center', gap: ms(5), marginTop: ms(2), alignSelf: 'flex-start', maxWidth: '100%' },
  headerSubtitleText: { fontSize: ms(12), fontWeight: '500', color: theme.textSecondary, flexShrink: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: ms(7) },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(5),
    backgroundColor: theme.dangerWash,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.25)',
    borderRadius: ms(20),
    paddingHorizontal: ms(12),
    paddingVertical: ms(6),
    marginLeft: ms(4),
    marginRight: ms(2),
  },
  cancelBtnText: { fontSize: ms(13), fontWeight: '600', color: theme.danger },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bgElevated, borderRadius: ms(12), paddingHorizontal: ms(12), paddingVertical: ms(10), marginHorizontal: ms(12), marginTop: ms(12), marginBottom: ms(10), borderWidth: 1, borderColor: theme.border },
  searchInput: { flex: 1, marginLeft: ms(8), color: theme.text, fontSize: ms(14) },
  scanBtn: { padding: ms(6), marginLeft: ms(4) },
  mainBox: {
    flex: 1,
    marginHorizontal: ms(12),
    borderRadius: ms(16),
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.borderStrong,
    backgroundColor: theme.bgElevated,
    overflow: 'hidden',
  },
  resultsOverlay: {
    position: 'absolute',
    left: ms(12),
    right: ms(12),
    borderRadius: ms(16),
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.borderStrong,
    backgroundColor: theme.bgElevated,
    overflow: 'hidden',
    zIndex: 20,
    elevation: 8,
  },
  mainList: { flexGrow: 1, padding: ms(8) },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: ms(12), paddingVertical: ms(40) },
  emptyStateText: { fontSize: ms(13), color: theme.textMuted },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: ms(12),
    marginTop: ms(10),
    backgroundColor: theme.bgElevated,
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: ms(14),
    paddingVertical: ms(10),
  },
  clientCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: ms(10), minWidth: 0 },
  clientCardText: { flex: 1, minWidth: 0 },
  clientLabel: { fontSize: ms(10), fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  clientName: { fontSize: ms(14), fontWeight: '700', color: theme.text },
  clientEdit: { fontSize: ms(13), fontWeight: '700', color: theme.primary, paddingLeft: ms(10) },
  adBlock: { marginHorizontal: ms(12), marginTop: ms(10) },
  adLabel: { fontSize: ms(11), fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', marginBottom: ms(6) },
  adChips: { flexDirection: 'row', gap: ms(6) },
  adChip: {
    paddingHorizontal: ms(10),
    paddingVertical: ms(6),
    borderRadius: ms(16),
    backgroundColor: theme.bgMuted,
    borderWidth: 1,
    borderColor: theme.borderStrong,
  },
  adChipSelected: { backgroundColor: theme.primaryWash, borderColor: theme.primary },
  adChipText: { fontSize: ms(12), color: theme.textSecondary, fontWeight: '600' },
  adChipTextSelected: { color: theme.primary },
  adForm: { flexDirection: 'row', gap: ms(8), marginTop: ms(8) },
  adInput: {
    flex: 1,
    backgroundColor: theme.bgElevated,
    borderRadius: ms(8),
    paddingHorizontal: ms(10),
    paddingVertical: ms(8),
    color: theme.text,
    fontSize: ms(13),
    borderWidth: 1,
    borderColor: theme.border,
  },
  remiseRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: ms(12), marginTop: ms(10), gap: ms(10) },
  remiseLabel: { fontSize: ms(12), color: theme.textSecondary, flex: 1 },
  remiseControls: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  remiseInput: {
    width: ms(64),
    backgroundColor: theme.bg,
    borderRadius: ms(6),
    paddingHorizontal: ms(8),
    paddingVertical: ms(6),
    color: theme.text,
    fontSize: ms(13),
    borderWidth: 1,
    borderColor: theme.border,
    textAlign: 'right',
  },
  remiseToggle: { flexDirection: 'row', borderRadius: ms(6), overflow: 'hidden', borderWidth: 1, borderColor: theme.borderStrong },
  remiseModeBtn: { paddingHorizontal: ms(10), paddingVertical: ms(6), backgroundColor: theme.bg },
  remiseModeBtnActive: { backgroundColor: theme.primary },
  remiseModeText: { fontSize: ms(12), fontWeight: '700', color: theme.textMuted },
  remiseModeTextActive: { color: '#fff' },
  remiseAmount: { fontSize: ms(12), fontWeight: '700', color: theme.primary, minWidth: ms(60), textAlign: 'right' },
  footerRow: { flexDirection: 'row', alignItems: 'stretch', gap: ms(10), marginHorizontal: ms(12), marginTop: ms(10), marginBottom: ms(4) },
  totalBox: {
    flex: 1,
    backgroundColor: theme.bgMuted,
    borderRadius: ms(12),
    paddingHorizontal: ms(14),
    paddingVertical: ms(10),
    justifyContent: 'center',
  },
  totalLabel: { fontSize: ms(10), fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  totalValue: { fontSize: ms(20), fontWeight: '800', color: theme.primary },
  sousTotal: { fontSize: ms(11), color: theme.textSecondary, marginTop: ms(2) },
  sudoBadge: { flexDirection: 'row', alignItems: 'center', gap: ms(4), marginTop: ms(4) },
  sudoBadgeText: { fontSize: ms(10), color: theme.primary, fontWeight: '600' },
  pendingBadge: {
    position: 'absolute',
    top: ms(-4),
    right: ms(-4),
    minWidth: ms(16),
    height: ms(16),
    borderRadius: ms(8),
    backgroundColor: theme.warning,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ms(3),
  },
  pendingBadgeText: { fontSize: ms(9), fontWeight: '800', color: '#fff' },
  sendBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: ms(8), backgroundColor: theme.primary, borderRadius: ms(12), paddingVertical: ms(14) },
  sendBtnDisabled: { backgroundColor: theme.borderStrong },
  sendBtnText: { color: '#fff', fontSize: ms(15), fontWeight: '700' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.bgOverlay, justifyContent: 'center', alignItems: 'center', padding: ms(24) },
  modalSheet: { backgroundColor: theme.bgElevated, borderRadius: ms(16), width: '100%', maxWidth: ms(400), maxHeight: '80%', padding: ms(20) },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: ms(16) },
  modalTitle: { fontSize: ms(17), fontWeight: '700', color: theme.text },
  modalClose: { fontSize: ms(18), color: theme.textMuted },
  modalInput: { backgroundColor: theme.bg, borderRadius: ms(8), paddingHorizontal: ms(12), paddingVertical: ms(10), color: theme.text, fontSize: ms(14), borderWidth: 1, borderColor: theme.border, marginBottom: ms(12) },
  modalList: { maxHeight: ms(300) },
  clientItem: { padding: ms(12), backgroundColor: theme.bgMuted, borderRadius: ms(8), marginBottom: ms(4) },
  clientItemName: { fontSize: ms(14), fontWeight: '600', color: theme.text },
  clientItemPhone: { fontSize: ms(12), color: theme.textMuted, marginTop: ms(2) },
  newClientBtn: { marginBottom: ms(10) },
  newClientText: { fontSize: ms(13), color: theme.primary, fontWeight: '700' },
  formLabel: { fontSize: ms(11), fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', marginBottom: ms(6) },
  formError: { color: theme.danger, fontSize: ms(12), marginBottom: ms(8) },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: ms(10), marginTop: ms(4) },
  formBackBtn: { paddingHorizontal: ms(18), paddingVertical: ms(10), borderRadius: ms(8), backgroundColor: theme.bgMuted },
  formBackText: { color: theme.text, fontWeight: '600', fontSize: ms(14) },
  formCreateBtn: { paddingHorizontal: ms(22), paddingVertical: ms(10), borderRadius: ms(8), backgroundColor: theme.primary, minWidth: ms(90), alignItems: 'center' },
  formCreateText: { color: '#fff', fontWeight: '700', fontSize: ms(14) },
  // ── Densité compacte (petite hauteur < 720dp) : resserre les sections
  // fixes pour agrandir la zone liste du panier.
  headerCompact: { paddingVertical: ms(8) },
  searchBarCompact: { marginTop: ms(6), marginBottom: ms(6), paddingVertical: ms(6) },
  clientCardCompact: { marginTop: ms(6), paddingVertical: ms(6) },
  adBlockCompact: { marginTop: ms(6) },
  remiseRowCompact: { marginTop: ms(6) },
  footerRowCompact: { marginTop: ms(6), marginBottom: ms(2) },
  totalBoxCompact: { paddingVertical: ms(6) },
  sendBtnCompact: { paddingVertical: ms(8) },
});
