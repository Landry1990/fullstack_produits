import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator,
  Platform, useWindowDimensions, Keyboard,
} from 'react-native';
import { Search, Send, Trash2, User, ArrowLeft, ScanBarcode, ShieldCheck, Store, History, Pause, Clock, ShoppingCart } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCartStore } from '../stores/useCartStore';
import { useAuthStore } from '../stores/useAuthStore';
import { usePendingStore } from '../stores/usePendingStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import {
  ensurePosteVente, activerPosteVente, getPostesDisponibles, PosteChoiceRequired, isPosteMobile,
} from '../services/api';
import { theme } from '../config/theme';
import { moderateScale as ms } from '../utils/scale';
import { useSudo } from '../hooks/useSudo';
import { useProductSearch } from '../hooks/useProductSearch';
import { useSendSale } from '../hooks/useSendSale';
import { ProductRow } from '../components/ProductRow';
import { CartItemRow } from '../components/CartItemRow';
import { LotModal } from '../components/LotModal';
import { ScanBarcodeModal } from '../components/ScanBarcodeModal';
import { SudoModal } from '../components/SudoModal';
import { LineEditModal } from '../components/LineEditModal';
import { PendingSalesModal } from '../components/PendingSalesModal';
import { PostePickerModal } from '../components/PostePickerModal';
import { ClientModal } from '../components/ClientModal';
import { AyantDroitSection } from '../components/AyantDroitSection';
import { styles } from './FacturationScreen.styles';
import type { Product, StockLot, Client, CartLine, AyantDroit, PendingSale, PosteVente } from '../types';

export function FacturationScreen({ onLogout, navigation }: { onLogout: () => void; navigation?: { navigate: (screen: string) => void } }) {
  const cart = useCartStore();
  const pendingCount = usePendingStore((s) => s.sales.length);
  const { username, logout, maxDiscountRate, posteVente, setPosteVente } = useAuthStore();
  const { sudoState, requireSudo, closeSudo } = useSudo();
  const insets = useSafeAreaInsets();

  // Recherche produit + scan caméra/douchette (hook extrait).
  const {
    searchQuery, setSearchQuery, results, searching, isSearching,
    handleAddProduct, resolveBarcode, addScanResult, handleSearchSubmit,
  } = useProductSearch();

  const [lotModalVisible, setLotModalVisible] = useState(false);
  const [lotModalProduct, setLotModalProduct] = useState<Product | null>(null);
  const [lotModalCurrentId, setLotModalCurrentId] = useState<number | null>(null);

  const [lineEditModalVisible, setLineEditModalVisible] = useState(false);
  const [lineEdit, setLineEdit] = useState<CartLine | null>(null);

  const [clientModalVisible, setClientModalVisible] = useState(false);

  const [adFormVisible, setAdFormVisible] = useState(false);
  const [adNom, setAdNom] = useState('');
  const [adMatricule, setAdMatricule] = useState('');

  const [remiseInput, setRemiseInput] = useState('');

  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [pendingModalVisible, setPendingModalVisible] = useState(false);
  const [ensuringPoste, setEnsuringPoste] = useState(false);
  // Sélecteur de poste : rempli quand ensurePosteVente lève
  // PosteChoiceRequired (1er démarrage ou poste pris par un autre vendeur).
  const [posteChoices, setPosteChoices] = useState<PosteVente[] | null>(null);
  const [activatingPoste, setActivatingPoste] = useState(false);

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

  // ─── Point de vente ─────────────────────────────────────

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

  // ─── Envoi en caisse (hook extrait : forçage stock, AD, poste,
  //     sendSaleToCaisse + retries, historique, clear) ─────
  const { sending, handleSendToCashier } = useSendSale({
    requireSudo, ensureSudoCreds, retryEnsurePoste, adNom, adMatricule,
  });

  // ─── Client / lot ───────────────────────────────────────

  const handleSelectClient = (client: Client | null) => {
    cart.setClient(client);
    setClientModalVisible(false);
    setAdFormVisible(client?.client_type === 'PROFESSIONNEL' && (client.ayants_droit ?? []).length === 0);
    setAdNom('');
    setAdMatricule('');
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
  // En-tête compact : sur petits écrans le bouton « Annuler » devient icône seule.
  const compactHeader = useWindowDimensions().width < 560;
  // Densité verticale compacte : sous ~720dp de hauteur, les sections
  // fixes (header, recherche, client, remise, footer) sont resserrées
  // pour laisser un maximum de hauteur à la liste du panier.
  const winHeight = useWindowDimensions().height;
  const compactVert = winHeight < 720;

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

      {/* Barre de recherche */}
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
      {isPro && cart.client && (
        <AyantDroitSection
          client={cart.client}
          compact={compactVert}
          selected={cart.ayantDroit}
          formVisible={adFormVisible}
          nom={adNom}
          matricule={adMatricule}
          onSelectExisting={(ad: AyantDroit) => {
            cart.setAyantDroit(ad);
            setAdFormVisible(false);
            setAdNom('');
            setAdMatricule('');
          }}
          onToggleNew={() => {
            setAdFormVisible(true);
            cart.setAyantDroit(null);
          }}
          onNomChange={setAdNom}
          onMatriculeChange={setAdMatricule}
        />
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

      {/* Modal Client (composant autonome : recherche + création) */}
      <ClientModal
        visible={clientModalVisible}
        onClose={() => setClientModalVisible(false)}
        onSelect={handleSelectClient}
      />
    </View>
  );
}
