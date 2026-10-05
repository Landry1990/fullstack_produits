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
- [x] **Poste épinglé à l'appareil + jamais de caisse centrale**
  (2026-10-04) : `ensurePosteVente` ne réutilise que les postes
  `mode_pos` (fini le fallback sur le poste caisse du compte) ; le poste
  choisi est mémorisé dans kv-store `pos.posteVenteId` (par appareil)
  et réactivé directement à chaque démarrage ; s'il est indisponible →
  `PostePickerModal` (choix mémorisé). Côté backend : `disponibles/`
  inclut les postes fermés du user, `activer/` refuse un poste lié à une
  caisse physique, `finaliser` refuse en centralisé un poste-caisse
  d'un autre vendeur.
- [x] **Convention de nommage Mobile/Comptoir** (2026-10-04) : l'app
  ne voit/reprend que les postes dont le nom commence par « Mobile »
  (`isPosteMobile`, insensible casse/espaces) ; la vente web que les
  « Comptoir » (`isPosteComptoir`). Le sélecteur mobile n'affiche que
  les postes Mobile ; les alertes « aucun poste » précisent la
  convention pour l'admin.

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
- [x] **Client « comptoir » auto-sélectionné** (2026-10-04) : comme le web
  (`useFacturationClients`), `services/clientDivers.ts` résout
  « CLIENTS DIVERS »/« CLIENT DIVERS » une fois par session (cache
  `useAuthStore`, reset au logout) et le sélectionne après hydratation du
  brouillon et après chaque envoi — fini les ventes « Client de passage »
  non rattachées (stats/fidélité par client).
- [x] **Forçage de stock supervisé** (2026-10-04) : pré-check avant envoi
  (`quantite > product.stock` connu) → `SudoModal`
  `can_sell_negative_stock`, creds dans le bloc `sudo` du payload
  (`stockSudoCreds`, mémoire seule — jamais persistés, reset
  clear/hydrate) ; retry sur 403 backend si le stock local était périmé.
  Rappel : l'autorité reste `_compute_required_permissions` côté backend
  (remise, prix, stock négatif, montant nul…) + `AuditLog` SUDO_VAL à
  chaque validation superviseur.
- [x] **Tailles proportionnelles à l'écran** (2026-10-04) : nouvel
  utilitaire `src/utils/scale.ts` — `scale` (proportionnel plein) et
  `moderateScale`/`ms` (atténué ×0.5, utilisé partout). Référence : petit
  côté ≈ 375dp, borné ×1 (jamais de rétrécissement — retour test : panier
  « ultra petit » sur petit écran) à ×1.5 (tablette). Appliqué aux 11
  fichiers avec `StyleSheet.create` : styles + tailles d'icônes inline.
  ⚠️ Ratio calculé au chargement — rotation non reprise (styles statiques).
- [x] **Clavier & recherche sur petit écran** (2026-10-04) : pendant la
  recherche (≥ 2 car.), les sections basses (client, ayant droit, remise,
  total/envoi) sont **masquées** — les résultats occupent toute la place
  au-dessus du clavier ; `Keyboard.dismiss()` à l'ajout d'un produit
  (réaffiche le panier) ; `keyboardShouldPersistTaps="handled"` sur les
  deux FlatList.
- [x] **Densité compacte + confirmation « Annuler »** (2026-10-04) :
  sous ~720dp de hauteur (`compactVert`), les sections fixes sont
  resserrées (styles `*Compact`) → la liste du panier gagne ~60dp ;
  « Annuler » (vider le panier) demande désormais une confirmation
  `Alert` destructive et est grisé quand le panier est vide.
- [x] **Résultats en overlay au-dessus du clavier** (2026-10-04) : les
  résultats de recherche ne remplacent plus le contenu de `mainBox` —
  ils s'affichent dans un panneau `position:absolute` ancré à la position
  mesurée de `mainBox` (`onLayout`), avec `bottom` = hauteur clavier
  mesurée (`Keyboard` listeners), corrigée si le système redimensionne
  déjà la fenêtre → visible dans tous les modes (pan/resize/nothing).
  `app.json` : `softwareKeyboardLayoutMode: "pan"` (effet au prochain
  build natif). `ProductRow` : nom gras si stock > 0, normal si 0,
  rouge si < 0.
- [x] **Détail produits dans l'historique** (2026-10-04) :
  `HistoriqueItem.lignes` (name/quantite/prix/remise/total par ligne)
  stocké à l'envoi en caisse ; tap sur une entrée de
  `HistoriqueScreen` déplie le détail (chevron). Les anciennes entrées
  sans `lignes` affichent « Détail non enregistré ».
- [x] **Aperçu FEFO après ajout manuel** (2026-10-04) : le serializer
  liste (`GET /produits/?search=`) ne renvoie pas `stock_lots` → le badge
  lot affichait « AUTO » seul pour les produits ajoutés par recherche
  (le scan, via `by-cip`/detail, les avait). Les lots sont désormais
  chargés à la demande (`getLots`, même endpoint que `LotModal`) et
  attachés à la ligne via `setProductLots` → lot + expiration visibles
  comme après un scan.
- [x] **Disposition « Vente tablette »** (2026-10-04) : `FacturationScreen`
  passe du split recherche|panier à la colonne verticale de l'ancienne
  page web supprimée — en-tête titre + « {poste} • N article(s) »
  (poste touchable = retry `ensurePosteVente`), recherche pleine largeur,
  grande zone à bordure pointillée (résultats ↔ panier, état vide
  « Ajoutez des produits pour commencer »), carte client « Modifier »,
  remise globale, footer « TOTAL » + « Envoyer en caisse » (désactivé
  panier vide). Aucune fonction retirée : attente/historique/mise en
  attente/déconnexion en icônes d'en-tête, « Annuler » = vider panier,
  déselection client via « Client de passage » du modal.

