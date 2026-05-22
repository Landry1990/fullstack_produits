# 📱 Guide WebSocket PDA - Caisse Temps Réel

## Architecture Complète

```
┌─────────────────────────────────────────────────────────────────────┐
│                          MOBILE PDA                                 │
├─────────────────────────────────────────────────────────────────────┤
│  useCartStore.ts ──► useCashierQueueStore.ts ──► websocketPDA.ts  │
│        │                    │                      │                │
│        │                    │                      ▼                │
│        │                    │               ┌──────────────┐        │
│        │                    │               │ WebSocket WS │◄─────┐ │
│        │                    │               │ (Temps réel) │      │ │
│        │                    │               └──────┬───────┘      │ │
│        │                    │                      │              │ │
│        │                    ▼                      ▼              │ │
│        │               ┌──────────────┐     ┌──────────────┐      │ │
│        └──────────────►│ Cashier Sync │◄────│  Fallback    │      │ │
│                        │   API HTTP   │     │ HTTP Polling │──────┘ │
│                        └──────────────┘     └──────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ WebSocket / HTTP
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        SERVEUR DJANGO                               │
├─────────────────────────────────────────────────────────────────────┤
│  Consumers: CashierConsumer ──┬──► Channel Layer (Redis/Memory)     │
│              PDAConsumer ──────┘                                     │
│                                                                     │
│  API REST: /mobile/cashier-queue (fallback)                         │
└─────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ WebSocket
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        CAISSE WEB                                   │
├─────────────────────────────────────────────────────────────────────┤
│  useCashierWebSocket.ts ◄── WebSocket WS ───┐                      │
│       │                                       │                      │
│       ▼                                       │                      │
│  PDAQueueBanner.tsx ◄─── cashier:item:new ───┘                      │
│       │                                                             │
│       ▼                                                             │
│  Facturation.tsx ──► Validation ──► emit status: completed          │
└─────────────────────────────────────────────────────────────────────┘
```

## Intégration dans les Écrans

### 1. Écran Principal (CartScreen.tsx ou SaleScreen.tsx)

