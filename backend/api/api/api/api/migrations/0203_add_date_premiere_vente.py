# Generated migration to add date_premiere_vente field to Produit model

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0202_remove_unique_client_phone'),
    ]

    operations = [
        migrations.AddField(
            model_name='produit',
            name='date_premiere_vente',
            field=models.DateField(
                blank=True,
                null=True,
                help_text='Date de la première vente (pour calcul précis de la rotation)',
            ),
        ),
    ]
