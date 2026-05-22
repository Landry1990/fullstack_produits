/**
 * Utilitaires de conversion entre format PDA et format Facturation
 */
import type { LigneFacture, Client, AyantDroit } from '../types';

interface PDAArticle {
  produit_id: number;
  code_barre: string;
  designation: string;
  quantite: number;
  prix_unitaire: string;
  remise_produit: string;
  tva: string;
  total_ht: string;
  total_ttc: string;
}

interface PDAClient {
  id: number;
  name: string;
  phone?: string;
}

interface PDAAyantDroit {
  id: number;
  nom: string;
  prenom: string;
  numero_carte: string;
  taux_couverture: number;
  societe?: string;
}

interface PDAItem {
  pda_id: string;
  item_id: string;
  articles: PDAArticle[];
  client?: PDAClient;
  ayant_droit?: PDAAyantDroit;
  total_estime: string;
  articles_count: number;
}

/**
 * Convertit un article PDA en LigneFacture
 * Note: Le produit est incomplet (pas toutes les données du serveur),
 * on crée un produit minimal pour le panier
 */
export function convertPDArticleToLigneFacture(pdaArticle: PDAArticle): LigneFacture {
  // Calculer le total de la ligne
  const prix = parseFloat(pdaArticle.prix_unitaire) || 0;
  const remise = parseFloat(pdaArticle.remise_produit) || 0;
  const qty = pdaArticle.quantite;
  const prixRemise = prix * (1 - remise / 100);
  const totalLigne = prixRemise * qty;

  // Créer un produit minimal avec les données disponibles
  const minimalProduit = {
    id: pdaArticle.produit_id,
    name: pdaArticle.designation,
    code_barre: pdaArticle.code_barre,
    designation: pdaArticle.designation,
    selling_price: pdaArticle.prix_unitaire,
    prix_vente: parseFloat(pdaArticle.prix_unitaire),
    // La TVA est dans le produit
    tva: pdaArticle.tva,
    // Champs obligatoires mais non fournis par PDA
    category: null as any,
    fournisseur: null as any,
    stock: 0,
    is_active: true,
  };

  return {
    produit: minimalProduit as any, // Cast car incomplet
    quantite: pdaArticle.quantite,
    prix_unitaire: pdaArticle.prix_unitaire,
    remise_produit: pdaArticle.remise_produit,
    total_ligne: totalLigne,
  };
}

/**
 * Convertit un client PDA en format Client
 */
export function convertPDAClientToClient(pdaClient: PDAClient): Client {
  return {
    id: pdaClient.id,
    name: pdaClient.name,
    phone: pdaClient.phone,
    // Champs par défaut
    email: '',
    type_reglement: 'FACTURE',
    delai_paiement_jours: 0,
    has_credit: false,
    solde_dette: '0',
    // Champs optionnels du type Client
    address: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Client;
}

/**
 * Convertit un ayant droit PDA en format AyantDroit
 */
export function convertPDAAyantDroitToAyantDroit(
  pdaAyantDroit: PDAAyantDroit
): AyantDroit {
  return {
    id: pdaAyantDroit.id,
    matricule: pdaAyantDroit.numero_carte, // Mapping numero_carte -> matricule
    nom: pdaAyantDroit.nom,
    societe: pdaAyantDroit.societe,
    client: undefined, // Sera défini lors de la liaison
    date_creation: new Date().toISOString(),
  };
}

/**
 * Convertit une vente PDA complète en paramètres pour le panier
 */
export function convertPDAItemToCartParams(pdaItem: PDAItem) {
  return {
    lignes: pdaItem.articles.map(convertPDArticleToLigneFacture),
    client: pdaItem.client ? convertPDAClientToClient(pdaItem.client) : null,
    ayantDroit: pdaItem.ayant_droit 
      ? convertPDAAyantDroitToAyantDroit(pdaItem.ayant_droit) 
      : null,
    pdaSource: {
      pdaId: pdaItem.pda_id,
      itemId: pdaItem.item_id,
    },
  };
}
