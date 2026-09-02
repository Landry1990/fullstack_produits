from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0240_avoirclient_ligneavoirclient'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='can_create_client_credit',
            field=models.BooleanField(default=False, verbose_name='Créer des avoirs clients'),
        ),
    ]
