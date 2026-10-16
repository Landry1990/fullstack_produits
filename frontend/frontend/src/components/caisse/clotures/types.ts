/**
 * Types partagés de l'écran Historique des clôtures de caisse.
 * Extraits de `components/HistoriqueClotures.tsx` — aucun changement de forme.
 */

export interface DetailsPaiement {
  [mode: string]: string | number | undefined
}

export interface DetailsMeta {
  total_ca_pharmacie?: number
  total_ca_divers?: number
}

export interface BilletageData {
  billets?: Record<string, number>
  pieces?: Record<string, number>
  orange_money?: number
  mtn_momo?: number
  total?: number
}

export interface ClotureCaisse {
  id: number
  date: string
  montant_reel: string
  montant_theorique: string
  ecart_caisse: string
  total_ventes: string | number
  total_entrees: string | number
  total_sorties: string | number
  details_paiement: DetailsPaiement
  poste_caisse_nom?: string
  date_debut: string | null
  date_fin: string | null
  user: number | null
  user_name: string
  cloture_par_name?: string
  username: string
  observation: string | null
  billetage?: BilletageData | null
}

export interface SessionCaisse {
  id: number
  poste: number
  poste_nom: string
  ouvert_par: number | null
  ouvert_par_name: string
  fond_de_caisse: string | null
  date_ouverture: string
  date_fermeture: string | null
  montant_total_encaisse: string | null
  est_active: boolean
  est_actif: boolean
  ventilation_paiements: Record<string, number>
}

/** Agrégat journalier calculé côté frontend (vue "Par jour"). */
export interface DailyAggregate {
  date: string
  count: number
  montant_theorique: number
  montant_reel: number
  ecart_caisse: number
  total_ventes: number
  total_entrees: number
  total_sorties: number
}

export interface ClotureUserOption {
  id: string | number
  username: string
  first_name?: string
  last_name?: string
}

export interface PosteCaisseOption {
  id: string | number
  nom: string
}

export type CloturesTab = 'clotures' | 'sessions'
export type CloturesViewMode = 'list' | 'daily'
export type CloturesGlobalTotals = Record<string, string | number>
