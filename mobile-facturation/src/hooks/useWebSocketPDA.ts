/**
 * Hook React Native pour WebSocket PDA
 * Gestion simplifiée de la connexion temps réel avec la caisse
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getWebSocketService, resetWebSocketService, type ConnectionStatus } from '../services/websocketPDA';
import type { TicketCaisse, CashierQueueItem } from '../types';

export interface UseWebSocketPDAOptions {
  pdaId: string;
  autoConnect?: boolean;
  onStatusUpdate?: (data: {
    item_id: string;
    status: 'waiting' | 'processing' | 'completed' | 'cancelled';
    ticket?: TicketCaisse;
    message?: string;
  }) => void;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
}

export interface UseWebSocketPDAReturn {
  status: ConnectionStatus;
  isConnected: boolean;
  isFailed: boolean;
  connect: () => void;
  disconnect: () => void;
  sendToCashier: (item: CashierQueueItem) => Promise<{
    success: boolean;
    method: 'websocket' | 'http';
    error?: string;
  }>;
  pendingCount: number;
}

export function useWebSocketPDA(options: UseWebSocketPDAOptions): UseWebSocketPDAReturn {
  const { pdaId, autoConnect = true, onStatusUpdate, onConnect, onDisconnect } = options;
  
  const serviceRef = useRef(getWebSocketService(pdaId));
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [pendingCount, setPendingCount] = useState(0);
  
  // Mettre à jour le statut local quand le service change
  const updateStatus = useCallback(() => {
    const newStatus = serviceRef.current.getStatus();
    setStatus(newStatus);
    setPendingCount(serviceRef.current.getPendingItems().length);
  }, []);

  // Connexion
  const connect = useCallback(() => {
    // Recréer le service si besoin
    if (!serviceRef.current) {
      serviceRef.current = getWebSocketService(pdaId);
    }
    serviceRef.current.connect();
    updateStatus();
  }, [pdaId, updateStatus]);

  // Déconnexion
  const disconnect = useCallback(() => {
    serviceRef.current?.disconnect();
    updateStatus();
  }, [updateStatus]);

  // Envoi à la caisse
  const sendToCashier = useCallback(async (item: CashierQueueItem) => {
    const result = await serviceRef.current.sendToCashier(item);
    updateStatus();
    return result;
  }, [updateStatus]);

  // Setup des listeners
  useEffect(() => {
    const service = serviceRef.current;

    // Listeners
    const unsubConnect = service.onConnect(() => {
      setStatus('connected');
      onConnect?.();
    });

    const unsubDisconnect = service.onDisconnect((reason) => {
      setStatus('disconnected');
      onDisconnect?.(reason);
    });

    const unsubStatusUpdate = service.onStatusUpdate((data) => {
      setPendingCount(service.getPendingItems().length);
      onStatusUpdate?.(data);
    });

    const unsubError = service.onError(() => {
      // Erreur gérée par onDisconnect/onConnect
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubStatusUpdate();
      unsubError();
    };
  }, [onConnect, onDisconnect, onStatusUpdate]);

  // Auto-connect au mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      // Ne pas déconnecter au unmount pour garder la connexion persistante
      // La déconnexion se fait explicitement via disconnect()
    };
  }, [autoConnect, connect]);

  // Gestion AppState (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App revient au premier plan - reconnecter si nécessaire
        if (status === 'disconnected' || status === 'failed') {
          console.log('[useWebSocketPDA] App active, tentative reconnexion');
          connect();
        }
      } else if (nextAppState === 'background') {
        // App en arrière-plan - maintenir connexion mais réduire activité
        console.log('[useWebSocketPDA] App background');
      }
    });

    return () => {
      subscription.remove();
    };
  }, [connect, status]);

  return {
    status,
    isConnected: status === 'connected',
    isFailed: status === 'failed',
    connect,
    disconnect,
    sendToCashier,
    pendingCount,
  };
}
