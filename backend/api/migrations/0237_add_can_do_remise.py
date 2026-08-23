from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0236_prix_validated_by'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='can_do_remise',
            field=models.BooleanField(default=False, verbose_name='Appliquer des remises'),
        ),
    ]
