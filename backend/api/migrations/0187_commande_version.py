from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0186_alter_fournisseur_address_alter_fournisseur_email_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='commande',
            name='version',
            field=models.IntegerField(default=1, help_text='Version pour optimistic locking (concurrency control)'),
        ),
    ]
