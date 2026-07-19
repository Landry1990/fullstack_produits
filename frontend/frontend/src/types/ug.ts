export interface UGDetail {
  lot_id: number;
  lot_numero: string;
  produit_nom: string;
  date_reception: string | null;
  commande_numero: string;
  facture_numero: string;
  quantity_free: number;
  quantity_free_remaining: number;
  valeur_estimee: number;
  valeur_restante: number;
  prix_vente: number;
}

export interface FournisseurUGStat {
  fournisseur_id: number;
  fournisseur_nom: string;
  total_ug: number;
  total_ug_restantes: number;
  total_valeur: number;
  total_valeur_restante: number;
  lots_count: number;
  details: UGDetail[];
}

export interface UGReportData {
  global_total_ug: number;
  global_total_ug_restantes: number;
  global_total_valeur: number;
  global_total_valeur_restante: number;
  fournisseurs: FournisseurUGStat[];
}
