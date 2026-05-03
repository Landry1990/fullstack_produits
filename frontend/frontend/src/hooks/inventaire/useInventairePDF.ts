import type { Inventaire } from '../../types';

// PDF Export capabilities extracted from Inventaire.tsx

export const useInventairePDF = () => {

    const generateEtatPDF = (activeInventaire: Inventaire, groupBy: string = 'rayon') => {
        if (!activeInventaire?.id) return;
        window.open(`/app/printing/${activeInventaire.id}?type=INVENTAIRE_TAKE&group_by=${groupBy}`, '_blank');
    };

    const generateEcartsPDF = (activeInventaire: Inventaire, groupBy: string = 'rayon') => {
        if (!activeInventaire?.id) return;
        window.open(`/app/printing/${activeInventaire.id}?type=INVENTAIRE_REPORT&group_by=${groupBy}`, '_blank');
    };

    return {
        generateEtatPDF,
        generateEcartsPDF
    };
};