### Backend — Fix routage caisse (2026-10-04)

- [x] Les ventes envoyées depuis un poste POS (mobile ou web) étaient créées
  avec `poste_caisse=NULL` → notif WS ignorée par la caisse sélectionnée
  (affichage retardé jusqu'au polling 30 s) et **paiements exclus des
  totaux/clôture par caisse**. `sale_finalizer.py` rattache désormais toute
  vente `centralized` à `caisse_ouverte.caisse_id`. Tests backend ajoutés
  (`test_sale_finalizer`, 21/21 + régression 32/32). Les anciennes factures
  `poste_caisse=NULL` restent à corriger en prod si le client en demande
  l'historique.

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

- [x] **Historique local** (2026-10-04) : `services/historique.ts`
  (kv-store `historique.<username>`, cap 200) enregistre chaque envoi
  réussi (n° facture, heure, nb articles, total, client) ;
  `HistoriqueScreen` liste les ventes (pull-to-refresh), entrée via
  l'icône horloge en en-tête de la facturation.
- [x] **Thème clair/emerald** (2026-10-04) : `src/config/theme.ts`
  (palette identique à `pda-inventaire`) appliqué à tous les écrans,
  composants et `app.json` (`userInterfaceStyle: light`, splash/icône).
- [x] **Ménage** (2026-10-04) : `src/services/websocket.ts` et les types
  `CashierPayload`/`CashierArticle` supprimés ; deps inutilisées retirées
  (`@react-native-community/netinfo`, `expo-device`, `uuid`,
  `@types/uuid`).
- [x] **Erreurs** (2026-10-04) : `sendSaleToCaisse` réessaie **une fois**
  avec la même `Idempotency-Key` sur timeout/erreur réseau (pas de
  réponse HTTP) — le backend dédoublonne.
- [x] **Badge lot = aperçu FEFO** (2026-10-04) : `CartItemRow` affiche le
  lot réel — lot choisi (`lot · exp MM/AA`) ou, sans choix, l'aperçu FEFO
  calculé sur `product.stock_lots` (`AUTO · LOT-A · 12/26` ou
  `AUTO · LOT-A +2`), porté du web (`utils/fefo.ts`). `stock_lots` est
  déjà renvoyé par le serializer produit (5 premiers lots non vides).
- [x] **Safe area / edge-to-edge** (2026-10-04) : `edgeToEdgeEnabled`
  Android sans gestion d'insets → l'en-tête passait sous la barre de
  statut. `SafeAreaProvider` dans `index.ts` + `<StatusBar style="dark" />`,
  `useSafeAreaInsets` appliqué aux écrans (Facturation, Historique,
  Login) et aux modals (Scan, Sudo, Lot, LineEdit, PendingSales) —
  pattern repris de `pda-inventaire`.
- [x] **Mise en attente** (2026-10-04) : comme le web (`ventesEnAttente`
  localStorage), 100 % locale — `stores/usePendingStore.ts` (kv-store
  `pending.<username>`, cap 50), bouton pause dans le footer, icône
  horloge + badge en en-tête → `PendingSalesModal` (reprendre /
  fusionner / supprimer). Reprendre = `cart.hydrate()` (creds Sudo
  jamais persistés → revalidation à l'envoi) ; fusionner = quantités
  cumulées par produit, client/remise du panier actuel conservés.

### P4 — Retour cahier QA client (propositions, à valider)

Exigences du cahier client **compatibles** avec le périmètre acté :

- [ ] **Verrouillage PIN / biométrie** : promouvoir l'option P2
  (`expo-local-authentication`, délai configurable) — session longue sur
  appareil partagé.
- [ ] **Bannière connectivité** : `@react-native-community/netinfo` (à
  réinstaller — retirée au ménage P3) → bandeau « Hors ligne » + indicateur
  « dernier envoi hh:mm » dans l'en-tête ou l'historique.
- [ ] **`maxFontSizeMultiplier`** sur les Text critiques (prix, totaux,
  boutons) pour résister au réglage « police maximum » du QA.
- [ ] **Test arrondis cumulés** : remise ligne % + remise globale F —
  vérifier que `totalTtc` mobile == calcul backend à l'unité F près.

Exigences du cahier en **conflit avec le périmètre acté** (à arbitrer avec
le client, pas à implémenter sans décision) :

- Mode offline complet + file de synchronisation (contradit « tout part en
  caisse »).
- Aperçu PDF, partage WhatsApp/Email, impression Bluetooth ticket (réservés
  à la caisse).
- Encaissement mobile et états « Payée » côté mobile.
- Fuzzy search (tolérance aux fautes) : chantier backend si demandé.

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
| Client divers auto-sélectionné + forçage stock supervisé | ✅ | 2026-10-04 |
| Safe area edge-to-edge (en-tête sous barre de statut) | ✅ | 2026-10-04 |
| Poste de vente épinglé par appareil (+ gardes backend) | ✅ | 2026-10-04 |
| Convention nommage : Mobile ↔ app, Comptoir ↔ web | ✅ | 2026-10-04 |
| Session persistée + brouillon | ✅ | 2026-10-04 |
| Historique + thème + ménage | ✅ | 2026-10-04 |
