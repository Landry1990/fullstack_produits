import type { ProduitModel } from './catalog';

export type ClientCreditStatus = 'BROUILLON' | 'VALIDEE' | 'ANNULEE';

export type ClientCreditTypeMotif = 'ERREUR' | 'RETOUR' | 'REMISE' | 'AUTRE';

export type RefundMethod = 'cash' | 'credit';

export interface ClientCreditLine {
    id: number;
    avoir_client: number;
    produit: number | ProduitModel;
    produit_nom?: string;
    quantity: number;
    prix_unitaire: string;
    remise: string;
    tva: string;
    lot?: string;
    stock_lot?: number | null;
}

export interface ClientCredit {
    id: number;
    numero: string;
    facture_origine: number | null;
    facture_numero?: string;
    client: number | null;
    client_name?: string;
    date: string;
    montant_total: string;
    statut: ClientCreditStatus;
    type_motif: ClientCreditTypeMotif;
    created_by?: number | null;
    created_by_name?: string;
    notes: string;
    lignes: ClientCreditLine[];
}

export interface ClientCreditFilters {
    search?: string;
    statut?: ClientCreditStatus;
    client?: number;
    facture_origine?: number;
    type_motif?: ClientCreditTypeMotif;
    date_debut?: string;
    date_fin?: string;
    page?: number;
    page_size?: number;
}

export interface ClientCreditCreatePayload {
    facture_origine?: number | null;
    client?: number | null;
    montant_total: string | number;
    type_motif: ClientCreditTypeMotif;
    notes?: string;
    validated_by_id?: number | null;
    sudo_password?: string;
    lignes: Array<{
        produit: number;
        quantity: number;
        prix_unitaire: string | number;
        remise?: string | number;
        tva?: string | number;
        lot?: string;
        stock_lot?: number | null;
    }>;
}

export interface ClientCreditValidatePayload {
    refund_method: RefundMethod;
    validated_by_id?: number | null;
    sudo_password?: string;
}

export interface InvoiceForCreditData {
    facture_origine: number;
    facture_numero: string;
    client: number | null;
    client_name: string;
    montant_total: string;
    lignes: Array<{
        produit: number;
        produit_nom: string;
        quantity: number;
        prix_unitaire: string;
        remise: string;
        tva: string;
        lot: string;
        stock_lot: number | null;
        date_expiration?: string | null;
        use_lot_management?: boolean;
    }>;
}
