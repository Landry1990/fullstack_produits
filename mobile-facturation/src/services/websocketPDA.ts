/**
 * Service WebSocket pour PDA - Communication temps réel avec la Caisse
 * Hybride : WebSocket prioritaire, fallback HTTP si indisponible
 */
import { Platform } from 'react-native';
import { getBaseURL } from './api';
import { sendToCashier, checkCashierStatus } from './cashierSync';
import type { CashierQueueItem, TicketCaisse } from '../types';

// Événements émis par le service
export interface WebSocketEvents {
  onConnect: () => void;
  onDisconnect: (reason: string) => void;
  onStatusUpdate: (data: {
    item_id: string;
    status: 'waiting' | 'processing' | 'completed' | 'cancelled';
    ticket?: TicketCaisse;
    message?: string;
  }) => void;
  onError: (error: Error) => void;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'failed';

class PDAWebSocketService {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private events: Partial<WebSocketEvents> = {};
  private pendingItems: Map<string, CashierQueueItem> = new Map();
  private fallbackPollIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  // Configuration
  private readonly wsUrl: string;
  private readonly pdaId: string;

  constructor(pdaId: string) {
    this.pdaId = pdaId;
    
    // Construire l'URL WebSocket depuis l'API base URL
    // WebSocket et API HTTP utilisent le même port 8000 (Daphne)
    const apiUrl = getBaseURL();
    const baseUrl = apiUrl.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
    const wsPort = '8000';
    const protocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
    this.wsUrl = `${protocol}://${baseUrl}:${wsPort}/ws/pda/?pda_id=${pdaId}`;
  }

  // ─── Gestion des événements ─────────────────────────────────

  onConnect(callback: () => void) {
    this.events.onConnect = callback;
    return () => { this.events.onConnect = undefined; };
  }

  onDisconnect(callback: (reason: string) => void) {
    this.events.onDisconnect = callback;
    return () => { this.events.onDisconnect = undefined; };
  }

  onStatusUpdate(callback: WebSocketEvents['onStatusUpdate']) {
    this.events.onStatusUpdate = callback;
    return () => { this.events.onStatusUpdate = undefined; };
  }

  onError(callback: (error: Error) => void) {
    this.events.onError = callback;
    return () => { this.events.onError = undefined; };
  }

  // ─── Connexion / Déconnexion ─────────────────────────────────

  connect(): void {
    if (this.status === 'connected' || this.status === 'connecting') {
      console.log('[PDAWebSocket] Déjà connecté ou en cours');
      return;
    }

    this.status = 'connecting';
    console.log('[PDAWebSocket] Connexion à', this.wsUrl);

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('[PDAWebSocket] Connecté');
        this.status = 'connected';
        this.reconnectAttempts = 0;
        this.startPingInterval();
        this.events.onConnect?.();

        // Envoyer ping initial
        this.send({ type: 'ping' });
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('[PDAWebSocket] Erreur:', error);
        this.events.onError?.(new Error('Erreur WebSocket'));
      };

