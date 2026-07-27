"""
Recalcule quantity_free_remaining pour tous les lots ayant des unités gratuites.

Corrige les lots créés avant l'initialisation explicite de quantity_free_remaining
(commande 67+). Le calcul se base sur :
- quantity_free (UG reçues)
- moins les ventes allouées sur ce lot (FactureProduitAllocation)
- plus les retours client réintégrés au lot (LigneAvoir)

Convention : les UG sont consommées en premier (FIFO UG).
"""
from django.db import migrations
from django.db.models import Sum


def recalculate_quantity_free_remaining(apps, schema_editor):
    StockLot = apps.get_model('api', 'StockLot')
    FactureProduitAllocation = apps.get_model('api', 'FactureProduitAllocation')
    LigneAvoir = apps.get_model('api', 'LigneAvoir')

    lots = StockLot.objects.filter(quantity_free__gt=0).only(
        'id', 'quantity_free', 'quantity_free_remaining',
        'quantity_remaining', 'quantity_reserved'
    )

    updated = 0
    for lot in lots:
        sold = FactureProduitAllocation.objects.filter(
            stock_lot=lot
        ).aggregate(total=Sum('quantity'))['total'] or 0

        returned = LigneAvoir.objects.filter(
            stock_lot=lot
        ).aggregate(total=Sum('quantity'))['total'] or 0

        net_consumed = sold - returned
        # Les UG sont consommées en premier
        new_remaining = max(0, lot.quantity_free - net_consumed)
        # On ne peut pas avoir plus d'UG restantes que d'unités totales restantes
        total_remaining = lot.quantity_remaining + lot.quantity_reserved
        new_remaining = min(new_remaining, total_remaining)

        if lot.quantity_free_remaining != new_remaining:
            lot.quantity_free_remaining = new_remaining
            lot.save(update_fields=['quantity_free_remaining'])
            updated += 1

    print(f"Migration 0222 : {updated} lots mis à jour sur {lots.count()} lots avec UG.")


def reverse_migration(apps, schema_editor):
    # Pas de retour arrière possible : les anciennes valeurs étaient incorrectes.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0221_fiscal_settings'),
    ]

    operations = [
        migrations.RunPython(
            recalculate_quantity_free_remaining,
            reverse_migration
        ),
    ]
