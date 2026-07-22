import { toast } from 'react-hot-toast';
import type { Inventaire } from '../../types';

// PDF Export capabilities extracted from Inventaire.tsx

const generateEtatPDF = (activeInventaire: Inventaire, groupBy: string = 'rayon') => {
    if (!activeInventaire?.id) return;
    const w = window.open(`/app/printing/${activeInventaire.id}?type=INVENTAIRE_TAKE&group_by=${groupBy}`, '_blank');
    if (!w) toast.error('Popup bloqué. Autorisez les popups pour imprimer.');
};

const generateEcartsPDF = (activeInventaire: Inventaire, groupBy: string = 'rayon') => {
    if (!activeInventaire?.id) return;
    const w = window.open(`/app/printing/${activeInventaire.id}?type=INVENTAIRE_REPORT&group_by=${groupBy}`, '_blank');
    if (!w) toast.error('Popup bloqué. Autorisez les popups pour imprimer.');
};

export const useInventairePDF = () => {
    return {
        generateEtatPDF,
        generateEcartsPDF
    };
};
