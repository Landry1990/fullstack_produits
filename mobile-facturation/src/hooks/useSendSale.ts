import { useState } from 'react';
import { Alert } from 'react-native';
import { useCartStore } from '../stores/useCartStore';
import { useAuthStore } from '../stores/useAuthStore';
import { sendSaleToCaisse, createAyantDroit } from '../services/api';
import { addHistoriqueItem } from '../services/historique';
import { ensureClientDivers } from '../services/clientDivers';
import { drfError } from '../utils/drfError';
import type { SudoOptions } from './useSudo';
import type { PosteVente } from '../types';

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

const POSTE_REQUIS = "Aucun point de vente actif. Touchez le nom du poste affiché en haut pour réessayer ou demandez à l'administrateur d'en créer un.";

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
        Alert.alert('Point de vente requis', POSTE_REQUIS);
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
            Alert.alert('Point de vente requis', POSTE_REQUIS);
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

  return { sending, handleSendToCashier };
}