      this.ws.onclose = (event) => {
        console.log('[PDAWebSocket] Fermé:', event.code, event.reason);
        this.status = 'disconnected';
        this.stopPingInterval();
        this.ws = null;

        this.events.onDisconnect?.(event.reason || 'Déconnexion inattendue');

        // Tentative de reconnexion
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
          console.log(`[PDAWebSocket] Reconnexion dans ${delay}ms (tentative ${this.reconnectAttempts})`);
          
          this.reconnectTimeout = setTimeout(() => {
            this.connect();
          }, Math.min(delay, 30000)); // Max 30s
        } else {
          this.status = 'failed';
          console.log('[PDAWebSocket] Max tentatives atteint, fallback HTTP actif');
        }
      };
    } catch (error) {
      console.error('[PDAWebSocket] Erreur création:', error);
      this.status = 'failed';
      this.events.onError?.(error as Error);
    }
  }

  disconnect(): void {
    console.log('[PDAWebSocket] Déconnexion demandée');
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopPingInterval();
    this.stopAllFallbackPolling();

    if (this.ws) {
      this.ws.close(1000, 'Déconnexion normale');
      this.ws = null;
    }

    this.status = 'disconnected';
  }

  // ─── Envoi d'articles à la caisse ─────────────────────────────

  /**
   * Envoie une vente à la caisse
   * Priorité WebSocket, fallback HTTP si indisponible
   */
  async sendToCashier(item: CashierQueueItem): Promise<{
    success: boolean;
    method: 'websocket' | 'http';
    error?: string;
  }> {
    // Stocker pour suivi
    this.pendingItems.set(item.id, item);

    // Tentative WebSocket si connecté
    if (this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      try {
        const message = {
          type: 'cashier_item_new',
          pda_id: this.pdaId,
          item_id: item.id,
          articles: item.lignes.map((l) => ({
            produit_id: l.produit.id,
            code_barre: l.produit.code_barre,
            designation: l.produit.designation,
            quantite: l.quantite,
            prix_unitaire: l.prix_unitaire,
            remise_produit: l.remise_produit,
            tva: l.tva,
            total_ht: l.total_ht,
            total_ttc: l.total_ttc,
          })),
          client: item.client,
          ayant_droit: item.ayant_droit,
          total_estime: item.total_estime,
          articles_count: item.articles_count,
          timestamp: new Date().toISOString(),
        };

        this.send(message);
        
        // Démarrer le polling de fallback pour cette vente
        this.startFallbackPolling(item.id);

        return { success: true, method: 'websocket' };
      } catch (error) {
        console.warn('[PDAWebSocket] Échec envoi WS, fallback HTTP:', error);
      }
    }

    // Fallback HTTP
    console.log('[PDAWebSocket] Utilisation fallback HTTP');
    const result = await sendToCashier(item);
    
    if (result.success) {
      this.startFallbackPolling(item.id);
    }

    return {
      success: result.success,
      method: 'http',
      error: result.error,
    };
  }

  // ─── Gestion des messages ───────────────────────────────────

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      console.log('[PDAWebSocket] Message reçu:', message.type);

      switch (message.type) {
        case 'pong':
          // Ping/pong OK
          break;

        case 'connection':
          console.log('[PDAWebSocket] Status connexion:', message.status);
          break;

        case 'cashier_item_received':
          console.log('[PDAWebSocket] Caisse a reçu:', message.item_id);
          // Arrêter le polling fallback pour cet item
          this.stopFallbackPolling(message.item_id);
          break;

        case 'cashier_item_status':
          console.log('[PDAWebSocket] Màj statut:', message.item_id, message.status);
          
          // Notifier le listener
          this.events.onStatusUpdate?.({
            item_id: message.item_id,
            status: message.status,
            ticket: message.ticket,
            message: message.message,
          });

          // Nettoyer si finalisé
          if (message.status === 'completed' || message.status === 'cancelled') {
            this.pendingItems.delete(message.item_id);
            this.stopFallbackPolling(message.item_id);
          }
          break;

        case 'error':
          console.error('[PDAWebSocket] Erreur serveur:', message.message);
          break;
      }
    } catch (error) {
      console.error('[PDAWebSocket] Erreur parsing message:', error);
    }
  }

  private send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      throw new Error('WebSocket non connecté');
    }
  }

  // ─── Keepalive ─────────────────────────────────────────────

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Ping toutes les 30s
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // ─── Fallback HTTP Polling ───────────────────────────────────

  /**
   * Si WebSocket down, on poll l'API pour les màj de statut
   */
  private startFallbackPolling(itemId: string): void {
    // Éviter les doublons
    if (this.fallbackPollIntervals.has(itemId)) return;

    console.log('[PDAWebSocket] Démarrage polling fallback pour', itemId);

    const interval = setInterval(async () => {
      const result = await checkCashierStatus(itemId);

      if (result.status !== 'not_found') {
        this.events.onStatusUpdate?.({
          item_id: itemId,
          status: result.status,
          ticket: result.ticket,
        });

        // Arrêter si finalisé
        if (result.status === 'completed' || result.status === 'cancelled') {
          this.stopFallbackPolling(itemId);
          this.pendingItems.delete(itemId);
        }
      }
    }, 5000); // Poll toutes les 5s

    this.fallbackPollIntervals.set(itemId, interval);

    // Auto-stop après 10 minutes (timeout)
    setTimeout(() => {
      this.stopFallbackPolling(itemId);
    }, 600000);
  }

  private stopFallbackPolling(itemId: string): void {
    const interval = this.fallbackPollIntervals.get(itemId);
    if (interval) {
      clearInterval(interval);
      this.fallbackPollIntervals.delete(itemId);
      console.log('[PDAWebSocket] Arrêt polling fallback pour', itemId);
    }
  }

  private stopAllFallbackPolling(): void {
    this.fallbackPollIntervals.forEach((interval) => clearInterval(interval));
    this.fallbackPollIntervals.clear();
  }

  // ─── Getters ───────────────────────────────────────────────

  getStatus(): ConnectionStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.status === 'connected';
  }

  getPendingItems(): CashierQueueItem[] {
    return Array.from(this.pendingItems.values());
  }
}

// Singleton instance
let wsService: PDAWebSocketService | null = null;

export function getWebSocketService(pdaId?: string): PDAWebSocketService {
  if (!wsService && pdaId) {
    wsService = new PDAWebSocketService(pdaId);
  }
  return wsService!;
}

export function resetWebSocketService(): void {
  if (wsService) {
    wsService.disconnect();
    wsService = null;
  }
}

export type { ConnectionStatus };
export { PDAWebSocketService };
