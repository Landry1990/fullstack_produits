# Generated manually for UG tracking

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0026_avoir_ligneavoir'),
    ]

    operations = [
        migrations.AddField(
            model_name='commandeproduit',
            name='unites_gratuites',
            field=models.IntegerField(default=0, help_text='Unités gratuites reçues (ex: promotion 3+1)'),
        ),
        migrations.AddField(
            model_name='stocklot',
            name='quantity_paid',
            field=models.IntegerField(default=0, help_text='Quantité payée uniquement'),
        ),
        migrations.AddField(
            model_name='stocklot',
            name='quantity_free',
            field=models.IntegerField(default=0, help_text='Unités gratuites (UG)'),
        ),
        migrations.AlterField(
            model_name='commandeproduit',
            name='quantity',
            field=models.IntegerField(help_text='Quantité commandée et payée'),
        ),
        migrations.AlterField(
            model_name='stocklot',
            name='quantity_initial',
            field=models.IntegerField(help_text='Quantité totale initiale (payée + gratuites)'),
        ),
        migrations.AlterField(
            model_name='stocklot',
            name='price_cost',
            field=models.DecimalField(decimal_places=2, help_text="Prix d'achat unitaire effectif (ajusté avec UG)", max_digits=10),
        ),
    ]
