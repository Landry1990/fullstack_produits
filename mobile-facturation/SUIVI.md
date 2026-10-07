# Suivi — Mobile Facturation

> Fichier de suivi des chantiers de l'app `mobile-facturation/` (terminal de
> prise de vente mobile pour la pharmacie).
>
> **Périmètre acté (2026-10-04)** : pas de mode hors ligne, pas d'encaissement
> sur le mobile — **tout part en caisse** (`POST /factures/finaliser/` avec
> `centralized_cash_register: true`, facture créée impayée, encaissée par la
> caissière).

## ✅ Déjà en place

- [x] **Entrée en stock (réception → commande web)** (2026-10-06) :
  écran `EntreeStockScreen` (carte accueil) — le mobile prépare la
  **liste**, la vraie entrée en stock reste la clôture web. Fournisseur
  **obligatoire** — menu déroulant `FournisseurPickerModal` (liste
  complète `GET /fournisseurs/` + filtre local). Saisie produit par
  produit : scan caméra/douchette ou recherche débouncée. Datamatrix
  GS1 aligné sur le web (`useDataMatrixScanner`) : lot + expiration
  du code remplissent la **ligne sans lot** existante, même lot →
  incrémente, nouveau lot → ligne préremplie (pas de lookup StockLot
  — le lot reçu n'existe pas encore).
  `EntreeStockLineModal` = fiche ligne préremplie (dernier prix
  d'achat `cost_price`, TVA, marge, prix de vente) avec champs
  **liés** identiques au web (`useCommandeProductLines`, type LOC) :
  achat/marge/TVA → `PV = round(achat × marge × (1+tva/100))`, PV →
  marge recalculée. TVA en **menu déroulant** (taux `GET /tva/` actifs).
  Quantité, UG, lot, expiration MM/AA aussi éditables.
  Brouillon persisté par vendeur (`draft.entree.<user>`) + store
  `useEntreeStockStore`. **Réceptions en attente**
  (`usePendingEntreeStore` + `PendingEntreeModal`, clé
  `pending.entree.<user>`, max 30) : icône pause = mettre de côté,
  icône horloge + badge = liste — reprendre (remplace, confirmé) ou
  fusionner (quantités + par couple produit+lot) ; l'id de commande
  déjà créée survit à la mise en attente → re-synchro sans doublon.
  Téléversement = `POST /commandes/` (type LOC,
  statut PREP) puis `POST /commande-produits/bulk_sync/` (atomique,
  mêmes règles que le web : fusion produit+lot, warnings marge) —
  **aucun changement backend**. Retry sûr : l'id de commande créée est
  conservé, un second envoi re-synchronise sur la même commande au lieu
  d'en créer une nouvelle. Traductions FR/EN (`entree.*`).
- [x] **Adaptation petit écran (PDA 7" ~605dp)** (2026-10-06) :
  `scale.ts` — ratio par bandes : ×1 téléphone (≤420dp), **jusqu'à
  ×0.8 sur petit PDA** (420-700dp ; 605dp ≈ ×0.86), croissance ×1.17→
  ×1.5 tablette (700→900dp+ ; 12" inchangé). `moderateScale` devient
  asymétrique : réduction pleine, croissance atténuée ×0.5. Accueil et
  login wrappés en `ScrollView` (centré si tout tient, scrollable
  sinon, scrollbar persistante Android) ; login sous
  `KeyboardAvoidingView`.
- [x] **Purge des signalements traités** (2026-10-06) : bouton « Vider »
  dans l'en-tête « Derniers signalements » (visible si ≥1 signalement
  traité, confirmation) → `DELETE /signalements-besoins/vider/` supprime
  les `INTÉGRÉ`/`IGNORÉ`, conserve les `NOUVEAU`. i18n fr/en.
- [x] **Résultat de recherche produit unifié** (2026-10-06) : vente,
  entrée en stock, ajustement et signalement utilisent désormais le même
  composant `ProductRow` (celui de la vente) — nom pondéré selon stock
  (extra-gras en stock / atténué à 0 / rouge négatif), CIP, stock coloré
  et prix sur une ligne. Anciennes lignes simplifiées supprimées.
- [x] **Signalement « produit manquant »** (2026-10-06) : écran
  `SignalementScreen` (carte accueil) — scan/recherche produit, quantité
  et note optionnelles, liste des derniers signalements avec badge de
  statut (À traiter / Intégré / Ignoré). Backend : nouveau modèle
  `SignalementBesoin` + `POST/GET /signalements-besoins/` ; côté web,
  les signalements apparaissent dans les suggestions de commande
  (badge « DEMANDÉ TERRAIN » + lignes ajoutées si non suggérées) et
  passent `INTEGRE` quand le produit part en commande.
- [x] **Écran d'accueil avec menu** (2026-10-06) : `HomeScreen` = point
  d'entrée après login — bascule FR/EN, déconnexion, cartes Vente /
  Ajustement de stock / Tableau de bord. L'en-tête de `FacturationScreen`
  est allégé (retirés : langue, ajustement, dashboard, déconnexion — tous
  déplacés sur l'accueil) ; il ne garde que les actions de vente :
  en attente, historique, PIN, panier, annuler, retour accueil.
- [x] **Ajustement de stock par lot** (2026-10-06) : écran `AjustementScreen`
  (bouton 📦 en-tête) — recherche/scan produit, sélection du lot
  **obligatoire** pour les produits `use_lot_management` (le stock global
  est reconstitué depuis le delta du lot, jamais corrigé globalement) ou
  création d'un nouveau lot (n° + expiration MM/AA), motif standards +
  personnalisés (`configuration-options?type=STOCK_ADJ`), détail libre.
  `POST /produits/{id}/adjust_stock/` avec re-lecture du stock ET du lot
  juste avant envoi (quantités cibles, pas deltas), `Idempotency-Key`,
  fallback Sudo `can_adjust_stock` sur 403.
- [x] **Dashboard poche** (2026-10-06) : écran `DashboardScreen` (bouton
  📊 en-tête) consommant `GET /dashboard/stats/` — CA du jour + variation
  vs veille, nb ventes, top 5 produits, stats perso (ventes, panier
  moyen). Rôles VENDEUR/CAISSIER : stats personnelles uniquement (limite
  backend, conservée volontairement).
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
- [x] **Refonte FacturationScreen** (2026-10-05) : découpage sans
  changement de comportement — `ClientModal` (recherche + création
  client autonomes, reset à la fermeture), `AyantDroitSection` (chips +
  form contrôlé — état nom/matricule gardé dans l'écran pour le flux
  d'envoi), `hooks/useProductSearch` (debounce, ajout + lots FEFO,
  `resolveBarcode`/`addScanResult`, douchette), `hooks/useSendSale`
  (revalidation sudo, forçage stock, résolution AD, poste, retries
  400/403, historique, clear), `FacturationScreen.styles.ts` +
  `utils/drfError.ts` (partagé). 1366 → 737 lignes ; `tsc` propre.
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
- [x] **Verrouillage PIN** (2026-10-05) — PIN seul, sans biométrie
  (décision du demandeur) : code 4-6 chiffres **par vendeur** dans
  SecureStore (`lock.pin.<username>` — sa présence = PIN activé) ; délai
  par appareil dans kv-store `lock.delaySec` (0/60/300 s, défaut 60).
  `stores/useLockStore` + `components/LockScreen` (overlay dans `App.tsx`)
  + `components/PinLockModal` (réglage). Déclencheurs : session restaurée
  au boot (verrou immédiat), retour au premier plan après délai
  (`AppState`, horodatage au passage background/inactive), cadenas de
  l'en-tête Facturation (tap = verrouille si PIN défini, sinon ouvre le
  réglage ; appui long = réglage). « Se déconnecter » depuis l'écran
  verrouillé efface le PIN — porte de sortie « code oublié », le login
  suivant exige le mot de passe. Le PIN survit au logout normal (rattaché
  au compte, pas à la session).

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
- [x] **Statut d'encaissement dans l'historique** (2026-10-05) :
  `HistoriqueScreen` remonte le statut backend de chaque vente —
  `getFactureStatuses` (`api.ts`) = `GET /factures/?include_pending=true
  &created_by=<id>&page_size=100`, une requête pour tout l'historique,
  match local par `numero_facture`. `include_pending` est indispensable :
  la liste masque par défaut les VALIDEE sans paiement (ventes en caisse)
  et le paramètre court-circuite le cache liste 60 s → statut temps réel.
  Badges : « En caisse » (VAL, amber), « Encaissée » (PAY, vert),
  « Annulée » (ANN, rouge), « Brouillon » ; fallback « Envoyée » si non
  remonté (hors ligne, entrée ancienne). Refresh au montage + pull-to-
  refresh. `useAuthStore.userId` ajouté (rempli par `getMe` au login et
  au boot) pour le filtre `created_by`.
- [x] **Remise globale dans le détail historique** (2026-10-05) :
  `HistoriqueItem.remise_globale` (montant F, optionnel — absent des
  anciennes entrées) stockée à l'envoi (`useSendSale`) et affichée en
  pied du détail déplié (« Remise globale −X F »). Rappel : l'historique
  est **par vendeur** (clé `historique.<username>`), pas par appareil.
- [x] **Distinction stock renforcée dans les résultats** (2026-10-05) :
  le gras seul ('700') passait inaperçu sur tablette → double signal
  poids + couleur : en stock = nom '800' + « Stock: X » vert ; nul = nom
  atténué `textMuted` ; négatif = rouge (inchangé). `ProductRow`.
- [x] **Résultats : infos regroupées à gauche** (2026-10-05) : la
  colonne droite (prix + stock) obligeait à balayer l'écran du regard —
  CIP, « Stock: X » et prix sont désormais sur une seule ligne sous le
  nom. `ProductRow`.
- [x] **Badge lot lisible** (2026-10-05) : « AUTO » était cryptique →
  **« SANS LOT »** quand aucun lot n'est prélevable, **« FEFO · … »**
  (au lieu de « AUTO · … ») quand le backend prélèvera le lot expirant
  le plus tôt. `CartItemRow`.
- [x] **i18n fr/en complet** (2026-10-05) : `i18next` + `react-i18next`
  + `expo-localization`. `src/i18n/{index,fr,en}.ts` — langue = locale
  de l'appareil (`en` → anglais, sinon français), fallback fr. Toutes
  les chaînes visibles migrées vers `t()` : écrans (Login, Facturation,
  Historique), 12 composants/modals, hooks (`useSendSale`,
  `useProductSearch` via `i18n.t` hors JSX) et `App.tsx`. Convention :
  toute nouvelle chaîne visible → clé dans `fr.ts` **et** `en.ts`.
  **Bascule manuelle** : chip « FR/EN » dans l'en-tête de vente +
  segmenté sur l'écran de connexion ; choix persisté par appareil
  (`settings.language` kv-store, lu synchrone à l'init — priorité :
  choix stocké > locale appareil > fr).

### P5 — Facturation clients professionnels (parité web)

- [x] **Détail client fetché à la sélection** (2026-10-06) : la liste
  `/clients/?search=` (ClientListSerializer) ne renvoie ni
  `ayants_droit` ni `message_alerte` → les chips AD n'apparaissaient
  jamais et le matching matricule de `useSendSale` ne trouvait rien
  (doublons AD possibles). `getClient(id)` (GET `/clients/<id>/`) une
  fois à la sélection (`applySelectedClient`) ; fusion liste+détail —
  `current_debt` n'existe que sur la liste, `ayants_droit`/
  `message_alerte`/`solde_depot`/`pending_discount` que sur le détail.
  Optimiste : `ayants_droit_count` (liste) décide l'affichage du
  formulaire AD sans attendre le détail.
- [x] **Majoration pro** (`majoration_pro_pourcentage`) :
  `prix_unitaire = selling_price × (1+p/100)` arrondi F — à l'ajout
  (`addProduct` lit le client courant, scan datamatrix garde le prix
  du lot comme le web) et recalcul de tout le panier depuis le
  catalogue au changement de client (`setClient` = `applyMarkupToCart`
  web ; écrase les prix manuels, choix acté). ⚠️ Prix majoré ≠
  catalogue → `can_modify_price` exigé par le backend à l'envoi —
  couvert par `ensureSudoCreds` existant (prix ≠ selling_price).
- [x] **Remise automatique** (`remise_automatique`) : remise globale
  en % appliquée à la sélection, sans Sudo (comme le web) —
  `can_do_remise` reste exigé à l'envoi via `ensureSudoCreds`.
- [x] **Tiers payant** (`taux_couverture`) : `tiersPayantSplit` (même
  formule que `Facture.calculate_totals` : part patient = TTC ×
  (100−taux)/100 arrondi 0,01) — ligne « Part Assurance X F · Part
  Patient Y F » dans le footer (libellés repris du web) ; `paiements`
  envoyés comme le web
  (`buildPaymentsList` : `especes` part patient + `en_compte` part
  mutuelle) → `paiement_immediat` couvre le TTC. ⚠️ Corrige un bug :
  `paiements: []` comptait tout le TTC comme nouvelle dette dans le
  contrôle plafond backend → vente pro bloquée à tort. La vraie
  créance `en_compte` reste créée par `_handle_professional_debt`.
- [x] **Plafond crédit** : blocage avant envoi si `current_debt +
  part mutuelle > plafond` (seule la part mutuelle devient dette —
  la part patient sera encaissée à la caisse ; `plafond = -1` =
  illimité) + alertes à la sélection (atteint / >80 %).
- [x] **Alertes de sélection regroupées** : `message_alerte` + dépôt
  disponible + remise fidélité en attente + plafond → une seule
  `Alert` (remplace les toasts du web). `blocking_alerte` n'est pas
  sérialisé par l'API → informatif seulement, comme le web.
- [x] **Badge « PRO »** : carte client de l'écran de vente + résultats
  du `ClientModal`.

- [x] **Choix de la caisse destinataire (multi-caisses)** (2026-10-06) :
  à l'envoi, si ≥2 postes de caisse sont ouverts
  (`GET /postes-ventes/actives/` filtré `caisse != null` →
  `getCaissesOuvertes`), `CaissePickerModal` laisse le vendeur choisir
  la caisse (nom + caissière) ; le choix est envoyé via
  `poste_caisse_id` et gardé en ref pour les ré-envois (retry poste,
  sudo stock) du même envoi. 1 seule caisse → direct, 0 → alerte claire
  `send.no_caisse_open`. **Backend** : `SaleFinalizer._resolve_poste_caisse`
  — `poste_caisse_id` explicite validé (poste ouvert rattaché), sinon
  caisse du `poste_vente` envoyé (le web envoie le poste de la
  caissière), sinon dernière caisse ouverte (historique). Tests :
  `test_sale_finalizer.py` (choix honoré + caisse fermée refusée).

### iOS — compatibilité préparée (2026-10-06)

Aucune dépendance Android-only, gardes `Platform.OS` = `web` seulement,
tous les types de codes-barres supportés par AVFoundation. Ajoutés :
`ios.bundleIdentifier` (`com.zenithpharma.mobilefacturation`) et
`NSAppTransportSecurity` (`NSAllowsLocalNetworking` +
`NSAllowsArbitraryLoads` — l'app parle en HTTP clair au backend local,
bloqué par l'ATS iOS par défaut ; équivalent du
`usesCleartextTraffic` Android) + `eas.json` minimal (profils
`preview`/`simulator`/`production`). Testable dès maintenant via
**Expo Go** sur iPad ; build réel = `eas build --platform ios` (compte
développeur Apple requis pour appareil/TestFlight).

### P4 — Retour cahier QA client (propositions, à valider)

Exigences du cahier client **compatibles** avec le périmètre acté :

- [x] **Verrouillage PIN** (2026-10-05) : implémenté sans biométrie —
  voir P2.
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

## 💡 En réflexion — idées notées, pas encore actées

### Fusion `mobile-facturation` + `pda-inventaire` (2026-10-05, en attente de tests terrain)

Idée : un seul APK « terminal de terrain » faisant vente **et** inventaire,
au lieu de deux apps à installer/configurer. À évaluer après retour
d'expérience réel sur `mobile-facturation`.

**Pour** : 1 seul APK/config serveur/login ; un appareil fait les deux
métiers ; les deux apps partagent déjà backend `/api/`, login par mot de
passe, `expo-camera` (scan), `expo-secure-store`, `safe-area-context`,
même Expo 57, même palette de thème.

**Divergences à résoudre** : `pda-inventaire` = react-query + AsyncStorage +
FileSystem + NetInfo + sessions d'inventaire **offline + sync** ;
`mobile-facturation` = zustand + kv-store (sqlite) + panier/caisse +
postes + sudo. Deux `LoginScreen` différents, deux services `api.ts`.

**Architecture proposée** (intégrer l'inventaire, plus petit ~2 000 lignes,
dans cette app) :

```
src/
  modules/
    vente/        ← écrans + stores actuels (inchangés)
    inventaire/   ← HomeScreen, ScannerScreen + composants/services pda
  shared/         ← theme, scale.ts, api.ts fusionné, auth, ScanModal
App.tsx           ← après login : menu « Vente » | « Inventaire »
```

**Questions à trancher avant tout démarrage** :
- Les deux métiers accessibles à tout utilisateur, ou filtrés par
  permission/profil backend (ex : compte « inventaire seul ») ?
- L'inventaire offline/sync (NetInfo, file d'attente) doit-il rester
  fonctionnel hors réseau ? (Sa logique est plus lourde que le brouillon
  kv-store de la vente.)
- Un appareil peut-il basculer de module sans re-login ? Persistance du
  module courant ?
- Un seul `package` Expo → l'icône/nom de l'app unifiée ?

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
| Suivi encaissement dans l'historique (badges statut caisse) | ✅ | 2026-10-05 |
| Verrouillage PIN (sans biométrie) | ✅ | 2026-10-05 |
| Facturation clients pro (AD fix, majoration, remise auto, tiers payant, plafond) | ✅ | 2026-10-06 |
| Choix de la caisse destinataire en multi-caisses (picker + `poste_caisse_id`) | ✅ | 2026-10-06 |
