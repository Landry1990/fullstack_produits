from decimal import Decimal

from django.db import migrations


def seed_defauts(apps, schema_editor):
    """Données par défaut créées une seule fois à l'installation.

    Déplacé depuis entrypoint.sh (qui recréait ces enregistrements à chaque
    démarrage du conteneur, même après suppression par l'utilisateur).
    La migration ne tourne qu'une fois par base : les suppressions deviennent
    définitives.
    """
    PosteCaisse = apps.get_model('api', 'PosteCaisse')
    PosteVente = apps.get_model('api', 'PosteVente')
    TVA = apps.get_model('api', 'TVA')
    Fournisseur = apps.get_model('api', 'Fournisseur')

    # Postes de caisse physiques
    for nom, code in [
        ('Caisse Principale', 'caisse-principale'),
        ('Caisse Secondaire', 'caisse-secondaire'),
    ]:
        PosteCaisse.objects.get_or_create(nom=nom, defaults={'code': code})

    # Postes de vente
    for nom in ['COMPTOIR1', 'COMPTOIR2', 'COMPTOIR3']:
        PosteVente.objects.get_or_create(
            nom=nom,
            defaults={'est_actif': False, 'caisse': None, 'vendeur': None},
        )

    # Taux de TVA
    for taux, libelle in [
        (Decimal('19.25'), 'TVA Normale'),
        (Decimal('0'), 'Exonéré'),
    ]:
        TVA.objects.get_or_create(
            taux=taux, defaults={'libelle': libelle, 'is_active': True}
        )

    # Fournisseurs (Ubipharm/Laborex payés sur relevé, autres à la facture).
    # name__iexact SANS filtre deleted_at : une fiche existante, même
    # soft-deletée, empêche la recréation — la suppression reste définitive.
    fournisseurs_defaults = [
        ('LABOREX CMR', False, 'RELEVE'),
        ('SIAP PHARMA', False, 'FACTURE'),
        ('UBIPHARM CMR', False, 'RELEVE'),
        ('DIVERS', True, 'FACTURE'),
        ('SLOY PHARMA', False, 'FACTURE'),
        ('PHARMA EXPRESS', False, 'FACTURE'),
    ]
    for nom, is_divers, reglement in fournisseurs_defaults:
        if not Fournisseur.objects.filter(name__iexact=nom).exists():
            Fournisseur.objects.create(
                name=nom,
                is_divers=is_divers,
                type_reglement=reglement,
                is_active=True,
            )


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0259_alter_pharmacysettings_show_pharmacist_on_documents'),
    ]

    operations = [
        migrations.RunPython(seed_defauts, migrations.RunPython.noop),
    ]
