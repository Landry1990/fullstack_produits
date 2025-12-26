# Generated manually on 2025-12-22 22:14
# Fix duplicate lot constraint by using composite unique on (produit, lot)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0040_alter_mouvementcaisse_options_and_more'),
    ]

    operations = [
        # 1. Supprimer l'ancienne contrainte unique sur le champ 'lot'
        migrations.AlterField(
            model_name='stocklot',
            name='lot',
            field=models.CharField(
                blank=True, 
                db_index=True, 
                help_text='Numéro de lot auto-généré ou manuel', 
                max_length=20, 
                null=True
            ),
        ),
        # 2. Ajouter la nouvelle contrainte composite unique sur (produit, lot)
        migrations.AddConstraint(
            model_name='stocklot',
            constraint=models.UniqueConstraint(
                condition=models.Q(('lot__isnull', False)),
                fields=('produit', 'lot'),
                name='unique_produit_lot'
            ),
        ),
    ]
