# Generated manually — track UG (unités gratuites) consumed per allocation
# so cancel/modify can restore exactly the free units that were taken.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0255_postecaisse_actif"),
    ]

    operations = [
        migrations.AddField(
            model_name="factureproduitallocation",
            name="quantity_free",
            field=models.IntegerField(
                default=0,
                help_text="Part de la quantité prélevée sur les unités gratuites (UG) du lot",
            ),
        ),
    ]
