# 📱 Intégration PDA → Caisse Web

## Composants et Hooks Créés

| Fichier | Description |
|---------|-------------|
| `src/hooks/useCashierWebSocket.ts` | Hook WebSocket pour recevoir les articles PDA |
| `src/components/facturation/PDAQueueBanner.tsx` | Bannière affichant les ventes PDA en attente |
| `src/utils/pdaConversion.ts` | Utilitaires de conversion PDA → Format Facturation |

## Intégration dans Facturation.tsx

### 1. Ajouter les imports
```typescript
import { useCashierWebSocket } from '../hooks';
import { PDAQueueBanner } from './facturation/PDAQueueBanner';
import { convertPDAItemToCartParams } from '../utils/pdaConversion';
```

### 2. Utiliser le hook WebSocket
```typescript
export default function Facturation() {
  const hook = useFacturationState();
  
  // WebSocket pour recevoir les articles PDA
  const {
    isConnected,
    pendingItems,
    sendStatusUpdate,
    clearPendingItem,
  } = useCashierWebSocket({
    onNewItem: (item) => {
      // Optionnel: log, analytics, son personnalisé
      console.log('Nouvelle vente PDA reçue:', item.pda_id);
    },
    onStatusUpdate: (status) => {
      if (status.status === 'completed') {
        // La vente a été finalisée
        toast.success(`Ticket ${status.ticket?.numero_ticket} validé`);
      }
    },
  });

  // ...
}
```

### 3. Gérer l'acceptation d'une vente PDA
```typescript
const handleAcceptPDAItem = (pdaItem: any) => {
  // 1. Convertir les données PDA en format panier
  const { lignes, client, ayantDroit } = convertPDAItemToCartParams(pdaItem);
  
  // 2. Vider le panier actuel (ou sauvegarder comme vente en attente)
  hook.cart.clearCart();
  
  // 3. Charger les articles dans le panier
  lignes.forEach((ligne) => {
    hook.cart.addLigneFacture(ligne);
  });
  
  // 4. Sélectionner le client
  if (client) {
    hook.clients.setSelectedClient(client.id);
    hook.clients.setSelectedClientDetails(client);
  }
  
  // 5. Sélectionner l'ayant droit si présent
  if (ayantDroit) {
    hook.clients.setSelectedAyantDroit(ayantDroit);
  }
  
  // 6. Retirer de la file d'attente
  clearPendingItem(pdaItem.item_id);
  
  // 7. Envoyer confirmation au PDA
  sendStatusUpdate(pdaItem.item_id, 'processing');
  
  // 8. Focus sur le paiement
  toast.success('Vente PDA chargée ! Prêt pour paiement.');
};

const handleDismissPDAItem = (itemId: string) => {
  clearPendingItem(itemId);
  sendStatusUpdate(itemId, 'cancelled', undefined);
};
```

### 4. Ajouter la bannière dans le JSX
```tsx
return (
  <div className="h-full flex flex-col bg-base-100 font-sans text-base-content overflow-hidden">
    {/* ── HEADER ─────────────────────────────────────────── */}
    <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 border-b border-base-200 bg-base-100 shrink-0 shadow-sm">
      {/* ... header existant ... */}
      
      {/* Indicateur WebSocket */}
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${
        isConnected 
          ? 'bg-emerald-100 text-emerald-700' 
          : 'bg-red-100 text-red-700'
      }`}>
        <div className={`size-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
        {isConnected ? 'PDA Connecté' : 'PDA Déconnecté'}
      </div>
    </div>

    {/* ── BANNIÈRE PDA ───────────────────────────────────── */}
    <PDAQueueBanner
      items={pendingItems}
      onAccept={handleAcceptPDAItem}
      onDismiss={handleDismissPDAItem}
    />

    {/* ── RESTE DU CONTENU ───────────────────────────────── */}
    {/* ... */}
  </div>
);
```

### 5. Envoyer confirmation après validation
```typescript
// Dans la fonction de validation du paiement
const handlePaymentComplete = async () => {
  const result = await hook.actions.validateSale();
  
  if (result.success && result.ticket?.facture) {
    // Si c'était une vente PDA, notifier le PDA
    const pdaSource = hook.cart.getPdaSource?.(); // À ajouter au cart store
    if (pdaSource) {
      sendStatusUpdate(pdaSource.itemId, 'completed', {
        numero_ticket: result.ticket.numero_ticket,
        total_ttc: result.ticket.total_ttc.toString(),
      });
    }
  }
};
```

## Configuration Backend

### 1. Installer Django Channels
```bash
cd backend
pip install channels>=4.0 channels-redis>=4.0 daphne>=4.0
```

### 2. Lancer le serveur avec Daphne (ASGI)
```bash
# Au lieu de:
python manage.py runserver

# Utiliser:
daphne -b 0.0.0.0 -p 8000 backend.asgi:application
# ou
python -m daphne -b 0.0.0.0 -p 8000 backend.asgi:application
```

### 3. Docker (docker-compose.yml)
```yaml
services:
  backend:
    # ...
    command: daphne -b 0.0.0.0 -p 8000 backend.asgi:application
```

## Flux Complet

```
┌─────────┐    scan articles    ┌─────────┐
│   PDA   │ ───────────────────>│  PDA    │
│ (mobile)│   (envoi caisse)    │  Store  │
└─────────┘                     └────┬────┘
                                     │
                                     │ WebSocket emit
                                     │ 'cashier_item_new'
                                     ▼
┌─────────┐    WebSocket WS     ┌─────────┐
│  Caisse │ <───────────────────│ Django  │
│   Web   │   (temps réel)      │Channels │
│         │                     └─────────┘
│         │
│  ┌──────┴──────┐
│  │ PDAQueue    │
│  │  Banner     │ ◄── Affiche notification
│  └──────┬──────┘
│         │
│  Clique "Charger"
│         ▼
│  ┌─────────────┐
│  │ Conversion  │ ◄── Convertit PDA → LignesFacture
│  │ PDA → Cart  │
│  └──────┬──────┘
│         │
│         ▼
│  ┌─────────────┐
│  │   Panier    │ ◄── Articles chargés, prêt paiement
│  │   Pré-rempli│
│  └──────┬──────┘
│         │
│  Paiement effectué
│         ▼
│  ┌─────────────┐
│  │   Ticket    │
│  │   Généré    │
│  └──────┬──────┘
│         │
│  WebSocket emit
│  'cashier_item_status'
│  'completed'
│         ▼
└──────────────────────────────────────┘
         │
         ▼
┌─────────┐
│   PDA   │ ◄── Reçoit confirmation
│         │    "Vente finalisée: TCK-2026-0001"
└─────────┘
```

## Tests

### Test WebSocket avec wscat
```bash
npm install -g wscat

# Se connecter à la caisse
wscat -c ws://localhost:8000/ws/cashier/

> {"type": "ping"}
< {"type": "pong"}

> {"type": "cashier_item_new", "pda_id": "PDA-TEST", "item_id": "123", "articles": [{"produit_id": 1, "designation": "Test", "quantite": 1, "prix_unitaire": "1000", "total_ttc": "1180"}], "total_estime": "1180", "articles_count": 1}
```

## Notes
- Le hook `useCashierWebSocket` gère la reconnexion automatique
- Les ventes PDA sont stockées dans `pendingItems` jusqu'à acceptation/refus
- La conversion utilise des produits "minimaux" - il est recommandé de recharger les produits complets depuis l'API avant validation
- Pour les lots/péremption : le PDA doit envoyer `lotId` si disponible
