import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator,
  Platform, ScrollView,
} from 'react-native';
import { Search, Send, Trash2, User, ArrowLeft, ScanBarcode, ShieldCheck, Store, History, Pause, Clock } from 'lucide-react-native';
import { useCartStore } from '../stores/useCartStore';
import { useAuthStore } from '../stores/useAuthStore';
import { usePendingStore } from '../stores/usePendingStore';
import {
  searchProducts, searchClients, sendSaleToCaisse, getProductByBarcode,
  getProductById, getLotByDatamatrix, createClient, createAyantDroit,
  ensurePosteVente,
} from '../services/api';
import { addHistoriqueItem } from '../services/historique';
import { parseGS1Datamatrix } from '../utils/gs1Parser';
import { theme } from '../config/theme';
import { useSudo } from '../hooks/useSudo';
import { ProductRow } from '../components/ProductRow';
import { CartItemRow } from '../components/CartItemRow';
import { LotModal } from '../components/LotModal';
import { ScanBarcodeModal } from '../components/ScanBarcodeModal';
import { SudoModal } from '../components/SudoModal';
import { LineEditModal } from '../components/LineEditModal';
import { PendingSalesModal } from '../components/PendingSalesModal';
import type { Product, StockLot, Client, CartLine, AyantDroit, ScanResult, PendingSale } from '../types';

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

  const handleAddProduct = (product: Product) => {
    cart.addProduct(product);
    setSearchQuery('');
    setResults([]);
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
  // ou null — les alertes sont les mêmes qu'au login.
  const retryEnsurePoste = async (silent = false) => {
    setEnsuringPoste(true);
    try {
      const p = await ensurePosteVente();
      setPosteVente(p);
      return p;
    } catch (err: unknown) {
      if (!silent) {
        if ((err as Error)?.message === 'NO_POSTE_DISPONIBLE') {
          Alert.alert('Aucun point de vente', "Aucun point de vente n'est disponible. Demandez à l'administrateur d'en créer un dans Paramètres → Points de vente.");
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

  const handleSendToCashier = () => {
    if (cart.lines.length === 0) {
      Alert.alert('Panier vide', 'Ajoutez des produits avant d\'envoyer');
      return;
    }
    ensureSudoCreds(() => { void sendToCashier(); });
  };

  const sendToCashier = async () => {
    setSending(true);
    try {
      // L'AD est créé AVANT l'appel finaliser : si l'envoi échoue ensuite,
      // l'AD reste sélectionné et le matching matricule évite le doublon.
      if (!(await resolveAyantDroit())) return;

      let poste = posteVente ?? (await retryEnsurePoste(true));
      if (!poste) {
        Alert.alert('Point de vente requis', "Aucun point de vente actif. Touchez le badge en haut pour réessayer ou demandez à l'administrateur d'en créer un.");
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
            Alert.alert('Point de vente requis', "Aucun point de vente actif. Touchez le badge en haut pour réessayer ou demandez à l'administrateur d'en créer un.");
            return;
          }
          facture = await sendSaleToCaisse(cart, poste.id);
        } else {
          throw err;
        }
      }
      // Historique local AVANT le clear (totaux + client du panier).
      void addHistoriqueItem({
        numero_facture: facture?.numero_facture ?? null,
        articles_count: cart.totalArticles(),
        total_estime: cart.totalTTC(),
        client: cart.client?.name ?? null,
      });
      Alert.alert('Envoyé', `Facture ${facture?.numero_facture ?? ''} envoyée en caisse`);
      cart.clear();
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

  const remiseMontant = cart.remiseGlobaleMontant();
  const isPro = cart.client?.client_type === 'PROFESSIONNEL';
  const ayantsDroit = cart.client?.ayants_droit ?? [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.userBadge}>
            <User size={16} color={theme.textMuted} />
            <Text style={styles.userText}>{username}</Text>
          </View>
          <TouchableOpacity style={styles.userBadge} onPress={() => retryEnsurePoste()} disabled={ensuringPoste}>
            {ensuringPoste ? (
              <ActivityIndicator size="small" color={theme.textMuted} />
            ) : (
              <Store size={16} color={posteVente ? theme.primary : theme.textMuted} />
            )}
            <Text style={[styles.userText, !posteVente && { color: theme.textMuted }]}>
              {posteVente?.nom ?? 'Aucun point de vente'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setPendingModalVisible(true)} style={styles.logoutBtn}>
            <Clock size={20} color={theme.textMuted} />
            {pendingCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation?.navigate('Historique')} style={styles.logoutBtn}>
            <History size={20} color={theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <ArrowLeft size={20} color={theme.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Split vertical */}
      <View style={styles.split}>
        {/* Gauche : Recherche + Produits */}
        <View style={styles.leftPanel}>
          <View style={styles.searchBar}>
            <Search size={18} color={theme.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher produit..."
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
                <ScanBarcode size={20} color={theme.primary} />
              </TouchableOpacity>
            )}
          </View>

          {searching ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 20 }} />
          ) : results.length === 0 && searchQuery.length >= 2 ? (
            <Text style={styles.empty}>Aucun résultat</Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(i) => String(i.id)}
              renderItem={({ item }) => <ProductRow product={item} onPress={handleAddProduct} />}
              contentContainerStyle={styles.list}
            />
          )}
        </View>

        {/* Droite : Panier */}
        <View style={styles.rightPanel}>
          {/* Client */}
          <View style={styles.clientBtn}>
            <TouchableOpacity
              style={styles.clientBtnMain}
              onPress={() => setClientModalVisible(true)}
            >
              <User size={16} color={theme.textMuted} />
              <Text style={styles.clientText}>
                {cart.client ? cart.client.name : 'Client de passage'}
              </Text>
            </TouchableOpacity>
            {cart.client && (
              <TouchableOpacity onPress={() => handleSelectClient(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.clientClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Ayant droit (client professionnel uniquement) */}
          {isPro && (
            <View style={styles.adBlock}>
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

          {/* Lignes panier */}
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
            contentContainerStyle={styles.cartList}
            ListEmptyComponent={<Text style={styles.emptyCart}>Panier vide</Text>}
          />

          {/* Footer panier */}
          <View style={styles.cartFooter}>
            {/* Remise globale */}
            <View style={styles.remiseRow}>
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

            <View style={styles.totals}>
              <View>
                <Text style={styles.articles}>{cart.totalArticles()} article(s)</Text>
                {remiseMontant > 0 && (
                  <Text style={styles.sousTotal}>Sous-total : {cart.sousTotal().toLocaleString('fr-FR')} F</Text>
                )}
                {(cart.remiseSudoCreds || cart.prixSudoCreds) && (
                  <View style={styles.sudoBadge}>
                    <ShieldCheck size={12} color={theme.primary} />
                    <Text style={styles.sudoBadgeText}>Validé par superviseur</Text>
                  </View>
                )}
              </View>
              <Text style={styles.total}>{cart.totalTTC().toLocaleString('fr-FR')} F</Text>
            </View>
            <View style={styles.footerActions}>
              <TouchableOpacity onPress={cart.clear} style={styles.clearBtn}>
                <Trash2 size={18} color={theme.danger} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePark}
                style={[styles.parkBtn, cart.lines.length === 0 && { opacity: 0.4 }]}
                disabled={cart.lines.length === 0}
              >
                <Pause size={18} color={theme.warning} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                onPress={handleSendToCashier}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Send size={18} color="#fff" />
                    <Text style={styles.sendBtnText}>Envoyer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  userBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.bgMuted, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  userText: { fontSize: 13, color: theme.text, fontWeight: '600' },
  logoutBtn: { padding: 6 },
  split: { flex: 1, flexDirection: 'row' },
  leftPanel: { flex: 1, borderRightWidth: 1, borderRightColor: theme.border, padding: 12 },
  rightPanel: { flex: 1, padding: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bgElevated, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  searchInput: { flex: 1, marginLeft: 8, color: theme.text, fontSize: 14 },
  scanBtn: { padding: 6, marginLeft: 4 },
  list: { paddingBottom: 12 },
  empty: { textAlign: 'center', color: theme.textMuted, marginTop: 24, fontSize: 13 },
  clientBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bgElevated, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  clientBtnMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  clientText: { fontSize: 13, color: theme.text },
  clientClear: { fontSize: 14, color: theme.textMuted, paddingLeft: 8 },
  adBlock: { marginBottom: 12 },
  adLabel: { fontSize: 11, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 6 },
  adChips: { flexDirection: 'row', gap: 6 },
  adChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.bgMuted,
    borderWidth: 1,
    borderColor: theme.borderStrong,
  },
  adChipSelected: { backgroundColor: theme.primaryWash, borderColor: theme.primary },
  adChipText: { fontSize: 12, color: theme.textSecondary, fontWeight: '600' },
  adChipTextSelected: { color: theme.primary },
  adForm: { flexDirection: 'row', gap: 8, marginTop: 8 },
  adInput: {
    flex: 1,
    backgroundColor: theme.bgElevated,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: theme.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cartList: { flex: 1, paddingBottom: 12 },
  emptyCart: { textAlign: 'center', color: theme.textMuted, marginTop: 24, fontSize: 13 },
  cartFooter: { backgroundColor: theme.bgElevated, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.border },
  remiseRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  remiseLabel: { fontSize: 12, color: theme.textSecondary, flex: 1 },
  remiseControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  remiseInput: {
    width: 64,
    backgroundColor: theme.bg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: theme.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: theme.border,
    textAlign: 'right',
  },
  remiseToggle: { flexDirection: 'row', borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: theme.borderStrong },
  remiseModeBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.bg },
  remiseModeBtnActive: { backgroundColor: theme.primary },
  remiseModeText: { fontSize: 12, fontWeight: '700', color: theme.textMuted },
  remiseModeTextActive: { color: '#fff' },
  remiseAmount: { fontSize: 12, fontWeight: '700', color: theme.primary, minWidth: 60, textAlign: 'right' },
  totals: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  articles: { fontSize: 12, color: theme.textMuted },
  sousTotal: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
  sudoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  sudoBadgeText: { fontSize: 10, color: theme.primary, fontWeight: '600' },
  total: { fontSize: 18, fontWeight: '700', color: theme.primary },
  footerActions: { flexDirection: 'row', gap: 8 },
  clearBtn: { padding: 10, backgroundColor: theme.dangerWash, borderRadius: 8 },
  parkBtn: { padding: 10, backgroundColor: theme.warningWash, borderRadius: 8 },
  pendingBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.warning,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  pendingBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  sendBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, borderRadius: 8, paddingVertical: 12 },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.bgOverlay, justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalSheet: { backgroundColor: theme.bgElevated, borderRadius: 16, width: '100%', maxWidth: 400, maxHeight: '80%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
  modalClose: { fontSize: 18, color: theme.textMuted },
  modalInput: { backgroundColor: theme.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: theme.text, fontSize: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 12 },
  modalList: { maxHeight: 300 },
  clientItem: { padding: 12, backgroundColor: theme.bgMuted, borderRadius: 8, marginBottom: 4 },
  clientItemName: { fontSize: 14, fontWeight: '600', color: theme.text },
  clientItemPhone: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  newClientBtn: { marginBottom: 10 },
  newClientText: { fontSize: 13, color: theme.primary, fontWeight: '700' },
  formLabel: { fontSize: 11, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 6 },
  formError: { color: theme.danger, fontSize: 12, marginBottom: 8 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  formBackBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, backgroundColor: theme.bgMuted },
  formBackText: { color: theme.text, fontWeight: '600', fontSize: 14 },
  formCreateBtn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 8, backgroundColor: theme.primary, minWidth: 90, alignItems: 'center' },
  formCreateText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
