import { useAuthStore } from '../stores';
import type { CashierPayload } from '../types';

type WSStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type StatusListener = (status: WSStatus) => void;
type MessageListener = (data: Record<string, unknown>) => void;

class PDAWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 3000;
  private maxReconnectDelay = 30000;
  private shouldReconnect = false;
  private pdaId: string;

  private statusListeners: Set<StatusListener> = new Set();
  private messageListeners: Set<MessageListener> = new Set();

  constructor() {
    this.pdaId = `TAB-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }

  get status(): WSStatus {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      default: return 'disconnected';
    }
  }

  get id(): string { return this.pdaId; }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.shouldReconnect = true;
    this.doConnect();
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close(1000);
    this.ws = null;
    this.emit('disconnected');
  }

  private doConnect() {
    const { serverUrl } = useAuthStore.getState();
    const wsUrl = serverUrl.replace(/^http/, 'ws');
    const url = `${wsUrl}/ws/pda/?pda_id=${this.pdaId}`;

    this.emit('connecting');
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectDelay = 3000;
      this.emit('connected');
    };

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this.messageListeners.forEach((l) => l(data));
      } catch {}
    };

    this.ws.onerror = () => {
      this.emit('error');
    };

    this.ws.onclose = (e) => {
      this.emit('disconnected');
      if (this.shouldReconnect && e.code !== 1000) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
          this.doConnect();
        }, this.reconnectDelay);
      }
    };
  }

  send(payload: CashierPayload): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(payload));
    return true;
  }

  ping() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping' }));
    }
  }

  onStatus(listener: StatusListener) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onMessage(listener: MessageListener) {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  private emit(status: WSStatus) {
    this.statusListeners.forEach((l) => l(status));
  }
}

export const pdaWS = new PDAWebSocket();
