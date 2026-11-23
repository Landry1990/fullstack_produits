from django.db import migrations


COMPTES = (
    ('622200', 'Locations de bâtiments'),
    ('628000', 'Frais de télécommunications'),
    ('605500', 'Fournitures de bureau non stockables'),
    ('605100', 'Fournitures non stockables - Eau'),
    ('605200', 'Fournitures non stockables - Électricité'),
    ('661000', 'Rémunérations directes du personnel national'),
    ('648000', 'Autres impôts et taxes'),
)


def seed_charges(apps, schema_editor):
    Compte = apps.get_model('api', 'CompteComptable')
    Ligne = apps.get_model('api', 'LigneEcriture')
    alias = schema_editor.connection.alias
    for numero, libelle in COMPTES:
        Compte.objects.using(alias).get_or_create(
            numero=numero, defaults={'libelle': libelle, 'type': 'CHARGE', 'is_active': True})
    corrections = (
        ('604000', 'Achats stockés - Emballages', 'Achats stockés de matières et fournitures consommables'),
        ('605000', 'Eau & Électricité', 'Autres achats'),
        ('605100', 'Autres achats', 'Fournitures non stockables - Eau'),
        ('622000', 'Internet & Téléphone', 'Locations, charges locatives'),
    )
    for numero, ancien, nouveau in corrections:
        compte = Compte.objects.using(alias).filter(numero=numero, libelle=ancien, type='CHARGE').first()
        if compte and not Ligne.objects.using(alias).filter(compte_id=compte.pk).exists():
            Compte.objects.using(alias).filter(pk=compte.pk).update(libelle=nouveau)


class Migration(migrations.Migration):
    dependencies = [('api', '0301_role_to_groupe')]

    operations = [migrations.RunPython(seed_charges, migrations.RunPython.noop)]
