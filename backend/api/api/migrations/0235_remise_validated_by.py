from django.conf import settings
from django.db import migrations, models

import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0234_profile_can_validate_sales'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='facture',
            name='remise_validated_by',
            field=models.ForeignKey(
                blank=True,
                help_text='Utilisateur qui a validé la remise (si différent du validateur de la vente)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='remises_validated',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
