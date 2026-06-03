---
description: Configuration du planificateur de commandes automatiques
---

# Configuration du Service de Ravitaillement Automatique

## 1. Runner Backend (Exécution)

Le runner existe déjà : `backend/api/management/commands/run_order_schedules.py`

### Activation via Cron (recommandé)

Ajouter dans crontab (exécute toutes les 10 minutes) :

```bash
*/10 * * * * cd /chemin/vers/backend && python manage.py run_order_schedules >> /var/log/order_schedules.log 2>&1
```

Ou via systemd timer pour une exécution plus robuste.

### Test manuel

```bash
python manage.py run_order_schedules
```

## 2. Validation Backend (Doublon)

✅ **Corrigé** dans `api/serializers.py` :

```python
class OrderScheduleSerializer(serializers.ModelSerializer):
    def validate(self, data):
        """Empêcher 2 plannings actifs pour le même fournisseur."""
        is_active = data.get('is_active', True)
        fournisseur = data.get('fournisseur')
        
        if is_active and fournisseur:
            existing_active = OrderSchedule.objects.filter(
                fournisseur=fournisseur,
                is_active=True
            )
            if self.instance:
                existing_active = existing_active.exclude(pk=self.instance.pk)
            
            if existing_active.exists():
                raise serializers.ValidationError({
                    'fournisseur': "Un planning actif existe déjà pour ce fournisseur."
                })
        return data
```

## 3. Sécurité Frontend (Validations)

✅ **Corrigé** dans `OrderSchedulingModal.tsx` :

| Validation | Détail |
|------------|--------|
| Fournisseur | `fournisseur > 0` (bloque valeur 0) |
| Fréquence | `>= 1` semaine |
| Jours actifs | `length > 0` |
| Format heure | Regex `HH:MM` |
| Date début | `>= aujourd'hui` |
| Logique AND/OR | Obligatoire si `min_amount > 0` ET `min_items > 0` |

## 4. Logique d'exécution

Le runner vérifie à chaque passage :
1. Planning actif (`is_active=True`)
2. Jour actif dans `active_days`
3. Pas encore exécuté aujourd'hui (`last_run.date != today`)
4. Heure actuelle >= `time`
5. Fréquence respectée (`weeks_diff % frequency_weeks == 0`)

Si conditions OK → génère commande en `EN_PREPARATION`.
