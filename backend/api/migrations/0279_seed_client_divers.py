from django.db import migrations


def seed_client_divers(apps, schema_editor):
    """Client « CLIENTS DIVERS » créé une seule fois à l'installation.

    La facturation le sélectionne par défaut en caisse (useFacturationClients
    cherche le nom exact « CLIENTS DIVERS » ou « CLIENT DIVERS »). S'il est
    absent sur une installation existante, il est créé ici aussi — la
    migration ne tourne qu'une fois par base.

    Même philosophie que 0260_seed_defauts : le contrôle name__iexact inclut
    les fiches soft-deletées — une suppression par l'utilisateur reste
    définitive et la fiche n'est pas recréée.
    """
    Client = apps.get_model('api', 'Client')

    if not Client.objects.filter(name__iexact='CLIENTS DIVERS').exists() \
            and not Client.objects.filter(name__iexact='CLIENT DIVERS').exists():
        Client.objects.create(
            name='CLIENTS DIVERS',
            client_type='PARTICULIER',
            is_loyalty_member=False,
            is_active=True,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0278_pharmacy_post_box_and_register_length'),
    ]

    operations = [
        migrations.RunPython(seed_client_divers, migrations.RunPython.noop),
    ]
