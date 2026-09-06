"""Ajout du billetage (comptage des coupures) à la clôture de caisse
et du paramètre billetage_obligatoire sur PharmacySettings."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0237_add_can_do_remise'),
    ]

    operations = [
        migrations.AddField(
            model_name='pharmacysettings',
            name='billetage_obligatoire',
            field=models.BooleanField(
                default=True,
                help_text="Forcer le billetage (comptage des coupures) à la clôture de caisse"
            ),
        ),
        migrations.AddField(
            model_name='cloturecaisse',
            name='billetage',
            field=models.JSONField(
                default=dict,
                blank=True,
                help_text="Détail du billetage (coupures comptées) à la clôture"
            ),
        ),
    ]
