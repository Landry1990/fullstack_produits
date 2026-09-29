from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0256_factureproduitallocation_quantity_free'),
    ]

    operations = [
        migrations.AddField(
            model_name='pharmacysettings',
            name='pharmacist_name',
            field=models.CharField(blank=True, default='', help_text='Nom du pharmacien titulaire (ex: Dr Jean Mballa)', max_length=200),
        ),
        migrations.AddField(
            model_name='pharmacysettings',
            name='show_pharmacist_on_documents',
            field=models.BooleanField(default=False, help_text='Afficher le nom du pharmacien sur les tickets et factures'),
        ),
    ]
