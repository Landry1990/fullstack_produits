# Generated migration for LigneInventaire performance optimization
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Ajoute des index de performance sur LigneInventaire pour optimiser
    les requêtes fréquentes (merge, validation, stats, scan).
    """

    dependencies = [
        ('api', '0165_licence'),
    ]

    operations = [
        # Index principal: recherche par inventaire (très fréquent - getLignes, validation, stats)
        migrations.AddIndex(
            model_name='ligneinventaire',
            index=models.Index(
                fields=['inventaire', 'id'],
                name='idx_ligneinv_inventaire_id'
            ),
        ),

        # Index pour les recherches par produit (doublons, merge, audit)
        migrations.AddIndex(
            model_name='ligneinventaire',
            index=models.Index(
                fields=['produit', 'inventaire'],
                name='idx_ligneinv_produit_inv'
            ),
        ),

        # Index pour les recherches par lot (validation, scan)
        migrations.AddIndex(
            model_name='ligneinventaire',
            index=models.Index(
                fields=['stock_lot', 'inventaire'],
                name='idx_ligneinv_lot_inv'
            ),
        ),

        # Index composite pour les stats (ecart + inventaire)
        migrations.AddIndex(
            model_name='ligneinventaire',
            index=models.Index(
                fields=['inventaire', 'ecart'],
                name='idx_ligneinv_inv_ecart'
            ),
        ),

        # Index pour la contrainte unique conditionnelle existante (améliore la vérification d'unicité)
        migrations.AddIndex(
            model_name='ligneinventaire',
            index=models.Index(
                fields=['inventaire', 'stock_lot'],
                name='idx_ligneinv_inv_lot'
            ),
        ),
    ]
