import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator,
  Platform, ScrollView,
} from 'react-native';
import { Search, Send, Trash2, User, ArrowLeft, ScanBarcode, ShieldCheck, Store } from 'lucide-react-native';
import { useCartStore } from '../stores/useCartStore';
import { useAuthStore } from '../stores/useAuthStore';
import {
  searchProducts, searchClients, sendSaleToCaisse, getProductByBarcode,
  getProductById, getLotByDatamatrix, createClient, createAyantDroit,
  ensurePosteVente,
} from '../services/api';
import { parseGS1Datamatrix } from '../utils/gs1Parser';
import { useSudo } from '../hooks/useSudo';
import { ProductRow } from '../components/ProductRow';
import { CartItemRow } from '../components/CartItemRow';
import { LotModal } from '../components/LotModal';
import { ScanBarcodeModal } from '../components/ScanBarcodeModal';
import { SudoModal } from '../components/SudoModal';
import { LineEditModal } from '../components/LineEditModal';
import type { Product, StockLot, Client, CartLine, AyantDroit, ScanResult } from '../types';

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

export function FacturationScreen({ onLogout }: { onLogout: () => void }) {
  const cart = useCartStore();
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
            <User size={16} color="#94a3b8" />
            <Text style={styles.userText}>{username}</Text>
          </View>
          <TouchableOpacity style={styles.userBadge} onPress={() => retryEnsurePoste()} disabled={ensuringPoste}>
            {ensuringPoste ? (
              <ActivityIndicator size="small" color="#94a3b8" />
            ) : (
              <Store size={16} color={posteVente ? '#10b981' : '#64748b'} />
            )}
            <Text style={[styles.userText, !posteVente && { color: '#64748b' }]}>
              {posteVente?.nom ?? 'Aucun point de vente'}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <ArrowLeft size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Split vertical */}
      <View style={styles.split}>
        {/* Gauche : Recherche + Produits */}
        <View style={styles.leftPanel}>
          <View style={styles.searchBar}>
            <Search size={18} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher produit..."
              placeholderTextColor="#64748b"
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
                <ScanBarcode size={20} color="#10b981" />
              </TouchableOpacity>
            )}
          </View>

          {searching ? (
            <ActivityIndicator color="#6366f1" style={{ marginVertical: 20 }} />
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
              <User size={16} color="#64748b" />
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
                    placeholderTextColor="#64748b"
                    value={adNom}
                    onChangeText={setAdNom}
                    autoCapitalize="characters"
                  />
                  <TextInput
                    style={styles.adInput}
                    placeholder="Matricule"
                    placeholderTextColor="#64748b"
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
                  placeholderTextColor="#64748b"
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
                    <ShieldCheck size={12} color="#10b981" />
                    <Text style={styles.sudoBadgeText}>Validé par superviseur</Text>
                  </View>
                )}
              </View>
              <Text style={styles.total}>{cart.totalTTC().toLocaleString('fr-FR')} F</Text>
            </View>
            <View style={styles.footerActions}>
              <TouchableOpacity onPress={cart.clear} style={styles.clearBtn}>
                <Trash2 size={18} color="#ef4444" />
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
                  placeholderTextColor="#64748b"
                  value={newClientName}
                  onChangeText={(t) => { setNewClientName(t); setClientFormError(null); }}
                  autoFocus
                />
                <Text style={styles.formLabel}>Téléphone</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Optionnel"
                  placeholderTextColor="#64748b"
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
                  placeholderTextColor="#64748b"
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
                  <ActivityIndicator color="#6366f1" style={{ marginVertical: 20 }} />
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
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  userText: { fontSize: 13, color: '#f1f5f9', fontWeight: '600' },
  logoutBtn: { padding: 6 },
  split: { flex: 1, flexDirection: 'row' },
  leftPanel: { flex: 1, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)', padding: 12 },
  rightPanel: { flex: 1, padding: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  searchInput: { flex: 1, marginLeft: 8, color: '#f1f5f9', fontSize: 14 },
  scanBtn: { padding: 6, marginLeft: 4 },
  list: { paddingBottom: 12 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 24, fontSize: 13 },
  clientBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  clientBtnMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  clientText: { fontSize: 13, color: '#f1f5f9' },
  clientClear: { fontSize: 14, color: '#64748b', paddingLeft: 8 },
  adBlock: { marginBottom: 12 },
  adLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 },
  adChips: { flexDirection: 'row', gap: 6 },
  adChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  adChipSelected: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: '#10b981' },
  adChipText: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  adChipTextSelected: { color: '#10b981' },
  adForm: { flexDirection: 'row', gap: 8, marginTop: 8 },
  adInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#f1f5f9',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cartList: { flex: 1, paddingBottom: 12 },
  emptyCart: { textAlign: 'center', color: '#64748b', marginTop: 24, fontSize: 13 },
  cartFooter: { backgroundColor: '#1e293b', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  remiseRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  remiseLabel: { fontSize: 12, color: '#94a3b8', flex: 1 },
  remiseControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  remiseInput: {
    width: 64,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#f1f5f9',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    textAlign: 'right',
  },
  remiseToggle: { flexDirection: 'row', borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  remiseModeBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#0f172a' },
  remiseModeBtnActive: { backgroundColor: '#6366f1' },
  remiseModeText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  remiseModeTextActive: { color: '#fff' },
  remiseAmount: { fontSize: 12, fontWeight: '700', color: '#10b981', minWidth: 60, textAlign: 'right' },
  totals: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  articles: { fontSize: 12, color: '#64748b' },
  sousTotal: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  sudoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  sudoBadgeText: { fontSize: 10, color: '#10b981', fontWeight: '600' },
  total: { fontSize: 18, fontWeight: '700', color: '#10b981' },
  footerActions: { flexDirection: 'row', gap: 8 },
  clearBtn: { padding: 10, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 8 },
  sendBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6366f1', borderRadius: 8, paddingVertical: 12 },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalSheet: { backgroundColor: '#1e293b', borderRadius: 16, width: '100%', maxWidth: 400, maxHeight: '80%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#f1f5f9' },
  modalClose: { fontSize: 18, color: '#64748b' },
  modalInput: { backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#f1f5f9', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 12 },
  modalList: { maxHeight: 300 },
  clientItem: { padding: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, marginBottom: 4 },
  clientItemName: { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  clientItemPhone: { fontSize: 12, color: '#64748b', marginTop: 2 },
  newClientBtn: { marginBottom: 10 },
  newClientText: { fontSize: 13, color: '#10b981', fontWeight: '700' },
  formLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 },
  formError: { color: '#ef4444', fontSize: 12, marginBottom: 8 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  formBackBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)' },
  formBackText: { color: '#f1f5f9', fontWeight: '600', fontSize: 14 },
  formCreateBtn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 8, backgroundColor: '#10b981', minWidth: 90, alignItems: 'center' },
  formCreateText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