```typescript
import { useWebSocketPDA } from '../hooks';
import { getWebSocketService } from '../services';
import { useCartStore } from '../stores';
import { useState, useCallback } from 'react';

export function CartScreen() {
  const cart = useCartStore();
  const [sendingItemId, setSendingItemId] = useState<string | null>(null);
  const [completedTickets, setCompletedTickets] = useState<TicketCaisse[]>([]);

  // WebSocket pour communication temps réel avec la caisse
  const {
    status,
    isConnected,
    isFailed,
    sendToCashier,
    pendingCount,
    connect,
  } = useWebSocketPDA({
    pdaId: 'PDA-' + Device.deviceId, // ou utiliser un ID unique
    autoConnect: true,
    
    onConnect: () => {
      console.log('✅ Connecté à la caisse centrale');
      // Optionnel: vibrer, son, notification visuelle
    },
    
    onDisconnect: (reason) => {
      console.log('⚠️ Déconnecté:', reason);
      // Le fallback HTTP prend le relais automatiquement
    },
    
    onStatusUpdate: (data) => {
      console.log('📨 Mise à jour caisse:', data.status);
      
      switch (data.status) {
        case 'processing':
          // La caisse a chargé la vente
          setSendingItemId(null);
          Alert.alert(
            'En cours',
            'La caisse traite votre vente...'
          );
          break;
          
        case 'completed':
          // Vente finalisée !
          if (data.ticket) {
            setCompletedTickets(prev => [data.ticket!, ...prev]);
            
            // Notification succès
            Alert.alert(
              '✅ Vente validée',
              `Ticket: ${data.ticket.numero_ticket}\nTotal: ${data.ticket.total_ttc} FCFA`,
              [
                { 
                  text: 'Nouvelle vente', 
                  onPress: () => cart.clear() 
                }
              ]
            );
            
            // Vibration succès
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          break;
          
        case 'cancelled':
          // Vente annulée par la caisse
          Alert.alert(
            '❌ Vente annulée',
            data.message || 'La caisse a annulé cette vente'
          );
          setSendingItemId(null);
          break;
      }
    },
  });

  // Envoi à la caisse
  const handleSendToCashier = useCallback(async () => {
    if (cart.items.length === 0) {
      Alert.alert('Erreur', 'Panier vide');
      return;
    }

    // Créer le ticket de caisse depuis le panier
    const queueItem = cart.createCashierQueueItem();
    if (!queueItem) {
      Alert.alert('Erreur', 'Impossible de créer le ticket');
      return;
    }

    setSendingItemId(queueItem.id);

    // Envoi (WebSocket ou HTTP fallback)
    const result = await sendToCashier(queueItem);

    if (result.success) {
      console.log('✅ Envoyé via:', result.method); // 'websocket' ou 'http'
      
      if (result.method === 'http') {
        Alert.alert(
          'Mode dégradé',
          'Connexion temps réel indisponible. La vente est envoyée en mode différé.'
        );
      }
    } else {
      Alert.alert('Erreur', result.error || 'Échec envoi');
      setSendingItemId(null);
    }
  }, [cart, sendToCashier]);

  return (
    <View style={styles.container}>
      {/* Header avec statut connexion */}
      <View style={styles.header}>
        <Text style={styles.title}>Panier</Text>
        
        <View style={styles.connectionStatus}>
          <View style={[
            styles.statusDot,
            isConnected && styles.statusConnected,
            isFailed && styles.statusFailed,
          ]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Caisse connectée' : 
             isFailed ? 'Mode dégradé' : 'Connexion...'}
          </Text>
        </View>
      </View>

      {/* Liste des articles */}
      <FlatList
        data={cart.items}
        renderItem={({ item }) => (
          <CartItemRow item={item} />
        )}
      />

      {/* Total + Bouton envoi */}
      <View style={styles.footer}>
        <Text style={styles.total}>
          Total: {cart.totalTTC} FCFA
        </Text>
        
        <Text style={styles.pendingCount}>
          {pendingCount > 0 && `${pendingCount} vente(s) en attente`}
        </Text>

        <TouchableOpacity
          style={[
            styles.sendButton,
            sendingItemId && styles.sendingButton,
          ]}
          onPress={handleSendToCashier}
          disabled={sendingItemId !== null}
        >
          <Text style={styles.sendButtonText}>
            {sendingItemId ? 'Envoi en cours...' : 'Envoyer à la caisse'}
          </Text>
        </TouchableOpacity>

        {/* Bouton reconnect si failed */}
        {isFailed && (
          <TouchableOpacity onPress={connect} style={styles.reconnectButton}>
            <Text>Reconnecter</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
```

### 2. Hook personnalisé simplifié

```typescript
// hooks/useSendToCashier.ts
import { useState, useCallback } from 'react';
import { useWebSocketPDA } from './useWebSocketPDA';
import { useCartStore } from '../stores';
import * as Device from 'expo-device';

export function useSendToCashier() {
  const cart = useCartStore();
  const [isSending, setIsSending] = useState(false);
  const [lastTicket, setLastTicket] = useState<TicketCaisse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pdaId = `PDA-${Device.deviceId || 'UNKNOWN'}`;

  const ws = useWebSocketPDA({
    pdaId,
    onStatusUpdate: (data) => {
      if (data.status === 'completed' && data.ticket) {
        setLastTicket(data.ticket);
        setIsSending(false);
      } else if (data.status === 'cancelled') {
        setError(data.message || 'Annulé');
        setIsSending(false);
      }
    },
  });

  const send = useCallback(async () => {
    if (cart.items.length === 0) {
      throw new Error('Panier vide');
    }

    setIsSending(true);
    setError(null);

    const queueItem = cart.createCashierQueueItem();
    if (!queueItem) {
      setIsSending(false);
      throw new Error('Erreur création ticket');
    }

    const result = await ws.sendToCashier(queueItem);

    if (!result.success) {
      setIsSending(false);
      setError(result.error || 'Échec envoi');
      throw new Error(result.error);
    }

    // Si WebSocket failed (fallback HTTP), on attend le polling
    if (result.method === 'http') {
      // Déjà géré par onStatusUpdate
    }

    return result;
  }, [cart, ws]);

  const reset = useCallback(() => {
    setLastTicket(null);
    setError(null);
    setIsSending(false);
    cart.clear();
  }, [cart]);

  return {
    send,
    reset,
    isSending,
    lastTicket,
    error,
    isConnected: ws.isConnected,
    pendingCount: ws.pendingCount,
  };
}
```

