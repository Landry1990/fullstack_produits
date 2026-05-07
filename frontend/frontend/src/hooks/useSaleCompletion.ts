import { extractErrorMessage } from '../utils/errorHandling';
import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type {
    Client,
    Facture,
    TicketCaisse,
    AyantDroit,
    LigneFacture,
    PaymentDetails,
    OrdonnanceData,
    ProduitModel,
    SaleCompletionParams,
    SaleCompletionResult
} from '../types';
import { normalizeNumberInput, formatNumber } from '../utils/formatters';
import { generatePromisTicket, type PromisItem } from '../utils/print/promisPdf';
import { buildPaymentsList } from '../utils/finance';
import { validateSaleData, validateClientCreditLimit } from '../utils/validation';
import { usePharmacySettings } from './usePharmacySettings';
import clientService from '../services/clientService';
import produitService from '../services/produitService';
import venteService from '../services/venteService';
import caisseService from '../services/caisseService';
import promisService from '../services/promisService';
import ordonnancierService from '../services/ordonnancierService';

// Local types and helpers removed (moved to types.ts / utils)

export interface UseSaleCompletionOptions {
    onSuccess?: (result: SaleCompletionResult) => void;
    onError?: (error: string) => void;
    onReset?: () => void;
}

export interface UseSaleCompletionReturn {
    completeSale: (params: SaleCompletionParams) => Promise<SaleCompletionResult>;
    loading: boolean;
    error: string | null;
    lastResult: SaleCompletionResult | null;
    completeExistingInvoicePayment: (params: any) => Promise<SaleCompletionResult>;
}

// ============== MAIN HOOK ==============

/**
 * Hook pour gérer la finalisation d'une vente
 */
