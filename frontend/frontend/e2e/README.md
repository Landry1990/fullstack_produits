# Tests E2E — Zenith Pharma (Playwright)

## Prérequis

1. **Environnement Docker démarré** :
   ```bash
   docker compose up -d
   ```

2. **Installer les navigateurs Playwright** (1ère fois uniquement) :
   ```bash
   cd frontend/frontend
   npx playwright install chromium
   ```

3. **Créer un utilisateur de test** (si nécessaire) :
   ```bash
   docker exec fullstack_produits-backend-1 python manage.py shell -c "
   from django.contrib.auth.models import User
   if not User.objects.filter(username='admin').exists():
       User.objects.create_superuser('admin', 'admin@zenith.pharma', 'admin')
       print('Admin créé')
   else:
       print('Admin existe déjà')
   "
   ```

## Lancer les tests

```bash
cd frontend/frontend

# Tous les tests
npm run test:e2e

# Avec fenêtre visible (headed)
npm run test:e2e -- --headed

# Un fichier spécifique
npx playwright test e2e/auth.spec.ts

# Un test spécifique
npx playwright test -g "login avec credentials valides"

# Voir le rapport HTML
npx playwright show-report
```

## Configuration

- **URL de base** : `http://localhost:8080` (modifiable via `E2E_BASE_URL`)
- **Utilisateur** : `admin` (modifiable via `E2E_USERNAME`)
- **Mot de passe** : `admin` (modifiable via `E2E_PASSWORD`)

```bash
# Exemple avec variables d'environnement
E2E_USERNAME=pharmacien E2E_PASSWORD=secret npm run test:e2e
```

## Suites de tests

| Fichier | Couverture |
|---------|------------|
| `auth.spec.ts` | Login, mauvais mot de passe, déconnexion |
| `vente.spec.ts` | Page facturation, recherche produit, ajout panier |
| `caisse.spec.ts` | Page caisse, factures en attente, session recap |
| `cloture.spec.ts` | Historique clôtures, bouton fermer session |
| `navigation.spec.ts` | Toutes les pages principales se chargent sans erreur |
| `responsive.spec.ts` | Tests de responsivité sur mobile, tablette, desktop |

## Responsivité

La config Playwright définit 3 viewports :
- `mobile` : iPhone 12 Pro (390x844)
- `tablet` : iPad Mini (768x1024)
- `chromium` : Desktop Chrome (1280x720)

Pour lancer uniquement les tests responsivité :

```bash
npx playwright test e2e/responsive.spec.ts
```

Pour un viewport spécifique :

```bash
npx playwright test e2e/responsive.spec.ts --project=mobile
npx playwright test e2e/responsive.spec.ts --project=tablet
```

## Tests unitaires responsivité

Le hook `useBreakpoint` (src/hooks/useBreakpoint.ts) expose `isMobile`, `isTablet`, `isDesktop` et réagit au viewport. Tests unitaires :

```bash
npx vitest run src/hooks/__tests__/useBreakpoint.test.ts
```

## Notes

- Les tests utilisent `workers: 1` pour éviter les conflits de session.
- Les captures d'écran et vidéos sont sauvegardées en cas d'échec.
- Le `trace` est activé sur le premier retry.
- Les tests sont en français (`locale: fr-FR`) et timezone `Africa/Douala`.
