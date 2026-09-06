from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0187_commande_version'),
    ]

    operations = [
        migrations.AddField(
            model_name='ligneavoir',
            name='motif',
            field=models.CharField(blank=True, default='', max_length=200, help_text='Motif spécifique de retour pour cette ligne'),
            preserve_default=False,
        ),
    ]
