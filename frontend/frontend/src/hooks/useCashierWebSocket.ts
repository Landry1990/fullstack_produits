/**
 * Hook WebSocket pour recevoir les articles des PDA en temps réel
 * Côté Caisse Web - Écoute les ventes initiées sur PDA
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

// Types pour les messages WebSocket
interface CashierItemNew {
  type: 'cashier_item_new';
  pda_id: string;
  item_id: string;
  articles: PDAArticle[];
  client?: PDACLient;
  ayant_droit?: PDAAyantDroit;
  total_estime: string;
  articles_count: number;
  timestamp: string;
}

interface CashierItemStatus {
  type: 'cashier_item_status';
  item_id: string;
  status: 'waiting' | 'processing' | 'completed' | 'cancelled';
  ticket?: PDATicket;
  message?: string;
}

interface PDAArticle {
  produit_id: number;
  code_barre: string;
  designation: string;
  quantite: number;
  prix_unitaire: string;
  remise_produit: string;
  tva: string;
  total_ht: string;
  total_ttc: string;
}

interface PDACLient {
  id: number;
  name: string;
  phone?: string;
}

interface PDAAyantDroit {
  id: number;
  nom: string;
  prenom: string;
  numero_carte: string;
  taux_couverture: number;
  societe?: string;
}

interface PDATicket {
  numero_ticket: string;
  total_ttc: string;
}

type WebSocketMessage = CashierItemNew | CashierItemStatus | { type: 'connection'; status: string };

interface UseCashierWebSocketOptions {
  onNewItem?: (item: CashierItemNew) => void;
  onStatusUpdate?: (status: CashierItemStatus) => void;
  autoReconnect?: boolean;
  reconnectDelay?: number;
}

interface UseCashierWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  pendingItems: CashierItemNew[];
  sendStatusUpdate: (itemId: string, status: CashierItemStatus['status'], ticket?: PDATicket) => void;
  connect: () => void;
  disconnect: () => void;
  clearPendingItem: (itemId: string) => void;
}

export function useCashierWebSocket(
  options: UseCashierWebSocketOptions = {}
): UseCashierWebSocketReturn {
  const {
    onNewItem,
    onStatusUpdate,
    autoReconnect = true,
    reconnectDelay = 3000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [pendingItems, setPendingItems] = useState<CashierItemNew[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);

  // Récupérer l'URL WebSocket depuis l'API base URL
  const getWebSocketUrl = useCallback((): string => {
    // WebSocket et API HTTP utilisent le même port 8000 (Daphne)
    const wsPort = '8000';
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
    const baseUrl = apiUrl.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
    // Note: wsPort = 8000 car Daphne gère HTTP et WebSocket
    return `${wsProtocol}://${baseUrl}:${wsPort}/ws/cashier/`;
  }, []);

  // Connexion WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[CashierWS] Déjà connecté');
      return;
    }

    const wsUrl = getWebSocketUrl();
    console.log('[CashierWS] Connexion à', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[CashierWS] Connecté');
        setIsConnected(true);
        shouldReconnectRef.current = true;
        
        // Envoyer un ping pour vérifier
        ws.send(JSON.stringify({ type: 'ping' }));
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          switch (message.type) {
            case 'cashier_item_new':
              console.log('[CashierWS] Nouveau reçu du PDA:', message.pda_id);
              setPendingItems((prev) => {
                // Éviter les doublons
                if (prev.some((item) => item.item_id === message.item_id)) {
                  return prev;
                }
                return [message, ...prev];
              });
              
              // Notification visuelle
              toast.success(
                `📱 PDA ${message.pda_id}: ${message.articles_count} article(s) en attente`,
                {
                  duration: 5000,
                  icon: '🛒',
                }
              );
              
              onNewItem?.(message);
              break;

            case 'cashier_item_status':
              console.log('[CashierWS] Màj statut:', message.item_id, message.status);
              
              if (message.status === 'completed' || message.status === 'cancelled') {
                // Retirer de la liste des pending
                setPendingItems((prev) =>
                  prev.filter((item) => item.item_id !== message.item_id)
                );
              }
              
              onStatusUpdate?.(message);
              break;

            case 'connection':
              console.log('[CashierWS] Status connexion:', message.status);
              break;
          }
        } catch (error) {
          console.error('[CashierWS] Erreur parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[CashierWS] Erreur:', error);
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        console.log('[CashierWS] Déconnecté:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Reconnexion automatique
        if (shouldReconnectRef.current && autoReconnect) {
          console.log(`[CashierWS] Reconnexion dans ${reconnectDelay}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        }
      };
    } catch (error) {
      console.error('[CashierWS] Erreur création WebSocket:', error);
    }
  }, [getWebSocketUrl, autoReconnect, reconnectDelay, onNewItem, onStatusUpdate]);

  // Déconnexion
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Déconnexion demandée');
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  // Envoyer mise à jour de statut à un PDA
  const sendStatusUpdate = useCallback((
    itemId: string,
    status: CashierItemStatus['status'],
    ticket?: PDATicket
  ) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn('[CashierWS] WebSocket non connecté');
      return;
    }

    const message: CashierItemStatus = {
      type: 'cashier_item_status',
      item_id: itemId,
      status,
      ticket,
    };

    wsRef.current.send(JSON.stringify(message));
  }, []);

  // Retirer un item de la liste pending
  const clearPendingItem = useCallback((itemId: string) => {
    setPendingItems((prev) => prev.filter((item) => item.item_id !== itemId));
  }, []);

  // Connexion au mount, déconnexion au unmount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Ping régulier pour garder la connexion vivante
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping toutes les 30s

    return () => clearInterval(pingInterval);
  }, [isConnected]);

  return {
    isConnected,
    lastMessage,
    pendingItems,
    sendStatusUpdate,
    connect,
    disconnect,
    clearPendingItem,
  };
}
