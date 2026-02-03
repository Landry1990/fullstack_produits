import { useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import type {
    Client,
    Facture,
    TicketCaisse,
    AyantDroit,
    LigneFacture,
    Promis
} from '../types';
import { normalizeNumberInput } from '../utils/formatters';
import { generatePromisTicket } from '../utils/promisPdf';
import { usePharmacySettings } from './usePharmacySettings';

// ============== TYPES ==============

export interface PaymentDetails {
    mode: string;
    montant: number;
    part_patient?: number | null;
    part_assurance?: number | null;
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

export interface AyantDroitData {
    id?: number | null;
    nom: string;
    matricule: string;
    societe?: string;
}

export interface OrdonnanceData {
    patient_nom: string;
    prescripteur_nom: string;
    lignes: Array<{
        produit_id: number;
        produit_nom: string;
        quantite: number;
        surveillance_category?: string;
    }>;
}

export interface SaleCompletionParams {
    // Client
    selectedClient: number | null;
    useManualClient: boolean;
    manualClientName: string;
    clients: Client[];

    // Ayant droit
    selectedAyantDroit: number | null;
    ayantDroitNom: string;
    ayantDroitMatricule: string;
    ayantDroitSociete: string;
    ayantsDroitList: AyantDroit[];
    showNewAyantDroit: boolean;

    // Cart
    lignesFacture: LigneFacture[];
    totals: TotalsData;

    // Payment
    modePaiement: string;
    montantPaye: string;
    paiements: PaymentDetails[];
    reference: string;
    couponNumero: string;

    // Loyalty / Discounts
    usePendingDiscount: boolean;
    pointsToUse: number;

    // Modes
    isRetrocession: boolean;
    centralizedCashRegister: boolean;

    // Modification mode
    isModificationMode: boolean;
    modificationInvoiceId: number | null;

    // Devis
    devisIdToValidate: number | null;

    // Ordonnance
    tempOrdonnanceData: OrdonnanceData | null;
}

export interface SaleCompletionResult {
    success: boolean;
    facture?: Facture;
    ticketCaisse?: TicketCaisse;
    error?: string;
    rendu?: number;
}

export interface UseSaleCompletionOptions {
    apiBaseUrl?: string;
    onSuccess?: (result: SaleCompletionResult) => void;
    onError?: (error: string) => void;
    onReset?: () => void;
}

export interface UseSaleCompletionReturn {
    completeSale: (params: SaleCompletionParams) => Promise<SaleCompletionResult>;
    loading: boolean;
    error: string | null;
    lastResult: SaleCompletionResult | null;
}

// ============== HELPER FUNCTIONS ==============

/**
 * Valide les données avant soumission
 */
function validateSaleData(params: SaleCompletionParams): string | null {
    const { selectedClient, lignesFacture, totals, montantPaye, paiements } = params;

    if (!selectedClient && !params.useManualClient) {
        return 'Veuillez sélectionner un client';
    }

    if (lignesFacture.length === 0) {
        return 'Veuillez ajouter au moins un produit';
    }

    // Validation du montant
    const isTiersPayant = totals.tauxCouverture > 0 && totals.partAssurance > 0;
    const montantAttendu = isTiersPayant ? totals.partPatient : totals.totalTtc;

    if (montantAttendu > 0) {
        const montantSaisi = Number(montantPaye);
        const totalSplit = paiements.reduce((acc, p) => acc + p.montant, 0);

        if (paiements.length === 0 && (!montantPaye || montantSaisi <= 0)) {
            return 'Veuillez entrer un montant valide';
        }

        // Si paiement partagé, vérifier le total
        if (paiements.length > 0) {
            // Tolérance de 1F pour les arrondis
            if (Math.abs(totalSplit - montantAttendu) > 1 && Math.abs(totalSplit + montantSaisi - montantAttendu) > 1) {
                return `Le total des paiements (${totalSplit + montantSaisi} F) ne correspond pas au montant à payer (${montantAttendu} F)`;
            }
        }
    }

    return null;
}

/**
 * Valide les données client professionnel
 */
function validateProfessionalClient(params: SaleCompletionParams, client: Client): string | null {
    const {
        useManualClient, showNewAyantDroit, ayantsDroitList,
        ayantDroitNom, ayantDroitMatricule, selectedAyantDroit, totals
    } = params;

    if (client?.client_type !== 'PROFESSIONNEL') return null;

    // Validation ayant droit
    if (!useManualClient) {
        if (showNewAyantDroit || ayantsDroitList.length === 0) {
            if (!ayantDroitNom || !ayantDroitMatricule) {
                return "Pour un client professionnel, veuillez renseigner le nom et le matricule de l'ayant droit";
            }
        }
    } else {
        if (!selectedAyantDroit) {
            return 'Pour un client professionnel, veuillez sélectionner un ayant droit ou en créer un nouveau';
        }
    }

    // Validation du PLAFOND DE CRÉDIT
    const plafond = Number(client.plafond || 0);
    if (plafond > 0) {
        const currentDebt = Number(client.current_debt || 0);
        const newTotal = currentDebt + totals.totalTtc;

        if (newTotal > plafond) {
            return `⚠️ PLAFOND DÉPASSÉ !\nDette actuelle: ${Math.round(currentDebt).toLocaleString()} F\nNouvelle facture: ${Math.round(totals.totalTtc).toLocaleString()} F\nTotal: ${Math.round(newTotal).toLocaleString()} F\nPlafond: ${Math.round(plafond).toLocaleString()} F`;
        }
    }

    return null;
}

// ============== MAIN HOOK ==============

/**
 * Hook pour gérer la finalisation d'une vente
 * 
 * @example
 * ```tsx
 * const { completeSale, loading, error } = useSaleCompletion({
 *   apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
 *   onSuccess: (result) => {
 *     toast.success(`Vente ${result.facture?.numero_facture} validée !`);
 *     resetForm();
 *   }
 * });
 * 
 * const handlePayment = async () => {
 *   await completeSale({ selectedClient, lignesFacture, ... });
 * };
 * ```
 */
export function useSaleCompletion(options: UseSaleCompletionOptions = {}): UseSaleCompletionReturn {
    const { apiBaseUrl = '', onSuccess, onError, onReset } = options;
    const { settings: pharmacySettings } = usePharmacySettings();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<SaleCompletionResult | null>(null);

    // Endpoints
    const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/';
    const factureProduitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/facture-produits/` : '/api/facture-produits/';
    const caisseEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/caisse/` : '/api/caisse/';
    const ayantsDroitEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/ayants-droit/` : '/api/ayants-droit/';
    const couponsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/coupons/` : '/api/coupons/';
    const promisEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/promis/` : '/api/promis/';
    const ordonnancierEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/ordonnancier/` : '/api/ordonnancier/';

    /**
     * Créer ou récupérer l'ayant droit
     */
    const resolveAyantDroit = useCallback(async (
        params: SaleCompletionParams,
        client: Client | undefined
    ): Promise<number | null> => {
        if (!client || client.client_type !== 'PROFESSIONNEL') return null;

        let ayantDroitId = params.selectedAyantDroit;

        if (params.showNewAyantDroit || params.ayantsDroitList.length === 0) {
            if (params.ayantDroitNom && params.ayantDroitMatricule) {
                // Vérifier si existe déjà localement
                const existingLocal = params.ayantsDroitList.find(
                    ad => ad.matricule === params.ayantDroitMatricule
                );

                if (existingLocal) {
                    ayantDroitId = existingLocal.id || null;
                } else {
                    // Créer un nouveau
                    const payload = {
                        client: params.selectedClient,
                        nom: params.ayantDroitNom,
                        matricule: params.ayantDroitMatricule,
                        societe: params.ayantDroitSociete || null
                    };

                    const { data: created } = await axios.post<AyantDroit>(ayantsDroitEndpoint, payload);
                    ayantDroitId = created.id || null;
                }
            }
        }

        return ayantDroitId;
    }, [ayantsDroitEndpoint]);

    /**
     * Gérer le mode modification (facture existante)
     */
    const handleModificationMode = useCallback(async (
        params: SaleCompletionParams
    ): Promise<SaleCompletionResult> => {
        const produitsPayload = params.lignesFacture.map(ligne => {
            const prixUnitaire = normalizeNumberInput(ligne.prix_unitaire, { min: 0 });
            const remiseProduit = normalizeNumberInput(ligne.remise_produit, { min: 0, max: 100 });
            const prixNet = prixUnitaire * (1 - remiseProduit / 100);

            return {
                produit: ligne.produit.id,
                quantity: ligne.quantite,
                selling_price: prixNet.toString(),
                lot_id: ligne.lotId ? Number(ligne.lotId) : null
            };
        });

        const modifierEndpoint = `${facturesEndpoint}${params.modificationInvoiceId}/modifier/`;
        const { data: result } = await axios.post(modifierEndpoint, {
            produits: produitsPayload,
            remise: params.totals.remiseMontant.toString(),
            client: params.useManualClient ? null : params.selectedClient,
            client_name_override: params.useManualClient ? params.manualClientName : null
        });

        const difference = result.difference;
        if (difference > 0) {
            toast.success(`Facture modifiée. Encaissement supplémentaire: ${Math.round(difference).toLocaleString('fr-FR')} F`);
        } else if (difference < 0) {
            toast.success(`Facture modifiée. Remboursement: ${Math.round(Math.abs(difference)).toLocaleString('fr-FR')} F`);
        } else {
            toast.success('Facture modifiée (même total)');
        }

        return { success: true, facture: result.facture };
    }, [facturesEndpoint]);

    /**
     * Créer ou récupérer la facture
     */
    const createOrGetInvoice = useCallback(async (
        params: SaleCompletionParams,
        ayantDroitId: number | null,
        client: Client | undefined
    ): Promise<Facture> => {
        if (params.devisIdToValidate) {
            const { data } = await axios.get<Facture>(`${facturesEndpoint}${params.devisIdToValidate}/`);
            return data;
        }

        const facturePayload = {
            client: params.useManualClient ? null : params.selectedClient,
            client_name_override: params.useManualClient ? params.manualClientName : null,
            remise: (Number(params.totals.remiseMontant) || 0).toFixed(2),
            tva: '0',
            ayant_droit: ayantDroitId,
            part_client: (client?.client_type === 'PROFESSIONNEL' && params.totals.tauxCouverture > 0)
                ? params.totals.partPatient
                : null,
            type: params.isRetrocession ? 'RETRO' : 'STD'
        };

        console.log("DEBUG: Creating Invoice Payload:", facturePayload);

        try {
            const { data } = await axios.post<Facture>(facturesEndpoint, facturePayload);
            return data;
        } catch (err: any) {
            console.error("Facture Creation Error Details:", err.response?.data);
            throw err;
        }
    }, [facturesEndpoint]);

    /**
     * Ajouter les produits à la facture
     */
    const addProductsToInvoice = useCallback(async (
        params: SaleCompletionParams,
        factureId: number
    ): Promise<void> => {
        if (params.devisIdToValidate) return; // Les produits existent déjà

        const produitsPayload = params.lignesFacture.map(ligne => {
            const prixUnitaire = normalizeNumberInput(ligne.prix_unitaire, { min: 0 });
            const remiseProduit = normalizeNumberInput(ligne.remise_produit, { min: 0, max: 100 });
            const prixNet = prixUnitaire * (1 - remiseProduit / 100);

            return {
                facture: factureId,
                produit: ligne.produit.id,
                quantity: Number(ligne.quantite),
                selling_price: prixNet.toString(),
                discount: (prixUnitaire - prixNet).toFixed(2),
                stock_lot: ligne.lotId ? Number(ligne.lotId) : null,
                lot: null,
                date_expiration: ligne.produit.expire_date || null,
            };
        });

        await Promise.all(
            produitsPayload.map(payload => axios.post(factureProduitsEndpoint, payload))
        );
    }, [factureProduitsEndpoint]);

    /**
     * Appliquer le coupon si présent
     */
    const applyCoupon = useCallback(async (
        couponNumero: string,
        factureId: number
    ): Promise<void> => {
        if (!couponNumero.trim()) return;

        try {
            const searchResponse = await axios.get(couponsEndpoint, {
                params: { numero: couponNumero.trim() }
            });

            if (searchResponse.data.results?.length > 0) {
                const coupon = searchResponse.data.results[0];
                const utiliserEndpoint = `${couponsEndpoint}${coupon.id}/utiliser/`;
                await axios.post(utiliserEndpoint, { facture_id: factureId });
                toast.success(`Coupon #${coupon.numero} appliqué (-${Math.round(Number(coupon.montant))} F)`);
            } else {
                toast.error(`Coupon "${couponNumero}" introuvable`);
            }
        } catch (err: any) {
            console.error('Erreur application coupon:', err);
            toast.error(err.response?.data?.detail || "Erreur lors de l'application du coupon");
        }
    }, [couponsEndpoint]);

    /**
     * Construire la liste des paiements
     */
    const buildPaymentsList = useCallback((
        params: SaleCompletionParams
    ): PaymentDetails[] => {
        const { totals, paiements, montantPaye, modePaiement } = params;
        const useTiersPayant = totals.tauxCouverture > 0 && totals.partAssurance > 0;

        let paiementsList: PaymentDetails[] = [];

        if (useTiersPayant) {
            // Part patient
            if (totals.partPatient > 0) {
                if (paiements.length > 0) {
                    paiements.forEach(p => {
                        paiementsList.push({
                            mode: p.mode,
                            montant: p.montant,
                            part_patient: p.montant,
                            part_assurance: null
                        });
                    });

                    if (montantPaye && Number(montantPaye) > 0) {
                        paiementsList.push({
                            mode: modePaiement,
                            montant: Number(montantPaye),
                            part_patient: Number(montantPaye),
                            part_assurance: null
                        });
                    }
                } else {
                    paiementsList.push({
                        mode: modePaiement,
                        montant: totals.partPatient,
                        part_patient: totals.partPatient,
                        part_assurance: null
                    });
                }
            }

            // Part assurance (toujours en compte)
            if (totals.partAssurance > 0) {
                paiementsList.push({
                    mode: 'en_compte',
                    montant: totals.partAssurance,
                    part_patient: null,
                    part_assurance: totals.partAssurance
                });
            }
        } else {
            // Pas de tiers payant
            if (paiements.length > 0) {
                paiementsList = paiements.map(p => ({ ...p, part_patient: null, part_assurance: null }));
                if (montantPaye && Number(montantPaye) > 0) {
                    paiementsList.push({
                        mode: modePaiement,
                        montant: Number(montantPaye),
                        part_patient: null,
                        part_assurance: null
                    });
                }
            } else {
                paiementsList = [{
                    mode: modePaiement,
                    montant: Number(montantPaye),
                    part_patient: null,
                    part_assurance: null
                }];
            }
        }

        return paiementsList;
    }, []);

    /**
     * Enregistrer les paiements en caisse
     */
    const recordPayments = useCallback(async (
        paiementsList: PaymentDetails[],
        factureId: number,
        reference: string
    ): Promise<number> => {
        let totalVerse = 0;

        await Promise.all(paiementsList.map(async (paiement) => {
            const payload: any = {
                facture: factureId,
                mode_paiement: paiement.mode,
                montant: paiement.montant,
                reference: reference || null,
                statut: 'completee',
            };

            if (paiement.part_patient !== null && paiement.part_patient !== undefined) {
                payload.part_patient = paiement.part_patient;
            }
            if (paiement.part_assurance !== null && paiement.part_assurance !== undefined) {
                payload.part_assurance = paiement.part_assurance;
            }

            await axios.post(caisseEndpoint, payload);
            totalVerse += paiement.montant;
        }));

        return totalVerse;
    }, [caisseEndpoint]);

    /**
     * Créer les promis
     */
    const createPromis = useCallback(async (
        params: SaleCompletionParams,
        finalFacture: Facture
    ): Promise<number[]> => {
        const promisLines = params.lignesFacture.filter(
            l => l.isPromis && l.promisQuantity && l.promisQuantity > 0
        );
        const createdPromisIds: number[] = [];
        const createdPromisList: any[] = []; // Store full objects for PDF

        for (const line of promisLines) {
            try {
                const payload = {
                    facture: finalFacture.id,
                    client: finalFacture.client,
                    client_name: finalFacture.client_name || (params.useManualClient ? params.manualClientName : ''),
                    client_phone: line.promisPhone,
                    produit: line.produit.id,
                    quantite: line.promisQuantity,
                    status: 'ATT'
                };

                const { data } = await axios.post<Promis>(promisEndpoint, payload);
                createdPromisIds.push(data.id);
                // Enhance data with product name if missing in response (it might be in expanded relation, but let's be safe)
                createdPromisList.push({
                    ...data,
                    produit_nom: line.produit.name,
                    produit: line.produit // Keep full product for barcode
                });
            } catch (err) {
                console.error("Erreur création promis:", err);
            }
        }

        // Generate PDF on Frontend
        if (createdPromisList.length > 0) {
            try {
                generatePromisTicket({
                    client_name: finalFacture.client_name || params.manualClientName || 'Client',
                    client_phone: params.lignesFacture.find(l => l.promisPhone)?.promisPhone, // Try to find phone from lines
                    items: createdPromisList,
                    pharmacy: pharmacySettings,
                    facture_id: finalFacture.numero_facture || finalFacture.id,
                    is_paid: !params.centralizedCashRegister // If sent to central, it's not paid yet
                });
            } catch (err) {
                console.error("Erreur génération PDF promis:", err);
                toast.error("Erreur lors de la génération du ticket Promis");
            }
        }

        return createdPromisIds;
    }, [promisEndpoint, pharmacySettings]);

    /**
     * Sauvegarder l'ordonnancier
     */
    const saveOrdonnancier = useCallback(async (
        data: OrdonnanceData | null,
        factureId: number
    ): Promise<void> => {
        if (!data) return;

        try {
            const lignesForBackend = data.lignes.map(ligne => ({
                produit: ligne.produit_id,
                produit_nom: ligne.produit_nom,
                quantite: ligne.quantite,
                surveillance_category: ligne.surveillance_category
            }));

            await axios.post(ordonnancierEndpoint, {
                patient_nom: data.patient_nom,
                prescripteur_nom: data.prescripteur_nom,
                facture: factureId,
                lignes: lignesForBackend
            });

            toast.success("Ordonnancier enregistré");
        } catch (err) {
            console.error("Erreur enregistrement ordonnancier:", err);
            toast.error("Erreur lors de l'enregistrement de l'ordonnancier");
        }
    }, [ordonnancierEndpoint]);

    /**
     * Annuler une facture (rollback)
     */
    const rollbackInvoice = useCallback(async (factureId: number): Promise<void> => {
        try {
            await axios.post(`${facturesEndpoint}${factureId}/annuler/`, {
                motif: "Échec du paiement (Annulation automatique)"
            });

        } catch (err) {
            console.error("Critical: Failed to rollback invoice after payment failure", err);
        }
    }, [facturesEndpoint]);

    /**
     * Fonction principale de finalisation de vente
     */
    const completeSale = useCallback(async (params: SaleCompletionParams): Promise<SaleCompletionResult> => {
        setLoading(true);
        setError(null);

        let validatedFactureForRollback: Facture | null = null;

        try {
            // Validations de base
            const validationError = validateSaleData(params);
            if (validationError) {
                setError(validationError);
                onError?.(validationError);
                return { success: false, error: validationError };
            }

            // Trouver le client
            const client = params.clients.find(c => c.id === params.selectedClient);

            // Validation client professionnel
            if (client) {
                const proError = validateProfessionalClient(params, client);
                if (proError) {
                    setError(proError);
                    onError?.(proError);
                    toast.error("⚠️ Plafond crédit dépassé !", {
                        duration: 6000,
                        style: { background: '#dc2626', color: 'white', fontWeight: 'bold' }
                    });
                    return { success: false, error: proError };
                }
            }

            // Résoudre l'ayant droit
            const ayantDroitId = await resolveAyantDroit(params, client);

            // === MODE MODIFICATION ===
            if (params.isModificationMode && params.modificationInvoiceId) {
                const result = await handleModificationMode(params);
                setLastResult(result);
                onSuccess?.(result);
                onReset?.();
                return result;
            }

            // === FLUX NORMAL ===
            // 1. Créer ou récupérer la facture
            const createdFacture = await createOrGetInvoice(params, ayantDroitId, client);

            // 2. Ajouter les produits
            await addProductsToInvoice(params, createdFacture.id);

            // 3. Appliquer le coupon
            await applyCoupon(params.couponNumero, createdFacture.id);

            // === CLIENT PRO 100% ===
            const clientIsPro100 = client?.client_type === 'PROFESSIONNEL' &&
                params.totals.partPatient === 0 &&
                params.totals.partAssurance > 0;

            if (clientIsPro100) {
                toast('Client professionnel 100% - Validation automatique', { icon: 'ℹ️' });

                const validerEndpoint = `${facturesEndpoint}${createdFacture.id}/valider/`;
                const { data: validatedFacture } = await axios.post<Facture>(validerEndpoint, {
                    use_pending_discount: params.usePendingDiscount,
                    points_to_use: params.pointsToUse
                });

                await axios.post(caisseEndpoint, {
                    facture: validatedFacture.id,
                    mode_paiement: 'en_compte',
                    montant: params.totals.partAssurance,
                    reference: null,
                    statut: 'completee',
                    part_patient: 0,
                    part_assurance: params.totals.partAssurance
                });

                toast.success(`Facture ${validatedFacture.numero_facture} validée (Tiers payant 100%)`);

                const result: SaleCompletionResult = { success: true, facture: validatedFacture };
                setLastResult(result);
                onSuccess?.(result);
                onReset?.();
                return result;
            }

            // 3.5 Gérer les Promis et Ordonnancier (Avant check caisse centralisée)
            // On le fait même si la vente part en caisse centralisée, car c'est une action de saisie
            await createPromis(params, createdFacture);
            await saveOrdonnancier(params.tempOrdonnanceData, createdFacture.id);

            // === CAISSE CENTRALISÉE ===
            if (params.centralizedCashRegister) {
                if (createdFacture.status === 'PROF' || createdFacture.status === 'PROFORMA') {
                    await axios.patch(`${facturesEndpoint}${createdFacture.id}/`, { status: 'BROU' });
                }

                toast.success(`Vente envoyée à la Caisse Centralisée (Ticket #${createdFacture.id})`);

                const result: SaleCompletionResult = {
                    success: true,
                    facture: { ...createdFacture, status: 'BROU' as any }
                };
                setLastResult(result);
                onSuccess?.(result);
                onReset?.();
                return result;
            }

            // === VALIDATION ET PAIEMENT DIRECT ===
            // 4. Valider la facture
            const validerEndpoint = `${facturesEndpoint}${createdFacture.id}/valider/`;
            const { data: validatedFacture } = await axios.post<Facture>(validerEndpoint, {
                use_pending_discount: params.usePendingDiscount,
                points_to_use: params.pointsToUse
            });
            validatedFactureForRollback = validatedFacture;

            // 5. Enregistrer les paiements
            const paiementsList = buildPaymentsList(params);
            const totalVerse = await recordPayments(paiementsList, validatedFacture.id, params.reference);

            // 6. Mettre à jour le statut
            await axios.patch(`${facturesEndpoint}${validatedFacture.id}/`, { status: 'PAY' });

            // 7. Récupérer la facture finale
            const { data: finalFacture } = await axios.get<Facture>(`${facturesEndpoint}${validatedFacture.id}/`);

            // 10. Construire le résultat

            // 10. Construire le résultat
            const rendu = totalVerse - Number(finalFacture.total_ttc);

            // Ouvrir la page d'impression
            window.open(`/app/print-invoice/${finalFacture.id}`, '_blank');

            // Construire le ticket
            const clientName = params.useManualClient
                ? params.manualClientName
                : client?.name || 'Client';

            const ticketCaisse: TicketCaisse = {
                id: 0,
                facture: finalFacture,
                mode_paiement: paiementsList.length > 1 ? 'Mixte' : paiementsList[0].mode,
                montant: finalFacture.total_ttc,
                montant_verse: totalVerse.toString(),
                rendu: rendu.toString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                statut: 'completee',
                date_paiement: new Date().toISOString(),
                client_name: clientName,
                paiements_details: paiementsList
            } as TicketCaisse;

            const result: SaleCompletionResult = {
                success: true,
                facture: finalFacture,
                ticketCaisse,
                rendu
            };

            setLastResult(result);
            onSuccess?.(result);
            onReset?.();
            return result;

        } catch (err: any) {
            // Rollback si nécessaire
            if (validatedFactureForRollback) {
                await rollbackInvoice(validatedFactureForRollback.id);
            }

            const errorMessage = err.response?.data?.detail ||
                err.message ||
                "Une erreur est survenue lors de l'enregistrement de la vente.";

            setError(errorMessage);
            onError?.(errorMessage);

            return { success: false, error: errorMessage };
        } finally {
            setLoading(false);
        }
    }, [
        resolveAyantDroit, handleModificationMode, createOrGetInvoice,
        addProductsToInvoice, applyCoupon, buildPaymentsList,
        recordPayments, createPromis, saveOrdonnancier, rollbackInvoice,
        facturesEndpoint, caisseEndpoint, onSuccess, onError, onReset
    ]);

    return {
        completeSale,
        loading,
        error,
        lastResult
    };
}

export default useSaleCompletion;
