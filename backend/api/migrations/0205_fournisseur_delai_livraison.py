# Migration pour ajouter le champ délai de livraison au fournisseur

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0204_produit_fournisseur_seuil'),
    ]

    operations = [
        migrations.AddField(
            model_name='fournisseur',
            name='delai_livraison_jours',
            field=models.IntegerField(
                default=2,
                help_text='Délai de livraison en jours (défaut: 2 jours pour les fournisseurs locaux)',
            ),
        ),
    ]
