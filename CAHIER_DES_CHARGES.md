# Cahier des Charges — Application ZENITH
## Système de Gestion de Pharmacie Fullstack

**Version** : 1.0  
**Date de rédaction** : Avril 2026  
**Statut** : En cours de développement  
**Auteur** : Équipe de développement ZENITH

---

## 1. Présentation Générale du Projet

### 1.1 Contexte
ZENITH est une application web de gestion complète destinée aux pharmacies. Elle couvre l'ensemble des opérations quotidiennes : vente au comptoir, gestion des stocks, commandes fournisseurs, facturation, comptabilité et reporting analytique.

### 1.2 Objectifs
- Digitaliser et centraliser toutes les opérations d'une pharmacie
- Réduire les erreurs de gestion (stocks, prix, TVA, créances)
- Offrir une traçabilité complète des mouvements financiers et de stock
- Fournir des tableaux de bord et rapports décisionnels en temps réel
- Supporter plusieurs postes simultanément sur un réseau local

### 1.3 Périmètre
L'application est destinée à une utilisation **en interne par le personnel de la pharmacie** (pharmacien, préparateurs, caissiers, gestionnaire). Elle n'est pas destinée au grand public.

---

## 2. Architecture Technique

### 2.1 Stack Technologique

| Couche | Technologie |
|--------|-------------|
| Backend | Django 5+ / Django REST Framework |
| Base de données | PostgreSQL (+ django.contrib.postgres) |
| Cache | Redis / django-redis |
| Frontend | React 18 + TypeScript |
| État global | Zustand |
| Requêtes API | React Query (TanStack Query) |
| Styles | TailwindCSS |
| Internationalisation | i18next (FR/EN) |
| Validation | Zod (frontend) |
| Authentification | Token Authentication (DRF) |
| Serveur web | Nginx + Gunicorn (production) |
| Conteneurisation | Docker / Docker Compose |

### 2.2 Architecture Globale
```
Poste Client (Navigateur)
       │  HTTP/REST
       ▼
   Nginx (reverse proxy)
       │
   Gunicorn (WSGI)
       │
   Django REST Framework
       │          │
  PostgreSQL    Redis (cache)
```

### 2.3 Organisation du Code

**Backend** (`backend/`) :
- `api/models/` — Modèles de données (~20 modèles)
- `api/views/` — ViewSets REST organisés par domaine métier
- `api/serializers.py` — Sérialisation des données
- `api/migrations/` — Historique des migrations (76+)
- `backend/settings.py` — Configuration centralisée

**Frontend** (`frontend/frontend/src/`) :
- `components/` — 67 composants React organisés par domaine
- `hooks/` — 14 hooks personnalisés réutilisables
- `services/` — Couche d'accès à l'API
- `types/` — Interfaces TypeScript
- `stores/` — Stores Zustand globaux

---

## 3. Modules Fonctionnels

### 3.1 Module Caisse / Vente (Point de Vente)
**Objectif** : Permettre la vente au comptoir en temps réel.

**Fonctionnalités** :
- Recherche de produits par nom, code CIP, code-barres
- Ajout au panier avec gestion des quantités
- Calcul automatique des totaux (HT, TVA, TTC)
- Gestion des **modes de paiement** : espèces, carte, chèque, tiers payant
- **Tiers payant** : part patient / part assurance avec calcul automatique
- **Système de fidélité** : cumul de points, remises automatiques
- **Coupons de monnaie** : bons de reste pour les clients
- Impression de tickets de caisse et reçus
- Gestion de la **caisse journalière** : ouverture, clôture, écarts
- **Ordonnancier** : traçabilité des ordonnances dispensées

### 3.2 Module Facturation
**Objectif** : Gérer les factures clients avec une traçabilité complète.

**Fonctionnalités** :
- Création, modification et annulation de factures
- Factures avec produits multiples, remises par ligne
- Gestion des **avoirs** (retours clients/fournisseurs)
- Système de **créances** : paiements partiels, plafonds par client, suivi des dettes
- **Ayants droit** : gestion des bénéficiaires pour clients professionnels
- Historique complet des ventes avec filtres avancés
- **Promis** : système de réservation de produits pour clients

### 3.3 Module Stock
**Objectif** : Assurer un suivi précis et en temps réel des niveaux de stock.

**Fonctionnalités** :
- Gestion des **lots et dates d'expiration**
- Déstockage en **FIFO** (premier entré, premier sorti) automatique
- Alertes de stock minimum / stock maximum
- **Inventaire** : saisie et validation des inventaires physiques
- **Ajustements de stock** manuels avec motif et traçabilité
- Journal des **mouvements de stock** (entrées/sorties/ajustements)
- Gestion des produits **périmés** (Perimes)
- **Transformations** : reconditionnement de produits
- Ruptures fournisseurs avec suivi
- Analyse ABC et analyse temporelle des mouvements

