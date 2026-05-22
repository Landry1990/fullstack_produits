/**
 * Hook de synchronisation offline
 * Orchestre la détection réseau (NetInfo) et la sync automatique des factures
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { invoiceSyncService } from '../services';
import { invoiceRepo } from '../database';
import { useConnectionStore } from '../stores';
import { APP_CONFIG } from '../config';
import type { InvoiceStatus } from '../types';

interface UseOfflineSyncReturn {
  /** Le réseau LAN est-il accessible ? */
  isOnline: boolean;
  /** Synchronisation en cours ? */
  isSyncing: boolean;
  /** Nombre de factures en attente */
  pendingCount: number;
  /** Compteurs par statut */
  statusCounts: Record<InvoiceStatus, number>;
  /** Déclencher manuellement la synchronisation */
  syncNow: () => Promise<void>;
  /** Relancer les factures en erreur */
  retryErrors: () => Promise<void>;
  /** Rafraîchir les compteurs */
  refreshCounts: () => Promise<void>;
}

export function useOfflineSync(): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusCounts, setStatusCounts] = useState<Record<InvoiceStatus, number>>({
    pending: 0,
    synced: 0,
    error: 0,
  });

  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { setOnline, setPendingCount, setSyncing } = useConnectionStore.getState();

  // ─── Compteurs ─────────────────────────────

  const refreshCounts = useCallback(async () => {
    try {
      const counts = await invoiceRepo.countByStatus();
      setStatusCounts(counts);
      setPendingCount(counts.pending);
    } catch (error) {
      console.error('[OfflineSync] Erreur lecture compteurs:', error);
    }
  }, [setPendingCount]);

  // ─── Synchronisation ──────────────────────

  const syncNow = useCallback(async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setSyncing(true);

    try {
      await invoiceSyncService.syncPendingInvoices();
      await refreshCounts();
    } catch (error) {
      console.error('[OfflineSync] Erreur sync:', error);
    } finally {
      setIsSyncing(false);
      setSyncing(false);
    }
  }, [isSyncing, refreshCounts, setSyncing]);

  const retryErrors = useCallback(async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setSyncing(true);

    try {
      await invoiceSyncService.retryErrorInvoices();
      await refreshCounts();
    } catch (error) {
      console.error('[OfflineSync] Erreur retry:', error);
    } finally {
      setIsSyncing(false);
      setSyncing(false);
    }
  }, [isSyncing, refreshCounts, setSyncing]);

  // ─── Listener réseau ──────────────────────

  const prevOnlineRef = useRef<boolean>(false);

  useEffect(() => {
    const handleNetworkChange = (state: NetInfoState) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);
      setOnline(online);

      // Déclencher une sync automatique uniquement si on passe de hors-ligne à en-ligne
      if (online && !prevOnlineRef.current) {
        console.log('[OfflineSync] Réseau rétabli — sync automatique…');
        setTimeout(() => {
          syncNow();
        }, 1500);
      }
      prevOnlineRef.current = online;
    };

    // Listener sur les changements réseau
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);

    // Vérification initiale
    NetInfo.fetch().then((state) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);
      setOnline(online);
      prevOnlineRef.current = online;
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setOnline]);

  // ─── Sync périodique ──────────────────────

  useEffect(() => {
    // Lancer un intervalle de sync automatique si en ligne
    if (isOnline) {
      syncIntervalRef.current = setInterval(() => {
        if (statusCounts.pending > 0 && !isSyncing) {
          console.log('[OfflineSync] Sync périodique…');
          syncNow();
        }
      }, APP_CONFIG.AUTO_SYNC_INTERVAL);
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [isOnline, statusCounts.pending, isSyncing, syncNow]);

  // ─── Initialisation ───────────────────────

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  return {
    isOnline,
    isSyncing,
    pendingCount: statusCounts.pending,
    statusCounts,
    syncNow,
    retryErrors,
    refreshCounts,
  };
}
