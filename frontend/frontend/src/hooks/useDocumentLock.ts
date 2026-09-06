/**
 * Hook de verrouillage pessimiste de documents via WebSocket + Redis.
 * Utilisé pour Commande, Inventaire et tout autre document éditable.
 *
 * Protocole WebSocket (ws/lock/<model>/<pk>/):
 *   → acquire   : demande le verrou
 *   → release   : libère le verrou
 *   → heartbeat : renouvelle le TTL (envoyé toutes les 15s)
 *   ← lock_acquired  : verrou obtenu
 *   ← lock_denied    : verrou refusé (holder = détenteur actuel)
 *   ← lock_released  : verrou libre
 *   ← lock_update    : broadcast (holder null = libéré)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { safeStorage } from '../utils/storage';

export type LockStatus = 'idle' | 'acquired' | 'denied' | 'released' | 'connecting';

export interface DocumentLockState {
  status: LockStatus;
  isLocked: boolean;
  isMine: boolean;
  holder: string | null;
  acquire: () => void;
  release: () => void;
}

const WS_BASE = import.meta.env.VITE_WS_URL ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
const HEARTBEAT_INTERVAL = 15_000; // 15s < TTL 30s
const RECONNECT_DELAY = 3_000;

export function useDocumentLock(
  model: string,
  pk: number | string | null | undefined
): DocumentLockState {
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const wantsLockRef = useRef(true);
  const myHolderRef = useRef<string | null>(null);

  const [status, setStatus] = useState<LockStatus>('idle');
  const [holder, setHolder] = useState<string | null>(null);
  const [isMine, setIsMine] = useState(false);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, HEARTBEAT_INTERVAL);
  }, [stopHeartbeat]);

  const disconnect = useCallback(() => {
    stopHeartbeat();
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [stopHeartbeat]);

  const tryAcquire = useCallback((ws: WebSocket) => {
    if (ws.readyState === WebSocket.OPEN && wantsLockRef.current) {
      ws.send(JSON.stringify({ type: 'acquire' }));
    }
  }, []);

  const connect = useCallback(() => {
    if (!pk || !model) return;
    if (wsRef.current) disconnect();

    const token = safeStorage.getItem('authToken');
    const url = `${WS_BASE}/ws/lock/${model}/${pk}/?token=${token ?? ''}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    wantsLockRef.current = true;
    myHolderRef.current = null;
    setStatus(prev => (prev === 'connecting' ? prev : 'connecting'));
    setHolder(prev => (prev === null ? prev : null));
    setIsMine(prev => (prev === false ? prev : false));

    ws.onopen = () => {
      if (!mountedRef.current || !wantsLockRef.current) return;
      tryAcquire(ws);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data as string);
        switch (data.type) {
          case 'lock_acquired':
            myHolderRef.current = data.holder ?? null;
            setStatus(prev => (prev === 'acquired' ? prev : 'acquired'));
            setHolder(prev => (prev === (data.holder ?? null) ? prev : (data.holder ?? null)));
            setIsMine(prev => (prev === true ? prev : true));
            startHeartbeat();
            break;
          case 'lock_denied':
            myHolderRef.current = null;
            setStatus(prev => (prev === 'denied' ? prev : 'denied'));
            setHolder(prev => (prev === (data.holder ?? null) ? prev : (data.holder ?? null)));
            setIsMine(prev => (prev === false ? prev : false));
            stopHeartbeat();
            break;
          case 'lock_released':
            myHolderRef.current = null;
            setStatus(prev => (prev === 'released' ? prev : 'released'));
            setHolder(prev => (prev === null ? prev : null));
            setIsMine(prev => (prev === false ? prev : false));
            stopHeartbeat();
            tryAcquire(ws);
            break;
          case 'lock_update':
            if (data.holder === null) {
              myHolderRef.current = null;
              setStatus(prev => (prev === 'released' ? prev : 'released'));
              setHolder(prev => (prev === null ? prev : null));
              setIsMine(prev => (prev === false ? prev : false));
              stopHeartbeat();
              tryAcquire(ws);
            } else {
              const nowMine = data.holder === myHolderRef.current;
              setHolder(prev => (prev === data.holder ? prev : data.holder));
              setIsMine(prev => (prev === nowMine ? prev : nowMine));
              if (!nowMine) {
                setStatus(prev => (prev === 'denied' ? prev : 'denied'));
                stopHeartbeat();
                myHolderRef.current = null;
              }
            }
            break;
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      stopHeartbeat();
      setIsMine(prev => (prev === false ? prev : false));
      setStatus(prev => (prev === 'connecting' ? prev : 'connecting'));
      reconnectRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, RECONNECT_DELAY);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [model, pk, disconnect, startHeartbeat, stopHeartbeat, tryAcquire]);

  useEffect(() => {
    mountedRef.current = true;
    if (pk && model) connect();
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [model, pk]); // eslint-disable-line react-hooks/exhaustive-deps

  const acquire = useCallback(() => {
    wantsLockRef.current = true;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'acquire' }));
    }
  }, []);

  const release = useCallback(() => {
    wantsLockRef.current = false;
    myHolderRef.current = null;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'release' }));
    }
    setIsMine(false);
    setStatus('released');
    stopHeartbeat();
  }, [stopHeartbeat]);

  return {
    status,
    isLocked: holder !== null,
    isMine,
    holder,
    acquire,
    release,
  };
}
