import { extractErrorMessage } from '../utils/errorHandling';
import { useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type {
    Client,
    Facture,
    TicketCaisse,
    AyantDroit,
    LigneFacture
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
    // Sudo Mode
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
    const { selectedClient, lignesFacture, totals, montantPaye, paiements, validated_by_id, sudo_password } = params;

    if (!selectedClient && !params.useManualClient) {
        return 'Veuillez sélectionner un client';
    }

    if (lignesFacture.length === 0) {
        return 'Veuillez ajouter au moins un produit';
    }

    // Validation Sudo
    if (validated_by_id && !sudo_password) {
        return 'Mot de passe requis pour la validation par un tiers';
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

        // Calculer le paiement immédiat total
        const immediatePayment = Number(params.montantPaye || 0) +
            params.paiements.reduce((acc, p) => acc + (p.montant || 0), 0);

        const debtIncrement = Math.max(0, totals.totalTtc - immediatePayment);
        const newTotal = currentDebt + debtIncrement;

        if (newTotal > plafond) {
            return `⚠️ PLAFOND DÉPASSÉ !\nDette actuelle: ${Math.round(currentDebt).toLocaleString()} F\nIncrément dette (TTC - Payé): ${Math.round(debtIncrement).toLocaleString()} F\nTotal: ${Math.round(newTotal).toLocaleString()} F\nPlafond: ${Math.round(plafond).toLocaleString()} F`;
        }
    }

    return null;
}

// ============== MAIN HOOK ==============

/**
 * Hook pour gérer la finalisation d'une vente
 */
export function useSaleCompletion(options: UseSaleCompletionOptions = {}): UseSaleCompletionReturn {
    const { apiBaseUrl = '', onSuccess, onError, onReset } = options;
    const { settings: pharmacySettings } = usePharmacySettings();
    const { t } = useTranslation();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<SaleCompletionResult | null>(null);

    // Endpoints
    const facturesEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/factures/` : '/api/factures/';

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
                    const ayantsDroitEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/ayants-droit/` : '/api/ayants-droit/';
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
    }, [apiBaseUrl]);

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
            client_name_override: params.useManualClient ? params.manualClientName : null,
        });

        const difference = result.difference;
        if (difference > 0) {
            toast.success(t('sales.messages.additional_payment', { amount: Math.round(difference).toLocaleString('fr-FR') }));
        } else if (difference < 0) {
            toast.success(t('sales.messages.refund_amount', { amount: Math.round(Math.abs(difference)).toLocaleString('fr-FR') }));
        } else {
            toast.success(t('sales.messages.same_total'));
        }

        return { success: true, facture: result.facture };
    }, [facturesEndpoint, t]);

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
     * Fonction principale de finalisation de vente
     */
    const completeSale = useCallback(async (params: SaleCompletionParams): Promise<SaleCompletionResult> => {
        setLoading(true);
        setError(null);

        try {
            // 1. Validations de base
            const validationError = validateSaleData(params);
            if (validationError) {
                setError(validationError);
                onError?.(validationError);
                return { success: false, error: validationError };
            }

            // Trouver le client
            const client = params.clients.find(c => c.id === params.selectedClient);

            // 2. Validation client professionnel
            if (client) {
                const proError = validateProfessionalClient(params, client);
                if (proError) {
                    setError(proError);
                    onError?.(proError);
                    toast.error(t('sales.messages.credit_limit_exceeded'), {
                        duration: 6000,
                        style: { background: '#dc2626', color: 'white', fontWeight: 'bold' }
                    });
                    return { success: false, error: proError };
                }
            }

            // === MODE MODIFICATION ===
            if (params.isModificationMode && params.modificationInvoiceId) {
                const result = await handleModificationMode(params);
                setLastResult(result);
                onSuccess?.(result);
                onReset?.();
                return result;
            }

            // === FLUX ATOMIQUE (OU CAISSE CENTRALISÉE) ===

            // Préparer les produits
            const produitsPayload = params.lignesFacture.map(ligne => {
                const prixUnitaire = normalizeNumberInput(ligne.prix_unitaire, { min: 0 });
                const remiseProduit = normalizeNumberInput(ligne.remise_produit, { min: 0, max: 100 });
                const prixNet = prixUnitaire * (1 - remiseProduit / 100);

                return {
                    produit: ligne.produit.id,
                    quantity: Number(ligne.quantite),
                    selling_price: prixNet.toString(),
                    discount: (prixUnitaire - prixNet).toFixed(2),
                    lot_id: ligne.lotId ? Number(ligne.lotId) : null,
                    is_promis: !!ligne.isPromis,
                    promis_quantity: ligne.isPromis ? ligne.promisQuantity : 0,
                    promis_phone: ligne.isPromis ? (ligne.promisPhone || '') : ''
                };
            });

            // Résoudre l'ayant droit
            const ayantDroitId = await resolveAyantDroit(params, client);

            // Préparer les paiements
            const paiementsList = buildPaymentsList(params);

            // Payload atomique final
            const finalPayload = {
                client: params.useManualClient ? null : params.selectedClient,
                client_name_override: params.useManualClient ? params.manualClientName : null,
                ayant_droit: ayantDroitId,
                remise: (Number(params.totals.remiseMontant) || 0).toFixed(2),
                produits: produitsPayload,
                paiements: paiementsList,
                loyalty: {
                    use_pending_discount: params.usePendingDiscount,
                    points_to_use: params.pointsToUse
                },
                ordonnance: params.tempOrdonnanceData ? {
                    patient_nom: params.tempOrdonnanceData.patient_nom,
                    prescripteur_nom: params.tempOrdonnanceData.prescripteur_nom,
                    lignes: params.tempOrdonnanceData.lignes.map(l => ({
                        produit_id: l.produit_id,
                        produit_nom: l.produit_nom,
                        quantite: l.quantite,
                        surveillance_category: l.surveillance_category || 'NONE'
                    }))
                } : null,
                sudo: {
                    validated_by_id: params.validated_by_id,
                    sudo_password: params.sudo_password
                },
                type: params.isRetrocession ? 'RETRO' : 'STD',
                centralized_cash_register: params.centralizedCashRegister,
                coupon_numero: params.couponNumero
            };

            const finaliserEndpoint = `${facturesEndpoint}finaliser/`;
            const { data: finalFacture } = await axios.post<Facture>(finaliserEndpoint, finalPayload);

            // Gestion des impressions post-vente

            // 1. Promis (On génère le PDF côté client comme avant)
            const promisLines = params.lignesFacture.filter(l => l.isPromis && l.promisQuantity && l.promisQuantity > 0);
            if (promisLines.length > 0) {
                try {
                    generatePromisTicket({
                        client_name: finalFacture.client_name || params.manualClientName || 'Client',
                        client_phone: params.lignesFacture.find(l => l.promisPhone)?.promisPhone,
                        items: promisLines.map(l => ({
                            id: 0,
                            produit_nom: l.produit.name,
                            quantite: l.promisQuantity || 0,
                            promisQuantity: l.promisQuantity || 0,
                            produit: l.produit,
                            date_promis: new Date().toISOString(),
                            status: 'ATT'
                        })) as any,
                        pharmacy: pharmacySettings,
                        facture_id: finalFacture.numero_facture || finalFacture.id,
                        is_paid: !params.centralizedCashRegister
                    });
                } catch (err) {
                    console.error("Erreur génération PDF promis:", err);
                }
            }

            // 2. Impression Facture/Ticket et Notifications
            if (!params.centralizedCashRegister) {
                window.open(`/app/print-invoice/${finalFacture.id}`, '_blank');

                const totalVerse = paiementsList.reduce((acc, p) => acc + p.montant, 0);
                const rendu = totalVerse - Number(finalFacture.total_ttc);

                // Construire le ticket pour l'UI si besoin
                const ticketCaisse: TicketCaisse = {
                    id: 0,
                    facture: finalFacture,
                    mode_paiement: paiementsList.length > 1 ? 'Mixte' : (paiementsList[0]?.mode || 'N/A'),
                    montant: finalFacture.total_ttc,
                    montant_verse: totalVerse.toString(),
                    rendu: rendu.toString(),
                    statut: 'completee',
                    client_name: finalFacture.client_name || params.manualClientName || 'Client',
                    paiements_details: paiementsList
                } as any;

                toast.success(t('sales.messages.success_with_id', { id: finalFacture.numero_facture || finalFacture.id }));

                const result: SaleCompletionResult = { success: true, facture: finalFacture, ticketCaisse, rendu };
                setLastResult(result);
                onSuccess?.(result);
                onReset?.();
                return result;
            } else {
                toast.success(t('sales.messages.sent_to_caisse', { id: finalFacture.numero_facture || finalFacture.id }));
                const result: SaleCompletionResult = { success: true, facture: finalFacture };
                setLastResult(result);
                onSuccess?.(result);
                onReset?.();
                return result;
            }




        } catch (err: any) {
            console.error('Sale Finalization Error:', err);
            const errorMessage = extractErrorMessage(err);
            setError(errorMessage);
            onError?.(errorMessage);
            toast.error(errorMessage, {
                duration: 5000,
                style: { background: '#ef4444', color: '#fff' }
            });
            return { success: false, error: errorMessage };
        } finally {
            setLoading(false);
        }
    }, [
        resolveAyantDroit, handleModificationMode, buildPaymentsList,
        facturesEndpoint, pharmacySettings, t, onSuccess, onError, onReset
    ]);

    return {
        completeSale,
        loading,
        error,
        lastResult
    };
}

export default useSaleCompletion;
