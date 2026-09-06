"""
Ajout des champs version pour Optimistic Locking
Remplace select_for_update pour améliorer la concurrence avec 12 postes
"""
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Ajoute le champ 'version' aux modèles critiques pour optimistic locking:
    - Facture: évite les verrous sur paiements
    - Produit: évite les verrous sur stock
    - StockLot: évite les verrous sur allocation FIFO
    """
    
    dependencies = [
        ('api', '0169_client_denormalized_balance'),
    ]

    operations = [
        # Version pour Facture (paiements concurrents)
        migrations.AddField(
            model_name='facture',
            name='version',
            field=models.IntegerField(
                default=1,
                help_text='Version pour optimistic locking (concurrency control)'
            ),
        ),
        
        # Version pour Produit (stock concurrent)
        migrations.AddField(
            model_name='produit',
            name='version',
            field=models.IntegerField(
                default=1,
                help_text='Version pour optimistic locking (concurrency control)'
            ),
        ),
        
        # Version pour StockLot (allocation FIFO concurrente)
        migrations.AddField(
            model_name='stocklot',
            name='version',
            field=models.IntegerField(
                default=1,
                help_text='Version pour optimistic locking (concurrency control)'
            ),
        ),
        
        # Index sur version pour les vérifications rapides
        migrations.AddIndex(
            model_name='facture',
            index=models.Index(fields=['version'], name='idx_facture_version'),
        ),
        migrations.AddIndex(
            model_name='produit',
            index=models.Index(fields=['version'], name='idx_produit_version'),
        ),
        migrations.AddIndex(
            model_name='stocklot',
            index=models.Index(fields=['version'], name='idx_stocklot_version'),
        ),
    ]
