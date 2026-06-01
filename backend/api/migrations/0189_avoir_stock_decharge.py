from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0188_ligneavoir_motif'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='avoir',
            name='stock_decharge',
            field=models.BooleanField(default=False, help_text='True si le stock a été déchargé (retiré) pour cet avoir'),
        ),
        migrations.AddField(
            model_name='avoir',
            name='stock_decharge_at',
            field=models.DateTimeField(blank=True, null=True, help_text='Date/heure du déchargement du stock'),
        ),
        migrations.AddField(
            model_name='avoir',
            name='stock_decharge_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='avoirs_decharges',
                to=settings.AUTH_USER_MODEL,
                help_text='Utilisateur ayant effectué le déchargement'
            ),
        ),
    ]
