from django.db import migrations, models


class Migration(migrations.Migration):

    name = '0225_add_composite_indexes'
    dependencies = [
        ('api', '0224_add_external_backup_paths'),
    ]

    operations = [
        # Facture: composite index for default list query (is_active + status + -date)
        migrations.AddIndex(
            model_name='facture',
            index=models.Index(fields=['is_active', 'status', '-date'], name='facture_active_status_date_idx'),
        ),
        # FactureProduit: index on facture alone (existing facture+produit doesn't cover facture-only queries)
        migrations.AddIndex(
            model_name='factureproduit',
            index=models.Index(fields=['facture'], name='factureproduit_facture_idx'),
        ),
        # Caisse: composite indexes for get_totals and daily reports
        migrations.AddIndex(
            model_name='caisse',
            index=models.Index(fields=['mode_paiement', 'statut'], name='caisse_mode_statut_idx'),
        ),
        migrations.AddIndex(
            model_name='caisse',
            index=models.Index(fields=['-date_paiement', 'statut'], name='caisse_date_statut_idx'),
        ),
        # StockLot: composite index for peremption queries with stock remaining
        migrations.AddIndex(
            model_name='stocklot',
            index=models.Index(fields=['produit', 'quantity_remaining', 'date_expiration'], name='stocklot_prod_qty_exp_idx'),
        ),
        # StockLot: index on date_expiration alone for global peremption scans
        migrations.AddIndex(
            model_name='stocklot',
            index=models.Index(fields=['date_expiration'], name='stocklot_date_exp_idx'),
        ),
    ]
