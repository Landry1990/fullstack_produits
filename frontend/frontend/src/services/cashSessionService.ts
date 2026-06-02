import api from './api'

export interface PosteCaisse {
  id: number
  nom: string
  code: string
  est_ouvert: boolean
  fond_de_caisse: string | null
  session_active?: {
    id: number
    fond_de_caisse: string | null
    date_ouverture: string
    ouvert_par_name: string | null
  } | null
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
  async getActivePostes(): Promise<PosteCaisse[]> {
    const { data } = await api.get('postes-caisses/active/')
    return data
  },

  async getAllPostes(): Promise<PosteCaisse[]> {
    const { data } = await api.get('postes-caisses/')
    return data.results || data
  },

  async openPoste(posteId: number, fondDeCaisse?: string): Promise<PosteCaisse> {
    const { data } = await api.post(`postes-caisses/${posteId}/ouvrir/`, {
      fond_de_caisse: fondDeCaisse
    })
    return data
  },

  async closePoste(posteId: number): Promise<PosteCaisse> {
    const { data } = await api.post(`postes-caisses/${posteId}/fermer/`)
    return data
  },

  async getMyActiveSessions(): Promise<PosteCaisse[]> {
    const { data } = await api.get('postes-caisses/mes_actives/')
    return data
  },

  async getActiveSessions(): Promise<SessionCaisse[]> {
    const { data } = await api.get('sessions-caisses/actives/')
    return data
  }
}
