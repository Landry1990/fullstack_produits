# Migration pour ajouter le champ délai de livraison au fournisseur

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0204_produit_fournisseur_seuil'),
    ]

    operations = [
        # Ce champ est déjà créé dans la migration 0196_add_fournisseur_logistics_fields
    ]
