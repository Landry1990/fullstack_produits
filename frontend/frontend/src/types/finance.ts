import type { ProduitModel } from './catalog';
import type { Client, AyantDroit } from './crm';
import type { OrdonnanceData } from './regulatory';

export interface FactureProduit {
    id: number
    produit: number | ProduitModel
    produit_nom?: string
    quantity: number
    selling_price: string
    discount?: string
    tva?: string
    lot?: string
    date_expiration?: string
    treatment_duration_days?: number
    is_chronic?: boolean
    default_treatment_days?: number
}

export interface Facture {
    id: number
    client: number
    client_name?: string
    client_name_override?: string | null
    ayant_droit?: number | null
    ayant_droit_details?: AyantDroit
    numero_facture: string | null
    date: string
    status: string
    status_display: string
    total_ht: string
    remise: string
    tva: string
    total_tva: string
    total_ttc: string
    montant_paye: string
    produits: FactureProduit[]
    created_by_name?: string
    is_remise_auto?: boolean
    part_client?: string | null
    reste_a_payer?: string
    paiements?: any[]
    validated_by_name?: string
    cancelled_by_name?: string
    session_ticket_number?: number
    montant_regle?: string
    montant_en_compte?: string
    total_lettres?: string
}

export interface PaymentDetails {
    mode: string;
    montant: number;
    part_patient?: number | null;
    part_assurance?: number | null;
}

export interface TicketCaisse {
    id: number
    facture: number | Facture
    facture_numero?: string
    client_name?: string
    mode_paiement: 'especes' | 'cheque' | 'carte' | 'virement' | 'om' | 'momo' | 'en_compte' | 'Mixte'
    montant: string
    reference: string | null
    statut: string
    date_paiement: string
    user_details?: {
        id: number
        username: string
        first_name?: string
        last_name?: string
    } | null
    is_duplicate?: boolean
    paiements_details?: PaymentDetails[]
    montant_verse?: string | number
    rendu?: string | number
    total_lettres?: string
}

export interface Paiement {
    id: number
    mode_paiement: string
    mode_paiement_display: string
    montant: string
    reference?: string | null
    statut: string
    date_paiement: string
    user_details?: {
        id: number
        username: string
        full_name: string
    } | null
    releve_id?: number
    releve_reference?: string
}

export interface CaisseTransaction {
    id: number
    facture: number
    facture_numero: string
    mode_paiement: 'especes' | 'cheque' | 'carte' | 'virement' | 'om' | 'momo' | 'en_compte'
    mode_paiement_display: string
    montant: string
    reference: string | null
    statut: 'en_attente' | 'completee' | 'annulee'
    date_paiement: string
    user_details: {
        id: number
        username: string
        full_name: string
    } | null
    client_name: string
    client_type?: 'PARTICULIER' | 'PROFESSIONNEL'
    releve_reference?: string
    releve_id?: number
    is_creance_settlement?: boolean
    facture_created_by_name?: string
    facture_validated_by_name?: string
    total_lettres?: string
}

export interface CaisseParTranche {
    tranche: string
    date_debut: string
    date_fin: string
    nombre_factures: number
    total_ht: string
    total_tva: string
    total_ttc: string
    debug?: {
        factures_ids?: number[]
    }
}

export interface MouvementCaisse {
    id: number;
    type: 'ENTREE' | 'SORTIE';
    montant: string;
    motif: string;
    description?: string;
    date: string;
    user: number;
    user_nom?: string;
}

export interface Creance {
    id: number
    numero_facture: string | null
    client: number
    client_name: string
    client_name_override?: string | null
    ayant_droit?: number | null
    ayant_droit_details?: AyantDroit
    date: string
    status: string
    status_display: string
    total_ht: string
    remise: string
    tva: string
    total_tva: string
    total_ttc: string
    montant_paye: string
    reste_a_payer: string
    paiements: Paiement[]
    notes?: string
}

export interface LigneFacture {
    produit: ProduitModel
    quantite: number
    prix_unitaire: string
    remise_produit: string
    total_ligne: number
    isPromis?: boolean
    promisQuantity?: number
    promisPhone?: string
    lotId?: string | null
    lotText?: string | null
    lotExpiration?: string | null
    treatment_duration_days?: number
}

export interface TotalsData {
    totalHt: number;
    totalTva: number;
    totalTtc: number;
    remiseMontant: number;
    tauxCouverture: number;
    partPatient: number;
    partAssurance: number;
}

export interface TVA {
    id: number;
    taux: string;
    libelle: string;
    is_active: boolean;
}

export interface CouponMonnaie {
    id: number
    numero: string
    montant: string
    status: 'ACTIF' | 'UTILISE' | 'EXPIRE' | 'ANNULE'
    status_display: string
    date_creation: string
    date_utilisation?: string | null
    cree_par?: number
    cree_par_nom?: string
    utilise_par?: number
    utilise_par_nom?: string
    facture_origine?: number | null
    facture_utilisation?: number | null
    notes?: string
}

export interface Promis {
    id: number
    facture: number
    client?: number
    client_name?: string
    client_display?: string
    client_phone?: string
    client_phone_display?: string
    produit: number
    produit_name?: string
    produit_cip?: string
    quantite: number
    status: 'ATT' | 'DEL' | 'ANN'
    status_display?: string
    date_promis: string
    date_livraison?: string
    notes?: string
}

export interface SaleCompletionParams {
    selectedClient: number | null;
    useManualClient: boolean;
    manualClientName: string;
    clients: Client[];
    selectedAyantDroit: number | null;
    ayantDroitNom: string;
    ayantDroitMatricule: string;
    ayantDroitSociete: string;
    ayantsDroitList: AyantDroit[];
    showNewAyantDroit: boolean;
    lignesFacture: LigneFacture[];
    totals: TotalsData;
    modePaiement: string;
    montantPaye: string;
    paiements: PaymentDetails[];
    reference: string;
    couponNumero: string;
    usePendingDiscount: boolean;
    pointsToUse: number;
    isRetrocession: boolean;
    centralizedCashRegister: boolean;
    isModificationMode: boolean;
    modificationInvoiceId: number | null;
    modificationInvoiceStatus?: string;
    devisIdToValidate: number | null;
    tempOrdonnanceData: OrdonnanceData | null;
    validated_by_id?: number | null;
    sudo_password?: string;
}

export interface SaleCompletionResult {
    success: boolean;
    facture?: Facture;
    ticketCaisse?: TicketCaisse;
    error?: string;
    rendu?: number;
}
