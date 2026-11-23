from django.db import migrations


def seed_amortissements(apps, schema_editor):
    Compte = apps.get_model('api', 'CompteComptable')
    for numero, libelle in (
        ('281000', 'Amortissements des immobilisations incorporelles'),
        ('283000', 'Amortissements des bâtiments, installations techniques et agencements'),
        ('284000', 'Amortissements du matériel'),
    ):
        Compte.objects.using(schema_editor.connection.alias).get_or_create(
            numero=numero, defaults={'libelle': libelle, 'type': 'PASSIF', 'is_active': True})


class Migration(migrations.Migration):
    dependencies = [('api', '0302_seed_charge_accounts_syscohada')]

    operations = [migrations.RunPython(seed_amortissements, migrations.RunPython.noop)]
