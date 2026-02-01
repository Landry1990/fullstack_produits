import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Printer } from 'lucide-react';
import { Facture } from '../../../types';
import { TicketTemplate } from '../../printing/TicketTemplate';
import { usePharmacySettings } from '../../../hooks/usePharmacySettings';

interface TicketPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    facture: Facture | null;
}

export const TicketPreviewModal: React.FC<TicketPreviewModalProps> = ({
    isOpen,
    onClose,
    facture
}) => {
    const { t } = useTranslation();
    const { settings } = usePharmacySettings();
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Effect to render ticket into iframe
    useEffect(() => {
        if (isOpen && facture && iframeRef.current && settings) {
            const iframe = iframeRef.current;
            const doc = iframe.contentDocument;
            
            if (doc) {
                // Generer le HTML
                // Note: TicketTemplate is a React component. 
                // We typically need to render it. But Ventes.tsx logic was:
                // It opens a new Window actually.
                // Wait, checking Ventes.tsx logic for handleOpenTicketPreview
                /*
                  const handlePrintTicket = () => {
                        const printWindow = window.open('', '', 'width=300,height=600');
                        ...
                        printWindow.document.write(renderToStaticMarkup(...));
                  }
                */
               // The original code used a state `showTicketPreview`? No, let me check Ventes.tsx.
               // Ventes.tsx had `handleOpenTicketPreview` which opens a POPUP WINDOW directly.
               // It did NOT have a modal for preview inside the page?
               // Let me check my previous file outline.
               // "Ventes.handleOpenTicketPreview" outline item.
            }
        }
    }, [isOpen, facture, settings]);

    // If Ventes.tsx was opening a new window immediately, maybe we don't need a React Modal?
    // User requested "Refactor Ventes.tsx".
    // If the original logic was just a function that opens a window, we should keep it as a function in the hook.
    // However, if we want a *Modal Preview* instead of a popup window, we can implement it here.
    // But to respect "Refactor" without "Feature Change", I should probably stick to previous behavior.
    
    // BUT, if I look at `Ventes.tsx` imports in the outline, I see `TicketTemplate`.
    // It's likely used inside `handleOpenTicketPreview`.
    
    // Decision: If the original code didn't have a specific React Modal for ticket preview (just browser window),
    // then this component might be redundant or a new feature.
    
    // Let's assume for now we keep the "pop-up window" logic in the HOOK `useInvoiceActions`,
    // and we don't need a React Modal component for Ticket Preview unless we want to change UX.
    // I will DELETE this file creation from my plan or just make it a "Printer Helper" if needed.
    // For now, I'll Skip creating TicketPreviewModal.tsx if it wasn't a React component in Ventes.tsx.
    
    return null;
};
