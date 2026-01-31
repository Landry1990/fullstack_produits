# 📱 Roadmap - Application PDA Inventaire

**Date de création** : 31 Janvier 2026  
**Technologie** : React Native + Expo

---

## 🎯 Objectif

Développer une application mobile pour PDA (Personal Digital Assistant) permettant la gestion d'inventaire via scanner de codes-barres intégré.

---

## 📋 Phase 1 : Fondations (Semaine 1) ✅ TERMINÉ

### 1.1 Configuration Projet
- [x] Initialiser le projet Expo avec TypeScript
- [x] Configurer la navigation (simple state-based)
- [x] Mettre en place l'authentification (token API)
- [x] Créer les services API (axios/fetch)

### 1.2 Écran de Connexion
- [x] Interface login (utilisateur/mot de passe)
- [x] Stockage sécurisé du token (SecureStore)
- [x] Déconnexion automatique après inactivité

---

## 📋 Phase 2 : Fonctionnalités Core (Semaine 2-3)

### 2.1 Scanner de Codes-Barres
- [x] Intégration `expo-barcode-scanner`
- [x] Support CIP1, CIP2, CIP3 (codes 7, 13 caractères)
- [x] Feedback visuel/sonore après scan
- [x] Mode saisie manuelle (fallback)

### 2.2 Gestion de l'Inventaire
- [x] Liste des sessions d'inventaire actives
- [x] Création nouvelle session d'inventaire
- [x] Scan produit → affichage info produit (mode laser PDA)
- [x] Saisie quantité comptée (+/- et clavier)
- [x] Historique des lignes scannées (10 derniers, modifiables)

### 2.3 Stockage Local
- [ ] SQLite local pour mode hors-ligne
- [ ] File d'attente de synchronisation
- [ ] Indicateur de connexion réseau

---

## 📋 Phase 3 : Export & Synchronisation (Semaine 4)

### 3.1 Export CSV
- [ ] Générer fichier CSV des lignes d'inventaire
- [ ] Partager via email/cloud (Expo Sharing)
- [ ] Format compatible avec import backend

### 3.2 Synchronisation Directe (Option)
- [ ] Endpoint API `POST /api/inventaires/{id}/lignes/bulk/`
- [ ] Envoi en batch des lignes scannées
- [ ] Gestion des conflits (produit déjà scanné)
- [ ] Confirmation de synchronisation réussie

---

## 📋 Phase 4 : Optimisations PDA (Semaine 5)

### 4.1 UI Spécifique PDA
- [ ] Gros boutons tactiles (min 48dp)
- [ ] Contraste élevé pour lisibilité
- [ ] Mode portrait uniquement
- [ ] Police grande par défaut

### 4.2 Performance & Batterie
- [ ] Optimisation requêtes réseau
- [ ] Cache intelligent des produits fréquents
- [ ] Désactivation animations non-essentielles
- [ ] Wake lock pendant scan actif

### 4.3 Gestion des Lots
- [ ] Affichage lots disponibles par produit
- [ ] Sélection du lot lors du comptage
- [ ] Indication date de péremption

---

## 🔧 Backend - Endpoints Requis

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/auth/login/` | POST | Authentification |
| `/api/inventaires/` | GET | Liste sessions actives |
| `/api/inventaires/` | POST | Créer session |
| `/api/inventaires/{id}/lignes/` | GET | Lignes d'une session |
| `/api/inventaires/{id}/lignes/` | POST | Ajouter ligne |
| `/api/inventaires/{id}/lignes/bulk/` | POST | Import batch |
| `/api/produits/by-cip/{code}/` | GET | Recherche par CIP |

---

## 📱 Structure de l'Application

```
pda-inventaire/
├── app/
│   ├── (auth)/
│   │   └── login.tsx
│   ├── (main)/
│   │   ├── index.tsx          # Liste inventaires
│   │   ├── scanner.tsx        # Écran scan
│   │   └── inventory/[id].tsx # Détail session
│   └── _layout.tsx
├── components/
│   ├── Scanner.tsx
│   ├── ProductCard.tsx
│   ├── QuantityInput.tsx
│   └── SyncIndicator.tsx
├── services/
│   ├── api.ts
│   ├── auth.ts
│   └── storage.ts
└── hooks/
    ├── useScanner.ts
    └── useOfflineSync.ts
```

---

## ⏱️ Estimation Temps

| Phase | Durée | Priorité |
|-------|-------|----------|
| Phase 1 - Fondations | 3-4 jours | 🔴 Haute |
| Phase 2 - Core | 5-7 jours | 🔴 Haute |
| Phase 3 - Export/Sync | 3-4 jours | 🟡 Moyenne |
| Phase 4 - Optimisations | 3-4 jours | 🟢 Basse |

**Total estimé** : 2-3 semaines

---

## ✅ Critères de Succès

1. **Rapidité** : < 500ms entre scan et affichage produit
2. **Fiabilité** : 0 perte de données (mode hors-ligne)
3. **Autonomie** : 4h+ d'utilisation continue
4. **Ergonomie** : Utilisable d'une seule main

---

## 📝 Notes Techniques

### Compatibilité PDA
- Android 8.0+ (API 26)
- Écran min 4" (320dp width)
- Support scanner matériel (intent broadcast)

### Sécurité
- HTTPS obligatoire
- Token expire après 8h
- Pas de stockage mot de passe en clair

---

**Dernière mise à jour** : 31 Janvier 2026
