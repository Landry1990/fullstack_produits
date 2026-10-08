import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import i18n from '../i18n';
import { useCartStore } from '../stores/useCartStore';
import { useAuthStore } from '../stores/useAuthStore';
import { sendSaleToCaisse, createAyantDroit, tiersPayantSplit, getCaissesOuvertes } from '../services/api';
import { addHistoriqueItem } from '../services/historique';
import { ensureClientDivers } from '../services/clientDivers';
import { drfError } from '../utils/drfError';
import type { SudoOptions } from './useSudo';
import type { PosteVente } from '../types';
import type { ResolutionAction, StockConflict } from '../components/StockResolutionModal';

type RequireSudo = (
  onSuccess: (validatorId: number, password: string) => void | Promise<void>,
  options: SudoOptions
) => void;

interface Options {
  // Validation superviseur — fournie par useSudo de l'écran (propriétaire
  // du SudoModal).
  requireSudo: RequireSudo;
  // Revalidation remise/prix pour un brouillon restauré (creds jamais
  // persistés) — fonction de l'écran qui partage les mêmes creds.
  ensureSudoCreds: (after: () => void) => void;
  // Réouverture de poste — l'écran garde alertes + sélecteur
  // (PostePickerModal).
  retryEnsurePoste: (silent?: boolean) => Promise<PosteVente | null>;
  // Champs du formulaire « + Nouveau » ayant droit (état de l'écran).
  adNom: string;
  adMatricule: string;
}

