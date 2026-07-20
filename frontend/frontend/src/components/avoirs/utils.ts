import type { Avoir } from '../../types';

export type AvoirStatus = Avoir['status'] | 'BROUILLON' | 'BRO' | 'VAL' | 'VALIDE' | 'VALIDÉ' | 'VALIDEE' | 'VALIDÉE';
export type AvoirType = Avoir['type_avoir'] | 'PERIME' | 'PÉRIMÉ' | 'CASSE' | 'CASSÉ' | 'ERREUR_LIVRAISON' | 'ERREUR' | 'AVARIE' | 'NON_FACTURE' | 'AUTRE';

export const normalizeStatus = (status?: string): string => (status || '').toUpperCase();

export const isDraftStatus = (status?: string): boolean => {
  const s = normalizeStatus(status);
  return s === 'BROUILLON' || s === 'BRO';
};

export const isValidStatus = (status?: string): boolean => {
  const s = normalizeStatus(status);
  return ['VAL', 'VALIDE', 'VALIDÉ', 'VALIDEE', 'VALIDÉE'].includes(s);
};

export const getStatusStyle = (status?: string): string => {
  if (isValidStatus(status)) {
    return 'bg-emerald-50 text-emerald-600 border-emerald-200';
  }
  if (isDraftStatus(status)) {
    return 'bg-amber-50 text-amber-600 border-amber-200';
  }
  return 'bg-slate-100 text-slate-500 border-slate-200';
};

export const getStatusLabel = (status: string, t: (key: string) => string): string => {
  if (isDraftStatus(status)) return t('stock:avoirs.statuses.brouillon');
  if (isValidStatus(status)) return t('stock:avoirs.statuses.valide');
  return status;
};

export const getTypeAvoirStyle = (type?: string): string => {
  switch (normalizeStatus(type)) {
    case 'PERIME':
    case 'PÉRIMÉ': return 'bg-red-50 text-red-600 border-red-200';
    case 'CASSE':
    case 'CASSÉ': return 'bg-orange-50 text-orange-600 border-orange-200';
    case 'ERREUR_LIVRAISON':
    case 'ERREUR': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'AVARIE': return 'bg-purple-50 text-purple-600 border-purple-200';
    case 'NON_FACTURE': return 'bg-blue-50 text-blue-600 border-blue-200';
    case 'AUTRE': return 'bg-slate-100 text-slate-500 border-slate-200';
    default: return 'bg-slate-100 text-slate-500 border-slate-200';
  }
};

export const getTypeAvoirLabel = (type: string, t: (key: string) => string): string => {
  switch (normalizeStatus(type)) {
    case 'PERIME':
    case 'PÉRIMÉ': return t('stock:avoirs.types.perime');
    case 'CASSE':
    case 'CASSÉ': return t('stock:avoirs.types.casse');
    case 'ERREUR_LIVRAISON':
    case 'ERREUR': return t('stock:avoirs.types.erreur_livraison');
    case 'AVARIE': return t('stock:avoirs.types.avarie');
    case 'NON_FACTURE': return t('stock:avoirs.types.non_facture');
    case 'AUTRE': return t('stock:avoirs.types.autre');
    default: return type;
  }
};

export const getTypeOptions = (): { value: string; labelKey: string; defaultLabel: string }[] => [
  { value: 'PERIME', labelKey: 'stock:avoirs.types.perime', defaultLabel: 'Périmé' },
  { value: 'CASSE', labelKey: 'stock:avoirs.types.casse', defaultLabel: 'Cassé' },
  { value: 'ERREUR_LIVRAISON', labelKey: 'stock:avoirs.types.erreur_livraison', defaultLabel: 'Erreur livraison' },
  { value: 'AVARIE', labelKey: 'stock:avoirs.types.avarie', defaultLabel: 'Avarie' },
  { value: 'NON_FACTURE', labelKey: 'stock:avoirs.types.non_facture', defaultLabel: 'Non facturé' },
  { value: 'AUTRE', labelKey: 'stock:avoirs.types.autre', defaultLabel: 'Autre' },
];
