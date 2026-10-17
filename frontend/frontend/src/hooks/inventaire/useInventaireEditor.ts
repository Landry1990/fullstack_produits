import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import { gooeyToast } from 'goey-toast';
import { useTranslation } from 'react-i18next';
import type { Inventaire, LigneInventaire, InventoryStats } from '../../types';
import { getProduitId } from '../../types/inventory';
import { logger } from '../../utils/logger'

interface FocusInfo {
    id: string;
    selectionStart: number | null;
    selectionEnd: number | null;
    value: string;
}

const buildBulkPayload = (lines: LigneInventaire[]) => ({
    lignes: lines.map(l => ({
        produit: getProduitId(l.produit),
        stock_lot: l.stock_lot,
        quantite_physique: l.quantite_physique,
        lot_numero: l.lot_numero,
        lot_expiration: l.lot_expiration
    }))
});

/**
 * Fusionne les lignes renvoyées par POST lignes/bulk/ dans l'état local.
 * Les lignes locales synchronisées (syncedTempIds) sont remplacées par leur
 * version persistée ; les lignes retournées dont l'id existe déjà sont mises
 * à jour en place (merge côté backend) ; les nouvelles sont ajoutées en fin
 * de liste — même ordre que le refetch complet qu'on évite désormais.
 */
const mergeBulkLignes = (
    prev: LigneInventaire[],
    returned: LigneInventaire[],
    syncedTempIds: ReadonlySet<number>
): LigneInventaire[] => {
    const normalized = returned.map(l => ({ ...l, isLocalOnly: false }));
    const normalizedById = new Map(normalized.map(l => [l.id, l]));
    const kept = prev.filter(l => !(l.isLocalOnly && syncedTempIds.has(l.id)));
    const keptIds = new Set(kept.map(l => l.id));
    const merged = kept.map(l => normalizedById.get(l.id) ?? l);
    const fresh = normalized.filter(l => !keptIds.has(l.id));
    return [...merged, ...fresh];
};

function preserveFocus(): FocusInfo | null {
    const active = document.activeElement;
    if (!active || !(active instanceof HTMLInputElement)) return null;
    return {
        id: active.id,
        selectionStart: active.selectionStart,
        selectionEnd: active.selectionEnd,
        value: active.value
    };
}

