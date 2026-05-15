import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export interface Substance {
  id: number;
  nom: string;
  code_cas: string | null;
  produits_count: number;
}

export interface SubstancesResponse {
  results: Substance[];
  count: number;
  next: string | null;
  previous: string | null;
}

export function useSubstances(params: { search?: string; page?: number } = {}) {
  return useQuery<SubstancesResponse>({
    queryKey: ['substances', params],
    queryFn: async () => {
      const response = await api.get<SubstancesResponse>('substances/', { params });
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useSubstanceProduits(substanceId: number | null) {
  return useQuery<any>({
    queryKey: ['substance-produits', substanceId],
    queryFn: async () => {
      if (!substanceId) return { results: [] };
      const response = await api.get(`produits/?substances=${substanceId}`);
      return response.data;
    },
    enabled: !!substanceId,
  });
}
