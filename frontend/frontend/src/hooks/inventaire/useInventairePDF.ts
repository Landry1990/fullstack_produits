import type { Inventaire } from '../../types';

// PDF Export capabilities extracted from Inventaire.tsx

export const useInventairePDF = () => {

    const generateEtatPDF = (activeInventaire: Inventaire) => {
        if (!activeInventaire?.id) return;
        window.open(`/app/printing/${activeInventaire.id}?type=INVENTAIRE_TAKE`, '_blank');
    };

    const generateEcartsPDF = (activeInventaire: Inventaire) => {
        if (!activeInventaire?.id) return;
        window.open(`/app/printing/${activeInventaire.id}?type=INVENTAIRE_REPORT`, '_blank');
    };

    return {
        generateEtatPDF,
        generateEcartsPDF
    };
};