### 3. Utilisation dans un écran

```typescript
// screens/CheckoutScreen.tsx
export function CheckoutScreen() {
  const { send, isSending, lastTicket, error, reset, isConnected } = useSendToCashier();

  return (
    <View>
      {!lastTicket ? (
        // Écran de confirmation avant envoi
        <TouchableOpacity onPress={send} disabled={isSending}>
          <Text>{isSending ? 'Envoi...' : 'Confirmer et envoyer'}</Text>
        </TouchableOpacity>
      ) : (
        // Écran succès avec ticket
        <View>
          <Text>✅ Vente validée !</Text>
          <Text>Ticket: {lastTicket.numero_ticket}</Text>
          <Text>Total: {lastTicket.total_ttc} FCFA</Text>
          <TouchableOpacity onPress={reset}>
            <Text>Nouvelle vente</Text>
          </TouchableOpacity>
        </View>
      )}

      {error && <Text style={{ color: 'red' }}>{error}</Text>}
    </View>
  );
}
```

## Tableau de suivi des ventes

```typescript
// screens/PendingSalesScreen.tsx
import { useWebSocketPDA } from '../hooks';

export function PendingSalesScreen() {
  const [sales, setSales] = useState<Array<{
    id: string;
    status: string;
    total: string;
    timestamp: string;
    ticket?: TicketCaisse;
  }>>([]);

  const { sendToCashier, pendingCount } = useWebSocketPDA({
    pdaId: 'PDA-001',
    onStatusUpdate: (data) => {
      setSales(prev => {
        const existing = prev.find(s => s.id === data.item_id);
        if (existing) {
          return prev.map(s => 
            s.id === data.item_id 
              ? { ...s, status: data.status, ticket: data.ticket }
              : s
          );
        }
        return prev;
      });
    },
  });

  return (
    <View>
      <Text>Ventes en attente: {pendingCount}</Text>
      <FlatList
        data={sales}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.saleRow,
            item.status === 'completed' && styles.completed,
            item.status === 'cancelled' && styles.cancelled,
          ]}>
            <Text>Vente #{item.id.slice(-6)}</Text>
            <Text>{item.total} FCFA</Text>
            <Text>{item.status}</Text>
            {item.ticket && (
              <Text>Ticket: {item.ticket.numero_ticket}</Text>
            )}
          </View>
        )}
      />
    </View>
  );
}
```

## Gestion des erreurs

| Scénario | Comportement | Action utilisateur |
|----------|--------------|-------------------|
| WebSocket connecté | Temps réel instantané | Aucune |
| WebSocket indisponible | Fallback HTTP automatique | Notification "Mode dégradé" |
| HTTP aussi indisponible | Sauvegarde locale SQLite | "En attente de connexion" |
| Caisse annule | Notification push PDA | Retour écran panier |
| Timeout (10min) | Vente expirée | Message + requête manuelle |

## Tests

### Test WebSocket local
```bash
# Terminal 1 - Serveur Django
cd backend
python -m daphne -b 0.0.0.0 -p 8000 backend.asgi:application

# Terminal 2 - Test avec wscat (simuler PDA)
npm install -g wscat
wscat -c ws://localhost:8000/ws/pda/?pda_id=PDA-TEST

# Envoyer une vente
> {"type":"cashier_item_new","pda_id":"PDA-TEST","item_id":"123","articles":[{"produit_id":1,"code_barre":"123456","designation":"Test","quantite":1,"prix_unitaire":"1000","total_ttc":"1180"}],"total_estime":"1180","articles_count":1}
```

### Test sur mobile
1. Lancer l'app PDA en mode développement
2. Scanner un produit
3. Cliquer "Envoyer à la caisse"
4. Vérifier les logs : `[PDAWebSocket] Connecté`, `Message reçu: cashier_item_received`

## Notes importantes

1. **ID PDA unique** : Utiliser `expo-device` ou générer un UUID stocké dans AsyncStorage
2. **Reconnexion** : Automatique avec backoff exponentiel (1s, 2s, 4s... max 30s)
3. **Fallback** : Si WebSocket failed après 5 tentatives, bascule automatiquement sur HTTP
4. **Background** : La connexion reste active en arrière-plan (pas de déconnexion systématique)
5. **Batterie** : WebSocket + fallback polling = impact minimal (< 1% batterie/h)