### 3.4 Module Commandes Fournisseurs
**Objectif** : Gérer les commandes d'approvisionnement auprès des fournisseurs.

**Fonctionnalités** :
- Création de commandes en mode brouillon / en préparation
- Ajout de produits avec quantités, prix d'achat, TVA, lot et date d'expiration
- **Synchronisation bulk** des lignes de commande (optimisation réseau)
- **Réassort automatique** : création de commandes auto depuis les ventes
- Clôture de commande avec mise à jour automatique du stock et création des lots
- Suivi des statuts : `EN_PREPARATION` → `EN_ATTENTE` → `CLÔTURÉE`
- Gestion des **avoirs fournisseurs**
- Paiements fournisseurs avec suivi des échéances
- **Transfert de commande** entre fournisseurs
- Historique des achats par produit et par fournisseur

### 3.5 Module Produits
**Objectif** : Centraliser la gestion du catalogue produit.

**Fonctionnalités** :
- Fiche produit complète : nom, CIP, forme, rayon, famille de risque, substance active
- Prix d'achat, prix de revient, prix de vente, taux de marge calculé automatiquement
- Gestion de la **TVA** par produit
- Interactions médicamenteuses entre substances
- Groupes, rayons, formes galéniques configurables
- Historique des achats et des ventes par produit
- Indicateurs de rotation moyenne

### 3.6 Module Clients & Fournisseurs
**Fonctionnalités** :
- Fiche client complète avec plafond de crédit, historique, points de fidélité
- Gestion des **ayants droit** (bénéficiaires)
- Fiche fournisseur avec délais de paiement, conditions commerciales
- Statistiques fournisseur (achats, marges, historique)
- Échéancier fournisseurs

### 3.7 Module Rapports & Analytique
**Fonctionnalités** :
- **Dashboard** principal avec indicateurs clés (CA, marge, stock, ventes du jour)
- **Rapport mensuel** : évolution CA, marges, comparaison N/N-1
- **Rapport UG** (Unités Gratuites) : suivi des promotions fournisseurs
- **Centre de rapports** : rapports filtrables et exportables
- **Historique des ventes** et **historique des achats** avec filtres avancés
- **Analyse ABC** des produits (contribution au CA)
- **Analyse temporelle** des flux de stock
- **Classement des vendeurs** (performance par caissier)
- **Historique des clôtures de caisse**
- **Journal de caisse** : tous les mouvements de trésorerie

### 3.8 Module Finance
**Fonctionnalités** :
- Suivi des **créances clients** en temps réel
- Gestion des **paiements fournisseurs** (partiels, complets)
- **Journal des mouvements de caisse**
- **Relevé de paiement** par période
- Module financier avancé avec indicateurs de rentabilité

### 3.9 Module Administration & Paramétrage
**Fonctionnalités** :
- **Gestion des utilisateurs** : création, rôles, permissions
- **Sessions utilisateurs** : suivi des connexions
- **Paramètres pharmacie** : nom, informations légales, TVA par défaut
- **Paramètres de fidélité** : taux d'accumulation, seuils de remise
- **Configuration des objectifs commerciaux**
- **Journal d'audit** : traçabilité complète de toutes les actions utilisateurs
- **Maintenance** : outils de diagnostic et de correction des données

### 3.10 Module PDA / Inventaire Mobile
**Objectif** : Permettre la saisie d'inventaire depuis un terminal mobile (PDA).

**Fonctionnalités** :
- Application React Native (Expo) — `pda-inventaire/`
- Scan de codes-barres
- Saisie des quantités en rayon
- Synchronisation avec le backend via API REST

---

## 4. Modèles de Données Principaux

| Modèle | Description |
|--------|-------------|
| `Produit` | Catalogue produit complet |
| `Commande` | Commande fournisseur |
| `CommandeProduit` | Ligne d'une commande fournisseur |
| `Facture` | Facture client |
| `FactureProduit` | Ligne d'une facture |
| `StockLot` | Lot de stock avec date d'expiration |
| `MouvementStock` | Journal des mouvements de stock |
| `Client` | Fiche client |
| `Fournisseur` | Fiche fournisseur |
| `Avoir` / `LigneAvoir` | Avoirs fournisseurs |
| `PaiementFournisseur` | Paiements fournisseurs |
| `Caisse` | Session de caisse |
| `Inventaire` / `LigneInventaire` | Inventaires physiques |
| `Promis` | Réservations produits |
| `ActivityLog` / `AuditLog` | Traçabilité et audit |

---

## 5. Sécurité & Authentification

