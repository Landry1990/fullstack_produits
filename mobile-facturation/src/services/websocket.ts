/**
 * Service WebSocket pour les notifications temps réel
 * Écoute les événements du serveur central (stock updates, alertes…)
 */

type WSEventType = 'stock_update' | 'price_update' | 'server_message' | 'force_sync';

interface WSMessage {
  type: WSEventType;
  payload: unknown;
  timestamp: string;
}

type WSEventHandler = (message: WSMessage) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string = '';
  private handlers: Map<WSEventType, WSEventHandler[]> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isManualClose: boolean = false;

  /**
   * Connecte au serveur WebSocket
   * @param serverUrl URL de base du serveur (ex: http://192.168.1.100:8000)
   */
  connect(serverUrl: string): void {
    // Convertir HTTP en WS
    this.url = serverUrl
      .replace('http://', 'ws://')
      .replace('https://', 'wss://');
    this.url = `${this.url}/ws/mobile/`;

    this.isManualClose = false;
    this.createConnection();
  }

  /**
   * Déconnecte proprement
   */
  disconnect(): void {
    this.isManualClose = true;
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close(1000, 'Déconnexion manuelle');
      this.ws = null;
    }
  }

  /**
   * Enregistre un handler pour un type d'événement
   */
  on(eventType: WSEventType, handler: WSEventHandler): () => void {
    const existing = this.handlers.get(eventType) || [];
    existing.push(handler);
    this.handlers.set(eventType, existing);

    // Retourne une fonction de désinscription
    return () => {
      const handlers = this.handlers.get(eventType) || [];
      this.handlers.set(
        eventType,
        handlers.filter((h) => h !== handler)
      );
    };
  }

  /**
   * Vérifie si le WebSocket est connecté
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ─── Connexion interne ─────────────────────────────────

  private createConnection(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WS] Connecté au serveur');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data as string);
          this.dispatchEvent(message);
        } catch (error) {
          console.warn('[WS] Message non-JSON reçu:', event.data);
        }
      };

      this.ws.onerror = (error) => {
        console.warn('[WS] Erreur:', error);
      };

      this.ws.onclose = (event) => {
        console.log(`[WS] Déconnecté (code: ${event.code})`);
        if (!this.isManualClose) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('[WS] Erreur création connexion:', error);
      this.scheduleReconnect();
    }
  }

  private dispatchEvent(message: WSMessage): void {
    const handlers = this.handlers.get(message.type) || [];
    for (const handler of handlers) {
      try {
        handler(message);
      } catch (error) {
        console.error(`[WS] Erreur handler ${message.type}:`, error);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WS] Nombre max de tentatives atteint, arrêt reconnexion');
      return;
    }

    // Backoff exponentiel : 1s, 2s, 4s, 8s… max 30s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`[WS] Reconnexion dans ${delay / 1000}s (tentative ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.createConnection();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

/** Instance singleton du service WebSocket */
export const websocketService = new WebSocketService();
