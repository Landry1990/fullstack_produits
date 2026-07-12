---
description: Checklist react-doctor à vérifier AVANT de modifier ou créer du code frontend React — utiliser /pre-code-checklist
---

# Checklist Pre-Code — React Doctor

À appliquer **avant toute modification ou création de fichier frontend**.
Ces règles évitent de casser le score react-doctor et d'introduire de nouveaux problèmes ESLint/TypeScript.

---

## 1. Exports non-composants (React Fast Refresh)

- [ ] Les fichiers `.tsx` n'exportent **que des composants React** (fonctions commençant par une majuscule).
- [ ] Les constantes, types, interfaces, helpers → les déplacer dans un fichier `.ts` séparé.
- [ ] Les contextes et hooks → fichiers dédiés (`useXxx.ts`, `XxxContext.ts`).
- [ ] Jamais `export const maVariable = ...` dans un fichier `.tsx` avec des composants.

## 2. Dialogs / Modals sans nom accessible (Accessibilité)

- [ ] Tout `<dialog>`, `<Dialog>`, `<Modal>` doit avoir un `aria-labelledby` ou `aria-label`.
- [ ] L'élément référencé par `aria-labelledby` doit exister dans le DOM avec le même `id`.
- [ ] Vérifier les composants Radix UI (`@radix-ui/react-dialog`) : ajouter `<Dialog.Title>` ou `aria-label` sur `<Dialog.Content>`.

## 3. State updaters avec effets de bord

- [ ] Jamais d'appel API, `navigate()`, `toast()` ou mutation directe dans un `setState(prev => ...)`.
- [ ] Ces effets de bord vont dans `useEffect` ou dans les handlers d'événements.
- [ ] Vérifier que les `useEffect` ont des dépendances correctes (`exhaustive-deps`).

## 4. Refs mutées pendant le rendu

- [ ] `ref.current = valeur` ne doit **jamais** apparaître au top-level du corps d'un composant.
- [ ] Les mutations de ref se font uniquement dans : `useEffect`, `useLayoutEffect`, handlers d'événements, callbacks.

## 5. State only used in handlers → utiliser useRef

- [ ] Si un `useState` est **seulement lu/écrit dans des handlers** (jamais rendu dans le JSX), remplacer par `useRef`.
- [ ] Vérifier : la valeur est-elle affichée ? Non → `useRef`. Oui → `useState`.

## 6. ESLint — règles critiques

- [ ] **No unused vars/imports** : tout import ou variable déclaré doit être utilisé.
- [ ] **No explicit any** : remplacer `any` par un type précis ou `unknown`.
- [ ] **Exhaustive deps** : vérifier les dépendances de `useCallback`, `useMemo`, `useEffect`.
- [ ] **Prefer-const** : utiliser `const` si la variable n'est jamais réassignée.

## 7. TypeScript — vérifications de types

- [ ] Ne pas utiliser `as any` — utiliser `as unknown as TargetType` si nécessaire.
- [ ] Les interfaces/types des props doivent être explicites (pas de `{}` ou `object`).
- [ ] Vérifier la compatibilité des types avant de passer des props à un composant.

---

## Checklist rapide avant chaque fichier modifié

1. Ce fichier `.tsx` exporte-t-il autre chose qu'un composant ? → Séparer.
2. Y a-t-il un dialog/modal ? → Vérifier `aria-labelledby`.
3. Y a-t-il un `useState` qui n'est jamais rendu ? → Remplacer par `useRef`.
4. Y a-t-il des `any` ? → Typer explicitement.
5. Y a-t-il des imports/variables inutilisés ? → Supprimer.
6. Les `useEffect` ont-ils toutes leurs dépendances ? → Vérifier.
