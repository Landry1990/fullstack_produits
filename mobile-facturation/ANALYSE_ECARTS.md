# Analyse des Écarts - Mobile Facturation vs Système Principal

> **📅 Dernière mise à jour :** 17 Mai 2026  
> **✅ Statut :** Phase 1 & 2 terminées, WebSocket en cours d'intégration

## ✅ PROGRESSION

### ✅ TERMINÉ
- [x] Types alignés (`LigneFacture`, `TicketCaisse`, `Client`, `AyantDroit`, `PaymentDetail`)
- [x] Utilitaires financiers (`finance.ts`) avec calculs précis (string)
- [x] `CartStore` refondu avec TVA, remises, client, ayant droit
- [x] `CashierQueueStore` pour file d'attente caisse
- [x] Service API HTTP `cashierSync.ts`
- [x] **WebSocket temps réel :**
  - [x] Backend Django Channels (`consumers.py`, `routing.py`)
  - [x] Hook WebSocket Caisse Web (`useCashierWebSocket.ts`)
  - [x] Service WebSocket PDA (`websocketPDA.ts`)
  - [x] Hook React Native PDA (`useWebSocketPDA.ts`)

### 🚧 EN COURS
- [ ] Intégration des écrans PDA (SaleScreen, CartScreen)
- [ ] Tests bout-en-bout PDA ↔ Web

### 📋 À FAIRE
- [ ] Écran de sélection client/ayant droit
- [ ] Écran file d'attente caisse (mobile)
- [ ] Tests en conditions réelles

---

## 🚨 FAILLES CRITIQUES IDENTIFIÉES (AVANT REFONTE)

### 1. **Structure des données incompatible** ✅ CORRIGÉ
| Aspect | Avant | Après | Status |
|--------|-------|-------|--------|
| Ligne facture | `InvoiceItem` | `LigneFacture` | ✅ |
| Prix | `unit_price: number` | `prix_unitaire: string` | ✅ |
| Quantité | `quantity: number` | `quantite: number` | ✅ |
| Remise | ❌ **ABSENT** | `remise_produit: string` | ✅ |
| TVA | ❌ **ABSENT** | `tva: string` | ✅ |

**Fichiers créés :** `src/types/index.ts`, `src/utils/finance.ts`

### 2. **Gestion Client Incomplète** ✅ CORRIGÉ
- **Avant** : Simple champ `client: string | null`
- **Après** : 
  - Interface `Client` complète
  - Interface `AyantDroit` avec taux_couverture
  - Support `type_reglement`, `delai_paiement_jours`
  
**Fichiers créés :** `src/types/index.ts` (types Client, AyantDroit, PaymentDetail)

### 3. **Pas de Gestion des Paiements** ✅ CORRIGÉ (Mode Autonome)
- **Avant** : Aucune structure de paiement
- **Après** : `PaymentDetail[]` complet avec :
  - Mode paiement (ESPÈCES, CARTE, CHÈQUE, VIREMENT, MOBILE_MONEY)
  - Montants en string (précision)
  - Référence transaction
  - Calcul monnaie rendue
  
**Fichiers créés :** `src/types/index.ts`, `src/utils/finance.ts` (calculateChange)

### 4. **Système de Stock Divergent** 🔄 PARTIELLEMENT CORRIGÉ
- **Avant** : `stock_local: number` simple
- **Après** : Interface `Product` enrichie :
  - `stock_local`, `stock_lot`
  - `peremption` (date ISO)
  - `cmm` (Consommation Moyenne Mensuelle)
  - `tva` (taux TVA)
  
**Fichiers modifiés :** `src/types/product.ts`

### 5. **Pas de Tickets de Caisse** ✅ CORRIGÉ
- **Avant** : Génère des "factures" simples
- **Après** : `TicketCaisse` complet avec :
  - `numero_ticket` (format: TCK-YYYY-XXXXXX)
  - `lignes: LigneFacture[]`
  - `client`, `ayant_droit`
  - `paiements: PaymentDetail[]`
  - Totaux (HT, TVA, TTC) en string
  
**Fichiers créés :** `src/types/index.ts` (TicketCaisse), `src/stores/useCartStore.ts` (serialization)

---

## 🔌 NOUVEAUTÉ : WebSocket Temps Réel PDA ↔ Caisse

### Architecture "Envoi à la Caisse Centrale"