export function useSaleCompletion(options: UseSaleCompletionOptions = {}): UseSaleCompletionReturn {
    const { onSuccess, onError, onReset } = options;
    const { settings: pharmacySettings } = usePharmacySettings();
    const { t } = useTranslation(['sales', 'common']);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<SaleCompletionResult | null>(null);

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
                    const payload = {
                        client: params.selectedClient,
                        nom: params.ayantDroitNom,
                        matricule: params.ayantDroitMatricule,
                        societe: params.ayantDroitSociete || null
                    };
                    const created = await clientService.createAyantDroit(payload as unknown as Partial<AyantDroit>);
                    ayantDroitId = created.id || null;
                }
            }
        }

        return ayantDroitId;
    }, []);

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
                quantity: Number(ligne.quantite),
                selling_price: prixUnitaire.toString(),
                discount: (prixUnitaire - prixNet).toFixed(0),
                tva: ligne.produit.tva || 0,
                lot_id: ligne.lotId ? Number(ligne.lotId) : null
            };
        });

        const modResult = await venteService.modifier(params.modificationInvoiceId!, {
            produits: produitsPayload,
            remise: params.totals.remiseMontant.toString(),
            client: params.useManualClient ? null : params.selectedClient,
            client_name_override: params.useManualClient ? params.manualClientName : null,
        });

        const difference = modResult.difference;
        if (difference > 0) {
            toast.success(t('messages.additional_payment', { amount: formatNumber(Math.round(difference)) }));
        } else if (difference < 0) {
            toast.success(t('messages.refund_amount', { amount: formatNumber(Math.round(Math.abs(difference))) }));
        }
        else {
            toast.success(t('messages.same_total'));
        }

        return { success: true, facture: modResult.facture };
    }, [t]);

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
                const clientError = validateClientCreditLimit(params, client);
                if (clientError) {
                    setError(clientError);
                    onError?.(clientError);
                    toast.error(t('messages.credit_limit_exceeded'), {
                        duration: 6000,
                        style: { background: '#dc2626', color: 'white', fontWeight: 'bold' }
                    });
                    return { success: false, error: clientError };
                }

                // New Check: Deposit Balance Warning for Individuals
                if (client.client_type === 'PARTICULIER' && (parseFloat(client.solde_depot || '0') > 0)) {
                    const solde = parseFloat(client.solde_depot || '0');
                    if (params.totals.totalTtc > solde) {
                        toast.error(
                            t('facturation:client.insufficient_deposit_warning', { solde }),
                            { duration: 5000, icon: '⚠️' }
                        );
                    }
                }
            }

            // 3. VÉRIFICATION DU STOCK EN TEMPS RÉEL
            const productIds = params.lignesFacture.map(l => l.produit.id);
            if (productIds.length > 0) {
                const realTimeProducts = await produitService.bulkRefresh(productIds);

                // On indexe les résultats
                const realStockMap = new Map<number, ProduitModel>();
                realTimeProducts.forEach(p => realStockMap.set(p.id, p));

                for (const ligne of params.lignesFacture) {
                    const realProd = realStockMap.get(ligne.produit.id);
                    if (realProd) {
                        const effectiveQty = ligne.quantite - (ligne.isPromis ? (ligne.promisQuantity || 0) : 0);
                        // On autorise la vente si stock suffisant OU si une validation Sudo est présente (Vente forcée)
                        if (effectiveQty > 0 && realProd.stock < effectiveQty && !params.sudo_password) {
                            const errorMsg = `⚠️ STOCK INSUFFISANT EN TEMPS RÉEL !\nLe produit "${ligne.produit.name}" a été vendu sur un autre poste.\nStock actuel disponible : ${realProd.stock}\nQuantité demandée : ${effectiveQty}`;
                            setError(errorMsg);
                            onError?.(errorMsg);
                            toast.error(errorMsg, {
                                duration: 8000,
                                style: { background: '#dc2626', color: 'white', fontWeight: 'bold' }
                            });
                            return { success: false, error: errorMsg };
                        }
                    }
                }
            }


            // === MODE MODIFICATION (Rectification de vente VALIDÉE/PAYÉE) ===
            const isProformaFinalization = params.isModificationMode && params.modificationInvoiceStatus === 'PROF';
            
            if (params.isModificationMode && params.modificationInvoiceId && !isProformaFinalization) {
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
                    selling_price: prixUnitaire.toString(), // On envoie le prix BRUT
                    discount: (prixUnitaire - prixNet).toFixed(0),
                    tva: ligne.produit.tva || 0, // On envoie le taux de TVA
                    lot_id: ligne.lotId ? Number(ligne.lotId) : null,
                    is_promis: !!ligne.isPromis,
                    promis_quantity: ligne.isPromis ? ligne.promisQuantity : 0,
                    promis_phone: ligne.isPromis ? (ligne.promisPhone || '') : ''
                };
            });

            // Résoudre l'ayant droit
            const ayantDroitId = await resolveAyantDroit(params, client);

            // Préparer les paiements
            const paiementsList = buildPaymentsList(params.totals, params.paiements, params.montantPaye, params.modePaiement);

            // Payload atomique final
            const finalPayload = {
                client: params.useManualClient ? null : params.selectedClient,
                client_name_override: params.useManualClient ? params.manualClientName : null,
                ayant_droit: ayantDroitId,
                remise: (Number(params.totals.remiseMontant) || 0).toFixed(0),
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
                totals: {
                    totalTtc: params.totals.totalTtc,
                    totalHt: params.totals.totalHt,
                    totalTva: params.totals.totalTva,
                },
                sudo: {
                    validated_by_id: params.validated_by_id,
                    sudo_password: params.sudo_password
                },
                type: params.isRetrocession ? 'RETRO' : 'STD',
                centralized_cash_register: params.centralizedCashRegister,
                poste_caisse_id: params.poste_caisse_id,
                coupon_numero: params.couponNumero,
                existing_id: params.modificationInvoiceId, // Pass existing ID to reuse the record
                image_ordonnance: params.prescriptionImage
            };

            const finalFacture = await venteService.finaliser(finalPayload);

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
                            promisQuantity: l.promisQuantity || 0,
                            produit: l.produit,
                            date_promis: new Date().toISOString(),
                            status: 'ATT'
                        } satisfies PromisItem)),
                        pharmacy: pharmacySettings,
                        facture_id: finalFacture.numero_facture || finalFacture.id,
                        is_paid: !params.centralizedCashRegister
                    });
                } catch (err: unknown) {
                    console.error("Erreur génération PDF promis:", err);
                }
            }

            // 2. Impression Facture/Ticket et Notifications
            if (!params.centralizedCashRegister) {
                const totalVerse = paiementsList.reduce((acc: number, p) => acc + p.montant, 0);
                const rendu = totalVerse - Number(finalFacture.total_ttc);
                
                // Construire le ticket pour l'UI
                const clientNameForTicket = finalFacture.client_name_override
                    || finalFacture.client_name
                    || params.manualClientName
                    || 'Client de passage';

                if (params.isFactureA4) {
                    window.open(`/app/print-invoice/${finalFacture.id}`, '_blank');
                }

                const ticketCaisse: TicketCaisse = {
                    id: finalFacture.id,
                    facture: finalFacture,
                    mode_paiement: paiementsList.length > 1 ? 'Mixte' : (paiementsList[0]?.mode as TicketCaisse['mode_paiement'] || 'N/A'),
                    montant: finalFacture.total_ttc,
                    montant_verse: totalVerse.toString(),
                    rendu: rendu.toString(),
                    statut: 'completee',
                    client_name: clientNameForTicket,
                    paiements_details: paiementsList,
                    date_paiement: new Date().toISOString(),
                    user_details: { id: 0, username: finalFacture.validated_by_name || finalFacture.created_by_name || '' },
                    reference: params.reference || null
                };

                toast.success(t('messages.success_with_id', { id: finalFacture.numero_facture || finalFacture.id }));

                const result: SaleCompletionResult = { success: true, facture: finalFacture, ticketCaisse, rendu };
                setLastResult(result);
                onSuccess?.(result);
                onReset?.();
                return result;
            } else {
                toast.success(t('messages.sent_to_caisse', { id: finalFacture.numero_facture || finalFacture.id }));
                const result: SaleCompletionResult = { success: true, facture: finalFacture };
                setLastResult(result);
                onSuccess?.(result);
                onReset?.();
                return result;
            }

        } catch (err: unknown) {
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
        resolveAyantDroit, handleModificationMode,
        pharmacySettings, t, onSuccess, onError, onReset
    ]);

    /**
     * Gérer le paiement d'une facture existante (devis, proforma, attente)
     */
    const completeExistingInvoicePayment = useCallback(async (params: {
        facture: Facture;
        paiements?: PaymentDetails[];
        montantPaye: string;
        modePaiement: string;
        reference?: string;
        lignesFacture: LigneFacture[]; // Nécessaire pour Promis
        tempOrdonnanceData: OrdonnanceData | null;
        promisPhone?: string;
        promisClientName?: string;
        useManualClient?: boolean;
        manualClientName?: string;
        prescriptionImage?: File | null;
    }): Promise<SaleCompletionResult> => {
        setLoading(true);
        setError(null);

        try {
            const { facture, paiements, montantPaye, modePaiement, reference } = params;

            const paiementsList = (paiements && paiements.length > 0)
                ? paiements
                : [{ mode: modePaiement, montant: Number(montantPaye) }];

            let totalVerse = 0;

            // 1. Enregistrer les paiements
            const montantADevoir = (facture.part_client !== null && Number(facture.part_client) >= 0)
                ? Number(facture.part_client)
                : Number(facture.total_ttc);

            let resteAEnregistrer = montantADevoir;

            await Promise.all(paiementsList.map(async (p) => {
                const isRefund = montantADevoir < 0;
                if (!isRefund && resteAEnregistrer <= 0) return;
                if (isRefund && resteAEnregistrer >= 0) return;

                const montantReel = isRefund
                    ? Math.max(p.montant, resteAEnregistrer)
                    : Math.min(p.montant, resteAEnregistrer);
                const payload = {
                    facture_id: facture.id,
                    mode_paiement: p.mode,
                    montant: montantReel,
                    reference: reference || null,
                    statut: 'completee',
                };
                await caisseService.createPaiement(payload);
                resteAEnregistrer -= montantReel;
                totalVerse += montantReel;
            }));

            // 2. Mettre à jour le statut de la facture
            await venteService.update(facture.id, { status: 'PAY' });

            // 3. Rafraîchir les données
            const updatedFacture = await venteService.getById(facture.id);

            const rendu = totalVerse - Number(updatedFacture.total_ttc);

            // 4. GESTION DES PROMIS (Unifiée) — Créer en DB puis générer le ticket
            const promisLines = params.lignesFacture.filter(l => l.isPromis && l.promisQuantity && l.promisQuantity > 0);
            if (promisLines.length > 0) {
                try {
                    // Créer les Promis en base de données via l'API
                    await Promise.all(promisLines.map(l =>
                        promisService.create({
                            facture: facture.id,
                            produit: l.produit.id,
                            quantite: l.promisQuantity,
                            client_phone: params.promisPhone || l.promisPhone || '',
                            client_name: params.promisClientName || '',
                            client: facture.client || undefined,
                        })
                    ));

                    // Générer le ticket PDF
                    generatePromisTicket({
                        client_name: updatedFacture.client_name || params.manualClientName || 'Client',
                        client_phone: params.promisPhone || params.lignesFacture.find(l => l.promisPhone)?.promisPhone,
                        items: promisLines.map(l => ({
                            id: 0,
                            produit_nom: l.produit.name,
                            promisQuantity: l.promisQuantity || 0,
                            produit: l.produit,
                            date_promis: new Date().toISOString(),
                            status: 'ATT'
                        } satisfies PromisItem)),
                        pharmacy: pharmacySettings,
                        facture_id: updatedFacture.numero_facture || updatedFacture.id,
                        is_paid: true
                    });
                    toast.success(t('messages.promis_recorded'));
                } catch (err: unknown) {
                    console.error("Erreur création/génération promis:", err);
                }
            }

            // 5. GESTION ORDONNANCIER (Unifiée)
            if (params.tempOrdonnanceData) {
                try {
                    await ordonnancierService.create({
                        ...params.tempOrdonnanceData,
                        facture: updatedFacture.id,
                        image_ordonnance: params.prescriptionImage,
                        lignes: params.tempOrdonnanceData.lignes.map(l => ({
                            produit: l.produit_id,
                            produit_nom: l.produit_nom,
                            quantite: l.quantite,
                            surveillance_category: l.surveillance_category || 'NONE'
                        }))
                    });
                    toast.success(t('messages.prescription_recorded'));
                } catch (err: unknown) {
                    console.error("Erreur ordonnancier:", err);
                }
            }

            // 6. Impression Facture A4
            window.open(`/app/print-invoice/${updatedFacture.id}`, '_blank');

            // 7. Ticket UI
            // Priorité: client_name_override > client_name > nom du client > 'Client de passage'
            const clientNameForTicket = updatedFacture.client_name_override
                || updatedFacture.client_name
                || 'Client de passage';

            const ticketCaisse: TicketCaisse = {
                id: updatedFacture.id,
                facture: updatedFacture,
                mode_paiement: paiementsList.length > 1 ? 'Mixte' : (paiementsList[0].mode as TicketCaisse['mode_paiement']),
                montant: updatedFacture.total_ttc,
                montant_verse: totalVerse.toString(),
                rendu: rendu.toString(),
                statut: 'completee',
                client_name: clientNameForTicket,
                date_paiement: new Date().toISOString(),
                paiements_details: paiementsList,
                user_details: { id: 0, username: updatedFacture.validated_by_name || updatedFacture.created_by_name || '' },
                reference: reference || null
            };

            const result: SaleCompletionResult = { success: true, facture: updatedFacture, ticketCaisse, rendu };
            setLastResult(result);
            onSuccess?.(result);
            onReset?.();
            return result;

        } catch (err: unknown) {
            console.error('Invoice Payment Error:', err);
            const errorMessage = extractErrorMessage(err);
            setError(errorMessage);
            onError?.(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setLoading(false);
        }
    }, [pharmacySettings, t, onSuccess, onError, onReset]);

    return {
        completeSale,
        completeExistingInvoicePayment,
        loading,
        error,
        lastResult
    };
}

export default useSaleCompletion;
