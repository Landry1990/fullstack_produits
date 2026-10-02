# Migration manuelle — index de performance (batch 0262)
# CREATE INDEX CONCURRENTLY oblige atomic = False (hors transaction)
# et un RunSQL par statement (un string multi-statements serait exécuté
# dans une transaction implicite par PostgreSQL, ce qui casse CONCURRENTLY).

from django.db import migrations, models


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ('api', '0261_alter_avoirclient_montant_total_and_more'),
    ]

    operations = [
        # ==================== MouvementStock ====================
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS mvt_stock_type_date_idx ON api_mouvementstock (type_mouvement, date);',
                    reverse_sql='DROP INDEX IF EXISTS mvt_stock_type_date_idx;',
                ),
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS mvt_stock_date_idx ON api_mouvementstock (date);',
                    reverse_sql='DROP INDEX IF EXISTS mvt_stock_date_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='mouvementstock',
                    index=models.Index(fields=['type_mouvement', 'date'], name='mvt_stock_type_date_idx'),
                ),
                migrations.AddIndex(
                    model_name='mouvementstock',
                    index=models.Index(fields=['date'], name='mvt_stock_date_idx'),
                ),
            ],
        ),
        # ==================== FactureProduitAllocation ====================
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS fpalloc_created_idx ON api_factureproduitallocation (created_at);',
                    reverse_sql='DROP INDEX IF EXISTS fpalloc_created_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='factureproduitallocation',
                    index=models.Index(fields=['created_at'], name='fpalloc_created_idx'),
                ),
            ],
        ),
        # ==================== Commande ====================
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS commande_active_date_idx ON api_commande (is_active, date DESC);',
                    reverse_sql='DROP INDEX IF EXISTS commande_active_date_idx;',
                ),
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS commande_date_cloture_idx ON api_commande (date_cloture);',
                    reverse_sql='DROP INDEX IF EXISTS commande_date_cloture_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='commande',
                    index=models.Index(fields=['is_active', '-date'], name='commande_active_date_idx'),
                ),
                migrations.AddIndex(
                    model_name='commande',
                    index=models.Index(fields=['date_cloture'], name='commande_date_cloture_idx'),
                ),
            ],
        ),
        # ==================== StockLot ====================
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS stocklot_date_reception_idx ON api_stocklot (date_reception);',
                    reverse_sql='DROP INDEX IF EXISTS stocklot_date_reception_idx;',
                ),
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS stocklot_qtyfree_reception_idx ON api_stocklot (date_reception) WHERE quantity_free > 0;',
                    reverse_sql='DROP INDEX IF EXISTS stocklot_qtyfree_reception_idx;',
                ),
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS stocklot_qtyfreerem_idx ON api_stocklot (produit_id) WHERE quantity_free_remaining > 0;',
                    reverse_sql='DROP INDEX IF EXISTS stocklot_qtyfreerem_idx;',
                ),
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS stocklot_qtyreserved_idx ON api_stocklot (produit_id) WHERE quantity_reserved <> 0;',
                    reverse_sql='DROP INDEX IF EXISTS stocklot_qtyreserved_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='stocklot',
                    index=models.Index(fields=['date_reception'], name='stocklot_date_reception_idx'),
                ),
                migrations.AddIndex(
                    model_name='stocklot',
                    index=models.Index(
                        fields=['date_reception'],
                        condition=models.Q(quantity_free__gt=0),
                        name='stocklot_qtyfree_reception_idx',
                    ),
                ),
                migrations.AddIndex(
                    model_name='stocklot',
                    index=models.Index(
                        fields=['produit'],
                        condition=models.Q(quantity_free_remaining__gt=0),
                        name='stocklot_qtyfreerem_idx',
                    ),
                ),
                migrations.AddIndex(
                    model_name='stocklot',
                    index=models.Index(
                        fields=['produit'],
                        condition=~models.Q(quantity_reserved=0),
                        name='stocklot_qtyreserved_idx',
                    ),
                ),
            ],
        ),
        # ==================== EcritureComptable ====================
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS ecriture_date_idx ON api_ecriturecomptable (date);',
                    reverse_sql='DROP INDEX IF EXISTS ecriture_date_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='ecriturecomptable',
                    index=models.Index(fields=['date'], name='ecriture_date_idx'),
                ),
            ],
        ),
        # ==================== LigneEcriture ====================
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS ligneecriture_compte_ecr_idx ON api_ligneecriture (compte_id, ecriture_id);',
                    reverse_sql='DROP INDEX IF EXISTS ligneecriture_compte_ecr_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='ligneecriture',
                    index=models.Index(fields=['compte', 'ecriture'], name='ligneecriture_compte_ecr_idx'),
                ),
            ],
        ),
        # ==================== AuditLog ====================
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS auditlog_action_ts_idx ON api_auditlog (action, timestamp);',
                    reverse_sql='DROP INDEX IF EXISTS auditlog_action_ts_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='auditlog',
                    index=models.Index(fields=['action', 'timestamp'], name='auditlog_action_ts_idx'),
                ),
            ],
        ),
        # ==================== Produit ====================
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS produit_rotation_idx ON api_produit (rotation_moyenne);',
                    reverse_sql='DROP INDEX IF EXISTS produit_rotation_idx;',
                ),
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS produit_dernier_vente_idx ON api_produit (dernier_vente);',
                    reverse_sql='DROP INDEX IF EXISTS produit_dernier_vente_idx;',
                ),
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS produit_dernier_achat_idx ON api_produit (dernier_achat);',
                    reverse_sql='DROP INDEX IF EXISTS produit_dernier_achat_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='produit',
                    index=models.Index(fields=['rotation_moyenne'], name='produit_rotation_idx'),
                ),
                migrations.AddIndex(
                    model_name='produit',
                    index=models.Index(fields=['dernier_vente'], name='produit_dernier_vente_idx'),
                ),
                migrations.AddIndex(
                    model_name='produit',
                    index=models.Index(fields=['dernier_achat'], name='produit_dernier_achat_idx'),
                ),
            ],
        ),
        # ==================== PosteVente ====================
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS postevente_actif_idx ON api_postevente (est_actif);',
                    reverse_sql='DROP INDEX IF EXISTS postevente_actif_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='postevente',
                    index=models.Index(fields=['est_actif'], name='postevente_actif_idx'),
                ),
            ],
        ),
        # ==================== Promis ====================
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS promis_status_active_idx ON api_promis (status, is_active);',
                    reverse_sql='DROP INDEX IF EXISTS promis_status_active_idx;',
                ),
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS promis_date_idx ON api_promis (date_promis);',
                    reverse_sql='DROP INDEX IF EXISTS promis_date_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='promis',
                    index=models.Index(fields=['status', 'is_active'], name='promis_status_active_idx'),
                ),
                migrations.AddIndex(
                    model_name='promis',
                    index=models.Index(fields=['date_promis'], name='promis_date_idx'),
                ),
            ],
        ),
        # ==================== FactureProduit ====================
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS factureproduit_created_idx ON api_factureproduit (created_at);',
                    reverse_sql='DROP INDEX IF EXISTS factureproduit_created_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='factureproduit',
                    index=models.Index(fields=['created_at'], name='factureproduit_created_idx'),
                ),
            ],
        ),
        # ==================== CommandeProduit ====================
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS commandeproduit_created_idx ON api_commandeproduit (created_at);',
                    reverse_sql='DROP INDEX IF EXISTS commandeproduit_created_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='commandeproduit',
                    index=models.Index(fields=['created_at'], name='commandeproduit_created_idx'),
                ),
            ],
        ),
        # ==================== Facture ====================
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS facture_date_annul_idx ON api_facture (date_annulation) WHERE date_annulation IS NOT NULL;',
                    reverse_sql='DROP INDEX IF EXISTS facture_date_annul_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='facture',
                    index=models.Index(
                        fields=['date_annulation'],
                        condition=models.Q(date_annulation__isnull=False),
                        name='facture_date_annul_idx',
                    ),
                ),
            ],
        ),
        # ==================== ClotureCaisse ====================
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS cloturecaisse_date_idx ON api_cloturecaisse (date);',
                    reverse_sql='DROP INDEX IF EXISTS cloturecaisse_date_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='cloturecaisse',
                    index=models.Index(fields=['date'], name='cloturecaisse_date_idx'),
                ),
            ],
        ),
        # ==================== ActivityLog ====================
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS activitylog_ts_idx ON api_activitylog (timestamp);',
                    reverse_sql='DROP INDEX IF EXISTS activitylog_ts_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='activitylog',
                    index=models.Index(fields=['timestamp'], name='activitylog_ts_idx'),
                ),
            ],
        ),
        # ==================== PaiementFournisseur ====================
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS paiementfour_date_idx ON api_paiementfournisseur (date_paiement);',
                    reverse_sql='DROP INDEX IF EXISTS paiementfour_date_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='paiementfournisseur',
                    index=models.Index(fields=['date_paiement'], name='paiementfour_date_idx'),
                ),
            ],
        ),
        # ==================== Inventaire ====================
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS inventaire_date_idx ON api_inventaire (date);',
                    reverse_sql='DROP INDEX IF EXISTS inventaire_date_idx;',
                ),
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS inventaire_status_idx ON api_inventaire (status);',
                    reverse_sql='DROP INDEX IF EXISTS inventaire_status_idx;',
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name='inventaire',
                    index=models.Index(fields=['date'], name='inventaire_date_idx'),
                ),
                migrations.AddIndex(
                    model_name='inventaire',
                    index=models.Index(fields=['status'], name='inventaire_status_idx'),
                ),
            ],
        ),
    ]
