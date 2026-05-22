# 🔌 Configuration WebSocket - PDA ↔ Caisse Temps Réel

## Installation (À faire)

```bash
cd c:\Projet Fullstack\fullstack_produits\backend

# Activer l'environnement virtuel
activate_env.bat

# Installer Django Channels
pip install channels>=4.0 channels-redis>=4.0 daphne>=4.0

# Vérifier l'installation
python -c "import channels; print('Channels OK')"
python -c "import daphne; print('Daphne OK')"
```

## Fichiers Créés/Modifiés

### Backend Django
| Fichier | Description |
|---------|-------------|
| `api/consumers.py` | WebSocket Consumers (CashierConsumer, PDAConsumer) |
| `api/routing.py` | Routage WebSocket |
| `backend/asgi.py` | Configuration ASGI mise à jour |
| `backend/settings.py` | Ajout Channels + Channel Layer |
| `requirements.txt` | Ajout dépendances channels/daphne |

### API WebSocket Endpoints
```
ws://serveur/ws/cashier/    → Web caisse (écoute les articles PDA)
ws://serveur/ws/pda/        → PDA mobile (envoi articles + reçoit status)
```

## Flux de Communication

### PDA → Caisse (Nouvelle vente)
```json
{
  "type": "cashier_item_new",
  "pda_id": "PDA-ABC123",
  "item_id": "uuid-123",
  "articles": [
    {
      "produit_id": 1,
      "code_barre": "123456789",
      "designation": "Produit A",
      "quantite": 2,
      "prix_unitaire": "1000.00",
      "remise_produit": "0",
      "tva": "18",
      "total_ttc": "2360.00"
    }
  ],
  "client": { "id": 1, "name": "John Doe" },
  "ayant_droit": { "id": 1, "nom": "Doe", "prenom": "Jane", "taux_couverture": 80 },
  "total_estime": "2360.00",
  "articles_count": 2
}
```

### Caisse → PDA (Mise à jour statut)
```json
{
  "type": "cashier_item_status",
  "item_id": "uuid-123",
  "status": "completed",
  "ticket": {
    "numero_ticket": "TCK-2026-0001",
    "total_ttc": "2360.00"
  }
}
```

## Prochaines Étapes

### 1. Backend - Créer l'API REST complémentaire
- `POST /api/mobile/cashier-queue/` - Fallback HTTP si WebSocket indisponible
- `GET /api/mobile/cashier-queue/{id}/status` - Polling pour PDA

### 2. Frontend Web - Hook WebSocket
Créer `frontend/src/hooks/useCashierWebSocket.ts` pour :
- Se connecter à `ws://serveur/ws/cashier/`
- Recevoir `cashier_item_new` → Afficher popup notification
- Ouvrir la vente pré-remplie dans Facturation.tsx

### 3. Mobile PDA - Service WebSocket
Créer `mobile-facturation/src/services/websocketCashier.ts` pour :
- Se connecter au WebSocket
- Émettre `cashier_item_new` après validation
- Écouter `cashier_item_status` pour confirmations

## Test Manuel

```bash
# Lancer le serveur avec Daphne (ASGI)
cd backend
python -m daphne -b 0.0.0.0 -p 8000 backend.asgi:application

# Tester avec wscat (npm install -g wscat)
wscat -c ws://localhost:8000/ws/cashier/
> {"type": "ping"}
< {"type": "pong"}
```

## Notes
- **Développement** : Channel layer en mémoire (pas besoin de Redis)
- **Production** : Configurer `REDIS_URL` dans `.env` pour scaling
- **Fallback** : L'API HTTP `cashierSync.ts` reste fonctionnelle si WS down
