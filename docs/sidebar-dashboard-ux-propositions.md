# Propositions d'amélioration UI/UX — Sidebar & Dashboard

## 1. Objectif
Alléger la charge cognitive au niveau de la navigation (Sidebar) et du tableau de bord, en améliorant la lisibilité, la cohérence visuelle et l'accès rapide aux actions les plus fréquentes.

---

## 2. Frictions principales identifiées

### Sidebar
- **Vue mobile** : le drawer fait 100 % de la largeur (`w-screen`), ce qui masque entièrement le contenu et donne une impression de "changement de page" au lieu d'un menu.
- **Catégories non traduites visuellement** : les groupes (`accueil`, `ventes`, `catalogue`, etc.) sont marqués par des petits labels `text-slate-500` peu contrastés.
- **Icônes en SVG inline** : la plupart des icônes sont codées en dur (`<svg>...</svg>`), ce qui alourdit le fichier, rend difficile la maintenance et empêche un style uniforme (stroke, taille).
- **Absence de recherche** : navigation par 40+ items sans champ de recherche rapide.
- **Aucun badging d'état** : aucun indicateur visuel de route active globale (bordure, pastille) et le `reapproStats` n'est affiché que sur un seul item (`inventaire_reappro`).
- **Footer compact** : `Zenith OS` + version alignés sur une ligne très dense, peu visible.

### Dashboard
- **Header dense** : titre + 4 boutons + 3 onglets empilés, avec des actions secondaires (Telegram, refresh) au même niveau que l'action principale (Nouvelle facture).
- **Onglets à icônes seulement en mobile** : les labels restent cachés sur mobile au profit de l'icône, ce qui manque de clarté.
- **Cartes statiques** : absence de liens cliquables sur les métriques (CA, stock, dettes), ce qui empêche l'accès rapide au détail.
- **Feedback de chargement binaire** : page entière masquée par un loader pendant `loading` ; pas de skeleton / lazy section.
- **Trop de toasts d'alerte** : `echeances` et `promisDisponibles` affichent des toasts à chaque render / changement d'onglet.
- **Couleurs restreintes** : fond uniforme `slate-50`, peu de hiérarchie entre widgets. Le mode nuit/dark est à reprendre (TODO existant).

---

## 3. Propositions d'amélioration

### P1 — Quick wins Sidebar
1. **Icônes Lucide** : remplacer les SVG inline par des icônes `lucide-react` via un mapping. Cohérence, ajustement de taille et mode sombre simplifié.
2. **Drawer mobile plus étroit** : limiter la largeur mobile (`w-[280px]`) pour conserver un aperçu du contenu derrière.
3. **Séparateurs de catégories plus nets** : augmenter le contraste des titres de groupe (`text-slate-400`) et ajouter un `border-b` subtil.
4. **Navlink actif plus visible** : utiliser un `bg-emerald-600` + `text-white` pour l'item actif, et une bordure verticale `border-l-4`.
5. **Footer aéré** : espacer logo/version et ajouter `Licence X jours` si proche de l'expiration.

### P2 — Navigation intelligente Sidebar
1. **Champ de recherche local** en haut de sidebar pour filtrer les menus/sous-menus (debounced).
2. **Favoris / Raccourcis** : permettre d'épingler 3-5 items fréquents en haut du menu.
3. **Badges d'état système** : afficher en rouge/ambre le nombre de réappros, échéances en retard, stocks bas sur l'item parent correspondant.
4. **Réduire l'animation** du collapse (300 ms → 150 ms) ou la rendre plus fluide (`ease-out`).

### P3 — Quick wins Dashboard
1. **Hiérarchiser les actions d'en-tête** : regrouper les actions Telegram et refresh dans un menu `…`, laisser `+ Nouvelle facture` visible.
2. **Cliquer sur les KPIs** : rendre chaque carte stat (CA du jour, stock bas, dettes fournisseurs, échéances) cliquable vers l'écran associé.
3. **Skeleton loading** : remplacer le full-screen loader par des skeletons sur les zones de contenu (graphiques, listes, stats).
4. **Réduire les toasts** : ne plus afficher `echeances`/`promis` en toast automatique, les intégrer comme badges/pastilles dans les widgets.

### P4 — Dashboard par rôle
1. **Vue vendeur simplifiée** : le `DashboardVendeur` existe déjà, mais peut gagner en espacement et en CTA `Ouvrir la caisse` direct.
2. **Cartes d'alerte condensées** : regrouper `ExpirationAlertsWidget`, `Stock bas`, `Promis disponibles` dans une seule colonne "Alertes du jour".
3. **Onglets plus explicites en mobile** : afficher les 3 lettres/titres courts (`Perf.`, `Stock`, `Fin.`) au lieu d'icônes seules.

### P5 — Dark mode (chantier plus large)
- Vérifier et corriger les contrastes dans `Sidebar` et `Dashboard` pour le mode nuit (`isMidnightTheme`).
- Utiliser des variables CSS ou `dark:` Tailwind pour les cartes, bordures et textes.
- Tester en particulier les fonds `slate-900` / `slate-50` et les textes `white/40`.

---

## 4. Fichiers concernés
- `frontend/frontend/src/components/Sidebar.tsx`
- `frontend/frontend/src/components/DashboardShadcn.tsx`
- `frontend/frontend/src/components/Layout.tsx`
- `frontend/frontend/src/components/UserHeader.tsx`
- `public/locales/fr/sidebar.json` & `public/locales/en/sidebar.json`
- `public/locales/fr/dashboard.json` & `public/locales/en/dashboard.json`

---

## 5. Priorisation recommandée
1. **P1** (Sidebar quick wins) — gains visuels rapides, faible risque.
2. **P3** (Dashboard quick wins) — améliore la hiérarchie et les feedbacks.
3. **P2** (Navigation intelligente) — impact sur la vitesse d'accès quotidien.
4. **P4** (Dashboard par rôle) — affiner l'expérience vendeur.
5. **P5** (Dark mode) — chantier transverse à mener après stabilisation du design.
