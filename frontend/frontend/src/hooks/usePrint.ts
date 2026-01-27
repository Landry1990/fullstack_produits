import { useCallback, useRef } from 'react';
import { usePharmacySettings } from './usePharmacySettings';

/**
 * Types de documents imprimables
 */
export type PrintDocumentType = 'ticket' | 'invoice' | 'cloture' | 'stock' | 'custom';

/**
 * Options d'impression
 */
export interface PrintOptions {
    /** Titre du document (affiché dans la fenêtre) */
    title?: string;
    /** Largeur de la fenêtre d'impression (défaut: 400) */
    width?: number;
    /** Hauteur de la fenêtre d'impression (défaut: 600) */
    height?: number;
    /** Fermer automatiquement après impression (défaut: true) */
    autoClose?: boolean;
    /** Imprimer automatiquement (défaut: true) */
    autoPrint?: boolean;
    /** Délai avant impression automatique en ms (défaut: 500) */
    printDelay?: number;
}

/**
 * Configuration du template d'impression
 */
export interface PrintTemplateConfig {
    /** Inclure l'en-tête de la pharmacie (défaut: true) */
    showHeader?: boolean;
    /** Inclure le pied de page (défaut: true) */
    showFooter?: boolean;
    /** Message personnalisé en pied de page */
    footerMessage?: string;
    /** Styles CSS additionnels */
    customStyles?: string;
}

/**
 * Résultat du hook usePrint
 */
export interface UsePrintReturn {
    /** Imprimer du contenu HTML personnalisé */
    printHTML: (html: string, options?: PrintOptions) => void;
    /** Imprimer avec un template (en-tête pharmacie, pied de page) */
    printWithTemplate: (content: string, options?: PrintOptions & PrintTemplateConfig) => void;
    /** Ouvrir une page d'impression dédiée */
    openPrintPage: (url: string) => void;
    /** Référence pour impression via react-to-print */
    printRef: React.RefObject<HTMLDivElement>;
    /** Imprimer le contenu d'une référence */
    printElement: (element: HTMLElement, options?: PrintOptions) => void;
}

/**
 * Hook centralisé pour l'impression de documents
 * 
 * @example
 * ```tsx
 * const { printWithTemplate, printHTML, openPrintPage } = usePrint();
 * 
 * // Imprimer avec le template pharmacie
 * printWithTemplate('<div>Mon contenu</div>', { title: 'Ma facture' });
 * 
 * // Imprimer du HTML brut
 * printHTML('<html>...</html>');
 * 
 * // Ouvrir une page d'impression dédiée
 * openPrintPage('/app/print-invoice/123');
 * ```
 */
