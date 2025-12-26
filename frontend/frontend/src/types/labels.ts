// Types pour le système d'étiquettes Zebra

export interface LabelTemplate {
    id: number;
    name: string;
    description: string;
    width_mm: number;
    height_mm: number;
    dpi: 203 | 300 | 600;
    is_default: boolean;
    is_active: boolean;
    elements?: LabelElement[];
    element_count?: number;
    created_at: string;
    updated_at: string;
}

export type ElementType = 'TEXT' | 'FIELD' | 'BARCODE' | 'QRCODE' | 'LINE' | 'RECTANGLE';
export type BarcodeType = 'CODE128' | 'EAN13' | 'CODE39' | 'QRCODE';
export type TextAlign = 'left' | 'center' | 'right';
export type Rotation = 0 | 90 | 180 | 270;

export interface LabelElement {
    id?: number;
    template: number;
    element_type: ElementType;
    element_type_display?: string;

    // Position en millimètres
    x_mm: number;
    y_mm: number;
    width_mm?: number;
    height_mm?: number;

    // Contenu
    static_text?: string;
    field_name?: string;

    // Configuration code-barres
    barcode_type?: BarcodeType;
    barcode_type_display?: string;
    barcode_height?: number;
    show_barcode_text?: boolean;

    // Style texte
    font_family?: string;
    font_size?: number;
    font_bold?: boolean;
    text_align?: TextAlign;
    rotation?: Rotation;

    // Ordre et ligne
    order?: number;
    line_thickness?: number;
}

export interface PrinterConfiguration {
    id: number;
    name: string;
    printer_name: string;
    ip_address?: string;
    port: number;
    is_default: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface PrintLabelRequest {
    commande_id: number;
    template_id: number;
    printer_id?: number;
    product_quantities: Array<{
        product_id: number;
        quantity: number;
    }>;
}

export interface PrintLabelResponse {
    status: string;
    message: string;
    printer: string;
    label_count: number;
    zpl_code: string;
}

// Champs dynamiques disponibles
export const AVAILABLE_FIELDS = [
    { value: 'product.name', label: 'Nom du produit' },
    { value: 'product.code', label: 'Code produit' },
    { value: 'product.cip1', label: 'Code CIP1' },
    { value: 'product.cip2', label: 'Code CIP2' },
    { value: 'product.ppv', label: 'Prix de vente' },
    { value: 'product.cost_price', label: "Prix d'achat" },
    { value: 'product.dci', label: 'DCI' },
    { value: 'product.forme', label: 'Forme' },
    { value: 'product.dosage', label: 'Dosage' },
    { value: 'lot.numero', label: 'Numéro de lot' },
    { value: 'lot.date_expiration', label: 'Date expiration lot' },
    { value: 'fournisseur.name', label: 'Nom fournisseur' },
    { value: 'commande.numero', label: 'Numéro commande' },
] as const;

// Tailles d'étiquettes standard
export const STANDARD_LABEL_SIZES = [
    { name: 'Petite (30×20mm)', width: 30, height: 20 },
    { name: 'Standard (50×25mm)', width: 50, height: 25 },
    { name: 'Moyenne (70×30mm)', width: 70, height: 30 },
    { name: 'Grande (100×50mm)', width: 100, height: 50 },
    { name: 'Personnalisé', width: 0, height: 0 },
] as const;
