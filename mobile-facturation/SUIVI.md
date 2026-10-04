# Suivi — Mobile Facturation

> Fichier de suivi des chantiers de l'app `mobile-facturation/` (terminal de
> prise de vente mobile pour la pharmacie).
>
> **Périmètre acté (2026-10-04)** : pas de mode hors ligne, pas d'encaissement
> sur le mobile — **tout part en caisse** (`POST /factures/finaliser/` avec
> `centralized_cash_register: true`, facture créée impayée, encaissée par la
> caissière).

## ✅ Déjà en place

- [x] Envoi panier → caisse centralisée via REST (`sendSaleToCaisse` dans
  `src/services/api.ts`), même contrat que la vente tablette web.
- [x] Anti-doublon : `Idempotency-Key` (header + champ body).
- [x] Login `POST /api/auth/token/` (URL serveur libre, nginx :80) — mot de
  passe seul, compte reconnu par le serveur (2026-10-04).
- [x] Recherche produit débouncée (300 ms) + recherche client.
- [x] Panier : quantités, suppression de ligne, sélection de lot (`LotModal`).
- [x] Affichage du `numero_facture` après envoi + vidage du panier.
- [x] **Point de vente assigné automatiquement au login** (2026-10-04) :
  réutilise un poste actif du vendeur, sinon active la 1re définition
  disponible (`ensurePosteVente`) ; badge en en-tête pour réessayer,
  retry unique si le poste a été fermé entre-temps.

## 🔧 À faire — par ordre de priorité

### P0 — Création de vente ultra-rapide

- [x] **Scan code-barres** (2026-10-04) : `ScanBarcodeModal` (expo-camera,
  scan continu, anti-doublon 1,5 s, vibration + feedback inline). CIP/EAN →
  `GET /produits/by-cip/<code>/` ; **datamatrix GS1** → parser porté du web
  (`utils/gs1Parser.ts`) + `GET /stock-lots/by-datamatrix/` → produit ajouté
  **avec le lot exact scanné** et son prix de lot (même flux que le web).
- [x] **Scanner matériel (douchette)** (2026-10-04) : `onSubmitEditing` du
  champ recherche → même traitement que la caméra (datamatrix ou CIP).
- [x] **Scan : mode confirmation / ajout automatique** (2026-10-04) :
  `ScanBarcodeModal` propose deux modes — confirmation (carte produit avec
  quantité avant ajout, défaut) ou ajout automatique avec mini-panier live.
  Réglage mémorisé sur l'appareil via `expo-sqlite/kv-store`
  (`useSettingsStore`).
- [x] **Fix contrat API** (2026-10-04) : les types mobile étaient décalés —
  `Product` (`name`, `cip1-4`, `selling_price`, `tva`), `Client` (`name`,
  `phone`), `AyantDroit` (`nom`, `matricule`, `societe`). Sans ce fix la
  recherche affichait des lignes vides/NaN et le scan renvoyait le mauvais
  produit (param `code_barre` inexistant → ignoré par le backend).

### P1 — Parité avec la vente tablette web

- [x] **Ayant droit** (2026-10-04) : sélecteur chips sous le client pour les
  clients `PROFESSIONNEL` + création « + Nouveau » (nom/matricule, matching
  matricule anti-doublon avant `POST /ayants-droit/`).
- [x] **Remise ligne + remise globale** (2026-10-04) : `LineEditModal` (prix +
  remise % par ligne), champ « Remise globale » dans le footer avec bascule
  %/F, commit au blur. `remise` = montant en F dans le payload.
- [x] **Prix de ligne modifiable** (2026-10-04) : prix tappable dans
  `CartItemRow` → `LineEditModal`.
- [x] **Validation Sudo** (2026-10-04) : `SudoModal` + `useSudo` (port du web),
  `POST /users/verify_password/` avec `permission` (`can_modify_price` /
  `can_do_remise`). Creds stockés dans le store et envoyés en
  `remise_validated_by_id/password` + `prix_validated_by_id/password`
  (top-level). Plafond `max_discount_rate` appliqué à la remise globale.
- [x] **Création client rapide** (2026-10-04) : « + Nouveau client » dans le
  modal → `POST /clients/` (PARTICULIER, plafond -1).

### P2 — Résilience de session et de saisie

- [x] **Session persistée** (2026-10-04) : `session.token` /
  `session.username` / `session.serverUrl` dans `expo-secure-store`
  (shim `src/utils/secureStore.ts`, localStorage sur web). Boot `App.tsx` :
  `useSettingsStore.load()` → `restoreSession()` (spinner) → `getMe()`
  (401 → logout via intercepteur réponse de `api.ts`, erreur réseau →
  session conservée + alerte) → `ensurePosteVente()` silencieux.
- [x] **Brouillon automatique** (2026-10-04) : panier persisté dans
  `expo-sqlite/kv-store` sous `draft.cart.<username>` (subscribe zustand
  dans `useCartStore`, debounce 400 ms) — clé par vendeur pour poste
  partagé. Restauré via `hydrate()` après session/login ; les creds Sudo
  ne sont JAMAIS persistés → revalidation demandée à l'envoi si remise ou
  prix modifié sans creds (`ensureSudoCreds` dans `FacturationScreen`).
  ⚠️ Ce n'est PAS du mode hors ligne : la vente exige toujours le réseau
  au moment de l'envoi.
- [ ] Option : verrouillage rapide PIN / biométrie pour session longue sur
  appareil partagé.

### P3 — Historique et finition

- [ ] **Historique local** : `HistoriqueScreen.tsx` est un placeholder,
  `expo-sqlite` installé → enregistrer chaque envoi (n° facture, heure,
  nb articles, total, client, statut).
- [ ] **Thème clair/emerald** : aligner sur `pda-inventaire`
  (`src/config/theme.ts`) et l'app web — aujourd'hui dark indigo.
- [ ] **Ménage** : supprimer `src/services/websocket.ts` et les types
  `CashierPayload`/`CashierArticle` (code mort depuis le passage en REST) ;
  vérifier les deps réellement utilisées.
- [ ] **Erreurs** : réessayer l'envoi une fois avec la même `Idempotency-Key`
  sur timeout/erreur réseau transitoire (pas une file offline, juste de la
  robustesse).

## ❌ Hors périmètre (décision actée)

- Mode hors ligne / file de synchronisation.
- Encaissement mobile (espèces, QR, paiement partiel, monnaie) — réservé à la
  caisse centralisée.
- PDF ticket côté mobile — impression à la caisse (QZ/web).
- Devis, avoirs, acomptes, ventes récurrentes, multi-devises — gérés sur le web.
- Relances, notifications impayés, exports comptables — côté web/backend
  (SMS/Telegram déjà existants).
- Multi-société, intégrations tierces (Stripe, Zapier…), conformité
  e-invoicing — hors sujet pour l'usage.

## État d'avancement

| Chantier | État | Date |
|---|---|---|
| Tri des exigences / périmètre acté | ✅ | 2026-10-04 |
| Scan code-barres + douchette + fix contrat API | ✅ | 2026-10-04 |
| Parité vente (AD, remise, prix, Sudo, création client) | ✅ | 2026-10-04 |
| Session persistée + brouillon | ✅ | 2026-10-04 |
| Historique + thème + ménage | ⬜ | — |
