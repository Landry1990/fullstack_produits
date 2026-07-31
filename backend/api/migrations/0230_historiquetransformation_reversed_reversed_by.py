from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0229_add_phone2_to_pharmacysettings'),
    ]

    operations = [
        migrations.AddField(
            model_name='historiquetransformation',
            name='reversed',
            field=models.BooleanField(default=False, help_text='Indique si cette transformation a été annulée'),
        ),
        migrations.AddField(
            model_name='historiquetransformation',
            name='reversed_by',
            field=models.ForeignKey(
                blank=True,
                help_text="Si cette entrée est une annulation, pointe vers l'entrée originale",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='reversal_of',
                to='api.historiquetransformation',
            ),
        ),
    ]
