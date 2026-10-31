from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0277_mouvementcaisse_mode_paiement'),
    ]

    operations = [
        migrations.AddField(
            model_name='pharmacysettings',
            name='post_box',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AlterField(
            model_name='pharmacysettings',
            name='registre_commerce',
            field=models.CharField(blank=True, default='', help_text='Registre de Commerce', max_length=25),
        ),
    ]
