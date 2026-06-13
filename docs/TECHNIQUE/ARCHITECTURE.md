# 🏗️ Architecture Système

## Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                              │
│                   (Navigateur Web)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP
┌─────────────────────────────────────────────────────────────┐
│                     REVERSE PROXY                           │
│                     Nginx (Port 80)                         │
│  • Servir fichiers statiques (React build)                  │
│  • Proxy API vers backend                                  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼ HTTP 8000
┌─────────────────────────┐    ┌─────────────────────────────┐
│      FRONTEND           │    │       BACKEND               │
│  React + TypeScript     │    │   Django REST API           │
│  TailwindCSS + DaisyUI  │    │   PostgreSQL + Redis        │
└─────────────────────────┘    └─────────────────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
        ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
        │   PostgreSQL    │   │     Redis       │   │   Scheduler     │
        │   (Port 5432)   │   │   (Port 6379)   │   │   (APScheduler) │
        │                 │   │                 │   │                 │
        │ • Produits      │   │ • Cache API     │   │ • Rotation      │
        │ • Ventes        │   │ • Sessions      │   │ • Stock Min/Max │
        │ • Stocks        │   │ • Rate limiting │   │ • Alertes       │
        │ • Clients       │   │                 │   │                 │
        │ • Fournisseurs  │   │                 │   │                 │
        │ • Comptabilité  │   │                 │   │                 │
        └─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## Architecture 3-Tiers

### 1. Présentation (Frontend)

| Aspect | Détail |
|--------|--------|
| **Framework** | React 18 + TypeScript |
| **Styling** | TailwindCSS v4 + DaisyUI |
| **State** | Zustand |
| **HTTP** | Axios |
| **Build** | Vite → Nginx |
| **Features** | POS, Gestion, Rapports, Admin |

**Composants clés** :
- `Commandes/` : Gestion commandes fournisseurs
- `facturation/` : Caisse, tickets, paiements
- `fournisseurs/` : CRUD fournisseurs + délai livraison
- `GestionDivers/` : Paramètres système

### 2. Logique Métier (Backend)

| Aspect | Détail |
|--------|--------|
| **Framework** | Django 4.2 + Django REST Framework |
| **Langage** | Python 3.11 |
| **API** | REST JSON |
| **Auth** | Token-based + Session |
| **Cache** | Redis |
| **Tasks** | APScheduler |

**Modules principaux** (`backend/api/`) :
- `models/` : Entités (Produit, Fournisseur, Facture...)
- `views/` : Endpoints API
- `services/` : Logique métier (ventes, stocks)
- `signals*.py` : Automations (rotation, seuils stock)

### 3. Données (Database)

#### PostgreSQL Schéma

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Produit      │────<│ FactureProduit  |>────│    Facture      │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │     │ id              │
│ nom             │     │ produit_id      │     │ client_id       │
│ stock_min       │     │ facture_id      │     │ status          │
│ stock_max       │     │ quantity        │     │ total           │
│ fournisseur_id│>────│ prix_unitaire   │     │ date_creation   │
│ delai_livraison │     └─────────────────┘     └─────────────────┘
└─────────────────┘              │                      │
         │                       │                      │
         ▼                       ▼                      ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Fournisseur   │     │  MouvementStock │     │     Client      │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │     │ id              │
│ nom             │     │ produit_id      │     │ nom             │
│ delai_livraison │     │ type            │     │ telephone       │
│ conditions_paiement│  │ quantite        │     │ email           │
│ adresse         │     │ date            │     │ type_client     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

#### Tables Critiques

| Table | Description | Volume estimé |
|-------|-------------|---------------|
| `api_produit` | Catalogue médicaments | ~10K-50K |
| `api_facture` | Tickets de caisse | ~100K-1M |
| `api_lignefacture` | Lignes de vente | ~500K-5M |
| `api_mouvementstock` | Historique stock | ~200K-2M |
| `api_client` | Clients | ~1K-10K |
| `api_fournisseur` | Fournisseurs | ~10-50 |

---

## Flux de Données

### 1. Vente (POS)

```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐
│ Scanner │───>│ Frontend │───>│ Backend  │───>│  Stock   │───>│ Facture │
│ CIP     │    │ POS      │    │ Vente    │    │ Update   │    │ Générée │
└─────────┘    └──────────┘    └──────────┘    └──────────┘    └─────────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │ PostgreSQL   │
                              │ + Redis      │
                              └──────────────┘
```

### 2. Calcul Stock Min/Max (Automatisé)

```
Trigger: 1er du mois OU après chaque vente
    │
    ▼
┌──────────────┐
│ Scheduler    │
│ Signals      │
└──────────────┘
    │
    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Ventes 30j   │───>│ Formule      │───>│ Mise à jour  │
│ + Délai      │    │ Min=(V/30)*D │    │ Produit      │
│ Fournisseur  │    │ Max=V*1.2    │    │ stock_min/max│
└──────────────┘    └──────────────┘    └──────────────┘
```

### 3. Backup Incrémental

```
Toutes les 30 minutes
    │
    ▼
┌──────────────┐
│ Script       │
│ backup-*.ps1 │
└──────────────┘
    │
    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ pg_dump      │───>│ Compression  │───>│ Stockage     │
│ table=xxx    │    │ .zip         │    │ C:\backup\   │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## Signaux Django (Automations)

| Signal | Déclencheur | Action |
|--------|-------------|--------|
| `signals_stock_levels.py` | FactureProduit save/delete | Recalcule stock_min/max |
| `signals_rotation.py` | Tâche planifiée (mensuelle) | Met à jour rotation produit |
| `signals_comptabilite.py` | Vente validée | Crée écritures comptables |

---

## Services Externes

| Service | Utilisation | Configuration |
|---------|-------------|---------------|
| **Tailscale** | VPN interne | `TAILSCALE_AUTHKEY` |
| **Ngrok** | Tunnel public | `NGROK_AUTHTOKEN` |
| **Redis** | Cache + Sessions | Interne (Docker) |

---

## Sécurité

### Couches de Sécurité

1. **Réseau** : Docker internal network, pas d'exposition directe DB
2. **Application** : CORS, CSRF protection, JWT tokens
3. **Données** : PostgreSQL avec authentification, backups chiffrés (optionnel)
4. **Transport** : HTTPS (via Tailscale/Ngrok), HTTP local

### Permissions

| Rôle | Droits |
|------|--------|
| Admin | Tout |
| Pharmacien | Ventes, Stocks, Rapports |
| Caissier | Ventes uniquement |
| Fournisseur | Lecture commandes (API restreinte) |

---

## Performance & Optimisation

### Connection Pooling
- Max 20 connexions PostgreSQL
- Timeout 30s
- Retry automatique

### Cache Strategy
- Cache API : 5 minutes (données statiques)
- Cache sessions : Redis
- Cache rapports : 1 heure

### Index Clés
- `api_produit.cip` (recherche fréquente)
- `api_facture.date_creation` (rapports)
- `api_lignefacture.facture_id` (jointures)

---

## Monitoring

### Health Checks
- `/api/health/` : Backend status
- Docker healthchecks sur tous les services

### Logs
```bash
docker compose logs -f backend   # Logs backend
docker compose logs -f frontend  # Logs Nginx
docker compose logs -f db        # Logs PostgreSQL
```

### Métriques (à implémenter)
- Temps réponse API
- Taux d'erreur
- Utilisation mémoire/CPU
- Nombre ventes/heure