export function usePrint(): UsePrintReturn {
    const { settings } = usePharmacySettings();
    const printRef = useRef<HTMLDivElement>(null);

    /**
     * Génère les styles CSS de base pour l'impression
     */
    const getBaseStyles = useCallback(() => {
        return `
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      body {
        font-family: 'Courier New', Courier, monospace;
        padding: 0;
        margin: 0;
        color: black;
        background: white;
      }
      @media print {
        body { padding: 0; margin: 0; }
        .no-print { display: none !important; }
      }
      .print-container {
        width: 80mm;
        max-width: 80mm;
        margin: 0 auto;
        padding: 10px;
      }
      .print-header {
        text-align: center;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 2px solid black;
      }
      .print-header h2 {
        margin: 0 0 5px 0;
        font-size: 1.2em;
        font-weight: bold;
        text-transform: uppercase;
      }
      .print-header p {
        margin: 2px 0;
        font-size: 0.8em;
      }
      .print-footer {
        text-align: center;
        margin-top: 20px;
        padding-top: 10px;
        border-top: 1px dashed black;
        font-size: 0.75em;
      }
      .print-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.9em;
        margin: 3px 0;
      }
      .print-divider {
        border-top: 1px dashed black;
        margin: 10px 0;
      }
      .print-total {
        font-weight: bold;
        font-size: 1.1em;
        border-top: 2px solid black;
        padding-top: 8px;
        margin-top: 8px;
      }
    `;
    }, []);

    /**
     * Génère l'en-tête avec les informations de la pharmacie
     */
    const getHeaderHTML = useCallback(() => {
        if (!settings) return '';

        return `
      <div class="print-header">
        <h2>${settings.pharmacy_name || 'PHARMACIE'}</h2>
        ${settings.company_address ? `<p>${settings.company_address}</p>` : ''}
        ${settings.phone ? `<p>Tél: ${settings.phone}</p>` : ''}
        ${settings.email ? `<p>${settings.email}</p>` : ''}
        ${settings.niu ? `<p>NIU: ${settings.niu}</p>` : ''}
        ${settings.registre_commerce ? `<p>RC: ${settings.registre_commerce}</p>` : ''}
      </div>
    `;
    }, [settings]);

    /**
     * Génère le pied de page
     */
    const getFooterHTML = useCallback((message?: string) => {
        const footerText = message || settings?.ticket_footer_message || 'Merci de votre visite !';
        return `
      <div class="print-footer">
        <p>${footerText}</p>
        <p style="margin-top: 5px; font-size: 0.7em;">
          Imprimé le ${new Date().toLocaleString('fr-FR')}
        </p>
      </div>
    `;
    }, [settings]);

    /**
     * Ouvre une fenêtre d'impression avec le contenu HTML
     */
    const openPrintWindow = useCallback((
        content: string,
        options: PrintOptions = {}
    ) => {
        const {
            title = 'Impression',
            width = 400,
            height = 600,
            autoClose = true,
            autoPrint = true,
            printDelay = 500
        } = options;

        const printWindow = window.open('', '', `height=${height},width=${width}`);

        if (!printWindow) {
            console.error('Impossible d\'ouvrir la fenêtre d\'impression. Vérifiez les paramètres du navigateur.');
            return null;
        }

        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.document.title = title;

        if (autoPrint) {
            setTimeout(() => {
                printWindow.print();
                if (autoClose) {
                    printWindow.close();
                }
            }, printDelay);
        }

        return printWindow;
    }, []);

    /**
     * Imprimer du contenu HTML brut
     */
    const printHTML = useCallback((
        html: string,
        options?: PrintOptions
    ) => {
        openPrintWindow(html, options);
    }, [openPrintWindow]);

    /**
     * Imprimer avec le template de la pharmacie
     */
    const printWithTemplate = useCallback((
        content: string,
        options: PrintOptions & PrintTemplateConfig = {}
    ) => {
        const {
            showHeader = true,
            showFooter = true,
            footerMessage,
            customStyles = '',
            ...printOptions
        } = options;

        const fullHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${printOptions.title || 'Impression'}</title>
          <style>
            ${getBaseStyles()}
            ${customStyles}
          </style>
        </head>
        <body>
          <div class="print-container">
            ${showHeader ? getHeaderHTML() : ''}
            ${content}
            ${showFooter ? getFooterHTML(footerMessage) : ''}
          </div>
        </body>
      </html>
    `;

        openPrintWindow(fullHTML, printOptions);
    }, [getBaseStyles, getHeaderHTML, getFooterHTML, openPrintWindow]);

    /**
     * Ouvrir une page d'impression dédiée
     */
    const openPrintPage = useCallback((url: string) => {
        window.open(url, '_blank');
    }, []);

    /**
     * Imprimer le contenu d'un élément DOM
     */
    const printElement = useCallback((
        element: HTMLElement,
        options?: PrintOptions
    ) => {
        const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${getBaseStyles()}</style>
        </head>
        <body>
          ${element.outerHTML}
        </body>
      </html>
    `;
        openPrintWindow(html, options);
    }, [getBaseStyles, openPrintWindow]);

    return {
        printHTML,
        printWithTemplate,
        openPrintPage,
        printRef,
        printElement
    };
}

// ============== HELPER FUNCTIONS ==============

/**
 * Formate un nombre en format monétaire français
 */
export function formatMoney(value: number | string): string {
    return Math.round(parseFloat(String(value))).toLocaleString('fr-FR');
}

/**
 * Formate une date en format français
 */
export function formatDateFr(dateString: string): string {
    return new Date(dateString).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Génère une ligne de détail pour impression
 */
export function printRow(label: string, value: string): string {
    return `
    <div class="print-row">
      <span>${label}</span>
      <span>${value}</span>
    </div>
  `;
}

/**
 * Génère un séparateur horizontal
 */
export function printDivider(): string {
    return '<div class="print-divider"></div>';
}

/**
 * Génère une ligne de total
 */
export function printTotal(label: string, value: string): string {
    return `
    <div class="print-row print-total">
      <span>${label}</span>
      <span>${value}</span>
    </div>
  `;
}

export default usePrint;
