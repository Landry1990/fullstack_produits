import api from './api'

export interface PosteCaisse {
  id: number
  nom: string
  code: string
  est_actif?: boolean
}

export interface PosteVente {
  id: number
  nom: string
  caisse: number | null
  caisse_nom: string | null
  caisse_code: string | null
  vendeur: number | null
  vendeur_name: string | null
  fond_de_caisse: string | null
  date_ouverture: string | null
  date_fermeture: string | null
  montant_total_encaisse: string | null
  est_actif: boolean
  mode_pos?: boolean
  created_at: string
  updated_at: string
}

export interface PosteVenteCreateData {
  nom: string
}

export interface SessionCaisse {
  id: number
  poste: number
  poste_nom: string
  ouvert_par: number | null
  ouvert_par_name: string | null
  fond_de_caisse: string | null
  date_ouverture: string
  date_fermeture: string | null
  montant_total_encaisse: string | null
  est_active: boolean
}

export const cashSessionService = {
  // --- Caisses physiques ---
  async getAllCaisses(): Promise<PosteCaisse[]> {
    const { data } = await api.get('postes-caisses/')
    return data.results || data
  },

  async createCaisse(nom: string, code: string): Promise<PosteCaisse> {
    const { data } = await api.post('postes-caisses/', { nom, code })
    return data
  },

  // --- Postes de vente ---
  async getActivePostesVente(): Promise<PosteVente[]> {
    const { data } = await api.get('postes-ventes/actives/')
    return data
  },

  async getMyActivePostesVente(): Promise<PosteVente[]> {
    const { data } = await api.get('postes-ventes/mes_actives/')
    return data
  },

  async getCaissesDisponibles(): Promise<PosteCaisse[]> {
    const { data } = await api.get('postes-ventes/postes_caisses_disponibles/')
    return data
  },

  async openPosteVente(caisseId: number, fondDeCaisse?: string): Promise<PosteVente> {
    const { data } = await api.post(`postes-ventes/${caisseId}/ouvrir/`, {
      fond_de_caisse: fondDeCaisse
    })
    return data
  },

  async createPosteVente(payload: PosteVenteCreateData): Promise<PosteVente> {
    const { data } = await api.post('postes-ventes/', payload)
    return data
  },

  async getPostesVenteDisponibles(): Promise<PosteVente[]> {
    const { data } = await api.get('postes-ventes/disponibles/')
    return data
  },

  async getAllPostesVente(): Promise<PosteVente[]> {
    const { data } = await api.get('postes-ventes/tous_postes/')
    return data
  },

  async activerPosteVente(posteVenteId: number, fondDeCaisse?: string): Promise<PosteVente> {
    const { data } = await api.post(`postes-ventes/${posteVenteId}/activer/`, {
      fond_de_caisse: fondDeCaisse
    })
    return data
  },

  async deletePosteVente(posteVenteId: number): Promise<void> {
    await api.delete(`postes-ventes/${posteVenteId}/`)
  },

  async getPostesVente(): Promise<PosteVente[]> {
    const { data } = await api.get('postes-ventes/')
    return data.results || data
  },

  async forcerFermeturePosteVente(posteVenteId: number): Promise<any> {
    const { data } = await api.post(`postes-ventes/${posteVenteId}/forcer-fermeture/`)
    return data
  },

  async closePosteVente(posteVenteId: number, hideAmounts: boolean = false): Promise<any> {
    const { data } = await api.post(`postes-ventes/${posteVenteId}/fermer/`, {
      hide_amounts: hideAmounts
    })
    return data
  },

  async getRecapSession(): Promise<any> {
    const { data } = await api.get('postes-ventes/recap_session/')
    return data
  },

  // --- Legacy sessions (lecture seule) ---
  async getActiveSessions(): Promise<SessionCaisse[]> {
    const { data } = await api.get('sessions-caisses/actives/')
    return data
  },

  async getMyActiveSessions(): Promise<SessionCaisse[]> {
    const { data } = await api.get('sessions-caisses/mes_sessions/')
    return data
  }
}
