# Seed du plan comptable SYSCOHADA révisé — périmètre officine.
# Idempotent : get_or_create sur le numéro, n'écrase jamais une fiche existante.
from django.db import migrations

# (numero, libelle, type)
# Classes 6/7 = CHARGE/PRODUIT ; classes 1-5 réparties ACTIF/PASSIF selon le sens.
COMPTES = [
    # Classe 1 — Capitaux / ressources durables (passif)
    ('101000', 'Capital', 'PASSIF'),
    ('108000', 'Compte de l\'exploitant', 'PASSIF'),
    ('110000', 'Report à nouveau (créditeur)', 'PASSIF'),
    ('111000', 'Réserve légale', 'PASSIF'),
    ('120000', 'Résultat de l\'exercice', 'PASSIF'),
    ('151000', 'Provisions réglementées', 'PASSIF'),
    ('161000', 'Emprunts et dettes assimilées', 'PASSIF'),
    ('172000', 'Dettes de location acquisition / crédit-bail', 'PASSIF'),
    ('191000', 'Provisions financières pour risques', 'PASSIF'),

    # Classe 2 — Actif immobilisé
    ('201000', 'Frais d\'établissement', 'ACTIF'),
    ('213000', 'Logiciels et licences', 'ACTIF'),
    ('215000', 'Fonds commercial', 'ACTIF'),
    ('221000', 'Terrains', 'ACTIF'),
    ('231000', 'Bâtiments sur sol propre', 'ACTIF'),
    ('241000', 'Matériel et outillage', 'ACTIF'),
    ('244000', 'Matériel et mobilier', 'ACTIF'),
    ('245000', 'Matériel de transport', 'ACTIF'),
    ('261000', 'Dépôts et cautionnements versés', 'ACTIF'),
    ('281000', 'Amortissements des immobilisations incorporelles', 'PASSIF'),
    ('282000', 'Amortissements des immobilisations corporelles', 'PASSIF'),
    ('291000', 'Dépréciations des immobilisations', 'PASSIF'),

    # Classe 3 — Stocks
    ('311000', 'Marchandises', 'ACTIF'),
    ('312000', 'Emballages', 'ACTIF'),
    ('391000', 'Dépréciations des stocks de marchandises', 'PASSIF'),

    # Classe 4 — Tiers
    ('401100', 'Fournisseurs', 'PASSIF'),
    ('402000', 'Fournisseurs d\'immobilisations', 'PASSIF'),
    ('409100', 'Fournisseurs - Avances et acomptes versés', 'ACTIF'),
    ('411100', 'Clients', 'ACTIF'),
    ('416000', 'Clients douteux', 'ACTIF'),
    ('418100', 'Clients - Factures à établir', 'ACTIF'),
    ('419100', 'Clients - Avances et acomptes reçus', 'PASSIF'),
    ('421000', 'Personnel - Avances et acomptes', 'ACTIF'),
    ('422000', 'Personnel - Rémunérations dues', 'PASSIF'),
    ('431000', 'Sécurité sociale (CNPS)', 'PASSIF'),
    ('441000', 'État et collectivités publiques', 'PASSIF'),
    ('443100', 'TVA Collectée', 'PASSIF'),
    ('444000', 'État - Impôts sur les bénéfices', 'PASSIF'),
    ('445100', 'TVA Déductible', 'ACTIF'),
    ('447000', 'Autres impôts et taxes', 'PASSIF'),
    ('451000', 'Groupe et associés', 'ACTIF'),
    ('461000', 'Débiteurs divers', 'ACTIF'),
    ('471000', 'Compte d\'attente', 'ACTIF'),
    ('481000', 'Charges constatées d\'avance', 'ACTIF'),
    ('486000', 'Produits constatés d\'avance', 'PASSIF'),
    ('491000', 'Dépréciations des comptes de clients', 'PASSIF'),

    # Classe 5 — Trésorerie
    ('501000', 'Titres de placement', 'ACTIF'),
    ('521100', 'Banque', 'ACTIF'),
    ('530000', 'Établissements financiers', 'ACTIF'),
    ('560000', 'Banques - Crédits de trésorerie', 'PASSIF'),
    ('571100', 'Caisse', 'ACTIF'),
    ('581000', 'Régies d\'avances et accréditifs', 'ACTIF'),
    ('585000', 'Virements de fonds internes', 'ACTIF'),

    # Classe 6 — Charges
    ('601100', 'Achats de marchandises', 'CHARGE'),
    ('602000', 'Achats de matières et fournitures', 'CHARGE'),
    ('604000', 'Achats stockés - Emballages', 'CHARGE'),
    ('605000', 'Eau & Électricité', 'CHARGE'),
    ('605100', 'Autres achats', 'CHARGE'),
    ('608000', 'Frais accessoires d\'achats', 'CHARGE'),
    ('611000', 'Transports sur achats', 'CHARGE'),
    ('612000', 'Transports sur ventes', 'CHARGE'),
    ('621000', 'Services extérieurs', 'CHARGE'),
    ('622000', 'Internet & Téléphone', 'CHARGE'),
    ('623000', 'Redevances', 'CHARGE'),
    ('624000', 'Entretien, réparations et maintenance', 'CHARGE'),
    ('626000', 'Frais de documentation technique', 'CHARGE'),
    ('627000', 'Publicité et relations publiques', 'CHARGE'),
    ('631000', 'Honoraires', 'CHARGE'),
    ('646000', 'Droits de mutation et timbres', 'CHARGE'),
    ('647000', 'Impôts et taxes sur rémunérations', 'CHARGE'),
    ('648000', 'Autres impôts et taxes', 'CHARGE'),
    ('651000', 'Pertes sur créances clients', 'CHARGE'),
    ('658000', 'Charges diverses', 'CHARGE'),
    ('661000', 'Salaires et rémunérations', 'CHARGE'),
    ('663000', 'Charges sociales sur rémunérations', 'CHARGE'),
    ('664000', 'Charges sociales à la charge de l\'entreprise', 'CHARGE'),
    ('671000', 'Frais financiers et charges assimilées', 'CHARGE'),
    ('675000', 'Escomptes accordés', 'CHARGE'),
    ('681000', 'Dotations aux amortissements', 'CHARGE'),
    ('691000', 'Dotations aux provisions', 'CHARGE'),
    ('695000', 'Impôts sur les bénéfices', 'CHARGE'),

    # Classe 7 — Produits
    ('701100', 'Ventes de marchandises', 'PRODUIT'),
    ('705000', 'Travaux et services vendus', 'PRODUIT'),
    ('707000', 'Locations diverses', 'PRODUIT'),
    ('711000', 'Subventions d\'exploitation', 'PRODUIT'),
    ('731000', 'Variations des stocks de marchandises', 'PRODUIT'),
    ('758000', 'Produits divers', 'PRODUIT'),
    ('771000', 'Revenus financiers', 'PRODUIT'),
    ('775000', 'Escomptes obtenus', 'PRODUIT'),
    ('781000', 'Reprises de provisions', 'PRODUIT'),
    ('791000', 'Transferts de charges', 'PRODUIT'),
]


def seed_plan_comptable(apps, schema_editor):
    CompteComptable = apps.get_model('api', 'CompteComptable')
    for numero, libelle, type_ in COMPTES:
        CompteComptable.objects.get_or_create(
            numero=numero,
            defaults={'libelle': libelle, 'type': type_},
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0279_seed_client_divers'),
    ]

    operations = [
        migrations.RunPython(seed_plan_comptable, noop),
    ]
