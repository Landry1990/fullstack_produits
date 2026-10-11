# Generated manually — ajout du type PRODUIT/SERVICE sur Produit

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0271_document_counters'),
    ]

    operations = [
        migrations.AddField(
            model_name='produit',
            name='type_produit',
            field=models.CharField(
                choices=[('PRODUIT', 'Produit'), ('SERVICE', 'Service')],
                db_index=True,
                default='PRODUIT',
                help_text='SERVICE = acte/prestation facturable sans gestion de stock (soin, injection, glycémie, prise de tension…)',
                max_length=10,
            ),
        ),
    ]
