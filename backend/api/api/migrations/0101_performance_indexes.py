# Generated migration for performance optimization indexes
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Ajoute des index de performance pour optimiser les requêtes du dashboard
    et des pages à fort trafic.
    """

    dependencies = [
        ('api', '0100_objectifcommercial'),
    ]

    operations = [
        # Index pour les statistiques de facturation (dashboard)
        migrations.AddIndex(
            model_name='facture',
            index=models.Index(
                fields=['date', 'status'],
                name='idx_facture_date_status'
            ),
        ),
        
        # Index pour les statistiques utilisateur
        migrations.AddIndex(
            model_name='facture',
            index=models.Index(
                fields=['created_by', 'date', 'status'],
                name='idx_facture_user_date_status'
            ),
        ),
        
        # Index pour les alertes de stock critique
        migrations.AddIndex(
            model_name='produit',
            index=models.Index(
                fields=['stock', 'stock_minimum', 'rotation_moyenne'],
                name='idx_produit_stock_alerts'
            ),
        ),
        
        # Index pour le filtre is_active (très fréquent)
        migrations.AddIndex(
            model_name='produit',
            index=models.Index(
                fields=['is_active', 'stock'],
                name='idx_produit_active_stock'
            ),
        ),
        
        # Index pour les créances clients
        migrations.AddIndex(
            model_name='caisse',
            index=models.Index(
                fields=['facture', 'statut', 'mode_paiement'],
                name='idx_caisse_facture_status'
            ),
        ),
        
        # Index pour les commandes par fournisseur
        migrations.AddIndex(
            model_name='commande',
            index=models.Index(
                fields=['fournisseur', 'date', 'status'],
                name='idx_commande_fournisseur_date'
            ),
        ),
    ]
