"""
Index de performance pour optimisation 12 postes simultanés
"""
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Ajoute des index partiels et composites pour optimiser les requêtes fréquentes
    avec 12 postes de caisse simultanés.
    """
    
    dependencies = [
        ('api', '0167_licencenotification'),
    ]

    operations = [
        # 1. Index composite Caisse pour les calculs de solde (très fréquent)
        # Accélère: SELECT SUM(montant) FROM caisse WHERE facture_id=X AND statut='completee'
        migrations.AddIndex(
            model_name='caisse',
            index=models.Index(
                fields=['facture', 'statut'],
                name='idx_caisse_facture_statut',
                condition=models.Q(statut='completee'),
            ),
        ),
        
        # 2. Index composite Facture pour les requêtes client (très fréquent)
        # Accélère: SELECT * FROM facture WHERE client_id=X AND status IN ('VAL', 'PAY')
        migrations.AddIndex(
            model_name='facture',
            index=models.Index(
                fields=['client', 'status'],
                name='idx_facture_client_status',
                condition=models.Q(status__in=['VAL', 'PAY']),
            ),
        ),
        
        # 3. Index sur date pour les requêtes historiques fréquentes
        migrations.AddIndex(
            model_name='facture',
            index=models.Index(
                fields=['date'],
                name='idx_facture_date',
            ),
        ),
        
        # 4. Index composite pour les requêtes de créances (créances.py)
        # Accélère les requêtes sur factures non réglées
        migrations.AddIndex(
            model_name='facture',
            index=models.Index(
                fields=['status', 'is_active'],
                name='idx_facture_status_active',
                condition=models.Q(is_active=True),
            ),
        ),
        
        # 5. Index name Produit pour recherches texte (omnisearch)
        # Les CIP (cip1, cip2, cip3) ont déjà db_index=True
        migrations.AddIndex(
            model_name='produit',
            index=models.Index(
                fields=['name'],
                name='idx_produit_name_full',
            ),
        ),
        
        # 6. Index rayon pour filtrage rapide
        migrations.AddIndex(
            model_name='produit',
            index=models.Index(
                fields=['rayon'],
                name='idx_produit_rayon',
            ),
        ),
        
        # 7. Index StockLot pour les requêtes de stock fréquentes
        # Accélère: SELECT * FROM stock_lot WHERE produit_id=X AND quantity_remaining>0
        migrations.AddIndex(
            model_name='stocklot',
            index=models.Index(
                fields=['produit', 'quantity_remaining'],
                name='idx_stocklot_produit_qty',
                condition=models.Q(quantity_remaining__gt=0),
            ),
        ),
        
        # 8. Index sur date d'expiration pour les alertes péremption
        migrations.AddIndex(
            model_name='stocklot',
            index=models.Index(
                fields=['date_expiration'],
                name='idx_stocklot_expiration',
            ),
        ),
        
        # 9. Index Client pour recherche rapide (omnisearch)
        migrations.AddIndex(
            model_name='client',
            index=models.Index(
                fields=['name'],
                name='idx_client_name',
            ),
        ),
        
        # 10. Index CommandeProduit pour les calculs de total
        migrations.AddIndex(
            model_name='commandeproduit',
            index=models.Index(
                fields=['commande'],
                name='idx_cmdproduit_commande',
            ),
        ),
        
        # 11. Index MouvementCaisse pour les rapports journaliers
        migrations.AddIndex(
            model_name='mouvementcaisse',
            index=models.Index(
                fields=['date', 'type'],
                name='idx_mvtcaisse_date_type',
            ),
        ),
        
        # 12. Index AuditLog pour les requêtes d'historique
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(
                fields=['timestamp'],
                name='idx_auditlog_timestamp',
            ),
        ),
    ]
