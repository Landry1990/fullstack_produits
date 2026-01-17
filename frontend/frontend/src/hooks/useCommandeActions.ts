import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import type { Commande, CommandeProduit, User } from '../types';

interface UseCommandeActionsProps {
    apiBaseUrl: string;
    commandesEndpoint: string;
    // produitsEndpoint removed as it's derived inside
    fetchCommandes: () => Promise<void>;
    setSelectedCommande: (commande: Commande | null) => void;
    setViewMode: (mode: 'LIST' | 'CREATE' | 'DETAILS' | 'EDIT') => void;
    confirm: (options: any) => Promise<boolean>;
    user: User | null;
}

// Helper function for Date format MM/YY
function parseMMYYToDate(mmyy: string | null | undefined): string | null {
    if (!mmyy) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(mmyy)) return mmyy; // Already ISO

    const parts = mmyy.split('/');
    if (parts.length === 2 && parts[1].length === 2) {
        const month = parseInt(parts[0], 10);
        const year = parseInt('20' + parts[1], 10);
        if (month >= 1 && month <= 12) {
            const lastDay = new Date(year, month, 0).getDate();
            return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        }
    }
    return null;
}

export function useCommandeActions({
    apiBaseUrl,
    commandesEndpoint,
    fetchCommandes,
    setSelectedCommande,
    setViewMode,
    confirm,
    user
}: UseCommandeActionsProps) {

    // Password Confirmation State
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordModalConfig, setPasswordModalConfig] = useState({ title: '', message: '' });
    const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

    const handlePasswordConfirmed = () => {
        if (pendingAction) {
            pendingAction();
            setPendingAction(null);
        }
    };

    const handleApiError = (err: unknown, defaultMessage: string) => {
        // Safely log error without triggering circular reference issues
        try {
            if (axios.isAxiosError(err)) {
                console.error('API Error:', err.message, err.response?.data);
            } else if (err instanceof Error) {
                console.error('Error:', err.message);
            } else {
                console.error('Unknown error:', String(err));
            }
        } catch (logError) {
            console.error('Error logging failed');
        }

        // Extract and display error message
        if (axios.isAxiosError(err)) {
            const errorData = err.response?.data;
            const message = errorData?.message || errorData?.detail || err.message || defaultMessage;
            toast.error(message);
        } else if (err instanceof Error) {
            toast.error(err.message || defaultMessage);
        } else {
            toast.error(defaultMessage);
        }
    };

    // ============== SAUVEGARDE ==============

    // Helper function to safely clean payload (avoid circular references) 
    const cleanPayload = (data: any): any => {
        try {
            // JSON parse/stringify to remove any non-serializable references (proxies, window refs, etc.)
            return JSON.parse(JSON.stringify(data));
        } catch (e) {
            console.error('cleanPayload failed, manually cleaning:', e);
            // Manual fallback: extract only primitive/simple values
            const clean: any = {};
            for (const key of Object.keys(data)) {
                const val = data[key];
                if (val === null || val === undefined) {
                    clean[key] = val;
                } else if (typeof val === 'object' && val.constructor === Object) {
                    clean[key] = cleanPayload(val);
                } else if (Array.isArray(val)) {
                    clean[key] = val.map((v: any) => typeof v === 'object' ? cleanPayload(v) : v);
                } else if (['string', 'number', 'boolean'].includes(typeof val)) {
                    clean[key] = val;
                }
                // Skip functions, symbols, etc.
            }
            return clean;
        }
    };

    async function handleSaveCommande(
        commandeData: Partial<Commande>,
        commandeProduits: CommandeProduit[],
        viewMode: 'CREATE' | 'EDIT',
        selectedCommande: Commande | null,
        isAutoSave: boolean = false
    ) {
        // Validation basique
        if (!commandeData.fournisseur) {
            // Pas de toast en auto-save pour ne pas spammer, sauf erreur critique
            if (!isAutoSave) toast.error('Veuillez sélectionner un fournisseur');
            return;
        }

        try {
            let commandeId = selectedCommande?.id;

            // Clean the command data to remove any non-serializable references
            const cleanedCommandeData = cleanPayload(commandeData);
            if (!isAutoSave) console.log('Saving commande with data:', cleanedCommandeData);

            // 1. Créer ou mettre à jour la commande
            if (viewMode === 'CREATE') {
                const response = await axios.post<Commande>(commandesEndpoint, cleanedCommandeData);
                commandeId = response.data.id;
                if (!isAutoSave) toast.success(`Commande #${commandeId} créée`);

                // Important pour l'auto-save: mise à jour immédiate du mode et de la commande
                if (isAutoSave) {
                    // Fetch full object to get correct structure
                    const { data: createdCmd } = await axios.get<Commande>(`${commandesEndpoint}${commandeId}/`);
                    setSelectedCommande(createdCmd);
                    setViewMode('EDIT');
                }

            } else if (viewMode === 'EDIT' && commandeId) {
                await axios.patch<Commande>(`${commandesEndpoint}${commandeId}/`, cleanedCommandeData);
                if (!isAutoSave) toast.success('Commande mise à jour');
            }

            if (!commandeId) throw new Error("ID de commande manquant");

            // 2. Gérer les produits
            const commandeProduitsEndpoint = apiBaseUrl
                ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/commande-produits/`
                : '/api/commande-produits/';

            // Récupérer les produits existants pour comparer
            let existingProducts: { id: number }[] = [];

            // Toujours récupérer les produits actuels pour être sûr de l'état
            if (commandeId) {
                const { data: currentOrder } = await axios.get<Commande>(`${commandesEndpoint}${commandeId}/`);
                existingProducts = currentOrder.produits ? currentOrder.produits.map((p: any) => ({ id: p.id })) : [];
            }

            // Identifier les produits à supprimer (ceux qui ne sont plus dans commandeProduits)
            const existingIds = new Set(existingProducts.map(ep => ep.id));

            for (const p of commandeProduits) {
                const payload = {
                    commande: commandeId,
                    produit: typeof p.produit === 'object' ? p.produit.id : p.produit,
                    quantity: parseInt(String(p.quantity)),
                    unites_gratuites: parseInt(String(p.unites_gratuites || 0)),
                    price: parseFloat(String(p.price)).toFixed(2),
                    price_cost: parseFloat(String(p.price)).toFixed(2), // Assumant price est cost
                    selling_price: p.selling_price ? parseFloat(String(p.selling_price)).toFixed(2) : '0.00',
                    prix_euro: p.prix_euro ? parseFloat(String(p.prix_euro)).toFixed(2) : null,
                    tva: parseFloat(String(p.tva || 18)).toFixed(2),
                    marge: parseFloat(String(p.marge || 1.3)).toFixed(4),
                    lot: p.lot || null,
                    date_expiration: parseMMYYToDate(p.date_expiration)
                };

                // Fix: Check if ID is a real existing ID in the backend, not a temp timestamp
                // Using existingIds check is safer than just p.id
                if (p.id && existingIds.has(p.id)) {
                    // Update existing line
                    await axios.patch(`${commandeProduitsEndpoint}${p.id}/`, payload);
                } else {
                    // Create new line (ignore temporary p.id)
                    await axios.post(commandeProduitsEndpoint, payload);
                }
            }

            // Handle deletions if needed (lines present in DB but not in current list)
            // Only logical if we are in EDIT mode effectively (which we are if commandeId exists)
            if (commandeId) {
                const currentIds = new Set(commandeProduits.filter(p => p.id && existingIds.has(p.id)).map(p => p.id));
                for (const exist of existingProducts) {
                    if (!currentIds.has(exist.id)) {
                        await axios.delete(`${commandeProduitsEndpoint}${exist.id}/`);
                    }
                }
            }

            if (!isAutoSave) {
                fetchCommandes();
                setViewMode('LIST');
            } else {
                // En auto-save, on refetch juste pour avoir l'état à jour sans changer de vue
                // fetchCommandes(); // Peut-être pas nécessaire de refresh toute la liste tout de suite
            }

        } catch (err) {
            if (!isAutoSave) {
                handleApiError(err, "Erreur lors de l'enregistrement de la commande");
            } else {
                console.error("Erreur Auto-save:", err);
            }
        }
    }

    // ============== SUPPRESSION ==============
    const executeDelete = async (commandeId: number) => {
        try {
            await axios.delete(`${commandesEndpoint}${commandeId}/`);
            toast.success("Commande supprimée");
            fetchCommandes();
            setSelectedCommande(null);
            setViewMode('LIST');
        } catch (err) {
            handleApiError(err, "Erreur lors de la suppression de la commande");
        }
    };

    const handleDeleteCommande = async (commande: Commande) => {
        // Permission Check
        if (!user?.is_superuser && !user?.can_delete_commande) {
            toast.error("Accès refusé : Vous n'avez pas la permission de supprimer des commandes.");
            return;
        }

        const confirmed = await confirm({
            title: 'Supprimer la commande',
            message: `Êtes-vous sûr de vouloir supprimer la commande #${commande.id} ?`,
            variant: 'danger',
            confirmText: 'Supprimer'
        });

        if (confirmed) {
            setPasswordModalConfig({
                title: "Suppression de commande",
                message: "Vous êtes sur le point de supprimer une commande. Confirmez votre mot de passe."
            });
            setPendingAction(() => () => executeDelete(commande.id));
            setIsPasswordModalOpen(true);
        }
    };

    // ============== CLÔTURE ==============
    const executeCloture = async (commandeId: number) => {
        try {
            const response = await axios.post(`${commandesEndpoint}${commandeId}/cloturer/`);
            toast.success(response.data.message || "Commande clôturée avec succès");

            fetchCommandes();

            // Update selected commande if it's the one we just closed
            const { data: updated } = await axios.get<Commande>(`${commandesEndpoint}${commandeId}/`);
            setSelectedCommande(updated);

        } catch (err) {
            handleApiError(err, "Erreur lors de la clôture");
        }
    };

    const handleCloturerCommande = async (commande: Commande) => {
        const confirmed = await confirm({
            title: 'Clôturer la commande',
            message: `Confirmez-vous la réception de la commande #${commande.id} ? Cela mettra à jour le stock.`,
            confirmText: 'Confirmer la réception'
        });

        if (confirmed) {
            setPasswordModalConfig({
                title: "Confirmer la réception",
                message: "Cette action va mettre à jour le stock et les prix d'achat. Veuillez confirmer votre mot de passe."
            });
            setPendingAction(() => () => executeCloture(commande.id));
            setIsPasswordModalOpen(true);
        }
    };

    // ============== METTRE EN ATTENTE ==============
    const handleMettreEnAttente = async (commande: Commande) => {
        try {
            const newStatus = commande.status === 'ATT' ? 'PREP' : 'ATT';
            await axios.patch(`${commandesEndpoint}${commande.id}/`, { status: newStatus });
            toast.success(`Statut mis à jour : ${newStatus === 'ATT' ? 'En attente' : 'En préparation'}`);

            const { data: updated } = await axios.get<Commande>(`${commandesEndpoint}${commande.id}/`);
            setSelectedCommande(updated);
            fetchCommandes();
        } catch (err) {
            handleApiError(err, "Erreur lors du changement de statut");
        }
    };

    // ============== ANNULER RÉCEPTION ==============
    const executeAnnulerReception = async (commandeId: number) => {
        try {
            const response = await axios.post(`${commandesEndpoint}${commandeId}/annuler_reception/`);
            toast.success(`Réception annulée : ${response.data.details?.produits_affectes || 0} produits affectés.`);

            fetchCommandes();
            const { data: updated } = await axios.get<Commande>(`${commandesEndpoint}${commandeId}/`);
            setSelectedCommande(updated);
        } catch (err) {
            handleApiError(err, "Erreur lors de l'annulation de la réception");
        }
    };

    const handleAnnulerReception = (commande: Commande) => {
        if (commande.status !== 'CLOT') {
            toast.error("Seule une commande clôturée peut être annulée.");
            return;
        }

        setPasswordModalConfig({
            title: "Annuler la réception",
            message: "Cette action va retirer le stock ajouté lors de la clôture. Confirmez votre mot de passe."
        });
        setPendingAction(() => () => executeAnnulerReception(commande.id));
        setIsPasswordModalOpen(true);
    };

    // ============== IMPRESSION ==============
    const handleImprimerReception = async (commande: Commande) => {
        try {
            const imprimerEndpoint = `${commandesEndpoint}${commande.id}/imprimer_reception/`;
            const response = await axios.get(imprimerEndpoint, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `reception_commande_${commande.id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (err) {
            handleApiError(err, "Erreur lors de l'impression");
        }
    };

    return {
        handleSaveCommande,
        handleDeleteCommande,
        handleCloturerCommande,
        handleMettreEnAttente,
        handleAnnulerReception,
        handleImprimerReception,

        // Password Modal Exports
        isPasswordModalOpen,
        setIsPasswordModalOpen,
        passwordModalConfig,
        handlePasswordConfirmed
    };
}
