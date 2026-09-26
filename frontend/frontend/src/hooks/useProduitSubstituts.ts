import { useQuery } from '@tanstack/react-query';
import i18n from '../i18n';
import api from '../services/api';
import type { ProduitModel } from '../types/catalog';

export interface SubstitutsResponse {
  substituts: ProduitModel[];
  dci: string | null;
  count: number;
  message?: string;
}

export function useProduitSubstituts(produitId: number | null) {
  return useQuery<SubstitutsResponse>({
    queryKey: ['produit-substituts', produitId],
    queryFn: async () => {
      if (!produitId) throw new Error(i18n.t('products:detail.none_selected', { defaultValue: 'Aucun produit sélectionné' }));
      const response = await api.get<SubstitutsResponse>(`produits/${produitId}/substituts/`);
      return response.data;
    },
    enabled: !!produitId,
    staleTime: 1000 * 60 * 2,
  });
}