// Flux complet d'envoi en caisse : revalidation Sudo (prix/remise d'un
// brouillon), forçage de stock supervisé, résolution/création de l'ayant
// droit, poste de vente actif, sendSaleToCaisse avec retry 400/403,
// historique local puis clear + re-sélection du client « comptoir ».
export function useSendSale({
  requireSudo, ensureSudoCreds, retryEnsurePoste, adNom, adMatricule,
}: Options) {
  const cart = useCartStore();
  const { posteVente, setPosteVente } = useAuthStore();
  const [sending, setSending] = useState(false);
  // Choix de caisse en multi-caisses : les postes ouverts rattachés à
  // une caisse physique sont affichés dans CaissePickerModal (état non
  // null = modal visible). Le choix est gardé dans un ref : les ré-envois
  // internes (retry poste, sudo stock) ne re-demandent pas la caisse.
  const [caisseChoices, setCaisseChoices] = useState<PosteVente[] | null>(null);
  const caisseCibleRef = useRef<number | null>(null);
  // Ruptures à résoudre à l'envoi : non null = StockResolutionModal ouvert.
  const [stockConflicts, setStockConflicts] = useState<StockConflict[] | null>(null);

  // Ayant droit obligatoire pour client PRO : sélection existante, ou
  // création/matching sur le matricule avant l'envoi.
  const resolveAyantDroit = async (): Promise<boolean> => {
    const client = cart.client;
    if (client?.client_type !== 'PROFESSIONNEL') return true;
    if (cart.ayantDroit) return true;

    const nom = adNom.trim();
    const matricule = adMatricule.trim();
    if (!nom || !matricule) {
      Alert.alert(i18n.t('ayantDroit.required_title'), i18n.t('ayantDroit.required_msg'));
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
      Alert.alert(i18n.t('common.error'), drfError((err as { response?: { data?: unknown } })?.response?.data, i18n.t('ayantDroit.create_error')));
      return false;
    }
  };

  // Plafond de crédit (client pro) — même règle que le web
  // (validateClientCreditLimit) : seule la part « en compte » du tiers
  // payant compte comme nouvelle dette, la part patient étant encaissée
  // en caisse. plafond = -1 → crédit illimité. Le backend refait le
  // contrôle (sur des données fraîches) — ici on bloque avant toute
  // saisie d'ayant droit ou de Sudo.
  const checkCreditLimit = (): boolean => {
    const client = cart.client;
    if (client?.client_type !== 'PROFESSIONNEL') return true;
    const plafond = Number(client.plafond ?? -1);
    if (plafond === -1) return true;
    const { partAssurance } = tiersPayantSplit(
      cart.totalTTC(),
      parseFloat(client.taux_couverture ?? '0') || 0
    );
    const debt = Number(client.current_debt ?? 0);
    if (debt + partAssurance > plafond + 0.5) {
      Alert.alert(
        i18n.t('facturation.credit_title'),
        i18n.t('facturation.credit_msg', {
          debt: Math.round(debt).toLocaleString('fr-FR'),
          increment: Math.round(partAssurance).toLocaleString('fr-FR'),
          total: Math.round(debt + partAssurance).toLocaleString('fr-FR'),
          plafond: Math.round(plafond).toLocaleString('fr-FR'),
        })
      );
      return false;
    }
    return true;
  };

  // Déficit réel d'une ligne : quantité facturée − part déjà « promis ».
  // Même règle que le backend (_check_stock : stock < effective_qty).
  const lineDeficit = (l: { quantite: number; promisQuantity?: number; product: { stock?: number } }) => {
    const eff = l.quantite - (l.promisQuantity ?? 0);
    return eff > 0 && (l.product.stock ?? 0) < eff;
  };

  // Résolution des ruptures à l'envoi — parité avec le StockResolutionModal
  // web : par ligne en déficit, « Promis » (part manquante due au client,
  // livrée à la prochaine réception — sans sudo), « Réduire » (qté ramenée
  // au stock) ou « Forcer » (sudo can_sell_negative_stock). Le backend
  // reste source de vérité : un stock devenu insuffisant entre-temps est
  // rattrapé par le retry 403 dans sendToCashier.
  const ensureStockResolution = (after: () => void) => {
    const state = useCartStore.getState();
    // Promis devenus inutiles : le stock couvre désormais toute la ligne
    // (quantité baissée, réception entre-temps, brouillon restauré).
    for (const l of state.lines) {
      if (l.isPromis && l.quantite <= Math.max(0, l.product.stock ?? 0)) {
        state.clearLinePromis(l.product.id);
      }
    }
    const conflicts = useCartStore.getState().lines.filter(lineDeficit);
    if (conflicts.length === 0) { after(); return; }
    setStockConflicts(conflicts.map((l) => ({
      product: l.product,
      quantity: l.quantite,
      stock: l.product.stock,
    })));
  };

  // Confirmation du modal : applique l'action choisie à chaque ligne puis
  // envoie — avec validation superviseur si une ligne reste forcée.
  const confirmStockResolution = (actions: Record<number, ResolutionAction>, phone: string) => {
    const conflicts = stockConflicts ?? [];
    setStockConflicts(null);
    const state = useCartStore.getState();
    for (const c of conflicts) {
      const action = actions[c.product.id] ?? 'promis';
      const stock = Math.max(0, c.stock);
      if (action === 'promis') {
        state.setLinePromis(c.product.id, c.quantity - stock, phone);
      } else if (action === 'reduce') {
        state.updateQty(c.product.id, stock); // 0 → ligne retirée
      }
      // 'force' : ligne inchangée — exigera la validation superviseur.
    }
    const fresh = useCartStore.getState();
    if (fresh.lines.length === 0) return;
    const needsForceSudo = fresh.lines.some(lineDeficit);
    if (!needsForceSudo || fresh.stockSudoCreds) {
      void sendToCashier();
      return;
    }
    requireSudo(async (validatorId, password) => {
      useCartStore.getState().setStockSudoCreds({ validatorId, password });
      void sendToCashier();
    }, {
      title: i18n.t('sudo.stock_title'),
      message: i18n.t('sudo.stock_msg_generic'),
      permission: 'can_sell_negative_stock',
    });
  };

  const cancelStockResolution = () => setStockConflicts(null);

  const handleSendToCashier = () => {
    if (cart.lines.length === 0) {
      Alert.alert(i18n.t('facturation.empty_title'), i18n.t('facturation.empty_add'));
      return;
    }
    if (!checkCreditLimit()) return;
    // Nouvel envoi utilisateur → nouveau choix de caisse éventuel.
    caisseCibleRef.current = null;
    ensureSudoCreds(() => ensureStockResolution(() => { void sendToCashier(); }));
  };

  // Caisse choisie dans CaissePickerModal → reprend l'envoi.
  const pickCaisse = (poste: PosteVente) => {
    setCaisseChoices(null);
    caisseCibleRef.current = poste.caisse ?? null;
    void sendToCashier();
  };
  const closeCaissePicker = () => setCaisseChoices(null);

  const sendToCashier = async () => {
    setSending(true);
    try {
      // L'AD est créé AVANT l'appel finaliser : si l'envoi échoue ensuite,
      // l'AD reste sélectionné et le matching matricule évite le doublon.
      if (!(await resolveAyantDroit())) return;

      let poste = posteVente ?? (await retryEnsurePoste(true));
      if (!poste) {
        Alert.alert(i18n.t('poste.required_title'), i18n.t('poste.required_msg'));
        return;
      }

      // Caisse destinataire : 0 ouverte → erreur claire sans aller-retour
      // inutile ; 1 → directe ; >1 → sélecteur (le backend routait sinon
      // tout sur la dernière caisse ouverte, sans choix vendeur).
      if (caisseCibleRef.current == null) {
        let caisses: PosteVente[] | null = null;
        try {
          caisses = await getCaissesOuvertes();
        } catch { /* réseau : on laisse le backend décider/répondre */ }
        if (caisses !== null && caisses.length === 0) {
          Alert.alert(i18n.t('common.error'), i18n.t('send.no_caisse_open'));
          return;
        }
        if (caisses && caisses.length > 1) {
          setCaisseChoices(caisses);
          return;
        }
        caisseCibleRef.current = caisses?.[0]?.caisse ?? null;
      }

      // getState() : le `cart` du hook peut être un snapshot périmé après
      // le modal de résolution ou un retry Sudo — le payload et
      // l'historique doivent refléter le panier effectivement envoyé.
      const sentCart = useCartStore.getState();
      let facture;
      try {
        facture = await sendSaleToCaisse(sentCart, poste.id, caisseCibleRef.current);
      } catch (err: unknown) {
        // Poste fermé entre-temps (caisse web) → une seule réouverture + renvoi.
        const detail = (err as { response?: { status?: number; data?: { detail?: string } } })
          ?.response?.data?.detail;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 400 && detail?.toLowerCase().includes('point de vente')) {
          setPosteVente(null);
          poste = await retryEnsurePoste(true);
          if (!poste) {
            Alert.alert(i18n.t('poste.required_title'), i18n.t('poste.required_msg'));
            return;
          }
          facture = await sendSaleToCaisse(useCartStore.getState(), poste.id, caisseCibleRef.current);
        } else if (status === 403 && detail?.includes('can_sell_negative_stock') && !useCartStore.getState().stockSudoCreds) {
          // Stock insuffisant non anticipé (stock local périmé) →
          // validation superviseur puis ré-envoi complet avec les creds
          // dans le bloc sudo du payload.
          requireSudo(async (validatorId, password) => {
            useCartStore.getState().setStockSudoCreds({ validatorId, password });
            void sendToCashier();
          }, {
            title: i18n.t('sudo.stock_title'),
            message: i18n.t('sudo.stock_msg_generic'),
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
        articles_count: sentCart.totalArticles(),
        total_estime: sentCart.totalTTC(),
        client: sentCart.client?.name ?? null,
        remise_globale: sentCart.remiseGlobaleMontant(),
        lignes: sentCart.lines.map((l) => ({
          name: l.product.name,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
          remise: l.remise,
          total_ttc: l.total_ttc,
        })),
      });
      Alert.alert(i18n.t('send.success_title'), i18n.t('send.success_msg', { numero: facture?.numero_facture ?? '' }));
      cart.clear();
      // Comme le web (_resetSaleDataOnly) : le client « comptoir » est
      // re-sélectionné pour la vente suivante (cache session).
      void ensureClientDivers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
      const detail = axiosErr.response?.data?.detail;
      const msg = detail
        || (axiosErr.message?.includes('timeout') ? i18n.t('send.error_timeout') : i18n.t('send.error_generic'));
      Alert.alert(i18n.t('common.error'), msg);
    } finally {
      setSending(false);
    }
  };

  return {
    sending, handleSendToCashier,
    caisseChoices, pickCaisse, closeCaissePicker,
    stockConflicts, confirmStockResolution, cancelStockResolution,
  };
}
