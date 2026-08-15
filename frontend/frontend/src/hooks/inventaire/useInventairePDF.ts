import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { Inventaire } from '../../types';

// PDF Export capabilities extracted from Inventaire.tsx

export const useInventairePDF = () => {
  const { t } = useTranslation('common');

  const generateEtatPDF = (activeInventaire: Inventaire, groupBy: string = 'rayon') => {
    if (!activeInventaire?.id) return;
    const w = window.open(`/app/printing/${activeInventaire.id}?type=INVENTAIRE_TAKE&group_by=${groupBy}`, '_blank');
    if (!w) toast.error(t('popup_blocked'));
  };

  const generateEcartsPDF = (activeInventaire: Inventaire, groupBy: string = 'rayon') => {
    if (!activeInventaire?.id) return;
    const w = window.open(`/app/printing/${activeInventaire.id}?type=INVENTAIRE_REPORT&group_by=${groupBy}`, '_blank');
    if (!w) toast.error(t('popup_blocked'));
  };

  return {
    generateEtatPDF,
    generateEcartsPDF
  };
};
