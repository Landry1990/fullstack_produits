# Generated migration for adding performance indexes
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('api', '0190_postecaisse_fond_de_caisse_alter_fournisseur_address_and_more'),
    ]

    operations = [
        # Index composite pour les requêtes de facturation par date et statut
        migrations.AddIndex(
            model_name='facture',
            index=models.Index(
                fields=['date', 'status', 'is_active'],
                name='fact_date_status_active_idx'
            ),
        ),
        
        # Index pour les requêtes de stock lot par produit et quantité restante
        migrations.AddIndex(
            model_name='stocklot',
            index=models.Index(
                fields=['produit', 'quantity_remaining', 'date_expiration'],
                name='stocklot_prod_qty_exp_idx'
            ),
        ),
        
        # Index pour les requêtes de commande par fournisseur et statut
        migrations.AddIndex(
            model_name='commande',
            index=models.Index(
                fields=['fournisseur', 'status', 'date'],
                name='cmd_fourn_status_date_idx'
            ),
        ),
        
        # Index pour les requêtes de mouvement de stock par produit et type
        migrations.AddIndex(
            model_name='mouvementstock',
            index=models.Index(
                fields=['produit', 'type_mouvement', '-date'],
                name='mvt_stock_prod_type_date_idx'
            ),
        ),
    ]
