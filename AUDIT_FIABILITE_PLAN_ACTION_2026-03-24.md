# Audit fiabilite et plan d'action

Date: 2026-03-24
Contexte: serveur local (non expose Internet)

## Verdict global

- Usage local interne: acceptable avec vigilance.
- Exposition reseau/prod: non prete sans durcissement.
- Note qualitative globale estimee: 6.5/10.

## Constats majeurs

### Backend

- Controle d'acces insuffisant sur certaines routes sensibles.
- Faiblesse d'authentification (variantes de casse du mot de passe).
- Endpoint de restauration ZIP dangereux sans validation de chemins.
- Gestion d'erreurs parfois trop verbeuse (`str(e)` renvoye au client).
- Qualite generale correcte sur logique metier (transactions, services), mais dette technique notable.

### Frontend

- Surface XSS (usage de rendu HTML non necessaire).
- Couche API heterogene (clients axios multiples et usages directs).
- Hook de facturation trop massif (maintenabilite/testabilite reduites).
- Erreurs parfois silencieuses et i18n inegale.

### Configuration

- Risque de `DEBUG` actif par mauvaise variable d'environnement en prod.
- CSP trop permissive.

## Correctifs P0 appliques

- `backend/api/views/users.py`
  - CRUD utilisateurs reserve aux admins (`IsAdminUser`) via `get_permissions`.
  - Verification mot de passe strictement sensible a la casse (suppression des variantes lower/upper/capitalize).

- `backend/api/serializers.py`
  - `UserSerializer`: `is_superuser` en lecture seule.
  - Protection create/update pour ignorer toute tentative d'elevation de privilege par un non-admin.
  - Validation explicite de presence du mot de passe a la creation.

- `backend/api/views/code_backup.py`
  - Ajout validation anti path traversal sur membres ZIP.
  - Refus des archives contenant des chemins dangereux.

- `backend/backend/settings.py`
  - `DJANGO_DEBUG` par defaut a `False`.

- `docker-compose.prod.yml`
  - Correction variable environnement de `DEBUG=False` vers `DJANGO_DEBUG=False`.

- `frontend/frontend/src/components/common/SudoValidationModal.tsx`
  - Suppression `dangerouslySetInnerHTML` pour le message.
  - Lecture des validateurs via `/api/users/operators/`.

- `frontend/frontend/src/hooks/useFacturationState.ts`
  - Messages sudo convertis en texte brut (plus de HTML injecte).

Verification post-correctifs:
- Lint cible execute sur fichiers modifies: aucune erreur detectee.

## Plan de remediations

## Phase 1 (48h)

- Fermer les endpoints `AllowAny` non justifies (categories, ajustements stock, etc.).
- Durcir CSP (retirer `unsafe-eval`, limiter `connect-src`/`img-src` aux origines reelles).
- Uniformiser la gestion d'erreurs backend (pas d'exception brute renvoyee).
- Ajouter tests de securite prioritaires:
  - creation utilisateur non-admin,
  - restauration ZIP malveillante,
  - acces non autorise aux routes sensibles.
- Executer une batterie de smoke tests metier:
  - login,
  - creation utilisateur admin,
  - mode sudo,
  - facturation simple,
  - impression.

## Phase 2 (2 semaines)

- Refactoriser `useFacturationState` en hooks metier plus petits.
- Unifier la couche API frontend autour d'un client unique.
- Nettoyer serializers backend incoherents (methodes dupliquees, logique melangee).
- Renforcer la strategie de tests (suppression skip/placeholders, assertions deterministes).
- Completer durcissement config deploiement:
  - timeouts proxy nginx,
  - `SECURE_PROXY_SSL_HEADER`,
  - alignement static URLs.

## Checklist go/no-go avant exposition reseau

- [ ] DEBUG desactive confirme en environnement cible.
- [ ] Endpoints sensibles verifies (authz + tests).
- [ ] CSP durcie et testee.
- [ ] Tests critiques securite et flux metier au vert.
- [ ] Journalisation d'erreurs propre (sans fuite d'infos internes).
- [ ] Revue finale rapide de config deploiement.
