# Generated manually — flag "changement de mot de passe obligatoire" sur Profile

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0272_produit_type_produit'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='must_change_password',
            field=models.BooleanField(
                default=False,
                verbose_name='Changement de mot de passe obligatoire',
            ),
        ),
    ]