```
┌─────────┐    WebSocket WS     ┌─────────┐    WebSocket WS     ┌─────────┐
│   PDA   │ ───────────────────>│ Django  │────────────────────>│  Web    │
│ (React  │   cashier_item_new  │Channels │  cashier_item_new   │ Caisse  │
│ Native) │                     │         │                     │         │
│         │ <────────────────── │         │ <──────────────────── │         │
│         │  cashier_item_status│         │  cashier_item_status│         │
└─────────┘                     └─────────┘                     └─────────┘
     │                              │                              │
     │ Fallback HTTP (si WS down)   │                              │
     │ POST /mobile/cashier-queue   │                              │
     │ GET  /mobile/cashier-queue/  │                              │
     └──────────────────────────────┘                              │
                                                                   │
                              ┌────────────────────────────────────┘
                              │ PDAQueueBanner.tsx
                              │ Notification + Chargement panier
```

### Latence Comparée

| Méthode | Latence typique | Bande passante | Fiabilité |
|---------|----------------|----------------|-----------|
| **WebSocket** | 50-100ms | Très faible (persistent) | ⭐⭐⭐⭐⭐ |
| **HTTP Polling** | 3000ms (3s) | Élevée (1 req/3s) | ⭐⭐⭐ |
| **Long Polling** | 500-1000ms | Modérée | ⭐⭐⭐⭐ |

### Fichiers WebSocket Créés

#### Backend Django
- `backend/api/consumers.py` - Consumers WebSocket (CashierConsumer, PDAConsumer)
- `backend/api/routing.py` - Routes WebSocket
- `backend/backend/asgi.py` - Configuration ASGI avec ProtocolTypeRouter
- `backend/backend/settings.py` - Channels + Channel Layer

#### Frontend Web (Caisse)
- `frontend/src/hooks/useCashierWebSocket.ts` - Hook écoute WebSocket
- `frontend/src/components/facturation/PDAQueueBanner.tsx` - Bannière notifications PDA
- `frontend/src/utils/pdaConversion.ts` - Conversion PDA → LigneFacture
- `frontend/PDA_INTEGRATION_GUIDE.md` - Guide d'intégration Facturation.tsx

#### Mobile PDA
- `mobile-facturation/src/services/websocketPDA.ts` - Service WebSocket hybride (WS + fallback HTTP)
- `mobile-facturation/src/hooks/useWebSocketPDA.ts` - Hook React Native
- `mobile-facturation/PDA_WEBSOCKET_GUIDE.md` - Guide d'intégration écrans

### Flux Complet "Envoi à la Caisse"

```typescript
// 1. PDA scanne articles
// 2. Utilisateur clique "Envoyer à la caisse"
const queueItem = cart.createCashierQueueItem();
await ws.sendToCashier(queueItem);

// 3. WebSocket émet 'cashier_item_new' → Django Channels
// 4. Django broadcast au groupe 'cashier_updates'

// 5. Web Caisse reçoit (useCashierWebSocket)
// 6. PDAQueueBanner affiche notification
// 7. Caisse clique "Charger" → Cart rempli automatiquement

// 8. Caisse effectue paiement → Validation
// 9. WebSocket émet 'cashier_item_status' = 'completed'

// 10. PDA reçoit confirmation → Toast "Ticket TCK-2026-0001 validé"
```

### Modes de Fonctionnement

| Mode | Description | WebSocket | Fallback |
|------|-------------|-----------|----------|
| **Temps Réel** | Connexion WS active | ✅ Primaire | HTTP si WS down |
| **Dégradé** | WS indisponible | ❌ | ✅ HTTP Polling |
| **Offline** | Aucune connexion | ❌ | ❌ File locale SQLite |

---

## ⚠️ DIFFÉRENCES DE LOGIQUE MÉTIER

### Panier / Cart Store
```typescript
// ❌ MOBILE - Trop simpliste
interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

// ✅ PRINCIPAL - Complet
interface LigneFacture {
  produit: ProduitModel;
  quantite: number;
  prix_unitaire: string;     // String pour précision
  remise_produit: string;    // % de remise
  tva: string;               // TVA applicable
  // ... autres champs
}
```

### Validation des Ventes
- **Mobile** : Aucune validation métier
- **Principal** : 
  - Vérification stock temps réel
  - Validation sudo pour modifications
  - Contrôle des quantités négatives
  - Vérification client obligatoire

