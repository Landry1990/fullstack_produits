import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { Inventaire, LigneInventaire, InventoryStats, ProduitModel } from '../../types';

export const useInventaireEditor = (
    fetchInventaires: () => void,
    setViewMode: (mode: 'LIST' | 'CREATE' | 'EDIT' | 'AUDIT') => void,
    requireSudo: (action: (validatorId: number, password?: string) => Promise<void>, options?: { title?: string; message?: string; permission?: string }) => void,
    confirm: (options: { title?: string; message: string; variant?: 'success' | 'warning' | 'danger' | 'info'; confirmText?: string }) => Promise<boolean>
) => {
    const { t } = useTranslation(['stock', 'common']);

    const [activeInventaire, setActiveInventaire] = useState<Inventaire | null>(null);
    const [lignes, setLignes] = useState<LigneInventaire[]>([]);
    const [saving, setSaving] = useState(false);
    const [autoSaving, setAutoSaving] = useState(false);
    const [importing, setImporting] = useState(false);
    const [inventoryStats, setInventoryStats] = useState<InventoryStats | null>(null);

    // Header fields
    const [dateInventaire, setDateInventaire] = useState('');
    const [description, setDescription] = useState('');

    // Line selection and bulk actions
    const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());

    const isReadOnly = activeInventaire?.status === 'VALIDEE';

    const handleCreate = async () => {
        // Now handled by handleCreateWithOptions, but keep default for backward compatibility if needed
        return handleCreateWithOptions({ action: 'ENTRY', stockType: 'GLOBAL' });
    };

    const handleCreateWithOptions = async (options: {
        action: 'VERIFY' | 'ENTRY';
        stockType: 'GLOBAL' | 'RAYON' | 'RESERVE';
        rayonId?: number;
        groupeId?: number;
        formeId?: number;
    }) => {
        try {
            setSaving(true);
            // 1. Create the inventory header
            const response = await api.post('inventaires/', {
                date: new Date().toISOString().split('T')[0],
                description: t('inventaire.detail.placeholder_desc'),
                status: 'EN_COURS',
                inventory_type: options.stockType
            });
            const newInv = response.data;
            setActiveInventaire(newInv);
            setDateInventaire(newInv.date);
            setDescription(newInv.description || '');

            // 2. Switch to CREATE mode immediately so the editor is mounted
            setViewMode('CREATE');

            // 3. Pre-populate if requested
            if (options.action === 'VERIFY') {
                await api.post(`inventaires/${newInv.id}/pre_populate/`, {
                    rayon_id: options.rayonId,
                    groupe_id: options.groupeId,
                    forme_id: options.formeId
                });
                // Reload lines and stats
                const [linesRes, statsRes] = await Promise.all([
                    api.get(`inventaires/${newInv.id}/lignes/`),
                    api.get(`inventaires/${newInv.id}/stats/`).catch(() => ({ data: null }))
                ]);

                setLignes(linesRes.data.map((l: LigneInventaire) => ({ ...l, isLocalOnly: false })));
                if (statsRes.data) setInventoryStats(statsRes.data);
            } else {
                setLignes([]);
                setInventoryStats(null);
            }

            return newInv;
        } catch (error) {
            console.error(error);
            toast.error(t('inventaire.detail.auto_create_error'));
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = async (inv: Inventaire) => {
        setActiveInventaire(inv);
        setDateInventaire(inv.date);
        setDescription(inv.description || '');
        setViewMode('EDIT');
        try {
            const res = await api.get(`inventaires/${inv.id}/lignes/`);
            const fetchedLignes = res.data.map((l: LigneInventaire) => ({
                ...l,
                isLocalOnly: false
            }));
            setLignes(fetchedLignes);
            await fetchInventoryStats(inv.id);
        } catch (error) {
            console.error(error);
            toast.error(t('common:messages.error_loading'));
        }
    };

    const handleSaveHeader = async () => {
        if (!activeInventaire) return;
        try {
            await api.patch(`inventaires/${activeInventaire.id}/`, {
                date: dateInventaire,
                description
            });
            toast.success(t('inventaire.detail.header_saved'));
            // Optionally update the active inventaire object
            setActiveInventaire(prev => prev ? { ...prev, date: dateInventaire, description } : null);
        } catch (err) {
            toast.error(t('inventaire.detail.save_error'));
        }
    };


    const handleUpdateQuantity = async (lineId: number, newQty: number) => {
        // Optimistic update
        setLignes(prev => prev.map(l => {
            if (l.id === lineId) {
                const ecart = newQty - l.stock_theorique;
                return { ...l, quantite_physique: newQty, ecart };
            }
            return l;
        }));

        const line = lignes.find(l => l.id === lineId);
        if (line?.isLocalOnly) return;

        try {
            await api.patch(`lignes-inventaire/${lineId}/`, { quantite_physique: newQty });
        } catch (err) {
            console.error("Erreur update quantite", err);
            // Optionally, revert pessimistic update on error by fetching again
        }
    };

    const handleDeleteLine = async (lineId: number) => {
        const confirmed = await confirm({
            title: 'Retirer le produit',
            message: 'Retirer ce produit de l\'inventaire ?',
            variant: 'warning',
            confirmText: 'Retirer'
        });
        if (!confirmed) return;

        try {
            const line = lignes.find(l => l.id === lineId);
            if (line && !line.isLocalOnly) {
                await api.delete(`lignes-inventaire/${lineId}/`);
            }
            setLignes(prev => prev.filter(l => l.id !== lineId));
        } catch (err) {
            console.error("Erreur suppression ligne", err);
            toast.error(t('inventaire.lines.delete_error'));
        }
    };

    const toggleSelectLine = (id: number) => {
        const newSet = new Set(selectedLines);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedLines(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedLines.size === lignes.length) {
            setSelectedLines(new Set());
        } else {
            setSelectedLines(new Set(lignes.map(l => l.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedLines.size === 0) return;

        const confirmed = await confirm({
            title: t('inventaire.detail.bulk_delete_title'),
            message: t('inventaire.detail.bulk_delete_message', { count: selectedLines.size }),
            variant: 'danger',
            confirmText: t('inventaire.detail.bulk_delete_confirm')
        });
        if (!confirmed) return;

        try {
            setSaving(true);
            const idsToDelete = Array.from(selectedLines);

            const remoteIds = idsToDelete.filter(id => {
                const line = lignes.find(l => l.id === id);
                return line && !line.isLocalOnly;
            });

            // 1. Suppression distante groupée
            if (remoteIds.length > 0 && activeInventaire) {
                await api.post(`inventaires/${activeInventaire.id}/lignes/bulk-delete/`, {
                    ids: remoteIds
                });
            }

            // 2. Mise à jour locale
            setLignes(prev => prev.filter(l => !selectedLines.has(l.id)));
            setSelectedLines(new Set());
            toast.success(t('inventaire.detail.bulk_delete_success', { count: idsToDelete.length }));

        } catch (err) {
            console.error("Erreur suppression bulk", err);
            toast.error(t('inventaire.detail.save_error'));
        } finally {
            setSaving(false);
        }
    };

    const fetchInventoryStats = async (id: number) => {
        try {
            const res = await api.get(`inventaires/${id}/stats/`);
            setInventoryStats(res.data);
        } catch (error) {
            console.error("Failed to fetch inventory stats", error);
        }
    };

    const handleValidateConfirm = async (creds: { validated_by_id: number; sudo_password: string }) => {
        if (!activeInventaire) return;

        try {
            setSaving(true);
            await api.post(`inventaires/${activeInventaire.id}/validate/`, creds);
            toast.success(t('inventaire.validation.success'));
            setViewMode('LIST');
            fetchInventaires();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } } };
            toast.error(error.response?.data?.detail || t('inventaire.validation.error'));
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleOpenValidateModal = async () => {
        if (!activeInventaire) return;

        // Auto-save local lines before validation
        const linesToSync = lignes.filter(l => l.isLocalOnly);
        if (linesToSync.length > 0) {
            setSaving(true);
            try {
                const payload = {
                    lignes: linesToSync.map(l => ({
                        produit: typeof l.produit === 'object' ? l.produit.id : l.produit,
                        stock_lot: l.stock_lot,
                        quantite_physique: l.quantite_physique,
                        lot_numero: l.lot_numero,
                        lot_expiration: l.lot_expiration
                    }))
                };
                await api.post(`inventaires/${activeInventaire.id}/lignes/bulk/`, payload);
                const res = await api.get(`inventaires/${activeInventaire.id}/lignes/`);
                setLignes(res.data.map((l: LigneInventaire) => ({ ...l, isLocalOnly: false })));
            } catch (err) {
                console.error("Auto-save before validate failed", err);
                toast.error(t('inventaire.detail.save_error'));
                setSaving(false);
                return; // Stop if auto-save fails
            } finally {
                setSaving(false);
            }
        }

        requireSudo(
            async (validatorId, password) => {
                await handleValidateConfirm({ validated_by_id: validatorId, sudo_password: password || '' });
            },
            {
                title: t('inventaire.validation.title'),
                message: t('inventaire.validation.message')
            }
        );
    };

    const handleManualSave = async () => {
        if (!activeInventaire) return;
        setSaving(true);
        try {
            // 1. Save Header
            await api.patch(`inventaires/${activeInventaire.id}/`, {
                date: dateInventaire,
                description
            });
            setActiveInventaire(prev => prev ? { ...prev, date: dateInventaire, description } : null);

            // 2. Sync Lines
            const linesToSync = lignes.filter(l => l.isLocalOnly);
            if (linesToSync.length > 0) {
                const payload = {
                    lignes: linesToSync.map(l => ({
                        produit: typeof l.produit === 'object' ? l.produit.id : l.produit,
                        stock_lot: l.stock_lot,
                        quantite_physique: l.quantite_physique,
                        lot_numero: l.lot_numero,
                        lot_expiration: l.lot_expiration
                    }))
                };
                await api.post(`inventaires/${activeInventaire.id}/lignes/bulk/`, payload);
                const res = await api.get(`inventaires/${activeInventaire.id}/lignes/`);
                setLignes(res.data.map((l: LigneInventaire) => ({ ...l, isLocalOnly: false })));
                await fetchInventoryStats(activeInventaire.id);
            }

            toast.success(t('common:messages.saved'));
        } catch (error) {
            console.error("Erreur save manual", error);
            toast.error(t('inventaire.detail.save_error'));
        } finally {
            setSaving(false);
        }
    };

    const handleImportCSV = async (file: File) => {
        if (!activeInventaire) return;

        setImporting(true);

        // 1. Charger TOUS les produits pour le matching (optimisé)
        let allProducts: ProduitModel[] = [];
        try {
            const response = await api.get('produits/for_import/');
            allProducts = Array.isArray(response.data) ? response.data : (response.data.results || []);
        } catch (err) {
            toast.error("Erreur lors du chargement des produits pour l'import");
            console.error(err);
            setImporting(false);
            return;
        }

        // Helper de normalisation CIP (identique à Commandes.tsx)
        const normalizeCip = (cip: string | null | undefined): string => {
            if (!cip) return '';
            let normalized = cip.trim().replace(/[\s\-\.]/g, '');
            return normalized.toUpperCase();
        };

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) {
                setImporting(false);
                return;
            }

            const lines = text.split(/\r\n|\n/);
            const importMap = new Map<number, number>(); // productId -> totalQuantity
            let productsFoundCount = 0;
            const notFoundItems: { cip: string; qty: string }[] = [];

            // Détection du délimiteur (simple sur la première ligne significative)
            let delimiter = ';';
            for (const line of lines) {
                if (line.trim() && line.includes(',')) {
                    if (!line.includes(';')) delimiter = ',';
                    break;
                }
            }

            // Parsing et Matching
            lines.forEach((line, index) => {
                if (!line.trim() || index === 0) return; // Sauter en-tête ou vide

                const parts = line.split(delimiter);
                const rawCip = parts[0]?.trim();
                const rawQty = parts[1]?.trim() || '1';

                if (!rawCip) return;

                const normalizedSearchCip = normalizeCip(rawCip);
                const numericSearch = normalizedSearchCip.replace(/^0+/, '');

                const product = allProducts.find(p => {
                    const norms = [normalizeCip(p.cip1), normalizeCip(p.cip2), normalizeCip(p.cip3)];
                    if (norms.includes(normalizedSearchCip)) return true;
                    if (numericSearch && norms.some(n => n.replace(/^0+/, '') === numericSearch)) return true;
                    return false;
                });

                if (product) {
                    const qty = parseFloat(rawQty.replace(',', '.')) || 0;
                    if (qty > 0) {
                        const current = importMap.get(product.id) || 0;
                        importMap.set(product.id, current + qty);
                        productsFoundCount++;
                    }
                } else {
                    notFoundItems.push({ cip: rawCip, qty: rawQty });
                }
            });

            // 2. Gérer les produits non trouvés
            if (notFoundItems.length > 0) {
                const txtContent = notFoundItems.map(item => `${item.cip}${delimiter}${item.qty}`).join('\n');
                const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
                const link = document.createElement('a');
                const dateStr = new Date().toISOString().slice(0, 10);
                link.href = URL.createObjectURL(blob);
                link.download = `produits_non_reconnus_inventaire_${dateStr}.txt`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                toast.error(`${notFoundItems.length} produits non reconnus. Fichier rapport téléchargé.`);
            }

            if (importMap.size === 0) {
                toast.error("Aucun produit valide trouvé dans le fichier.");
                setImporting(false);
                return;
            }

            // 3. Envoyer les données matchées au backend via bulk
            try {
                const payload = {
                    lignes: Array.from(importMap.entries()).map(([productId, qty]) => ({
                        produit: productId,
                        quantite_physique: qty,
                        stock_lot: null // L'import CSV standard ne gère pas encore les lots explicitement
                    }))
                };

                await api.post(`inventaires/${activeInventaire.id}/lignes/bulk/`, payload);

                toast.success(`${importMap.size} produits importés (${productsFoundCount} lignes).`);

                // Recharger les lignes et stats
                const res = await api.get(`inventaires/${activeInventaire.id}/lignes/`);
                setLignes(res.data.map((l: LigneInventaire) => ({ ...l, isLocalOnly: false })));
                await fetchInventoryStats(activeInventaire.id);
            } catch (error: unknown) {
                console.error("Erreur lors de l'envoi bulk", error);
                const err = error as { response?: { data?: { detail?: string } } };
                toast.error(err.response?.data?.detail || "Erreur lors de l'enregistrement des lignes importées.");
            } finally {
                setImporting(false);
            }
        };

        reader.onerror = () => {
            toast.error("Erreur de lecture du fichier.");
            setImporting(false);
        };

        reader.readAsText(file);
    };

    const autoSaveInvRef = useRef({ activeInventaire, lignes, saving });
    useEffect(() => {
        autoSaveInvRef.current = { activeInventaire, lignes, saving };
    });

    useEffect(() => {
        const interval = setInterval(async () => {
            const { activeInventaire: inv, lignes: currentLignes, saving: isSaving } = autoSaveInvRef.current;
            if (!inv || isSaving) return;
            if (inv.status === 'VALIDEE') return;

            const linesToSync = currentLignes.filter(l => l.isLocalOnly);
            if (linesToSync.length === 0) return;

            setAutoSaving(true);
            try {
                const payload = {
                    lignes: linesToSync.map(l => ({
                        produit: typeof l.produit === 'object' ? l.produit.id : l.produit,
                        stock_lot: l.stock_lot,
                        quantite_physique: l.quantite_physique,
                        lot_numero: l.lot_numero,
                        lot_expiration: l.lot_expiration
                    }))
                };
                await api.post(`inventaires/${inv.id}/lignes/bulk/`, payload);
                const res = await api.get(`inventaires/${inv.id}/lignes/`);
                setLignes(res.data.map((l: LigneInventaire) => ({ ...l, isLocalOnly: false })));
            } catch (err) {
                console.error("Inventaire auto-save error:", err);
            } finally {
                setAutoSaving(false);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    return {
        activeInventaire, setActiveInventaire,
        lignes, setLignes,
        dateInventaire, setDateInventaire,
        description, setDescription,
        saving, setSaving,
        autoSaving,
        isReadOnly, importing,
        selectedLines, setSelectedLines,
        handleCreate, handleEdit, handleCreateWithOptions,
        handleSaveHeader, handleManualSave, handleImportCSV,
        handleUpdateQuantity, handleDeleteLine,
        toggleSelectLine, toggleSelectAll, handleBulkDelete,
        handleOpenValidateModal,
        inventoryStats, fetchInventoryStats
    };
};

