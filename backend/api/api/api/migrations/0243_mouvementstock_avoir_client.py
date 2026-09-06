from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0242_facture_facture_poste_status_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='mouvementstock',
            name='avoir_client',
            field=models.ForeignKey(
                blank=True,
                help_text='Avoir client associé au mouvement (pour les retours clients)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='mouvements_stock',
                to='api.avoirclient',
            ),
        ),
    ]