function restoreFocus(focusInfo: FocusInfo | null) {
    if (!focusInfo) return;
    const el = document.getElementById(focusInfo.id);
    if (el && el instanceof HTMLInputElement) {
        el.focus();
        if (focusInfo.value !== undefined && el.value !== focusInfo.value) {
            // If the input was modified by a state update, keep the current value
            // to avoid overwriting what the user is typing.
        }
        if (focusInfo.selectionStart !== null && focusInfo.selectionEnd !== null) {
            try {
                el.setSelectionRange(focusInfo.selectionStart, focusInfo.selectionEnd);
            } catch {
                // ignore if input type doesn't support selection
            }
        }
    }
}

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

    // Auto-save: track lines with unsaved quantity changes
    const [dirtyLineIds, setDirtyLineIds] = useState<Set<number>>(new Set());
    const pendingChangesRef = useRef<Map<number, number>>(new Map());
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const localOnlyDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isReadOnly = activeInventaire?.status === 'VALIDEE';

    /**
     * Applique la réponse de POST lignes/bulk/ : utilise les lignes renvoyées
     * par le backend pour mettre à jour l'état sans GET complet.
     * Fallback sur le refetch si le backend ne renvoie pas 'lignes'.
     */
    const applyBulkResponse = async (
        inventaireId: number,
        response: { data?: { lignes?: LigneInventaire[] } },
        syncedTempIds: Set<number>
    ) => {
        if (Array.isArray(response?.data?.lignes)) {
            const returned = response.data.lignes;
            setLignes(prev => mergeBulkLignes(prev, returned, syncedTempIds));
        } else {
            const res = await api.get(`inventaires/${inventaireId}/lignes/`);
            setLignes(res.data.map((l: LigneInventaire) => ({ ...l, isLocalOnly: false })));
        }
    };

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
            // Reset dirty tracking
            pendingChangesRef.current = new Map();
            setDirtyLineIds(new Set());
            cancelPendingSyncs();

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

            gooeyToast.success(t('stock:inventaire.detail.create_success'));
            return newInv;
        } catch (error) {
            logger.error(error);
            gooeyToast.error(t('inventaire.detail.auto_create_error'));
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = async (inv: Inventaire) => {
        // Reset dirty tracking
        pendingChangesRef.current = new Map();
        setDirtyLineIds(new Set());
        cancelPendingSyncs();

        setActiveInventaire(inv);
        setDateInventaire(inv.date);
        setDescription(inv.description || '');
        setViewMode('EDIT');
        try {
            // Charger lignes + stats en parallèle
            const [res] = await Promise.all([
                api.get(`inventaires/${inv.id}/lignes/`),
                fetchInventoryStats(inv.id)
            ]);
            const fetchedLignes = res.data.map((l: LigneInventaire) => ({
                ...l,
                isLocalOnly: false
            }));
            setLignes(fetchedLignes);
        } catch (error) {
            logger.error(error);
            gooeyToast.error(t('common:messages.error_loading'));
        }
    };

    const handleSaveHeader = async () => {
        if (!activeInventaire) return;
        try {
            await api.patch(`inventaires/${activeInventaire.id}/`, {
                date: dateInventaire,
                description
            });
            gooeyToast.success(t('inventaire.detail.header_saved'));
            // Optionally update the active inventaire object
            setActiveInventaire(prev => prev ? { ...prev, date: dateInventaire, description } : null);
        } catch {
            gooeyToast.error(t('inventaire.detail.save_error'));
        }
    };


    // Ref to latest state for use inside async callbacks / intervals
    const autoSaveInvRef = useRef({ activeInventaire, lignes, saving, flushPendingChanges: async () => {}, syncLocalOnlyLines: async (_force?: boolean): Promise<boolean> => true });

    const flushPendingChanges = async () => {
        const pending = pendingChangesRef.current;
        if (pending.size === 0 || !activeInventaire) return;

        const focusInfo = preserveFocus();
        setAutoSaving(true);
        const updates = Array.from(pending.entries());
        pendingChangesRef.current = new Map();

        try {
            // Send all pending updates in parallel — no full reload, no toast
            await Promise.all(
                updates.map(([lineId, qty]) =>
                    api.patch(`lignes-inventaire/${lineId}/`, { quantite_physique: qty })
                )
            );
            // Clear dirty flags for successfully saved lines
            setDirtyLineIds(prev => {
                const next = new Set(prev);
                updates.forEach(([id]) => next.delete(id));
                return next;
            });
        } catch (err) {
            logger.error("Auto-save batch error:", err);
        } finally {
            setAutoSaving(false);
            restoreFocus(focusInfo);
        }
    };

    const syncLocalOnlyLines = async (force = false): Promise<boolean> => {
        const { activeInventaire: inv, lignes: currentLignes } = autoSaveInvRef.current;
        if (!inv) return true;
        if (inv.status === 'VALIDEE') return true;

        const linesToSync = currentLignes.filter(l => l.isLocalOnly);
        if (linesToSync.length === 0) return true;

        // Never disturb an active quantity input: defer if the user is typing
        // (sauf si force=true, ex. flush au démontage du composant)
        const active = document.activeElement;
        const isTyping = active instanceof HTMLInputElement && active.type === 'number';
        if (isTyping && !force) {
            // Reschedule: user is still typing, wait for the next quiet window
            scheduleLocalOnlySync();
            return false;
        }

        const focusInfo = preserveFocus();
        setAutoSaving(true);
        try {
            const payload = buildBulkPayload(linesToSync);
            const res = await api.post(`inventaires/${inv.id}/lignes/bulk/`, payload);
            await applyBulkResponse(inv.id, res, new Set(linesToSync.map(l => l.id)));
            return true;
        } catch (err) {
            logger.error("Auto-save local-only lines error:", err);
            return false;
        } finally {
            setAutoSaving(false);
            restoreFocus(focusInfo);
        }
    };

    const scheduleLocalOnlySync = useCallback(() => {
        if (localOnlyDebounceTimerRef.current) {
            clearTimeout(localOnlyDebounceTimerRef.current);
        }
        localOnlyDebounceTimerRef.current = setTimeout(() => {
            autoSaveInvRef.current.syncLocalOnlyLines();
        }, 5000);
    }, []);

    const cancelPendingSyncs = () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        if (localOnlyDebounceTimerRef.current) {
            clearTimeout(localOnlyDebounceTimerRef.current);
            localOnlyDebounceTimerRef.current = null;
        }
    };

    const handleUpdateQuantity = useCallback((lineId: number, newQty: number) => {
        // Optimistic update
        setLignes(prev => prev.map(l => {
            if (l.id === lineId) {
                const ecart = newQty - l.stock_theorique;
                return { ...l, quantite_physique: newQty, ecart };
            }
            return l;
        }));

        const line = autoSaveInvRef.current.lignes.find(l => l.id === lineId);
        if (line?.isLocalOnly) {
            // Local-only lines have no real ID yet; schedule a background sync
            // after the user stops typing so we don't disturb the active input.
            scheduleLocalOnlySync();
            return;
        }

        // Track pending change for auto-save debounce
        pendingChangesRef.current.set(lineId, newQty);
        setDirtyLineIds(prev => new Set(prev).add(lineId));

        // Reset debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            autoSaveInvRef.current.flushPendingChanges();
        }, 1500);
    }, [scheduleLocalOnlySync]);

    const handleDeleteLine = useCallback(async (lineId: number) => {
        const confirmed = await confirm({
            title: t('inventaire.lines.remove_title'),
            message: t('inventaire.lines.remove_message'),
            variant: 'warning',
            confirmText: t('inventaire.lines.remove_confirm')
        });
        if (!confirmed) return;

        try {
            const line = autoSaveInvRef.current.lignes.find(l => l.id === lineId);
            if (line && !line.isLocalOnly) {
                await api.delete(`lignes-inventaire/${lineId}/`);
            }
            setLignes(prev => prev.filter(l => l.id !== lineId));
            // Clean up dirty tracking
            pendingChangesRef.current.delete(lineId);
            setDirtyLineIds(prev => {
                const next = new Set(prev);
                next.delete(lineId);
                return next;
            });
            gooeyToast.success(t('stock:inventaire.lines.delete_success'));
        } catch (err) {
            logger.error("Erreur suppression ligne", err);
            gooeyToast.error(t('inventaire.lines.delete_error'));
        }
    }, [confirm, t]);

    const toggleSelectLine = useCallback((id: number) => {
        setSelectedLines(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const toggleSelectAll = () => {
        if (selectedLines.size === lignes.length && lignes.length > 0) {
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
            gooeyToast.success(t('inventaire.detail.bulk_delete_success', { count: idsToDelete.length }));

        } catch (err) {
            logger.error("Erreur suppression bulk", err);
            gooeyToast.error(t('inventaire.detail.save_error'));
        } finally {
            setSaving(false);
        }
    };

    const fetchInventoryStats = async (id: number) => {
        try {
            const res = await api.get(`inventaires/${id}/stats/`);
            setInventoryStats(res.data);
        } catch (error) {
            logger.error("Failed to fetch inventory stats", error);
        }
    };

    const handleValidateConfirm = async (creds: { validated_by_id: number; sudo_password: string }) => {
        if (!activeInventaire) return;

        try {
            setSaving(true);
            await api.post(`inventaires/${activeInventaire.id}/validate/`, creds);
            gooeyToast.success(t('inventaire.validation.success'));
            setViewMode('LIST');
            fetchInventaires();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } } };
            gooeyToast.error(error.response?.data?.detail || t('inventaire.validation.error'));
            logger.error(err);
            throw err;
        } finally {
            setSaving(false);
        }
    };

    const handleOpenValidateModal = async () => {
        if (!activeInventaire) return;

        // Cancel any pending debounce and flush changes
        cancelPendingSyncs();

        // Flush pending quantity changes first
        if (pendingChangesRef.current.size > 0) {
            setSaving(true);
            try {
                await flushPendingChanges();
            } catch (err) {
                logger.error("Flush before validate failed", err);
                gooeyToast.error(t('inventaire.detail.save_error'));
                setSaving(false);
                return;
            } finally {
                setSaving(false);
            }
        }

        // Auto-save local lines before validation
        const linesToSync = lignes.filter(l => l.isLocalOnly);
        if (linesToSync.length > 0) {
            setSaving(true);
            try {
                const payload = buildBulkPayload(linesToSync);
                const res = await api.post(`inventaires/${activeInventaire.id}/lignes/bulk/`, payload);
                await applyBulkResponse(activeInventaire.id, res, new Set(linesToSync.map(l => l.id)));
            } catch (err) {
                logger.error("Auto-save before validate failed", err);
                gooeyToast.error(t('inventaire.detail.save_error'));
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
                message: t('inventaire.validation.message'),
                permission: 'can_adjust_stock'
            }
        );
    };

    const handleImportCSV = async (file: File) => {
        if (!activeInventaire) return;

        setImporting(true);
        try {
            // Parsing + matching CIP côté backend (endpoint import-csv)
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post(`inventaires/${activeInventaire.id}/import-csv/`, formData);

            const data = res.data || {};
            const imported: number = data.imported ?? 0;
            const errors: string[] = Array.isArray(data.errors) ? data.errors : [];
            const notFound: { cip: string; quantite?: number }[] = Array.isArray(data.not_found) ? data.not_found : [];

            // Rapport téléchargeable des CIP non reconnus (même comportement qu'avant)
            if (notFound.length > 0) {
                const txtContent = notFound.map(item => `${item.cip};${item.quantite ?? ''}`).join('\n');
                const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
                const link = document.createElement('a');
                const objectUrl = URL.createObjectURL(blob);
                const dateStr = new Date().toISOString().slice(0, 10);
                link.href = objectUrl;
                link.download = t('inventaire.import.not_found_download_name', { date: dateStr });
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(objectUrl);

                gooeyToast.error(t('inventaire.import.not_found_toast', { count: notFound.length }));
            }

            if (errors.length > 0) {
                gooeyToast.error(t('inventaire.import.errors_count', { count: errors.length }));
            }

            if (imported > 0) {
                gooeyToast.success(t('inventaire.import.success', { count: imported, lines: data.total_rows_processed ?? imported }));
            }

            // Fusionner les lignes renvoyées (évite un rechargement complet)
            await applyBulkResponse(activeInventaire.id, res, new Set());
            await fetchInventoryStats(activeInventaire.id);
        } catch (error: unknown) {
            logger.error("Erreur lors de l'import CSV", error);
            const err = error as { response?: { data?: { error?: string; detail?: string; errors?: string[] } } };
            gooeyToast.error(
                err.response?.data?.error
                || err.response?.data?.errors?.[0]
                || err.response?.data?.detail
                || t('inventaire.import.bulk_send_error')
            );
        } finally {
            setImporting(false);
        }
    };

    useEffect(() => {
        autoSaveInvRef.current = { activeInventaire, lignes, saving, flushPendingChanges, syncLocalOnlyLines };
    });

    // Cleanup debounce timers on unmount — avec flush de dernière chance :
    // le bouton « Enregistrer » n'existe plus, l'autosave couvre tout.
    useEffect(() => {
        return () => {
            autoSaveInvRef.current.flushPendingChanges();
            autoSaveInvRef.current.syncLocalOnlyLines(true);
            cancelPendingSyncs();
        };
    }, []);

    useEffect(() => {
        const interval = setInterval(async () => {
            const { activeInventaire: inv, lignes: currentLignes, saving: isSaving, flushPendingChanges: flush, syncLocalOnlyLines: sync } = autoSaveInvRef.current;
            if (!inv || isSaving) return;
            if (inv.status === 'VALIDEE') return;

            // 1. Flush pending quantity changes first (silent, no reload)
            await flush();

            // 2. Sync local-only lines in the background (deferred if user is typing)
            const linesToSync = currentLignes.filter(l => l.isLocalOnly);
            if (linesToSync.length > 0) {
                await sync();
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
        dirtyLineIds,
        handleCreate, handleEdit, handleCreateWithOptions,
        handleSaveHeader, handleImportCSV,
        handleUpdateQuantity, handleDeleteLine,
        toggleSelectLine, toggleSelectAll, handleBulkDelete,
        handleOpenValidateModal,
        inventoryStats, fetchInventoryStats,
        flushPendingChanges, syncLocalOnlyLines, cancelPendingSyncs
    };
};