- **Authentification** par Token DRF (`rest_framework.authtoken`)
- **Hachage des mots de passe** : Argon2 (recommandé OWASP)
- **SECRET_KEY** chargée depuis `.env` (jamais en dur)
- **CORS** configuré via `django-cors-headers`
- **ALLOWED_HOSTS** configurables via variables d'environnement
- **Rate limiting** : 100 000 requêtes/jour par utilisateur authentifié
- **ORM Django** : protection automatique contre les injections SQL
- **DOMPurify** côté frontend pour la sanitisation HTML
- **Transactions atomiques** sur 41+ opérations critiques (stocks, factures, clôtures)

---

## 6. Performance & Scalabilité

- **Cache Redis** avec invalidation automatique sur les données volatiles
- **Connection pooling** PostgreSQL (`CONN_MAX_AGE=600`)
- **Index de base de données** sur les champs fréquemment filtrés
- **Pagination** globale (`PAGE_SIZE=50`)
- **`select_related` / `prefetch_related`** sur les ViewSets critiques
- **Bulk operations** (`bulk_create`, `bulk_update`) pour les écritures massives
- **Lazy Loading** React : bundle initial allégé via `React.lazy()`
- **Zustand** pour l'état global (remplace les hooks d'état lourds)

---

## 7. Déploiement

### 7.1 Environnements
- **Développement** : `DEBUG=True`, serveur Vite (frontend) + Django runserver (backend)
- **Production** : Nginx + Gunicorn, `DEBUG=False`, variables d'environnement via `.env`

### 7.2 Infrastructure Production
- **Docker Compose** : orchestration des services (backend, frontend, PostgreSQL, Redis)
- **Nginx** : reverse proxy + serving des fichiers statiques
- **Gunicorn** : serveur WSGI Python
- **Whitenoise** : serving des fichiers statiques Python

### 7.3 Variables d'Environnement Requises
| Variable | Description |
|----------|-------------|
| `DJANGO_SECRET_KEY` | Clé secrète Django |
| `DJANGO_DEBUG` | Mode debug (`True` / `False`) |
| `DJANGO_ALLOWED_HOSTS` | Hôtes autorisés (séparés par virgule) |
| `DATABASE_URL` | URL de connexion PostgreSQL |
| `REDIS_URL` | URL de connexion Redis |

---

## 8. Qualité & Tests

### 8.1 Tests Backend
- Framework : `pytest` + `pytest-django`
- Factories de données de test : `api/tests/factories.py`
- Fichiers de tests : `test_order_management.py`, `test_cash_closure.py`, `test_invoice_validation.py`, `test_critical_business_logic.py`
- Couverture actuelle : < 10% (à améliorer)

### 8.2 Tests Frontend
- Dossier : `components/__tests__/`
- Couverture actuelle : en cours

### 8.3 Qualité du Code
- **TypeScript strict** sur tout le frontend
- **Zod** : validation des formulaires critiques côté client
- **ESLint** : analyse statique du code TypeScript
- **Pyright** : analyse statique du code Python (avec `django-stubs`)
- **i18n** : internationalisation FR/EN via `react-i18next`

---

## 9. Contraintes & Limitations Connues

| Contrainte | Description |
|------------|-------------|
| Multi-poste réseau local | L'application tourne sur un réseau local. Les IP sont configurées dans `ALLOWED_HOSTS`. |
| Pas d'accès internet requis | L'application fonctionne hors ligne sur le réseau local. |
| PostgreSQL obligatoire | Certaines fonctionnalités utilisent `django.contrib.postgres` (index GIN, trigrammes). |
| Fichiers volumineux | `Facturation.tsx` (~30k), `CaisseCentralisee.tsx` (~52k) — refactoring prévu. |

---

## 10. Évolutions Prévues (Roadmap)

### Court terme
- [ ] Corriger les erreurs TypeScript restantes (`tsc -b`)
- [ ] Normaliser Zod v4 (migration `error.errors` → `error.issues`)
- [ ] Aligner les contrats de types Frontend/Backend
- [ ] Unifier la gestion des erreurs API (toasts cohérents)

### Moyen terme
- [ ] Refonte UI/UX complète (Design System : tokens, composants standardisés)
- [ ] Découpage de `Facturation.tsx` en sous-composants
- [ ] Documentation API Swagger/OpenAPI
- [ ] Optimisation des performances restantes (propriétés `@property` coûteuses)

### Long terme
- [ ] Tests d'intégration E2E (Cypress ou Playwright)
- [ ] Monitoring d'erreurs (Sentry)
- [ ] Pipeline CI/CD automatisé
- [ ] Support tablette/mobile amélioré

---

*Document généré en Avril 2026 — Projet ZENITH*