### Synchronisation
- **Mobile** : Système custom avec `uuid`, `status`, `error_message`
- **Principal** : API temps réel avec gestion d'erreur intégrée

---

## 📋 PLAN DE CORRECTION RECOMMANDÉ

### ✅ Phase 1 : Alignement des Types (TERMINÉE)
1. [x] Remplacer `InvoiceItem` par `LigneFacture` aligné avec le principal
2. [x] Ajouter les champs manquants : `remise_produit`, `tva`, etc.
3. [x] Changer `unit_price: number` → `prix_unitaire: string`
4. [x] Créer types `Client`, `AyantDroit`, `PaymentDetail` alignés

### ✅ Phase 2 : Infrastructure Caisse (TERMINÉE)
1. [x] Créer `CashierQueueStore` pour file d'attente
2. [x] Service API HTTP `cashierSync.ts`
3. [x] Service WebSocket temps réel `websocketPDA.ts`
4. [x] Hook React Native `useWebSocketPDA.ts`

### 🚧 Phase 3 : Écrans PDA (EN COURS)
1. [ ] Créer écran de sélection client avec recherche
2. [ ] Gérer les ayants droit (assurances)
3. [ ] Intégrer WebSocket dans `CartScreen.tsx`

### 📋 Phase 4 : Paiements (MODE AUTONOME)
1. [ ] Ajouter écran de paiement multi-modes
2. [ ] Calculer monnaie à rendre (utilitaire déjà créé)
3. [ ] Générer TicketCaisse complète

### 📋 Phase 5 : Stock Avancé
1. [ ] Intégrer vérification stock temps réel
2. [ ] Gérer les lots et péremptions (champs ajoutés)
3. [ ] Décrémenter le bon lot

### 📋 Phase 6 : Sécurité & Validation
1. [ ] Ajouter validation métier avant validation
2. [ ] Gérer les erreurs API avec retry

---

## 🔧 FICHIERS À MODIFIER

### ✅ Fichiers Créés (Types & Infrastructure)
- `src/types/index.ts` → Types alignés (`LigneFacture`, `TicketCaisse`, `Client`, `AyantDroit`, `PaymentDetail`)
- `src/types/product.ts` → Champs `tva`, `stock_lot`, `peremption`, `cmm` ajoutés
- `src/utils/finance.ts` → Calculs précis (string-based)
- `src/stores/useCashierQueueStore.ts` → File d'attente caisse
- `src/services/cashierSync.ts` → API HTTP pour caisse
- `src/services/websocketPDA.ts` → Service WebSocket temps réel
- `src/hooks/useWebSocketPDA.ts` → Hook React Native WebSocket

### 🚧 Fichiers à Modifier (Écrans)
- `src/stores/useCartStore.ts` → Ajouter `createCashierQueueItem()`
- `src/screens/SaleScreen.tsx` → Intégrer sélection mode (autonome/caisse)
- `src/screens/CartScreen.tsx` → Ajouter bouton "Envoyer à la caisse"
- `src/screens/ClientSelectScreen.tsx` → NOUVEAU: Sélection client + ayants droit
- `src/screens/PendingSalesScreen.tsx` → NOUVEAU: Suivi ventes en attente

### 📋 Fichiers Optionnels (Mode Autonome)
- `src/screens/PaymentScreen.tsx` → Paiement multi-modes
- `src/database/invoiceRepository.ts` → Stocker TicketCaisse complet

---

## 💡 RECOMMANDATION STRATÉGIQUE

**Option A : Refonte Complète (Recommandée)**
- Réécrire les types et stores pour être 100% compatibles
- Réutiliser les hooks et utils du projet principal (si possible)
- Créer une couche d'adaptation API

**Option B : Couche de Mapping**
- Garder le code mobile existant
- Créer des fonctions de conversion `toLigneFacture()`, `fromLigneFacture()`
- Mapper à l'API au moment de l'envoi
- ⚠️ Risque de bugs de conversion

**Option C : Architecture Hybride**
- Utiliser le même schéma de base de données que le backend
- Créer des vues simplifiées pour l'UI mobile
- Synchronisation directe avec SQLite

---

## 📊 MÉTRIQUES DE SUCCÈS

- [ ] Types 100% alignés avec `types/finance.ts` du principal
- [ ] Validation d'une vente avec client + paiement + ticket
- [ ] Synchronisation offline → online sans perte de données
- [ ] Gestion des remises et TVA identique au principal
- [ ] Impression ticket thermique compatible
