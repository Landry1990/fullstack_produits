from django.conf import settings
from django.db import migrations, models

import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0235_remise_validated_by'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='facture',
            name='prix_validated_by',
            field=models.ForeignKey(
                blank=True,
                help_text='Utilisateur qui a autorisé la modification de prix (si différent du validateur de la vente)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='prix_validated',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
