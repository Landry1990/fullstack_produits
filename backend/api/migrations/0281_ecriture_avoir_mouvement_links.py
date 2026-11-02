import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0280_seed_plan_comptable_syscohada'),
    ]

    operations = [
        migrations.AddField(
            model_name='ecriturecomptable',
            name='avoir_client',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ecritures_compta', to='api.avoirclient'),
        ),
        migrations.AddField(
            model_name='ecriturecomptable',
            name='mouvement_caisse',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ecritures_compta', to='api.mouvementcaisse'),
        ),
    ]
