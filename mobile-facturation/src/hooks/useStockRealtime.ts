import { useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useStockStore, type StockUpdateItem } from '../stores/useStockStore';
import { useCartStore } from '../stores/useCartStore';
import { getLots, getProductById } from '../services/api';

interface StockUpdateMessage {
  type: string;
  produits?: StockUpdateItem[];
}

// http(s)://host[:port] → ws(s)://host[:port] (même serveur nginx :80
// que le web — le endpoint /ws/stock/ est déjà proxyé).
const wsBaseFor = (serverUrl: string) =>
  serverUrl.replace(/^http/, 'ws').replace(/\/+$/, '');

// Réception temps réel des changements de stock via ws/stock/ — port de
// useStockRealtime web adapté à l'archi zustand du mobile (pas de React
// Query : overrides dans useStockStore + patch direct du panier).
//
// À chaque message {type:'stock_update', produits:[{id,stock,...}]} :
//   a) overrides du store (affichage ProductRow / addProduct)
//   b) patch product.stock des lignes du panier (pré-check promis/force)
//   c) refetch débouncé des lots des lignes concernées (badge FEFO —
//      quantity_remaining n'est pas dans le broadcast)
//
// Ping 30 s, reconnexion 3 s, pas de boucle sur refus d'auth (4001/4401).
// Monté dans App.tsx ; ne se connecte que si une session existe.
export function useStockRealtime() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    const { serverUrl, token } = useAuthStore.getState();
    if (!token || !serverUrl) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let lotsTimer: ReturnType<typeof setTimeout> | null = null;
    const pendingLotIds = new Set<number>();
    let stopped = false;

    // quantity_remaining des lots n'est pas broadcasté : les lignes du
    // panier dont les lots sont chargés (badge FEFO) sont re-fetchées
    // une fois, 500 ms après le dernier update reçu.
    const scheduleLotRefetch = (productIds: number[]) => {
      for (const id of productIds) pendingLotIds.add(id);
      if (lotsTimer) return;
      lotsTimer = setTimeout(() => {
        lotsTimer = null;
        const ids = [...pendingLotIds];
        pendingLotIds.clear();
        for (const id of ids) {
          getLots(id)
            .then((lots) => useCartStore.getState().setProductLots(id, lots))
            .catch(() => {});
        }
      }, 500);
    };

    const handleUpdate = (produits: StockUpdateItem[]) => {
      useStockStore.getState().apply(produits);
      scheduleLotRefetch(useCartStore.getState().patchStocks(produits));
    };

    // Resync à la (re)connexion : les updates ratées pendant une coupure
    // ne sont pas rejouées → on relit chaque produit du panier (stock +
    // lots du détail) pour repartir sur des valeurs autoritaires. Couvre
    // aussi le brouillon restauré au boot (stocks figés à la sauvegarde).
    const resyncCartStocks = async () => {
      const ids = [...new Set(useCartStore.getState().lines.map((l) => l.product.id))];
      if (!ids.length) return;
      const results = await Promise.allSettled(ids.map((id) => getProductById(id)));
      const updates: StockUpdateItem[] = [];
      for (const r of results) {
        if (r.status !== 'fulfilled' || !r.value) continue;
        updates.push({ id: r.value.id, stock: r.value.stock });
        if (r.value.stock_lots) {
          useCartStore.getState().setProductLots(r.value.id, r.value.stock_lots);
        }
      }
      if (updates.length) {
        useStockStore.getState().apply(updates);
        useCartStore.getState().patchStocks(updates);
      }
    };

    const connect = () => {
      if (stopped) return;
      try {
        ws = new WebSocket(
          `${wsBaseFor(serverUrl)}/ws/stock/?token=${encodeURIComponent(token)}`
        );

        ws.onopen = () => {
          useStockStore.getState().setConnected(true);
          void resyncCartStocks();
          pingTimer = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 30_000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as StockUpdateMessage;
            if (data.type === 'stock_update' && Array.isArray(data.produits)) {
              handleUpdate(data.produits);
            }
          } catch {
            // message malformé → ignoré
          }
        };

        ws.onclose = (event) => {
          useStockStore.getState().setConnected(false);
          if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
          // 4001/4401 = refus d'auth : inutile de boucler, le retry
          // repartira au prochain login (cleanup du logout).
          if (event.code === 4001 || event.code === 4401) return;
          if (!stopped) reconnectTimer = setTimeout(connect, 3_000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        // URL invalide / env sans WebSocket → pas de temps réel, l'app
        // reste fonctionnelle (contrôle à la validation = autorité).
      }
    };

    connect();

    return () => {
      stopped = true;
      useStockStore.getState().reset();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (lotsTimer) clearTimeout(lotsTimer);
      if (ws) { ws.onclose = null; ws.close(); }
    };
  }, [isAuthenticated]);
}
