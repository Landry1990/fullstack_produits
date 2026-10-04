# Parallélisation — Tâches longues ou complexes

> Référence détaillée — l'essentiel est dans AGENTS.md à la racine.

### ⚠️ Parallélisation — Tâches longues ou complexes

**Toute tâche longue ou complexe doit être décomposée et confiée à un ou plusieurs
sous-agents indépendants (`run_subagent`), suivis d'un agent de contrôle final.**

#### Quand déléguer

- Recherche/exploration large du codebase (plusieurs fichiers, plusieurs couches).
- Tâche multi-étapes où chaque étape est self-contained (ex: fix backend + fix frontend +
  traductions + build + deploy).
- Modifications parallèles sur des zones disjointes du code (pas de conflit de fichiers).
- Investigation nécessitant de croiser backend, frontend, serializers, modèles, routes.

#### Comment déléguer

1. **Découper** la tâche en sous-tâches indépendantes (pas de dépendance entre elles, ou
   dépendance linéaire gérée en séquence).
2. **Lancer les sous-agents en parallèle** (`is_background: true`) quand ils ne touchent
   pas les mêmes fichiers. Sinon, les lancer en séquence.
3. **Profil** : `subagent_explore` pour la recherche/lecture seule, `subagent_general`
   pour les modifications/écriture/commandes.
4. **Front-loader le contexte** : chaque sous-agent est stateless. Lui donner :
   - Les chemins de fichiers pertinents.
   - Les noms de fonctions/classes/endpoint concernés.
   - Ce qui est déjà connu et ce qu'il doit faire précisément.
   - Le format attendu de sa réponse.
5. **Agent de contrôle final** (obligatoire) : après que tous les sous-agents ont terminé,
   lancer un dernier sous-agent (ou faire soi-même) qui :
   - Vérifie la cohérence des changements (contrat backend ↔ frontend).
   - Lance le build frontend (`npm run build`).
   - Lance les tests backend pertinents si applicable.
   - Vérifie les traductions fr/en.
   - Confirme que rien n'a été cassé.
   - Rédige l'entrée `CHANGELOG.md`.

#### Quand NE PAS déléguer

- Tâche triviale (1 fichier, 1-2 lignes) → faire directement.
- Tâche nécessitant une interaction utilisateur (clarification, choix de design).
- Tâche séquentielle stricte où chaque étape dépend de la précédente et ne peut
  pas être parallélisée — faire en séquence soi-même.

#### Exemple

```
Tâche : "Corriger le rappel de vente + alléger les spinners + fixer SalesTable"

Sous-agent 1 (subagent_general, background) :
  → Fix backend endpoint by_number URL normalization

Sous-agent 2 (subagent_general, background) :
  → Alléger les spinners dans ProductSearch, ClientSection, FacturationHeader

Sous-agent 3 (subagent_explore, background) :
  → Investiguer pourquoi SalesTable ne montre pas les ventes en caisse centrale

Agent de contrôle (foreground, après 1+2+3) :
  → Build frontend, vérifier traductions, déployer, rédiger CHANGELOG
```
