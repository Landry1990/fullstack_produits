---
description: Configuration des alertes popup d'expiration de licence
---

# Configuration des Alertes Popup de Licence

Ce workflow configure les alertes automatiques sous forme de **popups/toasts** pour tous les utilisateurs connectés, quand la licence arrive à expiration.

## Vue d'ensemble

- **Seuil d'alerte**: 7 jours avant expiration
- **Fréquence**: Quotidienne (à partir de J-7)
- **Canal**: SMS au pharmacien
- **Licences à vie**: Aucune alerte (pas d'expiration)

## Étapes de configuration

### 1. Configurer le numéro de téléphone

Dans Django Admin, configurez le numéro WhatsApp/SMS du pharmacien :

```
PharmacySettings → pharmacist_whatsapp_number
Exemple: +237123456789
```

### 2. Test manuel (optionnel)

Testez la commande avant de l'automatiser :

```bash
cd backend

# Test avec simulation (pas d'envoi réel)
python manage.py check_licence_expiration --dry-run

# Test avec numéro spécifique
python manage.py check_licence_expiration --phone +237123456789 --dry-run

# Test réel (envoie un vrai SMS si configuré)
python manage.py check_licence_expiration --threshold 30
```

### 3. Automatisation quotidienne

#### Linux (Cron)

Éditer le crontab :

```bash
crontab -e
```

Ajouter la ligne (exécution à 8h du matin) :

```
0 8 * * * cd /chemin/vers/fullstack_produits/backend && python manage.py check_licence_expiration >> /var/log/pharma_licence.log 2>&1
```

#### Windows (Planificateur de tâches)

1. Ouvrir le Planificateur de tâches (`taskschd.msc`)
2. Créer une tâche de base :
   - **Nom**: `Licence Expiration Alert`
   - **Déclencheur**: Tous les jours à 08:00
   - **Action**: Démarrer un programme
   - **Programme**: `python`
   - **Arguments**: `manage.py check_licence_expiration`
   - **Démarrer dans**: `C:\chemin\vers\fullstack_produits\backend`

### 4. Intégration SMS réel (optionnel)

Par défaut, le système utilise un mock SMS (simulation). Pour intégrer un vrai provider :

Éditer `backend/api/services/sms.py` :

```python
def _real_provider_send(self, recipient, message):
    """Intégration Twilio / Infobip / Autre"""
    import requests
    
    # Exemple Twilio
    response = requests.post(
        'https://api.twilio.com/2010-04-01/Accounts/XXX/Messages.json',
        auth=('account_sid', 'auth_token'),
        data={
            'From': '+1234567890',
            'To': recipient,
            'Body': message
        }
    )
    return response.json()
```

## Messages envoyés

| Jours restants | Urgence | Message |
|----------------|---------|---------|
| 0 | CRITIQUE | "URGENT: Licence expire AUJOURD'HUI..." |
| 1 | CRITIQUE | "URGENT: Licence expire DEMAIN..." |
| 2-3 | CRITIQUE | "ALERTE: Licence expire dans X jours..." |
| 4-7 | IMPORTANT | "ALERTE: Licence expire dans X jours..." |
| >7 | - | Pas d'alerte |

## Dépannage

### Erreur "Aucun numéro de téléphone configuré"

Vérifiez que `pharmacist_whatsapp_number` est défini dans PharmacySettings.

### Licence à vie non reconnue

Les licences LIFETIME n'ont pas de champ `exp` dans le JWT. Si vous voyez une expiration pour une licence à vie, regénérez-la avec le générateur mis à jour.

### SMS non envoyé

Vérifiez les logs dans Django Admin → SmsLog pour voir les tentatives d'envoi.

## Commandes utiles

```bash
# Voir l'aide
python manage.py check_licence_expiration --help

# Tester avec seuil personnalisé (ex: 30 jours)
python manage.py check_licence_expiration --threshold 30

# Forcer l'envoi à un numéro spécifique
python manage.py check_licence_expiration --phone +237123456789
```

## Logs

Les logs sont écrits dans :
- Console (stdout)
- Fichier (si configuré dans cron: `/var/log/pharma_licence.log`)
- Base de données (SmsLog avec type='LICENCE_ALERT')
