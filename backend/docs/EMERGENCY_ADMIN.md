# 🔐 Compte Super-Admin de Secours

## Création

Le compte est créé automatiquement par la migration `0180_create_emergency_superuser.py`.

**Par défaut:**
- Username: `sysadmin`
- Mot de passe: `ChangeMeImmediately123!` ⚠️

## 🔧 Configuration immédiate requise

### 1. Changer le mot de passe AVANT mise en production

```bash
cd backend
python scripts/reset_emergency_admin.py --password "VotreMotDePasseSuperFort123!"
```

Le mot de passe doit faire **minimum 12 caractères**.

### 2. Vérifier le compte

```bash
python scripts/reset_emergency_admin.py --status
```

Sortie attendue:
```
==================================================
Compte de secours: sysadmin
Actif: ✅ Oui
Superuser: ✅ Oui
Staff: ✅ Oui
Dernière connexion: Jamais
Date création: 2024-01-15 10:30:00
==================================================
```

## 🚨 Procédures d'urgence

### Accès perdu au compte admin principal

```bash
# Activer le compte de secours
python scripts/reset_emergency_admin.py --enable

# Se connecter avec sysadmin dans l'interface
# Récupérer/corriger le compte admin principal

# Désactiver le compte de secours après usage
python scripts/reset_emergency_admin.py --disable
```

### Mot de passe oublié du compte de secours

```bash
# Regénérer un nouveau mot de passe
python scripts/reset_emergency_admin.py --password "NouveauMotDePasse123!"
```

## 🔒 Bonnes pratiques

1. **Stocker le mot de passe hors-ligne** (coffre-fort, gestionnaire de mots de passe sécurisé)
2. **Ne jamais utiliser ce compte pour l'usage quotidien**
3. **Désactiver après usage** (`--disable`)
4. **Changer le mot de passe** après chaque utilisation d'urgence
5. **Auditer les connexions** via les logs Django Admin

## 📝 Logs d'audit

Toutes les actions du compte de secours sont tracées dans:
- Django Admin Log
- Logs applicatifs (si configurés)

Pour voir les connexions:
```python
# Django shell
from django.contrib.auth import get_user_model
User = get_user_model()
user = User.objects.get(username='sysadmin')
print(f"Dernière connexion: {user.last_login}")
```

## ⚠️ Avertissements

- **NE PAS SUPPRIMER** ce compte via l'interface admin
- **NE PAS MODIFIER** son statut superuser via l'interface
- Pour toute modification : utiliser les scripts CLI

## 🔄 Changement de username (optionnel)

Modifier la variable d'environnement avant la migration:

```bash
export EMERGENCY_ADMIN_USER="nom_technique_custom"
python manage.py migrate
```
